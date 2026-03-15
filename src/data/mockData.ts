// ============================================================
// CONSULTANT OS – Mock Data
// ============================================================

export interface Workspace {
  id: string;
  name: string;
  client: string;
  sector: string;
  sectorColor: string;
  type: 'Client' | 'Project' | 'Internal' | 'Procurement' | 'Committee';
  language: 'EN' | 'AR' | 'Bilingual';
  progress: number;
  status: 'Active' | 'On Hold' | 'Completed';
  docsCount: number;
  meetingsCount: number;
  tasksCount: number;
  contributors: string[];
  lastActivity: string;
  description: string;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryColor: string;
  inputType: string;
  outputType: string;
  runCount: number;
  lastRun: string;
  status: 'Active' | 'Draft' | 'Paused';
  starred: boolean;
  successRate: number;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  typeColor: string;
  workspace: string;
  workspaceId: string;
  date: string;
  language: 'EN' | 'AR' | 'Bilingual';
  status: 'Draft' | 'Approved' | 'Under Review' | 'Final';
  size: string;
  author: string;
  pages: number;
  summary: string;
  tags: string[];
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  type: 'Workshop' | 'Committee' | 'Steering' | 'Review' | 'Kickoff' | 'Standup';
  status: 'Upcoming' | 'In Progress' | 'Completed';
  participants: string[];
  workspace: string;
  workspaceId: string;
  minutesGenerated?: boolean;
  actionsExtracted?: number;
  decisionsLogged?: number;
  location?: string;
  agenda?: string[];
  quorumStatus?: 'Met' | 'Not Met';
}

export interface Task {
  id: string;
  title: string;
  workspace: string;
  workspaceId: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Backlog' | 'In Progress' | 'In Review' | 'Completed' | 'Overdue';
  dueDate: string;
  assignee: string;
  linkedDoc?: string;
  linkedMeeting?: string;
  description: string;
}

export interface Risk {
  id: string;
  title: string;
  workspace: string;
  probability: number;
  impact: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Mitigated' | 'Closed' | 'Monitoring';
  owner: string;
  mitigation: string;
  dateIdentified: string;
  category: string;
}

export interface Report {
  id: string;
  title: string;
  type: string;
  typeColor: string;
  workspace: string;
  date: string;
  status: 'Generated' | 'Scheduled' | 'Draft';
  pages: number;
  period: string;
  author: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  formats: string[];
  languages: string[];
  usageCount: number;
  featured: boolean;
  icon: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Consultant' | 'Manager' | 'Viewer' | 'Analyst';
  workspacesCount: number;
  lastActive: string;
  status: 'Active' | 'Inactive';
  avatar: string;
}

// ============================================================
// WORKSPACES
// ============================================================
export const workspaces: Workspace[] = [
  {
    id: 'ws-001',
    name: 'NCA Digital Transformation Program',
    client: 'National Communications Authority',
    sector: 'Government',
    sectorColor: '#0EA5E9',
    type: 'Client',
    language: 'Bilingual',
    progress: 68,
    status: 'Active',
    docsCount: 124,
    meetingsCount: 38,
    tasksCount: 47,
    contributors: ['AM', 'SK', 'RT', 'JL'],
    lastActivity: '2 hours ago',
    description: 'End-to-end digital transformation initiative covering enterprise architecture, process automation, and citizen service delivery modernization.',
  },
  {
    id: 'ws-002',
    name: 'ADNOC Supply Chain Optimization',
    client: 'Abu Dhabi National Oil Company',
    sector: 'Energy',
    sectorColor: '#F59E0B',
    type: 'Client',
    language: 'EN',
    progress: 45,
    status: 'Active',
    docsCount: 89,
    meetingsCount: 22,
    tasksCount: 31,
    contributors: ['MK', 'AS', 'DN'],
    lastActivity: '5 hours ago',
    description: 'Supply chain process re-engineering and ERP integration for upstream and midstream operations.',
  },
  {
    id: 'ws-003',
    name: 'MOCI Procurement Reform',
    client: 'Ministry of Commerce & Industry',
    sector: 'Government',
    sectorColor: '#0EA5E9',
    type: 'Procurement',
    language: 'Bilingual',
    progress: 82,
    status: 'Active',
    docsCount: 203,
    meetingsCount: 51,
    tasksCount: 18,
    contributors: ['AM', 'RT', 'FH', 'YA'],
    lastActivity: '1 day ago',
    description: 'Public procurement framework redesign and digital tendering platform implementation.',
  },
  {
    id: 'ws-004',
    name: 'Healthcare Digital Strategy',
    client: 'Regional Health Authority',
    sector: 'Healthcare',
    sectorColor: '#10B981',
    type: 'Client',
    language: 'EN',
    progress: 30,
    status: 'Active',
    docsCount: 56,
    meetingsCount: 14,
    tasksCount: 62,
    contributors: ['SK', 'PL', 'MN'],
    lastActivity: '3 hours ago',
    description: 'Five-year digital health strategy encompassing EMR integration, telemedicine, and AI diagnostics roadmap.',
  },
  {
    id: 'ws-005',
    name: 'Smart City Infrastructure PMO',
    client: 'Urban Development Authority',
    sector: 'Infrastructure',
    sectorColor: '#8B5CF6',
    type: 'Project',
    language: 'Bilingual',
    progress: 55,
    status: 'Active',
    docsCount: 178,
    meetingsCount: 67,
    tasksCount: 93,
    contributors: ['AM', 'JL', 'AS', 'KP', 'RT'],
    lastActivity: '30 min ago',
    description: 'Programme management office for AED 4.2B smart city infrastructure across 12 concurrent projects.',
  },
  {
    id: 'ws-006',
    name: 'Banking Core Transformation',
    client: 'Emirates National Bank',
    sector: 'Financial Services',
    sectorColor: '#F59E0B',
    type: 'Client',
    language: 'EN',
    progress: 91,
    status: 'Active',
    docsCount: 312,
    meetingsCount: 89,
    tasksCount: 12,
    contributors: ['DN', 'MK', 'SK'],
    lastActivity: '6 hours ago',
    description: 'Core banking system migration from legacy mainframe to cloud-native microservices architecture.',
  },
  {
    id: 'ws-007',
    name: 'Internal Quality Framework',
    client: 'Accel Consulting',
    sector: 'Internal',
    sectorColor: '#94A3B8',
    type: 'Internal',
    language: 'EN',
    progress: 75,
    status: 'Active',
    docsCount: 44,
    meetingsCount: 12,
    tasksCount: 9,
    contributors: ['AM', 'SK'],
    lastActivity: '2 days ago',
    description: 'ISO 9001 certification program and internal consulting quality assurance framework.',
  },
  {
    id: 'ws-008',
    name: 'Retail Digital Commerce',
    client: 'Gulf Retail Holdings',
    sector: 'Retail',
    sectorColor: '#EC4899',
    type: 'Client',
    language: 'Bilingual',
    progress: 22,
    status: 'Active',
    docsCount: 34,
    meetingsCount: 8,
    tasksCount: 54,
    contributors: ['PL', 'FH'],
    lastActivity: '4 hours ago',
    description: 'Omnichannel commerce strategy and platform selection for 180-store regional retail chain.',
  },
];

