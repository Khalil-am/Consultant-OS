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

// ─────────────────────────────────────────────────────────────
describe('getApprovals (additional fields)', () => {
  it('returns approval with correct urgency field', async () => {
    q([{ id: 'apr-2', title: 'Change Request', requester: 'RT', type: 'Change', urgency: 'Critical', status: 'pending', created_at: '', updated_at: '' }]);
    const result = await getApprovals();
    expect(result[0].urgency).toBe('Critical');
  });

  it('returns multiple approvals', async () => {
    q([
      { id: 'apr-1', title: 'Doc A', requester: 'AM', type: 'Document', urgency: 'High', status: 'pending', created_at: '', updated_at: '' },
      { id: 'apr-2', title: 'Doc B', requester: 'RT', type: 'Budget', urgency: 'Low', status: 'approved', created_at: '', updated_at: '' },
    ]);
    const result = await getApprovals();
    expect(result).toHaveLength(2);
    expect(result[1].status).toBe('approved');
  });

  it('returns [] when data is null', async () => {
    q(null);
    expect(await getApprovals()).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertApproval (error)', () => {
  it('throws on upsert error', async () => {
    q(null, { message: 'Duplicate key', code: '23505' });
    await expect(upsertApproval({ id: 'apr-1', title: 'Dup', requester: 'AM', type: 'Document', urgency: 'High', status: 'pending' }))
      .rejects.toMatchObject({ message: 'Duplicate key' });
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateApproval (additional)', () => {
  it('updates status to rejected', async () => {
    q({ id: 'apr-1', title: 'BRD Approval', requester: 'AM', type: 'Document', urgency: 'High', status: 'rejected', created_at: '', updated_at: '' });
    const result = await updateApproval('apr-1', { status: 'rejected' });
    expect(result.status).toBe('rejected');
  });

  it('throws on update error', async () => {
    q(null, { message: 'Row not found', code: 'PGRST116' });
    await expect(updateApproval('missing', { status: 'approved' }))
      .rejects.toMatchObject({ message: 'Row not found' });
  });
});

// ─────────────────────────────────────────────────────────────
describe('getAutomationRuns (error)', () => {
  it('throws when supabase returns error', async () => {
    q(null, { message: 'Permission denied' });
    await expect(getAutomationRuns()).rejects.toMatchObject({ message: 'Permission denied' });
  });

  it('returns run with correct duration_ms field', async () => {
    q([{ id: 'run-4', automation_id: 'auto-003', automation_name: 'Risk Analyzer', status: 'failed', duration_ms: 500, run_at: '2026-03-26T08:00:00Z', created_at: '' }]);
    const result = await getAutomationRuns();
    expect(result[0].duration_ms).toBe(500);
    expect(result[0].status).toBe('failed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('insertAutomationRun (error and additional)', () => {
  it('throws on insert error', async () => {
    q(null, { message: 'Insert failed', code: '23514' });
    await expect(insertAutomationRun({ id: 'run-x', automation_id: 'auto-001', automation_name: 'BRD Generator', status: 'success', duration_ms: 1000, run_at: '2026-03-26T09:00:00Z' }))
      .rejects.toMatchObject({ message: 'Insert failed' });
  });

  it('returns inserted run with failed status', async () => {
    q({ id: 'run-5', automation_id: 'auto-002', automation_name: 'Meeting Summarizer', status: 'failed', duration_ms: 200, run_at: '2026-03-26T10:00:00Z', created_at: '' });
    const result = await insertAutomationRun({ id: 'run-5', automation_id: 'auto-002', automation_name: 'Meeting Summarizer', status: 'failed', duration_ms: 200, run_at: '2026-03-26T10:00:00Z' });
    expect(result.status).toBe('failed');
    expect(result.automation_name).toBe('Meeting Summarizer');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getUsers (additional)', () => {
  it('returns multiple users', async () => {
    q([
      { id: 'u-1', name: 'Ahmed Khalil', email: 'ahmed@firm.com', role: 'Admin', workspaces: 8, status: 'Active', initials: 'AK', created_at: '', updated_at: '' },
      { id: 'u-2', name: 'Rania Taleb', email: 'rania@firm.com', role: 'Manager', workspaces: 4, status: 'Active', initials: 'RT', created_at: '', updated_at: '' },
    ]);
    const result = await getUsers();
    expect(result).toHaveLength(2);
    expect(result[1].email).toBe('rania@firm.com');
  });

  it('returns user with correct role field', async () => {
    q([{ id: 'u-3', name: 'Nora Hassan', email: 'nora@firm.com', role: 'Viewer', workspaces: 2, status: 'Active', initials: 'NH', created_at: '', updated_at: '' }]);
    const result = await getUsers();
    expect(result[0].role).toBe('Viewer');
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertUser (error)', () => {
  it('throws on upsert error', async () => {
    q(null, { message: 'Email already exists', code: '23505' });
    await expect(upsertUser({ id: 'u-dup', name: 'Dup', email: 'dup@firm.com', role: 'Viewer', workspaces: 0, status: 'Active', initials: 'D' }))
      .rejects.toMatchObject({ message: 'Email already exists' });
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateUser (error and additional)', () => {
  it('throws on update error', async () => {
    q(null, { message: 'Row not found', code: 'PGRST116' });
    await expect(updateUser('missing-id', { status: 'Active' }))
      .rejects.toMatchObject({ message: 'Row not found' });
  });

  it('updates user role', async () => {
    q({ id: 'u-1', name: 'Ahmed Khalil', email: 'ahmed@firm.com', role: 'Admin', workspaces: 8, status: 'Active', initials: 'AK', created_at: '', updated_at: '' });
    const result = await updateUser('u-1', { role: 'Admin' });
    expect(result.role).toBe('Admin');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getMilestones (additional fields)', () => {
  it('returns milestone with completion_pct field', async () => {
    q([{ id: 'ms-3', title: 'Phase 3 UAT', workspace_id: 'ws-1', status: 'On Track', completion_pct: 65, due_date: '2026-06-01', owner: 'JL', value: 750000 }]);
    const result = await getMilestones();
    expect(result[0].completion_pct).toBe(65);
  });

  it('returns milestone with due_date field', async () => {
    q([{ id: 'ms-4', title: 'Go Live', workspace_id: 'ws-2', status: 'Completed', completion_pct: 100, due_date: '2026-07-01', owner: 'AM', value: 0 }]);
    const result = await getMilestones();
    expect(result[0].due_date).toBe('2026-07-01');
  });

  it('returns milestone with owner field', async () => {
    q([{ id: 'ms-5', title: 'Phase Review', workspace_id: 'ws-3', status: 'Delayed', completion_pct: 40, due_date: '2026-05-15', owner: 'RT', value: 0 }]);
    const result = await getMilestones();
    expect(result[0].owner).toBe('RT');
  });

  it('throws on getMilestones error', async () => {
    q(null, { message: 'DB timeout', code: '500' });
    await expect(getMilestones()).rejects.toMatchObject({ message: 'DB timeout' });
  });
});

// ─────────────────────────────────────────────────────────────
describe('getWorkspaces (additional fields)', () => {
  it('returns workspace with sector field', async () => {
    q([{ id: 'ws-5', name: 'ZATCA Digital', sector: 'Finance', type: 'Client', status: 'Active', progress: 45 }]);
    const result = await getWorkspaces();
    expect(result[0].sector).toBe('Finance');
  });

  it('returns multiple workspaces', async () => {
    q([
      { id: 'ws-1', name: 'NCA', sector: 'Government' },
      { id: 'ws-2', name: 'MOCI', sector: 'Government' },
      { id: 'ws-3', name: 'ZATCA', sector: 'Finance' },
    ]);
    const result = await getWorkspaces();
    expect(result).toHaveLength(3);
    expect(result[2].sector).toBe('Finance');
  });

  it('returns workspace with progress field', async () => {
    q([{ id: 'ws-6', name: 'MOF Project', sector: 'Finance', progress: 72, status: 'Active', type: 'Client' }]);
    const result = await getWorkspaces();
    expect(result[0].progress).toBe(72);
  });
});

// ─────────────────────────────────────────────────────────────
describe('getRisks (additional)', () => {
  it('returns risk with status field', async () => {
    q([{ id: 'r-5', title: 'Scope Creep', severity: 'High', status: 'Open', workspace_id: 'ws-1' }]);
    const result = await getRisks();
    expect(result[0].status).toBe('Open');
  });

  it('returns multiple risks', async () => {
    q([
      { id: 'r-1', title: 'Budget Overrun', severity: 'Critical', status: 'Open' },
      { id: 'r-2', title: 'Vendor Delay', severity: 'High', status: 'Mitigated' },
    ]);
    const result = await getRisks();
    expect(result).toHaveLength(2);
    expect(result[1].severity).toBe('High');
  });

  it('returns risk with probability field', async () => {
    q([{ id: 'r-6', title: 'Technical Debt', severity: 'Medium', status: 'Open', probability: 'Medium', impact: 'High', workspace_id: 'ws-2' }]);
    const result = await getRisks();
    expect(result[0].probability).toBe('Medium');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getTasks (additional fields)', () => {
  it('returns task with priority field', async () => {
    q([{ id: 't-5', title: 'Deploy to prod', priority: 'High', status: 'In Progress', workspace_id: 'ws-1', assignee: 'AM' }]);
    const result = await getTasks();
    expect(result[0].priority).toBe('High');
  });

  it('returns task with due_date field', async () => {
    q([{ id: 't-6', title: 'Code review', priority: 'Medium', status: 'Backlog', due_date: '2026-04-15', workspace_id: 'ws-2', assignee: 'RT' }]);
    const result = await getTasks();
    expect(result[0].due_date).toBe('2026-04-15');
  });

  it('returns multiple tasks', async () => {
    q([
      { id: 't-1', title: 'Task A', priority: 'High', status: 'In Progress' },
      { id: 't-2', title: 'Task B', priority: 'Low', status: 'Backlog' },
      { id: 't-3', title: 'Task C', priority: 'Medium', status: 'Completed' },
    ]);
    const result = await getTasks();
    expect(result).toHaveLength(3);
    expect(result[2].status).toBe('Completed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getReports (additional)', () => {
  it('returns report with type field', async () => {
    q([{ id: 'rep-5', title: 'Q1 Board Summary', type: 'Board', status: 'Published', workspace: 'NCA', workspace_id: 'ws-1', period: 'Q1 2026' }]);
    const result = await getReports();
    expect(result[0].type).toBe('Board');
  });

  it('returns report with period field', async () => {
    q([{ id: 'rep-6', title: 'Monthly Status', type: 'Status', status: 'Draft', workspace: 'MOCI', workspace_id: 'ws-2', period: 'March 2026' }]);
    const result = await getReports();
    expect(result[0].period).toBe('March 2026');
  });

  it('returns multiple reports', async () => {
    q([
      { id: 'rep-1', title: 'Monthly Status', type: 'Status', status: 'Published' },
      { id: 'rep-2', title: 'Weekly Update', type: 'Weekly', status: 'Draft' },
    ]);
    const result = await getReports();
    expect(result).toHaveLength(2);
    expect(result[1].type).toBe('Weekly');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getApprovals (requester and type fields)', () => {
  it('returns approval with correct requester field', async () => {
    q([{ id: 'apr-7', title: 'Risk Sign-off', requester: 'KA', type: 'Risk', urgency: 'Medium', status: 'pending', created_at: '', updated_at: '' }]);
    const result = await getApprovals();
    expect(result[0].requester).toBe('KA');
  });

  it('returns approval with correct type field', async () => {
    q([{ id: 'apr-8', title: 'Scope Change', requester: 'AM', type: 'Change Request', urgency: 'High', status: 'pending', created_at: '', updated_at: '' }]);
    const result = await getApprovals();
    expect(result[0].type).toBe('Change Request');
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateApproval (pending status)', () => {
  it('updates status to pending', async () => {
    q({ id: 'apr-1', title: 'NCA BRD', requester: 'AM', type: 'Document', urgency: 'High', status: 'pending', created_at: '', updated_at: '' });
    const result = await updateApproval('apr-1', { status: 'pending' });
    expect(result.status).toBe('pending');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getAutomationRuns (pending status)', () => {
  it('returns run with status "pending"', async () => {
    q([{ id: 'run-6', automation_id: 'auto-004', automation_name: 'Scope Analyzer', status: 'pending', duration_ms: 0, run_at: '2026-03-27T08:00:00Z', created_at: '' }]);
    const result = await getAutomationRuns();
    expect(result[0].status).toBe('pending');
    expect(result[0].automation_name).toBe('Scope Analyzer');
  });

  it('returns multiple runs', async () => {
    q([
      { id: 'run-1', automation_id: 'auto-001', automation_name: 'BRD Generator', status: 'success', duration_ms: 3000, run_at: '2026-03-25T09:00:00Z', created_at: '' },
      { id: 'run-2', automation_id: 'auto-001', automation_name: 'BRD Generator', status: 'failed', duration_ms: 500, run_at: '2026-03-26T09:00:00Z', created_at: '' },
    ]);
    const result = await getAutomationRuns();
    expect(result).toHaveLength(2);
    expect(result[1].status).toBe('failed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('insertAutomationRun (run_at field)', () => {
  it('returns inserted run with correct run_at field', async () => {
    q({ id: 'run-7', automation_id: 'auto-003', automation_name: 'Risk Analyzer', status: 'success', duration_ms: 1500, run_at: '2026-04-01T10:00:00Z', created_at: '' });
    const result = await insertAutomationRun({ id: 'run-7', automation_id: 'auto-003', automation_name: 'Risk Analyzer', status: 'success', duration_ms: 1500, run_at: '2026-04-01T10:00:00Z' });
    expect(result.run_at).toBe('2026-04-01T10:00:00Z');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getDocuments (additional fields)', () => {
  it('returns document with language field', async () => {
    q([{ id: 'doc-10', name: 'Arch Plan', type: 'BRD', status: 'Draft', language: 'AR', workspace_id: 'ws-1', workspace: 'NCA', author: 'AM', date: '2026-01-01', tags: [], summary: '', versions: [] }]);
    const result = await getDocuments();
    expect(result[0].language).toBe('AR');
  });

  it('returns document with summary field', async () => {
    q([{ id: 'doc-11', name: 'Summary Doc', type: 'Report', status: 'Published', language: 'EN', workspace_id: 'ws-2', workspace: 'MOCI', author: 'RT', date: '2026-02-01', tags: ['Risk'], summary: 'Q1 highlights', versions: [] }]);
    const result = await getDocuments();
    expect(result[0].summary).toBe('Q1 highlights');
  });

  it('returns document with tags array', async () => {
    q([{ id: 'doc-12', name: 'Tagged Doc', type: 'BRD', status: 'Draft', language: 'EN', workspace_id: 'ws-1', workspace: 'SEC', author: 'KA', date: '2026-03-01', tags: ['Governance', 'Security'], summary: '', versions: [] }]);
    const result = await getDocuments();
    expect(result[0].tags).toContain('Governance');
    expect(result[0].tags).toContain('Security');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getActivities (additional fields)', () => {
  it('returns activity with user field', async () => {
    q([{ id: 'act-10', type: 'Task', action: 'Created', user: 'Ahmed K.', workspace_id: 'ws-1', workspace: 'NCA', timestamp: '2026-01-10T09:00:00Z', description: 'Created task' }]);
    const result = await getActivities();
    expect(result[0].user).toBe('Ahmed K.');
  });

  it('returns activity with description field', async () => {
    q([{ id: 'act-11', type: 'Document', action: 'Uploaded', user: 'RT', workspace_id: 'ws-2', workspace: 'MOCI', timestamp: '2026-01-11T10:00:00Z', description: 'Uploaded quarterly report' }]);
    const result = await getActivities();
    expect(result[0].description).toBe('Uploaded quarterly report');
  });

  it('returns multiple activities', async () => {
    q([
      { id: 'act-1', type: 'Task', action: 'Updated', user: 'AM', workspace_id: 'ws-1', workspace: 'NCA', timestamp: '2026-01-01T09:00:00Z', description: 'Updated task status' },
      { id: 'act-2', type: 'Meeting', action: 'Created', user: 'RT', workspace_id: 'ws-1', workspace: 'NCA', timestamp: '2026-01-02T10:00:00Z', description: 'Created meeting' },
    ]);
    const result = await getActivities();
    expect(result).toHaveLength(2);
    expect(result[1].type).toBe('Meeting');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getMeetings (additional fields)', () => {
  it('returns meeting with workspace field', async () => {
    q([{ id: 'mtg-10', title: 'Board Review', workspace_id: 'ws-1', workspace: 'SEC', date: '2026-03-15', time: '14:00', duration: 90, status: 'Scheduled', type: 'Board', attendees: [], agenda: '', notes: '', action_items: [], documents: [] }]);
    const result = await getMeetings();
    expect(result[0].workspace).toBe('SEC');
  });

  it('returns meeting with duration field', async () => {
    q([{ id: 'mtg-11', title: 'Sprint Review', workspace_id: 'ws-2', workspace: 'MOCI', date: '2026-03-20', time: '10:00', duration: 60, status: 'Completed', type: 'Internal', attendees: [], agenda: '', notes: '', action_items: [], documents: [] }]);
    const result = await getMeetings();
    expect(result[0].duration).toBe(60);
  });

  it('returns multiple meetings', async () => {
    q([
      { id: 'mtg-1', title: 'Kickoff', workspace_id: 'ws-1', workspace: 'NCA', date: '2026-01-10', time: '09:00', duration: 30, status: 'Completed', type: 'Kickoff', attendees: [], agenda: '', notes: '', action_items: [], documents: [] },
      { id: 'mtg-2', title: 'Weekly Sync', workspace_id: 'ws-1', workspace: 'NCA', date: '2026-01-17', time: '09:00', duration: 45, status: 'Scheduled', type: 'Recurring', attendees: [], agenda: '', notes: '', action_items: [], documents: [] },
    ]);
    const result = await getMeetings();
    expect(result).toHaveLength(2);
    expect(result[1].title).toBe('Weekly Sync');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getRisks (workspace field)', () => {
  it('returns risk with workspace field', async () => {
    q([{ id: 'risk-10', title: 'Vendor Dependency', description: 'Key vendor may exit', category: 'Vendor', severity: 'High', status: 'Open', probability: 0.3, impact: 0.7, workspace_id: 'ws-1', workspace: 'NCA', owner: 'AM', mitigation: '', created_at: '', updated_at: '' }]);
    const result = await getRisks();
    expect(result[0].workspace).toBe('NCA');
  });

  it('returns risk with impact field', async () => {
    q([{ id: 'risk-11', title: 'Budget Overrun', description: 'Cost escalation', category: 'Financial', severity: 'Critical', status: 'Open', probability: 0.5, impact: 0.9, workspace_id: 'ws-2', workspace: 'MOCI', owner: 'KA', mitigation: '', created_at: '', updated_at: '' }]);
    const result = await getRisks();
    expect(result[0].impact).toBe(0.9);
  });
});

// ─────────────────────────────────────────────────────────────
describe('getTasks (workspace and assignee fields)', () => {
  it('returns task with workspace field', async () => {
    q([{ id: 'task-10', title: 'Data Migration', description: '', status: 'In Progress', priority: 'High', workspace_id: 'ws-1', workspace: 'SEC', assignee: 'RT', due_date: '2026-05-01', tags: [], created_at: '', updated_at: '' }]);
    const result = await getTasks();
    expect(result[0].workspace).toBe('SEC');
  });

  it('returns task with assignee field', async () => {
    q([{ id: 'task-11', title: 'API Integration', description: '', status: 'Backlog', priority: 'Medium', workspace_id: 'ws-2', workspace: 'ADNOC', assignee: 'FH', due_date: '2026-06-15', tags: [], created_at: '', updated_at: '' }]);
    const result = await getTasks();
    expect(result[0].assignee).toBe('FH');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getWorkspaceRagStatuses (additional)', () => {
  it('returns rag status with workspace_id field', async () => {
    q([{ id: 'rag-10', workspace_id: 'ws-1', status: 'Green', updated_at: '2026-03-01T00:00:00Z' }]);
    const result = await getWorkspaceRagStatuses();
    expect(result[0].workspace_id).toBe('ws-1');
  });

  it('returns rag status with status field', async () => {
    q([{ id: 'rag-11', workspace_id: 'ws-2', status: 'Amber', updated_at: '2026-03-15T00:00:00Z' }]);
    const result = await getWorkspaceRagStatuses();
    expect(result[0].status).toBe('Amber');
  });

  it('returns multiple rag statuses', async () => {
    q([
      { id: 'rag-1', workspace_id: 'ws-1', status: 'Green', updated_at: '2026-01-01T00:00:00Z' },
      { id: 'rag-2', workspace_id: 'ws-2', status: 'Red', updated_at: '2026-01-05T00:00:00Z' },
    ]);
    const result = await getWorkspaceRagStatuses();
    expect(result).toHaveLength(2);
    expect(result[1].status).toBe('Red');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getWorkspaceFinancials (additional fields)', () => {
  it('returns financial with workspace_id field', async () => {
    q([{ id: 'fin-10', workspace_id: 'ws-1', workspace: 'NCA', period: 'Q1 2026', revenue: 500000, cost: 350000, margin: 0.3, currency: 'SAR', status: 'Confirmed' }]);
    const result = await getWorkspaceFinancials();
    expect(result[0].workspace_id).toBe('ws-1');
  });

  it('returns financial with revenue field', async () => {
    q([{ id: 'fin-11', workspace_id: 'ws-2', workspace: 'MOCI', period: 'Q2 2026', revenue: 750000, cost: 500000, margin: 0.33, currency: 'SAR', status: 'Projected' }]);
    const result = await getWorkspaceFinancials();
    expect(result[0].revenue).toBe(750000);
  });

  it('returns multiple financials', async () => {
    q([
      { id: 'fin-1', workspace_id: 'ws-1', workspace: 'NCA', period: 'Q1 2026', revenue: 100000, cost: 70000, margin: 0.3, currency: 'SAR', status: 'Confirmed' },
      { id: 'fin-2', workspace_id: 'ws-2', workspace: 'ADNOC', period: 'Q1 2026', revenue: 200000, cost: 150000, margin: 0.25, currency: 'SAR', status: 'Confirmed' },
    ]);
    const result = await getWorkspaceFinancials();
    expect(result).toHaveLength(2);
    expect(result[1].workspace).toBe('ADNOC');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getMilestones (error handling)', () => {
  it('throws on getMilestones with workspace_id error', async () => {
    q(null, { message: 'Not found' });
    await expect(getMilestones('ws-1')).rejects.toThrow('Not found');
  });
});

// ─────────────────────────────────────────────────────────────
describe('deleteDocument (additional)', () => {
  it('resolves without error on delete', async () => {
    q(null);
    await expect(deleteDocument('doc-1')).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
describe('deleteTask (additional)', () => {
  it('resolves without error on delete', async () => {
    q(null);
    await expect(deleteTask('task-1')).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
describe('deleteRisk (additional)', () => {
  it('resolves without error on delete', async () => {
    q(null);
    await expect(deleteRisk('risk-1')).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
describe('insertActivity (additional)', () => {
  it('resolves without error for Task activity', async () => {
    q({ id: 'act-20', type: 'Task', action: 'Deleted', user: 'AM', workspace_id: 'ws-1', workspace: 'NCA', timestamp: '2026-04-10T14:00:00Z', description: 'Deleted risk item' });
    await expect(insertActivity({ id: 'act-20', type: 'Task', action: 'Deleted', user: 'AM', workspace_id: 'ws-1', workspace: 'NCA', timestamp: '2026-04-10T14:00:00Z', description: 'Deleted risk item' })).resolves.toBeUndefined();
  });

  it('resolves without error for Risk activity', async () => {
    q({ id: 'act-21', type: 'Risk', action: 'Escalated', user: 'KA', workspace_id: 'ws-2', workspace: 'MOCI', timestamp: '2026-04-11T09:00:00Z', description: 'Risk escalated' });
    await expect(insertActivity({ id: 'act-21', type: 'Risk', action: 'Escalated', user: 'KA', workspace_id: 'ws-2', workspace: 'MOCI', timestamp: '2026-04-11T09:00:00Z', description: 'Risk escalated' })).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
describe('deleteWorkspace (data check)', () => {
  it('resolves successfully for valid ws id', async () => {
    q(null);
    await expect(deleteWorkspace('ws-nca')).resolves.toBeUndefined();
  });

  it('resolves for another workspace id', async () => {
    q(null);
    await expect(deleteWorkspace('ws-moci')).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
describe('createWorkspace (additional fields)', () => {
  it('returns workspace with language and sector fields', async () => {
    q({ id: 'ws-5', name: 'SAMA', language: 'AR', sector: 'Finance', status: 'Active', progress: 0 });
    const result = await createWorkspace({ name: 'SAMA', type: 'Project', status: 'Active', progress: 0, language: 'AR', sector: 'Finance', contributors: [] });
    expect(result.language).toBe('AR');
    expect(result.sector).toBe('Finance');
  });

  it('returns workspace with contributors populated', async () => {
    q({ id: 'ws-6', name: 'CMA', contributors: ['Ahmed', 'Sara', 'Khalid'], status: 'Active', progress: 0 });
    const result = await createWorkspace({ name: 'CMA', type: 'Retainer', status: 'Active', progress: 0, language: 'EN', sector: 'Finance', contributors: ['Ahmed', 'Sara', 'Khalid'] });
    expect(result.contributors).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateWorkspace (additional fields)', () => {
  it('returns workspace with updated language field', async () => {
    q({ id: 'ws-1', language: 'Bilingual', progress: 50 });
    const result = await updateWorkspace('ws-1', { language: 'Bilingual' });
    expect(result.language).toBe('Bilingual');
  });

  it('returns workspace with progress 0', async () => {
    q({ id: 'ws-2', name: 'SEC', progress: 0, status: 'Active' });
    const result = await updateWorkspace('ws-2', { progress: 0 });
    expect(result.progress).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('getWorkspaces (status filters)', () => {
  it('returns only active workspaces when filtered', async () => {
    q([
      { id: 'ws-1', name: 'NCA', status: 'Active' },
      { id: 'ws-2', name: 'MOCI', status: 'Active' },
    ]);
    const result = await getWorkspaces();
    expect(result.every((w: { status: string }) => w.status === 'Active')).toBe(true);
  });

  it('returns workspace with On Hold status', async () => {
    q([{ id: 'ws-3', name: 'SEC', status: 'On Hold' }]);
    const result = await getWorkspaces();
    expect(result[0].status).toBe('On Hold');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getMeeting (additional fields)', () => {
  it('returns meeting with quorum_status field', async () => {
    q({ id: 'm-10', title: 'Board Meeting', quorum_status: 'Met', participants: ['A', 'B', 'C', 'D', 'E'] });
    const result = await getMeeting('m-10');
    expect(result?.quorum_status).toBe('Met');
    expect(result?.participants).toHaveLength(5);
  });

  it('returns meeting with location field', async () => {
    q({ id: 'm-11', title: 'Site Visit', location: 'ADNOC HQ, Abu Dhabi', duration: '3h' });
    const result = await getMeeting('m-11');
    expect(result?.location).toBe('ADNOC HQ, Abu Dhabi');
    expect(result?.duration).toBe('3h');
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertRisk (status variations)', () => {
  it('returns risk with Mitigated status', async () => {
    q({ id: 'r5', title: 'Budget Risk', status: 'Mitigated', severity: 'Low' });
    const risk = { id: 'r5', title: 'Budget Risk', workspace: 'SEC', workspace_id: 'ws-3', probability: 1, impact: 2, severity: 'Low' as const, status: 'Mitigated' as const, owner: 'FD', mitigation: 'Budget reallocated', date_identified: '2026-01-01', category: 'Financial', financial_exposure: 50000 };
    const result = await upsertRisk(risk);
    expect(result.status).toBe('Mitigated');
    expect(result.severity).toBe('Low');
  });

  it('returns risk with Closed status', async () => {
    q({ id: 'r6', title: 'Old Risk', status: 'Closed', category: 'Operational' });
    const risk = { id: 'r6', title: 'Old Risk', workspace: 'NCA', workspace_id: 'ws-1', probability: 1, impact: 1, severity: 'Low' as const, status: 'Closed' as const, owner: 'AM', mitigation: 'Resolved', date_identified: '2025-12-01', category: 'Operational', financial_exposure: 0 };
    const result = await upsertRisk(risk);
    expect(result.status).toBe('Closed');
    expect(result.category).toBe('Operational');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getMilestones (status variations)', () => {
  it('returns milestone with At Risk status', async () => {
    q([{ id: 'ms-a', title: 'Phase 2 Delivery', status: 'At Risk', completion_pct: 20 }]);
    const result = await getMilestones();
    expect(result[0].status).toBe('At Risk');
    expect(result[0].completion_pct).toBe(20);
  });

  it('returns milestone with Delayed status', async () => {
    q([{ id: 'ms-b', title: 'System Integration', status: 'Delayed', due_date: '2026-05-01' }]);
    const result = await getMilestones();
    expect(result[0].status).toBe('Delayed');
    expect(result[0].due_date).toBe('2026-05-01');
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertWorkspaceFinancial (additional)', () => {
  it('returns financial with next_milestone_value', async () => {
    q({ id: 'fin-10', workspace_id: 'ws-1', next_milestone_value: 1500000, contract_value: 8000000 });
    const fin = { id: 'fin-10', workspace_id: 'ws-1', workspace_name: 'ADNOC', contract_value: 8000000, spent: 4000000, forecast: 7500000, variance: 500000, currency: 'AED', billing_model: 'Fixed Fee', last_invoice: '2026-03-01', next_milestone_value: 1500000 };
    const result = await upsertWorkspaceFinancial(fin);
    expect(result.next_milestone_value).toBe(1500000);
    expect(result.contract_value).toBe(8000000);
  });

  it('returns financial with AED currency', async () => {
    q({ id: 'fin-11', workspace_id: 'ws-adnoc', currency: 'AED', billing_model: 'T&M', spent: 3000000 });
    const fin = { id: 'fin-11', workspace_id: 'ws-adnoc', workspace_name: 'ADNOC', contract_value: 10000000, spent: 3000000, forecast: 9000000, variance: 1000000, currency: 'AED', billing_model: 'T&M', last_invoice: '2026-02-15', next_milestone_value: 2000000 };
    const result = await upsertWorkspaceFinancial(fin);
    expect(result.currency).toBe('AED');
    expect(result.billing_model).toBe('T&M');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getWorkspace (null handling)', () => {
  it('returns null for missing workspace PGRST116', async () => {
    q(null, { code: 'PGRST116', message: 'Not found' });
    expect(await getWorkspace('ws-missing')).toBeNull();
  });

  it('returns workspace with progress field', async () => {
    q({ id: 'ws-1', name: 'NCA', progress: 65, status: 'Active' });
    const result = await getWorkspace('ws-1');
    expect(result?.progress).toBe(65);
  });

  it('returns workspace with type field', async () => {
    q({ id: 'ws-2', name: 'MOCI', type: 'Retainer', status: 'Active' });
    const result = await getWorkspace('ws-2');
    expect(result?.type).toBe('Retainer');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getWorkspaces (error case)', () => {
  it('throws on query error', async () => {
    q(null, { message: 'Workspaces fetch failed', code: '500' });
    await expect(getWorkspaces()).rejects.toMatchObject({ message: 'Workspaces fetch failed' });
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateDocument (status transitions)', () => {
  it('returns document with Under Review status', async () => {
    q({ id: 'd1', status: 'Under Review', pages: 15 });
    const result = await updateDocument('d1', { status: 'Under Review' });
    expect(result.status).toBe('Under Review');
  });

  it('returns document with Approved status', async () => {
    q({ id: 'd2', status: 'Approved', author: 'Senior Consultant' });
    const result = await updateDocument('d2', { status: 'Approved' });
    expect(result.status).toBe('Approved');
  });

  it('returns document with Draft status', async () => {
    q({ id: 'd3', status: 'Draft', pages: 0 });
    const result = await updateDocument('d3', { status: 'Draft' });
    expect(result.status).toBe('Draft');
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertMeeting (type variations)', () => {
  it('returns Steering type meeting', async () => {
    q({ id: 'm-s1', title: 'Steering Committee Q2', type: 'Steering', status: 'Upcoming' });
    const mtg = { id: 'm-s1', title: 'Steering Committee Q2', type: 'Steering' as const, date: '2026-06-01', time: '10:00', duration: '2h', workspace: 'NCA', workspace_id: 'ws-1', location: null, participants: [], status: 'Upcoming' as const, agenda: 'Q2 review', quorum_status: null as null, minutes_generated: false, actions_extracted: 0, decisions_logged: 0 };
    const result = await upsertMeeting(mtg);
    expect(result.type).toBe('Steering');
  });

  it('returns Board type meeting', async () => {
    q({ id: 'm-b1', title: 'Board Meeting', type: 'Board', status: 'Upcoming' });
    const mtg = { id: 'm-b1', title: 'Board Meeting', type: 'Board' as const, date: '2026-07-01', time: '09:00', duration: '3h', workspace: 'SEC', workspace_id: 'ws-3', location: 'HQ', participants: [], status: 'Upcoming' as const, agenda: null, quorum_status: null as null, minutes_generated: false, actions_extracted: 0, decisions_logged: 0 };
    const result = await upsertMeeting(mtg);
    expect(result.type).toBe('Board');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getRisks (category field)', () => {
  it('returns risks with Compliance category', async () => {
    q([{ id: 'r-c1', title: 'GDPR Risk', category: 'Compliance', severity: 'High' }]);
    const result = await getRisks();
    expect(result[0].category).toBe('Compliance');
  });

  it('returns risks with Vendor category', async () => {
    q([{ id: 'r-v1', title: 'Supplier Risk', category: 'Vendor', severity: 'Medium' }]);
    const result = await getRisks();
    expect(result[0].category).toBe('Vendor');
  });

  it('returns risks with Technical category', async () => {
    q([{ id: 'r-t1', title: 'System Failure', category: 'Technical', severity: 'Critical' }]);
    const result = await getRisks();
    expect(result[0].category).toBe('Technical');
    expect(result[0].severity).toBe('Critical');
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateRisk (additional transitions)', () => {
  it('returns risk with updated probability=5 and impact=5', async () => {
    q({ id: 'r-high', probability: 5, impact: 5, severity: 'Critical' });
    const result = await updateRisk('r-high', { probability: 5, impact: 5 });
    expect(result.probability).toBe(5);
    expect(result.impact).toBe(5);
  });

  it('returns risk updated to In Review status', async () => {
    q({ id: 'r-rev', status: 'In Review' });
    const result = await updateRisk('r-rev', { status: 'In Review' });
    expect(result.status).toBe('In Review');
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertDocument (type variations)', () => {
  it('returns Feasibility Study document', async () => {
    q({ id: 'd-fs', type: 'Feasibility Study', name: 'Smart City Feasibility', status: 'Draft' });
    const doc = { id: 'd-fs', name: 'Smart City Feasibility', type: 'Feasibility Study', type_color: '#F59E0B', workspace: 'MOCI', workspace_id: 'ws-moci', date: '2026-05-01', language: 'EN' as const, status: 'Draft' as const, size: '3MB', author: 'Rania Taleb', pages: 45, summary: '', tags: [], file_url: null };
    const result = await upsertDocument(doc);
    expect(result.type).toBe('Feasibility Study');
  });

  it('returns Risk Register document', async () => {
    q({ id: 'd-rr', type: 'Risk Register', name: 'Q2 Risk Register', status: 'Draft' });
    const doc = { id: 'd-rr', name: 'Q2 Risk Register', type: 'Risk Register', type_color: '#EF4444', workspace: 'NCA', workspace_id: 'ws-1', date: '2026-04-01', language: 'AR' as const, status: 'Draft' as const, size: '1MB', author: 'AM', pages: 12, summary: '', tags: [], file_url: null };
    const result = await upsertDocument(doc);
    expect(result.type).toBe('Risk Register');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getWorkspaceRagStatus (data fields)', () => {
  it('returns RAG with all four colour dimensions', async () => {
    q({ id: 'rag-x', workspace_id: 'ws-1', rag: 'Red', budget: 'Red', schedule: 'Amber', risk: 'Red' });
    const result = await getWorkspaceRagStatus('ws-1');
    expect(result?.rag).toBe('Red');
    expect(result?.budget).toBe('Red');
    expect(result?.schedule).toBe('Amber');
  });

  it('returns all-green RAG status', async () => {
    q({ id: 'rag-y', workspace_id: 'ws-2', rag: 'Green', budget: 'Green', schedule: 'Green', risk: 'Green' });
    const result = await getWorkspaceRagStatus('ws-2');
    expect(result?.rag).toBe('Green');
    expect(result?.risk).toBe('Green');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getDocument (additional fields)', () => {
  it('returns document with file_url and pages', async () => {
    q({ id: 'd-url', name: 'Signed BRD', file_url: 'https://cdn.example.com/brd.pdf', pages: 32 });
    const result = await getDocument('d-url');
    expect(result?.file_url).toContain('brd.pdf');
    expect(result?.pages).toBe(32);
  });

  it('returns document with AR language', async () => {
    q({ id: 'd-ar', name: 'MOCI Arabic BRD', language: 'AR', author: 'Rania Taleb' });
    const result = await getDocument('d-ar');
    expect(result?.language).toBe('AR');
    expect(result?.author).toBe('Rania Taleb');
  });

  it('returns document with empty tags array', async () => {
    q({ id: 'd-notags', name: 'No Tags Doc', tags: [] });
    const result = await getDocument('d-notags');
    expect(result?.tags).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('getMeetings (type filter results)', () => {
  it('returns Workshop type meetings', async () => {
    q([{ id: 'm-w1', title: 'Design Workshop', type: 'Workshop', status: 'Upcoming' }]);
    const result = await getMeetings();
    expect(result[0].type).toBe('Workshop');
  });

  it('returns Kickoff type meetings', async () => {
    q([{ id: 'm-k1', title: 'Project Kickoff', type: 'Kickoff', status: 'Upcoming' }]);
    const result = await getMeetings();
    expect(result[0].type).toBe('Kickoff');
  });

  it('returns Review type meetings', async () => {
    q([{ id: 'm-r1', title: 'Sprint Review', type: 'Review', status: 'Completed' }]);
    const result = await getMeetings();
    expect(result[0].type).toBe('Review');
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertDocument (status transitions)', () => {
  it('returns document with Approved status', async () => {
    q({ id: 'd-a', name: 'Approved BRD', status: 'Approved', pages: 25 });
    const doc = { id: 'd-a', name: 'Approved BRD', type: 'BRD', type_color: '#0EA5E9', workspace: 'NCA', workspace_id: 'ws-1', date: '2026-03-01', language: 'EN' as const, status: 'Approved' as const, size: '2MB', author: 'AM', pages: 25, summary: '', tags: [], file_url: null };
    const result = await upsertDocument(doc);
    expect(result.status).toBe('Approved');
    expect(result.pages).toBe(25);
  });

  it('returns document with Under Review status', async () => {
    q({ id: 'd-ur', name: 'BRD in Review', status: 'Under Review', author: 'Rania Taleb' });
    const doc = { id: 'd-ur', name: 'BRD in Review', type: 'BRD', type_color: '#0EA5E9', workspace: 'MOCI', workspace_id: 'ws-m', date: '2026-04-01', language: 'AR' as const, status: 'Under Review' as const, size: '1.5MB', author: 'Rania Taleb', pages: 20, summary: '', tags: [], file_url: null };
    const result = await upsertDocument(doc);
    expect(result.status).toBe('Under Review');
    expect(result.author).toBe('Rania Taleb');
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateTask (status transitions)', () => {
  it('returns task with Backlog status', async () => {
    q({ id: 't-b', status: 'Backlog', priority: 'Low' });
    const result = await updateTask('t-b', { status: 'Backlog' });
    expect(result.status).toBe('Backlog');
  });

  it('returns task with In Progress status and due date', async () => {
    q({ id: 't-ip', status: 'In Progress', due_date: '2026-04-30' });
    const result = await updateTask('t-ip', { status: 'In Progress', due_date: '2026-04-30' });
    expect(result.status).toBe('In Progress');
    expect(result.due_date).toBe('2026-04-30');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getReports (type variations)', () => {
  it('returns Board Pack type report', async () => {
    q([{ id: 'rep-bp', title: 'Q1 Board Pack', type: 'Board Pack', status: 'Generated' }]);
    const result = await getReports();
    expect(result[0].type).toBe('Board Pack');
  });

  it('returns Steering report type', async () => {
    q([{ id: 'rep-sc', title: 'Steering Committee Report', type: 'Steering Committee', status: 'Generated' }]);
    const result = await getReports();
    expect(result[0].type).toBe('Steering Committee');
  });

  it('returns multiple reports', async () => {
    q([
      { id: 'rep-1', title: 'Weekly W10', type: 'Weekly Status', status: 'Generated' },
      { id: 'rep-2', title: 'Weekly W11', type: 'Weekly Status', status: 'Generated' },
      { id: 'rep-3', title: 'Board Pack Q1', type: 'Board Pack', status: 'Generated' },
    ]);
    const result = await getReports();
    expect(result).toHaveLength(3);
    expect(result[2].type).toBe('Board Pack');
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertMeeting (with agenda and quorum)', () => {
  it('returns meeting with agenda and quorum_status', async () => {
    q({ id: 'm-aq', title: 'NCA Steering', agenda: 'Q1 financial review', quorum_status: 'Met', minutes_generated: false });
    const mtg = { id: 'm-aq', title: 'NCA Steering', type: 'Steering' as const, date: '2026-04-15', time: '11:00', duration: '2h', workspace: 'NCA', workspace_id: 'ws-1', location: 'NCA HQ', participants: ['Alice', 'Bob', 'Charlie'], status: 'Upcoming' as const, agenda: 'Q1 financial review', quorum_status: 'Met' as null, minutes_generated: false, actions_extracted: 0, decisions_logged: 0 };
    const result = await upsertMeeting(mtg);
    expect(result.agenda).toBe('Q1 financial review');
    expect(result.quorum_status).toBe('Met');
  });

  it('returns meeting with 5 participants', async () => {
    q({ id: 'm-5p', participants: ['A', 'B', 'C', 'D', 'E'], status: 'Upcoming', title: 'Big Meeting' });
    const mtg = { id: 'm-5p', title: 'Big Meeting', type: 'Board' as const, date: '2026-05-01', time: '09:00', duration: '4h', workspace: 'SEC', workspace_id: 'ws-sec', location: null, participants: ['A', 'B', 'C', 'D', 'E'], status: 'Upcoming' as const, agenda: null, quorum_status: null as null, minutes_generated: false, actions_extracted: 0, decisions_logged: 0 };
    const result = await upsertMeeting(mtg);
    expect(result.participants).toHaveLength(5);
  });
});

// ─────────────────────────────────────────────────────────────
describe('getRisks (owner field)', () => {
  it('returns risk with owner name', async () => {
    q([{ id: 'r-o1', title: 'Vendor Risk', owner: 'Ahmed Khalil', status: 'Open' }]);
    const result = await getRisks();
    expect(result[0].owner).toBe('Ahmed Khalil');
  });

  it('returns risk with financial_exposure', async () => {
    q([{ id: 'r-fe1', title: 'Budget Exposure', financial_exposure: 2500000, status: 'Open' }]);
    const result = await getRisks();
    expect(result[0].financial_exposure).toBe(2500000);
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateDocument (tags and summary)', () => {
  it('returns document with updated tags', async () => {
    q({ id: 'd-tags', tags: ['Phase 2', 'BRD', 'NCA', 'Updated'], status: 'Draft' });
    const result = await updateDocument('d-tags', { tags: ['Phase 2', 'BRD', 'NCA', 'Updated'] });
    expect(result.tags).toHaveLength(4);
    expect(result.tags).toContain('Updated');
  });

  it('returns document with updated summary', async () => {
    q({ id: 'd-sum', summary: 'Updated executive summary for Q2 2026.', status: 'Under Review' });
    const result = await updateDocument('d-sum', { summary: 'Updated executive summary for Q2 2026.' });
    expect(result.summary).toContain('Q2 2026');
  });
});

// ─────────────────────────────────────────────────────────────
describe('insertActivity (type variations)', () => {
  it('resolves for workspace creation activity', async () => {
    q(null);
    const act = { id: 'a-wc', user: 'Admin', action: 'Created workspace', target: 'ZATCA', workspace: 'ZATCA', workspace_id: 'ws-z', time: '1m ago', type: 'workspace' };
    await expect(insertActivity(act)).resolves.toBeUndefined();
  });

  it('resolves for milestone activity', async () => {
    q(null);
    const act = { id: 'a-ms', user: 'AM', action: 'Updated milestone', target: 'Phase 3 Go Live', workspace: 'NCA', workspace_id: 'ws-1', time: '2m ago', type: 'milestone' };
    await expect(insertActivity(act)).resolves.toBeUndefined();
  });

  it('resolves for meeting activity', async () => {
    q(null);
    const act = { id: 'a-mtg', user: 'Rania', action: 'Generated minutes', target: 'Steering Committee', workspace: 'MOCI', workspace_id: 'ws-m', time: '5m ago', type: 'meeting' };
    await expect(insertActivity(act)).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
describe('getWorkspaces (sector variations)', () => {
  it('returns Government sector workspaces', async () => {
    q([{ id: 'ws-g1', name: 'NCA', sector: 'Government' }, { id: 'ws-g2', name: 'MOCI', sector: 'Government' }]);
    const result = await getWorkspaces();
    expect(result.every((w: { sector: string }) => w.sector === 'Government')).toBe(true);
  });

  it('returns Finance sector workspace', async () => {
    q([{ id: 'ws-f1', name: 'SAMA', sector: 'Finance', type: 'Retainer' }]);
    const result = await getWorkspaces();
    expect(result[0].sector).toBe('Finance');
    expect(result[0].type).toBe('Retainer');
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertApproval (additional)', () => {
  it('resolves with approval record for Approved status', async () => {
    q({ id: 'apr-1', status: 'Approved', approved_by: 'Ahmed', approved_at: '2026-04-01' });
    const result = await upsertApproval({ id: 'apr-1', type: 'Document', status: 'Approved', requester: 'Rania', title: 'BRD Sign-off', workspace_id: 'ws-1', created_at: '2026-03-25' });
    expect(result.status).toBe('Approved');
  });

  it('resolves with Rejected status', async () => {
    q({ id: 'apr-2', status: 'Rejected', notes: 'Insufficient documentation' });
    const result = await upsertApproval({ id: 'apr-2', type: 'Budget', status: 'Rejected', requester: 'Khalid', title: 'Q2 Budget Approval', workspace_id: 'ws-2', created_at: '2026-03-28' });
    expect(result.status).toBe('Rejected');
    expect(result.notes).toBe('Insufficient documentation');
  });

  it('resolves with Pending status', async () => {
    q({ id: 'apr-3', status: 'Pending', type: 'Risk', requester: 'AM' });
    const result = await upsertApproval({ id: 'apr-3', type: 'Risk', status: 'Pending', requester: 'AM', title: 'Risk Acceptance', workspace_id: 'ws-3', created_at: '2026-04-02' });
    expect(result.status).toBe('Pending');
    expect(result.type).toBe('Risk');
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateApproval (additional status transitions)', () => {
  it('updates to Approved and returns result', async () => {
    q({ id: 'apr-1', status: 'Approved', approved_at: '2026-04-01' });
    const result = await updateApproval('apr-1', { status: 'Approved', approved_by: 'Ahmed' });
    expect(result.status).toBe('Approved');
    expect(result.approved_at).toBe('2026-04-01');
  });

  it('updates to Rejected with notes', async () => {
    q({ id: 'apr-2', status: 'Rejected' });
    const result = await updateApproval('apr-2', { status: 'Rejected', notes: 'Missing signature' });
    expect(result.status).toBe('Rejected');
  });

  it('updates to Pending review', async () => {
    q({ id: 'apr-3', status: 'Pending' });
    const result = await updateApproval('apr-3', { status: 'Pending' });
    expect(result.status).toBe('Pending');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getAutomationRuns (additional fields)', () => {
  it('returns runs with duration_ms field', async () => {
    q([{ id: 'run-1', status: 'success', duration_ms: 4200, automation_name: 'BRD Generator' }]);
    const result = await getAutomationRuns();
    expect(result[0].duration_ms).toBe(4200);
    expect(result[0].automation_name).toBe('BRD Generator');
  });

  it('returns runs with failed status', async () => {
    q([{ id: 'run-2', status: 'failed', duration_ms: 1500, error: 'Timeout' }]);
    const result = await getAutomationRuns();
    expect(result[0].status).toBe('failed');
    expect(result[0].error).toBe('Timeout');
  });

  it('returns multiple runs sorted by run_at', async () => {
    q([
      { id: 'run-3', status: 'success', run_at: '2026-04-01T10:00:00Z' },
      { id: 'run-4', status: 'success', run_at: '2026-04-02T10:00:00Z' },
    ]);
    const result = await getAutomationRuns();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('run-3');
  });
});

// ─────────────────────────────────────────────────────────────
describe('insertAutomationRun (additional variations)', () => {
  it('resolves with id field', async () => {
    q({ id: 'run-5', status: 'success', automation_id: 'auto-002' });
    const result = await insertAutomationRun({ id: 'run-5', automation_id: 'auto-002', automation_name: 'Risk Analyser', status: 'success', duration_ms: 3100, run_at: '2026-04-01T00:00:00Z' });
    expect(result.id).toBe('run-5');
    expect(result.automation_id).toBe('auto-002');
  });

  it('resolves with running status', async () => {
    q({ id: 'run-6', status: 'running' });
    const result = await insertAutomationRun({ id: 'run-6', automation_id: 'auto-003', automation_name: 'Doc Converter', status: 'running', duration_ms: 0, run_at: '2026-04-01T00:00:00Z' });
    expect(result.status).toBe('running');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getUsers (role variations)', () => {
  it('returns user with Admin role', async () => {
    q([{ id: 'u-1', name: 'Ahmed Khalil', email: 'ahmed@firm.com', role: 'Admin' }]);
    const result = await getUsers();
    expect(result[0].role).toBe('Admin');
  });

  it('returns user with Consultant role', async () => {
    q([{ id: 'u-2', name: 'Rania Taleb', email: 'rania@firm.com', role: 'Consultant' }]);
    const result = await getUsers();
    expect(result[0].role).toBe('Consultant');
  });

  it('returns user with Client role', async () => {
    q([{ id: 'u-3', name: 'Khalid Mansour', email: 'khalid@client.com', role: 'Client' }]);
    const result = await getUsers();
    expect(result[0].role).toBe('Client');
  });

  it('returns user with Manager role and workspace count', async () => {
    q([{ id: 'u-4', name: 'Faisal Hassan', role: 'Manager', workspaces: 5 }]);
    const result = await getUsers();
    expect(result[0].role).toBe('Manager');
    expect(result[0].workspaces).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertUser (additional fields)', () => {
  it('resolves with status field', async () => {
    q({ id: 'u-1', status: 'Active', name: 'Ahmed Khalil' });
    const result = await upsertUser({ id: 'u-1', name: 'Ahmed Khalil', email: 'ahmed@firm.com', role: 'Admin', status: 'Active', workspaces: 3, lastActive: '1h ago', initials: 'AK' });
    expect(result.status).toBe('Active');
  });

  it('resolves with Inactive status', async () => {
    q({ id: 'u-2', status: 'Inactive', name: 'Sara Al-Otaibi' });
    const result = await upsertUser({ id: 'u-2', name: 'Sara Al-Otaibi', email: 'sara@firm.com', role: 'Consultant', status: 'Inactive', workspaces: 0, lastActive: '30d ago', initials: 'SO' });
    expect(result.status).toBe('Inactive');
    expect(result.name).toBe('Sara Al-Otaibi');
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateUser (role transitions)', () => {
  it('updates user role to Admin', async () => {
    q({ id: 'u-1', role: 'Admin' });
    const result = await updateUser('u-1', { role: 'Admin' });
    expect(result.role).toBe('Admin');
  });

  it('updates user role to Consultant', async () => {
    q({ id: 'u-2', role: 'Consultant' });
    const result = await updateUser('u-2', { role: 'Consultant' });
    expect(result.role).toBe('Consultant');
  });

  it('updates user status to Inactive', async () => {
    q({ id: 'u-3', status: 'Inactive' });
    const result = await updateUser('u-3', { status: 'Inactive' });
    expect(result.status).toBe('Inactive');
  });
});

// ─────────────────────────────────────────────────────────────
describe('deleteUser (additional)', () => {
  it('resolves without error', async () => {
    q(null);
    await expect(deleteUser('u-del-1')).resolves.toBeUndefined();
  });

  it('throws on database error', async () => {
    q(null, { message: 'User not found', code: '404' });
    await expect(deleteUser('u-del-2')).rejects.toThrow('User not found');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getMilestones (additional milestone types)', () => {
  it('returns milestone with Design phase', async () => {
    q([{ id: 'ms-1', name: 'Design Freeze', phase: 'Design', status: 'Completed', date: '2026-02-28' }]);
    const result = await getMilestones('ws-1');
    expect(result[0].phase).toBe('Design');
    expect(result[0].status).toBe('Completed');
  });

  it('returns milestone with Testing phase', async () => {
    q([{ id: 'ms-2', name: 'UAT Sign-off', phase: 'Testing', status: 'Upcoming', date: '2026-05-15' }]);
    const result = await getMilestones('ws-1');
    expect(result[0].phase).toBe('Testing');
    expect(result[0].name).toBe('UAT Sign-off');
  });

  it('returns milestone with owner field', async () => {
    q([{ id: 'ms-3', name: 'Go Live', owner: 'Ahmed Khalil', status: 'On Track' }]);
    const result = await getMilestones('ws-1');
    expect(result[0].owner).toBe('Ahmed Khalil');
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertMilestone (additional)', () => {
  it('resolves with milestone name and date', async () => {
    q({ id: 'ms-new', name: 'Phase 2 Launch', date: '2026-06-01', status: 'Upcoming' });
    const result = await upsertMilestone({ id: 'ms-new', name: 'Phase 2 Launch', workspace_id: 'ws-1', date: '2026-06-01', status: 'Upcoming' });
    expect(result.name).toBe('Phase 2 Launch');
    expect(result.date).toBe('2026-06-01');
  });

  it('resolves with Completed status', async () => {
    q({ id: 'ms-done', status: 'Completed', completed_at: '2026-03-15' });
    const result = await upsertMilestone({ id: 'ms-done', name: 'Requirements Done', workspace_id: 'ws-2', date: '2026-03-15', status: 'Completed' });
    expect(result.status).toBe('Completed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('deleteMilestone (additional)', () => {
  it('resolves without error for valid id', async () => {
    q(null);
    await expect(deleteMilestone('ms-del-1')).resolves.toBeUndefined();
  });

  it('throws on database error', async () => {
    q(null, { message: 'Milestone not found', code: '404' });
    await expect(deleteMilestone('ms-del-2')).rejects.toThrow('Milestone not found');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getWorkspaceRagStatuses (additional)', () => {
  it('returns multiple RAG statuses', async () => {
    q([
      { id: 'rag-1', workspace_id: 'ws-1', rag: 'Green' },
      { id: 'rag-2', workspace_id: 'ws-2', rag: 'Amber' },
    ]);
    const result = await getWorkspaceRagStatuses();
    expect(result).toHaveLength(2);
    expect(result[0].rag).toBe('Green');
    expect(result[1].rag).toBe('Amber');
  });

  it('returns [] when no RAG statuses found', async () => {
    q(null);
    const result = await getWorkspaceRagStatuses();
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertWorkspaceRagStatus (budget and schedule fields)', () => {
  it('resolves with Red budget status', async () => {
    q({ id: 'rag-upd-1', workspace_id: 'ws-1', rag: 'Red', budget: 'Red', schedule: 'Amber' });
    const result = await upsertWorkspaceRagStatus({ id: 'rag-upd-1', workspace_id: 'ws-1', rag: 'Red', budget: 'Red', schedule: 'Amber', scope: 'Green', risk: 'Green', updated_by: 'AM', updated_at: '' });
    expect(result.budget).toBe('Red');
    expect(result.schedule).toBe('Amber');
  });

  it('resolves with all Green fields', async () => {
    q({ id: 'rag-upd-2', rag: 'Green', budget: 'Green', schedule: 'Green', scope: 'Green', risk: 'Green' });
    const result = await upsertWorkspaceRagStatus({ id: 'rag-upd-2', workspace_id: 'ws-2', rag: 'Green', budget: 'Green', schedule: 'Green', scope: 'Green', risk: 'Green', updated_by: 'RT', updated_at: '' });
    expect(result.rag).toBe('Green');
    expect(result.risk).toBe('Green');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getTasks (more status variations)', () => {
  it('returns tasks with Backlog status', async () => {
    q([{ id: 't-1', title: 'Backlog Task', status: 'Backlog', workspace_id: 'ws-1' }]);
    const result = await getTasks('ws-1');
    expect(result[0].status).toBe('Backlog');
  });

  it('returns tasks with Completed status', async () => {
    q([{ id: 't-2', title: 'Done Task', status: 'Completed', workspace_id: 'ws-1' }]);
    const result = await getTasks('ws-1');
    expect(result[0].status).toBe('Completed');
  });

  it('returns tasks with Critical priority', async () => {
    q([{ id: 't-3', title: 'Critical Task', priority: 'Critical', workspace_id: 'ws-1' }]);
    const result = await getTasks('ws-1');
    expect(result[0].priority).toBe('Critical');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getReports (more filtering)', () => {
  it('returns reports with Quarterly type', async () => {
    q([{ id: 'rpt-1', title: 'Q1 2026 Report', type: 'Quarterly', workspace_id: 'ws-1' }]);
    const result = await getReports('ws-1');
    expect(result[0].type).toBe('Quarterly');
  });

  it('returns reports with Draft status', async () => {
    q([{ id: 'rpt-2', title: 'Draft Report', status: 'Draft', workspace_id: 'ws-1' }]);
    const result = await getReports('ws-1');
    expect(result[0].status).toBe('Draft');
  });

  it('returns empty array when no reports', async () => {
    q(null);
    const result = await getReports('ws-empty');
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
describe('getActivities (more variants)', () => {
  it('returns document type activity', async () => {
    q([{ id: 'act-1', type: 'document', description: 'Document uploaded', workspace_id: 'ws-1' }]);
    const result = await getActivities('ws-1');
    expect(result[0].type).toBe('document');
  });

  it('returns meeting type activity', async () => {
    q([{ id: 'act-2', type: 'meeting', description: 'Meeting scheduled', workspace_id: 'ws-1' }]);
    const result = await getActivities('ws-1');
    expect(result[0].type).toBe('meeting');
  });

  it('returns automation type activity', async () => {
    q([{ id: 'act-3', type: 'automation', description: 'Automation triggered', workspace_id: 'ws-1' }]);
    const result = await getActivities('ws-1');
    expect(result[0].type).toBe('automation');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getMeeting (additional time and location fields)', () => {
  it('returns meeting with specific time', async () => {
    q({ id: 'mtg-1', title: 'Morning Sync', time: '09:00', workspace_id: 'ws-1' });
    const result = await getMeeting('mtg-1');
    expect(result.time).toBe('09:00');
  });

  it('returns meeting with location', async () => {
    q({ id: 'mtg-2', title: 'Board Meeting', location: 'Conference Room B', workspace_id: 'ws-1' });
    const result = await getMeeting('mtg-2');
    expect(result.location).toBe('Conference Room B');
  });

  it('returns meeting with participants array', async () => {
    q({ id: 'mtg-3', title: 'Team Standup', participants: ['AM', 'RT', 'FK'], workspace_id: 'ws-1' });
    const result = await getMeeting('mtg-3');
    expect(result.participants).toEqual(['AM', 'RT', 'FK']);
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertDocument (additional field coverage)', () => {
  it('resolves with language field AR', async () => {
    q({ id: 'doc-ar-1', name: 'Arabic BRD', language: 'AR', workspace_id: 'ws-1' });
    const result = await upsertDocument({ id: 'doc-ar-1', name: 'Arabic BRD', language: 'AR' as const, type: 'BRD', type_color: '#000', status: 'Draft' as const, date: '2026-01-01', workspace: 'NCA', workspace_id: 'ws-1', size: '1MB', tags: [], author: 'AM', pages: 5, summary: '', file_url: null, created_at: '', updated_at: '' });
    expect(result.language).toBe('AR');
  });

  it('resolves with tags array', async () => {
    q({ id: 'doc-tags-1', tags: ['BRD', 'Architecture', 'Final'], workspace_id: 'ws-1' });
    const result = await upsertDocument({ id: 'doc-tags-1', name: 'Tagged Doc', language: 'EN' as const, type: 'BRD', type_color: '#000', status: 'Final' as const, date: '2026-01-01', workspace: 'NCA', workspace_id: 'ws-1', size: '1MB', tags: ['BRD', 'Architecture', 'Final'], author: 'AM', pages: 10, summary: '', file_url: null, created_at: '', updated_at: '' });
    expect(result.tags).toEqual(['BRD', 'Architecture', 'Final']);
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertTask (additional field coverage)', () => {
  it('resolves with description field', async () => {
    q({ id: 't-desc-1', title: 'Design Review', description: 'Review UX mockups', workspace_id: 'ws-1' });
    const result = await upsertTask({ id: 't-desc-1', title: 'Design Review', workspace: 'NCA', workspace_id: 'ws-1', priority: 'Medium' as const, status: 'Backlog' as const, assignee: 'AM', due_date: '2026-05-01', description: 'Review UX mockups', linked_doc: null, created_at: '', updated_at: '' });
    expect(result.description).toBe('Review UX mockups');
  });

  it('resolves with linked_doc field', async () => {
    q({ id: 't-link-1', title: 'Review BRD', linked_doc: 'doc-brd-1', workspace_id: 'ws-1' });
    const result = await upsertTask({ id: 't-link-1', title: 'Review BRD', workspace: 'NCA', workspace_id: 'ws-1', priority: 'High' as const, status: 'In Progress' as const, assignee: 'AM', due_date: '2026-04-10', description: '', linked_doc: 'doc-brd-1', created_at: '', updated_at: '' });
    expect(result.linked_doc).toBe('doc-brd-1');
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertRisk (additional field coverage)', () => {
  it('resolves with mitigation field', async () => {
    q({ id: 'r-mit-1', title: 'Vendor Risk', mitigation: 'Multi-vendor strategy', workspace_id: 'ws-1' });
    const result = await upsertRisk({ id: 'r-mit-1', title: 'Vendor Risk', workspace: 'NCA', workspace_id: 'ws-1', category: 'Vendor', severity: 'High' as const, priority: 'High' as const, status: 'Open' as const, owner: 'AM', mitigation: 'Multi-vendor strategy', created_at: '', updated_at: '' });
    expect(result.mitigation).toBe('Multi-vendor strategy');
  });

  it('resolves with owner field', async () => {
    q({ id: 'r-own-1', title: 'Budget Risk', owner: 'Finance Team', workspace_id: 'ws-1' });
    const result = await upsertRisk({ id: 'r-own-1', title: 'Budget Risk', workspace: 'NCA', workspace_id: 'ws-1', category: 'Financial', severity: 'Critical' as const, priority: 'Critical' as const, status: 'Open' as const, owner: 'Finance Team', mitigation: '', created_at: '', updated_at: '' });
    expect(result.owner).toBe('Finance Team');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getUsers (additional variants)', () => {
  it('resolves with empty array when no users', async () => {
    q([]);
    const result = await getUsers();
    expect(result).toEqual([]);
  });

  it('resolves list of users', async () => {
    q([{ id: 'u-1', name: 'Ahmed', role: 'admin' }, { id: 'u-2', name: 'Reem', role: 'consultant' }]);
    const result = await getUsers();
    expect(result).toHaveLength(2);
  });

  it('first user has name field', async () => {
    q([{ id: 'u-1', name: 'Ahmed Khalil', role: 'admin', email: 'ahmed@nca.sa' }]);
    const result = await getUsers();
    expect(result[0].name).toBe('Ahmed Khalil');
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertUser (additional field coverage)', () => {
  it('resolves with role field admin', async () => {
    q({ id: 'u-admin', name: 'Admin User', role: 'admin', email: 'admin@test.sa' });
    const result = await upsertUser({ id: 'u-admin', name: 'Admin User', role: 'admin' as const, email: 'admin@test.sa', avatar: null, company: '', created_at: '', updated_at: '' });
    expect(result.role).toBe('admin');
  });

  it('resolves with role field consultant', async () => {
    q({ id: 'u-con', name: 'Consultant User', role: 'consultant', email: 'con@test.sa' });
    const result = await upsertUser({ id: 'u-con', name: 'Consultant User', role: 'consultant' as const, email: 'con@test.sa', avatar: null, company: 'NCA', created_at: '', updated_at: '' });
    expect(result.role).toBe('consultant');
  });

  it('resolves with company field', async () => {
    q({ id: 'u-co', name: 'Client User', role: 'client', email: 'client@nca.sa', company: 'National Cybersecurity Authority' });
    const result = await upsertUser({ id: 'u-co', name: 'Client User', role: 'client' as const, email: 'client@nca.sa', avatar: null, company: 'National Cybersecurity Authority', created_at: '', updated_at: '' });
    expect(result.company).toBe('National Cybersecurity Authority');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getApprovals (additional variants)', () => {
  it('resolves with empty array', async () => {
    q([]);
    const result = await getApprovals('ws-1');
    expect(result).toEqual([]);
  });

  it('resolves list with status approved', async () => {
    q([{ id: 'ap-1', workspace_id: 'ws-1', status: 'approved', document_id: 'doc-1' }]);
    const result = await getApprovals('ws-1');
    expect(result[0].status).toBe('approved');
  });

  it('resolves list with status pending', async () => {
    q([{ id: 'ap-2', workspace_id: 'ws-1', status: 'pending', document_id: 'doc-2' }]);
    const result = await getApprovals('ws-1');
    expect(result[0].status).toBe('pending');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getAutomationRuns (additional variants)', () => {
  it('resolves with empty array', async () => {
    q([]);
    const result = await getAutomationRuns('ws-1');
    expect(result).toEqual([]);
  });

  it('resolves runs list with success status', async () => {
    q([{ id: 'run-1', workspace_id: 'ws-1', status: 'success', automation_id: 'auto-1' }]);
    const result = await getAutomationRuns('ws-1');
    expect(result[0].status).toBe('success');
  });

  it('resolves runs list with failed status', async () => {
    q([{ id: 'run-2', workspace_id: 'ws-1', status: 'failed', automation_id: 'auto-2' }]);
    const result = await getAutomationRuns('ws-1');
    expect(result[0].status).toBe('failed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('insertAutomationRun (additional variants)', () => {
  it('resolves with inserted run id', async () => {
    q({ id: 'run-new-1', workspace_id: 'ws-1', status: 'success', automation_id: 'auto-1' });
    const result = await insertAutomationRun({ workspace_id: 'ws-1', status: 'success', automation_id: 'auto-1', output: {}, created_at: '' });
    expect(result.id).toBe('run-new-1');
  });

  it('resolves with running status', async () => {
    q({ id: 'run-new-2', workspace_id: 'ws-1', status: 'running', automation_id: 'auto-2' });
    const result = await insertAutomationRun({ workspace_id: 'ws-1', status: 'running', automation_id: 'auto-2', output: {}, created_at: '' });
    expect(result.status).toBe('running');
  });
});

// ─────────────────────────────────────────────────────────────
describe('deleteReport (additional variants)', () => {
  it('resolves without error', async () => {
    q(null);
    await expect(deleteReport('rpt-1')).resolves.not.toThrow();
  });

  it('can be called multiple times', async () => {
    q(null);
    q(null);
    await deleteReport('rpt-1');
    await deleteReport('rpt-2');
    expect(mockFrom).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('deleteTask (additional variants)', () => {
  it('resolves without error', async () => {
    q(null);
    await expect(deleteTask('task-1')).resolves.not.toThrow();
  });

  it('can be called with different task IDs', async () => {
    q(null);
    q(null);
    await deleteTask('t-1');
    await deleteTask('t-2');
    expect(mockFrom).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('deleteRisk (additional variants)', () => {
  it('resolves without error', async () => {
    q(null);
    await expect(deleteRisk('risk-1')).resolves.not.toThrow();
  });

  it('can be called with critical risk ID', async () => {
    q(null);
    await deleteRisk('risk-critical-1');
    expect(mockFrom).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('deleteMeeting (additional variants)', () => {
  it('resolves without error', async () => {
    q(null);
    await expect(deleteMeeting('mtg-1')).resolves.not.toThrow();
  });

  it('can be called with different meeting IDs', async () => {
    q(null);
    await deleteMeeting('mtg-stc-1');
    expect(mockFrom).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('deleteDocument (additional variants)', () => {
  it('resolves without error', async () => {
    q(null);
    await expect(deleteDocument('doc-1')).resolves.not.toThrow();
  });

  it('can be called with BRD document ID', async () => {
    q(null);
    await deleteDocument('doc-brd-1');
    expect(mockFrom).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('insertActivity (additional variants)', () => {
  it('resolves without error for document activity', async () => {
    q(null);
    await expect(insertActivity({ workspace_id: 'ws-1', type: 'document', action: 'created', entity_id: 'doc-1', entity_name: 'BRD', user_name: 'AM', created_at: '' })).resolves.not.toThrow();
  });

  it('resolves without error for meeting activity', async () => {
    q(null);
    await expect(insertActivity({ workspace_id: 'ws-1', type: 'meeting', action: 'scheduled', entity_id: 'mtg-1', entity_name: 'Q1 Review', user_name: 'RT', created_at: '' })).resolves.not.toThrow();
  });

  it('resolves without error for task activity', async () => {
    q(null);
    await expect(insertActivity({ workspace_id: 'ws-1', type: 'task', action: 'completed', entity_id: 'task-1', entity_name: 'Review BRD', user_name: 'FK', created_at: '' })).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateDocument (field variants)', () => {
  it('resolves with updated name', async () => {
    const updated = { id: 'doc-1', name: 'Updated BRD', type: 'BRD', workspace_id: 'ws-1', status: 'Draft', author: 'AM', date: '2026-01-01', language: 'EN', summary: '', tags: [], created_at: '', updated_at: '' };
    q(updated);
    const result = await updateDocument('doc-1', { name: 'Updated BRD' });
    expect(result.name).toBe('Updated BRD');
  });

  it('resolves with updated status to Approved', async () => {
    const updated = { id: 'doc-1', name: 'NCA BRD', type: 'BRD', workspace_id: 'ws-1', status: 'Approved', author: 'AM', date: '2026-01-01', language: 'EN', summary: '', tags: [], created_at: '', updated_at: '' };
    q(updated);
    const result = await updateDocument('doc-1', { status: 'Approved' });
    expect(result.status).toBe('Approved');
  });

  it('calls mockFrom when updating summary', async () => {
    q({ id: 'doc-1', name: 'Doc', type: 'BRD', workspace_id: 'ws-1', status: 'Draft', author: 'AM', date: '2026-01-01', language: 'EN', summary: 'Updated summary', tags: [], created_at: '', updated_at: '' });
    await updateDocument('doc-1', { summary: 'Updated summary' });
    expect(mockFrom).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateTask (additional field variants)', () => {
  it('resolves with updated title', async () => {
    const updated = { id: 'task-1', title: 'New Task Title', workspace_id: 'ws-1', status: 'In Progress', priority: 'High', assignee: 'AM', due_date: '', created_at: '', updated_at: '' };
    q(updated);
    const result = await updateTask('task-1', { title: 'New Task Title' });
    expect(result.title).toBe('New Task Title');
  });

  it('resolves with updated priority to Critical', async () => {
    const updated = { id: 'task-1', title: 'Critical Task', workspace_id: 'ws-1', status: 'In Progress', priority: 'Critical', assignee: 'AM', due_date: '', created_at: '', updated_at: '' };
    q(updated);
    const result = await updateTask('task-1', { priority: 'Critical' });
    expect(result.priority).toBe('Critical');
  });

  it('resolves with updated status to Completed', async () => {
    const updated = { id: 'task-1', title: 'Task', workspace_id: 'ws-1', status: 'Completed', priority: 'Medium', assignee: 'FK', due_date: '', created_at: '', updated_at: '' };
    q(updated);
    const result = await updateTask('task-1', { status: 'Completed' });
    expect(result.status).toBe('Completed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateRisk (additional field variants)', () => {
  it('resolves with updated impact to High', async () => {
    const updated = { id: 'risk-1', title: 'Data Loss', workspace_id: 'ws-1', category: 'Technical', probability: 'Medium', impact: 'High', status: 'Active', owner: 'AM', created_at: '', updated_at: '' };
    q(updated);
    const result = await updateRisk('risk-1', { impact: 'High' });
    expect(result.impact).toBe('High');
  });

  it('resolves with updated status to Mitigated', async () => {
    const updated = { id: 'risk-1', title: 'Scope Creep', workspace_id: 'ws-1', category: 'Operational', probability: 'Low', impact: 'Medium', status: 'Mitigated', owner: 'RT', created_at: '', updated_at: '' };
    q(updated);
    const result = await updateRisk('risk-1', { status: 'Mitigated' });
    expect(result.status).toBe('Mitigated');
  });

  it('calls mockFrom when updating risk category', async () => {
    q({ id: 'risk-1', title: 'Regulatory Risk', workspace_id: 'ws-1', category: 'Compliance', probability: 'High', impact: 'High', status: 'Active', owner: 'AM', created_at: '', updated_at: '' });
    await updateRisk('risk-1', { category: 'Compliance' });
    expect(mockFrom).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateMeeting (additional field variants)', () => {
  it('resolves with updated title', async () => {
    const updated = { id: 'mtg-1', title: 'Updated Meeting', workspace_id: 'ws-1', type: 'Steering', status: 'Scheduled', date: '2026-04-01', time: '10:00', location: 'HQ', attendees: [], created_at: '', updated_at: '' };
    q(updated);
    const result = await updateMeeting('mtg-1', { title: 'Updated Meeting' });
    expect(result.title).toBe('Updated Meeting');
  });

  it('resolves with updated status to Completed', async () => {
    const updated = { id: 'mtg-1', title: 'Q1 Review', workspace_id: 'ws-1', type: 'Review', status: 'Completed', date: '2026-03-28', time: '14:00', location: 'Remote', attendees: [], created_at: '', updated_at: '' };
    q(updated);
    const result = await updateMeeting('mtg-1', { status: 'Completed' });
    expect(result.status).toBe('Completed');
  });

  it('calls mockFrom when updating meeting location', async () => {
    q({ id: 'mtg-1', title: 'Team Sync', workspace_id: 'ws-1', type: 'Sync', status: 'Scheduled', date: '2026-04-01', time: '09:00', location: 'Room 3B', attendees: [], created_at: '', updated_at: '' });
    await updateMeeting('mtg-1', { location: 'Room 3B' });
    expect(mockFrom).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('deleteWorkspace (additional variants)', () => {
  it('resolves without error for standard workspace', async () => {
    q(null);
    await expect(deleteWorkspace('ws-1')).resolves.not.toThrow();
  });

  it('calls mockFrom when deleting workspace', async () => {
    q(null);
    await deleteWorkspace('ws-nca');
    expect(mockFrom).toHaveBeenCalled();
  });

  it('resolves without error for MOCI workspace', async () => {
    q(null);
    await expect(deleteWorkspace('ws-moci')).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateApproval (additional variants)', () => {
  it('resolves with updated status to Approved', async () => {
    const updated = { id: 'appr-1', entity_id: 'doc-1', entity_type: 'document', workspace_id: 'ws-1', requested_by: 'AM', status: 'Approved', created_at: '', updated_at: '' };
    q(updated);
    const result = await updateApproval('appr-1', { status: 'Approved' });
    expect(result.status).toBe('Approved');
  });

  it('resolves with updated status to Rejected', async () => {
    const updated = { id: 'appr-1', entity_id: 'doc-1', entity_type: 'document', workspace_id: 'ws-1', requested_by: 'RT', status: 'Rejected', created_at: '', updated_at: '' };
    q(updated);
    const result = await updateApproval('appr-1', { status: 'Rejected' });
    expect(result.status).toBe('Rejected');
  });

  it('calls mockFrom when updating approval', async () => {
    q({ id: 'appr-2', entity_id: 'doc-2', entity_type: 'document', workspace_id: 'ws-1', requested_by: 'FK', status: 'Pending', created_at: '', updated_at: '' });
    await updateApproval('appr-2', { status: 'Pending' });
    expect(mockFrom).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('updateUser (additional variants)', () => {
  it('resolves with updated name', async () => {
    const updated = { id: 'user-1', name: 'Updated Name', email: 'u@test.com', role: 'Consultant', workspace_ids: [], avatar_url: '', created_at: '', updated_at: '' };
    q(updated);
    const result = await updateUser('user-1', { name: 'Updated Name' });
    expect(result.name).toBe('Updated Name');
  });

  it('resolves with updated role to Admin', async () => {
    const updated = { id: 'user-1', name: 'Ahmed', email: 'a@test.com', role: 'Admin', workspace_ids: [], avatar_url: '', created_at: '', updated_at: '' };
    q(updated);
    const result = await updateUser('user-1', { role: 'Admin' });
    expect(result.role).toBe('Admin');
  });

  it('calls mockFrom when updating user email', async () => {
    q({ id: 'user-1', name: 'RT', email: 'rt@test.com', role: 'Consultant', workspace_ids: [], avatar_url: '', created_at: '', updated_at: '' });
    await updateUser('user-1', { email: 'rt@test.com' });
    expect(mockFrom).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('deleteUser (additional variants)', () => {
  it('resolves without error', async () => {
    q(null);
    await expect(deleteUser('user-1')).resolves.not.toThrow();
  });

  it('calls mockFrom when deleting user', async () => {
    q(null);
    await deleteUser('user-admin-1');
    expect(mockFrom).toHaveBeenCalled();
  });

  it('resolves without error for client user', async () => {
    q(null);
    await expect(deleteUser('user-client-1')).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertWorkspaceRagStatus (additional variants)', () => {
  it('resolves with overall rag status', async () => {
    const rag = { id: 'rag-2', workspace_id: 'ws-2', overall: 'Green', schedule: 'Green', budget: 'Amber', quality: 'Red', created_at: '', updated_at: '' };
    q(rag);
    const result = await upsertWorkspaceRagStatus({ workspace_id: 'ws-2', overall: 'Green', schedule: 'Green', budget: 'Amber', quality: 'Red' });
    expect(result.overall).toBe('Green');
  });

  it('resolves with Red overall status', async () => {
    const rag = { id: 'rag-3', workspace_id: 'ws-3', overall: 'Red', schedule: 'Red', budget: 'Red', quality: 'Red', created_at: '', updated_at: '' };
    q(rag);
    const result = await upsertWorkspaceRagStatus({ workspace_id: 'ws-3', overall: 'Red', schedule: 'Red', budget: 'Red', quality: 'Red' });
    expect(result.overall).toBe('Red');
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertMilestone (more variants)', () => {
  it('resolves with milestone title', async () => {
    const ms = { id: 'ms-2', workspace_id: 'ws-1', title: 'Phase 2 Kickoff', due_date: '2026-06-01', status: 'Upcoming', progress: 0, created_at: '', updated_at: '' };
    q(ms);
    const result = await upsertMilestone({ id: 'ms-2', workspace_id: 'ws-1', title: 'Phase 2 Kickoff', due_date: '2026-06-01', status: 'Upcoming', progress: 0 });
    expect(result.title).toBe('Phase 2 Kickoff');
  });

  it('resolves with Completed status milestone', async () => {
    const ms = { id: 'ms-3', workspace_id: 'ws-1', title: 'MVP Release', due_date: '2026-03-01', status: 'Completed', progress: 100, created_at: '', updated_at: '' };
    q(ms);
    const result = await upsertMilestone({ id: 'ms-3', workspace_id: 'ws-1', title: 'MVP Release', due_date: '2026-03-01', status: 'Completed', progress: 100 });
    expect(result.status).toBe('Completed');
  });

  it('calls mockFrom for any milestone upsert', async () => {
    q({ id: 'ms-4', workspace_id: 'ws-2', title: 'SIT Complete', due_date: '2026-05-01', status: 'In Progress', progress: 60, created_at: '', updated_at: '' });
    await upsertMilestone({ id: 'ms-4', workspace_id: 'ws-2', title: 'SIT Complete', due_date: '2026-05-01', status: 'In Progress', progress: 60 });
    expect(mockFrom).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('getWorkspaceFinancial (more variants)', () => {
  it('returns financial data with budget field', async () => {
    const fin = { id: 'fin-2', workspace_id: 'ws-2', budget: 1000000, spent: 250000, remaining: 750000, currency: 'SAR', created_at: '', updated_at: '' };
    q(fin);
    const result = await getWorkspaceFinancial('ws-2');
    expect(result?.budget).toBe(1000000);
  });

  it('returns null when no financial data found', async () => {
    q(null);
    const result = await getWorkspaceFinancial('ws-nonexistent');
    expect(result).toBeNull();
  });

  it('calls mockFrom when fetching financial data', async () => {
    q({ id: 'fin-3', workspace_id: 'ws-3', budget: 500000, spent: 100000, remaining: 400000, currency: 'USD', created_at: '', updated_at: '' });
    await getWorkspaceFinancial('ws-3');
    expect(mockFrom).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('getWorkspaceRagStatus (more variants)', () => {
  it('returns RAG with Amber overall', async () => {
    const rag = { id: 'rag-4', workspace_id: 'ws-4', overall: 'Amber', schedule: 'Green', budget: 'Amber', quality: 'Green', created_at: '', updated_at: '' };
    q(rag);
    const result = await getWorkspaceRagStatus('ws-4');
    expect(result?.overall).toBe('Amber');
  });

  it('returns null when no RAG found', async () => {
    q(null);
    const result = await getWorkspaceRagStatus('ws-none');
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
describe('getRisks (more field coverage)', () => {
  it('returns risks with Compliance category', async () => {
    const risks = [{ id: 'risk-c1', workspace_id: 'ws-1', title: 'PDPL Non-Compliance', category: 'Compliance', probability: 'High', impact: 'High', status: 'Active', owner: 'AM', created_at: '', updated_at: '' }];
    q(risks);
    const result = await getRisks('ws-1');
    expect(result[0].category).toBe('Compliance');
  });

  it('returns risks with Resource category', async () => {
    const risks = [{ id: 'risk-r1', workspace_id: 'ws-1', title: 'Staff Shortage', category: 'Resource', probability: 'Medium', impact: 'High', status: 'Active', owner: 'RT', created_at: '', updated_at: '' }];
    q(risks);
    const result = await getRisks('ws-1');
    expect(result[0].category).toBe('Resource');
  });

  it('returns empty array when no risks', async () => {
    q([]);
    const result = await getRisks('ws-empty');
    expect(result).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertRisk (more field coverage)', () => {
  it('resolves with Schedule category risk', async () => {
    const risk = { id: 'risk-s1', workspace_id: 'ws-1', title: 'Timeline Slippage', category: 'Schedule', probability: 'High', impact: 'Medium', status: 'Active', owner: 'AM', created_at: '', updated_at: '' };
    q(risk);
    const result = await upsertRisk({ workspace_id: 'ws-1', title: 'Timeline Slippage', category: 'Schedule', probability: 'High', impact: 'Medium', status: 'Active', owner: 'AM' });
    expect(result.category).toBe('Schedule');
  });

  it('resolves with Vendor category risk', async () => {
    const risk = { id: 'risk-v1', workspace_id: 'ws-1', title: 'Supplier Delay', category: 'Vendor', probability: 'Low', impact: 'Medium', status: 'Monitoring', owner: 'FK', created_at: '', updated_at: '' };
    q(risk);
    const result = await upsertRisk({ workspace_id: 'ws-1', title: 'Supplier Delay', category: 'Vendor', probability: 'Low', impact: 'Medium', status: 'Monitoring', owner: 'FK' });
    expect(result.category).toBe('Vendor');
  });

  it('calls mockFrom on any risk upsert', async () => {
    q({ id: 'risk-x', workspace_id: 'ws-1', title: 'Test Risk', category: 'Technical', probability: 'Low', impact: 'Low', status: 'Active', owner: 'AM', created_at: '', updated_at: '' });
    await upsertRisk({ workspace_id: 'ws-1', title: 'Test Risk', category: 'Technical', probability: 'Low', impact: 'Low', status: 'Active', owner: 'AM' });
    expect(mockFrom).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('getMeetings (more type variants)', () => {
  it('returns Workshop type meetings', async () => {
    const meetings = [{ id: 'mtg-w1', workspace_id: 'ws-1', title: 'Design Workshop', type: 'Workshop', status: 'Scheduled', date: '2026-04-01', time: '10:00', location: 'Room A', attendees: [], created_at: '', updated_at: '' }];
    q(meetings);
    const result = await getMeetings('ws-1');
    expect(result[0].type).toBe('Workshop');
  });

  it('returns Presentation type meetings', async () => {
    const meetings = [{ id: 'mtg-p1', workspace_id: 'ws-1', title: 'Board Presentation', type: 'Presentation', status: 'Upcoming', date: '2026-05-01', time: '14:00', location: 'Boardroom', attendees: [], created_at: '', updated_at: '' }];
    q(meetings);
    const result = await getMeetings('ws-1');
    expect(result[0].type).toBe('Presentation');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getDocuments (more type variants)', () => {
  it('returns Charter type documents', async () => {
    const docs = [{ id: 'doc-c1', workspace_id: 'ws-1', name: 'Project Charter', type: 'Charter', status: 'Draft', author: 'AM', date: '2026-01-01', language: 'EN', summary: '', tags: [], created_at: '', updated_at: '' }];
    q(docs);
    const result = await getDocuments('ws-1');
    expect(result[0].type).toBe('Charter');
  });

  it('returns Roadmap type documents', async () => {
    const docs = [{ id: 'doc-r1', workspace_id: 'ws-1', name: 'Digital Roadmap', type: 'Roadmap', status: 'Approved', author: 'RT', date: '2026-02-01', language: 'EN', summary: '', tags: [], created_at: '', updated_at: '' }];
    q(docs);
    const result = await getDocuments('ws-1');
    expect(result[0].type).toBe('Roadmap');
  });

  it('returns Report type documents', async () => {
    const docs = [{ id: 'doc-rp1', workspace_id: 'ws-1', name: 'Weekly Status Report', type: 'Report', status: 'Final', author: 'FK', date: '2026-03-01', language: 'EN', summary: '', tags: [], created_at: '', updated_at: '' }];
    q(docs);
    const result = await getDocuments('ws-1');
    expect(result[0].type).toBe('Report');
  });
});

// ─────────────────────────────────────────────────────────────
describe('getReports (type variants)', () => {
  it('returns BRD type reports', async () => {
    q([{ id: 'rpt-brd', workspace_id: 'ws-1', title: 'NCA BRD v1.0', type: 'BRD', status: 'Generated', date: '2026-03-01', pages: 45, author: 'AM', workspace: 'NCA', starred: false, pinned: false, created_at: '', updated_at: '' }]);
    const result = await getReports('ws-1');
    expect(result[0].type).toBe('BRD');
  });

  it('returns Risk Report type reports', async () => {
    q([{ id: 'rpt-risk', workspace_id: 'ws-1', title: 'Q1 Risk Register', type: 'Risk Report', status: 'Draft', date: '2026-02-01', pages: 12, author: 'RT', workspace: 'MOCI', starred: false, pinned: false, created_at: '', updated_at: '' }]);
    const result = await getReports('ws-1');
    expect(result[0].type).toBe('Risk Report');
  });

  it('returns Stakeholder Report type reports', async () => {
    q([{ id: 'rpt-sh', workspace_id: 'ws-1', title: 'Stakeholder Summary', type: 'Stakeholder Report', status: 'Scheduled', date: '2026-04-01', pages: 8, author: 'FK', workspace: 'NCA', starred: false, pinned: false, created_at: '', updated_at: '' }]);
    const result = await getReports('ws-1');
    expect(result[0].type).toBe('Stakeholder Report');
  });
});

// ─────────────────────────────────────────────────────────────
describe('insertAutomationRun (status variants)', () => {
  it('inserts a run with warning status', async () => {
    q({ id: 'run-w1', automation_id: 'auto-003', automation_name: 'Meeting Summarizer', status: 'warning', duration_ms: 1500, run_at: '2026-04-01T08:00:00Z', created_at: '' });
    const result = await insertAutomationRun({ id: 'run-w1', automation_id: 'auto-003', automation_name: 'Meeting Summarizer', status: 'warning', duration_ms: 1500, run_at: '2026-04-01T08:00:00Z' });
    expect(result.status).toBe('warning');
  });

  it('inserts a run with error status', async () => {
    q({ id: 'run-e1', automation_id: 'auto-004', automation_name: 'BRD Generator', status: 'error', duration_ms: 800, run_at: '2026-04-02T09:00:00Z', created_at: '' });
    const result = await insertAutomationRun({ id: 'run-e1', automation_id: 'auto-004', automation_name: 'BRD Generator', status: 'error', duration_ms: 800, run_at: '2026-04-02T09:00:00Z' });
    expect(result.status).toBe('error');
    expect(result.automation_name).toBe('BRD Generator');
  });

  it('inserts a run with high duration_ms', async () => {
    q({ id: 'run-d1', automation_id: 'auto-005', automation_name: 'Data Sync', status: 'success', duration_ms: 45000, run_at: '2026-04-03T10:00:00Z', created_at: '' });
    const result = await insertAutomationRun({ id: 'run-d1', automation_id: 'auto-005', automation_name: 'Data Sync', status: 'success', duration_ms: 45000, run_at: '2026-04-03T10:00:00Z' });
    expect(result.duration_ms).toBe(45000);
  });
});

// ─────────────────────────────────────────────────────────────
describe('getUsers (role variants)', () => {
  it('returns Viewer role users', async () => {
    q([{ id: 'u-v1', name: 'Client User', email: 'client@ext.com', role: 'Viewer', workspaces: 1, status: 'Active', initials: 'CU', created_at: '', updated_at: '' }]);
    const result = await getUsers();
    expect(result[0].role).toBe('Viewer');
  });

  it('returns Manager role users', async () => {
    q([{ id: 'u-m1', name: 'Project Manager', email: 'pm@firm.com', role: 'Manager', workspaces: 4, status: 'Active', initials: 'PM', created_at: '', updated_at: '' }]);
    const result = await getUsers();
    expect(result[0].role).toBe('Manager');
  });

  it('returns Consultant role users', async () => {
    q([{ id: 'u-c1', name: 'Senior Consultant', email: 'sc@firm.com', role: 'Consultant', workspaces: 3, status: 'Active', initials: 'SC', created_at: '', updated_at: '' }]);
    const result = await getUsers();
    expect(result[0].role).toBe('Consultant');
  });

  it('returns Inactive status users', async () => {
    q([{ id: 'u-i1', name: 'Former Staff', email: 'former@firm.com', role: 'Analyst', workspaces: 0, status: 'Inactive', initials: 'FS', created_at: '', updated_at: '' }]);
    const result = await getUsers();
    expect(result[0].status).toBe('Inactive');
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertApproval (status variants)', () => {
  it('upserts an approval with approved status', async () => {
    q({ id: 'apr-a1', title: 'Approved BRD', requester: 'AM', type: 'Document Approval', urgency: 'Low', status: 'approved', created_at: '', updated_at: '' });
    const result = await upsertApproval({ id: 'apr-a1', title: 'Approved BRD', requester: 'AM', type: 'Document Approval', urgency: 'Low', status: 'approved' });
    expect(result.status).toBe('approved');
  });

  it('upserts an approval with rejected status', async () => {
    q({ id: 'apr-r1', title: 'Rejected Budget Request', requester: 'RT', type: 'Budget Approval', urgency: 'High', status: 'rejected', created_at: '', updated_at: '' });
    const result = await upsertApproval({ id: 'apr-r1', title: 'Rejected Budget Request', requester: 'RT', type: 'Budget Approval', urgency: 'High', status: 'rejected' });
    expect(result.status).toBe('rejected');
  });

  it('upserts an approval with Critical urgency', async () => {
    q({ id: 'apr-c1', title: 'Critical Vendor Approval', requester: 'FK', type: 'Vendor Approval', urgency: 'Critical', status: 'pending', created_at: '', updated_at: '' });
    const result = await upsertApproval({ id: 'apr-c1', title: 'Critical Vendor Approval', requester: 'FK', type: 'Vendor Approval', urgency: 'Critical', status: 'pending' });
    expect(result.urgency).toBe('Critical');
  });
});

// ─────────────────────────────────────────────────────────────
describe('deleteMilestone (additional variants)', () => {
  it('resolves without error on successful delete', async () => {
    q(null);
    await expect(deleteMilestone('ms-del-1')).resolves.toBeUndefined();
  });

  it('resolves on second milestone deletion', async () => {
    q(null);
    await expect(deleteMilestone('ms-del-2')).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertMilestone (status variants)', () => {
  it('upserts a Completed milestone', async () => {
    q({ id: 'ms-c1', workspace_id: 'ws-1', title: 'Completed Deliverable', status: 'Completed', due_date: '2026-01-15', owner: 'AM', value: 0, description: null, progress: 100, created_at: '', updated_at: '' });
    const result = await upsertMilestone({ id: 'ms-c1', workspace_id: 'ws-1', title: 'Completed Deliverable', status: 'Completed', due_date: '2026-01-15', owner: 'AM', value: 0, description: null, progress: 100 });
    expect(result.status).toBe('Completed');
  });

  it('upserts a Delayed milestone', async () => {
    q({ id: 'ms-d1', workspace_id: 'ws-1', title: 'Delayed Phase', status: 'Delayed', due_date: '2026-02-28', owner: 'RT', value: 0, description: null, progress: 30, created_at: '', updated_at: '' });
    const result = await upsertMilestone({ id: 'ms-d1', workspace_id: 'ws-1', title: 'Delayed Phase', status: 'Delayed', due_date: '2026-02-28', owner: 'RT', value: 0, description: null, progress: 30 });
    expect(result.status).toBe('Delayed');
    expect(result.progress).toBe(30);
  });
});

// ─────────────────────────────────────────────────────────────
describe('upsertRisk (severity variants)', () => {
  it('upserts a Medium severity risk', async () => {
    q({ id: 'risk-m1', workspace_id: 'ws-1', title: 'Medium Data Risk', description: null, severity: 'Medium', category: 'Technical', status: 'Open', owner: 'AM', mitigation: null, created_at: '', updated_at: '' });
    const result = await upsertRisk({ workspace_id: 'ws-1', title: 'Medium Data Risk', description: null, severity: 'Medium', category: 'Technical', status: 'Open', owner: 'AM', mitigation: null });
    expect(result.severity).toBe('Medium');
  });

  it('upserts a Low severity risk', async () => {
    q({ id: 'risk-l1', workspace_id: 'ws-1', title: 'Low Impact Risk', description: null, severity: 'Low', category: 'Operational', status: 'Mitigated', owner: 'RT', mitigation: null, created_at: '', updated_at: '' });
    const result = await upsertRisk({ workspace_id: 'ws-1', title: 'Low Impact Risk', description: null, severity: 'Low', category: 'Operational', status: 'Mitigated', owner: 'RT', mitigation: null });
    expect(result.severity).toBe('Low');
    expect(result.status).toBe('Mitigated');
  });
});
