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
  ReportRow, ReportInsert,
  ActivityRow, ActivityInsert,
  AutomationRow, AutomationInsert, AutomationUpdate,
  AutomationRunRow, AutomationRunInsert, AutomationRunUpdate,
  AutomationRunSectionRow, AutomationRunSectionInsert,
  BoardDecisionRow, BoardDecisionInsert,
  TeamMemberRow, TeamMemberInsert, TeamMemberUpdate,
  RagStatusWithWorkspace,
  ApprovalRow, ApprovalInsert,
  ChatThreadRow, ChatThreadInsert,
} from './database.types';

export type {
  WorkspaceRow, WorkspaceFinancialRow, WorkspaceRagStatusRow, MilestoneRow,
  DocumentRow, MeetingRow, TaskRow, RiskRow, ReportRow, ReportInsert, ActivityRow,
  AutomationRow, AutomationRunRow, AutomationRunSectionRow,
  BoardDecisionRow, TeamMemberRow, RagStatusWithWorkspace,
  ApprovalRow, ChatThreadRow,
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

// Fetch RAG statuses joined with workspace name for Dashboard display
export async function getRagStatusWithWorkspaces(): Promise<RagStatusWithWorkspace[]> {
  const { data, error } = await supabase
    .from('workspace_rag_status')
    .select('workspace_id, rag, budget, schedule, risk, last_updated, workspaces(name)');
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{
    workspace_id: string;
    rag: 'Green' | 'Amber' | 'Red';
    budget: 'Green' | 'Amber' | 'Red';
    schedule: 'Green' | 'Amber' | 'Red';
    risk: 'Green' | 'Amber' | 'Red';
    last_updated: string;
    workspaces: { name: string } | null;
  }>).map(row => ({
    workspace_id: row.workspace_id,
    workspace: row.workspaces?.name ?? row.workspace_id,
    rag: row.rag,
    budget: row.budget,
    schedule: row.schedule,
    risk: row.risk,
    lastUpdated: row.last_updated,
  }));
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

// ── Automations ──────────────────────────────────────────────
export async function getAutomations(): Promise<AutomationRow[]> {
  const { data, error } = await supabase.from('automations').select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AutomationRow[];
}

export async function getAutomation(id: string): Promise<AutomationRow | null> {
  const { data, error } = await supabase.from('automations').select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data as AutomationRow | null;
}

export async function upsertAutomation(automation: AutomationInsert): Promise<AutomationRow> {
  const { data, error } = await supabase.from('automations').upsert(automation as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as AutomationRow;
}

export async function updateAutomation(id: string, update: AutomationUpdate): Promise<AutomationRow> {
  const { data, error } = await supabase.from('automations').update(update as Record<string, unknown>).eq('id', id).select().single();
  if (error) throw error;
  return data as AutomationRow;
}

export async function deleteAutomation(id: string): Promise<void> {
  const { error } = await supabase.from('automations').delete().eq('id', id);
  if (error) throw error;
}

// ── Automation Runs ──────────────────────────────────────────
export async function createAutomationRun(run: AutomationRunInsert): Promise<AutomationRunRow> {
  const { data, error } = await supabase.from('automation_runs').insert(run as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as AutomationRunRow;
}

export async function updateAutomationRun(id: string, update: AutomationRunUpdate): Promise<AutomationRunRow> {
  const { data, error } = await supabase.from('automation_runs').update(update as Record<string, unknown>).eq('id', id).select().single();
  if (error) throw error;
  return data as AutomationRunRow;
}

export async function getAutomationRuns(automationId: string): Promise<AutomationRunRow[]> {
  const { data, error } = await supabase
    .from('automation_runs')
    .select('*')
    .eq('automation_type', automationId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as AutomationRunRow[];
}

export async function createAutomationRunSection(section: AutomationRunSectionInsert): Promise<AutomationRunSectionRow> {
  const { data, error } = await supabase.from('automation_run_sections').insert(section as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as AutomationRunSectionRow;
}

// ── Board Decisions ──────────────────────────────────────────
export async function getBoardDecisions(): Promise<BoardDecisionRow[]> {
  const { data, error } = await supabase.from('board_decisions').select('*').order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BoardDecisionRow[];
}

export async function upsertBoardDecision(decision: BoardDecisionInsert): Promise<BoardDecisionRow> {
  const { data, error } = await supabase.from('board_decisions').upsert(decision as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as BoardDecisionRow;
}

export async function updateBoardDecision(id: string, update: Partial<BoardDecisionInsert>): Promise<BoardDecisionRow> {
  const { data, error } = await supabase.from('board_decisions').update(update as Record<string, unknown>).eq('id', id).select().single();
  if (error) throw error;
  return data as BoardDecisionRow;
}

// ── Team Members ─────────────────────────────────────────────
export async function getTeamMembers(): Promise<TeamMemberRow[]> {
  const { data, error } = await supabase.from('team_members').select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TeamMemberRow[];
}

export async function createTeamMember(member: TeamMemberInsert): Promise<TeamMemberRow> {
  const { data, error } = await supabase.from('team_members').insert(member as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as TeamMemberRow;
}

export async function updateTeamMember(id: string, update: TeamMemberUpdate): Promise<TeamMemberRow> {
  const { data, error } = await supabase.from('team_members').update(update as Record<string, unknown>).eq('id', id).select().single();
  if (error) throw error;
  return data as TeamMemberRow;
}

export async function deleteTeamMember(id: string): Promise<void> {
  const { error } = await supabase.from('team_members').delete().eq('id', id);
  if (error) throw error;
}

// ── Approvals ─────────────────────────────────────────────────
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

// ── Chat Threads ──────────────────────────────────────────────
export async function getChatThreads(): Promise<ChatThreadRow[]> {
  const { data, error } = await supabase.from('chat_threads').select('*').order('updated_at', { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []) as ChatThreadRow[];
}

export async function upsertChatThread(thread: ChatThreadInsert): Promise<ChatThreadRow> {
  const { data, error } = await supabase.from('chat_threads').upsert(thread as Record<string, unknown>).select().single();
  if (error) throw error;
  return data as ChatThreadRow;
}

export async function deleteChatThread(id: string): Promise<void> {
  const { error } = await supabase.from('chat_threads').delete().eq('id', id);
  if (error) throw error;
}