// ============================================================
// AUTOMATIONS
// ============================================================
export const automations: Automation[] = [
  {
    id: 'auto-001',
    name: 'BRD Generator from Requirements',
    description: 'Transforms raw stakeholder requirements into structured Business Requirements Documents with sections, use cases, and acceptance criteria.',
    category: 'BA & Requirements',
    categoryColor: '#0EA5E9',
    inputType: 'Requirements Doc / Meeting Notes',
    outputType: 'BRD (Word/PDF)',
    runCount: 287,
    lastRun: '2 hours ago',
    status: 'Active',
    starred: true,
    successRate: 96,
  },
  {
    id: 'auto-002',
    name: 'Meeting Minutes Generator',
    description: 'Processes meeting transcripts or notes to produce formatted minutes with decisions, actions, owners, and due dates.',
    category: 'Meetings',
    categoryColor: '#8B5CF6',
    inputType: 'Audio / Transcript / Notes',
    outputType: 'Minutes (Word/PDF)',
    runCount: 512,
    lastRun: '45 min ago',
    status: 'Active',
    starred: true,
    successRate: 99,
  },
  {
    id: 'auto-003',
    name: 'User Story Generator',
    description: 'Converts functional requirements into Agile user stories with acceptance criteria, priority tags, and story point estimates.',
    category: 'Product',
    categoryColor: '#10B981',
    inputType: 'FRD / Feature List',
    outputType: 'User Stories (Jira/Excel)',
    runCount: 189,
    lastRun: '1 day ago',
    status: 'Active',
    starred: false,
    successRate: 94,
  },
  {
    id: 'auto-004',
    name: 'RFP Evaluation Scorecard',
    description: 'Evaluates vendor proposals against weighted criteria and generates scoring matrix with narrative justifications.',
    category: 'Procurement',
    categoryColor: '#F59E0B',
    inputType: 'RFP + Vendor Proposals',
    outputType: 'Evaluation Report (Excel/PDF)',
    runCount: 73,
    lastRun: '3 days ago',
    status: 'Active',
    starred: true,
    successRate: 98,
  },
  {
    id: 'auto-005',
    name: 'Weekly Status Report',
    description: 'Aggregates project tasks, milestones, risks, and decisions to produce executive-ready weekly status reports.',
    category: 'Reporting',
    categoryColor: '#EC4899',
    inputType: 'Tasks + Risks + Workspace Data',
    outputType: 'Status Report (PDF/PPT)',
    runCount: 441,
    lastRun: '3 hours ago',
    status: 'Active',
    starred: false,
    successRate: 97,
  },
  {
    id: 'auto-006',
    name: 'Risk Register Analyzer',
    description: 'Reviews project data and meeting notes to identify, classify, and score risks with mitigation recommendations.',
    category: 'PMO',
    categoryColor: '#EF4444',
    inputType: 'Project Docs + Meeting Notes',
    outputType: 'Risk Register (Excel/PDF)',
    runCount: 134,
    lastRun: '1 day ago',
    status: 'Active',
    starred: false,
    successRate: 91,
  },
  {
    id: 'auto-007',
    name: 'Decision Log Extractor',
    description: 'Scans meeting minutes and notes to extract and categorize all decisions with owners, rationale, and implications.',
    category: 'Meetings',
    categoryColor: '#8B5CF6',
    inputType: 'Meeting Minutes / Notes',
    outputType: 'Decision Log (Excel/PDF)',
    runCount: 256,
    lastRun: '6 hours ago',
    status: 'Active',
    starred: false,
    successRate: 99,
  },
  {
    id: 'auto-008',
    name: 'Bilingual Document Translator',
    description: 'Translates consulting deliverables between Arabic and English while preserving formatting, tone, and technical terminology.',
    category: 'Knowledge',
    categoryColor: '#06B6D4',
    inputType: 'Any Document (EN or AR)',
    outputType: 'Translated Doc (same format)',
    runCount: 198,
    lastRun: '4 hours ago',
    status: 'Active',
    starred: true,
    successRate: 95,
  },
  {
    id: 'auto-009',
    name: 'Steering Committee Pack',
    description: 'Compiles programme updates, KPIs, decisions required, and risks into a boardroom-ready steering committee presentation.',
    category: 'PMO',
    categoryColor: '#EF4444',
    inputType: 'Workspace Data + Reports',
    outputType: 'SC Pack (PowerPoint/PDF)',
    runCount: 89,
    lastRun: '5 days ago',
    status: 'Active',
    starred: true,
    successRate: 93,
  },
  {
    id: 'auto-010',
    name: 'Knowledge Base Indexer',
    description: 'Processes and indexes new documents into the semantic knowledge base, extracting entities, decisions, and requirements.',
    category: 'Knowledge',
    categoryColor: '#06B6D4',
    inputType: 'Any Document',
    outputType: 'Knowledge Base Update',
    runCount: 1024,
    lastRun: '15 min ago',
    status: 'Active',
    starred: false,
    successRate: 99,
  },
  {
    id: 'auto-011',
    name: 'Gap Analysis Generator',
    description: 'Compares current state documentation against target state requirements to produce structured gap analysis reports.',
    category: 'BA & Requirements',
    categoryColor: '#0EA5E9',
    inputType: 'As-Is Docs + To-Be Requirements',
    outputType: 'Gap Analysis (Word/PDF)',
    runCount: 67,
    lastRun: '2 days ago',
    status: 'Active',
    starred: false,
    successRate: 92,
  },
  {
    id: 'auto-012',
    name: 'Email Digest Summarizer',
    description: 'Summarizes email threads and stakeholder communications into actionable briefings with follow-up recommendations.',
    category: 'Productivity',
    categoryColor: '#64748B',
    inputType: 'Email Thread / Inbox',
    outputType: 'Summary Brief (text/PDF)',
    runCount: 334,
    lastRun: '1 hour ago',
    status: 'Active',
    starred: false,
    successRate: 97,
  },
  {
    id: 'auto-013',
    name: 'Procurement Notice Classifier',
    description: 'Classifies and routes incoming procurement notices and RFPs to relevant workspaces with key date extraction.',
    category: 'Procurement',
    categoryColor: '#F59E0B',
    inputType: 'Procurement Portal / Email',
    outputType: 'Classified Notice + Calendar Entry',
    runCount: 145,
    lastRun: '12 hours ago',
    status: 'Active',
    starred: false,
    successRate: 98,
  },
  {
    id: 'auto-014',
    name: 'FRD to Test Cases',
    description: 'Generates comprehensive test case suites from Functional Requirements Documents with expected results and test data.',
    category: 'Product',
    categoryColor: '#10B981',
    inputType: 'FRD Document',
    outputType: 'Test Cases (Excel/TestRail)',
    runCount: 92,
    lastRun: '3 days ago',
    status: 'Draft',
    starred: false,
    successRate: 88,
  },
];

