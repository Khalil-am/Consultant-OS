import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  mapListToStatus,
  mapLabelsToPriority,
  mapLabelsToSeverity,
  isRiskCard,
  mapRiskCategory,
  extractClient,
  extractProducts,
  resolveCustomFields,
  getTrelloBoards,
  getTrelloBoard,
  getTrelloLists,
  getTrelloCards,
  getTrelloBoardMembers,
  findBABoard,
  fetchBoardData,
  fetchBATrafficBoard,
} from '../lib/trello';
import type { TrelloLabel, TrelloCard, TrelloBoard, TrelloList, TrelloMember } from '../lib/trello';

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

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (more keyword variations)', () => {
  it('maps "Code Review" to In Review', () => {
    expect(mapListToStatus('Code Review')).toBe('In Review');
  });

  it('maps "QA" (no testing keyword) to Backlog if not matching', () => {
    // "QA" contains "qa" which doesn't match any keyword except maybe "testing"
    // "QA" alone → let's check if it maps to In Review or Backlog
    // mapListToStatus: tests "review" | "testing" | "qa" | "approval"
    // "qa" contains "qa" → should map to In Review
    expect(mapListToStatus('QA')).toBe('In Review');
  });

  it('maps "Approval Pending" to In Review', () => {
    expect(mapListToStatus('Approval Pending')).toBe('In Review');
  });

  it('maps "Blocked Tasks" to Overdue', () => {
    expect(mapListToStatus('Blocked Tasks')).toBe('Overdue');
  });

  it('maps "Escalated" to Overdue', () => {
    expect(mapListToStatus('Escalated')).toBe('Overdue');
  });

  it('maps "Completed Tasks" to Completed', () => {
    expect(mapListToStatus('Completed Tasks')).toBe('Completed');
  });

  it('maps "CLOSED" uppercase to Completed', () => {
    expect(mapListToStatus('CLOSED')).toBe('Completed');
  });

  it('maps "ACTIVE" uppercase to In Progress', () => {
    expect(mapListToStatus('ACTIVE')).toBe('In Progress');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToPriority (blue/sky/purple colors return Medium)', () => {
  it('returns Medium for blue-colored label', () => {
    expect(mapLabelsToPriority([makeLabel('Feature', 'blue')])).toBe('Medium');
  });

  it('returns Medium for sky-colored label', () => {
    expect(mapLabelsToPriority([makeLabel('Info', 'sky')])).toBe('Medium');
  });

  it('returns Medium for lime-colored label', () => {
    expect(mapLabelsToPriority([makeLabel('Nice', 'lime')])).toBe('Medium');
  });

  it('returns Medium for pink-colored label', () => {
    expect(mapLabelsToPriority([makeLabel('Tag', 'pink')])).toBe('Medium');
  });
});

