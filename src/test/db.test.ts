/**
 * db.ts unit tests — mocks the full Supabase fluent builder chain.
 *
 * Strategy: every method on the builder returns `this` so chains compose
 * freely. The builder is also thenable (await-able) and `.single()` resolves
 * from a shared queue. We push expected results onto the queue before each
 * test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Result queue (populated per-test) ───────────────────────
const resultQueue: Array<{ data: unknown; error: unknown }> = [];
function enqueue(r: { data: unknown; error: unknown }) { resultQueue.push(r); }
function dequeue(): { data: unknown; error: unknown } {
  return resultQueue.shift() ?? { data: null, error: null };
}

// ── Fluent Supabase builder mock ─────────────────────────────
const { mockFrom } = vi.hoisted(() => {
  const resultQueue: Array<{ data: unknown; error: unknown }> = [];

  function deq() { return resultQueue.shift() ?? { data: null, error: null }; }

  function makeBuilder(): any {
    const builder: any = {
      // selection / filter / ordering — all return `this`
      select: () => makeBuilder(),
      order:  () => makeBuilder(),
      eq:     () => makeBuilder(),
      limit:  () => makeBuilder(),
      // mutations — return `this`
      insert: () => makeBuilder(),
      upsert: () => makeBuilder(),
      update: () => makeBuilder(),
      delete: () => makeBuilder(),
      // terminal: single row
      single: () => Promise.resolve(deq()),
      // terminal: list / delete — the builder itself is thenable
      then: (resolve: (v: any) => any, reject?: (e: any) => any) =>
        Promise.resolve(deq()).then(resolve, reject),
      catch: (reject: (e: any) => any) =>
        Promise.resolve(deq()).catch(reject),
    };
    return builder;
  }

  const mockFrom = vi.fn(() => makeBuilder());
  // Expose queue controls on the factory
  (mockFrom as any).__enqueue = (r: any) => resultQueue.push(r);

  return { mockFrom };
});

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

import {
  getWorkspaces, getWorkspace, createWorkspace, updateWorkspace, deleteWorkspace,
  getWorkspaceFinancials, getWorkspaceFinancial, upsertWorkspaceFinancial,
  getWorkspaceRagStatuses, getWorkspaceRagStatus, upsertWorkspaceRagStatus,
  getMilestones, upsertMilestone, deleteMilestone,
  getMeetings, getMeeting, upsertMeeting, updateMeeting, deleteMeeting,
  getDocuments, getDocument, upsertDocument, updateDocument, deleteDocument,
  getTasks, upsertTask, updateTask, deleteTask,
  getRisks, upsertRisk, updateRisk, deleteRisk,
  getReports, upsertReport, deleteReport,
  getActivities, insertActivity,
  getApprovals, upsertApproval, updateApproval,
  getAutomationRuns, insertAutomationRun,
  getUsers, upsertUser, updateUser, deleteUser,
} from '../lib/db';

// Convenience helper
function q(data: unknown, error: unknown = null) {
  (mockFrom as any).__enqueue({ data, error });
}

beforeEach(() => {
  resultQueue.length = 0; // clear if anything left
  vi.clearAllMocks();
});

// ── getWorkspaces ────────────────────────────────────────────
describe('getWorkspaces', () => {
  it('returns rows from supabase', async () => {
    q([{ id: 'ws-1', name: 'Test WS' }]);
    const result = await getWorkspaces();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test WS');
  });

  it('returns [] when data is null', async () => {
    q(null);
    expect(await getWorkspaces()).toEqual([]);
  });

  it('throws on error', async () => {
    q(null, { message: 'DB error', code: '500' });
    await expect(getWorkspaces()).rejects.toMatchObject({ message: 'DB error' });
  });
});

// ── getWorkspace ─────────────────────────────────────────────
describe('getWorkspace (single)', () => {
  it('returns workspace by id', async () => {
    q({ id: 'ws-1', name: 'MOCI' });
    expect((await getWorkspace('ws-1'))?.name).toBe('MOCI');
  });

  it('returns null on PGRST116 (not found)', async () => {
    q(null, { code: 'PGRST116', message: 'Not found' });
    expect(await getWorkspace('missing')).toBeNull();
  });
});

// ── createWorkspace ──────────────────────────────────────────
describe('createWorkspace', () => {
  it('inserts and returns new workspace', async () => {
    q({ id: 'new-id', name: 'New WS' });
    const result = await createWorkspace({ name: 'New WS', type: 'Project', status: 'Active', progress: 0, language: 'EN', sector: 'Gov', contributors: [] });
    expect(result.id).toBe('new-id');
  });

  it('throws on insert error', async () => {
    q(null, { message: 'Unique constraint violation', code: '23505' });
    await expect(createWorkspace({ name: 'Dup', type: 'Project', status: 'Active', progress: 0, language: 'EN', sector: 'Gov', contributors: [] }))
      .rejects.toMatchObject({ message: 'Unique constraint violation' });
  });
});

// ── updateWorkspace ──────────────────────────────────────────
describe('updateWorkspace', () => {
  it('returns updated row', async () => {
    q({ id: 'ws-1', progress: 75 });
    const result = await updateWorkspace('ws-1', { progress: 75 });
    expect(result.progress).toBe(75);
  });
});

// ── getMeetings ──────────────────────────────────────────────
describe('getMeetings', () => {
  it('returns all meetings', async () => {
    q([{ id: 'm1', title: 'Sprint Review' }]);
    expect((await getMeetings())[0].title).toBe('Sprint Review');
  });

  it('returns [] when data is null', async () => {
    q(null);
    expect(await getMeetings()).toEqual([]);
  });
});

// ── upsertMeeting ────────────────────────────────────────────
describe('upsertMeeting', () => {
  it('upserts and returns meeting', async () => {
    q({ id: 'm1', title: 'Kickoff', status: 'Upcoming' });
    const mtg = { id: 'm1', title: 'Kickoff', type: 'Kickoff' as const, date: '2026-03-20', time: '09:00', duration: '1h', workspace: 'MOCI', workspace_id: 'ws-1', location: null, participants: [] as string[], status: 'Upcoming' as const, agenda: null, quorum_status: null as null, minutes_generated: false, actions_extracted: 0, decisions_logged: 0 };
    expect((await upsertMeeting(mtg)).title).toBe('Kickoff');
  });
});

// ── updateMeeting ────────────────────────────────────────────
describe('updateMeeting', () => {
  it('returns updated row', async () => {
    q({ id: 'm1', status: 'Completed' });
    expect((await updateMeeting('m1', { status: 'Completed' })).status).toBe('Completed');
  });
});

// ── deleteMeeting ────────────────────────────────────────────
describe('deleteMeeting', () => {
  it('resolves without value', async () => {
    q(null);
    await expect(deleteMeeting('m1')).resolves.toBeUndefined();
  });

  it('throws on error', async () => {
    q(null, { message: 'FK violation', code: '23503' });
    await expect(deleteMeeting('m1')).rejects.toMatchObject({ message: 'FK violation' });
  });
});

// ── getDocuments ─────────────────────────────────────────────
describe('getDocuments', () => {
  it('returns documents', async () => {
    q([{ id: 'd1', name: 'BRD v1' }]);
    expect((await getDocuments())[0].name).toBe('BRD v1');
  });
});

// ── upsertDocument ───────────────────────────────────────────
describe('upsertDocument', () => {
  it('creates document record', async () => {
    q({ id: 'd1', name: 'Design Doc', status: 'Draft' });
    const doc = { id: 'd1', name: 'Design Doc', type: 'BRD', type_color: '#0EA5E9', workspace: 'NCA', workspace_id: 'ws-1', date: '2026-03-17', language: 'EN' as const, status: 'Draft' as const, size: '2MB', author: 'AK', pages: 0, summary: '', tags: [], file_url: null };
    expect((await upsertDocument(doc)).name).toBe('Design Doc');
  });
});

// ── updateDocument ───────────────────────────────────────────
describe('updateDocument', () => {
  it('returns updated row', async () => {
    q({ id: 'd1', status: 'Final' });
    expect((await updateDocument('d1', { status: 'Final' })).status).toBe('Final');
  });
});

// ── deleteDocument ───────────────────────────────────────────
describe('deleteDocument', () => {
  it('resolves without value', async () => {
    q(null);
    await expect(deleteDocument('d1')).resolves.toBeUndefined();
  });
});

// ── getTasks ─────────────────────────────────────────────────
describe('getTasks', () => {
  it('returns tasks', async () => {
    q([{ id: 't1', title: 'Review BRD' }]);
    expect((await getTasks())[0].title).toBe('Review BRD');
  });
});

// ── upsertTask ───────────────────────────────────────────────
describe('upsertTask', () => {
  it('creates a task', async () => {
    q({ id: 't1', title: 'Draft proposal', status: 'Todo' });
    const task = { id: 't1', title: 'Draft proposal', status: 'Backlog' as const, priority: 'Medium' as const, workspace: 'MOCI', workspace_id: 'ws-1', assignee: '', due_date: '', description: '', linked_doc: null as string | null, linked_meeting: null as string | null };
    expect((await upsertTask(task)).status).toBe('Todo');
  });
});

// ── updateTask ───────────────────────────────────────────────
describe('updateTask', () => {
  it('moves task to Done', async () => {
    q({ id: 't1', status: 'Completed' });
    expect((await updateTask('t1', { status: 'Completed' })).status).toBe('Completed');
  });
});

// ── deleteTask ───────────────────────────────────────────────
describe('deleteTask', () => {
  it('resolves without value', async () => {
    q(null);
    await expect(deleteTask('t1')).resolves.toBeUndefined();
  });
});

// ── getReports ───────────────────────────────────────────────
describe('getReports', () => {
  it('returns reports', async () => {
    q([{ id: 'r1', title: 'Weekly W10' }]);
    expect((await getReports())[0].title).toBe('Weekly W10');
  });
});

// ── upsertReport ─────────────────────────────────────────────
describe('upsertReport', () => {
  it('saves report', async () => {
    q({ id: 'r1', status: 'Generated' });
    const report = { id: 'r1', title: 'Weekly Status Report — W10', type: 'Weekly Status', type_color: '#0EA5E9', workspace: 'All', workspace_id: null, date: '2026-03-17', status: 'Generated' as const, pages: 3, period: 'W10', author: 'Consultant OS AI' };
    expect((await upsertReport(report)).status).toBe('Generated');
  });
});

// ── deleteReport ─────────────────────────────────────────────
describe('deleteReport', () => {
  it('resolves without value', async () => {
    q(null);
    await expect(deleteReport('r1')).resolves.toBeUndefined();
  });
});

// ── getActivities ─────────────────────────────────────────────
describe('getActivities', () => {
  it('returns activities', async () => {
    q([{ id: 'a1', action: 'Report generated' }]);
    expect((await getActivities(10))[0].action).toBe('Report generated');
  });

  it('returns [] when data is null', async () => {
    q(null);
    expect(await getActivities()).toEqual([]);
  });
});

// ── insertActivity ────────────────────────────────────────────
describe('insertActivity', () => {
  it('resolves without value on success', async () => {
    q(null);
    const act = { id: 'a1', user: 'AM', action: 'Created report', target: 'Weekly W10', workspace: 'MOCI', workspace_id: 'ws-1', time: '2m ago', type: 'document' };
    await expect(insertActivity(act)).resolves.toBeUndefined();
  });

  it('throws on error', async () => {
    q(null, { message: 'Insert failed', code: '500' });
    const act = { id: 'a2', user: 'AM', action: 'Created task', target: 'Task 1', workspace: null, workspace_id: null, time: '5m ago', type: 'task' };
    await expect(insertActivity(act)).rejects.toMatchObject({ message: 'Insert failed' });
  });
});

// ── deleteWorkspace ───────────────────────────────────────────
describe('deleteWorkspace', () => {
  it('resolves without value', async () => {
    q(null);
    await expect(deleteWorkspace('ws-1')).resolves.toBeUndefined();
  });

  it('throws on error', async () => {
    q(null, { message: 'Cannot delete workspace', code: '23503' });
    await expect(deleteWorkspace('ws-1')).rejects.toMatchObject({ message: 'Cannot delete workspace' });
  });
});

// ── getWorkspaceFinancials ────────────────────────────────────
describe('getWorkspaceFinancials', () => {
  it('returns all financial rows', async () => {
    q([{ id: 'fin-1', workspace_id: 'ws-1', contract_value: 5000000 }]);
    const result = await getWorkspaceFinancials();
    expect(result).toHaveLength(1);
    expect(result[0].contract_value).toBe(5000000);
  });

  it('returns [] when data is null', async () => {
    q(null);
    expect(await getWorkspaceFinancials()).toEqual([]);
  });
});

// ── getWorkspaceFinancial ─────────────────────────────────────
describe('getWorkspaceFinancial (single)', () => {
  it('returns financial row for workspace', async () => {
    q({ id: 'fin-1', workspace_id: 'ws-1', contract_value: 2500000 });
    const result = await getWorkspaceFinancial('ws-1');
    expect(result?.contract_value).toBe(2500000);
  });

  it('returns null on PGRST116', async () => {
    q(null, { code: 'PGRST116', message: 'Not found' });
    expect(await getWorkspaceFinancial('missing')).toBeNull();
  });

  it('throws on other errors', async () => {
    q(null, { message: 'DB error', code: '500' });
    await expect(getWorkspaceFinancial('ws-1')).rejects.toMatchObject({ message: 'DB error' });
  });
});

// ── upsertWorkspaceFinancial ──────────────────────────────────
describe('upsertWorkspaceFinancial', () => {
  it('upserts and returns financial row', async () => {
    q({ id: 'fin-1', workspace_id: 'ws-1', contract_value: 5000000, spent: 2500000, forecast: 4800000, variance: 200000, currency: 'SAR', billing_model: 'Fixed Fee', last_invoice: '2026-02-28', next_milestone_value: 500000, workspace_name: 'NCA' });
    const fin = { id: 'fin-1', workspace_id: 'ws-1', workspace_name: 'NCA', contract_value: 5000000, spent: 2500000, forecast: 4800000, variance: 200000, currency: 'SAR', billing_model: 'Fixed Fee', last_invoice: '2026-02-28', next_milestone_value: 500000 };
    const result = await upsertWorkspaceFinancial(fin);
    expect(result.contract_value).toBe(5000000);
  });
});

// ── getWorkspaceRagStatuses ───────────────────────────────────
describe('getWorkspaceRagStatuses', () => {
  it('returns all RAG status rows', async () => {
    q([{ id: 'rag-1', workspace_id: 'ws-1', rag: 'Green' }]);
    const result = await getWorkspaceRagStatuses();
    expect(result).toHaveLength(1);
    expect(result[0].rag).toBe('Green');
  });

  it('returns [] when data is null', async () => {
    q(null);
    expect(await getWorkspaceRagStatuses()).toEqual([]);
  });
});

// ── getWorkspaceRagStatus ─────────────────────────────────────
describe('getWorkspaceRagStatus (single)', () => {
  it('returns RAG status for workspace', async () => {
    q({ id: 'rag-1', workspace_id: 'ws-1', rag: 'Amber', budget: 'Red', schedule: 'Green', risk: 'Amber' });
    const result = await getWorkspaceRagStatus('ws-1');
    expect(result?.rag).toBe('Amber');
  });

  it('returns null on PGRST116', async () => {
    q(null, { code: 'PGRST116', message: 'Not found' });
    expect(await getWorkspaceRagStatus('missing')).toBeNull();
  });
});

// ── upsertWorkspaceRagStatus ──────────────────────────────────
describe('upsertWorkspaceRagStatus', () => {
  it('upserts and returns RAG status row', async () => {
    q({ id: 'rag-1', workspace_id: 'ws-1', rag: 'Green', budget: 'Amber', schedule: 'Green', risk: 'Green', last_updated: '2026-03-22' });
    const rag = { id: 'rag-1', workspace_id: 'ws-1', rag: 'Green' as const, budget: 'Amber' as const, schedule: 'Green' as const, risk: 'Green' as const, last_updated: '2026-03-22' };
    const result = await upsertWorkspaceRagStatus(rag);
    expect(result.rag).toBe('Green');
    expect(result.budget).toBe('Amber');
  });

  it('throws on error', async () => {
    q(null, { message: 'Constraint violation', code: '23514' });
    const rag = { id: 'rag-1', workspace_id: 'ws-1', rag: 'Red' as const, budget: 'Red' as const, schedule: 'Red' as const, risk: 'Red' as const, last_updated: '2026-03-22' };
    await expect(upsertWorkspaceRagStatus(rag)).rejects.toMatchObject({ message: 'Constraint violation' });
  });
});

// ── getMilestones ─────────────────────────────────────────────
describe('getMilestones', () => {
  it('returns all milestones', async () => {
    q([{ id: 'ms-1', title: 'Phase 1 Delivery', status: 'On Track' }]);
    const result = await getMilestones();
    expect(result[0].title).toBe('Phase 1 Delivery');
  });

  it('returns milestones filtered by workspace', async () => {
    q([{ id: 'ms-1', workspace_id: 'ws-1', title: 'Phase 1 Delivery' }]);
    const result = await getMilestones('ws-1');
    expect(result[0].workspace_id).toBe('ws-1');
  });

  it('returns [] when data is null', async () => {
    q(null);
    expect(await getMilestones()).toEqual([]);
  });
});

// ── upsertMilestone ───────────────────────────────────────────
describe('upsertMilestone', () => {
  it('upserts and returns milestone', async () => {
    q({ id: 'ms-1', title: 'Phase 1 Delivery', status: 'Completed' });
    const ms = { id: 'ms-1', workspace_id: 'ws-1', title: 'Phase 1 Delivery', due_date: '2026-05-01', status: 'Completed' as const, value: 1000000, owner: 'AM', completion_pct: 100 };
    const result = await upsertMilestone(ms);
    expect(result.status).toBe('Completed');
  });

  it('throws on error', async () => {
    q(null, { message: 'Validation failed', code: '23514' });
    const ms = { id: 'ms-2', workspace_id: 'ws-1', title: 'Phase 2', due_date: '2026-08-01', status: 'On Track' as const, value: 500000, owner: 'RT', completion_pct: 30 };
    await expect(upsertMilestone(ms)).rejects.toMatchObject({ message: 'Validation failed' });
  });
});

// ── deleteMilestone ───────────────────────────────────────────
describe('deleteMilestone', () => {
  it('resolves without value', async () => {
    q(null);
    await expect(deleteMilestone('ms-1')).resolves.toBeUndefined();
  });

  it('throws on error', async () => {
    q(null, { message: 'FK violation', code: '23503' });
    await expect(deleteMilestone('ms-1')).rejects.toMatchObject({ message: 'FK violation' });
  });
});

// ── getMeeting (single) ───────────────────────────────────────
describe('getMeeting (single)', () => {
  it('returns meeting by id', async () => {
    q({ id: 'mtg-1', title: 'Steering Committee Q1' });
    expect((await getMeeting('mtg-1'))?.title).toBe('Steering Committee Q1');
  });

  it('returns null on PGRST116', async () => {
    q(null, { code: 'PGRST116', message: 'Not found' });
    expect(await getMeeting('missing')).toBeNull();
  });

  it('throws on other errors', async () => {
    q(null, { message: 'Connection refused', code: '500' });
    await expect(getMeeting('mtg-1')).rejects.toMatchObject({ message: 'Connection refused' });
  });
});

// ── getDocument (single) ──────────────────────────────────────
describe('getDocument (single)', () => {
  it('returns document by id', async () => {
    q({ id: 'd1', name: 'NCA BRD v2.3' });
    expect((await getDocument('d1'))?.name).toBe('NCA BRD v2.3');
  });

  it('returns null on PGRST116', async () => {
    q(null, { code: 'PGRST116', message: 'Not found' });
    expect(await getDocument('missing')).toBeNull();
  });

  it('throws on other errors', async () => {
    q(null, { message: 'Timeout', code: '500' });
    await expect(getDocument('d1')).rejects.toMatchObject({ message: 'Timeout' });
  });
});

// ── getRisks ─────────────────────────────────────────────────
describe('getRisks', () => {
  it('returns all risks', async () => {
    q([{ id: 'r1', title: 'Vendor Delay', severity: 'High' }]);
    const result = await getRisks();
    expect(result[0].title).toBe('Vendor Delay');
  });

  it('returns risks filtered by workspace', async () => {
    q([{ id: 'r1', workspace_id: 'ws-1', title: 'Budget Risk' }]);
    const result = await getRisks('ws-1');
    expect(result[0].workspace_id).toBe('ws-1');
  });

  it('returns [] when data is null', async () => {
    q(null);
    expect(await getRisks()).toEqual([]);
  });

  it('throws on error', async () => {
    q(null, { message: 'DB error', code: '500' });
    await expect(getRisks()).rejects.toMatchObject({ message: 'DB error' });
  });
});

// ── upsertRisk ───────────────────────────────────────────────
describe('upsertRisk', () => {
  it('upserts and returns risk', async () => {
    q({ id: 'r1', title: 'Vendor Delay', severity: 'High', status: 'Open' });
    const risk = { id: 'r1', title: 'Vendor Delay', workspace: 'NCA', workspace_id: 'ws-1', probability: 3, impact: 4, severity: 'High' as const, status: 'Open' as const, owner: 'AM', mitigation: 'Weekly check-ins', date_identified: '2026-03-01', category: 'Procurement', financial_exposure: 200000 };
    const result = await upsertRisk(risk);
    expect(result.severity).toBe('High');
  });
});

// ── updateRisk ───────────────────────────────────────────────
describe('updateRisk', () => {
  it('returns updated risk row', async () => {
    q({ id: 'r1', status: 'Mitigated' });
    const result = await updateRisk('r1', { status: 'Mitigated' });
    expect(result.status).toBe('Mitigated');
  });

  it('throws on error', async () => {
    q(null, { message: 'Not found', code: 'PGRST116' });
    await expect(updateRisk('missing', { status: 'Closed' })).rejects.toMatchObject({ message: 'Not found' });
  });
});

// ── deleteRisk ───────────────────────────────────────────────
describe('deleteRisk', () => {
  it('resolves without value', async () => {
    q(null);
    await expect(deleteRisk('r1')).resolves.toBeUndefined();
  });

  it('throws on error', async () => {
    q(null, { message: 'Risk in use', code: '23503' });
    await expect(deleteRisk('r1')).rejects.toMatchObject({ message: 'Risk in use' });
  });
});

// ── Additional error/edge cases ───────────────────────────────

describe('updateWorkspace (error)', () => {
  it('throws on update error', async () => {
    q(null, { message: 'Update failed', code: '500' });
    await expect(updateWorkspace('ws-1', { progress: 80 })).rejects.toMatchObject({ message: 'Update failed' });
  });
});

describe('getMeetings (filtered)', () => {
  it('filters meetings by workspace_id when provided', async () => {
    q([{ id: 'm1', title: 'Kickoff', workspace_id: 'ws-1' }]);
    const result = await getMeetings('ws-1');
    expect(result[0].workspace_id).toBe('ws-1');
  });
});

describe('upsertMeeting (error)', () => {
  it('throws on upsert error', async () => {
    q(null, { message: 'Constraint violation', code: '23505' });
    const mtg = { id: 'm1', title: 'Kickoff', type: 'Kickoff' as const, date: '2026-03-20', time: '09:00', duration: '1h', workspace: 'MOCI', workspace_id: 'ws-1', location: null, participants: [] as string[], status: 'Upcoming' as const, agenda: null, quorum_status: null as null, minutes_generated: false, actions_extracted: 0, decisions_logged: 0 };
    await expect(upsertMeeting(mtg)).rejects.toMatchObject({ message: 'Constraint violation' });
  });
});

describe('updateMeeting (error)', () => {
  it('throws on update error', async () => {
    q(null, { message: 'Meeting not found', code: 'PGRST116' });
    await expect(updateMeeting('m-missing', { status: 'Completed' })).rejects.toMatchObject({ message: 'Meeting not found' });
  });
});

describe('getDocuments (edge cases)', () => {
  it('returns [] when data is null', async () => {
    q(null);
    expect(await getDocuments()).toEqual([]);
  });

  it('filters by workspace_id when provided', async () => {
    q([{ id: 'd1', name: 'BRD', workspace_id: 'ws-1' }]);
    const result = await getDocuments('ws-1');
    expect(result[0].workspace_id).toBe('ws-1');
  });
});

describe('upsertDocument (error)', () => {
  it('throws on upsert error', async () => {
    q(null, { message: 'Storage error', code: '500' });
    const doc = { id: 'd1', name: 'Test Doc', type: 'BRD', type_color: '#0EA5E9', workspace: 'NCA', workspace_id: 'ws-1', date: '2026-03-17', language: 'EN' as const, status: 'Draft' as const, size: '2MB', author: 'AK', pages: 0, summary: '', tags: [], file_url: null };
    await expect(upsertDocument(doc)).rejects.toMatchObject({ message: 'Storage error' });
  });
});

describe('updateDocument (error)', () => {
  it('throws on update error', async () => {
    q(null, { message: 'Document locked', code: '403' });
    await expect(updateDocument('d1', { status: 'Final' })).rejects.toMatchObject({ message: 'Document locked' });
  });
});

describe('deleteDocument (error)', () => {
  it('throws on delete error', async () => {
    q(null, { message: 'Document in use', code: '23503' });
    await expect(deleteDocument('d1')).rejects.toMatchObject({ message: 'Document in use' });
  });
});

describe('getTasks (edge cases)', () => {
  it('returns [] when data is null', async () => {
    q(null);
    expect(await getTasks()).toEqual([]);
  });

  it('filters tasks by workspace_id when provided', async () => {
    q([{ id: 't1', title: 'Task A', workspace_id: 'ws-1' }]);
    const result = await getTasks('ws-1');
    expect(result[0].workspace_id).toBe('ws-1');
  });
});

describe('upsertTask (error)', () => {
  it('throws on upsert error', async () => {
    q(null, { message: 'Task conflict', code: '23505' });
    const task = { id: 't1', title: 'Task', status: 'Backlog' as const, priority: 'Medium' as const, workspace: 'MOCI', workspace_id: 'ws-1', assignee: '', due_date: '', description: '', linked_doc: null as string | null, linked_meeting: null as string | null };
    await expect(upsertTask(task)).rejects.toMatchObject({ message: 'Task conflict' });
  });
});

describe('updateTask (error)', () => {
  it('throws on update error', async () => {
    q(null, { message: 'Task not found', code: 'PGRST116' });
    await expect(updateTask('t-missing', { status: 'Completed' })).rejects.toMatchObject({ message: 'Task not found' });
  });
});

describe('deleteTask (error)', () => {
  it('throws on delete error', async () => {
    q(null, { message: 'Task referenced', code: '23503' });
    await expect(deleteTask('t1')).rejects.toMatchObject({ message: 'Task referenced' });
  });
});

describe('getReports (edge cases)', () => {
  it('returns [] when data is null', async () => {
    q(null);
    expect(await getReports()).toEqual([]);
  });

  it('filters by workspace_id when provided', async () => {
    q([{ id: 'r1', title: 'Weekly', workspace_id: 'ws-1' }]);
    const result = await getReports('ws-1');
    expect(result[0].workspace_id).toBe('ws-1');
  });
});

describe('upsertReport (error)', () => {
  it('throws on upsert error', async () => {
    q(null, { message: 'Report conflict', code: '23505' });
    const report = { id: 'r1', title: 'Weekly Status Report — W10', type: 'Weekly Status', type_color: '#0EA5E9', workspace: 'All', workspace_id: null, date: '2026-03-17', status: 'Generated' as const, pages: 3, period: 'W10', author: 'Consultant OS AI' };
    await expect(upsertReport(report)).rejects.toMatchObject({ message: 'Report conflict' });
  });
});

describe('deleteReport (error)', () => {
  it('throws on delete error', async () => {
    q(null, { message: 'Report archived', code: '403' });
    await expect(deleteReport('r1')).rejects.toMatchObject({ message: 'Report archived' });
  });
});

describe('upsertWorkspaceFinancial (error)', () => {
  it('throws on upsert error', async () => {
    q(null, { message: 'Financial conflict', code: '23505' });
    const fin = { id: 'fin-1', workspace_id: 'ws-1', workspace_name: 'NCA', contract_value: 5000000, spent: 2500000, forecast: 4800000, variance: 200000, currency: 'SAR', billing_model: 'Fixed Fee', last_invoice: '2026-02-28', next_milestone_value: 500000 };
    await expect(upsertWorkspaceFinancial(fin)).rejects.toMatchObject({ message: 'Financial conflict' });
  });
});

describe('upsertMilestone (edge case)', () => {
  it('returns milestone with correct title', async () => {
    q({ id: 'ms-2', title: 'Phase 2 Delivery', workspace_id: 'ws-1', status: 'On Track' });
    const ms = { id: 'ms-2', workspace_id: 'ws-1', title: 'Phase 2 Delivery', due_date: '2026-06-01', status: 'On Track' as const, value: 0, owner: 'AM', completion_pct: 0 };
    const result = await upsertMilestone(ms);
    expect(result.title).toBe('Phase 2 Delivery');
  });
});

// ── upsertRisk (error) ────────────────────────────────────────
describe('upsertRisk (error)', () => {
  it('throws on upsert error', async () => {
    q(null, { message: 'Risk conflict', code: '23505' });
    const risk = { id: 'r1', title: 'Vendor Delay', workspace: 'NCA', workspace_id: 'ws-1', probability: 3, impact: 4, severity: 'High' as const, status: 'Open' as const, owner: 'AM', mitigation: '', date_identified: '2026-03-01', category: 'Procurement', financial_exposure: 0 };
    await expect(upsertRisk(risk)).rejects.toMatchObject({ message: 'Risk conflict' });
  });
});

// ── getActivities (with limit) ────────────────────────────────
describe('getActivities (with limit)', () => {
  it('passes limit argument correctly', async () => {
    q([{ id: 'a1', action: 'Created report' }, { id: 'a2', action: 'Uploaded BRD' }]);
    const result = await getActivities(5);
    expect(result.length).toBe(2);
    expect(result[0].action).toBe('Created report');
  });

  it('throws on error', async () => {
    q(null, { message: 'Activities query failed', code: '500' });
    await expect(getActivities(10)).rejects.toMatchObject({ message: 'Activities query failed' });
  });
});

// ── getMilestones (error) ─────────────────────────────────────
describe('getMilestones (error)', () => {
  it('throws on error', async () => {
    q(null, { message: 'Milestone query failed', code: '500' });
    await expect(getMilestones()).rejects.toMatchObject({ message: 'Milestone query failed' });
  });
});

// ── getWorkspaceRagStatus (additional edge case) ──────────────
describe('getWorkspaceRagStatus (additional)', () => {
  it('throws on non-PGRST116 error', async () => {
    q(null, { message: 'RAG query error', code: '500' });
    await expect(getWorkspaceRagStatus('ws-1')).rejects.toMatchObject({ message: 'RAG query error' });
  });
});

// ── getMeeting (additional data check) ───────────────────────
describe('getMeeting (data fields)', () => {
  it('returns meeting with all expected fields', async () => {
    q({ id: 'mtg-1', title: 'Board Review', date: '2026-04-15', time: '10:00', duration: '2h', status: 'Upcoming', workspace: 'NCA' });
    const result = await getMeeting('mtg-1');
    expect(result?.date).toBe('2026-04-15');
    expect(result?.workspace).toBe('NCA');
  });
});

// ── getWorkspace (additional error case) ─────────────────────
describe('getWorkspace (additional)', () => {
  it('throws on non-PGRST116 error', async () => {
    q(null, { message: 'Permission denied', code: '403' });
    await expect(getWorkspace('ws-1')).rejects.toMatchObject({ message: 'Permission denied' });
  });
});

// ── updateMeeting (data check) ────────────────────────────────
describe('updateMeeting (data fields)', () => {
  it('returns meeting with updated minutes_generated flag', async () => {
    q({ id: 'm1', minutes_generated: true, status: 'Completed' });
    const result = await updateMeeting('m1', { minutes_generated: true, status: 'Completed' });
    expect(result.minutes_generated).toBe(true);
    expect(result.status).toBe('Completed');
  });
});

// ── upsertDocument (additional data check) ───────────────────
describe('upsertDocument (data check)', () => {
  it('returns document with file_url set', async () => {
    q({ id: 'd2', name: 'Signed Document', file_url: 'https://storage.example.com/doc.pdf' });
    const doc = { id: 'd2', name: 'Signed Document', type: 'BRD', type_color: '#0EA5E9', workspace: 'NCA', workspace_id: 'ws-1', date: '2026-03-17', language: 'EN' as const, status: 'Draft' as const, size: '1MB', author: 'AK', pages: 0, summary: '', tags: [], file_url: 'https://storage.example.com/doc.pdf' };
    const result = await upsertDocument(doc);
    expect(result.file_url).toBe('https://storage.example.com/doc.pdf');
  });
});

// ── getWorkspaces (multiple rows) ─────────────────────────────
describe('getWorkspaces (multiple rows)', () => {
  it('returns multiple workspace rows', async () => {
    q([
      { id: 'ws-1', name: 'MOCI', status: 'Active' },
      { id: 'ws-2', name: 'NCA', status: 'Active' },
      { id: 'ws-3', name: 'SEC', status: 'On Hold' },
    ]);
    const result = await getWorkspaces();
    expect(result).toHaveLength(3);
    expect(result[1].name).toBe('NCA');
    expect(result[2].status).toBe('On Hold');
  });
});

// ── createWorkspace (data fields) ─────────────────────────────
describe('createWorkspace (data fields)', () => {
  it('returns workspace with sector and type', async () => {
    q({ id: 'ws-4', name: 'ZATCA', sector: 'Finance', type: 'Retainer', status: 'Active', progress: 0 });
    const result = await createWorkspace({ name: 'ZATCA', type: 'Retainer', status: 'Active', progress: 0, language: 'AR', sector: 'Finance', contributors: [] });
    expect(result.sector).toBe('Finance');
    expect(result.type).toBe('Retainer');
  });
});

// ── updateWorkspace (multiple fields) ─────────────────────────
describe('updateWorkspace (multiple fields)', () => {
  it('returns workspace with updated status and progress', async () => {
    q({ id: 'ws-1', status: 'Completed', progress: 100 });
    const result = await updateWorkspace('ws-1', { status: 'Completed', progress: 100 });
    expect(result.status).toBe('Completed');
    expect(result.progress).toBe(100);
  });
});

// ── getMeetings (error) ────────────────────────────────────────
describe('getMeetings (error)', () => {
  it('throws on query error', async () => {
    q(null, { message: 'Meetings fetch failed', code: '500' });
    await expect(getMeetings()).rejects.toMatchObject({ message: 'Meetings fetch failed' });
  });
});

// ── upsertMeeting (data fields) ────────────────────────────────
describe('upsertMeeting (data fields)', () => {
  it('returns meeting with participants and agenda', async () => {
    q({ id: 'm2', title: 'Steering Committee', participants: ['Alice', 'Bob'], agenda: 'Q1 Review', minutes_generated: false });
    const mtg = { id: 'm2', title: 'Steering Committee', type: 'Steering' as const, date: '2026-04-01', time: '14:00', duration: '2h', workspace: 'NCA', workspace_id: 'ws-1', location: 'Room A', participants: ['Alice', 'Bob'], status: 'Upcoming' as const, agenda: 'Q1 Review', quorum_status: null as null, minutes_generated: false, actions_extracted: 0, decisions_logged: 0 };
    const result = await upsertMeeting(mtg);
    expect(result.participants).toHaveLength(2);
    expect(result.agenda).toBe('Q1 Review');
  });
});

// ── getDocuments (error) ───────────────────────────────────────
describe('getDocuments (error)', () => {
  it('throws on query error', async () => {
    q(null, { message: 'Documents fetch failed', code: '500' });
    await expect(getDocuments()).rejects.toMatchObject({ message: 'Documents fetch failed' });
  });
});

// ── updateDocument (multiple fields) ──────────────────────────
describe('updateDocument (multiple fields)', () => {
  it('returns document with updated status and pages', async () => {
    q({ id: 'd1', status: 'Final', pages: 42, language: 'AR' });
    const result = await updateDocument('d1', { status: 'Final', pages: 42 });
    expect(result.pages).toBe(42);
    expect(result.language).toBe('AR');
  });
});

// ── getTasks (error) ───────────────────────────────────────────
describe('getTasks (error)', () => {
  it('throws on query error', async () => {
    q(null, { message: 'Tasks fetch failed', code: '500' });
    await expect(getTasks()).rejects.toMatchObject({ message: 'Tasks fetch failed' });
  });
});

// ── upsertTask (data fields) ───────────────────────────────────
describe('upsertTask (data fields)', () => {
  it('returns task with priority and assignee', async () => {
    q({ id: 't2', title: 'Prepare BRD', priority: 'High', assignee: 'Sara', due_date: '2026-04-15' });
    const task = { id: 't2', title: 'Prepare BRD', status: 'In Progress' as const, priority: 'High' as const, workspace: 'NCA', workspace_id: 'ws-1', assignee: 'Sara', due_date: '2026-04-15', description: 'Draft BRD v1', linked_doc: null as string | null, linked_meeting: null as string | null };
    const result = await upsertTask(task);
    expect(result.priority).toBe('High');
    expect(result.assignee).toBe('Sara');
    expect(result.due_date).toBe('2026-04-15');
  });
});

// ── updateTask (data fields) ───────────────────────────────────
describe('updateTask (data fields)', () => {
  it('returns task with updated priority and assignee', async () => {
    q({ id: 't1', priority: 'Critical', assignee: 'Khaled', status: 'In Progress' });
    const result = await updateTask('t1', { priority: 'Critical', assignee: 'Khaled' });
    expect(result.priority).toBe('Critical');
    expect(result.assignee).toBe('Khaled');
  });
});

// ── getReports (error) ────────────────────────────────────────
describe('getReports (error)', () => {
  it('throws on query error', async () => {
    q(null, { message: 'Reports fetch failed', code: '500' });
    await expect(getReports()).rejects.toMatchObject({ message: 'Reports fetch failed' });
  });
});

// ── upsertReport (data fields) ────────────────────────────────
describe('upsertReport (data fields)', () => {
  it('returns report with period, type, and author', async () => {
    q({ id: 'r2', title: 'Board Pack Q1', type: 'Board Pack', period: 'Q1-2026', author: 'Ahmed Khalil', pages: 15 });
    const report = { id: 'r2', title: 'Board Pack Q1', type: 'Board Pack', type_color: '#7C3AED', workspace: 'All', workspace_id: null, date: '2026-03-31', status: 'Generated' as const, pages: 15, period: 'Q1-2026', author: 'Ahmed Khalil' };
    const result = await upsertReport(report);
    expect(result.period).toBe('Q1-2026');
    expect(result.author).toBe('Ahmed Khalil');
    expect(result.pages).toBe(15);
  });
});

// ── deleteReport (error) ──────────────────────────────────────
describe('deleteReport (error cases)', () => {
  it('throws on permission denied error', async () => {
    q(null, { message: 'Permission denied', code: '403' });
    await expect(deleteReport('r2')).rejects.toMatchObject({ message: 'Permission denied' });
  });
});

// ── getWorkspaceFinancials (error) ────────────────────────────
describe('getWorkspaceFinancials (error)', () => {
  it('throws on query error', async () => {
    q(null, { message: 'Financials fetch failed', code: '500' });
    await expect(getWorkspaceFinancials()).rejects.toMatchObject({ message: 'Financials fetch failed' });
  });
});

// ── getWorkspaceFinancials (multiple rows) ────────────────────
describe('getWorkspaceFinancials (multiple rows)', () => {
  it('returns multiple financial rows with spent/forecast fields', async () => {
    q([
      { id: 'fin-1', workspace_id: 'ws-1', contract_value: 5000000, spent: 2500000, forecast: 4800000 },
      { id: 'fin-2', workspace_id: 'ws-2', contract_value: 3000000, spent: 1800000, forecast: 2900000 },
    ]);
    const result = await getWorkspaceFinancials();
    expect(result).toHaveLength(2);
    expect(result[0].spent).toBe(2500000);
    expect(result[1].forecast).toBe(2900000);
  });
});

// ── upsertWorkspaceFinancial (data fields) ────────────────────
describe('upsertWorkspaceFinancial (data fields)', () => {
  it('returns financial row with billing_model and currency', async () => {
    q({ id: 'fin-2', workspace_id: 'ws-2', billing_model: 'T&M', currency: 'USD', contract_value: 3000000 });
    const fin = { id: 'fin-2', workspace_id: 'ws-2', workspace_name: 'SEC', contract_value: 3000000, spent: 1200000, forecast: 2800000, variance: 200000, currency: 'USD', billing_model: 'T&M', last_invoice: '2026-03-01', next_milestone_value: 300000 };
    const result = await upsertWorkspaceFinancial(fin);
    expect(result.billing_model).toBe('T&M');
    expect(result.currency).toBe('USD');
  });
});

// ── getWorkspaceRagStatuses (error) ───────────────────────────
describe('getWorkspaceRagStatuses (error)', () => {
  it('throws on query error', async () => {
    q(null, { message: 'RAG statuses fetch failed', code: '500' });
    await expect(getWorkspaceRagStatuses()).rejects.toMatchObject({ message: 'RAG statuses fetch failed' });
  });
});

// ── getWorkspaceRagStatuses (multiple rows) ───────────────────
describe('getWorkspaceRagStatuses (multiple rows)', () => {
  it('returns multiple RAG statuses with correct colors', async () => {
    q([
      { id: 'rag-1', workspace_id: 'ws-1', rag: 'Green', budget: 'Amber', schedule: 'Green', risk: 'Green' },
      { id: 'rag-2', workspace_id: 'ws-2', rag: 'Red', budget: 'Red', schedule: 'Amber', risk: 'Red' },
    ]);
    const result = await getWorkspaceRagStatuses();
    expect(result).toHaveLength(2);
    expect(result[0].rag).toBe('Green');
    expect(result[1].rag).toBe('Red');
    expect(result[1].budget).toBe('Red');
  });
});

// ── upsertWorkspaceRagStatus (data fields) ───────────────────
describe('upsertWorkspaceRagStatus (data fields)', () => {
  it('returns updated RAG with all four color dimensions', async () => {
    q({ id: 'rag-3', workspace_id: 'ws-3', rag: 'Amber', budget: 'Green', schedule: 'Red', risk: 'Amber', last_updated: '2026-03-23' });
    const rag = { id: 'rag-3', workspace_id: 'ws-3', rag: 'Amber' as const, budget: 'Green' as const, schedule: 'Red' as const, risk: 'Amber' as const, last_updated: '2026-03-23' };
    const result = await upsertWorkspaceRagStatus(rag);
    expect(result.schedule).toBe('Red');
    expect(result.risk).toBe('Amber');
    expect(result.last_updated).toBe('2026-03-23');
  });
});

// ── getMilestones (multiple rows) ─────────────────────────────
describe('getMilestones (multiple rows)', () => {
  it('returns multiple milestones with status and value', async () => {
    q([
      { id: 'ms-1', title: 'Phase 1', status: 'Completed', value: 1000000, completion_pct: 100 },
      { id: 'ms-2', title: 'Phase 2', status: 'On Track', value: 500000, completion_pct: 40 },
      { id: 'ms-3', title: 'Phase 3', status: 'At Risk', value: 750000, completion_pct: 10 },
    ]);
    const result = await getMilestones();
    expect(result).toHaveLength(3);
    expect(result[0].completion_pct).toBe(100);
    expect(result[2].status).toBe('At Risk');
  });
});

// ── upsertMilestone (data fields) ─────────────────────────────
describe('upsertMilestone (data fields)', () => {
  it('returns milestone with value and completion_pct', async () => {
    q({ id: 'ms-3', title: 'Go Live', value: 750000, completion_pct: 75, owner: 'AK', due_date: '2026-07-01' });
    const ms = { id: 'ms-3', workspace_id: 'ws-1', title: 'Go Live', due_date: '2026-07-01', status: 'On Track' as const, value: 750000, owner: 'AK', completion_pct: 75 };
    const result = await upsertMilestone(ms);
    expect(result.value).toBe(750000);
    expect(result.completion_pct).toBe(75);
    expect(result.owner).toBe('AK');
  });
});

// ── getRisks (multiple rows) ───────────────────────────────────
describe('getRisks (multiple rows)', () => {
  it('returns risks with probability, impact, financial_exposure', async () => {
    q([
      { id: 'r1', title: 'Vendor Delay', severity: 'High', probability: 4, impact: 5, financial_exposure: 500000 },
      { id: 'r2', title: 'Budget Overrun', severity: 'Critical', probability: 3, impact: 5, financial_exposure: 1000000 },
    ]);
    const result = await getRisks();
    expect(result).toHaveLength(2);
    expect(result[0].probability).toBe(4);
    expect(result[1].financial_exposure).toBe(1000000);
    expect(result[1].severity).toBe('Critical');
  });
});

// ── upsertRisk (data fields) ───────────────────────────────────
describe('upsertRisk (data fields)', () => {
  it('returns risk with all fields populated', async () => {
    q({ id: 'r2', title: 'Budget Overrun', category: 'Financial', mitigation: 'Monthly budget review', owner: 'CFO', probability: 3, impact: 5 });
    const risk = { id: 'r2', title: 'Budget Overrun', workspace: 'NCA', workspace_id: 'ws-1', probability: 3, impact: 5, severity: 'Critical' as const, status: 'Open' as const, owner: 'CFO', mitigation: 'Monthly budget review', date_identified: '2026-02-01', category: 'Financial', financial_exposure: 1000000 };
    const result = await upsertRisk(risk);
    expect(result.category).toBe('Financial');
    expect(result.mitigation).toBe('Monthly budget review');
    expect(result.owner).toBe('CFO');
  });
});

// ── updateRisk (data fields) ───────────────────────────────────
describe('updateRisk (data fields)', () => {
  it('returns risk with updated probability and impact', async () => {
    q({ id: 'r1', probability: 2, impact: 3, severity: 'Medium' });
    const result = await updateRisk('r1', { probability: 2, impact: 3 });
    expect(result.probability).toBe(2);
    expect(result.impact).toBe(3);
    expect(result.severity).toBe('Medium');
  });
});

// ── getActivities (no limit) ───────────────────────────────────
describe('getActivities (no limit)', () => {
  it('works without a limit argument', async () => {
    q([{ id: 'a3', action: 'Updated risk', user: 'AK' }]);
    const result = await getActivities();
    expect(result[0].action).toBe('Updated risk');
    expect(result[0].user).toBe('AK');
  });
});

// ── insertActivity (data fields) ──────────────────────────────
describe('insertActivity (data fields)', () => {
  it('handles activity with null workspace_id', async () => {
    q(null);
    const act = { id: 'a5', user: 'System', action: 'Auto-generated report', target: 'Board Pack Q1', workspace: null, workspace_id: null, time: '1m ago', type: 'report' };
    await expect(insertActivity(act)).resolves.toBeUndefined();
  });

  it('handles activity with all fields populated', async () => {
    q(null);
    const act = { id: 'a6', user: 'Ahmed Khalil', action: 'Created milestone', target: 'Phase 3 Go Live', workspace: 'NCA', workspace_id: 'ws-1', time: '3m ago', type: 'milestone' };
    await expect(insertActivity(act)).resolves.toBeUndefined();
  });
});

// ── getMeetings (multiple rows) ────────────────────────────────
describe('getMeetings (multiple rows)', () => {
  it('returns multiple meetings with different statuses', async () => {
    q([
      { id: 'm1', title: 'Sprint Review', status: 'Completed', workspace_id: 'ws-1' },
      { id: 'm2', title: 'Kickoff', status: 'Upcoming', workspace_id: 'ws-2' },
      { id: 'm3', title: 'Steering Committee', status: 'In Progress', workspace_id: 'ws-1' },
    ]);
    const result = await getMeetings();
    expect(result).toHaveLength(3);
    expect(result[0].status).toBe('Completed');
    expect(result[2].title).toBe('Steering Committee');
  });
});

// ── updateMeeting (actions_extracted and decisions_logged) ────
describe('updateMeeting (action counts)', () => {
  it('returns meeting with actions_extracted and decisions_logged updated', async () => {
    q({ id: 'm1', actions_extracted: 5, decisions_logged: 3, minutes_generated: true });
    const result = await updateMeeting('m1', { actions_extracted: 5, decisions_logged: 3, minutes_generated: true });
    expect(result.actions_extracted).toBe(5);
    expect(result.decisions_logged).toBe(3);
  });
});

// ── getDocument (data fields) ─────────────────────────────────
describe('getDocument (data fields)', () => {
  it('returns document with tags and summary', async () => {
    q({ id: 'd3', name: 'Strategy Doc', tags: ['BRD', 'Phase 1', 'NCA'], summary: 'Executive summary of strategy', language: 'EN', pages: 24 });
    const result = await getDocument('d3');
    expect(result?.tags).toHaveLength(3);
    expect(result?.summary).toBe('Executive summary of strategy');
    expect(result?.pages).toBe(24);
  });
});

// ── getWorkspace (data fields) ────────────────────────────────
describe('getWorkspace (data fields)', () => {
  it('returns workspace with contributors array and language', async () => {
    q({ id: 'ws-1', name: 'NCA', language: 'AR', contributors: ['AK', 'RT', 'SA'], sector: 'Gov', type: 'Project' });
    const result = await getWorkspace('ws-1');
    expect(result?.contributors).toHaveLength(3);
    expect(result?.language).toBe('AR');
    expect(result?.sector).toBe('Gov');
  });
});

// ── getWorkspaces edge cases ──────────────────────────────────
describe('getWorkspaces (edge cases)', () => {
  it('returns multiple workspaces', async () => {
    q([{ id: 'ws-1', name: 'NCA' }, { id: 'ws-2', name: 'MOCI' }, { id: 'ws-3', name: 'ADNOC' }]);
    const result = await getWorkspaces();
    expect(result).toHaveLength(3);
    expect(result[1].name).toBe('MOCI');
  });

  it('returns empty array when data is empty array', async () => {
    q([]);
    const result = await getWorkspaces();
    expect(result).toHaveLength(0);
  });
});

// ── getMeetings edge cases ─────────────────────────────────────
describe('getMeetings (edge cases)', () => {
  it('returns empty array when no meetings', async () => {
    q([]);
    const result = await getMeetings();
    expect(result).toHaveLength(0);
  });

  it('returns meetings with correct status field', async () => {
    q([
      { id: 'm1', title: 'Budget Review', status: 'Completed' },
      { id: 'm2', title: 'Kickoff', status: 'Upcoming' },
    ]);
    const result = await getMeetings();
    expect(result[0].status).toBe('Completed');
    expect(result[1].status).toBe('Upcoming');
  });

  it('throws on DB error', async () => {
    q(null, { message: 'Connection timeout', code: '500' });
    await expect(getMeetings()).rejects.toMatchObject({ message: 'Connection timeout' });
  });
});

// ── getDocuments edge cases ────────────────────────────────────
describe('getDocuments (edge cases)', () => {
  it('returns empty array when no documents', async () => {
    q([]);
    const result = await getDocuments();
    expect(result).toHaveLength(0);
  });

  it('returns documents with correct type field', async () => {
    q([
      { id: 'd1', name: 'NCA BRD', type: 'BRD' },
      { id: 'd2', name: 'Sprint Minutes', type: 'Meeting Minutes' },
    ]);
    const result = await getDocuments();
    expect(result[0].type).toBe('BRD');
    expect(result[1].type).toBe('Meeting Minutes');
  });

  it('throws on DB error', async () => {
    q(null, { message: 'Table not found', code: 'PGRST204' });
    await expect(getDocuments()).rejects.toMatchObject({ message: 'Table not found' });
  });
});

// ── getTasks edge cases ────────────────────────────────────────
describe('getTasks (edge cases)', () => {
  it('returns tasks with priority field', async () => {
    q([
      { id: 't1', title: 'Review BRD', priority: 'High' },
      { id: 't2', title: 'Update Risk Register', priority: 'Medium' },
    ]);
    const result = await getTasks();
    expect(result[0].priority).toBe('High');
    expect(result[1].priority).toBe('Medium');
  });

  it('returns empty array when no tasks', async () => {
    q([]);
    expect(await getTasks()).toHaveLength(0);
  });
});

// ── getRisks edge cases ────────────────────────────────────────
describe('getRisks (edge cases)', () => {
  it('returns risks with probability and impact', async () => {
    q([{ id: 'r1', title: 'Budget Overrun', probability: 'High', impact: 'Critical' }]);
    const result = await getRisks();
    expect(result[0].probability).toBe('High');
    expect(result[0].impact).toBe('Critical');
  });

  it('returns empty array when no risks', async () => {
    q([]);
    expect(await getRisks()).toHaveLength(0);
  });
});

// ── upsertWorkspaceRagStatus edge cases ───────────────────────
describe('upsertWorkspaceRagStatus (edge cases)', () => {
  it('returns updated RAG status', async () => {
    q({ id: 'rag-1', workspace_id: 'ws-1', budget: 'Green', schedule: 'Amber', risk: 'Red', overall: 'Amber' });
    const result = await upsertWorkspaceRagStatus({ id: 'rag-1', workspace_id: 'ws-1', budget: 'Green', schedule: 'Amber', risk: 'Red', overall: 'Amber', created_at: '', updated_at: '' });
    expect(result.budget).toBe('Green');
    expect(result.risk).toBe('Red');
  });
});

// ── deleteTask / deleteRisk / deleteMilestone ──────────────────
describe('deleteTask', () => {
  it('resolves successfully', async () => {
    q(null);
    await expect(deleteTask('t1')).resolves.toBeUndefined();
  });
});

describe('deleteRisk', () => {
  it('resolves successfully', async () => {
    q(null);
    await expect(deleteRisk('r1')).resolves.toBeUndefined();
  });
});

describe('deleteMilestone', () => {
  it('resolves successfully', async () => {
    q(null);
    await expect(deleteMilestone('ms1')).resolves.toBeUndefined();
  });
});

describe('deleteReport', () => {
  it('resolves successfully', async () => {
    q(null);
    await expect(deleteReport('rep1')).resolves.toBeUndefined();
  });
});

// ── getMeeting single ────────────────────────────────────────
describe('getMeeting (single)', () => {
  it('returns meeting by id', async () => {
    q({ id: 'm-1', title: 'Sprint Review', status: 'Upcoming', type: 'Review', date: '2026-03-20', time: '09:00', duration: '1h', workspace: 'MOCI', workspace_id: 'ws-1', participants: ['AM'], minutes_generated: false, actions_extracted: 0, decisions_logged: 0 });
    const result = await getMeeting('m-1');
    expect(result?.title).toBe('Sprint Review');
  });

  it('returns null for PGRST116', async () => {
    q(null, { code: 'PGRST116', message: 'Not found' });
    expect(await getMeeting('missing')).toBeNull();
  });
});

// ── upsertMeeting ────────────────────────────────────────────
describe('upsertMeeting', () => {
  it('returns created meeting', async () => {
    const meeting = { id: 'm-2', title: 'Kickoff', status: 'Upcoming' as const, type: 'Kickoff' as const, date: '2026-04-01', time: '10:00', duration: '1h', workspace: 'NCA', workspace_id: 'ws-2', participants: [], minutes_generated: false, actions_extracted: 0, decisions_logged: 0, agenda: null, quorum_status: null, location: null };
    q(meeting);
    const result = await upsertMeeting(meeting);
    expect(result.title).toBe('Kickoff');
  });
});

// ── updateMeeting ────────────────────────────────────────────
describe('updateMeeting', () => {
  it('returns updated meeting with new status', async () => {
    q({ id: 'm-1', title: 'Sprint Review', status: 'Completed', type: 'Review' as const, date: '2026-03-20', time: '09:00', duration: '1h', workspace: 'MOCI', workspace_id: 'ws-1', participants: [], minutes_generated: false, actions_extracted: 0, decisions_logged: 0 });
    const result = await updateMeeting('m-1', { status: 'Completed' });
    expect(result.status).toBe('Completed');
  });
});

// ── getActivities ────────────────────────────────────────────
describe('getActivities', () => {
  it('returns list of activities', async () => {
    q([{ id: 'act-1', action: 'Document uploaded', workspace_id: 'ws-1', created_at: '2026-03-20T10:00:00Z', user_id: null }]);
    const result = await getActivities('ws-1');
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('Document uploaded');
  });

  it('returns empty array when no activities', async () => {
    q([]);
    const result = await getActivities('ws-empty');
    expect(result).toEqual([]);
  });
});

// ── insertActivity ────────────────────────────────────────────
describe('insertActivity', () => {
  it('resolves successfully without throwing', async () => {
    q(null);
    await expect(insertActivity({ action: 'Meeting created', workspace_id: 'ws-1' })).resolves.toBeUndefined();
  });
});

// ── getDocument ──────────────────────────────────────────────
describe('getDocument', () => {
  it('returns document by id', async () => {
    q({ id: 'doc-1', name: 'NCA BRD', type: 'BRD', workspace: 'NCA', workspace_id: 'ws-1', status: 'Final', date: '2026-03-10', language: 'EN', author: 'AM', pages: 24, size: '2.4MB', tags: [], summary: 'Summary' });
    const result = await getDocument('doc-1');
    expect(result?.name).toBe('NCA BRD');
  });

  it('returns null for not found', async () => {
    q(null, { code: 'PGRST116', message: 'Not found' });
    expect(await getDocument('missing-id')).toBeNull();
  });
});

// ── upsertDocument ───────────────────────────────────────────
describe('upsertDocument', () => {
  it('returns created document', async () => {
    q({ id: 'doc-new', name: 'Meeting Minutes', type: 'Meeting Minutes' });
    const result = await upsertDocument({ id: 'doc-new', name: 'Meeting Minutes', type: 'Meeting Minutes', type_color: '#10B981', workspace: 'NCA', workspace_id: 'ws-1', status: 'Draft', date: '2026-04-01', language: 'EN', author: 'AI', pages: 1, size: '50 KB', tags: [], summary: 'Auto-generated', file_url: null });
    expect(result.name).toBe('Meeting Minutes');
  });
});

// ── updateDocument ───────────────────────────────────────────
describe('updateDocument', () => {
  it('returns updated document status', async () => {
    q({ id: 'doc-1', name: 'NCA BRD', status: 'Final', type: 'BRD' });
    const result = await updateDocument('doc-1', { status: 'Final' });
    expect(result.status).toBe('Final');
  });
});

// ── upsertTask ───────────────────────────────────────────────
describe('upsertTask', () => {
  it('returns created task', async () => {
    q({ id: 'task-new', title: 'Review BRD', priority: 'High', status: 'In Progress', workspace: 'NCA', workspace_id: 'ws-1', due_date: null, description: '', owner: 'AM', tags: [] });
    const result = await upsertTask({ id: 'task-new', title: 'Review BRD', priority: 'High', status: 'In Progress', workspace: 'NCA', workspace_id: 'ws-1', due_date: null, description: '', owner: 'AM', tags: [] });
    expect(result.title).toBe('Review BRD');
  });
});

// ── upsertRisk ───────────────────────────────────────────────
describe('upsertRisk', () => {
  it('returns created risk', async () => {
    q({ id: 'risk-new', title: 'Vendor Delay', severity: 'High', status: 'Open', workspace: 'NCA', workspace_id: 'ws-1', category: 'Vendor', probability: 3, impact: 4, mitigation: '' });
    const result = await upsertRisk({ id: 'risk-new', title: 'Vendor Delay', severity: 'High', status: 'Open', workspace: 'NCA', workspace_id: 'ws-1', category: 'Vendor', probability: 3, impact: 4, mitigation: '' });
    expect(result.title).toBe('Vendor Delay');
  });
});

// ── getReports ───────────────────────────────────────────────
describe('getReports (additional)', () => {
  it('returns reports with workspace field', async () => {
    q([{ id: 'rep-1', title: 'Monthly Report', workspace: 'NCA', workspace_id: 'ws-1', type: 'Status Report', status: 'Final', generated_at: '2026-03-15T00:00:00Z', content: '' }]);
    const result = await getReports();
    expect(result[0].workspace).toBe('NCA');
  });
});

// ── upsertReport ─────────────────────────────────────────────
describe('upsertReport', () => {
  it('returns created report', async () => {
    q({ id: 'rep-new', title: 'Q1 Report', type: 'Status Report', status: 'Draft', workspace: 'NCA', workspace_id: 'ws-1', generated_at: '2026-03-20T00:00:00Z', content: '' });
    const result = await upsertReport({ id: 'rep-new', title: 'Q1 Report', type: 'Status Report', status: 'Draft', workspace: 'NCA', workspace_id: 'ws-1', generated_at: '2026-03-20T00:00:00Z', content: '' });
    expect(result.title).toBe('Q1 Report');
  });
});

// ── deleteReport ─────────────────────────────────────────────
describe('deleteReport', () => {
  it('resolves without error on success', async () => {
    q(null);
    await expect(deleteReport('rep-1')).resolves.toBeUndefined();
  });
});

// ── getDocument (additional) ─────────────────────────────────
describe('getDocument (additional)', () => {
  it('returns document with pages field', async () => {
    q({ id: 'd1', name: 'BRD', pages: 24, workspace: 'NCA', workspace_id: 'ws-1', type: 'BRD', status: 'Draft', language: 'EN', author: 'AM', date: '2026-03-15', size: '2MB', created_at: '', updated_at: '', tags: [], summary: '' });
    const result = await getDocument('d1');
    expect(result?.pages).toBe(24);
  });
});

// ── updateTask (additional) ──────────────────────────────────
describe('updateTask (additional)', () => {
  it('returns updated task with new status', async () => {
    q({ id: 'task-1', title: 'Design Review', status: 'Completed', workspace_id: 'ws-1', workspace: 'NCA', priority: 'High', assignee: 'AM', due_date: null, document_ids: [] });
    const result = await updateTask('task-1', { status: 'Completed' });
    expect(result.status).toBe('Completed');
  });
});

// ── deleteTask (additional) ──────────────────────────────────
describe('deleteTask (additional)', () => {
  it('resolves without error on successful delete', async () => {
    q(null);
    await expect(deleteTask('task-1')).resolves.toBeUndefined();
  });
});

// ── getTasks (additional) ────────────────────────────────────
describe('getTasks (additional)', () => {
  it('returns tasks with priority field', async () => {
    q([{ id: 'task-1', title: 'Design Review', status: 'In Progress', workspace_id: 'ws-1', workspace: 'NCA', priority: 'High', assignee: 'AM', due_date: null, document_ids: [] }]);
    const result = await getTasks();
    expect(result[0].priority).toBe('High');
  });
});

// ── getMeeting (additional) ──────────────────────────────────
describe('getMeeting (additional)', () => {
  it('returns meeting with participants', async () => {
    q({ id: 'm1', title: 'Kickoff Meeting', date: '2026-03-20', time: '09:00', duration: '1h', type: 'Review', status: 'Upcoming', participants: ['Ahmed', 'Rania'], workspace: 'NCA', workspace_id: 'ws-1', location: null, minutes_generated: false, actions_extracted: 0, decisions_logged: 0, agenda: null, created_at: '', updated_at: '' });
    const result = await getMeeting('m1');
    expect(result?.participants).toEqual(['Ahmed', 'Rania']);
  });
});

// ── upsertTask (additional) ──────────────────────────────────
describe('upsertTask (additional)', () => {
  it('returns created task with workspace field', async () => {
    q({ id: 'task-2', title: 'Architecture Design', status: 'Backlog', workspace_id: 'ws-1', workspace: 'MOCI', priority: 'Medium', assignee: 'RT', due_date: null, document_ids: [] });
    const result = await upsertTask({ id: 'task-2', title: 'Architecture Design', status: 'Backlog', workspace_id: 'ws-1', workspace: 'MOCI', priority: 'Medium', assignee: 'RT', due_date: null, document_ids: [] });
    expect(result.workspace).toBe('MOCI');
  });
});

// ── getWorkspaceRagStatuses (additional) ─────────────────────
describe('getWorkspaceRagStatuses (additional)', () => {
  it('returns rag status with all color fields', async () => {
    q([{ id: 'rag-1', workspace_id: 'ws-1', rag: 'Green', schedule: 'Green', budget: 'Amber', scope: 'Green', risk: 'Red', updated_by: 'AM', updated_at: '2026-03-15T00:00:00Z' }]);
    const result = await getWorkspaceRagStatuses();
    expect(result[0].budget).toBe('Amber');
  });
});

// ── getApprovals ─────────────────────────────────────────────
describe('getApprovals', () => {
  it('returns approval rows', async () => {
    q([{ id: 'apr-1', title: 'NCA BRD', requester: 'AM', type: 'Document Approval', urgency: 'High', status: 'pending', created_at: '', updated_at: '' }]);
    const result = await getApprovals();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('NCA BRD');
  });

  it('returns empty array when no approvals', async () => {
    q([]);
    const result = await getApprovals();
    expect(result).toEqual([]);
  });

  it('throws when supabase returns error', async () => {
    q(null, { message: 'DB error' });
    await expect(getApprovals()).rejects.toMatchObject({ message: 'DB error' });
  });
});

// ── upsertApproval ───────────────────────────────────────────
describe('upsertApproval', () => {
  it('returns upserted approval row', async () => {
    q({ id: 'apr-1', title: 'Budget Approval', requester: 'RT', type: 'Budget', urgency: 'High', status: 'pending', created_at: '', updated_at: '' });
    const result = await upsertApproval({ id: 'apr-1', title: 'Budget Approval', requester: 'RT', type: 'Budget', urgency: 'High', status: 'pending' });
    expect(result.title).toBe('Budget Approval');
  });
});

// ── updateApproval ───────────────────────────────────────────
describe('updateApproval', () => {
  it('returns updated approval with new status', async () => {
    q({ id: 'apr-1', title: 'NCA BRD', requester: 'AM', type: 'Document', urgency: 'High', status: 'approved', created_at: '', updated_at: '' });
    const result = await updateApproval('apr-1', { status: 'approved' });
    expect(result.status).toBe('approved');
  });
});

// ── getAutomationRuns ─────────────────────────────────────────
describe('getAutomationRuns', () => {
  it('returns automation run rows', async () => {
    q([{ id: 'run-1', automation_id: 'auto-001', automation_name: 'BRD Generator', status: 'success', duration_ms: 3000, run_at: '2026-03-25T09:00:00Z', created_at: '' }]);
    const result = await getAutomationRuns();
    expect(result).toHaveLength(1);
    expect(result[0].automation_name).toBe('BRD Generator');
  });

  it('filters by automation_id when provided', async () => {
    q([{ id: 'run-2', automation_id: 'auto-002', automation_name: 'Meeting Summarizer', status: 'success', duration_ms: 2500, run_at: '2026-03-25T10:00:00Z', created_at: '' }]);
    const result = await getAutomationRuns('auto-002');
    expect(result[0].automation_id).toBe('auto-002');
  });

  it('returns empty array when no runs', async () => {
    q([]);
    const result = await getAutomationRuns();
    expect(result).toEqual([]);
  });
});

// ── insertAutomationRun ───────────────────────────────────────
describe('insertAutomationRun', () => {
  it('returns inserted run record', async () => {
    q({ id: 'run-3', automation_id: 'auto-001', automation_name: 'BRD Generator', status: 'success', duration_ms: 3100, run_at: '2026-03-25T11:00:00Z', created_at: '' });
    const result = await insertAutomationRun({ id: 'run-3', automation_id: 'auto-001', automation_name: 'BRD Generator', status: 'success', duration_ms: 3100, run_at: '2026-03-25T11:00:00Z' });
    expect(result.id).toBe('run-3');
    expect(result.status).toBe('success');
  });
});

// ── getUsers ──────────────────────────────────────────────────
describe('getUsers', () => {
  it('returns user rows', async () => {
    q([{ id: 'u-1', name: 'Ahmed Khalil', email: 'ahmed@firm.com', role: 'Admin', workspaces: 8, status: 'Active', initials: 'AK', created_at: '', updated_at: '' }]);
    const result = await getUsers();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Ahmed Khalil');
  });

  it('returns empty array when no users', async () => {
    q([]);
    const result = await getUsers();
    expect(result).toEqual([]);
  });

  it('throws when supabase returns error', async () => {
    q(null, { message: 'Permission denied' });
    await expect(getUsers()).rejects.toMatchObject({ message: 'Permission denied' });
  });
});

// ── upsertUser ────────────────────────────────────────────────
describe('upsertUser', () => {
  it('returns upserted user row', async () => {
    q({ id: 'u-2', name: 'Rania Taleb', email: 'rania@firm.com', role: 'Manager', workspaces: 4, status: 'Active', initials: 'RT', created_at: '', updated_at: '' });
    const result = await upsertUser({ id: 'u-2', name: 'Rania Taleb', email: 'rania@firm.com', role: 'Manager', workspaces: 4, status: 'Active', initials: 'RT' });
    expect(result.name).toBe('Rania Taleb');
    expect(result.role).toBe('Manager');
  });
});

// ── updateUser ────────────────────────────────────────────────
describe('updateUser', () => {
  it('returns updated user with new status', async () => {
    q({ id: 'u-1', name: 'Ahmed Khalil', email: 'ahmed@firm.com', role: 'Admin', workspaces: 8, status: 'Inactive', initials: 'AK', created_at: '', updated_at: '' });
    const result = await updateUser('u-1', { status: 'Inactive' });
    expect(result.status).toBe('Inactive');
  });
});

// ── deleteUser ────────────────────────────────────────────────
describe('deleteUser', () => {
  it('resolves without error on successful delete', async () => {
    q(null);
    await expect(deleteUser('u-1')).resolves.toBeUndefined();
  });

  it('throws when delete returns error', async () => {
    q(null, { message: 'Cannot delete' });
    await expect(deleteUser('u-1')).rejects.toMatchObject({ message: 'Cannot delete' });
  });
});
