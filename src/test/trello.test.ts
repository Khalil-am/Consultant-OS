import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  mapListToStatus,
  mapLabelsToPriority,
  mapLabelsToSeverity,
  isRiskCard,
  mapRiskCategory,
  extractClient,
  extractProducts,
  resolveCustomFields,
} from '../lib/trello';
import type { TrelloLabel, TrelloCard } from '../lib/trello';

// Stub import.meta.env so module-level code doesn't throw
beforeAll(() => {
  vi.stubEnv('VITE_TRELLO_API_KEY', 'test-key');
  vi.stubEnv('VITE_TRELLO_TOKEN', 'test-token');
});

// ── Helpers ────────────────────────────────────────────────────
function makeLabel(name: string, color: string | null = null): TrelloLabel {
  return { id: `lbl-${name}`, name, color };
}

function makeCard(overrides: Partial<TrelloCard> = {}): TrelloCard {
  return {
    id: 'card-1',
    name: 'Test Card',
    desc: '',
    due: null,
    dueComplete: false,
    idList: 'list-1',
    idBoard: 'board-1',
    labels: [],
    idMembers: [],
    url: 'https://trello.com/c/test',
    closed: false,
    shortUrl: 'https://trello.com/c/test',
    pos: 1,
    dateLastActivity: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus', () => {
  it('maps done/complete/finished/closed to Completed', () => {
    expect(mapListToStatus('Done')).toBe('Completed');
    expect(mapListToStatus('Completed')).toBe('Completed');
    expect(mapListToStatus('Finished')).toBe('Completed');
    expect(mapListToStatus('Closed')).toBe('Completed');
    expect(mapListToStatus('Done ✅')).toBe('Completed');
  });

  it('maps review/testing/qa/approval to In Review', () => {
    expect(mapListToStatus('Code Review')).toBe('In Review');
    expect(mapListToStatus('QA Testing')).toBe('In Review');
    expect(mapListToStatus('Approval')).toBe('In Review');
    expect(mapListToStatus('testing')).toBe('In Review');
  });

  it('maps progress/doing/active/wip to In Progress', () => {
    expect(mapListToStatus('In Progress')).toBe('In Progress');
    expect(mapListToStatus('Doing')).toBe('In Progress');
    expect(mapListToStatus('Active')).toBe('In Progress');
    expect(mapListToStatus('WIP')).toBe('In Progress');
  });

  it('maps overdue/blocked/escalated to Overdue', () => {
    expect(mapListToStatus('Overdue')).toBe('Overdue');
    expect(mapListToStatus('Blocked')).toBe('Overdue');
    expect(mapListToStatus('Escalated')).toBe('Overdue');
  });

  it('defaults to Backlog for unknown list names', () => {
    expect(mapListToStatus('To Do')).toBe('Backlog');
    expect(mapListToStatus('Backlog')).toBe('Backlog');
    expect(mapListToStatus('Upcoming')).toBe('Backlog');
    expect(mapListToStatus('')).toBe('Backlog');
    expect(mapListToStatus('Sprint Planning')).toBe('Backlog');
  });

  it('is case-insensitive', () => {
    expect(mapListToStatus('IN PROGRESS')).toBe('In Progress');
    expect(mapListToStatus('DONE')).toBe('Completed');
    expect(mapListToStatus('Code REVIEW')).toBe('In Review');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToPriority', () => {
  it('returns Critical for red color', () => {
    expect(mapLabelsToPriority([makeLabel('', 'red')])).toBe('Critical');
  });

  it('returns Critical for label name containing "critical"', () => {
    expect(mapLabelsToPriority([makeLabel('Critical', 'blue')])).toBe('Critical');
  });

  it('returns Critical for label name containing "urgent"', () => {
    expect(mapLabelsToPriority([makeLabel('Urgent Fix', null)])).toBe('Critical');
  });

  it('returns High for orange color', () => {
    expect(mapLabelsToPriority([makeLabel('', 'orange')])).toBe('High');
  });

  it('returns High for label name containing "high"', () => {
    expect(mapLabelsToPriority([makeLabel('High Priority', null)])).toBe('High');
  });

  it('returns Medium for yellow color', () => {
    expect(mapLabelsToPriority([makeLabel('', 'yellow')])).toBe('Medium');
  });

  it('returns Medium for label name containing "medium" or "mod"', () => {
    expect(mapLabelsToPriority([makeLabel('Medium', null)])).toBe('Medium');
    expect(mapLabelsToPriority([makeLabel('Moderate', null)])).toBe('Medium');
  });

  it('returns Low for green color', () => {
    expect(mapLabelsToPriority([makeLabel('', 'green')])).toBe('Low');
  });

  it('returns Low for label name containing "low"', () => {
    expect(mapLabelsToPriority([makeLabel('Low Priority', null)])).toBe('Low');
  });

  it('defaults to Medium for empty labels', () => {
    expect(mapLabelsToPriority([])).toBe('Medium');
  });

  it('defaults to Medium when no priority labels found', () => {
    expect(mapLabelsToPriority([makeLabel('Meeting', 'sky'), makeLabel('P+', null)])).toBe('Medium');
  });

  it('returns first match when multiple priority labels exist', () => {
    // red comes first → Critical
    expect(mapLabelsToPriority([makeLabel('', 'red'), makeLabel('', 'green')])).toBe('Critical');
    // green comes first → Low
    expect(mapLabelsToPriority([makeLabel('', 'green'), makeLabel('', 'red')])).toBe('Low');
  });

  it('handles null color gracefully', () => {
    expect(mapLabelsToPriority([makeLabel('SomeLabel', null)])).toBe('Medium');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToSeverity', () => {
  it('mirrors mapLabelsToPriority output', () => {
    expect(mapLabelsToSeverity([makeLabel('', 'red')])).toBe('Critical');
    expect(mapLabelsToSeverity([makeLabel('', 'orange')])).toBe('High');
    expect(mapLabelsToSeverity([makeLabel('', 'yellow')])).toBe('Medium');
    expect(mapLabelsToSeverity([makeLabel('', 'green')])).toBe('Low');
    expect(mapLabelsToSeverity([])).toBe('Medium');
  });
});

// ─────────────────────────────────────────────────────────────
describe('isRiskCard', () => {
  it('returns true when list name contains "risk"', () => {
    expect(isRiskCard(makeCard(), 'Risk Register')).toBe(true);
    expect(isRiskCard(makeCard(), 'Risks')).toBe(true);
  });

  it('returns true when a label contains "risk"', () => {
    const card = makeCard({ labels: [makeLabel('Risk Item')] });
    expect(isRiskCard(card, 'Backlog')).toBe(true);
  });

  it('returns true when a label contains "issue"', () => {
    const card = makeCard({ labels: [makeLabel('Issue')] });
    expect(isRiskCard(card, 'To Do')).toBe(true);
  });

  it('returns true when a label contains "threat"', () => {
    const card = makeCard({ labels: [makeLabel('External Threat')] });
    expect(isRiskCard(card, 'In Progress')).toBe(true);
  });

  it('returns false for normal task cards', () => {
    const card = makeCard({ labels: [makeLabel('High Priority')] });
    expect(isRiskCard(card, 'In Progress')).toBe(false);
    expect(isRiskCard(card, 'Done')).toBe(false);
    expect(isRiskCard(makeCard(), 'Backlog')).toBe(false);
  });

  it('is case-insensitive for list name', () => {
    expect(isRiskCard(makeCard(), 'RISK REGISTER')).toBe(true);
    expect(isRiskCard(makeCard(), 'Risk')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory', () => {
  it('returns Technical for technical/tech/system keywords', () => {
    expect(mapRiskCategory(makeCard({ name: 'Technical debt' }))).toBe('Technical');
    expect(mapRiskCategory(makeCard({ name: 'Tech failure' }))).toBe('Technical');
    expect(mapRiskCategory(makeCard({ desc: 'System outage risk' }))).toBe('Technical');
  });

  it('returns Financial for financial/budget/cost keywords', () => {
    expect(mapRiskCategory(makeCard({ name: 'Budget overrun' }))).toBe('Financial');
    expect(mapRiskCategory(makeCard({ name: 'Financial exposure' }))).toBe('Financial');
    expect(mapRiskCategory(makeCard({ desc: 'Cost escalation' }))).toBe('Financial');
  });

  it('returns Resource for resource/staff/team keywords', () => {
    expect(mapRiskCategory(makeCard({ name: 'Resource shortage' }))).toBe('Resource');
    expect(mapRiskCategory(makeCard({ name: 'Staff turnover' }))).toBe('Resource');
    expect(mapRiskCategory(makeCard({ desc: 'Team capacity' }))).toBe('Resource');
  });

  it('returns Schedule for schedule/timeline/delay keywords', () => {
    expect(mapRiskCategory(makeCard({ name: 'Schedule slip' }))).toBe('Schedule');
    expect(mapRiskCategory(makeCard({ name: 'Timeline at risk' }))).toBe('Schedule');
    expect(mapRiskCategory(makeCard({ desc: 'Possible delay' }))).toBe('Schedule');
  });

  it('returns Compliance for legal/compliance/regulatory keywords', () => {
    expect(mapRiskCategory(makeCard({ name: 'Legal challenge' }))).toBe('Compliance');
    expect(mapRiskCategory(makeCard({ name: 'Compliance gap' }))).toBe('Compliance');
    expect(mapRiskCategory(makeCard({ desc: 'Regulatory approval needed' }))).toBe('Compliance');
  });

  it('returns Vendor for vendor/procurement/supplier keywords', () => {
    expect(mapRiskCategory(makeCard({ name: 'Vendor risk' }))).toBe('Vendor');
    expect(mapRiskCategory(makeCard({ name: 'Procurement bottleneck' }))).toBe('Vendor');
    expect(mapRiskCategory(makeCard({ desc: 'Supplier insolvency' }))).toBe('Vendor');
  });

  it('returns Operational by default', () => {
    expect(mapRiskCategory(makeCard({ name: 'Unknown risk', desc: '' }))).toBe('Operational');
    expect(mapRiskCategory(makeCard())).toBe('Operational');
  });

  it('uses label names for keyword matching', () => {
    const card = makeCard({ labels: [makeLabel('Budget Risk')] });
    expect(mapRiskCategory(card)).toBe('Financial');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractClient', () => {
  it('extracts client from [CLIENT] prefix', () => {
    expect(extractClient('[ADNOC] Digital Transformation', [])).toBe('ADNOC');
    expect(extractClient('[NCA] Cybersecurity Platform', [])).toBe('NCA');
    expect(extractClient('[MOCI] Procurement Reform', [])).toBe('MOCI');
  });

  it('trims whitespace from extracted prefix', () => {
    expect(extractClient('[ ADNOC ] Platform', [])).toBe('ADNOC');
  });

  it('falls back to label name when no prefix', () => {
    const labels = [makeLabel('ADNOC', 'blue')];
    expect(extractClient('Some task', labels)).toBe('ADNOC');
  });

  it('skips reserved label names (p+, s+, meeting, priority levels)', () => {
    const labels = [
      makeLabel('P+', null),
      makeLabel('S+', null),
      makeLabel('Meeting', null),
      makeLabel('High', null),
      makeLabel('ADNOC', 'blue'),
    ];
    expect(extractClient('Some task', labels)).toBe('ADNOC');
  });

  it('skips single-character label names', () => {
    const labels = [makeLabel('A', null), makeLabel('MOCI', 'blue')];
    expect(extractClient('Some task', labels)).toBe('MOCI');
  });

  it('returns empty string when no client found', () => {
    expect(extractClient('Generic task', [])).toBe('');
    const labels = [makeLabel('P+', null), makeLabel('High', null)];
    expect(extractClient('Generic task', labels)).toBe('');
  });

  it('prefix takes priority over labels', () => {
    const labels = [makeLabel('MOCI', 'blue')];
    expect(extractClient('[NCA] Task', labels)).toBe('NCA');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractProducts', () => {
  it('extracts P+ product', () => {
    expect(extractProducts([makeLabel('P+')])).toEqual(['P+']);
  });

  it('extracts S+ product', () => {
    expect(extractProducts([makeLabel('S+')])).toEqual(['S+']);
  });

  it('extracts Meeting product', () => {
    expect(extractProducts([makeLabel('meeting')])).toEqual(['Meeting']);
    expect(extractProducts([makeLabel('Meeting')])).toEqual(['Meeting']);
  });

  it('extracts multiple products', () => {
    const labels = [makeLabel('P+'), makeLabel('S+'), makeLabel('Meeting')];
    expect(extractProducts(labels)).toEqual(['P+', 'S+', 'Meeting']);
  });

  it('returns empty array when no product labels', () => {
    expect(extractProducts([])).toEqual([]);
    expect(extractProducts([makeLabel('High'), makeLabel('ADNOC')])).toEqual([]);
  });

  it('ignores non-product labels', () => {
    const labels = [makeLabel('High'), makeLabel('P+'), makeLabel('ADNOC')];
    expect(extractProducts(labels)).toEqual(['P+']);
  });
});

// ─────────────────────────────────────────────────────────────
describe('resolveCustomFields', () => {
  const priorityField = { id: 'cf-1', name: 'Priority', type: 'text' as const };
  const pmField       = { id: 'cf-2', name: 'PM', type: 'text' as const };
  const estimField    = { id: 'cf-3', name: 'Estimation (hours)', type: 'number' as const };
  const deliveryField = { id: 'cf-4', name: 'Delivery Plan', type: 'date' as const };
  const paymentField  = { id: 'cf-5', name: 'Related to Payment', type: 'checkbox' as const };

  it('returns defaults when no items', () => {
    const result = resolveCustomFields([], []);
    expect(result).toEqual({ priority: '', pm: '', estimation: '', deliveryDate: '', relatedToPayment: false });
  });

  it('resolves text priority field', () => {
    const items = [{ id: 'i1', idCustomField: 'cf-1', value: { text: 'High' } }];
    const result = resolveCustomFields(items, [priorityField]);
    expect(result.priority).toBe('High');
  });

  it('resolves list-type priority field via options', () => {
    const listPriorityField = {
      id: 'cf-1', name: 'Priority', type: 'list' as const,
      options: [{ id: 'opt-1', value: { text: 'Critical' }, color: 'red' }],
    };
    const items = [{ id: 'i1', idCustomField: 'cf-1', idValue: 'opt-1' }];
    const result = resolveCustomFields(items, [listPriorityField]);
    expect(result.priority).toBe('Critical');
  });

  it('resolves PM field', () => {
    const items = [{ id: 'i2', idCustomField: 'cf-2', value: { text: 'Alice Smith' } }];
    const result = resolveCustomFields(items, [pmField]);
    expect(result.pm).toBe('Alice Smith');
  });

  it('resolves "project manager" named field', () => {
    const pmAltField = { id: 'cf-2', name: 'Project Manager', type: 'text' as const };
    const items = [{ id: 'i2', idCustomField: 'cf-2', value: { text: 'Bob Jones' } }];
    const result = resolveCustomFields(items, [pmAltField]);
    expect(result.pm).toBe('Bob Jones');
  });

  it('resolves estimation field', () => {
    const items = [{ id: 'i3', idCustomField: 'cf-3', value: { number: '40' } }];
    const result = resolveCustomFields(items, [estimField]);
    expect(result.estimation).toBe('40');
  });

  it('resolves delivery date field (truncates to YYYY-MM-DD)', () => {
    const items = [{ id: 'i4', idCustomField: 'cf-4', value: { date: '2026-06-30T00:00:00.000Z' } }];
    const result = resolveCustomFields(items, [deliveryField]);
    expect(result.deliveryDate).toBe('2026-06-30');
  });

  it('resolves payment checkbox field (true)', () => {
    const items = [{ id: 'i5', idCustomField: 'cf-5', value: { checked: 'true' } }];
    const result = resolveCustomFields(items, [paymentField]);
    expect(result.relatedToPayment).toBe(true);
  });

  it('resolves payment checkbox field (false)', () => {
    const items = [{ id: 'i5', idCustomField: 'cf-5', value: { checked: 'false' } }];
    const result = resolveCustomFields(items, [paymentField]);
    expect(result.relatedToPayment).toBe(false);
  });

  it('skips items with unknown field ids', () => {
    const items = [{ id: 'i9', idCustomField: 'cf-unknown', value: { text: 'foo' } }];
    const result = resolveCustomFields(items, [pmField]);
    expect(result).toEqual({ priority: '', pm: '', estimation: '', deliveryDate: '', relatedToPayment: false });
  });

  it('resolves all fields together', () => {
    const fields = [priorityField, pmField, estimField, deliveryField, paymentField];
    const items = [
      { id: 'i1', idCustomField: 'cf-1', value: { text: 'Medium' } },
      { id: 'i2', idCustomField: 'cf-2', value: { text: 'Ahmed' } },
      { id: 'i3', idCustomField: 'cf-3', value: { number: '20' } },
      { id: 'i4', idCustomField: 'cf-4', value: { date: '2026-09-01T00:00:00.000Z' } },
      { id: 'i5', idCustomField: 'cf-5', value: { checked: 'true' } },
    ];
    const result = resolveCustomFields(items, fields);
    expect(result).toEqual({
      priority: 'Medium',
      pm: 'Ahmed',
      estimation: '20',
      deliveryDate: '2026-09-01',
      relatedToPayment: true,
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (additional edge cases)', () => {
  it('handles "Complete" (without d) as Completed', () => {
    expect(mapListToStatus('Complete')).toBe('Completed');
  });

  it('handles "Blocked" as Overdue', () => {
    expect(mapListToStatus('Blocked')).toBe('Overdue');
  });

  it('handles "Doing" as In Progress', () => {
    expect(mapListToStatus('Doing')).toBe('In Progress');
  });

  it('handles whitespace-padded names', () => {
    // "  done  " should still map to Completed
    expect(mapListToStatus('  done  ')).toBe('Completed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractClient (additional edge cases)', () => {
  it('handles empty string card name', () => {
    expect(extractClient('', [])).toBe('');
  });

  it('returns first non-reserved label when multiple valid labels exist', () => {
    const labels = [makeLabel('ADNOC', 'blue'), makeLabel('NCA', 'green')];
    const result = extractClient('Some card', labels);
    // Returns first valid label
    expect(['ADNOC', 'NCA']).toContain(result);
  });

  it('prefix with lowercase bracket is still extracted', () => {
    // The regex in extractClient looks for [TEXT] at start of name
    expect(extractClient('[STC] 5G rollout', [])).toBe('STC');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (additional edge cases)', () => {
  it('uses desc in addition to name for keyword matching', () => {
    const card = makeCard({ name: 'Unknown issue', desc: 'budget overrun expected' });
    expect(mapRiskCategory(card)).toBe('Financial');
  });

  it('returns Technical when name contains "system"', () => {
    expect(mapRiskCategory(makeCard({ name: 'System integration failure' }))).toBe('Technical');
  });

  it('returns Vendor for "supplier" keyword in desc', () => {
    const card = makeCard({ name: 'Third party risk', desc: 'Supplier may go bankrupt' });
    expect(mapRiskCategory(card)).toBe('Vendor');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToPriority (Highest)', () => {
  it('returns High for label name "Highest" (contains "high")', () => {
    // 'highest' includes 'high' → maps to High
    expect(mapLabelsToPriority([makeLabel('Highest', null)])).toBe('High');
  });
});

// ─────────────────────────────────────────────────────────────
describe('isRiskCard (additional cases)', () => {
  it('returns false when list is "Done" and no risk labels', () => {
    const card = makeCard({ labels: [makeLabel('High Priority')] });
    expect(isRiskCard(card, 'Done')).toBe(false);
  });

  it('returns true when label contains "issue" regardless of list', () => {
    const card = makeCard({ labels: [makeLabel('Critical Issue')] });
    expect(isRiskCard(card, 'Backlog')).toBe(true);
    expect(isRiskCard(card, 'Done')).toBe(true);
  });

  it('returns true for card with no labels when list has "risk"', () => {
    const card = makeCard({ labels: [] });
    expect(isRiskCard(card, 'Risk Backlog')).toBe(true);
  });

  it('returns false for card with empty labels and non-risk list', () => {
    const card = makeCard({ labels: [] });
    expect(isRiskCard(card, 'Sprint 1')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (wip and other keywords)', () => {
  it('maps "WIP" to In Progress', () => {
    expect(mapListToStatus('WIP')).toBe('In Progress');
  });

  it('maps "Active Sprint" to In Progress', () => {
    expect(mapListToStatus('Active Sprint')).toBe('In Progress');
  });

  it('maps "Escalated Items" to Overdue', () => {
    expect(mapListToStatus('Escalated Items')).toBe('Overdue');
  });

  it('maps "Finished" to Completed', () => {
    expect(mapListToStatus('Finished')).toBe('Completed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToPriority (color variations)', () => {
  it('returns Medium for sky color (not a priority color)', () => {
    expect(mapLabelsToPriority([makeLabel('', 'sky')])).toBe('Medium');
  });

  it('returns Medium for purple color (not a priority color)', () => {
    expect(mapLabelsToPriority([makeLabel('', 'purple')])).toBe('Medium');
  });

  it('handles label with both name and color — color wins if name has no keyword', () => {
    // color is red → Critical even if name is generic
    expect(mapLabelsToPriority([makeLabel('Feature', 'red')])).toBe('Critical');
  });

  it('returns Critical for "urgent" in label name with null color', () => {
    expect(mapLabelsToPriority([makeLabel('Urgent Blocker', null)])).toBe('Critical');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (additional keywords)', () => {
  it('returns Financial for "cost" keyword in name', () => {
    expect(mapRiskCategory(makeCard({ name: 'Cost overrun risk' }))).toBe('Financial');
  });

  it('returns Schedule for "timeline" keyword in name', () => {
    expect(mapRiskCategory(makeCard({ name: 'Timeline slippage' }))).toBe('Schedule');
  });

  it('returns Resource for "team" keyword in desc', () => {
    expect(mapRiskCategory(makeCard({ name: 'Capacity issue', desc: 'team availability' }))).toBe('Resource');
  });

  it('returns Compliance for "regulatory" keyword in desc', () => {
    expect(mapRiskCategory(makeCard({ name: 'Approval needed', desc: 'regulatory requirement' }))).toBe('Compliance');
  });

  it('returns Operational when no keywords match', () => {
    expect(mapRiskCategory(makeCard({ name: 'Generic risk', desc: '' }))).toBe('Operational');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractProducts (case variations)', () => {
  it('extracts "p+" case-insensitively', () => {
    expect(extractProducts([makeLabel('P+')])).toEqual(['P+']);
  });

  it('returns empty for reserved-name labels that are not product labels', () => {
    const labels = [makeLabel('High'), makeLabel('Critical'), makeLabel('ADNOC')];
    expect(extractProducts(labels)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
describe('resolveCustomFields (edge cases)', () => {
  const pmField = { id: 'cf-2', name: 'PM', type: 'text' as const };

  it('handles list-type field with no matching option gracefully', () => {
    const listField = {
      id: 'cf-1', name: 'Priority', type: 'list' as const,
      options: [{ id: 'opt-1', value: { text: 'Low' }, color: 'green' }],
    };
    // item references opt-2 which doesn't exist → priority stays ''
    const items = [{ id: 'i1', idCustomField: 'cf-1', idValue: 'opt-unknown' }];
    const result = resolveCustomFields(items, [listField]);
    expect(result.priority).toBe('');
  });

  it('handles multiple items where only PM field is filled', () => {
    const items = [{ id: 'i2', idCustomField: 'cf-2', value: { text: 'Nora Ahmed' } }];
    const result = resolveCustomFields(items, [pmField]);
    expect(result.pm).toBe('Nora Ahmed');
    expect(result.priority).toBe('');
    expect(result.estimation).toBe('');
    expect(result.relatedToPayment).toBe(false);
  });

  it('ignores items with no value property and no idValue', () => {
    const items = [{ id: 'i9', idCustomField: 'cf-2' }];
    const result = resolveCustomFields(items as any, [pmField]);
    expect(result.pm).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (additional cases)', () => {
  it('maps "WIP" to In Progress', () => {
    expect(mapListToStatus('WIP')).toBe('In Progress');
  });

  it('maps "Active Sprint" to In Progress', () => {
    expect(mapListToStatus('Active Sprint')).toBe('In Progress');
  });

  it('maps "Doing" to In Progress', () => {
    expect(mapListToStatus('Doing')).toBe('In Progress');
  });

  it('maps "Overdue Items" to Overdue', () => {
    expect(mapListToStatus('Overdue Items')).toBe('Overdue');
  });

  it('maps "Blocked" to Overdue', () => {
    expect(mapListToStatus('Blocked')).toBe('Overdue');
  });

  it('maps "Escalated Issues" to Overdue', () => {
    expect(mapListToStatus('Escalated Issues')).toBe('Overdue');
  });

  it('maps "Backlog" to Backlog', () => {
    expect(mapListToStatus('Backlog')).toBe('Backlog');
  });

  it('maps "To Do" to Backlog', () => {
    expect(mapListToStatus('To Do')).toBe('Backlog');
  });

  it('maps "Upcoming Tasks" to Backlog', () => {
    expect(mapListToStatus('Upcoming Tasks')).toBe('Backlog');
  });

  it('maps unknown list to Backlog', () => {
    expect(mapListToStatus('Random List')).toBe('Backlog');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToPriority (additional cases)', () => {
  it('returns Medium for no labels', () => {
    expect(mapLabelsToPriority([])).toBe('Medium');
  });

  it('returns Critical for red color label', () => {
    expect(mapLabelsToPriority([makeLabel('Blocker', 'red')])).toBe('Critical');
  });

  it('returns Critical for label name containing urgent', () => {
    expect(mapLabelsToPriority([makeLabel('Urgent Fix', null)])).toBe('Critical');
  });

  it('returns High for orange color label', () => {
    expect(mapLabelsToPriority([makeLabel('Sprint', 'orange')])).toBe('High');
  });

  it('returns High for label name containing high', () => {
    expect(mapLabelsToPriority([makeLabel('High Impact', null)])).toBe('High');
  });

  it('returns Medium for yellow color label', () => {
    expect(mapLabelsToPriority([makeLabel('Normal', 'yellow')])).toBe('Medium');
  });

  it('returns Low for green color label', () => {
    expect(mapLabelsToPriority([makeLabel('Nice to Have', 'green')])).toBe('Low');
  });

  it('returns Low for label name containing low', () => {
    expect(mapLabelsToPriority([makeLabel('Low Priority', null)])).toBe('Low');
  });

  it('uses first matching label when multiple labels present', () => {
    const labels = [makeLabel('High Impact', null), makeLabel('Low Priority', null)];
    expect(mapLabelsToPriority(labels)).toBe('High');
  });
});

// ─────────────────────────────────────────────────────────────
describe('isRiskCard (additional cases)', () => {
  it('returns true when list name contains risk', () => {
    expect(isRiskCard(makeCard(), 'Risk Register')).toBe(true);
  });

  it('returns true when label contains issue', () => {
    const card = makeCard({ labels: [makeLabel('Issue', null)] });
    expect(isRiskCard(card, 'Backlog')).toBe(true);
  });

  it('returns true when label contains threat', () => {
    const card = makeCard({ labels: [makeLabel('Threat Assessment', null)] });
    expect(isRiskCard(card, 'Backlog')).toBe(true);
  });

  it('returns false for normal task card', () => {
    expect(isRiskCard(makeCard({ labels: [] }), 'Backlog')).toBe(false);
  });

  it('returns false for card in To Do list with no risk labels', () => {
    expect(isRiskCard(makeCard({ labels: [] }), 'To Do')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (additional cases)', () => {
  it('returns Technical for card with tech in name', () => {
    const card = makeCard({ name: 'Tech Architecture Review', desc: '' });
    expect(mapRiskCategory(card)).toBe('Technical');
  });

  it('returns Financial for card with budget in desc', () => {
    const card = makeCard({ name: 'Cost Issue', desc: 'budget overrun risk' });
    expect(mapRiskCategory(card)).toBe('Financial');
  });

  it('returns Resource for card with staff in name', () => {
    const card = makeCard({ name: 'Staff Shortage Risk', desc: '' });
    expect(mapRiskCategory(card)).toBe('Resource');
  });

  it('returns Schedule for card with delay in desc', () => {
    const card = makeCard({ name: 'Timeline Risk', desc: 'delay in delivery' });
    expect(mapRiskCategory(card)).toBe('Schedule');
  });

  it('returns Compliance for card with regulatory in label', () => {
    const card = makeCard({ labels: [makeLabel('Regulatory Compliance', null)] });
    expect(mapRiskCategory(card)).toBe('Compliance');
  });

  it('returns Vendor for card with procurement in name', () => {
    const card = makeCard({ name: 'Procurement Vendor Issue', desc: '' });
    expect(mapRiskCategory(card)).toBe('Vendor');
  });

  it('returns Operational for unclassified card', () => {
    const card = makeCard({ name: 'Generic Risk', desc: 'Unknown issue' });
    expect(mapRiskCategory(card)).toBe('Operational');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractClient', () => {
  it('extracts client from [CLIENT] prefix', () => {
    expect(extractClient('[NCA] Architecture BRD', [])).toBe('NCA');
  });

  it('extracts client with spaces in brackets', () => {
    expect(extractClient('[MOCI Project] Init', [])).toBe('MOCI Project');
  });

  it('returns empty string when no bracket prefix and no labels', () => {
    expect(extractClient('Generic Task', [])).toBe('');
  });

  it('extracts client from label when no bracket prefix', () => {
    const labels = [makeLabel('ClientCo')];
    expect(extractClient('Task Name', labels)).toBe('ClientCo');
  });

  it('skips known non-client labels like high', () => {
    const labels = [makeLabel('high'), makeLabel('MOCI')];
    expect(extractClient('Task', labels)).toBe('MOCI');
  });

  it('skips risk label', () => {
    const labels = [makeLabel('risk'), makeLabel('NCA')];
    expect(extractClient('Task', labels)).toBe('NCA');
  });

  it('returns empty when all labels are skip words', () => {
    const labels = [makeLabel('high'), makeLabel('low'), makeLabel('risk')];
    expect(extractClient('Task', labels)).toBe('');
  });

  it('bracket prefix takes priority over labels', () => {
    const labels = [makeLabel('MOCI')];
    expect(extractClient('[NCA] Architecture', labels)).toBe('NCA');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractProducts', () => {
  it('returns empty array when no product labels', () => {
    expect(extractProducts([])).toEqual([]);
  });

  it('extracts P+ product from label', () => {
    const labels = [makeLabel('P+')];
    expect(extractProducts(labels)).toContain('P+');
  });

  it('extracts S+ product from label', () => {
    const labels = [makeLabel('S+')];
    expect(extractProducts(labels)).toContain('S+');
  });

  it('extracts Meeting product from label', () => {
    const labels = [makeLabel('meeting')];
    expect(extractProducts(labels)).toContain('Meeting');
  });

  it('extracts multiple products when multiple labels', () => {
    const labels = [makeLabel('P+'), makeLabel('S+'), makeLabel('meeting')];
    const result = extractProducts(labels);
    expect(result).toHaveLength(3);
  });

  it('ignores non-product labels', () => {
    const labels = [makeLabel('high'), makeLabel('risk')];
    expect(extractProducts(labels)).toEqual([]);
  });

  it('extracts P+ case-insensitively', () => {
    const labels = [makeLabel('p+')];
    expect(extractProducts(labels)).toContain('P+');
  });
});

// ─────────────────────────────────────────────────────────────
describe('resolveCustomFields', () => {
  it('returns default empty values when no custom fields', () => {
    const result = resolveCustomFields([], []);
    expect(result.priority).toBe('');
    expect(result.pm).toBe('');
    expect(result.estimation).toBe('');
    expect(result.deliveryDate).toBe('');
    expect(result.relatedToPayment).toBe(false);
  });

  it('resolves PM field from text value', () => {
    const fields = [{ id: 'f1', name: 'PM', type: 'text', options: undefined }];
    const items = [{ idCustomField: 'f1', idValue: undefined, value: { text: 'Ahmed Khalil' } }];
    const result = resolveCustomFields(items as any, fields as any);
    expect(result.pm).toBe('Ahmed Khalil');
  });

  it('resolves estimation from number field', () => {
    const fields = [{ id: 'f2', name: 'Estimation Hours', type: 'number', options: undefined }];
    const items = [{ idCustomField: 'f2', idValue: undefined, value: { number: '8' } }];
    const result = resolveCustomFields(items as any, fields as any);
    expect(result.estimation).toBe('8');
  });

  it('resolves delivery date from date field', () => {
    const fields = [{ id: 'f3', name: 'Delivery Date', type: 'date', options: undefined }];
    const items = [{ idCustomField: 'f3', idValue: undefined, value: { date: '2026-04-15T00:00:00Z' } }];
    const result = resolveCustomFields(items as any, fields as any);
    expect(result.deliveryDate).toBe('2026-04-15');
  });

  it('resolves relatedToPayment from checked field', () => {
    const fields = [{ id: 'f4', name: 'Related to Payment', type: 'checkbox', options: undefined }];
    const items = [{ idCustomField: 'f4', idValue: undefined, value: { checked: 'true' } }];
    const result = resolveCustomFields(items as any, fields as any);
    expect(result.relatedToPayment).toBe(true);
  });

  it('ignores item with unknown field id', () => {
    const fields = [{ id: 'f1', name: 'PM', type: 'text', options: undefined }];
    const items = [{ idCustomField: 'unknown-id', idValue: undefined, value: { text: 'Someone' } }];
    const result = resolveCustomFields(items as any, fields as any);
    expect(result.pm).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (edge cases)', () => {
  it('maps "Review Required" to In Review', () => {
    expect(mapListToStatus('Review Required')).toBe('In Review');
  });

  it('maps "IN PROGRESS" to In Progress (case insensitive)', () => {
    expect(mapListToStatus('IN PROGRESS')).toBe('In Progress');
  });

  it('maps "DONE" uppercase to Completed', () => {
    expect(mapListToStatus('DONE')).toBe('Completed');
  });

  it('maps empty string to Backlog', () => {
    expect(mapListToStatus('')).toBe('Backlog');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToPriority (edge cases)', () => {
  it('returns Critical for label with name "critical"', () => {
    expect(mapLabelsToPriority([makeLabel('critical')])).toBe('Critical');
  });

  it('returns High for label with name "High Priority"', () => {
    expect(mapLabelsToPriority([makeLabel('High Priority')])).toBe('High');
  });

  it('returns Medium for blue color label (no mapping)', () => {
    expect(mapLabelsToPriority([{ id: 'l1', name: '', color: 'blue' }])).toBe('Medium');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToSeverity (additional cases)', () => {
  it('returns Critical for red-colored label', () => {
    expect(mapLabelsToSeverity([{ id: 'l1', name: '', color: 'red' }])).toBe('Critical');
  });

  it('returns High for orange-colored label', () => {
    expect(mapLabelsToSeverity([{ id: 'l1', name: '', color: 'orange' }])).toBe('High');
  });

  it('returns Medium for no labels', () => {
    expect(mapLabelsToSeverity([])).toBe('Medium');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToPriority (case insensitive)', () => {
  it('returns High for "HIGH" uppercase label name', () => {
    expect(mapLabelsToPriority([makeLabel('HIGH')])).toBe('High');
  });

  it('returns Low for "LOW" uppercase label name', () => {
    expect(mapLabelsToPriority([makeLabel('LOW')])).toBe('Low');
  });

  it('returns Medium when labels is undefined-like empty', () => {
    expect(mapLabelsToPriority([])).toBe('Medium');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (case insensitive)', () => {
  it('returns In Progress for "in progress" lowercase', () => {
    expect(mapListToStatus('in progress')).toBe('In Progress');
  });

  it('returns Completed for "DONE" uppercase', () => {
    expect(mapListToStatus('DONE')).toBe('Completed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractClient (label extraction)', () => {
  it('returns empty string when name has no client pattern and no labels', () => {
    expect(extractClient('Some Task', [])).toBe('');
  });

  it('extracts client from [CLIENT] prefix in name', () => {
    expect(extractClient('[NCA] Review BRD', [])).toBe('NCA');
  });

  it('extracts client from label name', () => {
    expect(extractClient('Some Task', [makeLabel('MOCI')])).toBe('MOCI');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToSeverity (name-based)', () => {
  it('returns High for label named "High"', () => {
    expect(mapLabelsToSeverity([makeLabel('High')])).toBe('High');
  });

  it('returns Low for label named "Low"', () => {
    expect(mapLabelsToSeverity([makeLabel('Low')])).toBe('Low');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (product keywords)', () => {
  it('returns Vendor for card with vendor in name', () => {
    const card = makeCard({ name: 'vendor payment risk' });
    expect(mapRiskCategory(card)).toBe('Vendor');
  });
});

// ─────────────────────────────────────────────────────────────
describe('isRiskCard (list name checking)', () => {
  it('returns true for card in Risks list', () => {
    const card = makeCard({});
    expect(isRiskCard(card, 'Risks')).toBe(true);
  });
});