// ============================================================
// DOCUMENTS
// ============================================================
export const documents: Document[] = [
  {
    id: 'doc-001',
    name: 'NCA Enterprise Architecture BRD v2.3',
    type: 'BRD',
    typeColor: '#0EA5E9',
    workspace: 'NCA Digital Transformation',
    workspaceId: 'ws-001',
    date: '2026-03-12',
    language: 'EN',
    status: 'Under Review',
    size: '2.4 MB',
    author: 'Ahmed Al-Mahmoud',
    pages: 87,
    summary: 'Comprehensive business requirements for NCA enterprise architecture overhaul covering 14 functional areas and 312 requirements.',
    tags: ['Architecture', 'Requirements', 'Phase 2'],
  },
  {
    id: 'doc-002',
    name: 'ADNOC Supply Chain Process Map',
    type: 'FRD',
    typeColor: '#8B5CF6',
    workspace: 'ADNOC Supply Chain',
    workspaceId: 'ws-002',
    date: '2026-03-10',
    language: 'EN',
    status: 'Approved',
    size: '5.1 MB',
    author: 'Sara Al-Khalidi',
    pages: 134,
    summary: 'Functional requirements for integrated supply chain management covering procurement, inventory, logistics, and vendor management.',
    tags: ['Supply Chain', 'Process', 'Integration'],
  },
  {
    id: 'doc-003',
    name: 'MOCI Steering Committee Minutes – March 2026',
    type: 'Minutes',
    typeColor: '#10B981',
    workspace: 'MOCI Procurement Reform',
    workspaceId: 'ws-003',
    date: '2026-03-08',
    language: 'Bilingual',
    status: 'Approved',
    size: '890 KB',
    author: 'Rania Taher',
    pages: 18,
    summary: 'Minutes from SC-09 covering digital tendering milestone approval, budget reallocation, and vendor shortlist ratification.',
    tags: ['Committee', 'Decisions', 'March 2026'],
  },
  {
    id: 'doc-004',
    name: 'Healthcare Digital Strategy – Phase 1 Report',
    type: 'Report',
    typeColor: '#F59E0B',
    workspace: 'Healthcare Digital Strategy',
    workspaceId: 'ws-004',
    date: '2026-03-05',
    language: 'EN',
    status: 'Draft',
    size: '3.7 MB',
    author: 'James Liu',
    pages: 56,
    summary: 'Phase 1 assessment covering current state maturity, quick wins identified, and 18-month digital health roadmap.',
    tags: ['Strategy', 'Phase 1', 'Roadmap'],
  },
  {
    id: 'doc-005',
    name: 'Smart City Risk Register v4',
    type: 'Risk Register',
    typeColor: '#EF4444',
    workspace: 'Smart City Infrastructure PMO',
    workspaceId: 'ws-005',
    date: '2026-03-13',
    language: 'EN',
    status: 'Under Review',
    size: '1.2 MB',
    author: 'Ahmed Al-Mahmoud',
    pages: 34,
    summary: 'Consolidated risk register for 12 smart city projects with 47 identified risks, 12 high/critical items requiring immediate action.',
    tags: ['Risk', 'PMO', 'Infrastructure'],
  },
  {
    id: 'doc-006',
    name: 'ENB Core Banking – Technical Architecture',
    type: 'Technical Spec',
    typeColor: '#06B6D4',
    workspace: 'Banking Core Transformation',
    workspaceId: 'ws-006',
    date: '2026-02-28',
    language: 'EN',
    status: 'Approved',
    size: '8.9 MB',
    author: 'David Nkosi',
    pages: 213,
    summary: 'Cloud-native microservices architecture specification for core banking migration including API gateway, event sourcing, and DR strategy.',
    tags: ['Architecture', 'Cloud', 'Banking'],
  },
  {
    id: 'doc-007',
    name: 'MOCI Vendor Evaluation – Shortlist',
    type: 'Evaluation',
    typeColor: '#F59E0B',
    workspace: 'MOCI Procurement Reform',
    workspaceId: 'ws-003',
    date: '2026-03-11',
    language: 'Bilingual',
    status: 'Approved',
    size: '4.2 MB',
    author: 'Fatima Hassan',
    pages: 78,
    summary: 'Technical and commercial evaluation of 6 shortlisted vendors for digital tendering platform with weighted scoring matrix.',
    tags: ['Procurement', 'Vendor', 'Evaluation'],
  },
  {
    id: 'doc-008',
    name: 'NCA Digital Transformation – Project Charter',
    type: 'Charter',
    typeColor: '#8B5CF6',
    workspace: 'NCA Digital Transformation',
    workspaceId: 'ws-001',
    date: '2026-01-15',
    language: 'Bilingual',
    status: 'Approved',
    size: '1.8 MB',
    author: 'Ahmed Al-Mahmoud',
    pages: 42,
    summary: 'Programme charter defining scope, objectives, governance structure, and success KPIs for NCA digital transformation.',
    tags: ['Charter', 'Governance', 'Programme'],
  },
];

