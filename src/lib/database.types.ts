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
  status: 'Active' | 'On Hold' | 'Completed';
  docs_count: number;
  meetings_count: number;
  tasks_count: number;
  contributors: string[];
  last_activity: string;
  description: string;
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
  time: string;
  type: string;
  created_at: string;
}

export interface WorkspaceFinancialRow {
  id: string;
  workspace_id: string;
  workspace_name: string;
  contract_value: number;
  invoiced: number;
  collected: number;
  outstanding: number;
  budget_spent: number;
  budget_total: number;
  forecast_completion: number;
  rag_status: 'Green' | 'Amber' | 'Red';
  created_at: string;
  updated_at: string;
}

// ── Insert types (omit server-generated fields) ──────────────
export type WorkspaceInsert = Omit<WorkspaceRow, 'created_at' | 'updated_at'>;
export type DocumentInsert = Omit<DocumentRow, 'created_at' | 'updated_at'>;
export type MeetingInsert = Omit<MeetingRow, 'created_at' | 'updated_at'>;
export type TaskInsert = Omit<TaskRow, 'created_at' | 'updated_at'>;
export type RiskInsert = Omit<RiskRow, 'created_at' | 'updated_at'>;
export type ReportInsert = Omit<ReportRow, 'created_at' | 'updated_at'>;
export type ActivityInsert = Omit<ActivityRow, 'created_at'>;
export type WorkspaceFinancialInsert = Omit<WorkspaceFinancialRow, 'created_at' | 'updated_at'>;

// ── Update types ─────────────────────────────────────────────
export type TaskUpdate = Partial<TaskInsert>;

// ── Database interface for createClient<Database> ────────────
export interface Database {
  public: {
    Tables: {
      workspaces: { Row: WorkspaceRow; Insert: WorkspaceInsert; Update: Partial<WorkspaceInsert> };
      documents: { Row: DocumentRow; Insert: DocumentInsert; Update: Partial<DocumentInsert> };
      meetings: { Row: MeetingRow; Insert: MeetingInsert; Update: Partial<MeetingInsert> };
      tasks: { Row: TaskRow; Insert: TaskInsert; Update: Partial<TaskInsert> };
      risks: { Row: RiskRow; Insert: RiskInsert; Update: Partial<RiskInsert> };
      reports: { Row: ReportRow; Insert: ReportInsert; Update: Partial<ReportInsert> };
      activities: { Row: ActivityRow; Insert: ActivityInsert; Update: Partial<ActivityInsert> };
      workspace_financials: { Row: WorkspaceFinancialRow; Insert: WorkspaceFinancialInsert; Update: Partial<WorkspaceFinancialInsert> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
