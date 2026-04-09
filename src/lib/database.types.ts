export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ── Row types ────────────────────────────────────────────────
export interface WorkspaceRow {
  id: string;
  name: string;
  client: string;
  sector: string;
  sector_color: string;
  type: 'Client' | 'Project' | 'Internal' | 'Procurement' | 'Committee';
  language: 'EN' | 'AR' | 'Bilingual';
  progress: number;
  status: 'Active' | 'On Hold' | 'Completed' | 'At Risk';
  docs_count: number;
  meetings_count: number;
  tasks_count: number;
  risks_count?: number | null;
  issues_count?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  contributors: string[];
  last_activity: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceFinancialRow {
  id: string;
  workspace_id: string;
  workspace_name: string;
  contract_value: number;
  spent: number;
  forecast: number;
  variance: number;
  currency: string;
  billing_model: string;
  last_invoice: string;
  next_milestone_value: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceRagStatusRow {
  id: string;
  workspace_id: string;
  rag: 'Green' | 'Amber' | 'Red';
  budget: 'Green' | 'Amber' | 'Red';
  schedule: 'Green' | 'Amber' | 'Red';
  risk: 'Green' | 'Amber' | 'Red';
  last_updated: string;
  created_at: string;
  updated_at: string;
}

export interface MilestoneRow {
  id: string;
  workspace_id: string;
  title: string;
  due_date: string;
  status: 'Completed' | 'On Track' | 'At Risk' | 'Delayed' | 'Upcoming';
  value: number;
  owner: string;
  completion_pct: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  name: string;
  type: string;
  type_color: string;
  workspace: string;
  workspace_id: string;
  date: string;
  language: 'EN' | 'AR' | 'Bilingual';
  status: 'Draft' | 'Approved' | 'Under Review' | 'Final';
  size: string;
  author: string;
  pages: number;
  summary: string;
  tags: string[];
  file_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingRow {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  type: 'Workshop' | 'Committee' | 'Steering' | 'Review' | 'Kickoff' | 'Standup';
  status: 'Upcoming' | 'In Progress' | 'Completed';
  participants: string[];
  workspace: string;
  workspace_id: string;
  minutes_generated: boolean;
  actions_extracted: number;
  decisions_logged: number;
  location: string | null;
  agenda: string[] | null;
  quorum_status: 'Met' | 'Not Met' | null;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  title: string;
  workspace: string;
  workspace_id: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Backlog' | 'In Progress' | 'In Review' | 'Completed' | 'Overdue';
  due_date: string;
  assignee: string;
  linked_doc: string | null;
  linked_meeting: string | null;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface RiskRow {
  id: string;
  title: string;
  workspace: string;
  workspace_id: string;
  probability: number;
  impact: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Mitigated' | 'Closed' | 'Monitoring';
  owner: string;
  mitigation: string;
  date_identified: string;
  category: string;
  financial_exposure: number | null;
  created_at: string;
  updated_at: string;
}

export interface ReportRow {
  id: string;
  title: string;
  type: string;
  type_color: string;
  workspace: string;
  workspace_id: string | null;
  date: string;
  status: 'Generated' | 'Scheduled' | 'Draft';
  pages: number;
  period: string;
  author: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityRow {
  id: string;
  user: string;
  action: string;
  target: string;
  workspace: string | null;
  workspace_id: string | null;
  time: string;
  type: string;
  created_at: string;
}

// ── Insert types ─────────────────────────────────────────────
export type WorkspaceInsert = Omit<WorkspaceRow, 'created_at' | 'updated_at'>;
export type WorkspaceFinancialInsert = Omit<WorkspaceFinancialRow, 'created_at' | 'updated_at'>;
export type WorkspaceRagStatusInsert = Omit<WorkspaceRagStatusRow, 'created_at' | 'updated_at'>;
export type MilestoneInsert = Omit<MilestoneRow, 'created_at' | 'updated_at'>;
export type DocumentInsert = Omit<DocumentRow, 'created_at' | 'updated_at'>;
export type MeetingInsert = Omit<MeetingRow, 'created_at' | 'updated_at'>;
export type TaskInsert = Omit<TaskRow, 'created_at' | 'updated_at'>;
export type TaskUpdate = Partial<TaskInsert>;
export type RiskInsert = Omit<RiskRow, 'created_at' | 'updated_at'>;
export type ReportInsert = Omit<ReportRow, 'created_at' | 'updated_at'>;
export type ActivityInsert = Omit<ActivityRow, 'created_at'>;

// ── Automation (catalog) ─────────────────────────────────────
export interface AutomationRow {
  id: string;
  name: string;
  description: string;
  category: string;
  category_color: string;
  input_type: string;
  output_type: string;
  run_count: number;
  last_run: string;
  status: 'Active' | 'Draft' | 'Paused';
  starred: boolean;
  success_rate: number;
  created_at: string;
  updated_at: string;
}
export type AutomationInsert = Omit<AutomationRow, 'created_at' | 'updated_at'>;
export type AutomationUpdate = Partial<AutomationInsert>;

// ── Automation Run ───────────────────────────────────────────
export type AutomationRunStatus =
  | 'draft' | 'queued' | 'running' | 'parsing' | 'quality_check'
  | 'analyzing_sample' | 'extracting_requirements' | 'generating_sections'
  | 'validating' | 'exporting' | 'completed' | 'needs_review' | 'failed';

export interface AutomationRunRow {
  id: string;
  workspace_id: string | null;
  user_id: string;
  automation_type: string;
  prompt_template_id: string | null;
  status: AutomationRunStatus;
  options_json: string;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
export type AutomationRunInsert = Omit<AutomationRunRow, 'created_at' | 'updated_at'>;
export type AutomationRunUpdate = Partial<AutomationRunInsert>;

export interface AutomationRunSectionRow {
  id: string;
  run_id: string;
  section_name: string;
  section_index: number;
  status: 'draft' | 'approved' | 'rejected' | 'regenerating';
  content: string;
  confidence: number;
  validation_notes: string;
  created_at: string;
  updated_at: string;
}
export type AutomationRunSectionInsert = Omit<AutomationRunSectionRow, 'id' | 'created_at' | 'updated_at'>;

// ── Board Decision ────────────────────────────────────────────
export interface BoardDecisionRow {
  id: string;
  title: string;
  committee: string;
  date: string;
  status: 'Closed' | 'Pending Implementation' | 'Deferred' | 'In Progress';
  owner: string;
  due_date: string;
  workspace_id: string | null;
  priority: 'Critical' | 'High' | 'Medium';
  created_at: string;
  updated_at: string;
}
export type BoardDecisionInsert = Omit<BoardDecisionRow, 'created_at' | 'updated_at'>;

// ── Team Member ───────────────────────────────────────────────
export interface TeamMemberRow {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Consultant' | 'Manager' | 'Viewer' | 'Analyst';
  workspaces_count: number;
  last_active: string;
  status: 'Active' | 'Inactive';
  initials: string;
  created_at: string;
  updated_at: string;
}
export type TeamMemberInsert = Omit<TeamMemberRow, 'created_at' | 'updated_at'>;
export type TeamMemberUpdate = Partial<TeamMemberInsert>;

// ── RAG Status with workspace name (joined) ───────────────────
export interface RagStatusWithWorkspace {
  workspace_id: string;
  workspace: string; // workspace name
  rag: 'Green' | 'Amber' | 'Red';
  budget: 'Green' | 'Amber' | 'Red';
  schedule: 'Green' | 'Amber' | 'Red';
  risk: 'Green' | 'Amber' | 'Red';
  lastUpdated: string;
}

// ── Approvals ─────────────────────────────────────────────────
export interface ApprovalRow {
  id: string;
  title: string;
  requester: string;
  type: string;
  urgency: 'High' | 'Medium' | 'Low';
  status: 'pending' | 'approved' | 'rejected';
  workspace_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export type ApprovalInsert = Omit<ApprovalRow, 'created_at' | 'updated_at'>;

// ── Chat Threads ──────────────────────────────────────────────
export interface ChatThreadRow {
  id: string;
  title: string;
  persona_id: string;
  model_id: string;
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string; persona?: string; model?: string }>;
  time: string;
  created_at: string;
  updated_at: string;
}
export type ChatThreadInsert = Omit<ChatThreadRow, 'created_at' | 'updated_at'>;