// ============================================================
// MEETINGS
// ============================================================
export const meetings: Meeting[] = [
  {
    id: 'mtg-001',
    title: 'NCA Architecture Review Workshop',
    date: '2026-03-18',
    time: '09:00',
    duration: '3 hours',
    type: 'Workshop',
    status: 'Upcoming',
    participants: ['AM', 'SK', 'RT', 'JL', 'FA'],
    workspace: 'NCA Digital Transformation',
    workspaceId: 'ws-001',
    location: 'NCA HQ – Boardroom A',
    agenda: [
      'Review Phase 2 architecture components',
      'Align on integration patterns',
      'Sign off on API gateway design',
      'Next steps and owners',
    ],
  },
  {
    id: 'mtg-002',
    title: 'MOCI Steering Committee – SC-10',
    date: '2026-03-20',
    time: '14:00',
    duration: '2 hours',
    type: 'Committee',
    status: 'Upcoming',
    participants: ['RT', 'FH', 'YA', 'MK', 'AS'],
    workspace: 'MOCI Procurement Reform',
    workspaceId: 'ws-003',
    location: 'MOCI HQ – Committee Room',
    quorumStatus: 'Met',
    agenda: [
      'Approval of SC-09 minutes',
      'Phase 3 budget approval',
      'Vendor selection ratification',
      'Timeline extension request',
    ],
  },
  {
    id: 'mtg-003',
    title: 'ADNOC ERP Integration Standup',
    date: '2026-03-15',
    time: '10:30',
    duration: '30 min',
    type: 'Standup',
    status: 'Completed',
    participants: ['MK', 'AS', 'DN'],
    workspace: 'ADNOC Supply Chain',
    workspaceId: 'ws-002',
    minutesGenerated: true,
    actionsExtracted: 5,
    decisionsLogged: 2,
    location: 'MS Teams',
  },
  {
    id: 'mtg-004',
    title: 'Healthcare Digital Strategy – Kickoff',
    date: '2026-03-14',
    time: '13:00',
    duration: '2 hours',
    type: 'Kickoff',
    status: 'Completed',
    participants: ['SK', 'PL', 'MN', 'JL'],
    workspace: 'Healthcare Digital Strategy',
    workspaceId: 'ws-004',
    minutesGenerated: true,
    actionsExtracted: 12,
    decisionsLogged: 6,
    location: 'RHA Offices',
  },
  {
    id: 'mtg-005',
    title: 'Smart City PMO Weekly Review',
    date: '2026-03-15',
    time: '16:00',
    duration: '1.5 hours',
    type: 'Review',
    status: 'In Progress',
    participants: ['AM', 'JL', 'AS', 'KP'],
    workspace: 'Smart City Infrastructure PMO',
    workspaceId: 'ws-005',
    location: 'UDA Tower – Floor 12',
  },
  {
    id: 'mtg-006',
    title: 'ENB Core Banking – UAT Sign-off',
    date: '2026-03-13',
    time: '11:00',
    duration: '2.5 hours',
    type: 'Review',
    status: 'Completed',
    participants: ['DN', 'MK', 'SK', 'FA'],
    workspace: 'Banking Core Transformation',
    workspaceId: 'ws-006',
    minutesGenerated: true,
    actionsExtracted: 8,
    decisionsLogged: 4,
    location: 'ENB – Technology Centre',
  },
  {
    id: 'mtg-007',
    title: 'Retail Digital Commerce Discovery',
    date: '2026-03-22',
    time: '10:00',
    duration: '3 hours',
    type: 'Workshop',
    status: 'Upcoming',
    participants: ['PL', 'FH', 'AM'],
    workspace: 'Retail Digital Commerce',
    workspaceId: 'ws-008',
    location: 'Gulf Retail HQ',
    agenda: [
      'Current state e-commerce assessment',
      'Customer journey mapping',
      'Platform shortlisting criteria',
      'Budget and timeline discussion',
    ],
  },
];

