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
  getWorkspaces, getWorkspace, createWorkspace, updateWorkspace,
  getMeetings, upsertMeeting, updateMeeting, deleteMeeting,
  getDocuments, upsertDocument, updateDocument, deleteDocument,
  getTasks, upsertTask, updateTask, deleteTask,
  getReports, upsertReport, deleteReport,
  getActivities,
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
    const result = await createWorkspace({ name: 'New WS', type: 'BA', status: 'Active', progress: 0, language: 'EN', sector: 'Gov', contributors: [] });
    expect(result.id).toBe('new-id');
  });

  it('throws on insert error', async () => {
    q(null, { message: 'Unique constraint violation', code: '23505' });
    await expect(createWorkspace({ name: 'Dup', type: 'BA', status: 'Active', progress: 0, language: 'EN', sector: 'Gov', contributors: [] }))
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
    const mtg = { id: 'm1', title: 'Kickoff', type: 'Kickoff' as const, date: '2026-03-20', time: '09:00', duration: '1h', workspace: 'MOCI', workspace_id: 'ws-1', location: null, participants: null, status: 'Upcoming' as const, agenda: null, notes: null, attachments: null, action_items: null };
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
    const task = { id: 't1', title: 'Draft proposal', status: 'Todo' as const, priority: 'Medium' as const, workspace: 'MOCI', workspace_id: 'ws-1', assignee: null, due_date: null, tags: null, column: 'Todo', description: null };
    expect((await upsertTask(task)).status).toBe('Todo');
  });
});

// ── updateTask ───────────────────────────────────────────────
describe('updateTask', () => {
  it('moves task to Done', async () => {
    q({ id: 't1', status: 'Done' });
    expect((await updateTask('t1', { status: 'Done' })).status).toBe('Done');
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
});
