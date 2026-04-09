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