// ============================================================
// TASKS
// ============================================================
export const tasks: Task[] = [
  {
    id: 'task-001',
    title: 'Finalise BRD Section 4 – Integration Requirements',
    workspace: 'NCA Digital Transformation',
    workspaceId: 'ws-001',
    priority: 'High',
    status: 'In Progress',
    dueDate: '2026-03-17',
    assignee: 'AM',
    linkedDoc: 'NCA Enterprise Architecture BRD v2.3',
    description: 'Complete integration requirements covering 8 legacy systems and define API contracts.',
  },
  {
    id: 'task-002',
    title: 'Prepare SC-10 Committee Pack',
    workspace: 'MOCI Procurement Reform',
    workspaceId: 'ws-003',
    priority: 'High',
    status: 'In Progress',
    dueDate: '2026-03-19',
    assignee: 'RT',
    linkedMeeting: 'MOCI Steering Committee – SC-10',
    description: 'Compile agenda, progress update, decision items, and budget request for SC-10.',
  },
  {
    id: 'task-003',
    title: 'Review ADNOC Vendor Contract Terms',
    workspace: 'ADNOC Supply Chain',
    workspaceId: 'ws-002',
    priority: 'High',
    status: 'Overdue',
    dueDate: '2026-03-12',
    assignee: 'MK',
    description: 'Legal review of ERP vendor contract terms, SLAs, and penalty clauses.',
  },
  {
    id: 'task-004',
    title: 'Update Smart City Risk Register',
    workspace: 'Smart City Infrastructure PMO',
    workspaceId: 'ws-005',
    priority: 'Medium',
    status: 'In Review',
    dueDate: '2026-03-16',
    assignee: 'JL',
    linkedDoc: 'Smart City Risk Register v4',
    description: 'Incorporate new risks from Q1 contractor audits into consolidated register.',
  },
  {
    id: 'task-005',
    title: 'Draft Healthcare Strategy Exec Summary',
    workspace: 'Healthcare Digital Strategy',
    workspaceId: 'ws-004',
    priority: 'Medium',
    status: 'Backlog',
    dueDate: '2026-03-25',
    assignee: 'SK',
    description: '2-page executive summary for Ministry presentation covering findings and recommendations.',
  },
  {
    id: 'task-006',
    title: 'ENB – Document UAT Test Results',
    workspace: 'Banking Core Transformation',
    workspaceId: 'ws-006',
    priority: 'High',
    status: 'In Progress',
    dueDate: '2026-03-18',
    assignee: 'DN',
    linkedMeeting: 'ENB Core Banking – UAT Sign-off',
    description: 'Formal documentation of UAT pass/fail results across 847 test cases.',
  },
  {
    id: 'task-007',
    title: 'Create MOCI Bilingual Document Templates',
    workspace: 'MOCI Procurement Reform',
    workspaceId: 'ws-003',
    priority: 'Low',
    status: 'Backlog',
    dueDate: '2026-04-01',
    assignee: 'FH',
    description: 'Develop bilingual (AR/EN) templates for procurement notices and evaluation reports.',
  },
  {
    id: 'task-008',
    title: 'NCA Phase 2 Milestone Sign-off',
    workspace: 'NCA Digital Transformation',
    workspaceId: 'ws-001',
    priority: 'High',
    status: 'Backlog',
    dueDate: '2026-03-31',
    assignee: 'AM',
    description: 'Obtain formal sign-off on Phase 2 deliverables from NCA CTO.',
  },
  {
    id: 'task-009',
    title: 'Smart City – Contractor Progress Report',
    workspace: 'Smart City Infrastructure PMO',
    workspaceId: 'ws-005',
    priority: 'Medium',
    status: 'Completed',
    dueDate: '2026-03-10',
    assignee: 'KP',
    description: 'Monthly contractor progress report for 4 active infrastructure packages.',
  },
  {
    id: 'task-010',
    title: 'Retail Commerce – Platform Demo Coordination',
    workspace: 'Retail Digital Commerce',
    workspaceId: 'ws-008',
    priority: 'Medium',
    status: 'Backlog',
    dueDate: '2026-04-05',
    assignee: 'PL',
    description: 'Coordinate platform vendor demos for Salesforce Commerce, Shopify Plus, and SAP CX.',
  },
  {
    id: 'task-011',
    title: 'ADNOC Process Flow – Validation Workshop',
    workspace: 'ADNOC Supply Chain',
    workspaceId: 'ws-002',
    priority: 'Medium',
    status: 'Overdue',
    dueDate: '2026-03-11',
    assignee: 'AS',
    description: 'Business validation of proposed supply chain process flows with ADNOC stakeholders.',
  },
  {
    id: 'task-012',
    title: 'Update Project Dashboard KPIs',
    workspace: 'Smart City Infrastructure PMO',
    workspaceId: 'ws-005',
    priority: 'Low',
    status: 'In Progress',
    dueDate: '2026-03-20',
    assignee: 'RT',
    description: 'Refresh monthly KPI targets and actuals on executive project dashboard.',
  },
];

