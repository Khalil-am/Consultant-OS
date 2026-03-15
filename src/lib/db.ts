import { supabase } from './supabase';
import type {
  WorkspaceRow, WorkspaceInsert,
  WorkspaceFinancialRow, WorkspaceFinancialInsert,
  WorkspaceRagStatusRow,
  MilestoneRow,
  DocumentRow, DocumentInsert,
  MeetingRow, MeetingInsert,
  TaskRow, TaskInsert, TaskUpdate,
  RiskRow, RiskInsert,
  ReportRow,
  ActivityRow, ActivityInsert,
} from './database.types';

export type {
  WorkspaceRow, WorkspaceFinancialRow, WorkspaceRagStatusRow, MilestoneRow,
  DocumentRow, MeetingRow, TaskRow, RiskRow, ReportRow, ActivityRow,
};

// ── Workspaces ──────────────────────────────────────────────
export async function getWorkspaces(): Promise<WorkspaceRow[]> {
  const { data, error } = await supabase.from('workspaces').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkspaceRow[];
}

export async function getWorkspace(id: string): Promise<WorkspaceRow | null> {
  const { data, error } = await supabase.from('workspaces').select('*').eq('id', id).single();
  if (error) throw error;
  return data as WorkspaceRow | null;
}

export async function createWorkspace(ws: WorkspaceInsert): Promise<WorkspaceRow> {
  const { data, error } = await supabase.from('workspaces').insert(ws as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as WorkspaceRow;
}

export async function updateWorkspace(id: string, update: Partial<WorkspaceInsert>): Promise<WorkspaceRow> {
  const { data, error } = await supabase.from('workspaces').update(update as Record<string, unknown>).eq('id', id).select().single();
  if (error) throw error;
  return data as WorkspaceRow;
}

// ── Workspace Financials ─────────────────────────────────────
export async function getWorkspaceFinancials(): Promise<WorkspaceFinancialRow[]> {
  const { data, error } = await supabase.from('workspace_financials').select('*');
  if (error) throw error;
  return (data ?? []) as WorkspaceFinancialRow[];
}

export async function getWorkspaceFinancial(workspaceId: string): Promise<WorkspaceFinancialRow | null> {
  const { data, error } = await supabase.from('workspace_financials').select('*').eq('workspace_id', workspaceId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data as WorkspaceFinancialRow | null;
}

export async function upsertWorkspaceFinancial(fin: WorkspaceFinancialInsert): Promise<WorkspaceFinancialRow> {
  const { data, error } = await supabase.from('workspace_financials').upsert(fin as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as WorkspaceFinancialRow;
}

// ── Workspace RAG Status ──────────────────────────────────────
export async function getWorkspaceRagStatuses(): Promise<WorkspaceRagStatusRow[]> {
  const { data, error } = await supabase.from('workspace_rag_status').select('*');
  if (error) throw error;
  return (data ?? []) as WorkspaceRagStatusRow[];
}

export async function getWorkspaceRagStatus(workspaceId: string): Promise<WorkspaceRagStatusRow | null> {
  const { data, error } = await supabase.from('workspace_rag_status').select('*').eq('workspace_id', workspaceId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data as WorkspaceRagStatusRow | null;
}

// ── Milestones ────────────────────────────────────────────────
export async function getMilestones(workspaceId?: string): Promise<MilestoneRow[]> {
  let query = supabase.from('milestones').select('*').order('due_date', { ascending: true });
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MilestoneRow[];
}

export async function upsertMilestone(ms: Omit<MilestoneRow, 'created_at' | 'updated_at'>): Promise<MilestoneRow> {
  const { data, error } = await supabase.from('milestones').upsert(ms as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as MilestoneRow;
}

// ── Documents ────────────────────────────────────────────────
export async function getDocuments(workspaceId?: string): Promise<DocumentRow[]> {
  let query = supabase.from('documents').select('*').order('date', { ascending: false });
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DocumentRow[];
}

export async function getDocument(id: string): Promise<DocumentRow | null> {
  const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
  if (error) throw error;
  return data as DocumentRow | null;
}

export async function upsertDocument(doc: DocumentInsert): Promise<DocumentRow> {
  const { data, error } = await supabase.from('documents').upsert(doc as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as DocumentRow;
}

// ── Meetings ─────────────────────────────────────────────────
export async function getMeetings(workspaceId?: string): Promise<MeetingRow[]> {
  let query = supabase.from('meetings').select('*').order('date', { ascending: false });
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MeetingRow[];
}

export async function getMeeting(id: string): Promise<MeetingRow | null> {
  const { data, error } = await supabase.from('meetings').select('*').eq('id', id).single();
  if (error) throw error;
  return data as MeetingRow | null;
}

export async function upsertMeeting(mtg: MeetingInsert): Promise<MeetingRow> {
  const { data, error } = await supabase.from('meetings').upsert(mtg as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as MeetingRow;
}

// ── Tasks ────────────────────────────────────────────────────
export async function getTasks(workspaceId?: string): Promise<TaskRow[]> {
  let query = supabase.from('tasks').select('*').order('due_date', { ascending: true });
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TaskRow[];
}

export async function upsertTask(task: TaskInsert): Promise<TaskRow> {
  const { data, error } = await supabase.from('tasks').upsert(task as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as TaskRow;
}

export async function updateTask(id: string, update: TaskUpdate): Promise<TaskRow> {
  const { data, error } = await supabase.from('tasks').update(update as Record<string, unknown>).eq('id', id).select().single();
  if (error) throw error;
  return data as TaskRow;
}

// ── Risks ────────────────────────────────────────────────────
export async function getRisks(workspaceId?: string): Promise<RiskRow[]> {
  let query = supabase.from('risks').select('*').order('date_identified', { ascending: false });
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as RiskRow[];
}

export async function upsertRisk(risk: RiskInsert): Promise<RiskRow> {
  const { data, error } = await supabase.from('risks').upsert(risk as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as RiskRow;
}

// ── Reports ──────────────────────────────────────────────────
export async function getReports(workspaceId?: string): Promise<ReportRow[]> {
  let query = supabase.from('reports').select('*').order('date', { ascending: false });
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ReportRow[];
}

// ── Activities ───────────────────────────────────────────────
export async function getActivities(limit = 20): Promise<ActivityRow[]> {
  const { data, error } = await supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as ActivityRow[];
}

export async function insertActivity(activity: ActivityInsert): Promise<void> {
  const { error } = await supabase.from('activities').insert(activity as Record<string, unknown>);
  if (error) throw error;
}
