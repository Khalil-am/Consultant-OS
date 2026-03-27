import { supabase } from './supabase';
import type {
  WorkspaceRow, WorkspaceInsert,
  WorkspaceFinancialRow, WorkspaceFinancialInsert,
  WorkspaceRagStatusRow, WorkspaceRagStatusInsert,
  MilestoneRow,
  DocumentRow, DocumentInsert,
  MeetingRow, MeetingInsert,
  TaskRow, TaskInsert, TaskUpdate,
  RiskRow, RiskInsert,
  ReportRow, ReportInsert,
  ActivityRow, ActivityInsert,
  ApprovalRow, ApprovalInsert,
  AutomationRunRow, AutomationRunInsert,
  UserRow, UserInsert,
} from './database.types';

export type {
  WorkspaceRow, WorkspaceFinancialRow, WorkspaceRagStatusRow, MilestoneRow,
  DocumentRow, MeetingRow, TaskRow, RiskRow, ReportRow, ReportInsert, ActivityRow,
  ApprovalRow, AutomationRunRow, UserRow,
};

// ── Workspaces ──────────────────────────────────────────────
export async function getWorkspaces(): Promise<WorkspaceRow[]> {
  const { data, error } = await supabase.from('workspaces').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkspaceRow[];
}

export async function getWorkspace(id: string): Promise<WorkspaceRow | null> {
  const { data, error } = await supabase.from('workspaces').select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data as WorkspaceRow | null;
}

export async function createWorkspace(ws: Partial<WorkspaceInsert>): Promise<WorkspaceRow> {
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

export async function upsertWorkspaceRagStatus(rag: WorkspaceRagStatusInsert): Promise<WorkspaceRagStatusRow> {
  const { data, error } = await supabase.from('workspace_rag_status').upsert(rag as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as WorkspaceRagStatusRow;
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
  if (error && error.code !== 'PGRST116') throw error;
  return data as DocumentRow | null;
}

export async function upsertDocument(doc: DocumentInsert): Promise<DocumentRow> {
  const { data, error } = await supabase.from('documents').upsert(doc as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as DocumentRow;
}

export async function updateDocument(id: string, update: Partial<DocumentInsert>): Promise<DocumentRow> {
  const { data, error } = await supabase.from('documents').update(update as Record<string, unknown>).eq('id', id).select().single();
  if (error) throw error;
  return data as DocumentRow;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) throw error;
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
  if (error && error.code !== 'PGRST116') throw error;
  return data as MeetingRow | null;
}

export async function upsertMeeting(mtg: MeetingInsert): Promise<MeetingRow> {
  const { data, error } = await supabase.from('meetings').upsert(mtg as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as MeetingRow;
}

export async function updateMeeting(id: string, update: Partial<MeetingInsert>): Promise<MeetingRow> {
  const { data, error } = await supabase.from('meetings').update(update as Record<string, unknown>).eq('id', id).select().single();
  if (error) throw error;
  return data as MeetingRow;
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await supabase.from('meetings').delete().eq('id', id);
  if (error) throw error;
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

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
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

export async function updateRisk(id: string, update: Partial<RiskInsert>): Promise<RiskRow> {
  const { data, error } = await supabase.from('risks').update(update as Record<string, unknown>).eq('id', id).select().single();
  if (error) throw error;
  return data as RiskRow;
}

export async function deleteRisk(id: string): Promise<void> {
  const { error } = await supabase.from('risks').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteMilestone(id: string): Promise<void> {
  const { error } = await supabase.from('milestones').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteWorkspace(id: string): Promise<void> {
  const { error } = await supabase.from('workspaces').delete().eq('id', id);
  if (error) throw error;
}

// ── Reports ──────────────────────────────────────────────────
export async function getReports(workspaceId?: string): Promise<ReportRow[]> {
  let query = supabase.from('reports').select('*').order('date', { ascending: false });
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ReportRow[];
}

export async function upsertReport(report: ReportInsert): Promise<ReportRow> {
  const { data, error } = await supabase.from('reports').upsert(report as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as ReportRow;
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase.from('reports').delete().eq('id', id);
  if (error) throw error;
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

// ── Approvals ────────────────────────────────────────────────
export async function getApprovals(): Promise<ApprovalRow[]> {
  const { data, error } = await supabase.from('approvals').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApprovalRow[];
}

export async function upsertApproval(approval: ApprovalInsert): Promise<ApprovalRow> {
  const { data, error } = await supabase.from('approvals').upsert(approval as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as ApprovalRow;
}

export async function updateApproval(id: string, update: Partial<ApprovalInsert>): Promise<ApprovalRow> {
  const { data, error } = await supabase.from('approvals').update(update as Record<string, unknown>).eq('id', id).select().single();
  if (error) throw error;
  return data as ApprovalRow;
}

// ── Automation Runs ──────────────────────────────────────────
export async function getAutomationRuns(automationId?: string): Promise<AutomationRunRow[]> {
  let query = supabase.from('automation_runs').select('*').order('run_at', { ascending: false }).limit(50);
  if (automationId) query = query.eq('automation_id', automationId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AutomationRunRow[];
}

export async function insertAutomationRun(run: AutomationRunInsert): Promise<AutomationRunRow> {
  const { data, error } = await supabase.from('automation_runs').insert(run as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as AutomationRunRow;
}

// ── Users ────────────────────────────────────────────────────
export async function getUsers(): Promise<UserRow[]> {
  const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserRow[];
}

export async function upsertUser(user: UserInsert): Promise<UserRow> {
  const { data, error } = await supabase.from('users').upsert(user as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as UserRow;
}

export async function updateUser(id: string, update: Partial<UserInsert>): Promise<UserRow> {
  const { data, error } = await supabase.from('users').update(update as Record<string, unknown>).eq('id', id).select().single();
  if (error) throw error;
  return data as UserRow;
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) throw error;
}