// ============================================================
// RISKS
// ============================================================
export const risks: Risk[] = [
  {
    id: 'risk-001',
    title: 'NCA Legacy System Integration Delays',
    workspace: 'NCA Digital Transformation',
    probability: 4,
    impact: 5,
    severity: 'Critical',
    status: 'Open',
    owner: 'Ahmed Al-Mahmoud',
    mitigation: 'Engage dedicated integration architect; establish weekly integration syncs with NCA IT team.',
    dateIdentified: '2026-02-15',
    category: 'Technical',
  },
  {
    id: 'risk-002',
    title: 'MOCI Vendor Conflict of Interest',
    workspace: 'MOCI Procurement Reform',
    probability: 2,
    impact: 5,
    severity: 'High',
    status: 'Monitoring',
    owner: 'Rania Taher',
    mitigation: 'Independent audit of evaluation process; recusal procedures implemented.',
    dateIdentified: '2026-03-01',
    category: 'Compliance',
  },
  {
    id: 'risk-003',
    title: 'Smart City Contractor Insolvency',
    workspace: 'Smart City Infrastructure PMO',
    probability: 3,
    impact: 5,
    severity: 'Critical',
    status: 'Open',
    owner: 'James Liu',
    mitigation: 'Performance bond review; identify backup contractors; accelerate payment milestones.',
    dateIdentified: '2026-03-08',
    category: 'Commercial',
  },
  {
    id: 'risk-004',
    title: 'Healthcare Data Privacy Compliance',
    workspace: 'Healthcare Digital Strategy',
    probability: 3,
    impact: 4,
    severity: 'High',
    status: 'Open',
    owner: 'Sara Al-Khalidi',
    mitigation: 'Engage DPA advisory; conduct privacy impact assessment before platform selection.',
    dateIdentified: '2026-03-10',
    category: 'Regulatory',
  },
  {
    id: 'risk-005',
    title: 'ENB Migration Data Loss Risk',
    workspace: 'Banking Core Transformation',
    probability: 2,
    impact: 5,
    severity: 'High',
    status: 'Mitigated',
    owner: 'David Nkosi',
    mitigation: 'Full data backup protocols; parallel run period of 60 days; independent data validation.',
    dateIdentified: '2026-01-20',
    category: 'Technical',
  },
  {
    id: 'risk-006',
    title: 'ADNOC Stakeholder Availability',
    workspace: 'ADNOC Supply Chain',
    probability: 4,
    impact: 3,
    severity: 'High',
    status: 'Monitoring',
    owner: 'Mohammed Al-Karim',
    mitigation: 'Escalated to programme sponsor; adjusted workshop schedule to ADNOC calendar.',
    dateIdentified: '2026-02-28',
    category: 'Resource',
  },
  {
    id: 'risk-007',
    title: 'Budget Overrun – Smart City Package 3',
    workspace: 'Smart City Infrastructure PMO',
    probability: 3,
    impact: 4,
    severity: 'High',
    status: 'Open',
    owner: 'Khaled Perkins',
    mitigation: 'Detailed cost review initiated; scope reduction options under assessment.',
    dateIdentified: '2026-03-12',
    category: 'Financial',
  },
  {
    id: 'risk-008',
    title: 'NCA Change Management Resistance',
    workspace: 'NCA Digital Transformation',
    probability: 3,
    impact: 3,
    severity: 'Medium',
    status: 'Monitoring',
    owner: 'Fatima Hassan',
    mitigation: 'Structured change management program; executive sponsorship reinforcement.',
    dateIdentified: '2026-02-10',
    category: 'Organisational',
  },
  {
    id: 'risk-009',
    title: 'Retail Platform Vendor Lock-in',
    workspace: 'Retail Digital Commerce',
    probability: 3,
    impact: 3,
    severity: 'Medium',
    status: 'Open',
    owner: 'Paul Lee',
    mitigation: 'Include interoperability and data portability requirements in RFP criteria.',
    dateIdentified: '2026-03-14',
    category: 'Commercial',
  },
  {
    id: 'risk-010',
    title: 'Healthcare EMR Integration Complexity',
    workspace: 'Healthcare Digital Strategy',
    probability: 4,
    impact: 3,
    severity: 'Medium',
    status: 'Open',
    owner: 'Mike Nguyen',
    mitigation: 'HL7 FHIR compliance mandate; phased integration roadmap; vendor certification checks.',
    dateIdentified: '2026-03-11',
    category: 'Technical',
  },
];

// ============================================================
// REPORTS
// ============================================================
export const reports: Report[] = [
  {
    id: 'rpt-001',
    title: 'NCA Programme Weekly Status – W10 2026',
    type: 'Weekly Status',
    typeColor: '#0EA5E9',
    workspace: 'NCA Digital Transformation',
    date: '2026-03-14',
    status: 'Generated',
    pages: 8,
    period: 'Week 10, March 2026',
    author: 'Ahmed Al-Mahmoud',
  },
  {
    id: 'rpt-002',
    title: 'MOCI Procurement Reform – Monthly Report',
    type: 'Monthly Report',
    typeColor: '#8B5CF6',
    workspace: 'MOCI Procurement Reform',
    date: '2026-03-01',
    status: 'Generated',
    pages: 24,
    period: 'February 2026',
    author: 'Rania Taher',
  },
  {
    id: 'rpt-003',
    title: 'Smart City SC Pack – March 2026',
    type: 'Steering Committee',
    typeColor: '#EF4444',
    workspace: 'Smart City Infrastructure PMO',
    date: '2026-03-12',
    status: 'Generated',
    pages: 36,
    period: 'Q1 2026',
    author: 'James Liu',
  },
  {
    id: 'rpt-004',
    title: 'MOCI Vendor Evaluation Summary',
    type: 'Procurement Report',
    typeColor: '#F59E0B',
    workspace: 'MOCI Procurement Reform',
    date: '2026-03-11',
    status: 'Generated',
    pages: 18,
    period: 'March 2026',
    author: 'Fatima Hassan',
  },
  {
    id: 'rpt-005',
    title: 'ADNOC Supply Chain – Monthly Report',
    type: 'Monthly Report',
    typeColor: '#8B5CF6',
    workspace: 'ADNOC Supply Chain',
    date: '2026-03-05',
    status: 'Generated',
    pages: 16,
    period: 'February 2026',
    author: 'Mohammed Al-Karim',
  },
  {
    id: 'rpt-006',
    title: 'ENB Transformation Board Summary',
    type: 'Board Summary',
    typeColor: '#10B981',
    workspace: 'Banking Core Transformation',
    date: '2026-03-10',
    status: 'Generated',
    pages: 12,
    period: 'Q1 2026',
    author: 'David Nkosi',
  },
  {
    id: 'rpt-007',
    title: 'Smart City PMO Weekly Status – W10',
    type: 'Weekly Status',
    typeColor: '#0EA5E9',
    workspace: 'Smart City Infrastructure PMO',
    date: '2026-03-14',
    status: 'Generated',
    pages: 10,
    period: 'Week 10, March 2026',
    author: 'Khaled Perkins',
  },
  {
    id: 'rpt-008',
    title: 'Healthcare Digital – Inception Report',
    type: 'Monthly Report',
    typeColor: '#8B5CF6',
    workspace: 'Healthcare Digital Strategy',
    date: '2026-03-15',
    status: 'Draft',
    pages: 32,
    period: 'March 2026',
    author: 'Sara Al-Khalidi',
  },
];