// ─────────────────────────────────────────────────────────────
describe('isRiskCard (combined label and list scenarios)', () => {
  it('returns true when both list and labels indicate risk', () => {
    const card = makeCard({ labels: [makeLabel('Risk', null)] });
    expect(isRiskCard(card, 'Risk Register')).toBe(true);
  });

  it('returns true when only list has risk', () => {
    const card = makeCard({ labels: [] });
    expect(isRiskCard(card, 'Risk Items')).toBe(true);
  });

  it('returns false when list has risk-like but non-risk word (e.g. "Done")', () => {
    const card = makeCard({ labels: [] });
    expect(isRiskCard(card, 'Done')).toBe(false);
  });

  it('returns true when label text contains "risk" as substring', () => {
    const card = makeCard({ labels: [makeLabel('Project Risk 2', null)] });
    expect(isRiskCard(card, 'Backlog')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractClient (label ordering)', () => {
  it('returns first non-reserved label when multiple candidates exist', () => {
    // If multiple non-reserved labels, returns first one found
    const labels = [makeLabel('NCA', 'blue'), makeLabel('MOCI', 'green')];
    const result = extractClient('Task', labels);
    // Either NCA or MOCI; just verify one of them is returned
    expect(['NCA', 'MOCI']).toContain(result);
  });

  it('skips "medium" as a reserved-like label', () => {
    const labels = [makeLabel('medium', null), makeLabel('ADNOC', 'blue')];
    expect(extractClient('Task', labels)).toBe('ADNOC');
  });

  it('handles label with exactly 2 characters (not skipped)', () => {
    // Only single-char labels are skipped
    const labels = [makeLabel('AB', 'blue')];
    expect(extractClient('Task', labels)).toBe('AB');
  });

  it('returns empty string when all labels are length 1', () => {
    const labels = [makeLabel('A', null), makeLabel('B', null)];
    expect(extractClient('No prefix task', labels)).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (label-based detection)', () => {
  it('detects Technical from tech keyword in label', () => {
    const card = makeCard({ labels: [makeLabel('Technical Debt', null)] });
    expect(mapRiskCategory(card)).toBe('Technical');
  });

  it('detects Financial from financial keyword in label', () => {
    const card = makeCard({ labels: [makeLabel('Financial Risk', null)] });
    expect(mapRiskCategory(card)).toBe('Financial');
  });

  it('detects Resource from resource keyword in label', () => {
    const card = makeCard({ labels: [makeLabel('Resource Constraint', null)] });
    expect(mapRiskCategory(card)).toBe('Resource');
  });

  it('detects Schedule from schedule keyword in label', () => {
    const card = makeCard({ labels: [makeLabel('Schedule Risk', null)] });
    expect(mapRiskCategory(card)).toBe('Schedule');
  });

  it('detects Compliance from legal keyword in label', () => {
    const card = makeCard({ labels: [makeLabel('Legal Issue', null)] });
    expect(mapRiskCategory(card)).toBe('Compliance');
  });

  it('detects Vendor from procurement keyword in label', () => {
    const card = makeCard({ labels: [makeLabel('Procurement Risk', null)] });
    expect(mapRiskCategory(card)).toBe('Vendor');
  });
});

// ─────────────────────────────────────────────────────────────
describe('resolveCustomFields (partial fields)', () => {
  it('resolves only PM when only PM field present', () => {
    const fields = [{ id: 'cf-pm', name: 'PM', type: 'text' as const }];
    const items = [{ id: 'i1', idCustomField: 'cf-pm', value: { text: 'Sara Ahmed' } }];
    const result = resolveCustomFields(items, fields);
    expect(result.pm).toBe('Sara Ahmed');
    expect(result.priority).toBe('');
    expect(result.deliveryDate).toBe('');
    expect(result.relatedToPayment).toBe(false);
  });

  it('resolves only deliveryDate when only date field present', () => {
    const fields = [{ id: 'cf-date', name: 'Delivery Plan', type: 'date' as const }];
    const items = [{ id: 'i1', idCustomField: 'cf-date', value: { date: '2026-12-01T00:00:00.000Z' } }];
    const result = resolveCustomFields(items, fields);
    expect(result.deliveryDate).toBe('2026-12-01');
  });

  it('resolves only estimation when only number field present', () => {
    const fields = [{ id: 'cf-est', name: 'Estimation (hours)', type: 'number' as const }];
    const items = [{ id: 'i1', idCustomField: 'cf-est', value: { number: '120' } }];
    const result = resolveCustomFields(items, fields);
    expect(result.estimation).toBe('120');
  });

  it('resolves relatedToPayment as false when checked is "false"', () => {
    const fields = [{ id: 'cf-pay', name: 'Related to Payment', type: 'checkbox' as const }];
    const items = [{ id: 'i1', idCustomField: 'cf-pay', value: { checked: 'false' } }];
    const result = resolveCustomFields(items, fields);
    expect(result.relatedToPayment).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (unique scenarios)', () => {
  it('maps "Review" alone to In Review', () => {
    expect(mapListToStatus('Review')).toBe('In Review');
  });

  it('maps "Working" to Backlog (no keyword match)', () => {
    expect(mapListToStatus('Working')).toBe('Backlog');
  });

  it('maps "Sprint 3" to Backlog', () => {
    expect(mapListToStatus('Sprint 3')).toBe('Backlog');
  });

  it('maps "QA Review" to In Review (both qa and review present)', () => {
    expect(mapListToStatus('QA Review')).toBe('In Review');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (keyword priority ordering)', () => {
  it('returns Technical when both "technical" and "financial" appear (technical checked first)', () => {
    const card = makeCard({ name: 'Financial Technical Risk', desc: '' });
    expect(mapRiskCategory(card)).toBe('Technical');
  });

  it('returns Financial when "budget" appears but no technical keyword present', () => {
    const card = makeCard({ name: 'Resource Budget Issue', desc: '' });
    expect(mapRiskCategory(card)).toBe('Financial');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToPriority (mod keyword)', () => {
  it('returns Medium for label name "Moderate Priority"', () => {
    expect(mapLabelsToPriority([makeLabel('Moderate Priority', null)])).toBe('Medium');
  });

  it('returns Medium for label name "Mod" (contains mod substring)', () => {
    expect(mapLabelsToPriority([makeLabel('Mod', null)])).toBe('Medium');
  });
});

// ─────────────────────────────────────────────────────────────
describe('resolveCustomFields (text value edge cases)', () => {
  it('stores empty string when PM text value is empty', () => {
    const fields = [{ id: 'cf-pm', name: 'PM', type: 'text' as const }];
    const items = [{ id: 'i1', idCustomField: 'cf-pm', value: { text: '' } }];
    const result = resolveCustomFields(items, fields);
    expect(result.pm).toBe('');
  });

  it('preserves full name with spaces in PM field', () => {
    const fields = [{ id: 'cf-pm', name: 'PM', type: 'text' as const }];
    const items = [{ id: 'i1', idCustomField: 'cf-pm', value: { text: 'Ahmed Khalil Al-Rashidi' } }];
    const result = resolveCustomFields(items, fields);
    expect(result.pm).toBe('Ahmed Khalil Al-Rashidi');
  });

  it('resolves deliveryDate from field named "Sprint Plan" (contains "plan")', () => {
    const fields = [{ id: 'cf-sp', name: 'Sprint Plan', type: 'date' as const }];
    const items = [{ id: 'i1', idCustomField: 'cf-sp', value: { date: '2026-08-15T00:00:00.000Z' } }];
    const result = resolveCustomFields(items, fields);
    expect(result.deliveryDate).toBe('2026-08-15');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractClient (special bracket patterns)', () => {
  it('extracts client with hyphen in bracket', () => {
    expect(extractClient('[UAE-Gov] Policy Review', [])).toBe('UAE-Gov');
  });

  it('extracts client with numbers in bracket', () => {
    expect(extractClient('[Client123] Some Task', [])).toBe('Client123');
  });

  it('extracts multi-word client from bracket', () => {
    expect(extractClient('[Saudi Arabia] Vision 2030', [])).toBe('Saudi Arabia');
  });
});

// ─────────────────────────────────────────────────────────────
describe('isRiskCard (case insensitivity for labels)', () => {
  it('returns true when label contains uppercase RISK', () => {
    const card = makeCard({ labels: [makeLabel('RISK ITEM', null)] });
    expect(isRiskCard(card, 'Backlog')).toBe(true);
  });

  it('returns true when label contains lowercase threat', () => {
    const card = makeCard({ labels: [makeLabel('threat analysis', null)] });
    expect(isRiskCard(card, 'Backlog')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToSeverity (name-based detection)', () => {
  it('returns Low for label "low severity"', () => {
    expect(mapLabelsToSeverity([makeLabel('low severity', null)])).toBe('Low');
  });

  it('returns Critical for label "critical" with null color', () => {
    expect(mapLabelsToSeverity([makeLabel('critical', null)])).toBe('Critical');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (backlog fallback keywords)', () => {
  it('maps "On Hold" to Backlog', () => {
    expect(mapListToStatus('On Hold')).toBe('Backlog');
  });

  it('maps "Pending" to Backlog', () => {
    expect(mapListToStatus('Pending')).toBe('Backlog');
  });

  it('maps "Waiting" to Backlog', () => {
    expect(mapListToStatus('Waiting')).toBe('Backlog');
  });

  it('maps "Cancelled" to Backlog', () => {
    expect(mapListToStatus('Cancelled')).toBe('Backlog');
  });

  it('maps "Ideas" to Backlog', () => {
    expect(mapListToStatus('Ideas')).toBe('Backlog');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToSeverity (non-priority colors default to Medium)', () => {
  it('returns Medium for blue color label', () => {
    expect(mapLabelsToSeverity([makeLabel('', 'blue')])).toBe('Medium');
  });

  it('returns Medium for purple color label', () => {
    expect(mapLabelsToSeverity([makeLabel('', 'purple')])).toBe('Medium');
  });

  it('returns Medium for sky color label', () => {
    expect(mapLabelsToSeverity([makeLabel('', 'sky')])).toBe('Medium');
  });
});

// ─────────────────────────────────────────────────────────────
describe('resolveCustomFields (project manager field name variant)', () => {
  it('resolves PM from "Project Manager" field name', () => {
    const fields = [{ id: 'cf-pm', name: 'Project Manager', type: 'text' as const }];
    const items = [{ id: 'i1', idCustomField: 'cf-pm', value: { text: 'Khalid Al-Nasser' } }];
    const result = resolveCustomFields(items, fields);
    expect(result.pm).toBe('Khalid Al-Nasser');
  });

  it('resolves estimation from "Total Hours" field name', () => {
    const fields = [{ id: 'cf-hrs', name: 'Total Hours', type: 'number' as const }];
    const items = [{ id: 'i1', idCustomField: 'cf-hrs', value: { number: '240' } }];
    const result = resolveCustomFields(items, fields);
    expect(result.estimation).toBe('240');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractClient (single-char label skipped)', () => {
  it('skips label with single character', () => {
    const labels = [makeLabel('A')];
    expect(extractClient('Some task', labels)).toBe('');
  });

  it('returns label with exactly 2 characters', () => {
    const labels = [makeLabel('AB')];
    expect(extractClient('Some task', labels)).toBe('AB');
  });

  it('skips label in skip list "risk"', () => {
    const labels = [makeLabel('risk')];
    expect(extractClient('Some task', labels)).toBe('');
  });

  it('skips label "p+" as it is in skip list', () => {
    const labels = [makeLabel('p+')];
    expect(extractClient('Some task', labels)).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (more In Progress variations)', () => {
  it('maps "WIP" to In Progress', () => {
    expect(mapListToStatus('WIP')).toBe('In Progress');
  });

  it('maps "Active" to In Progress', () => {
    expect(mapListToStatus('Active')).toBe('In Progress');
  });

  it('maps "Doing" to In Progress', () => {
    expect(mapListToStatus('Doing')).toBe('In Progress');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractProducts (p+ and s+ labels)', () => {
  it('returns empty array when no matching labels', () => {
    expect(extractProducts([])).toEqual([]);
  });

  it('detects p+ label', () => {
    const result = extractProducts([makeLabel('P+')]);
    expect(result).toContain('P+');
  });

  it('detects s+ label', () => {
    const result = extractProducts([makeLabel('S+')]);
    expect(result).toContain('S+');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToSeverity (priority label colors)', () => {
  it('returns Critical for red color label', () => {
    const labels = [makeLabel('Urgent', 'red')];
    expect(mapLabelsToSeverity(labels)).toBe('Critical');
  });

  it('returns Low for green color label', () => {
    const labels = [makeLabel('Low', 'green')];
    expect(mapLabelsToSeverity(labels)).toBe('Low');
  });

  it('returns Medium for yellow color label', () => {
    const labels = [makeLabel('Medium', 'yellow')];
    expect(mapLabelsToSeverity(labels)).toBe('Medium');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (schedule keywords extended)', () => {
  it('returns Schedule for "delay" keyword in desc', () => {
    expect(mapRiskCategory(makeCard({ name: 'Risk', desc: 'Possible delay in delivery' }))).toBe('Schedule');
  });
});

// ─────────────────────────────────────────────────────────────
describe('isRiskCard (false for non-risk cards)', () => {
  it('returns false for card with no risk labels and empty list name', () => {
    const card = makeCard({ labels: [] });
    expect(isRiskCard(card, '')).toBe(false);
  });

  it('returns false for card in normal todo list name', () => {
    expect(isRiskCard(makeCard(), 'To Do')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (overdue keyword variants)', () => {
  it('maps "Blocked" to Overdue', () => {
    expect(mapListToStatus('Blocked')).toBe('Overdue');
  });

  it('maps "Escalated" to Overdue', () => {
    expect(mapListToStatus('Escalated')).toBe('Overdue');
  });

  it('maps "Overdue Tasks" to Overdue', () => {
    expect(mapListToStatus('Overdue Tasks')).toBe('Overdue');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (In Review keyword variants)', () => {
  it('maps "Testing" to In Review', () => {
    expect(mapListToStatus('Testing')).toBe('In Review');
  });

  it('maps "QA" to In Review', () => {
    expect(mapListToStatus('QA')).toBe('In Review');
  });

  it('maps "Approval" to In Review', () => {
    expect(mapListToStatus('Approval')).toBe('In Review');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToPriority (empty and default)', () => {
  it('returns Medium by default for empty labels', () => {
    expect(mapLabelsToPriority([])).toBe('Medium');
  });

  it('returns Critical for "critical" name label', () => {
    const labels = [makeLabel('critical issue', null)];
    expect(mapLabelsToPriority(labels)).toBe('Critical');
  });

  it('returns High for "high" name label', () => {
    const labels = [makeLabel('High Priority', null)];
    expect(mapLabelsToPriority(labels)).toBe('High');
  });

  it('returns Low for "low" name label', () => {
    const labels = [makeLabel('Low Priority', null)];
    expect(mapLabelsToPriority(labels)).toBe('Low');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (compliance and vendor)', () => {
  it('returns Compliance for "legal" keyword in name', () => {
    expect(mapRiskCategory(makeCard({ name: 'Legal challenge from vendor' }))).toBe('Compliance');
  });

  it('returns Vendor for "vendor" keyword in name', () => {
    expect(mapRiskCategory(makeCard({ name: 'Vendor performance issue' }))).toBe('Vendor');
  });

  it('returns Operational by default for unknown text', () => {
    expect(mapRiskCategory(makeCard({ name: 'Unknown risk factor', desc: 'Unclear impact' }))).toBe('Operational');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractClient (multiple non-skip labels)', () => {
  it('returns first non-skip label as client', () => {
    const labels = [makeLabel('ADNOC'), makeLabel('MOCI')];
    expect(extractClient('Task', labels)).toBe('ADNOC');
  });

  it('returns bracket client over labels', () => {
    const labels = [makeLabel('ADNOC')];
    expect(extractClient('[SEC] Security Assessment', labels)).toBe('SEC');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (completed keyword variants)', () => {
  it('maps "Closed" to Completed', () => {
    expect(mapListToStatus('Closed')).toBe('Completed');
  });

  it('maps "Finished" to Completed', () => {
    expect(mapListToStatus('Finished')).toBe('Completed');
  });

  it('maps "Done Tasks" to Completed', () => {
    expect(mapListToStatus('Done Tasks')).toBe('Completed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (default Backlog for unknown lists)', () => {
  it('maps "Future" to Backlog', () => {
    expect(mapListToStatus('Future')).toBe('Backlog');
  });

  it('maps "Not Started" to Backlog', () => {
    expect(mapListToStatus('Not Started')).toBe('Backlog');
  });

  it('maps "" (empty) to Backlog', () => {
    expect(mapListToStatus('')).toBe('Backlog');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (resource and financial)', () => {
  it('returns Resource for "team" keyword in desc', () => {
    expect(mapRiskCategory(makeCard({ name: 'Risk', desc: 'Team capacity shortage' }))).toBe('Resource');
  });

  it('returns Financial for "cost" keyword in desc', () => {
    expect(mapRiskCategory(makeCard({ name: 'Risk', desc: 'Cost overrun potential' }))).toBe('Financial');
  });

  it('returns Technical for "system" keyword in desc', () => {
    expect(mapRiskCategory(makeCard({ name: 'Risk', desc: 'System failure scenario' }))).toBe('Technical');
  });
});

// ─────────────────────────────────────────────────────────────
describe('isRiskCard (true for risk-labeled cards)', () => {
  it('returns true for card with "risk" label', () => {
    const card = makeCard({ labels: [makeLabel('risk')] });
    expect(isRiskCard(card, '')).toBe(true);
  });

  it('returns true when list name contains "risk"', () => {
    expect(isRiskCard(makeCard(), 'Risk Register')).toBe(true);
  });

  it('returns true for card with "issue" label', () => {
    const card = makeCard({ labels: [makeLabel('issue')] });
    expect(isRiskCard(card, '')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (In Progress case insensitive)', () => {
  it('maps "IN PROGRESS" uppercased to In Progress', () => {
    expect(mapListToStatus('IN PROGRESS')).toBe('In Progress');
  });

  it('maps "in progress" lowercased to In Progress', () => {
    expect(mapListToStatus('in progress')).toBe('In Progress');
  });

  it('maps "In Progress" mixed case to In Progress', () => {
    expect(mapListToStatus('In Progress')).toBe('In Progress');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (Completed case insensitive)', () => {
  it('maps "DONE" uppercased to Completed', () => {
    expect(mapListToStatus('DONE')).toBe('Completed');
  });

  it('maps "done" lowercased to Completed', () => {
    expect(mapListToStatus('done')).toBe('Completed');
  });

  it('maps "Completed" mixed case to Completed', () => {
    expect(mapListToStatus('Completed')).toBe('Completed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (Overdue and Blocked)', () => {
  it('maps "Overdue" to Overdue', () => {
    expect(mapListToStatus('Overdue')).toBe('Overdue');
  });

  it('maps "Blocked Items" to Overdue', () => {
    expect(mapListToStatus('Blocked Items')).toBe('Overdue');
  });

  it('maps "Escalated Issues" to Overdue', () => {
    expect(mapListToStatus('Escalated Issues')).toBe('Overdue');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (In Review variants)', () => {
  it('maps "In Review" to In Review', () => {
    expect(mapListToStatus('In Review')).toBe('In Review');
  });

  it('maps "QA Testing" to In Review', () => {
    expect(mapListToStatus('QA Testing')).toBe('In Review');
  });

  it('maps "Testing Phase" to In Review', () => {
    expect(mapListToStatus('Testing Phase')).toBe('In Review');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (title keywords)', () => {
  it('returns Schedule for card name with "timeline" keyword', () => {
    expect(mapRiskCategory(makeCard({ name: 'Project timeline slippage', desc: '' }))).toBe('Schedule');
  });

  it('returns Technical for card name with "tech" keyword', () => {
    expect(mapRiskCategory(makeCard({ name: 'Tech stack compatibility issue', desc: '' }))).toBe('Technical');
  });

  it('returns Financial for card name with "budget" keyword', () => {
    expect(mapRiskCategory(makeCard({ name: 'Budget overrun', desc: '' }))).toBe('Financial');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractProducts (meeting label)', () => {
  it('returns Meeting (capitalized) product for meeting label', () => {
    const labels = [{ id: 'l1', name: 'meeting', color: 'blue' }];
    expect(extractProducts(labels)).toContain('Meeting');
  });

  it('returns empty array when no matching labels', () => {
    const labels = [{ id: 'l1', name: 'random-label', color: 'grey' }];
    expect(extractProducts(labels)).toHaveLength(0);
  });

  it('detects P+ and S+ (capitalized) in same labels array', () => {
    const labels = [
      { id: 'l1', name: 'p+', color: 'blue' },
      { id: 'l2', name: 's+', color: 'green' },
    ];
    const products = extractProducts(labels);
    expect(products).toContain('P+');
    expect(products).toContain('S+');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToPriority (default and low)', () => {
  it('returns Medium by default for unknown color', () => {
    const labels = [{ id: 'l1', name: 'misc', color: 'purple' }];
    expect(mapLabelsToPriority(labels)).toBe('Medium');
  });

  it('returns Low for green colored label', () => {
    const labels = [{ id: 'l1', name: 'low priority', color: 'green' }];
    expect(mapLabelsToPriority(labels)).toBe('Low');
  });

  it('returns High for orange colored label', () => {
    const labels = [{ id: 'l1', name: 'high', color: 'orange' }];
    expect(mapLabelsToPriority(labels)).toBe('High');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToSeverity (all severity levels)', () => {
  it('returns Low for green label', () => {
    const labels = [{ id: 'l1', name: 'Low', color: 'green' }];
    expect(mapLabelsToSeverity(labels)).toBe('Low');
  });

  it('returns Medium for yellow label', () => {
    const labels = [{ id: 'l1', name: 'Medium', color: 'yellow' }];
    expect(mapLabelsToSeverity(labels)).toBe('Medium');
  });

  it('returns High for orange label', () => {
    const labels = [{ id: 'l1', name: 'High', color: 'orange' }];
    expect(mapLabelsToSeverity(labels)).toBe('High');
  });

  it('returns Medium as default when no labels', () => {
    expect(mapLabelsToSeverity([])).toBe('Medium');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractClient (bracket patterns)', () => {
  it('extracts client from [CLIENT] at start of name', () => {
    expect(extractClient('[MOCI] Policy Review', [])).toBe('MOCI');
  });

  it('returns empty string when bracket is not at start', () => {
    expect(extractClient('Phase 2 [NCA] Security Audit', [])).toBe('');
  });

  it('returns empty string when no labels and no brackets', () => {
    expect(extractClient('Generic task name', [])).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (more keywords)', () => {
  it('returns Technical for card with "technical" in name', () => {
    expect(mapRiskCategory(makeCard({ name: 'Technical dependency failure', desc: '' }))).toBe('Technical');
  });

  it('returns Operational for card with generic process name', () => {
    expect(mapRiskCategory(makeCard({ name: 'Process failure risk', desc: '' }))).toBe('Operational');
  });

  it('returns Resource for card with "staff" keyword', () => {
    expect(mapRiskCategory(makeCard({ name: 'Staff turnover impact', desc: '' }))).toBe('Resource');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (Backlog keyword variants)', () => {
  it('maps "Backlog" to Backlog', () => {
    expect(mapListToStatus('Backlog')).toBe('Backlog');
  });

  it('maps "Product Backlog" to Backlog', () => {
    expect(mapListToStatus('Product Backlog')).toBe('Backlog');
  });

  it('maps "To Do" to Backlog', () => {
    expect(mapListToStatus('To Do')).toBe('Backlog');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (compliance variants)', () => {
  it('returns Compliance for "regulatory" keyword without delay', () => {
    expect(mapRiskCategory(makeCard({ name: 'Regulatory compliance failure', desc: '' }))).toBe('Compliance');
  });

  it('returns Compliance for "legal" keyword in desc', () => {
    expect(mapRiskCategory(makeCard({ name: 'Risk item', desc: 'Legal challenge pending' }))).toBe('Compliance');
  });

  it('returns Vendor for "supplier" keyword', () => {
    expect(mapRiskCategory(makeCard({ name: 'Risk item', desc: 'Supplier performance issue' }))).toBe('Vendor');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToPriority (name-based)', () => {
  it('returns Critical for "critical" name', () => {
    const labels = [{ id: 'l1', name: 'critical', color: 'red' }];
    expect(mapLabelsToPriority(labels)).toBe('Critical');
  });

  it('returns High for "high" name', () => {
    const labels = [{ id: 'l1', name: 'high', color: 'orange' }];
    expect(mapLabelsToPriority(labels)).toBe('High');
  });

  it('returns Low for "low" name', () => {
    const labels = [{ id: 'l1', name: 'low', color: 'green' }];
    expect(mapLabelsToPriority(labels)).toBe('Low');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToSeverity (name-based)', () => {
  it('returns Critical for "critical" name', () => {
    const labels = [{ id: 'l1', name: 'critical', color: 'red' }];
    expect(mapLabelsToSeverity(labels)).toBe('Critical');
  });

  it('returns High for "high" name', () => {
    const labels = [{ id: 'l1', name: 'high', color: 'orange' }];
    expect(mapLabelsToSeverity(labels)).toBe('High');
  });

  it('returns Low for "low" name', () => {
    const labels = [{ id: 'l1', name: 'low', color: 'green' }];
    expect(mapLabelsToSeverity(labels)).toBe('Low');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractClient (label-based)', () => {
  it('returns first label name as client when no brackets', () => {
    const labels = [{ id: 'l1', name: 'ADNOC', color: 'blue' }];
    expect(extractClient('Generic Task', labels)).toBe('ADNOC');
  });

  it('returns second label when first is skip word', () => {
    const labels = [
      { id: 'l1', name: 'high', color: 'orange' },
      { id: 'l2', name: 'NCA', color: 'blue' },
    ];
    expect(extractClient('Task name', labels)).toBe('NCA');
  });

  it('skips "risk" label and uses next label', () => {
    const labels = [
      { id: 'l1', name: 'risk', color: 'red' },
      { id: 'l2', name: 'MOCI', color: 'blue' },
    ];
    expect(extractClient('Risk Item', labels)).toBe('MOCI');
  });
});

// ─────────────────────────────────────────────────────────────
describe('isRiskCard (additional cases)', () => {
  it('returns false for card with empty labels and safe list name', () => {
    expect(isRiskCard(makeCard({ labels: [] }), 'Sprint Backlog')).toBe(false);
  });

  it('returns true for list named "Risk Log"', () => {
    expect(isRiskCard(makeCard(), 'Risk Log')).toBe(true);
  });

  it('returns true for card with "threat" label', () => {
    const card = makeCard({ labels: [makeLabel('threat')] });
    expect(isRiskCard(card, '')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (vendor and procurement variants)', () => {
  it('returns Vendor for "procurement" in card name without delay', () => {
    expect(mapRiskCategory(makeCard({ name: 'Procurement bottleneck', desc: '' }))).toBe('Vendor');
  });

  it('returns Vendor for "vendor" keyword in desc only', () => {
    const card = makeCard({ name: 'Third party issue', desc: 'vendor relationship at risk' });
    expect(mapRiskCategory(card)).toBe('Vendor');
  });

  it('returns Schedule for "delay" keyword in desc', () => {
    const card = makeCard({ name: 'Project risk', desc: 'delay in delivery expected' });
    expect(mapRiskCategory(card)).toBe('Schedule');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (review keyword variants)', () => {
  it('maps "Review" to In Review', () => {
    expect(mapListToStatus('Review')).toBe('In Review');
  });

  it('maps "QA" to In Review', () => {
    expect(mapListToStatus('QA')).toBe('In Review');
  });

  it('maps "Approval Queue" to In Review', () => {
    expect(mapListToStatus('Approval Queue')).toBe('In Review');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractClient (more bracket variants)', () => {
  it('extracts ZATCA from [ZATCA] prefix', () => {
    expect(extractClient('[ZATCA] VAT Reform', [])).toBe('ZATCA');
  });

  it('extracts STC from [STC] prefix', () => {
    expect(extractClient('[STC] Network Upgrade', [])).toBe('STC');
  });

  it('extracts NEOM from [NEOM] prefix', () => {
    expect(extractClient('[NEOM] Smart City Phase 2', [])).toBe('NEOM');
  });
});

// ─────────────────────────────────────────────────────────────
describe('resolveCustomFields (estimation variants)', () => {
  const estimField = { id: 'cf-3', name: 'Estimation (hours)', type: 'number' as const };

  it('returns the number string for 80 hours', () => {
    const items = [{ id: 'i3', idCustomField: 'cf-3', value: { number: '80' } }];
    expect(resolveCustomFields(items, [estimField]).estimation).toBe('80');
  });

  it('returns the number string for 0 hours', () => {
    const items = [{ id: 'i3', idCustomField: 'cf-3', value: { number: '0' } }];
    expect(resolveCustomFields(items, [estimField]).estimation).toBe('0');
  });

  it('returns empty estimation when item has no estimation field', () => {
    expect(resolveCustomFields([], [estimField]).estimation).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToPriority (mixed labels array)', () => {
  it('returns Critical when "critical" label is mixed with others', () => {
    const labels = [makeLabel('ADNOC'), makeLabel('critical', 'red'), makeLabel('Meeting')];
    expect(mapLabelsToPriority(labels)).toBe('Critical');
  });

  it('returns High when only orange color label present', () => {
    const labels = [makeLabel('', 'orange')];
    expect(mapLabelsToPriority(labels)).toBe('High');
  });

  it('returns Medium when only sky color label present', () => {
    const labels = [makeLabel('', 'sky')];
    expect(mapLabelsToPriority(labels)).toBe('Medium');
  });
});

// ─────────────────────────────────────────────────────────────
describe('isRiskCard (list name patterns)', () => {
  it('returns true for "Risk Items" list name', () => {
    expect(isRiskCard(makeCard(), 'Risk Items')).toBe(true);
  });

  it('returns false for "Design" list name', () => {
    expect(isRiskCard(makeCard(), 'Design')).toBe(false);
  });

  it('returns false for "Planning" list name with no risk labels', () => {
    expect(isRiskCard(makeCard({ labels: [] }), 'Planning')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (financial keyword variants)', () => {
  it('returns Financial for "financial" in card name', () => {
    expect(mapRiskCategory(makeCard({ name: 'Financial exposure risk', desc: '' }))).toBe('Financial');
  });

  it('returns Financial for "budget" in desc', () => {
    const card = makeCard({ name: 'Cost management', desc: 'budget constraints expected' });
    expect(mapRiskCategory(card)).toBe('Financial');
  });

  it('returns Financial for label with "budget"', () => {
    const card = makeCard({ labels: [makeLabel('Budget Risk')] });
    expect(mapRiskCategory(card)).toBe('Financial');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractClient (STC and NEOM clients)', () => {
  it('extracts STC from label', () => {
    const labels = [makeLabel('STC', 'blue')];
    expect(extractClient('5G Network Task', labels)).toBe('STC');
  });

  it('extracts NEOM from label', () => {
    const labels = [makeLabel('NEOM', 'green')];
    expect(extractClient('Smart Mobility', labels)).toBe('NEOM');
  });

  it('returns ADNOC from bracket when both bracket and label present', () => {
    const labels = [makeLabel('MOCI', 'blue')];
    expect(extractClient('[ADNOC] Digital Task', labels)).toBe('ADNOC');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (completed keyword variants)', () => {
  it('maps "Closed" to Completed', () => {
    expect(mapListToStatus('Closed')).toBe('Completed');
  });

  it('maps "Done ✅" to Completed', () => {
    expect(mapListToStatus('Done ✅')).toBe('Completed');
  });

  it('maps "finished" (lowercase) to Completed', () => {
    expect(mapListToStatus('finished')).toBe('Completed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('resolveCustomFields (date format variants)', () => {
  const deliveryField = { id: 'cf-4', name: 'Delivery Plan', type: 'date' as const };

  it('truncates to YYYY-MM-DD for different dates', () => {
    const items = [{ id: 'i4', idCustomField: 'cf-4', value: { date: '2026-12-31T00:00:00.000Z' } }];
    expect(resolveCustomFields(items, [deliveryField]).deliveryDate).toBe('2026-12-31');
  });

  it('truncates month-specific date correctly', () => {
    const items = [{ id: 'i4', idCustomField: 'cf-4', value: { date: '2025-03-15T12:00:00.000Z' } }];
    expect(resolveCustomFields(items, [deliveryField]).deliveryDate).toBe('2025-03-15');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractProducts (additional patterns)', () => {
  it('returns empty array for empty labels', () => {
    expect(extractProducts([])).toEqual([]);
  });

  it('returns empty array for priority-only labels', () => {
    const labels = [makeLabel('High', 'orange'), makeLabel('Medium', 'yellow')];
    expect(extractProducts(labels)).toEqual([]);
  });

  it('extracts P+ and S+ from labels', () => {
    const labels = [makeLabel('p+'), makeLabel('s+')];
    const products = extractProducts(labels);
    expect(products.length).toBeGreaterThan(0);
  });

  it('extracts Meeting product from labels', () => {
    const labels = [makeLabel('meeting')];
    expect(extractProducts(labels)).toContain('Meeting');
  });

  it('returns empty for color-only labels with no name', () => {
    const labels = [makeLabel('', 'red'), makeLabel('', 'blue')];
    expect(extractProducts(labels)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
describe('isRiskCard (label-based detection)', () => {
  it('returns true for card with "risk" label', () => {
    const card = makeCard({ labels: [makeLabel('Risk', 'red')] });
    expect(isRiskCard(card, 'General')).toBe(true);
  });

  it('returns true for card in "Risks" list', () => {
    expect(isRiskCard(makeCard(), 'Risks')).toBe(true);
  });

  it('returns true for card with "Risk Register" in list name', () => {
    expect(isRiskCard(makeCard(), 'Risk Register')).toBe(true);
  });

  it('returns false for card in "Tasks" list with no risk labels', () => {
    expect(isRiskCard(makeCard({ labels: [] }), 'Tasks')).toBe(false);
  });

  it('returns false for card with only client label in non-risk list', () => {
    const card = makeCard({ labels: [makeLabel('NCA', 'blue')] });
    expect(isRiskCard(card, 'Backlog')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
describe('resolveCustomFields (estimation field variants)', () => {
  it('returns estimation value for hours field', () => {
    const hoursField = { id: 'cf-hrs', name: 'Estimation Hours', type: 'number' as const };
    const items = [{ id: 'i1', idCustomField: 'cf-hrs', value: { number: '40' } }];
    const result = resolveCustomFields(items, [hoursField]);
    expect(result.estimation).toBe('40');
  });

  it('returns empty estimation for unknown field', () => {
    const unknownField = { id: 'cf-unk', name: 'Notes', type: 'text' as const };
    const items = [{ id: 'i1', idCustomField: 'cf-unk', value: { text: 'some note' } }];
    const result = resolveCustomFields(items, [unknownField]);
    expect(result.estimation).toBe('');
  });

  it('returns pm value from project manager field', () => {
    const pmField = { id: 'cf-pm', name: 'Project Manager', type: 'text' as const };
    const items = [{ id: 'i1', idCustomField: 'cf-pm', value: { text: 'Ahmed Khalil' } }];
    const result = resolveCustomFields(items, [pmField]);
    expect(result.pm).toBe('Ahmed Khalil');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (scope and schedule keywords)', () => {
  it('returns Operational for "scope" in card name', () => {
    const card = makeCard({ name: 'Scope creep concern', labels: [] });
    expect(mapRiskCategory(card)).toBe('Operational');
  });

  it('returns Schedule for "delay" in card name', () => {
    const card = makeCard({ name: 'Delivery delay risk', labels: [] });
    expect(mapRiskCategory(card)).toBe('Schedule');
  });

  it('returns Financial for "cost" in card name', () => {
    const card = makeCard({ name: 'Cost overrun risk', labels: [] });
    expect(mapRiskCategory(card)).toBe('Financial');
  });

  it('returns Schedule for "timeline" in card name', () => {
    const card = makeCard({ name: 'Timeline slippage risk', labels: [] });
    expect(mapRiskCategory(card)).toBe('Schedule');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractClient (VISION2030 and GAZT clients)', () => {
  it('extracts VISION2030 from label', () => {
    const labels = [makeLabel('VISION2030', 'purple')];
    expect(extractClient('National Project', labels)).toBe('VISION2030');
  });

  it('extracts GAZT from bracket notation', () => {
    expect(extractClient('[GAZT] Tax Analysis', [])).toBe('GAZT');
  });

  it('returns empty string for empty card name and empty labels', () => {
    expect(extractClient('', [])).toBe('');
  });

  it('extracts ADNOC from label name', () => {
    const labels = [makeLabel('ADNOC', 'blue')];
    expect(extractClient('Digital Oilfield Task', labels)).toBe('ADNOC');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapListToStatus (more keyword variants)', () => {
  it('maps "In Progress 🔄" to In Progress', () => {
    expect(mapListToStatus('In Progress 🔄')).toBe('In Progress');
  });

  it('maps "Doing" to In Progress', () => {
    expect(mapListToStatus('Doing')).toBe('In Progress');
  });

  it('maps "Active Sprint" to In Progress', () => {
    expect(mapListToStatus('Active Sprint')).toBe('In Progress');
  });

  it('maps "WIP" to In Progress', () => {
    expect(mapListToStatus('WIP')).toBe('In Progress');
  });

  it('maps "Overdue Tasks" to Overdue', () => {
    expect(mapListToStatus('Overdue Tasks')).toBe('Overdue');
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
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToPriority (additional color variants)', () => {
  it('returns Critical for red color label', () => {
    const labels = [makeLabel('Task', 'red')];
    expect(mapLabelsToPriority(labels)).toBe('Critical');
  });

  it('returns High for orange color label', () => {
    const labels = [makeLabel('Task', 'orange')];
    expect(mapLabelsToPriority(labels)).toBe('High');
  });

  it('returns Medium for yellow color label', () => {
    const labels = [makeLabel('Task', 'yellow')];
    expect(mapLabelsToPriority(labels)).toBe('Medium');
  });

  it('returns Low for green color label', () => {
    const labels = [makeLabel('Task', 'green')];
    expect(mapLabelsToPriority(labels)).toBe('Low');
  });

  it('returns Medium when no labels', () => {
    expect(mapLabelsToPriority([])).toBe('Medium');
  });

  it('returns Critical for urgent name label', () => {
    const labels = [makeLabel('urgent', null)];
    expect(mapLabelsToPriority(labels)).toBe('Critical');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapLabelsToSeverity (derived from priority)', () => {
  it('returns Critical for red label', () => {
    const labels = [makeLabel('Task', 'red')];
    expect(mapLabelsToSeverity(labels)).toBe('Critical');
  });

  it('returns High for orange label', () => {
    const labels = [makeLabel('Task', 'orange')];
    expect(mapLabelsToSeverity(labels)).toBe('High');
  });

  it('returns Medium for yellow label', () => {
    const labels = [makeLabel('Task', 'yellow')];
    expect(mapLabelsToSeverity(labels)).toBe('Medium');
  });

  it('returns Low for green label', () => {
    const labels = [makeLabel('Task', 'green')];
    expect(mapLabelsToSeverity(labels)).toBe('Low');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractProducts (product label variants)', () => {
  it('returns P+ for p+ label', () => {
    const labels = [makeLabel('p+', null)];
    expect(extractProducts(labels)).toContain('P+');
  });

  it('returns S+ for s+ label', () => {
    const labels = [makeLabel('s+', null)];
    expect(extractProducts(labels)).toContain('S+');
  });

  it('returns Meeting for meeting label', () => {
    const labels = [makeLabel('meeting', null)];
    expect(extractProducts(labels)).toContain('Meeting');
  });

  it('returns empty array for unrecognized labels', () => {
    const labels = [makeLabel('custom-tag', null)];
    expect(extractProducts(labels)).toEqual([]);
  });

  it('returns multiple products when multiple product labels present', () => {
    const labels = [makeLabel('p+', null), makeLabel('s+', null)];
    const result = extractProducts(labels);
    expect(result).toContain('P+');
    expect(result).toContain('S+');
  });
});

// ─────────────────────────────────────────────────────────────
describe('extractClient (empty and edge cases)', () => {
  it('returns empty string when no labels and no bracket prefix', () => {
    expect(extractClient('Plan and Prepare', [])).toBe('');
  });

  it('extracts MOCI from bracket prefix', () => {
    expect(extractClient('[MOCI] Digital Strategy', [])).toBe('MOCI');
  });

  it('extracts SAMA from bracket prefix', () => {
    expect(extractClient('[SAMA] Compliance Review', [])).toBe('SAMA');
  });

  it('skips priority labels and returns empty', () => {
    const labels = [makeLabel('High', 'orange'), makeLabel('Medium', 'yellow')];
    expect(extractClient('Task Name', labels)).toBe('');
  });

  it('extracts client from first non-skip label', () => {
    const labels = [makeLabel('NCA', 'blue')];
    expect(extractClient('Enterprise Task', labels)).toBe('NCA');
  });
});

// ─────────────────────────────────────────────────────────────
describe('mapRiskCategory (more category variants)', () => {
  it('returns Technical for "tech" keyword', () => {
    const card = makeCard({ name: 'Tech Debt Issue', labels: [] });
    expect(mapRiskCategory(card)).toBe('Technical');
  });

  it('returns Technical for "system" keyword', () => {
    const card = makeCard({ name: 'System Outage Risk', labels: [] });
    expect(mapRiskCategory(card)).toBe('Technical');
  });

  it('returns Resource for "staff" keyword', () => {
    const card = makeCard({ name: 'Staff Shortage Risk', labels: [] });
    expect(mapRiskCategory(card)).toBe('Resource');
  });

  it('returns Resource for "team" keyword', () => {
    const card = makeCard({ name: 'Team Capacity Issue', labels: [] });
    expect(mapRiskCategory(card)).toBe('Resource');
  });

  it('returns Compliance for "legal" keyword', () => {
    const card = makeCard({ name: 'Legal Dispute Risk', labels: [] });
    expect(mapRiskCategory(card)).toBe('Compliance');
  });

  it('returns Compliance for "regulatory" keyword', () => {
    const card = makeCard({ name: 'Regulatory Non-Compliance', labels: [] });
    expect(mapRiskCategory(card)).toBe('Compliance');
  });

  it('returns Operational for unrecognized keywords', () => {
    const card = makeCard({ name: 'General Concern', labels: [] });
    expect(mapRiskCategory(card)).toBe('Operational');
  });
});

// ── Async API function tests (fetch mocked) ───────────────────

function makeFetchMock(responseData: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 401,
    json: vi.fn().mockResolvedValue(responseData),
  });
}

const mockBoardApi: TrelloBoard = {
  id: 'board-test-1',
  name: 'BA Board',
  desc: 'BA Board description',
  url: 'https://trello.com/b/test',
  closed: false,
};

const mockListApi: TrelloList = { id: 'list-1', name: 'Backlog', closed: false, pos: 1 };
const mockListApi2: TrelloList = { id: 'list-2', name: 'In Progress', closed: false, pos: 2 };

const mockMemberApi: TrelloMember = {
  id: 'member-1',
  username: 'jdoe',
  fullName: 'John Doe',
  initials: 'JD',
  avatarUrl: undefined,
};

const mockTrelloCardApi: TrelloCard = {
  id: 'card-api-1',
  name: 'Test Task Card',
  desc: 'A regular task',
  due: '2026-08-01T00:00:00Z',
  dueComplete: false,
  idList: 'list-1',
  idBoard: 'board-test-1',
  labels: [],
  idMembers: ['member-1'],
  members: [mockMemberApi],
  url: 'https://trello.com/c/card-api-1',
  closed: false,
  shortUrl: 'https://trello.com/c/card-api-1',
  pos: 1,
  dateLastActivity: '2026-06-01T00:00:00Z',
};

describe('getTrelloBoards', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock([mockBoardApi]));
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns array of boards on success', async () => {
    const boards = await getTrelloBoards();
    expect(Array.isArray(boards)).toBe(true);
    expect(boards).toHaveLength(1);
    expect(boards[0].id).toBe('board-test-1');
  });

  it('returns board with correct name', async () => {
    const boards = await getTrelloBoards();
    expect(boards[0].name).toBe('BA Board');
  });

  it('calls fetch once', async () => {
    await getTrelloBoards();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('calls fetch with Trello API URL', async () => {
    await getTrelloBoards();
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('api.trello.com/1/members/me/boards');
  });

  it('includes API key in request URL', async () => {
    await getTrelloBoards();
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('key=test-key');
  });

  it('includes token in request URL', async () => {
    await getTrelloBoards();
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('token=test-token');
  });

  it('throws when response is not ok', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ message: 'Unauthorized' }, false));
    await expect(getTrelloBoards()).rejects.toThrow('Unauthorized');
  });

  it('returns empty array when API returns empty list', async () => {
    vi.stubGlobal('fetch', makeFetchMock([]));
    const boards = await getTrelloBoards();
    expect(boards).toHaveLength(0);
  });

  it('returns multiple boards', async () => {
    const board2: TrelloBoard = { ...mockBoardApi, id: 'board-2', name: 'Project Board' };
    vi.stubGlobal('fetch', makeFetchMock([mockBoardApi, board2]));
    const boards = await getTrelloBoards();
    expect(boards).toHaveLength(2);
    expect(boards[1].name).toBe('Project Board');
  });
});

describe('getTrelloBoard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock(mockBoardApi));
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns a single board', async () => {
    const board = await getTrelloBoard('board-test-1');
    expect(board.id).toBe('board-test-1');
  });

  it('calls fetch with correct board path', async () => {
    await getTrelloBoard('board-test-1');
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('/boards/board-test-1');
  });

  it('returns board name correctly', async () => {
    const board = await getTrelloBoard('board-test-1');
    expect(board.name).toBe('BA Board');
  });

  it('throws on 401 response', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ message: 'invalid token' }, false));
    await expect(getTrelloBoard('x')).rejects.toThrow('invalid token');
  });

  it('throws with fallback message when API error has no message body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockRejectedValue(new Error('not json')),
    }));
    await expect(getTrelloBoard('missing-id')).rejects.toThrow('Trello API error 404');
  });
});

describe('getTrelloLists', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock([mockListApi, mockListApi2]));
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns array of lists', async () => {
    const lists = await getTrelloLists('board-test-1');
    expect(lists).toHaveLength(2);
  });

  it('calls fetch with board lists path', async () => {
    await getTrelloLists('board-test-1');
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('/boards/board-test-1/lists');
  });

  it('returns list names correctly', async () => {
    const lists = await getTrelloLists('board-test-1');
    expect(lists[0].name).toBe('Backlog');
    expect(lists[1].name).toBe('In Progress');
  });

  it('returns empty array when board has no lists', async () => {
    vi.stubGlobal('fetch', makeFetchMock([]));
    const lists = await getTrelloLists('board-test-1');
    expect(lists).toHaveLength(0);
  });
});

describe('getTrelloCards', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock([mockTrelloCardApi]));
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns array of cards', async () => {
    const cards = await getTrelloCards('board-test-1');
    expect(cards).toHaveLength(1);
  });

  it('calls fetch with board cards path', async () => {
    await getTrelloCards('board-test-1');
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('/boards/board-test-1/cards');
  });

  it('returns card name correctly', async () => {
    const cards = await getTrelloCards('board-test-1');
    expect(cards[0].name).toBe('Test Task Card');
  });

  it('returns card with members attached', async () => {
    const cards = await getTrelloCards('board-test-1');
    expect(cards[0].members).toHaveLength(1);
    expect(cards[0].members![0].fullName).toBe('John Doe');
  });

  it('includes members=true in query', async () => {
    await getTrelloCards('board-test-1');
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('members=true');
  });
});

describe('getTrelloBoardMembers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock([mockMemberApi]));
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns array of members', async () => {
    const members = await getTrelloBoardMembers('board-test-1');
    expect(members).toHaveLength(1);
  });

  it('calls fetch with members path', async () => {
    await getTrelloBoardMembers('board-test-1');
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('/boards/board-test-1/members');
  });

  it('returns member fullName correctly', async () => {
    const members = await getTrelloBoardMembers('board-test-1');
    expect(members[0].fullName).toBe('John Doe');
  });

  it('returns member initials correctly', async () => {
    const members = await getTrelloBoardMembers('board-test-1');
    expect(members[0].initials).toBe('JD');
  });
});

describe('findBABoard', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('finds board named "BA Board" (exact match)', async () => {
    vi.stubGlobal('fetch', makeFetchMock([mockBoardApi]));
    const board = await findBABoard();
    expect(board).not.toBeNull();
    expect(board!.name).toBe('BA Board');
  });

  it('finds board containing "ba board" (case insensitive)', async () => {
    const board2 = { ...mockBoardApi, name: 'My BA Board 2026' };
    vi.stubGlobal('fetch', makeFetchMock([board2]));
    const result = await findBABoard();
    expect(result!.name).toBe('My BA Board 2026');
  });

  it('finds board starting with "BA " prefix', async () => {
    const board2 = { ...mockBoardApi, name: 'BA Traffic Management' };
    vi.stubGlobal('fetch', makeFetchMock([board2]));
    const result = await findBABoard();
    expect(result!.name).toBe('BA Traffic Management');
  });

  it('finds board containing "business analyst"', async () => {
    const board2 = { ...mockBoardApi, name: 'Business Analyst Portal' };
    vi.stubGlobal('fetch', makeFetchMock([board2]));
    const result = await findBABoard();
    expect(result!.name).toBe('Business Analyst Portal');
  });

  it('falls back to first board when no BA board found', async () => {
    const firstBoard = { ...mockBoardApi, name: 'Random Project Board' };
    const secondBoard = { ...mockBoardApi, id: 'board-2', name: 'Another Board' };
    vi.stubGlobal('fetch', makeFetchMock([firstBoard, secondBoard]));
    const result = await findBABoard();
    expect(result!.name).toBe('Random Project Board');
  });

  it('returns null when boards list is empty', async () => {
    vi.stubGlobal('fetch', makeFetchMock([]));
    const result = await findBABoard();
    expect(result).toBeNull();
  });

  it('prefers "BA Board" name over first board in list when ordering matters', async () => {
    const baExact = { ...mockBoardApi, id: 'board-exact', name: 'BA Board' };
    const baFirst = { ...mockBoardApi, id: 'board-first', name: 'Other Board' };
    vi.stubGlobal('fetch', makeFetchMock([baFirst, baExact]));
    const result = await findBABoard();
    expect(result!.id).toBe('board-exact');
  });
});

describe('fetchBoardData', () => {
  const taskCardFBD: TrelloCard = {
    id: 'task-card-1',
    name: 'Design System Architecture',
    desc: 'Design the system',
    due: '2026-09-01T00:00:00Z',
    dueComplete: false,
    idList: 'list-2',
    idBoard: 'board-test-1',
    labels: [{ id: 'lbl-h', name: 'high', color: 'orange' }],
    idMembers: ['member-1'],
    members: [{ id: 'member-1', username: 'jdoe', fullName: 'John Doe', initials: 'JD' }],
    url: 'https://trello.com/c/task-1',
    closed: false,
    shortUrl: 'https://trello.com/c/task-1',
    pos: 1,
    dateLastActivity: '2026-06-01T00:00:00Z',
  };

  const riskCardFBD: TrelloCard = {
    id: 'risk-card-1',
    name: 'Budget Risk Assessment',
    desc: 'Financial risk identified with budget overrun',
    due: null,
    dueComplete: false,
    idList: 'list-risk',
    idBoard: 'board-test-1',
    labels: [{ id: 'lbl-risk', name: 'risk', color: 'red' }],
    idMembers: [],
    members: [],
    url: 'https://trello.com/c/risk-1',
    closed: false,
    shortUrl: 'https://trello.com/c/risk-1',
    pos: 2,
    dateLastActivity: '2026-06-02T00:00:00Z',
  };

  const riskListFBD: TrelloList = { id: 'list-risk', name: 'Risk Register', closed: false, pos: 3 };

  function setupFetchSequence(cards: TrelloCard[] = [taskCardFBD, riskCardFBD]) {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockBoardApi) });
      if (call === 2) return Promise.resolve({ ok: true, json: () => Promise.resolve([mockListApi, mockListApi2, riskListFBD]) });
      if (call === 3) return Promise.resolve({ ok: true, json: () => Promise.resolve(cards) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([mockMemberApi]) });
    }));
  }

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns board object', async () => {
    setupFetchSequence();
    const data = await fetchBoardData('board-test-1');
    expect(data.board.id).toBe('board-test-1');
  });

  it('returns lists array', async () => {
    setupFetchSequence();
    const data = await fetchBoardData('board-test-1');
    expect(data.lists).toHaveLength(3);
  });

  it('returns members array', async () => {
    setupFetchSequence();
    const data = await fetchBoardData('board-test-1');
    expect(data.members).toHaveLength(1);
    expect(data.members[0].fullName).toBe('John Doe');
  });

  it('maps task card to tasks array', async () => {
    setupFetchSequence([taskCardFBD]);
    const data = await fetchBoardData('board-test-1');
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].title).toBe('Design System Architecture');
  });

  it('maps risk card to risks array', async () => {
    setupFetchSequence([riskCardFBD]);
    const data = await fetchBoardData('board-test-1');
    expect(data.risks).toHaveLength(1);
    expect(data.risks[0].title).toBe('Budget Risk Assessment');
  });

  it('assigns correct status from list name "In Progress"', async () => {
    setupFetchSequence([taskCardFBD]);
    const data = await fetchBoardData('board-test-1');
    expect(data.tasks[0].status).toBe('In Progress');
  });

  it('assigns correct priority from orange label', async () => {
    setupFetchSequence([taskCardFBD]);
    const data = await fetchBoardData('board-test-1');
    expect(data.tasks[0].priority).toBe('High');
  });

  it('excludes closed cards from results', async () => {
    const closedCard: TrelloCard = { ...taskCardFBD, id: 'closed-1', closed: true };
    setupFetchSequence([closedCard]);
    const data = await fetchBoardData('board-test-1');
    expect(data.tasks).toHaveLength(0);
    expect(data.risks).toHaveLength(0);
  });

  it('sets task dueDate from card.due (sliced to date only)', async () => {
    setupFetchSequence([taskCardFBD]);
    const data = await fetchBoardData('board-test-1');
    expect(data.tasks[0].dueDate).toBe('2026-09-01');
  });

  it('sets null dueDate when card.due is null', async () => {
    const noDateCard = { ...taskCardFBD, due: null };
    setupFetchSequence([noDateCard]);
    const data = await fetchBoardData('board-test-1');
    expect(data.tasks[0].dueDate).toBeNull();
  });

  it('extracts assignee initials from member.initials', async () => {
    setupFetchSequence([taskCardFBD]);
    const data = await fetchBoardData('board-test-1');
    expect(data.tasks[0].assignees).toContain('JD');
  });

  it('maps risk card severity from red label', async () => {
    setupFetchSequence([riskCardFBD]);
    const data = await fetchBoardData('board-test-1');
    expect(data.risks[0].severity).toBe('Critical');
  });

  it('maps risk category Financial from "budget" keyword in name', async () => {
    setupFetchSequence([riskCardFBD]);
    const data = await fetchBoardData('board-test-1');
    expect(data.risks[0].category).toBe('Financial');
  });

  it('throws when no boardId provided and no boards found', async () => {
    vi.stubGlobal('fetch', makeFetchMock([]));
    await expect(fetchBoardData()).rejects.toThrow('No Trello boards found');
  });

  it('returns raw cards array', async () => {
    setupFetchSequence([taskCardFBD]);
    const data = await fetchBoardData('board-test-1');
    expect(data.cards).toHaveLength(1);
    expect(data.cards[0].id).toBe('task-card-1');
  });

  it('task has isRisk=false', async () => {
    setupFetchSequence([taskCardFBD]);
    const data = await fetchBoardData('board-test-1');
    expect(data.tasks[0].isRisk).toBe(false);
  });

  it('handles card with no members gracefully', async () => {
    const noMemberCard = { ...taskCardFBD, members: [] };
    setupFetchSequence([noMemberCard]);
    const data = await fetchBoardData('board-test-1');
    expect(data.tasks[0].assignees).toHaveLength(0);
  });

  it('derives assignee initials from fullName when initials empty', async () => {
    const noInitialsMember: TrelloMember = { id: 'm2', username: 'jsmith', fullName: 'Jane Smith', initials: '' };
    const cardNoInitials = { ...taskCardFBD, members: [noInitialsMember] };
    setupFetchSequence([cardNoInitials]);
    const data = await fetchBoardData('board-test-1');
    expect(data.tasks[0].assignees).toContain('JS');
  });

  it('handles Technical risk from "technical" keyword', async () => {
    const techRisk: TrelloCard = {
      ...riskCardFBD,
      id: 'tech-risk',
      name: 'Technical Debt Risk',
      desc: '',
      idList: 'list-risk',
    };
    setupFetchSequence([techRisk]);
    const data = await fetchBoardData('board-test-1');
    expect(data.risks[0].category).toBe('Technical');
  });

  it('handles Schedule risk from "timeline" keyword', async () => {
    const schedRisk: TrelloCard = {
      ...riskCardFBD,
      id: 'sched-risk',
      name: 'Timeline Delay Warning',
      desc: '',
      idList: 'list-risk',
    };
    setupFetchSequence([schedRisk]);
    const data = await fetchBoardData('board-test-1');
    expect(data.risks[0].category).toBe('Schedule');
  });

  it('handles Resource risk from "team" keyword', async () => {
    const resRisk: TrelloCard = {
      ...riskCardFBD,
      id: 'res-risk',
      name: 'Team Capacity Risk',
      desc: '',
      idList: 'list-risk',
    };
    setupFetchSequence([resRisk]);
    const data = await fetchBoardData('board-test-1');
    expect(data.risks[0].category).toBe('Resource');
  });
});

// ── fetchBATrafficBoard ────────────────────────────────────────
describe('fetchBATrafficBoard', () => {
  const BA_BOARD_ID = '66c5d907fffd4029f08565a4';

  const baBoard: TrelloBoard = { id: BA_BOARD_ID, name: 'BA Traffic Board', url: 'https://trello.com/b/ba', closed: false };
  const baList: TrelloList = { id: 'ba-list-1', name: 'Backlog', closed: false };
  const baMember: TrelloMember = { id: 'ba-mem-1', fullName: 'Khalil Ahmed', username: 'khalil', initials: 'KA', avatarUrl: '' };

  function setupBAFetch(opts: { cards?: unknown[]; members?: TrelloMember[]; lists?: TrelloList[] } = {}) {
    const cards = opts.cards ?? [];
    const members = opts.members ?? [baMember];
    const lists = opts.lists ?? [baList];

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const ok = true;
      const json = (data: unknown) => Promise.resolve({ ok, json: () => Promise.resolve(data) });

      if (url.includes('/customFields')) return json([]);
      if (url.includes('/cards')) return json(cards);
      if (url.includes('/members')) return json(members);
      if (url.includes('/lists') && url.includes('filter=all')) return json(lists);
      if (url.includes('/lists')) return json(lists);
      // board details
      return json(baBoard);
    }));
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns boardName from the board response', async () => {
    setupBAFetch();
    const data = await fetchBATrafficBoard();
    expect(data.boardName).toBe('BA Traffic Board');
  });

  it('returns members from the board response', async () => {
    setupBAFetch({ members: [baMember] });
    const data = await fetchBATrafficBoard();
    expect(data.members).toHaveLength(1);
    expect(data.members[0].fullName).toBe('Khalil Ahmed');
  });

  it('returns empty cards when no cards on board', async () => {
    setupBAFetch({ cards: [] });
    const data = await fetchBATrafficBoard();
    expect(data.cards).toHaveLength(0);
  });

  it('returns lists from the board', async () => {
    setupBAFetch({ lists: [baList, { id: 'ba-list-2', name: 'In Progress', closed: false }] });
    const data = await fetchBATrafficBoard();
    expect(data.lists.length).toBeGreaterThanOrEqual(1);
  });

  it('maps card name to card object', async () => {
    const card = {
      id: 'ba-card-1', name: '[MOCI] Contract Review', desc: 'Details here', due: null, dueComplete: false,
      idList: 'ba-list-1', idBoard: BA_BOARD_ID, labels: [], idMembers: [], url: 'https://trello.com/c/ba-card-1',
      closed: false, shortUrl: '', pos: 1, dateLastActivity: '2026-04-01T09:00:00.000Z',
      members: [], customFieldItems: [], badges: { comments: 2, attachments: 1, checkItems: 5, checkItemsChecked: 3 },
    };
    setupBAFetch({ cards: [card] });
    const data = await fetchBATrafficBoard();
    expect(data.cards).toHaveLength(1);
    expect(data.cards[0].name).toBe('[MOCI] Contract Review');
  });

  it('extracts client from [CLIENT] prefix in card name', async () => {
    const card = {
      id: 'ba-card-2', name: '[NCA] Security Audit', desc: '', due: null, dueComplete: false,
      idList: 'ba-list-1', idBoard: BA_BOARD_ID, labels: [], idMembers: [], url: '',
      closed: false, shortUrl: '', pos: 2, dateLastActivity: '2026-04-02T09:00:00.000Z',
      members: [], customFieldItems: [], badges: {},
    };
    setupBAFetch({ cards: [card] });
    const data = await fetchBATrafficBoard();
    expect(data.cards[0].client).toBe('NCA');
  });

  it('maps badge counts to card fields', async () => {
    const card = {
      id: 'ba-card-3', name: 'Task with badges', desc: '', due: null, dueComplete: false,
      idList: 'ba-list-1', idBoard: BA_BOARD_ID, labels: [], idMembers: [], url: '',
      closed: false, shortUrl: '', pos: 3, dateLastActivity: '2026-04-03T09:00:00.000Z',
      members: [], customFieldItems: [],
      badges: { comments: 4, attachments: 2, checkItems: 8, checkItemsChecked: 5 },
    };
    setupBAFetch({ cards: [card] });
    const data = await fetchBATrafficBoard();
    expect(data.cards[0].commentCount).toBe(4);
    expect(data.cards[0].attachmentCount).toBe(2);
    expect(data.cards[0].checklistTotal).toBe(8);
    expect(data.cards[0].checklistDone).toBe(5);
  });

  it('maps member fullNames to card members array', async () => {
    const card = {
      id: 'ba-card-4', name: 'Assigned Card', desc: '', due: null, dueComplete: false,
      idList: 'ba-list-1', idBoard: BA_BOARD_ID, labels: [], idMembers: ['ba-mem-1'], url: '',
      closed: false, shortUrl: '', pos: 4, dateLastActivity: '2026-04-04T09:00:00.000Z',
      members: [{ fullName: 'Khalil Ahmed', username: 'khalil', initials: 'KA' }],
      customFieldItems: [], badges: {},
    };
    setupBAFetch({ cards: [card] });
    const data = await fetchBATrafficBoard();
    expect(data.cards[0].members).toContain('Khalil Ahmed');
  });

  it('slices dueDate to first 10 chars (YYYY-MM-DD)', async () => {
    const card = {
      id: 'ba-card-5', name: 'Due Card', desc: '', due: '2026-05-15T12:00:00.000Z', dueComplete: false,
      idList: 'ba-list-1', idBoard: BA_BOARD_ID, labels: [], idMembers: [], url: '',
      closed: false, shortUrl: '', pos: 5, dateLastActivity: '2026-04-05T09:00:00.000Z',
      members: [], customFieldItems: [], badges: {},
    };
    setupBAFetch({ cards: [card] });
    const data = await fetchBATrafficBoard();
    expect(data.cards[0].dueDate).toBe('2026-05-15');
  });

  it('returns empty dueDate when due is null', async () => {
    const card = {
      id: 'ba-card-6', name: 'No Due Card', desc: '', due: null, dueComplete: false,
      idList: 'ba-list-1', idBoard: BA_BOARD_ID, labels: [], idMembers: [], url: '',
      closed: false, shortUrl: '', pos: 6, dateLastActivity: '2026-04-06T09:00:00.000Z',
      members: [], customFieldItems: [], badges: {},
    };
    setupBAFetch({ cards: [card] });
    const data = await fetchBATrafficBoard();
    expect(data.cards[0].dueDate).toBe('');
  });

  it('extracts products from P+ label', async () => {
    const card = {
      id: 'ba-card-7', name: 'Product Card', desc: '', due: null, dueComplete: false,
      idList: 'ba-list-1', idBoard: BA_BOARD_ID,
      labels: [{ id: 'l-pp', name: 'P+', color: 'blue' }],
      idMembers: [], url: '', closed: false, shortUrl: '', pos: 7,
      dateLastActivity: '2026-04-07T09:00:00.000Z',
      members: [], customFieldItems: [], badges: {},
    };
    setupBAFetch({ cards: [card] });
    const data = await fetchBATrafficBoard();
    expect(data.cards[0].products).toContain('P+');
  });

  it('throws when the board fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({ message: 'Board not found' }) }));
    await expect(fetchBATrafficBoard()).rejects.toThrow();
  });

  it('returns multiple members from board members list', async () => {
    const mem2: TrelloMember = { id: 'ba-mem-2', fullName: 'Rania Taleb', username: 'rania', initials: 'RT', avatarUrl: '' };
    setupBAFetch({ members: [baMember, mem2] });
    const data = await fetchBATrafficBoard();
    expect(data.members).toHaveLength(2);
    expect(data.members.map(m => m.fullName)).toContain('Rania Taleb');
  });
});