// ============================================================
// TEMPLATES
// ============================================================
export const templates: Template[] = [
  {
    id: 'tpl-001',
    name: 'Business Requirements Document (BRD)',
    category: 'BRD',
    description: 'Full-format BRD with executive summary, scope, stakeholder register, functional and non-functional requirements, use cases, and sign-off sections.',
    formats: ['Word', 'PDF'],
    languages: ['EN', 'AR'],
    usageCount: 234,
    featured: true,
    icon: 'FileText',
  },
  {
    id: 'tpl-002',
    name: 'Functional Requirements Document (FRD)',
    category: 'FRD',
    description: 'Detailed FRD with system context, process flows, screen wireframes placeholder, data dictionary, and technical appendix.',
    formats: ['Word', 'PDF'],
    languages: ['EN'],
    usageCount: 178,
    featured: true,
    icon: 'FileCode',
  },
  {
    id: 'tpl-003',
    name: 'Steering Committee Meeting Minutes',
    category: 'Meetings',
    description: 'Formal committee minutes with quorum register, attendees, agenda, discussion, decisions, resolutions, and action table.',
    formats: ['Word', 'PDF'],
    languages: ['EN', 'AR'],
    usageCount: 312,
    featured: true,
    icon: 'ClipboardList',
  },
  {
    id: 'tpl-004',
    name: 'Project Status Report (Weekly)',
    category: 'Reports',
    description: 'Executive-facing weekly status report with RAG indicators, milestone tracker, risk summary, financial snapshot, and upcoming activities.',
    formats: ['Word', 'PDF', 'PowerPoint'],
    languages: ['EN'],
    usageCount: 445,
    featured: true,
    icon: 'BarChart3',
  },
  {
    id: 'tpl-005',
    name: 'RFP Evaluation Matrix',
    category: 'Procurement',
    description: 'Weighted scoring matrix for procurement evaluation with technical, commercial, and compliance criteria with automated scoring.',
    formats: ['Excel'],
    languages: ['EN', 'AR'],
    usageCount: 89,
    featured: false,
    icon: 'Table',
  },
  {
    id: 'tpl-006',
    name: 'Risk Register',
    category: 'Risk Register',
    description: 'Comprehensive risk register with risk ID, category, probability/impact matrix, severity scoring, mitigation plan, and owner assignment.',
    formats: ['Excel', 'PDF'],
    languages: ['EN'],
    usageCount: 167,
    featured: false,
    icon: 'AlertTriangle',
  },
  {
    id: 'tpl-007',
    name: 'User Story Template',
    category: 'User Stories',
    description: 'Agile user story format with persona definition, story narrative, acceptance criteria, dependencies, and story point estimation guide.',
    formats: ['Excel', 'Word'],
    languages: ['EN'],
    usageCount: 203,
    featured: false,
    icon: 'BookOpen',
  },
  {
    id: 'tpl-008',
    name: 'Workshop Agenda & Minutes (Bilingual)',
    category: 'Meetings',
    description: 'Bilingual Arabic/English workshop documentation with objectives, facilitation guide, participant register, and outputs summary.',
    formats: ['Word', 'PDF'],
    languages: ['EN', 'AR'],
    usageCount: 124,
    featured: true,
    icon: 'Users',
  },
  {
    id: 'tpl-009',
    name: 'Gap Analysis Report',
    category: 'BRD',
    description: 'Structured gap analysis comparing current vs target state with capability assessment, prioritized gaps, and remediation roadmap.',
    formats: ['Word', 'PDF'],
    languages: ['EN'],
    usageCount: 78,
    featured: false,
    icon: 'GitCompare',
  },
  {
    id: 'tpl-010',
    name: 'Monthly Progress Report',
    category: 'Reports',
    description: 'Monthly management report with financial tracker, deliverables status, resource utilisation, lessons learned, and forward look.',
    formats: ['Word', 'PDF'],
    languages: ['EN', 'AR'],
    usageCount: 289,
    featured: false,
    icon: 'TrendingUp',
  },
  {
    id: 'tpl-011',
    name: 'Decision Log',
    category: 'Meetings',
    description: 'Structured decision register with decision reference, description, options considered, rationale, owner, and implementation status.',
    formats: ['Excel', 'Word'],
    languages: ['EN'],
    usageCount: 156,
    featured: false,
    icon: 'CheckSquare',
  },
  {
    id: 'tpl-012',
    name: 'Bilingual Project Charter',
    category: 'Bilingual',
    description: 'Full bilingual (AR/EN) project charter with objectives, scope, governance, budget, timeline, and stakeholder sign-off pages.',
    formats: ['Word', 'PDF'],
    languages: ['EN', 'AR'],
    usageCount: 67,
    featured: true,
    icon: 'Globe',
  },
];

// ============================================================
// USERS
// ============================================================
export const users: User[] = [
  {
    id: 'usr-001',
    name: 'Ahmed Al-Mahmoud',
    email: 'a.almahmoud@accelconsulting.ae',
    role: 'Manager',
    workspacesCount: 5,
    lastActive: '2 min ago',
    status: 'Active',
    avatar: 'AM',
  },
  {
    id: 'usr-002',
    name: 'Sara Al-Khalidi',
    email: 's.alkhalidi@accelconsulting.ae',
    role: 'Consultant',
    workspacesCount: 4,
    lastActive: '15 min ago',
    status: 'Active',
    avatar: 'SK',
  },
  {
    id: 'usr-003',
    name: 'Rania Taher',
    email: 'r.taher@accelconsulting.ae',
    role: 'Consultant',
    workspacesCount: 3,
    lastActive: '1 hour ago',
    status: 'Active',
    avatar: 'RT',
  },
  {
    id: 'usr-004',
    name: 'James Liu',
    email: 'j.liu@accelconsulting.ae',
    role: 'Analyst',
    workspacesCount: 3,
    lastActive: '30 min ago',
    status: 'Active',
    avatar: 'JL',
  },
  {
    id: 'usr-005',
    name: 'Mohammed Al-Karim',
    email: 'm.alkarim@accelconsulting.ae',
    role: 'Consultant',
    workspacesCount: 2,
    lastActive: '3 hours ago',
    status: 'Active',
    avatar: 'MK',
  },
  {
    id: 'usr-006',
    name: 'David Nkosi',
    email: 'd.nkosi@accelconsulting.ae',
    role: 'Manager',
    workspacesCount: 2,
    lastActive: '5 hours ago',
    status: 'Active',
    avatar: 'DN',
  },
  {
    id: 'usr-007',
    name: 'Fatima Hassan',
    email: 'f.hassan@accelconsulting.ae',
    role: 'Consultant',
    workspacesCount: 2,
    lastActive: '2 days ago',
    status: 'Active',
    avatar: 'FH',
  },
  {
    id: 'usr-008',
    name: 'Paul Lee',
    email: 'p.lee@accelconsulting.ae',
    role: 'Analyst',
    workspacesCount: 2,
    lastActive: '1 day ago',
    status: 'Active',
    avatar: 'PL',
  },
  {
    id: 'usr-009',
    name: 'Yusuf Al-Ameri',
    email: 'y.alameri@accelconsulting.ae',
    role: 'Admin',
    workspacesCount: 8,
    lastActive: '10 min ago',
    status: 'Active',
    avatar: 'YA',
  },
  {
    id: 'usr-010',
    name: 'Khaled Perkins',
    email: 'k.perkins@accelconsulting.ae',
    role: 'Analyst',
    workspacesCount: 2,
    lastActive: '4 days ago',
    status: 'Inactive',
    avatar: 'KP',
  },
];

// ============================================================
// ACTIVITY FEED
// ============================================================
export interface Activity {
  id: string;
  type: 'document' | 'meeting' | 'task' | 'automation' | 'approval' | 'risk';
  title: string;
  detail: string;
  workspace: string;
  timestamp: string;
  user: string;
  color: string;
}

export const activities: Activity[] = [
  { id: 'act-001', type: 'automation', title: 'BRD Generator completed', detail: 'NCA Enterprise Architecture BRD v2.3 generated (87 pages)', workspace: 'NCA Digital Transformation', timestamp: '2 hours ago', user: 'AM', color: '#0EA5E9' },
  { id: 'act-002', type: 'meeting', title: 'ENB UAT Sign-off meeting completed', detail: 'Minutes generated · 8 actions extracted · 4 decisions logged', workspace: 'Banking Core Transformation', timestamp: '3 hours ago', user: 'DN', color: '#8B5CF6' },
  { id: 'act-003', type: 'document', title: 'Smart City Risk Register v4 uploaded', detail: '34 pages · 47 risks identified · 12 critical items', workspace: 'Smart City Infrastructure PMO', timestamp: '4 hours ago', user: 'JL', color: '#EF4444' },
  { id: 'act-004', type: 'approval', title: 'MOCI Vendor Evaluation approved', detail: 'Approved by SC Chair · 6 vendors evaluated', workspace: 'MOCI Procurement Reform', timestamp: '5 hours ago', user: 'RT', color: '#10B981' },
  { id: 'act-005', type: 'task', title: 'ADNOC contract review overdue', detail: 'Assigned to MK · 3 days past due date', workspace: 'ADNOC Supply Chain', timestamp: '6 hours ago', user: 'MK', color: '#F59E0B' },
  { id: 'act-006', type: 'automation', title: 'Weekly Status Reports generated', detail: '4 reports generated across active workspaces', workspace: 'Multiple', timestamp: '8 hours ago', user: 'System', color: '#0EA5E9' },
  { id: 'act-007', type: 'risk', title: 'New critical risk identified', detail: 'Smart City Contractor Insolvency – severity: Critical', workspace: 'Smart City Infrastructure PMO', timestamp: '1 day ago', user: 'JL', color: '#EF4444' },
  { id: 'act-008', type: 'document', title: 'Healthcare Digital Strategy Phase 1 Report', detail: 'Draft uploaded · 56 pages · awaiting review', workspace: 'Healthcare Digital Strategy', timestamp: '1 day ago', user: 'SK', color: '#10B981' },
];

// ============================================================
// CHART DATA
// ============================================================
export const automationRunsData = [
  { day: 'Mon', runs: 28 },
  { day: 'Tue', runs: 45 },
  { day: 'Wed', runs: 38 },
  { day: 'Thu', runs: 62 },
  { day: 'Fri', runs: 55 },
  { day: 'Sat', runs: 18 },
  { day: 'Sun', runs: 12 },
];

export const documentsByTypeData = [
  { name: 'BRD', value: 124, color: '#0EA5E9' },
  { name: 'FRD', value: 89, color: '#8B5CF6' },
  { name: 'Minutes', value: 203, color: '#10B981' },
  { name: 'Reports', value: 167, color: '#F59E0B' },
  { name: 'Other', value: 264, color: '#475569' },
];

export const projectHealthData = [
  { month: 'Oct', onTrack: 8, atRisk: 2, delayed: 1 },
  { month: 'Nov', onTrack: 9, atRisk: 2, delayed: 1 },
  { month: 'Dec', onTrack: 7, atRisk: 3, delayed: 2 },
  { month: 'Jan', onTrack: 10, atRisk: 2, delayed: 1 },
  { month: 'Feb', onTrack: 11, atRisk: 2, delayed: 0 },
  { month: 'Mar', onTrack: 10, atRisk: 3, delayed: 1 },
];

export const workspaceProgressData = workspaces.map(ws => ({
  name: ws.name.substring(0, 20) + '...',
  progress: ws.progress,
  docs: ws.docsCount,
}));
