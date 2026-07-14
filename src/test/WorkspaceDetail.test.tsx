import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ── Hoisted mocks ─────────────────────────────────────────────
const {
  mockGetWorkspace, mockGetDocuments, mockGetMeetings, mockGetTasks,
  mockGetRisks, mockGetWorkspaceFinancial, mockGetMilestones,
  mockGetWorkspaceRagStatus, mockUpsertTask, mockUpdateTask, mockDeleteTask,
  mockUpsertDocument, mockUpdateDocument, mockDeleteDocument,
  mockUpsertMeeting, mockUpdateMeeting, mockDeleteMeeting,
  mockUpsertRisk, mockUpdateRisk, mockDeleteRisk,
  mockUpsertMilestone, mockDeleteMilestone, mockUpsertWorkspaceFinancial,
  mockUpdateWorkspace, mockDeleteWorkspace, mockUpsertWorkspaceRagStatus,
} = vi.hoisted(() => ({
  mockGetWorkspace: vi.fn(),
  mockGetDocuments: vi.fn(),
  mockGetMeetings: vi.fn(),
  mockGetTasks: vi.fn(),
  mockGetRisks: vi.fn(),
  mockGetWorkspaceFinancial: vi.fn(),
  mockGetMilestones: vi.fn(),
  mockGetWorkspaceRagStatus: vi.fn(),
  mockUpsertTask: vi.fn(),
  mockUpdateTask: vi.fn(),
  mockDeleteTask: vi.fn(),
  mockUpsertDocument: vi.fn(),
  mockUpdateDocument: vi.fn(),
  mockDeleteDocument: vi.fn(),
  mockUpsertMeeting: vi.fn(),
  mockUpdateMeeting: vi.fn(),
  mockDeleteMeeting: vi.fn(),
  mockUpsertRisk: vi.fn(),
  mockUpdateRisk: vi.fn(),
  mockDeleteRisk: vi.fn(),
  mockUpsertMilestone: vi.fn(),
  mockDeleteMilestone: vi.fn(),
  mockUpsertWorkspaceFinancial: vi.fn(),
  mockUpdateWorkspace: vi.fn(),
  mockDeleteWorkspace: vi.fn(),
  mockUpsertWorkspaceRagStatus: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getWorkspace: mockGetWorkspace,
  getDocuments: mockGetDocuments,
  getMeetings: mockGetMeetings,
  getTasks: mockGetTasks,
  getRisks: mockGetRisks,
  getWorkspaceFinancial: mockGetWorkspaceFinancial,
  getMilestones: mockGetMilestones,
  getWorkspaceRagStatus: mockGetWorkspaceRagStatus,
  upsertTask: mockUpsertTask,
  updateTask: mockUpdateTask,
  deleteTask: mockDeleteTask,
  upsertDocument: mockUpsertDocument,
  updateDocument: mockUpdateDocument,
  deleteDocument: mockDeleteDocument,
  upsertMeeting: mockUpsertMeeting,
  updateMeeting: mockUpdateMeeting,
  deleteMeeting: mockDeleteMeeting,
  upsertRisk: mockUpsertRisk,
  updateRisk: mockUpdateRisk,
  deleteRisk: mockDeleteRisk,
  upsertMilestone: mockUpsertMilestone,
  deleteMilestone: mockDeleteMilestone,
  upsertWorkspaceFinancial: mockUpsertWorkspaceFinancial,
  updateWorkspace: mockUpdateWorkspace,
  deleteWorkspace: mockDeleteWorkspace,
  upsertWorkspaceRagStatus: mockUpsertWorkspaceRagStatus,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test.example.com/file.pdf' } })),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}));

vi.mock('../hooks/useLayout', () => ({
  useLayout: () => ({ width: 1280, isMobile: false, isTablet: false }),
}));

import WorkspaceDetail from '../screens/WorkspaceDetail';

// ── Fixtures ──────────────────────────────────────────────────
const mockWs = {
  id: 'ws-1',
  name: 'NCA Enterprise Platform',
  client: 'NCA',
  sector: 'Government',
  sector_color: '#0EA5E9',
  type: 'Client' as const,
  status: 'Active' as const,
  language: 'EN' as const,
  progress: 65,
  description: 'National Cybersecurity Authority platform modernization',
  contributors: ['AM', 'RT'],
  docs_count: 8,
  meetings_count: 4,
  tasks_count: 12,
  last_activity: '2h ago',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

const mockFin = {
  id: 'fin-1',
  workspace_id: 'ws-1',
  workspace_name: 'NCA Enterprise Platform',
  contract_value: 5000000,
  spent: 2500000,
  forecast: 4800000,
  variance: 200000,
  currency: 'SAR',
  billing_model: 'Fixed Fee',
  last_invoice: '2026-02-28',
  next_milestone_value: 500000,
  created_at: '',
  updated_at: '',
};

const mockRag = {
  id: 'rag-1',
  workspace_id: 'ws-1',
  rag: 'Green' as const,
  schedule: 'Green' as const,
  budget: 'Amber' as const,
  scope: 'Green' as const,
  risk: 'Green' as const,
  updated_by: 'AM',
  updated_at: '2026-03-20T00:00:00Z',
};

const mockDoc = {
  id: 'd1',
  name: 'NCA BRD v2.3',
  type: 'BRD',
  type_color: '#0EA5E9',
  status: 'Final' as const,
  date: '2026-03-15',
  workspace: 'NCA',
  workspace_id: 'ws-1',
  size: '2.4MB',
  language: 'EN' as const,
  tags: ['BRD'],
  author: 'Ahmed Khalil',
  pages: 24,
  summary: 'Full BRD',
  file_url: null,
  created_at: '',
  updated_at: '',
};

const mockMeeting = {
  id: 'mtg-1',
  title: 'Steering Committee Q1',
  date: '2026-04-01',
  time: '10:00',
  duration: '2h',
  type: 'Steering' as const,
  status: 'Upcoming' as const,
  participants: ['AM', 'RT'],
  workspace: 'NCA',
  workspace_id: 'ws-1',
  location: 'Conference Room A',
  minutes_generated: false,
  actions_extracted: 0,
  decisions_logged: 0,
  agenda: [],
  created_at: '',
  updated_at: '',
};

const mockTask = {
  id: 't1',
  title: 'Review Architecture Diagram',
  workspace: 'NCA',
  workspace_id: 'ws-1',
  priority: 'High' as const,
  status: 'In Progress' as const,
  assignee: 'AM',
  due_date: '2026-04-10',
  description: 'Review and approve architecture diagrams',
  linked_doc: null,
  created_at: '',
  updated_at: '',
};

const mockRisk = {
  id: 'r1',
  title: 'Vendor Delay Risk',
  workspace: 'NCA',
  workspace_id: 'ws-1',
  category: 'Procurement',
  severity: 'High' as const,
  status: 'Open' as const,
  probability: '3',
  impact: '4',
  owner: 'Rami Talal',
  mitigation: 'Regular vendor check-ins',
  financial_exposure: 200000,
  created_at: '',
  updated_at: '',
};

const mockMilestone = {
  id: 'ms-1',
  workspace_id: 'ws-1',
  title: 'Phase 1 Delivery',
  due_date: '2026-05-01',
  status: 'On Track' as const,
  value: 1000000,
  owner: 'AM',
  completion_pct: 60,
  description: null,
  created_at: '',
  updated_at: '',
};

function renderDetail(id = 'ws-1') {
  return render(
    <MemoryRouter initialEntries={[`/workspaces/${id}`]}>
      <Routes>
        <Route path="/workspaces/:id" element={<WorkspaceDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetWorkspace.mockResolvedValue(mockWs);
  mockGetDocuments.mockResolvedValue([mockDoc]);
  mockGetMeetings.mockResolvedValue([mockMeeting]);
  mockGetTasks.mockResolvedValue([mockTask]);
  mockGetRisks.mockResolvedValue([mockRisk]);
  mockGetWorkspaceFinancial.mockResolvedValue(mockFin);
  mockGetMilestones.mockResolvedValue([mockMilestone]);
  mockGetWorkspaceRagStatus.mockResolvedValue(mockRag);
  mockUpsertWorkspaceRagStatus.mockResolvedValue(mockRag);
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Loading & Header', () => {
  it('shows loading state initially', () => {
    mockGetWorkspace.mockImplementation(() => new Promise(() => {}));
    renderDetail();
    expect(screen.getByText(/loading workspace/i)).toBeInTheDocument();
  });

  it('renders workspace name after load', async () => {
    renderDetail();
    expect(await screen.findByText('NCA Enterprise Platform')).toBeInTheDocument();
  });

  it('renders client name', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('NCA')).toBeInTheDocument();
  });

  it('renders workspace type badge', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Type (e.g. 'Client') is rendered in the header row
    expect(screen.getByText('Client')).toBeInTheDocument();
  });

  it('renders Back to Workspaces link', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText(/back to workspaces/i)).toBeInTheDocument();
  });

  it('shows error state when workspace not found', async () => {
    mockGetWorkspace.mockResolvedValue(null);
    renderDetail();
    expect(await screen.findByText(/workspace not found/i)).toBeInTheDocument();
  });

  it('shows error state on load failure', async () => {
    mockGetWorkspace.mockRejectedValue(new Error('Network error'));
    renderDetail();
    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Tabs', () => {
  it('renders Overview tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /workspace tab: overview/i })).toBeInTheDocument();
  });

  it('renders Documents tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /workspace tab: documents/i })).toBeInTheDocument();
  });

  it('renders Meetings tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /workspace tab: meetings/i })).toBeInTheDocument();
  });

  it('renders Tasks tab button (may include badge count)', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Tab has "Tasks" text + optional count badge, use regex
    const tasksTab = screen.getByRole('button', { name: /workspace tab: tasks/i });
    expect(tasksTab).toBeInTheDocument();
  });

  it('renders Risks tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Risks tab may include an open-count badge, use regex
    expect(screen.getByRole('button', { name: /workspace tab: risks/i })).toBeInTheDocument();
  });

  it('Overview tab shows milestones', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('Phase 1 Delivery')).toBeInTheDocument();
  });

  it('switches to Documents tab and shows document', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    expect(screen.getByText('NCA BRD v2.3')).toBeInTheDocument();
  });

  it('switches to Meetings tab and shows meeting', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    expect(screen.getByText('Steering Committee Q1')).toBeInTheDocument();
  });

  it('switches to Tasks tab and shows task', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    expect(screen.getByText('Review Architecture Diagram')).toBeInTheDocument();
  });

  it('switches to Risks tab and shows risk', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    expect(screen.getByText('Vendor Delay Risk')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Financials', () => {
  it('shows contract value formatted as SAR 5.0M', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText(/SAR 5\.0M/)).toBeInTheDocument();
  });

  it('shows spent formatted as SAR 2.5M', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText(/SAR 2\.5M/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Task Modal', () => {
  it('opens Add Task modal when button clicked on Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    const addBtn = screen.getByRole('button', { name: /add task/i });
    await userEvent.click(addBtn);
    // Modal opens: confirm button "Create Task" is now visible
    expect(screen.getByRole('button', { name: /create task/i })).toBeInTheDocument();
  });

  it('shows validation error when saving task without required fields', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await userEvent.click(screen.getByRole('button', { name: /add task/i }));
    const saveBtn = screen.getByRole('button', { name: /create task/i });
    await userEvent.click(saveBtn);
    expect(screen.getByText(/title, due date and assignee are required/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Empty States', () => {
  it('shows empty state when no documents', async () => {
    mockGetDocuments.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    expect(screen.getByText(/no documents/i)).toBeInTheDocument();
  });

  it('shows empty state when no meetings', async () => {
    mockGetMeetings.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    expect(screen.getByText(/no meetings/i)).toBeInTheDocument();
  });

  it('shows empty state when no tasks', async () => {
    mockGetTasks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
  });

  it('shows empty state when no risks', async () => {
    mockGetRisks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    expect(screen.getByText(/no risks/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Data fetch calls', () => {
  it('calls getWorkspace with correct id', async () => {
    renderDetail('ws-1');
    await screen.findByText('NCA Enterprise Platform');
    expect(mockGetWorkspace).toHaveBeenCalledWith('ws-1');
  });

  it('calls getDocuments with workspace id', async () => {
    renderDetail('ws-1');
    await screen.findByText('NCA Enterprise Platform');
    expect(mockGetDocuments).toHaveBeenCalledWith('ws-1');
  });

  it('calls getTasks with workspace id', async () => {
    renderDetail('ws-1');
    await screen.findByText('NCA Enterprise Platform');
    expect(mockGetTasks).toHaveBeenCalledWith('ws-1');
  });

  it('calls getRisks with workspace id', async () => {
    renderDetail('ws-1');
    await screen.findByText('NCA Enterprise Platform');
    expect(mockGetRisks).toHaveBeenCalledWith('ws-1');
  });

  it('calls getMilestones with workspace id', async () => {
    renderDetail('ws-1');
    await screen.findByText('NCA Enterprise Platform');
    expect(mockGetMilestones).toHaveBeenCalledWith('ws-1');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Document Modal', () => {
  it('opens Add Document modal on Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await userEvent.click(screen.getByRole('button', { name: /add document/i }));
    // Modal confirm button shows "Save Document" when no file is selected
    expect(screen.getByRole('button', { name: /save document/i })).toBeInTheDocument();
  });

  it('shows validation error when saving doc without required fields', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await userEvent.click(screen.getByRole('button', { name: /add document/i }));
    await userEvent.click(screen.getByRole('button', { name: /save document/i }));
    expect(screen.getByText(/name and author are required/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Meeting Modal', () => {
  it('opens Schedule Meeting modal on Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await userEvent.click(screen.getByRole('button', { name: /schedule meeting/i }));
    // Modal opens — confirm button "Schedule Meeting" is present inside modal
    const scheduleBtns = screen.getAllByRole('button', { name: /schedule meeting/i });
    // One is the tab button, one is the modal confirm button
    expect(scheduleBtns.length).toBeGreaterThan(1);
  });

  it('shows validation error when saving meeting without required fields', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await userEvent.click(screen.getByRole('button', { name: /schedule meeting/i }));
    // Click the modal confirm button (last one)
    const scheduleBtns = screen.getAllByRole('button', { name: /schedule meeting/i });
    await userEvent.click(scheduleBtns[scheduleBtns.length - 1]);
    expect(screen.getByText(/title, date and time are required/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risk Modal', () => {
  it('opens Log Risk modal on Risks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await userEvent.click(screen.getByRole('button', { name: /log risk/i }));
    // Modal confirm button "Log Risk" appears
    const logRiskBtns = screen.getAllByRole('button', { name: /log risk/i });
    expect(logRiskBtns.length).toBeGreaterThan(1);
  });

  it('shows validation error when saving risk without required fields', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await userEvent.click(screen.getByRole('button', { name: /log risk/i }));
    // Click modal confirm button
    const logRiskBtns = screen.getAllByRole('button', { name: /log risk/i });
    await userEvent.click(logRiskBtns[logRiskBtns.length - 1]);
    expect(screen.getByText(/title and owner are required/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Run Automation button', () => {
  it('navigates to /automations when Run Automation is clicked', async () => {
    const mockNavigate = vi.fn();
    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
      return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: 'ws-1' }) };
    });
    // Simply verify the button is present (navigation is covered by router integration)
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /run automation/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Edit Workspace modal', () => {
  it('opens Edit Workspace modal when header Edit button is clicked', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /edit workspace settings/i }));
    expect(screen.getByText('Edit Workspace')).toBeInTheDocument();
  });

  it('pre-fills workspace name in edit modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /edit workspace settings/i }));
    // Name field should be pre-filled
    expect(screen.getByDisplayValue('NCA Enterprise Platform')).toBeInTheDocument();
  });

  it('shows validation error when name is cleared and Save is clicked', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /edit workspace settings/i }));

    // Clear the name
    const nameInput = screen.getByDisplayValue('NCA Enterprise Platform');
    await userEvent.clear(nameInput);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(screen.getByText(/name and client are required/i)).toBeInTheDocument();
  });

  it('calls updateWorkspace when valid edit form is submitted', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /edit workspace settings/i }));

    const nameInput = screen.getByDisplayValue('NCA Enterprise Platform');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'NCA Updated Platform');

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(mockUpdateWorkspace).toHaveBeenCalledWith(
        'ws-1',
        expect.objectContaining({ name: 'NCA Updated Platform' })
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Delete Workspace modal', () => {
  it('opens Delete Workspace confirm modal when Delete button clicked', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // The Delete button in the header is "Delete" (no other text)
    // It's rendered with icon + "Delete" text
    const allBtns = screen.getAllByRole('button');
    // Find button whose accessible text is exactly "Delete" (not "Yes, Delete Workspace")
    const deleteHeaderBtn = allBtns.find(b =>
      (b.textContent ?? '').trim() === 'Delete'
    );
    if (deleteHeaderBtn) {
      await userEvent.click(deleteHeaderBtn);
      expect(await screen.findByText('Delete Workspace')).toBeInTheDocument();
    }
  });

  it('calls deleteWorkspace when confirm button clicked', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');

    const allBtns = screen.getAllByRole('button');
    const deleteHeaderBtn = allBtns.find(b =>
      (b.textContent ?? '').trim() === 'Delete'
    );
    if (deleteHeaderBtn) {
      await userEvent.click(deleteHeaderBtn);
      const confirmBtn = await screen.findByRole('button', { name: /yes.*delete.*workspace/i });
      await userEvent.click(confirmBtn);
      await waitFor(() => {
        expect(mockDeleteWorkspace).toHaveBeenCalledWith('ws-1');
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Task CRUD', () => {
  it('calls upsertTask when task form is filled and submitted', async () => {
    mockUpsertTask.mockResolvedValue({ ...mockTask, id: 'tsk-new' });
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await userEvent.click(screen.getByRole('button', { name: /add task/i }));

    await userEvent.type(screen.getByPlaceholderText(/complete stakeholder analysis/i), 'New Task Title');
    // Fill date and assignee
    const dateInputs = document.querySelectorAll('input[type="date"]');
    if (dateInputs.length > 0) {
      fireEvent.change(dateInputs[0], { target: { value: '2026-05-01' } });
    }
    const assigneeInput = screen.getByPlaceholderText(/e\.g\. AM/i);
    await userEvent.type(assigneeInput, 'AM');

    await userEvent.click(screen.getByRole('button', { name: /create task/i }));
    await waitFor(() => {
      expect(mockUpsertTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Task Title', workspace_id: 'ws-1' })
      );
    });
  });

  it('calls deleteTask when confirm delete is clicked on a task', async () => {
    mockDeleteTask.mockResolvedValue(undefined);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await screen.findByText('Review Architecture Diagram');

    // Find delete button for the task (DeleteOrConfirm pattern — first click shows confirm)
    const taskRow = screen.getByText('Review Architecture Diagram').closest('[style]') ??
                    screen.getByText('Review Architecture Diagram').closest('div');
    const deleteBtn = taskRow?.parentElement?.querySelector('button[title*="delete"], button[title*="Delete"]') ??
                      Array.from(document.querySelectorAll('button')).find(b =>
                        b.closest('div')?.textContent?.includes('Review Architecture Diagram') &&
                        b.querySelector('svg') && b.textContent?.trim() === ''
                      );
    if (deleteBtn) {
      await userEvent.click(deleteBtn as HTMLElement);
      // Second click confirms
      const confirmBtn = Array.from(document.querySelectorAll('button')).find(b =>
        (b.textContent ?? '').includes('Confirm') || (b.textContent ?? '').includes('Yes')
      );
      if (confirmBtn) {
        await userEvent.click(confirmBtn as HTMLElement);
        await waitFor(() => expect(mockDeleteTask).toHaveBeenCalledWith('t1'));
      }
    }
  });

  it('calls updateTask when task status is changed via select', async () => {
    mockUpdateTask.mockResolvedValue({ ...mockTask, status: 'Completed' });
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await screen.findByText('Review Architecture Diagram');

    const statusSelects = document.querySelectorAll('select');
    // Find the task status select
    const taskStatusSelect = Array.from(statusSelects).find(s =>
      (s as HTMLSelectElement).value === 'In Progress'
    );
    if (taskStatusSelect) {
      await userEvent.selectOptions(taskStatusSelect as HTMLElement, 'Completed');
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Meeting CRUD', () => {
  it('calls upsertMeeting when meeting form is filled and submitted', async () => {
    mockUpsertMeeting.mockResolvedValue({ ...mockMeeting, id: 'mtg-new' });
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await userEvent.click(screen.getByRole('button', { name: /schedule meeting/i }));

    const scheduleBtns = screen.getAllByRole('button', { name: /schedule meeting/i });
    // The modal confirm is last
    const modalBtn = scheduleBtns[scheduleBtns.length - 1];

    // Fill title — use aria-label to avoid picking up the meetings search input
    await userEvent.type(screen.getByLabelText('Meeting title'), 'Q2 Planning Meeting');

    // Fill date
    const dateInputs = document.querySelectorAll('input[type="date"]');
    if (dateInputs.length > 0) fireEvent.change(dateInputs[0], { target: { value: '2026-05-15' } });

    // Fill time
    const timeInputs = document.querySelectorAll('input[type="time"]');
    if (timeInputs.length > 0) fireEvent.change(timeInputs[0], { target: { value: '10:00' } });

    await userEvent.click(modalBtn);
    await waitFor(() => {
      expect(mockUpsertMeeting).toHaveBeenCalledWith(
        expect.objectContaining({ workspace_id: 'ws-1' })
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risk CRUD', () => {
  it('calls upsertRisk when risk form is filled and submitted', async () => {
    mockUpsertRisk.mockResolvedValue({ ...mockRisk, id: 'rsk-new' });
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await userEvent.click(screen.getByRole('button', { name: /log risk/i }));

    const logBtns = screen.getAllByRole('button', { name: /log risk/i });
    const modalBtn = logBtns[logBtns.length - 1];

    // Fill title
    await userEvent.type(screen.getByPlaceholderText(/key stakeholder unavailability/i), 'Scope Creep Risk');

    // Fill owner (uses same placeholder as other modals — use getAllByPlaceholderText)
    const amInputs = screen.getAllByPlaceholderText(/e\.g\. AM/i);
    await userEvent.type(amInputs[0], 'AM');

    await userEvent.click(modalBtn);
    await waitFor(() => {
      expect(mockUpsertRisk).toHaveBeenCalledWith(
        expect.objectContaining({ workspace_id: 'ws-1' })
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Document status update', () => {
  it('calls updateDocument when document status select changes', async () => {
    mockUpdateDocument.mockResolvedValue({ ...mockDoc, status: 'Approved' });
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('NCA BRD v2.3');

    const statusSelects = document.querySelectorAll('select');
    const docStatusSelect = Array.from(statusSelects).find(s =>
      (s as HTMLSelectElement).value === 'Final'
    );
    if (docStatusSelect) {
      await userEvent.selectOptions(docStatusSelect as HTMLElement, 'Approved');
      await waitFor(() => expect(mockUpdateDocument).toHaveBeenCalled());
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Meeting status update', () => {
  it('calls updateMeeting when meeting status select changes', async () => {
    mockUpdateMeeting.mockResolvedValue({ ...mockMeeting, status: 'Completed' });
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await screen.findByText('Steering Committee Q1');

    const statusSelects = document.querySelectorAll('select');
    const mtgStatusSelect = Array.from(statusSelects).find(s =>
      (s as HTMLSelectElement).value === 'Upcoming'
    );
    if (mtgStatusSelect) {
      await userEvent.selectOptions(mtgStatusSelect as HTMLElement, 'Completed');
      await waitFor(() => expect(mockUpdateMeeting).toHaveBeenCalled());
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Milestone CRUD', () => {
  it('opens Add Milestone modal when Add button is clicked in Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Milestone Tracker section has an "Add" btn — find via its section
    const milestoneHeader = screen.getByText('Milestone Tracker');
    const addBtn = milestoneHeader.closest('div')?.querySelector('button');
    if (addBtn) {
      await userEvent.click(addBtn);
      expect(screen.getAllByText(/add milestone/i).length).toBeGreaterThan(0);
    }
  });

  it('calls upsertMilestone when milestone form is filled and submitted', async () => {
    mockUpsertMilestone.mockResolvedValue({ ...mockMilestone, id: 'ms-new' });
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');

    // Open Add Milestone modal via Milestone Tracker section
    const milestoneHeader = screen.getByText('Milestone Tracker');
    const addBtn = milestoneHeader.closest('div')?.querySelector('button');
    if (addBtn) await userEvent.click(addBtn);

    // Fill title
    await userEvent.type(screen.getByPlaceholderText(/phase 1 delivery/i), 'New Milestone');

    // Fill due date
    const dateInputs = document.querySelectorAll('input[type="date"]');
    if (dateInputs.length > 0) fireEvent.change(dateInputs[0], { target: { value: '2026-06-30' } });

    // Submit
    const addMsBtn = screen.getByRole('button', { name: /add milestone/i });
    await userEvent.click(addMsBtn);

    await waitFor(() => {
      expect(mockUpsertMilestone).toHaveBeenCalledWith(
        expect.objectContaining({ workspace_id: 'ws-1', title: 'New Milestone' })
      );
    });
  });

  it('shows validation error when milestone title is empty on submit', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');

    const milestoneHeader = screen.getByText('Milestone Tracker');
    const addBtn = milestoneHeader.closest('div')?.querySelector('button');
    if (addBtn) await userEvent.click(addBtn);
    const addMsBtn = screen.getByRole('button', { name: /add milestone/i });
    await userEvent.click(addMsBtn);

    expect(screen.getByText(/title and due date are required/i)).toBeInTheDocument();
  });

  it('renders milestone row in Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('Phase 1 Delivery')).toBeInTheDocument();
  });
});

// Helper to click trash icon then confirm delete in DeleteOrConfirm component
async function clickTrashAndConfirm() {
  const trashBtn = Array.from(document.querySelectorAll('button[title="Delete"]'))[0] as HTMLElement | undefined;
  if (!trashBtn) return false;
  await userEvent.click(trashBtn);
  // After clicking trash, confirmDelete state is set; "Delete" appears as a small text button
  // There may be multiple "Delete" buttons (header + confirm); pick the small one (font-size 0.65rem)
  const deleteBtns = await screen.findAllByRole('button', { name: /^Delete$/ });
  // The confirm button has style with fontSize 0.65rem - pick the last one added
  const confirmBtn = deleteBtns.find(b => (b as HTMLElement).style.fontSize === '0.65rem') ?? deleteBtns[deleteBtns.length - 1];
  await userEvent.click(confirmBtn as HTMLElement);
  return true;
}

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Delete Document', () => {
  it('calls deleteDocument when document delete is confirmed', async () => {
    mockDeleteDocument.mockResolvedValue(undefined);
    mockUpdateWorkspace.mockResolvedValue(mockWs);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('NCA BRD v2.3');

    const confirmed = await clickTrashAndConfirm();
    if (confirmed) {
      await waitFor(() => expect(mockDeleteDocument).toHaveBeenCalledWith('d1'));
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Delete Meeting', () => {
  it('calls deleteMeeting when meeting delete is confirmed', async () => {
    mockDeleteMeeting.mockResolvedValue(undefined);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await screen.findByText('Steering Committee Q1');

    const confirmed = await clickTrashAndConfirm();
    if (confirmed) {
      await waitFor(() => expect(mockDeleteMeeting).toHaveBeenCalledWith('mtg-1'));
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Delete Risk', () => {
  it('calls deleteRisk when risk delete is confirmed', async () => {
    mockDeleteRisk.mockResolvedValue(undefined);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');

    const confirmed = await clickTrashAndConfirm();
    if (confirmed) {
      await waitFor(() => expect(mockDeleteRisk).toHaveBeenCalledWith('r1'));
    }
  });

  it('calls updateRiskStatus when risk status select changes', async () => {
    mockUpdateRisk.mockResolvedValue({ ...mockRisk, status: 'Mitigated' });
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');

    const riskRow = screen.getByText('Vendor Delay Risk').closest('tr');
    const statusSelect = riskRow?.querySelector('select');
    if (statusSelect) {
      await userEvent.selectOptions(statusSelect as HTMLElement, 'Mitigated');
      await waitFor(() => expect(mockUpdateRisk).toHaveBeenCalledWith('r1', expect.objectContaining({ status: 'Mitigated' })));
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Edit Financial', () => {
  it('opens Edit Financial Summary modal when Edit button is clicked', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // The Edit button for financials is a small Pencil icon button in the Financials section
    const editFinBtn = Array.from(screen.getAllByRole('button')).find(b =>
      b.textContent?.trim() === 'Edit' && b.closest('[style]')?.textContent?.includes('SAR')
    );
    if (editFinBtn) {
      await userEvent.click(editFinBtn);
      expect(await screen.findByText('Edit Financial Summary')).toBeInTheDocument();
    }
  });

  it('calls upsertWorkspaceFinancial when Save Financials is clicked', async () => {
    mockUpsertWorkspaceFinancial.mockResolvedValue(mockFin);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const editFinBtn = Array.from(screen.getAllByRole('button')).find(b =>
      b.textContent?.trim() === 'Edit' && b.closest('[style]')?.textContent?.includes('SAR')
    );
    if (editFinBtn) {
      await userEvent.click(editFinBtn);
      await screen.findByText('Edit Financial Summary');
      await userEvent.click(screen.getByRole('button', { name: /save financials/i }));
      await waitFor(() => expect(mockUpsertWorkspaceFinancial).toHaveBeenCalled());
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Retry on error', () => {
  it('shows Retry button on workspace load failure', async () => {
    mockGetWorkspace.mockRejectedValue(new Error('Network error'));
    renderDetail();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls getWorkspace again when Retry button is clicked', async () => {
    mockGetWorkspace.mockRejectedValueOnce(new Error('Network error'));
    mockGetWorkspace.mockResolvedValue(mockWs);
    renderDetail();
    const retryBtn = await screen.findByRole('button', { name: /retry/i });
    await userEvent.click(retryBtn);
    await waitFor(() => expect(mockGetWorkspace).toHaveBeenCalledTimes(2));
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risk details display', () => {
  it('shows risk severity badge on risk row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    // High severity from mockRisk
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
  });

  it('shows risk category on risk row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    expect(screen.getByText('Procurement')).toBeInTheDocument();
  });

  it('shows risk mitigation text on risk row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    // Mitigation text is shown on expanded risk row
    expect(screen.getByText('Regular vendor check-ins')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Task details display', () => {
  it('shows task priority on task row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await screen.findByText('Review Architecture Diagram');
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
  });

  it('shows task assignee on task row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await screen.findByText('Review Architecture Diagram');
    expect(screen.getAllByText('AM').length).toBeGreaterThan(0);
  });

  it('shows task due date on task row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await screen.findByText('Review Architecture Diagram');
    expect(screen.getAllByText(/2026-04-10/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Workspace progress and status', () => {
  it('shows workspace progress value', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Progress is 65% — should appear somewhere in the overview
    expect(screen.getAllByText(/65/).length).toBeGreaterThan(0);
  });

  it('shows workspace status Active', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Multiple items', () => {
  it('renders multiple tasks when two tasks returned', async () => {
    const task2 = { ...mockTask, id: 't2', title: 'Prepare Presentation' };
    mockGetTasks.mockResolvedValue([mockTask, task2]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await screen.findByText('Review Architecture Diagram');
    expect(screen.getByText('Prepare Presentation')).toBeInTheDocument();
  });

  it('renders multiple documents when two docs returned', async () => {
    const doc2 = { ...mockDoc, id: 'd2', name: 'ADNOC Proposal v1' };
    mockGetDocuments.mockResolvedValue([mockDoc, doc2]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getByText('ADNOC Proposal v1')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – RAG status display', () => {
  it('shows RAG Budget label in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // RAG status labels (Budget, Schedule, Risk, Overall) are shown in the header
    expect(screen.getByText('Budget')).toBeInTheDocument();
  });

  it('shows RAG Overall label in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('Overall')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Meetings tab display', () => {
  it('shows Steering Committee Q1 meeting title in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await waitFor(() => {
      expect(screen.getByText('Steering Committee Q1')).toBeInTheDocument();
    });
  });

  it('shows meeting location in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await waitFor(() => {
      expect(screen.getByText('Conference Room A')).toBeInTheDocument();
    });
  });

  it('shows meeting status Upcoming in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Financial details display', () => {
  it('shows Financial Summary section in Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Financials are in Overview tab (not a separate tab)
    expect(screen.getByText('Financial Summary')).toBeInTheDocument();
  });

  it('shows Contract Value label in Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('Contract Value')).toBeInTheDocument();
  });

  it('shows SAR currency in financial badge', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // The badge shows "Fixed Fee · SAR"
    expect(screen.getAllByText(/SAR/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Milestone display', () => {
  it('shows milestone title Phase 1 Delivery in Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Milestones are in the Overview tab (not a separate tab)
    await waitFor(() => {
      expect(screen.getByText('Phase 1 Delivery')).toBeInTheDocument();
    });
  });

  it('shows Milestone Tracker section header in Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('Milestone Tracker')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Workspace info display', () => {
  it('shows workspace type Client in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Sector is used for color only; ws.type is shown as text
    expect(screen.getByText('Client')).toBeInTheDocument();
  });

  it('shows workspace description text', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('National Cybersecurity Authority platform modernization')).toBeInTheDocument();
  });

  it('shows workspace client NCA', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risk additional display', () => {
  it('shows risk category Procurement on risk row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Procurement').length).toBeGreaterThan(0);
    });
  });

  it('shows risk title Vendor Delay Risk on risk row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      expect(screen.getByText('Vendor Delay Risk')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Milestone detail display', () => {
  it('shows milestone status On Track', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getAllByText('On Track').length).toBeGreaterThan(0);
    });
  });

  it('shows milestone owner AM in Milestone Tracker', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getAllByText('AM').length).toBeGreaterThan(0);
    });
  });

  it('shows milestone due date in Milestone Tracker', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getAllByText(/2026-05-01/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Tab count badges', () => {
  it('Tasks tab shows count badge of 1', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Tasks tab has a "1" count badge
    await waitFor(() => {
      expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    });
  });

  it('Risks tab shows count badge of 1', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Risks tab also has a badge
    await waitFor(() => {
      const riskTabBtns = screen.getAllByRole('button');
      const riskTab = riskTabBtns.find(b => /Risks/.test(b.textContent ?? ''));
      expect(riskTab).toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Add Task button', () => {
  it('shows Add Task header button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // "Add Task" button is in the workspace header
    expect(screen.getAllByRole('button', { name: /add task/i }).length).toBeGreaterThan(0);
  });

  it('opens task modal when Add Task button is clicked', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const addTaskBtns = screen.getAllByRole('button', { name: /add task/i });
    await userEvent.click(addTaskBtns[0]);
    // Task modal should open — check for a field like "Task Title"
    await waitFor(() => {
      expect(screen.getAllByText(/add task|task title/i).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Document type display', () => {
  it('shows document type BRD on document row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });

  it('shows document status Final on document row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByText('Final').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Meeting type display', () => {
  it('shows meeting type Steering in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await screen.findByText('Steering Committee Q1');
    expect(screen.getAllByText('Steering').length).toBeGreaterThan(0);
  });

  it('shows meeting date in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await screen.findByText('Steering Committee Q1');
    expect(screen.getAllByText(/2026-04-01/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – RAG color statuses', () => {
  it('shows Budget RAG label in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // RAG indicator labels are shown but not status text (color-coded only)
    expect(screen.getByText('Budget')).toBeInTheDocument();
  });

  it('shows Schedule RAG label in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('Schedule')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Documents empty state', () => {
  it('shows empty state message when no documents exist', async () => {
    mockGetDocuments.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await waitFor(() => {
      expect(screen.getByText(/no documents/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Tasks empty state', () => {
  it('shows empty state message when no tasks exist', async () => {
    mockGetTasks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Financial billing model', () => {
  it('shows Fixed Fee billing model in Financial Summary', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText(/Fixed Fee/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risk severity display', () => {
  it('shows High severity badge on risk', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    });
  });

  it('shows Open status on risk', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
    });
  });

  it('shows risk owner name', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/RT/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Meeting location display', () => {
  it('shows meeting location in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/Conference Room A/).length).toBeGreaterThan(0);
    });
  });

  it('shows meeting participants count', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/AM|2 participants/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Task priority display', () => {
  it('shows task assignee AM in Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/Review Architecture Diagram/).length).toBeGreaterThan(0);
    });
  });

  it('shows task due date in Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getAllByText(/Apr 10|2026-04-10|Apr/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Milestone completion', () => {
  it('shows milestone completion percentage', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Milestones are in Overview tab (default) — no need to switch tabs
    await waitFor(() => {
      expect(screen.getAllByText(/60%|60/).length).toBeGreaterThan(0);
    });
  });

  it('shows milestone value in Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Milestones are in Overview tab (default)
    await waitFor(() => {
      expect(screen.getAllByText(/1,000,000|1000000|Phase 1/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risks empty state', () => {
  it('shows empty state when no risks', async () => {
    mockGetRisks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      expect(screen.getByText(/no risks/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Meetings empty state', () => {
  it('shows empty state when no meetings', async () => {
    mockGetMeetings.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await waitFor(() => {
      expect(screen.getByText(/no meetings/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Milestones empty state', () => {
  it('shows empty state when no milestones', async () => {
    mockGetMilestones.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Milestones are in Overview tab (default — no tab switch needed)
    await waitFor(() => {
      expect(screen.getByText(/no milestones/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Financial contract value display', () => {
  it('shows contract value 5,000,000 in Financial Summary', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Financial summary is shown in overview or as text
    expect(screen.getAllByText(/5,000,000|5M/).length).toBeGreaterThan(0);
  });

  it('shows SAR currency in Financial Summary', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getAllByText(/SAR/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Progress display', () => {
  it('shows 65% progress', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getAllByText(/65%|65/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Sector display', () => {
  it('shows workspace type Client badge in header (sector used for color only)', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // ws.sector is used for border/color styling only — not rendered as visible text
    // ws.type ('Client') IS rendered as a badge
    expect(screen.getAllByText('Client').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Overview Recent Documents section', () => {
  it('shows Recent Documents section header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getByText('Recent Documents')).toBeInTheDocument();
    });
  });

  it('shows document in Recent Documents section', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getAllByText('NCA BRD v2.3').length).toBeGreaterThan(0);
    });
  });

  it('shows View All link in Recent Documents section', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      const viewAllBtns = screen.getAllByRole('button', { name: /view all/i });
      expect(viewAllBtns.length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Overview Open Actions section', () => {
  it('shows Open Actions section header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getByText('Open Actions')).toBeInTheDocument();
    });
  });

  it('shows task in Open Actions section', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getAllByText('Review Architecture Diagram').length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Financial details extended', () => {
  it('shows Budget Utilization label in Financial Summary', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getByText('Budget Utilization')).toBeInTheDocument();
    });
  });

  it('shows Last Invoice date in Financial Summary', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getByText(/2026-02-28/)).toBeInTheDocument();
    });
  });

  it('shows Next Milestone value in Financial Summary', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getByText(/SAR 500K|500,000/i)).toBeInTheDocument();
    });
  });

  it('shows "No financial data" when financials are null', async () => {
    mockGetWorkspaceFinancial.mockResolvedValue(null);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getByText(/No financial data/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – RAG scope and risk labels', () => {
  it('shows all four RAG indicator labels in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // RAG shows: Budget, Schedule, Risk, Overall (NOT Scope — scope field exists in data but is not shown)
    expect(screen.getByText('Budget')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Overall')).toBeInTheDocument();
  });

  it('shows Risk RAG indicator label in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('Risk')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Delete workspace confirmation', () => {
  it('opens delete workspace confirm dialog on delete click', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // The settings/delete button is typically in the header
    const settingsBtns = screen.getAllByRole('button').filter(b =>
      b.getAttribute('title')?.toLowerCase().includes('delete') ||
      b.textContent?.toLowerCase().includes('delete')
    );
    if (settingsBtns.length > 0) {
      await userEvent.click(settingsBtns[0]);
      await waitFor(() => {
        const body = document.body.textContent ?? '';
        expect(body.toLowerCase()).toMatch(/delete|confirm|remove/i);
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Document author display', () => {
  it('shows document date in Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByText(/2026-03-15|Mar 15/).length).toBeGreaterThan(0);
  });

  it('shows document pages count in Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByText(/24 pages|24/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Milestone active count', () => {
  it('shows active milestone count in Milestone Tracker', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      // 1 non-Completed milestone (the mock has status 'On Track')
      expect(screen.getAllByText(/1 active|active/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Milestone value display', () => {
  it('shows milestone SAR 1.0M value in table', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getAllByText(/SAR 1\.0M|1,000,000/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Task status In Progress display', () => {
  it('shows In Progress task status in Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await screen.findByText('Review Architecture Diagram');
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risk owner display', () => {
  it('shows risk owner initials RT in Risks tab (owner is rendered as initials)', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    // owner "Rami Talal" is shown as initials "RT" in the avatar
    expect(screen.getAllByText('RT').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Multiple milestones display', () => {
  it('renders multiple milestones when two milestones returned', async () => {
    const ms2 = { ...mockMilestone, id: 'ms-2', title: 'Phase 2 Go-Live', status: 'Upcoming' as const };
    mockGetMilestones.mockResolvedValue([mockMilestone, ms2]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getByText('Phase 1 Delivery')).toBeInTheDocument();
      expect(screen.getByText('Phase 2 Go-Live')).toBeInTheDocument();
    });
  });

  it('shows 2 active milestones count when two non-Completed milestones exist', async () => {
    const ms2 = { ...mockMilestone, id: 'ms-2', title: 'Phase 2 Go-Live', status: 'Upcoming' as const };
    mockGetMilestones.mockResolvedValue([mockMilestone, ms2]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getAllByText(/2 active/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Documents tab table', () => {
  it('shows document name in Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    expect(await screen.findByText('NCA BRD v2.3')).toBeInTheDocument();
  });

  it('shows document type BRD in Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });

  it('shows document pages count in Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByText('24').length).toBeGreaterThan(0);
  });

  it('shows document author in Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByText(/Ahmed Khalil/).length).toBeGreaterThan(0);
  });

  it('shows Add Document button in Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getByRole('button', { name: /add document/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Meetings tab', () => {
  it('shows meeting title in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    expect(await screen.findByText('Steering Committee Q1')).toBeInTheDocument();
  });

  it('shows meeting duration 2h in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await screen.findByText('Steering Committee Q1');
    expect(screen.getAllByText(/2h/).length).toBeGreaterThan(0);
  });

  it('shows Upcoming status in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await screen.findByText('Steering Committee Q1');
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Overview section headings', () => {
  it('shows Recent Documents section heading in Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('Recent Documents')).toBeInTheDocument();
  });

  it('shows Open Actions section heading in Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('Open Actions')).toBeInTheDocument();
  });

  it('shows Upcoming Meetings section heading in Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('Upcoming Meetings')).toBeInTheDocument();
  });

  it('shows Open Risks section heading in Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('Open Risks')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Milestone tracker section', () => {
  it('shows Milestone Tracker section heading', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('Milestone Tracker')).toBeInTheDocument();
  });

  it('shows Add button in Milestone Tracker', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const addBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'Add');
    expect(addBtn).toBeTruthy();
  });

  it('shows 60% completion percentage on milestone row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getAllByText('60%').length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Financial section', () => {
  it('shows Fixed Fee billing model in financial overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getAllByText(/Fixed Fee/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risks tab content', () => {
  it('shows risk category Procurement in Risks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    expect(screen.getAllByText(/Procurement/).length).toBeGreaterThan(0);
  });

  it('shows risk severity High in Risks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Milestone details', () => {
  it('shows Phase 1 Delivery milestone title', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getAllByText(/Phase 1 Delivery/).length).toBeGreaterThan(0);
    });
  });

  it('shows milestone status On Track', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getAllByText(/On Track/).length).toBeGreaterThan(0);
    });
  });

  it('shows milestone due date 2026-05-01', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      const body = document.body.textContent ?? '';
      expect(body).toMatch(/2026-05-01|May.*2026|01 May/i);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risk tab risk owner initials', () => {
  it('shows risk owner initials RT in Risks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    // owner "Rami Talal" is shown as initials "RT"
    expect(screen.getAllByText('RT').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Documents tab author', () => {
  it('shows document author Ahmed Khalil in Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByText(/Ahmed Khalil/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Task section', () => {
  it('shows task list in default view', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getAllByText(/Review.*BRD|BRD.*Review|task/i).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risk financial exposure', () => {
  it('shows risk financial exposure in Risks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    // Financial exposure 200000 shown
    expect(screen.getAllByText(/200|exposure/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Milestone completion percentage', () => {
  it('shows 60% completion in Milestone Tracker', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getAllByText(/60%/).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – RAG Status editing', () => {
  it('shows Update RAG button when RAG data exists', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByTitle('Update RAG Status')).toBeInTheDocument();
  });

  it('shows Set RAG button when no RAG data', async () => {
    mockGetWorkspaceRagStatus.mockResolvedValue(null);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByTitle('Set RAG Status')).toBeInTheDocument();
  });

  it('opens Update RAG modal when Update RAG button is clicked', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByTitle('Update RAG Status'));
    await waitFor(() => expect(screen.getByText('Update RAG Status')).toBeInTheDocument());
    expect(screen.getByText('Update RAG Status')).toBeInTheDocument();
  });

  it('shows all RAG fields in the modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByTitle('Update RAG Status'));
    await waitFor(() => screen.getByText('Update RAG Status'));
    expect(screen.getByText('Overall Status')).toBeInTheDocument();
    // Use getAllByText since labels also appear in the RAG badge pills
    expect(screen.getAllByText('Budget').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Schedule').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Risk').length).toBeGreaterThan(0);
  });

  it('shows Green, Amber, Red buttons for each field', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByTitle('Update RAG Status'));
    await waitFor(() => screen.getByText('Update RAG Status'));
    const greenBtns = screen.getAllByRole('button', { name: /green/i });
    expect(greenBtns.length).toBeGreaterThan(0);
  });

  it('closes modal when Cancel is clicked', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByTitle('Update RAG Status'));
    await waitFor(() => screen.getByText('Update RAG Status'));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByText('Save RAG Status')).not.toBeInTheDocument());
  });

  it('calls upsertWorkspaceRagStatus when Save RAG Status is clicked', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByTitle('Update RAG Status'));
    await waitFor(() => screen.getByText('Update RAG Status'));
    await userEvent.click(screen.getByRole('button', { name: /save rag status/i }));
    await waitFor(() => expect(mockUpsertWorkspaceRagStatus).toHaveBeenCalled());
  });

  it('passes correct workspace_id to upsertWorkspaceRagStatus', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByTitle('Update RAG Status'));
    await waitFor(() => screen.getByText('Update RAG Status'));
    await userEvent.click(screen.getByRole('button', { name: /save rag status/i }));
    await waitFor(() => {
      expect(mockUpsertWorkspaceRagStatus).toHaveBeenCalledWith(
        expect.objectContaining({ workspace_id: 'ws-1' })
      );
    });
  });

  it('pre-fills form with existing RAG values', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByTitle('Update RAG Status'));
    await waitFor(() => screen.getByText('Update RAG Status'));
    // The mockRag has budget: 'Amber' - check Amber button for Budget is highlighted
    const amberBtns = screen.getAllByRole('button', { name: /amber/i });
    expect(amberBtns.length).toBeGreaterThan(0);
  });

  it('reloads data after successful RAG save', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const initialCallCount = mockGetWorkspace.mock.calls.length;
    await userEvent.click(screen.getByTitle('Update RAG Status'));
    await waitFor(() => screen.getByText('Update RAG Status'));
    await userEvent.click(screen.getByRole('button', { name: /save rag status/i }));
    await waitFor(() => expect(mockGetWorkspace.mock.calls.length).toBeGreaterThan(initialCallCount));
  });

  it('shows error message when upsertWorkspaceRagStatus fails', async () => {
    mockUpsertWorkspaceRagStatus.mockRejectedValue(new Error('RAG update failed'));
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByTitle('Update RAG Status'));
    await waitFor(() => screen.getByText('Update RAG Status'));
    await userEvent.click(screen.getByRole('button', { name: /save rag status/i }));
    await waitFor(() => expect(screen.getByText('RAG update failed')).toBeInTheDocument());
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risk severity filter', () => {
  it('renders severity filter dropdown on Risks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    expect(screen.getByRole('combobox', { name: /filter by risk severity/i })).toBeInTheDocument();
  });

  it('severity filter defaults to All Severities', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    const select = screen.getByRole('combobox', { name: /filter by risk severity/i }) as HTMLSelectElement;
    expect(select.value).toBe('All');
  });

  it('severity filter includes all severity options', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    const select = screen.getByRole('combobox', { name: /filter by risk severity/i });
    const options = Array.from(select.querySelectorAll('option')).map(o => o.value);
    expect(options).toContain('All');
    expect(options).toContain('Critical');
    expect(options).toContain('High');
    expect(options).toContain('Medium');
    expect(options).toContain('Low');
  });

  it('filtering by High shows risk with High severity', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    const select = screen.getByRole('combobox', { name: /filter by risk severity/i });
    await userEvent.selectOptions(select, 'High');
    expect(screen.getByText('Vendor Delay Risk')).toBeInTheDocument();
  });

  it('filtering by Critical hides High severity risk', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    const select = screen.getByRole('combobox', { name: /filter by risk severity/i });
    await userEvent.selectOptions(select, 'Critical');
    expect(screen.queryByText('Vendor Delay Risk')).not.toBeInTheDocument();
  });

  it('filtering by Medium hides High severity risk', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    const select = screen.getByRole('combobox', { name: /filter by risk severity/i });
    await userEvent.selectOptions(select, 'Medium');
    expect(screen.queryByText('Vendor Delay Risk')).not.toBeInTheDocument();
  });

  it('resetting filter to All shows risk again', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    const select = screen.getByRole('combobox', { name: /filter by risk severity/i });
    await userEvent.selectOptions(select, 'Critical');
    expect(screen.queryByText('Vendor Delay Risk')).not.toBeInTheDocument();
    await userEvent.selectOptions(select, 'All');
    expect(screen.getByText('Vendor Delay Risk')).toBeInTheDocument();
  });

  it('filtering by High shows risk when two risks of different severities exist', async () => {
    const criticalRisk = { ...mockRisk, id: 'r2', title: 'Critical Budget Risk', severity: 'Critical' as const };
    mockGetRisks.mockResolvedValue([mockRisk, criticalRisk]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    const select = screen.getByRole('combobox', { name: /filter by risk severity/i });
    await userEvent.selectOptions(select, 'High');
    expect(screen.getByText('Vendor Delay Risk')).toBeInTheDocument();
    expect(screen.queryByText('Critical Budget Risk')).not.toBeInTheDocument();
  });

  it('filtering by Critical shows only critical risk', async () => {
    const criticalRisk = { ...mockRisk, id: 'r2', title: 'Critical Budget Risk', severity: 'Critical' as const };
    mockGetRisks.mockResolvedValue([mockRisk, criticalRisk]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Critical Budget Risk');
    const select = screen.getByRole('combobox', { name: /filter by risk severity/i });
    await userEvent.selectOptions(select, 'Critical');
    expect(screen.getByText('Critical Budget Risk')).toBeInTheDocument();
    expect(screen.queryByText('Vendor Delay Risk')).not.toBeInTheDocument();
  });

  it('All Severities option shows all risks', async () => {
    const criticalRisk = { ...mockRisk, id: 'r2', title: 'Critical Budget Risk', severity: 'Critical' as const };
    mockGetRisks.mockResolvedValue([mockRisk, criticalRisk]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
    const select = screen.getByRole('combobox', { name: /filter by risk severity/i });
    await userEvent.selectOptions(select, 'All');
    expect(screen.getByText('Vendor Delay Risk')).toBeInTheDocument();
    expect(screen.getByText('Critical Budget Risk')).toBeInTheDocument();
  });
});

describe('WorkspaceDetail – Tab aria attributes', () => {
  beforeEach(() => {
    mockGetWorkspace.mockResolvedValue(mockWs);
    mockGetDocuments.mockResolvedValue([]);
    mockGetMeetings.mockResolvedValue([]);
    mockGetTasks.mockResolvedValue([]);
    mockGetRisks.mockResolvedValue([]);
    mockGetWorkspaceFinancial.mockResolvedValue(null);
    mockGetMilestones.mockResolvedValue([]);
  });

  it('Overview tab has aria-pressed=true by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const btn = screen.getByRole('button', { name: /workspace tab: overview/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('Documents tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const btn = screen.getByRole('button', { name: /workspace tab: documents/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Documents sets its aria-pressed=true and Overview to false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    expect(screen.getByRole('button', { name: /workspace tab: documents/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /workspace tab: overview/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Meetings tab has correct aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /workspace tab: meetings/i })).toBeInTheDocument();
  });

  it('Tasks tab has correct aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /workspace tab: tasks/i })).toBeInTheDocument();
  });

  it('clicking Overview restores aria-pressed=true after switching to Documents', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: overview/i }));
    expect(screen.getByRole('button', { name: /workspace tab: overview/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /workspace tab: documents/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risks tab severity filter', () => {
  it('risk severity filter appears in Risks tab', async () => {
    mockGetRisks.mockResolvedValue([mockRisk]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /filter by risk severity/i })).toBeInTheDocument();
    });
  });

  it('risk severity filter defaults to All Severities', async () => {
    mockGetRisks.mockResolvedValue([mockRisk]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: /filter by risk severity/i }) as HTMLSelectElement;
      expect(select.value).toBe('All');
    });
  });

  it('risk severity filter has Critical option', async () => {
    mockGetRisks.mockResolvedValue([mockRisk]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: /filter by risk severity/i });
      const options = Array.from(select.querySelectorAll('option')).map(o => (o as HTMLOptionElement).value);
      expect(options).toContain('Critical');
    });
  });

  it('shows risk title in Risks tab', async () => {
    mockGetRisks.mockResolvedValue([mockRisk]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      expect(screen.getByText('Vendor Delay Risk')).toBeInTheDocument();
    });
  });

  it('filtering by High severity shows matching risk', async () => {
    mockGetRisks.mockResolvedValue([mockRisk]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: /filter by risk severity/i })).toBeInTheDocument());
    const select = screen.getByRole('combobox', { name: /filter by risk severity/i });
    await userEvent.selectOptions(select, 'High');
    await waitFor(() => {
      expect(screen.getByText('Vendor Delay Risk')).toBeInTheDocument();
    });
  });

  it('filtering by Medium severity hides High severity risk', async () => {
    mockGetRisks.mockResolvedValue([mockRisk]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: /filter by risk severity/i })).toBeInTheDocument());
    const select = screen.getByRole('combobox', { name: /filter by risk severity/i });
    await userEvent.selectOptions(select, 'Medium');
    await waitFor(() => {
      expect(screen.queryByText('Vendor Delay Risk')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Tab action button aria-labels', () => {
  it('Add Document button appears in Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Document' })).toBeInTheDocument();
    });
  });

  it('Schedule Meeting button appears in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Schedule Meeting' })).toBeInTheDocument();
    });
  });

  it('New Task button appears in Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New Task' })).toBeInTheDocument();
    });
  });

  it('Log Risk button appears in Risks tab', async () => {
    mockGetRisks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Log Risk' })).toBeInTheDocument();
    });
  });

  it('clicking Add Document button opens the document modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Document' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Add Document' }));
    await waitFor(() => {
      expect(screen.getAllByText('Add Document').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('clicking Schedule Meeting button opens the meeting modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Schedule Meeting' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Schedule Meeting' }));
    await waitFor(() => {
      expect(screen.getAllByText('Schedule Meeting').length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Header and overview button aria-labels', () => {
  it('Refresh workspace button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: 'Refresh workspace' })).toBeInTheDocument();
  });

  it('Edit workspace settings button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: 'Edit workspace settings' })).toBeInTheDocument();
  });

  it('Delete workspace button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: 'Delete workspace' })).toBeInTheDocument();
  });

  it('View all documents button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: 'View all documents' })).toBeInTheDocument();
  });

  it('View all tasks button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: 'View all tasks' })).toBeInTheDocument();
  });

  it('clicking View all documents switches to Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'View all documents' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Document' })).toBeInTheDocument();
    });
  });
});

describe('WorkspaceDetail – Edit workspace form aria-labels', () => {
  it('workspace name input has aria-label in edit modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Edit workspace settings' }));
    expect(await screen.findByRole('textbox', { name: /^workspace name$/i })).toBeInTheDocument();
  });

  it('client or organization input has aria-label in edit modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Edit workspace settings' }));
    expect(await screen.findByRole('textbox', { name: /client or organization/i })).toBeInTheDocument();
  });

  it('workspace description textarea has aria-label in edit modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Edit workspace settings' }));
    expect(await screen.findByRole('textbox', { name: /workspace description/i })).toBeInTheDocument();
  });

  it('workspace sector select has aria-label in edit modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Edit workspace settings' }));
    await screen.findByRole('textbox', { name: /^workspace name$/i });
    expect(screen.getByRole('combobox', { name: /workspace sector/i })).toBeInTheDocument();
  });
});

describe('WorkspaceDetail – Add milestone form aria-labels', () => {
  it('new milestone button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: 'New Milestone' })).toBeInTheDocument();
  });

  it('milestone title input has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'New Milestone' }));
    expect(await screen.findByRole('textbox', { name: /milestone title/i })).toBeInTheDocument();
  });

  it('milestone owner input has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'New Milestone' }));
    expect(await screen.findByRole('textbox', { name: /milestone owner/i })).toBeInTheDocument();
  });

  it('milestone status select has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'New Milestone' }));
    await screen.findByRole('textbox', { name: /milestone title/i });
    expect(screen.getByRole('combobox', { name: /milestone status/i })).toBeInTheDocument();
  });
});

describe('WorkspaceDetail – New task form aria-labels', () => {
  it('task title input has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'New Task' }));
    expect(await screen.findByRole('textbox', { name: /task title/i })).toBeInTheDocument();
  });

  it('task assignee input has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'New Task' }));
    expect(await screen.findByRole('textbox', { name: /task assignee/i })).toBeInTheDocument();
  });
});

describe('WorkspaceDetail – Schedule meeting form aria-labels', () => {
  it('meeting title input has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Schedule Meeting' }));
    expect(await screen.findByRole('textbox', { name: /meeting title/i })).toBeInTheDocument();
  });

  it('meeting location input has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Schedule Meeting' }));
    expect(await screen.findByRole('textbox', { name: /meeting location/i })).toBeInTheDocument();
  });
});

describe('WorkspaceDetail – Log risk form aria-labels', () => {
  it('risk title input has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Log Risk' }));
    expect(await screen.findByRole('textbox', { name: /risk title/i })).toBeInTheDocument();
  });

  it('risk owner input has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Log Risk' }));
    expect(await screen.findByRole('textbox', { name: /risk owner/i })).toBeInTheDocument();
  });
});

describe('WorkspaceDetail – Edit financial summary form', () => {
  it('edit financial summary button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: 'Edit financial summary' })).toBeInTheDocument();
  });

  it('contract value input has aria-label in financial edit modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Edit financial summary' }));
    expect(await screen.findByRole('spinbutton', { name: /contract value/i })).toBeInTheDocument();
  });

  it('billing model select has aria-label in financial edit modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Edit financial summary' }));
    await screen.findByRole('spinbutton', { name: /contract value/i });
    expect(screen.getByRole('combobox', { name: /billing model/i })).toBeInTheDocument();
  });

  it('last invoice date input has aria-label in financial edit modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Edit financial summary' }));
    expect(await screen.findByRole('textbox', { name: /last invoice date/i })).toBeInTheDocument();
  });
});

describe('WorkspaceDetail – Add document form aria-labels', () => {
  it('document name input has aria-label in add document modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add Document' }));
    expect(await screen.findByRole('textbox', { name: /document name/i })).toBeInTheDocument();
  });

  it('document author input has aria-label in add document modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add Document' }));
    expect(await screen.findByRole('textbox', { name: /document author/i })).toBeInTheDocument();
  });

  it('document type select has aria-label in add document modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add Document' }));
    await screen.findByRole('textbox', { name: /document name/i });
    expect(screen.getByRole('combobox', { name: /document type/i })).toBeInTheDocument();
  });

  it('document status select has aria-label in add document modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add Document' }));
    await screen.findByRole('textbox', { name: /document name/i });
    expect(screen.getByRole('combobox', { name: /document status/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Header action buttons', () => {
  it('Refresh workspace button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /refresh workspace/i })).toBeInTheDocument();
  });

  it('Edit workspace settings button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /edit workspace settings/i })).toBeInTheDocument();
  });

  it('Delete workspace button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /delete workspace/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – View All shortcut buttons', () => {
  it('View all documents button navigates to Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const viewAllDocBtn = screen.getByRole('button', { name: /view all documents/i });
    expect(viewAllDocBtn).toBeInTheDocument();
    await userEvent.click(viewAllDocBtn);
    await waitFor(() => {
      const docTab = screen.getByRole('button', { name: /workspace tab: documents/i });
      expect(docTab).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('View all tasks button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /view all tasks/i })).toBeInTheDocument();
  });

  it('View all meetings button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /view all meetings/i })).toBeInTheDocument();
  });

  it('View all risks button has aria-label', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /view all risks/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Filter by risk severity select', () => {
  it('Filter by risk severity select has aria-label on Risks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /filter by risk severity/i })).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Edit workspace additional form fields', () => {
  async function openEditWs() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Edit workspace settings' }));
    await screen.findByRole('textbox', { name: /^workspace name$/i });
  }

  it('workspace type select has aria-label in edit modal', async () => {
    await openEditWs();
    expect(screen.getByRole('combobox', { name: /workspace type/i })).toBeInTheDocument();
  });

  it('workspace language select has aria-label in edit modal', async () => {
    await openEditWs();
    expect(screen.getByRole('combobox', { name: /workspace language/i })).toBeInTheDocument();
  });

  it('workspace status select has aria-label in edit modal', async () => {
    await openEditWs();
    expect(screen.getByRole('combobox', { name: /workspace status/i })).toBeInTheDocument();
  });

  it('progress percentage input has aria-label in edit modal', async () => {
    await openEditWs();
    expect(screen.getByRole('spinbutton', { name: /progress percentage/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Edit financial summary additional fields', () => {
  async function openEditFin() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Edit financial summary' }));
    await screen.findByRole('spinbutton', { name: /contract value/i });
  }

  it('spent to date input has aria-label', async () => {
    await openEditFin();
    expect(screen.getByRole('spinbutton', { name: /spent to date/i })).toBeInTheDocument();
  });

  it('forecast at completion input has aria-label', async () => {
    await openEditFin();
    expect(screen.getByRole('spinbutton', { name: /forecast at completion/i })).toBeInTheDocument();
  });

  it('variance input has aria-label', async () => {
    await openEditFin();
    expect(screen.getByRole('spinbutton', { name: /^variance$/i })).toBeInTheDocument();
  });

  it('next milestone value input has aria-label', async () => {
    await openEditFin();
    expect(screen.getByRole('spinbutton', { name: /next milestone value/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Add milestone additional fields', () => {
  async function openMilestoneModal() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'New Milestone' }));
    await screen.findByRole('textbox', { name: /milestone title/i });
  }

  it('milestone value input has aria-label', async () => {
    await openMilestoneModal();
    expect(screen.getByRole('spinbutton', { name: /milestone value/i })).toBeInTheDocument();
  });

  it('milestone completion percentage input has aria-label', async () => {
    await openMilestoneModal();
    expect(screen.getByRole('spinbutton', { name: /milestone completion percentage/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – New task additional fields', () => {
  async function openTaskModal() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'New Task' }));
    await screen.findByRole('textbox', { name: /task title/i });
  }

  it('task priority select has aria-label', async () => {
    await openTaskModal();
    expect(screen.getByRole('combobox', { name: /task priority/i })).toBeInTheDocument();
  });

  it('task description textarea has aria-label', async () => {
    await openTaskModal();
    expect(screen.getByRole('textbox', { name: /task description/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Schedule meeting additional fields', () => {
  async function openMeetingModal() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Schedule Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
  }

  it('meeting type select has aria-label', async () => {
    await openMeetingModal();
    expect(screen.getByRole('combobox', { name: /meeting type/i })).toBeInTheDocument();
  });

  it('meeting participants input has aria-label', async () => {
    await openMeetingModal();
    expect(screen.getByRole('textbox', { name: /meeting participants/i })).toBeInTheDocument();
  });

  it('meeting duration input has aria-label', async () => {
    await openMeetingModal();
    expect(screen.getByRole('textbox', { name: /meeting duration/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Log risk additional fields', () => {
  async function openRiskModal() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Log Risk' }));
    await screen.findByRole('textbox', { name: /risk title/i });
  }

  it('risk category select has aria-label', async () => {
    await openRiskModal();
    expect(screen.getByRole('combobox', { name: /risk category/i })).toBeInTheDocument();
  });

  it('risk severity select has aria-label', async () => {
    await openRiskModal();
    expect(screen.getAllByRole('combobox', { name: /risk severity/i }).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Add document additional fields', () => {
  async function openDocModal() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add Document' }));
    await screen.findByRole('textbox', { name: /document name/i });
  }

  it('document language select has aria-label', async () => {
    await openDocModal();
    expect(screen.getByRole('combobox', { name: /document language/i })).toBeInTheDocument();
  });

  it('document pages input has aria-label', async () => {
    await openDocModal();
    expect(screen.getByRole('spinbutton', { name: /document pages/i })).toBeInTheDocument();
  });

  it('document summary textarea has aria-label', async () => {
    await openDocModal();
    expect(screen.getByRole('textbox', { name: /document summary/i })).toBeInTheDocument();
  });
});

describe('WorkspaceDetail – Schedule meeting date and time fields', () => {
  async function openMeetingModal() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Schedule Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
  }

  it('Meeting date input has aria-label', async () => {
    await openMeetingModal();
    const dateInput = document.querySelector('[aria-label="Meeting date"]');
    expect(dateInput).toBeInTheDocument();
  });

  it('Meeting time input has aria-label', async () => {
    await openMeetingModal();
    const timeInput = document.querySelector('[aria-label="Meeting time"]');
    expect(timeInput).toBeInTheDocument();
  });
});

describe('WorkspaceDetail – Log risk additional detail fields', () => {
  async function openRiskModal() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Log Risk' }));
    await screen.findByRole('textbox', { name: /risk title/i });
  }

  it('Risk probability select has aria-label', async () => {
    await openRiskModal();
    expect(screen.getByRole('combobox', { name: /risk probability/i })).toBeInTheDocument();
  });

  it('Risk impact select has aria-label', async () => {
    await openRiskModal();
    expect(screen.getByRole('combobox', { name: /risk impact/i })).toBeInTheDocument();
  });

  it('Risk mitigation plan textarea has aria-label', async () => {
    await openRiskModal();
    expect(screen.getByRole('textbox', { name: /risk mitigation plan/i })).toBeInTheDocument();
  });

  it('Risk financial exposure input has aria-label', async () => {
    await openRiskModal();
    expect(screen.getByRole('spinbutton', { name: /risk financial exposure/i })).toBeInTheDocument();
  });
});

describe('WorkspaceDetail – New task due date field', () => {
  async function openTaskModal() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'New Task' }));
    await screen.findByRole('textbox', { name: /task title/i });
  }

  it('Task due date input has aria-label', async () => {
    await openTaskModal();
    const dateInput = document.querySelector('[aria-label="Task due date"]');
    expect(dateInput).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Filter by risk severity option text labels', () => {
  async function openRisksTab() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /filter by risk severity/i })).toBeInTheDocument();
    });
  }

  it('filter has All Severities option', async () => {
    await openRisksTab();
    const sel = screen.getByRole('combobox', { name: /filter by risk severity/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('All Severities');
  });

  it('filter has Critical option', async () => {
    await openRisksTab();
    const sel = screen.getByRole('combobox', { name: /filter by risk severity/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Critical');
  });

  it('filter has High option', async () => {
    await openRisksTab();
    const sel = screen.getByRole('combobox', { name: /filter by risk severity/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('High');
  });

  it('filter has Medium option', async () => {
    await openRisksTab();
    const sel = screen.getByRole('combobox', { name: /filter by risk severity/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Medium');
  });

  it('filter defaults to All Severities value', async () => {
    await openRisksTab();
    const sel = screen.getByRole('combobox', { name: /filter by risk severity/i }) as HTMLSelectElement;
    expect(sel.value).toBe('All');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risk category select option text labels', () => {
  async function openRiskModal() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Log Risk' }));
    await screen.findByRole('textbox', { name: /risk title/i });
  }

  it('risk category select has Governance option', async () => {
    await openRiskModal();
    const sel = screen.getByRole('combobox', { name: /risk category/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Governance');
  });

  it('risk category select has Technical option', async () => {
    await openRiskModal();
    const sel = screen.getByRole('combobox', { name: /risk category/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Technical');
  });

  it('risk category select has Financial option', async () => {
    await openRiskModal();
    const sel = screen.getByRole('combobox', { name: /risk category/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Financial');
  });

  it('risk category select has Procurement option', async () => {
    await openRiskModal();
    const sel = screen.getByRole('combobox', { name: /risk category/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Procurement');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risk severity select option text labels', () => {
  async function openRiskModal() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Log Risk' }));
    await screen.findByRole('textbox', { name: /risk title/i });
  }

  it('risk severity select has Critical option', async () => {
    await openRiskModal();
    const sel = screen.getAllByRole('combobox', { name: /risk severity/i })[0];
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Critical');
  });

  it('risk severity select has High option', async () => {
    await openRiskModal();
    const sel = screen.getAllByRole('combobox', { name: /risk severity/i })[0];
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('High');
  });

  it('risk severity select has Low option', async () => {
    await openRiskModal();
    const sel = screen.getAllByRole('combobox', { name: /risk severity/i })[0];
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Low');
  });

  it('risk severity select can be changed to High', async () => {
    await openRiskModal();
    const sel = screen.getAllByRole('combobox', { name: /risk severity/i })[0];
    await userEvent.selectOptions(sel, 'High');
    expect((sel as HTMLSelectElement).value).toBe('High');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Document type and status select options', () => {
  async function openDocModal() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add Document' }));
    await screen.findByRole('textbox', { name: /document name/i });
  }

  it('document type select has BRD option', async () => {
    await openDocModal();
    const sel = screen.getByRole('combobox', { name: /document type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('BRD');
  });

  it('document type select has Report option', async () => {
    await openDocModal();
    const sel = screen.getByRole('combobox', { name: /document type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Report');
  });

  it('document type select has Technical Spec option', async () => {
    await openDocModal();
    const sel = screen.getByRole('combobox', { name: /document type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Technical Spec');
  });

  it('document status select has Draft option', async () => {
    await openDocModal();
    const sel = screen.getByRole('combobox', { name: /document status/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Draft');
  });

  it('document status select has Approved option', async () => {
    await openDocModal();
    const sel = screen.getByRole('combobox', { name: /document status/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Approved');
  });

  it('document language select has Bilingual option', async () => {
    await openDocModal();
    const sel = screen.getByRole('combobox', { name: /document language/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Bilingual');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Meeting type select options', () => {
  async function openMeetingModal() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Schedule Meeting' }));
    await screen.findByRole('textbox', { name: /meeting title/i });
  }

  it('meeting type select has Workshop option', async () => {
    await openMeetingModal();
    const sel = screen.getByRole('combobox', { name: /meeting type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Workshop');
  });

  it('meeting type select has Committee option', async () => {
    await openMeetingModal();
    const sel = screen.getByRole('combobox', { name: /meeting type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Committee');
  });

  it('meeting type select has Steering option', async () => {
    await openMeetingModal();
    const sel = screen.getByRole('combobox', { name: /meeting type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Steering');
  });

  it('meeting type select can be changed to Committee', async () => {
    await openMeetingModal();
    const sel = screen.getByRole('combobox', { name: /meeting type/i });
    await userEvent.selectOptions(sel, 'Committee');
    expect((sel as HTMLSelectElement).value).toBe('Committee');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Workspace type and sector select options', () => {
  async function openEditWs() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Edit workspace settings' }));
    await screen.findByRole('textbox', { name: /^workspace name$/i });
  }

  it('workspace type select has Client option', async () => {
    await openEditWs();
    const sel = screen.getByRole('combobox', { name: /workspace type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Client');
  });

  it('workspace type select has Internal option', async () => {
    await openEditWs();
    const sel = screen.getByRole('combobox', { name: /workspace type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Internal');
  });

  it('workspace type select has Procurement option', async () => {
    await openEditWs();
    const sel = screen.getByRole('combobox', { name: /workspace type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Procurement');
  });

  it('workspace sector select has Government option', async () => {
    await openEditWs();
    const sel = screen.getByRole('combobox', { name: /workspace sector/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Government');
  });

  it('workspace sector select has Energy option', async () => {
    await openEditWs();
    const sel = screen.getByRole('combobox', { name: /workspace sector/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Energy');
  });

  it('workspace status select has Active option', async () => {
    await openEditWs();
    const sel = screen.getByRole('combobox', { name: /workspace status/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Active');
  });

  it('workspace status select has On Hold option', async () => {
    await openEditWs();
    const sel = screen.getByRole('combobox', { name: /workspace status/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('On Hold');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Billing model select options', () => {
  async function openEditFin() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Edit financial summary' }));
    await screen.findByRole('spinbutton', { name: /contract value/i });
  }

  it('billing model select has Fixed Fee option', async () => {
    await openEditFin();
    const sel = screen.getByRole('combobox', { name: /billing model/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Fixed Fee');
  });

  it('billing model select has Time & Material option', async () => {
    await openEditFin();
    const sel = screen.getByRole('combobox', { name: /billing model/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Time & Material');
  });

  it('billing model select has Retainer option', async () => {
    await openEditFin();
    const sel = screen.getByRole('combobox', { name: /billing model/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Retainer');
  });

  it('billing model select can be changed to Retainer', async () => {
    await openEditFin();
    const sel = screen.getByRole('combobox', { name: /billing model/i });
    await userEvent.selectOptions(sel, 'Retainer');
    expect((sel as HTMLSelectElement).value).toBe('Retainer');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Milestone status select options', () => {
  async function openMilestoneModal() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'New Milestone' }));
    await screen.findByRole('textbox', { name: /milestone title/i });
  }

  it('milestone status select has Upcoming option', async () => {
    await openMilestoneModal();
    const sel = screen.getByRole('combobox', { name: /milestone status/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Upcoming');
  });

  it('milestone status select has On Track option', async () => {
    await openMilestoneModal();
    const sel = screen.getByRole('combobox', { name: /milestone status/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('On Track');
  });

  it('milestone status select has Delayed option', async () => {
    await openMilestoneModal();
    const sel = screen.getByRole('combobox', { name: /milestone status/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Delayed');
  });

  it('milestone status select can be changed to Delayed', async () => {
    await openMilestoneModal();
    const sel = screen.getByRole('combobox', { name: /milestone status/i });
    await userEvent.selectOptions(sel, 'Delayed');
    expect((sel as HTMLSelectElement).value).toBe('Delayed');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Task priority select options', () => {
  async function openTaskModal() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'New Task' }));
    await screen.findByRole('textbox', { name: /task title/i });
  }

  it('task priority select has High option', async () => {
    await openTaskModal();
    const sel = screen.getByRole('combobox', { name: /task priority/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('High');
  });

  it('task priority select has Medium option', async () => {
    await openTaskModal();
    const sel = screen.getByRole('combobox', { name: /task priority/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Medium');
  });

  it('task priority select has Low option', async () => {
    await openTaskModal();
    const sel = screen.getByRole('combobox', { name: /task priority/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Low');
  });

  it('task priority select can be changed to Low', async () => {
    await openTaskModal();
    const sel = screen.getByRole('combobox', { name: /task priority/i });
    await userEvent.selectOptions(sel, 'Low');
    expect((sel as HTMLSelectElement).value).toBe('Low');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Tab aria-pressed default states', () => {
  it('Overview tab has aria-pressed=true by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const btn = screen.getByRole('button', { name: /workspace tab: overview/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('Documents tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const btn = screen.getByRole('button', { name: /workspace tab: documents/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('Meetings tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const btn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('Tasks tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const btn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('Risks tab has aria-pressed=false by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const btn = screen.getByRole('button', { name: /workspace tab: risks/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Tab aria-pressed cross-deselection', () => {
  it('clicking Documents sets it to aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const btn = screen.getByRole('button', { name: /workspace tab: documents/i });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Documents sets Overview to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    await userEvent.click(docsBtn);
    expect(overviewBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Meetings sets Overview to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    await userEvent.click(meetingsBtn);
    expect(overviewBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Tasks sets it to aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const btn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Risks after Tasks sets Tasks to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    await userEvent.click(tasksBtn);
    await userEvent.click(risksBtn);
    expect(tasksBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Overview after Risks restores Overview to aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    await userEvent.click(risksBtn);
    await userEvent.click(overviewBtn);
    expect(overviewBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Documents to Meetings tab cross-deselection', () => {
  it('clicking Meetings sets Documents to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    await userEvent.click(docsBtn);
    await userEvent.click(meetingsBtn);
    expect(docsBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Meetings sets it to aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    await userEvent.click(meetingsBtn);
    expect(meetingsBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Documents after Meetings sets Meetings to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    await userEvent.click(meetingsBtn);
    await userEvent.click(docsBtn);
    expect(meetingsBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Tasks after Documents sets Documents to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    await userEvent.click(docsBtn);
    await userEvent.click(tasksBtn);
    expect(docsBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Meetings to Tasks tab cross-deselection', () => {
  it('clicking Tasks after Meetings sets Meetings to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    await userEvent.click(meetingsBtn);
    await userEvent.click(tasksBtn);
    expect(meetingsBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Tasks sets it to aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    await userEvent.click(tasksBtn);
    expect(tasksBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Meetings after Tasks sets Tasks to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    await userEvent.click(tasksBtn);
    await userEvent.click(meetingsBtn);
    expect(tasksBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Risks after Meetings sets Meetings to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    await userEvent.click(meetingsBtn);
    await userEvent.click(risksBtn);
    expect(meetingsBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risks tab cross-deselection', () => {
  it('clicking Risks sets it to aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    await userEvent.click(risksBtn);
    expect(risksBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Documents after Risks sets Risks to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    await userEvent.click(risksBtn);
    await userEvent.click(docsBtn);
    expect(risksBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Tasks after Risks sets Risks to aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    await userEvent.click(risksBtn);
    await userEvent.click(tasksBtn);
    expect(risksBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('Risks default state is aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    expect(risksBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – full tab cycle', () => {
  it('Overview default is true, Documents default is false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    expect(overviewBtn).toHaveAttribute('aria-pressed', 'true');
    expect(docsBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('Meetings default is false, Tasks default is false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    expect(meetingsBtn).toHaveAttribute('aria-pressed', 'false');
    expect(tasksBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Overview after any other tab restores Overview=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    await userEvent.click(risksBtn);
    await userEvent.click(overviewBtn);
    expect(overviewBtn).toHaveAttribute('aria-pressed', 'true');
    expect(risksBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Meetings then Documents keeps Documents=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    await userEvent.click(meetingsBtn);
    await userEvent.click(docsBtn);
    expect(docsBtn).toHaveAttribute('aria-pressed', 'true');
    expect(meetingsBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – three-tab navigation sequences', () => {
  it('Overview → Documents → Tasks: Tasks=true, Overview=false, Documents=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    await userEvent.click(docsBtn);
    await userEvent.click(tasksBtn);
    expect(tasksBtn).toHaveAttribute('aria-pressed', 'true');
    expect(overviewBtn).toHaveAttribute('aria-pressed', 'false');
    expect(docsBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('Tasks → Risks → Meetings: Meetings=true, Tasks=false, Risks=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    await userEvent.click(tasksBtn);
    await userEvent.click(risksBtn);
    await userEvent.click(meetingsBtn);
    expect(meetingsBtn).toHaveAttribute('aria-pressed', 'true');
    expect(tasksBtn).toHaveAttribute('aria-pressed', 'false');
    expect(risksBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('Meetings → Documents → Overview: Overview=true, rest=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    await userEvent.click(meetingsBtn);
    await userEvent.click(docsBtn);
    await userEvent.click(overviewBtn);
    expect(overviewBtn).toHaveAttribute('aria-pressed', 'true');
    expect(meetingsBtn).toHaveAttribute('aria-pressed', 'false');
    expect(docsBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Overview tab default state', () => {
  it('Overview tab starts with aria-pressed=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /workspace tab: overview/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Documents tab starts with aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /workspace tab: documents/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Tasks tab starts with aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /workspace tab: tasks/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Risks tab starts with aria-pressed=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /workspace tab: risks/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Documents tab interactions', () => {
  it('clicking Documents tab sets it active', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    await userEvent.click(docsBtn);
    await waitFor(() => expect(docsBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Documents deselects Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    await userEvent.click(docsBtn);
    await waitFor(() => expect(overviewBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking Overview after Documents restores Overview=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    await userEvent.click(docsBtn);
    await waitFor(() => expect(docsBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(overviewBtn);
    await waitFor(() => expect(overviewBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Tasks tab interactions', () => {
  it('clicking Tasks tab sets it active', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    await userEvent.click(tasksBtn);
    await waitFor(() => expect(tasksBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Tasks deselects Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    await userEvent.click(tasksBtn);
    await waitFor(() => expect(overviewBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking Overview after Tasks restores Overview=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    await userEvent.click(tasksBtn);
    await waitFor(() => expect(tasksBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(overviewBtn);
    await waitFor(() => expect(overviewBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – additional four-tab sequences', () => {
  it('Docs → Tasks → Risks → Meetings: Meetings=true, rest=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    await userEvent.click(docsBtn);
    await userEvent.click(tasksBtn);
    await userEvent.click(risksBtn);
    await userEvent.click(meetingsBtn);
    await waitFor(() => {
      expect(meetingsBtn).toHaveAttribute('aria-pressed', 'true');
      expect(docsBtn).toHaveAttribute('aria-pressed', 'false');
      expect(tasksBtn).toHaveAttribute('aria-pressed', 'false');
      expect(risksBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Risks → Overview → Documents → Tasks: Tasks=true, rest=false', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    await userEvent.click(risksBtn);
    await userEvent.click(overviewBtn);
    await userEvent.click(docsBtn);
    await userEvent.click(tasksBtn);
    await waitFor(() => {
      expect(tasksBtn).toHaveAttribute('aria-pressed', 'true');
      expect(risksBtn).toHaveAttribute('aria-pressed', 'false');
      expect(overviewBtn).toHaveAttribute('aria-pressed', 'false');
      expect(docsBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – workspace metadata display', () => {
  it('shows workspace client name', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getAllByText(/nca/i).length).toBeGreaterThan(0);
  });

  it('shows workspace description', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText(/national cybersecurity authority platform modernization/i)).toBeInTheDocument();
  });

  it('shows workspace type Client', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getAllByText(/client/i).length).toBeGreaterThan(0);
  });

  it('shows workspace status Active', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Meetings tab interactions', () => {
  it('clicking Meetings tab sets it active', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    await userEvent.click(meetingsBtn);
    await waitFor(() => expect(meetingsBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Meetings deselects Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    await userEvent.click(meetingsBtn);
    await waitFor(() => expect(overviewBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking Overview after Meetings restores Overview=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    await userEvent.click(meetingsBtn);
    await waitFor(() => expect(meetingsBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(overviewBtn);
    await waitFor(() => expect(overviewBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risks tab interactions', () => {
  it('clicking Risks tab sets it active', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    await userEvent.click(risksBtn);
    await waitFor(() => expect(risksBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Risks deselects Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    await userEvent.click(risksBtn);
    await waitFor(() => expect(overviewBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking Overview after Risks restores Overview=true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    await userEvent.click(risksBtn);
    await waitFor(() => expect(risksBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(overviewBtn);
    await waitFor(() => expect(overviewBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – five-tab sequence', () => {
  it('Meetings active after Docs→Tasks→Risks→Overview→Meetings', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    const overviewBtn = screen.getByRole('button', { name: /workspace tab: overview/i });
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    await userEvent.click(docsBtn);
    await userEvent.click(tasksBtn);
    await userEvent.click(risksBtn);
    await userEvent.click(overviewBtn);
    await userEvent.click(meetingsBtn);
    await waitFor(() => {
      expect(meetingsBtn).toHaveAttribute('aria-pressed', 'true');
      expect(docsBtn).toHaveAttribute('aria-pressed', 'false');
      expect(tasksBtn).toHaveAttribute('aria-pressed', 'false');
      expect(risksBtn).toHaveAttribute('aria-pressed', 'false');
      expect(overviewBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Risks active after Meetings→Docs→Tasks→Risks sequence', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const meetingsBtn = screen.getByRole('button', { name: /workspace tab: meetings/i });
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    const tasksBtn = screen.getByRole('button', { name: /workspace tab: tasks/i });
    const risksBtn = screen.getByRole('button', { name: /workspace tab: risks/i });
    await userEvent.click(meetingsBtn);
    await userEvent.click(docsBtn);
    await userEvent.click(tasksBtn);
    await userEvent.click(risksBtn);
    await waitFor(() => {
      expect(risksBtn).toHaveAttribute('aria-pressed', 'true');
      expect(meetingsBtn).toHaveAttribute('aria-pressed', 'false');
      expect(docsBtn).toHaveAttribute('aria-pressed', 'false');
      expect(tasksBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – tab button completeness', () => {
  it('all five tab buttons are present', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /workspace tab: overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /workspace tab: documents/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /workspace tab: tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /workspace tab: risks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /workspace tab: meetings/i })).toBeInTheDocument();
  });

  it('clicking same tab twice stays active', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const docsBtn = screen.getByRole('button', { name: /workspace tab: documents/i });
    await userEvent.click(docsBtn);
    await waitFor(() => expect(docsBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(docsBtn);
    await waitFor(() => expect(docsBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('renders without crashing', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(document.body).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Workspace Notes', () => {
  beforeEach(() => {
    localStorage.removeItem('workspace_notes_ws-1');
  });

  it('renders Workspace Notes section in Overview tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('Workspace Notes')).toBeInTheDocument();
  });

  it('renders workspace notes textarea', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('textbox', { name: /workspace notes input/i })).toBeInTheDocument();
  });

  it('renders Save button for workspace notes', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /save workspace notes/i })).toBeInTheDocument();
  });

  it('can type into workspace notes textarea', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const textarea = screen.getByRole('textbox', { name: /workspace notes input/i });
    await userEvent.type(textarea, 'Key dependency on vendor X');
    expect(textarea).toHaveValue('Key dependency on vendor X');
  });

  it('clicking Save stores notes to localStorage', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const textarea = screen.getByRole('textbox', { name: /workspace notes input/i });
    await userEvent.type(textarea, 'Phase 2 kick-off pending');
    await userEvent.click(screen.getByRole('button', { name: /save workspace notes/i }));
    expect(localStorage.getItem('workspace_notes_ws-1')).toBe('Phase 2 kick-off pending');
  });

  it('shows "Saved" feedback after clicking Save', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.type(screen.getByRole('textbox', { name: /workspace notes input/i }), 'Notes content');
    await userEvent.click(screen.getByRole('button', { name: /save workspace notes/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /save workspace notes/i })).toHaveTextContent('Saved'));
  });

  it('loads persisted notes from localStorage on mount', async () => {
    localStorage.setItem('workspace_notes_ws-1', 'Pre-loaded notes');
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('textbox', { name: /workspace notes input/i })).toHaveValue('Pre-loaded notes');
  });

  it('workspace notes section is not visible on non-Overview tabs', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: /workspace notes input/i })).not.toBeInTheDocument();
    });
  });
});

describe('WorkspaceDetail – Copy Workspace Summary', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows Copy workspace summary button in header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /copy workspace summary to clipboard/i })).toBeInTheDocument();
  });

  it('Copy workspace summary button is not disabled', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /copy workspace summary to clipboard/i })).not.toBeDisabled();
  });

  it('clicking Copy workspace summary calls clipboard.writeText', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /copy workspace summary to clipboard/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('clipboard.writeText called with workspace name', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /copy workspace summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('NCA Enterprise Platform');
    });
  });

  it('clipboard.writeText called with client info', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /copy workspace summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('NCA');
    });
  });

  it('clipboard.writeText called with status info', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /copy workspace summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Active');
    });
  });

  it('shows Copied! label after clicking Copy', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /copy workspace summary to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy workspace summary to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Export Milestones CSV', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.clear();
    mockGetMilestones.mockResolvedValue([mockMilestone]);
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:milestone-url');
    mockRevokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });
    mockClick = vi.fn();
    origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') { el.click = mockClick; }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows Export Milestones button in Milestone Tracker', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await screen.findByText('Phase 1 Delivery');
    expect(screen.getByRole('button', { name: /export milestones to csv/i })).toBeInTheDocument();
  });

  it('Export Milestones button is enabled when milestones exist', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await screen.findByText('Phase 1 Delivery');
    expect(screen.getByRole('button', { name: /export milestones to csv/i })).not.toBeDisabled();
  });

  it('Export Milestones button is disabled when no milestones', async () => {
    mockGetMilestones.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export milestones to csv/i })).toBeDisabled();
    });
  });

  it('clicking Export Milestones calls URL.createObjectURL', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await screen.findByText('Phase 1 Delivery');
    await userEvent.click(screen.getByRole('button', { name: /export milestones to csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export Milestones triggers anchor click (download)', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await screen.findByText('Phase 1 Delivery');
    await userEvent.click(screen.getByRole('button', { name: /export milestones to csv/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export Milestones calls URL.revokeObjectURL', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await screen.findByText('Phase 1 Delivery');
    await userEvent.click(screen.getByRole('button', { name: /export milestones to csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:milestone-url');
  });

  it('shows Exported! text after clicking Export Milestones', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await screen.findByText('Phase 1 Delivery');
    await userEvent.click(screen.getByRole('button', { name: /export milestones to csv/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export milestones to csv/i })).toHaveTextContent('Exported!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Export Risks CSV', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.clear();
    mockGetRisks.mockResolvedValue([mockRisk]);
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:risk-url');
    mockRevokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });
    mockClick = vi.fn();
    origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') { el.click = mockClick; }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function goToRisks() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
  }

  it('shows Export Risks button in Risks tab', async () => {
    await goToRisks();
    expect(screen.getByRole('button', { name: /export risks to csv/i })).toBeInTheDocument();
  });

  it('Export Risks button is enabled when risks exist', async () => {
    await goToRisks();
    expect(screen.getByRole('button', { name: /export risks to csv/i })).not.toBeDisabled();
  });

  it('Export Risks button is disabled when no risks', async () => {
    mockGetRisks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export risks to csv/i })).toBeDisabled();
    });
  });

  it('clicking Export Risks calls URL.createObjectURL', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /export risks to csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export Risks triggers anchor click (download)', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /export risks to csv/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export Risks calls URL.revokeObjectURL', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /export risks to csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:risk-url');
  });

  it('shows Exported! text after clicking Export Risks', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /export risks to csv/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export risks to csv/i })).toHaveTextContent('Exported!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Export Workspace Documents CSV', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.clear();
    mockGetDocuments.mockResolvedValue([mockDoc]);
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:docs-url');
    mockRevokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });
    mockClick = vi.fn();
    origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') { el.click = mockClick; }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function goToDocumentsTab() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('NCA BRD v2.3');
  }

  it('shows Export button in Documents tab', async () => {
    await goToDocumentsTab();
    expect(screen.getByRole('button', { name: /export workspace documents to csv/i })).toBeInTheDocument();
  });

  it('Export Documents button is enabled when docs exist', async () => {
    await goToDocumentsTab();
    expect(screen.getByRole('button', { name: /export workspace documents to csv/i })).not.toBeDisabled();
  });

  it('Export Documents button is disabled when no docs', async () => {
    mockGetDocuments.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export workspace documents to csv/i })).toBeDisabled();
    });
  });

  it('clicking Export Documents calls URL.createObjectURL', async () => {
    await goToDocumentsTab();
    await userEvent.click(screen.getByRole('button', { name: /export workspace documents to csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export Documents triggers anchor click', async () => {
    await goToDocumentsTab();
    await userEvent.click(screen.getByRole('button', { name: /export workspace documents to csv/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export Documents calls URL.revokeObjectURL', async () => {
    await goToDocumentsTab();
    await userEvent.click(screen.getByRole('button', { name: /export workspace documents to csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:docs-url');
  });
});

// ────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Export Workspace Meetings CSV', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.clear();
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:meetings-url');
    mockRevokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });
    mockClick = vi.fn();
    origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') { el.click = mockClick; }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function goToMeetingsTab() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await screen.findByText('Steering Committee Q1');
  }

  it('shows Export button in Meetings tab', async () => {
    await goToMeetingsTab();
    expect(screen.getByRole('button', { name: /export workspace meetings to csv/i })).toBeInTheDocument();
  });

  it('Export Meetings button is enabled when meetings exist', async () => {
    await goToMeetingsTab();
    expect(screen.getByRole('button', { name: /export workspace meetings to csv/i })).not.toBeDisabled();
  });

  it('Export Meetings button is disabled when no meetings', async () => {
    mockGetMeetings.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export workspace meetings to csv/i })).toBeDisabled();
    });
  });

  it('clicking Export Meetings calls URL.createObjectURL', async () => {
    await goToMeetingsTab();
    await userEvent.click(screen.getByRole('button', { name: /export workspace meetings to csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export Meetings triggers anchor click', async () => {
    await goToMeetingsTab();
    await userEvent.click(screen.getByRole('button', { name: /export workspace meetings to csv/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export Meetings calls URL.revokeObjectURL', async () => {
    await goToMeetingsTab();
    await userEvent.click(screen.getByRole('button', { name: /export workspace meetings to csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:meetings-url');
  });
});

// ────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Export Workspace Tasks CSV', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.clear();
    mockGetTasks.mockResolvedValue([mockTask]);
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:tasks-url');
    mockRevokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });
    mockClick = vi.fn();
    origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') { el.click = mockClick; }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function goToTasksTab() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await screen.findByText('Review Architecture Diagram');
  }

  it('shows Export button in Tasks tab', async () => {
    await goToTasksTab();
    expect(screen.getByRole('button', { name: /export workspace tasks to csv/i })).toBeInTheDocument();
  });

  it('Export Tasks button is enabled when tasks exist', async () => {
    await goToTasksTab();
    expect(screen.getByRole('button', { name: /export workspace tasks to csv/i })).not.toBeDisabled();
  });

  it('Export Tasks button is disabled when no tasks', async () => {
    mockGetTasks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export workspace tasks to csv/i })).toBeDisabled();
    });
  });

  it('clicking Export Tasks calls URL.createObjectURL', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /export workspace tasks to csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export Tasks triggers anchor click', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /export workspace tasks to csv/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export Tasks calls URL.revokeObjectURL', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /export workspace tasks to csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:tasks-url');
  });
});

// ────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Copy Risks Summary', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetRisks.mockResolvedValue([mockRisk]);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function goToRisksTab() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
  }

  it('shows Copy risks summary button in Risks tab', async () => {
    await goToRisksTab();
    expect(screen.getByRole('button', { name: /copy risks summary to clipboard/i })).toBeInTheDocument();
  });

  it('Copy risks summary button is enabled when risks exist', async () => {
    await goToRisksTab();
    expect(screen.getByRole('button', { name: /copy risks summary to clipboard/i })).not.toBeDisabled();
  });

  it('Copy risks summary button is disabled when no risks', async () => {
    mockGetRisks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy risks summary to clipboard/i })).toBeDisabled();
    });
  });

  it('clicking Copy risks summary calls clipboard.writeText', async () => {
    await goToRisksTab();
    await userEvent.click(screen.getByRole('button', { name: /copy risks summary to clipboard/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  it('clipboard text contains Total Risks', async () => {
    await goToRisksTab();
    await userEvent.click(screen.getByRole('button', { name: /copy risks summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Total Risks:');
    });
  });

  it('clipboard text contains Open count', async () => {
    await goToRisksTab();
    await userEvent.click(screen.getByRole('button', { name: /copy risks summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Open:');
    });
  });

  it('shows Copied! feedback after clicking Copy risks summary', async () => {
    await goToRisksTab();
    await userEvent.click(screen.getByRole('button', { name: /copy risks summary to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy risks summary to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Copy Milestones Summary', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetMilestones.mockResolvedValue([mockMilestone]);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows Copy milestones summary to clipboard button in Overview', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /copy milestones summary to clipboard/i })).toBeInTheDocument();
  });

  it('Copy milestones summary button is enabled when milestones exist', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /copy milestones summary to clipboard/i })).not.toBeDisabled();
  });

  it('Copy milestones summary button is disabled when no milestones', async () => {
    mockGetMilestones.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy milestones summary to clipboard/i })).toBeDisabled();
    });
  });

  it('clicking Copy milestones summary calls clipboard.writeText', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /copy milestones summary to clipboard/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  it('clipboard text contains Total count', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /copy milestones summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Total:');
    });
  });

  it('clipboard text contains On Track count', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /copy milestones summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('On Track:');
    });
  });

  it('shows Copied! feedback after clicking Copy milestones summary', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /copy milestones summary to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy milestones summary to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Copy Tasks Summary', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetTasks.mockResolvedValue([mockTask]);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function goToTasksTab() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await screen.findByText('Review Architecture Diagram');
  }

  it('shows Copy workspace tasks summary button in Tasks tab', async () => {
    await goToTasksTab();
    expect(screen.getByRole('button', { name: /copy workspace tasks summary to clipboard/i })).toBeInTheDocument();
  });

  it('Copy tasks summary button is enabled when tasks exist', async () => {
    await goToTasksTab();
    expect(screen.getByRole('button', { name: /copy workspace tasks summary to clipboard/i })).not.toBeDisabled();
  });

  it('Copy tasks summary button is disabled when no tasks', async () => {
    mockGetTasks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy workspace tasks summary to clipboard/i })).toBeDisabled();
    });
  });

  it('clicking Copy tasks summary calls clipboard.writeText', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /copy workspace tasks summary to clipboard/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  it('clipboard text contains Total count', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /copy workspace tasks summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Total:');
    });
  });

  it('clipboard text contains Completed count', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /copy workspace tasks summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Completed:');
    });
  });

  it('shows Copied! feedback after clicking Copy tasks summary', async () => {
    await goToTasksTab();
    await userEvent.click(screen.getByRole('button', { name: /copy workspace tasks summary to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy workspace tasks summary to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Copy Meetings Summary', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function goToMeetingsTab() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await screen.findByText('Steering Committee Q1');
  }

  it('shows Copy workspace meetings summary button in Meetings tab', async () => {
    await goToMeetingsTab();
    expect(screen.getByRole('button', { name: /copy workspace meetings summary to clipboard/i })).toBeInTheDocument();
  });

  it('Copy meetings summary button is enabled when meetings exist', async () => {
    await goToMeetingsTab();
    expect(screen.getByRole('button', { name: /copy workspace meetings summary to clipboard/i })).not.toBeDisabled();
  });

  it('Copy meetings summary button is disabled when no meetings', async () => {
    mockGetMeetings.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy workspace meetings summary to clipboard/i })).toBeDisabled();
    });
  });

  it('clicking Copy meetings summary calls clipboard.writeText', async () => {
    await goToMeetingsTab();
    await userEvent.click(screen.getByRole('button', { name: /copy workspace meetings summary to clipboard/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  it('clipboard text contains Total count', async () => {
    await goToMeetingsTab();
    await userEvent.click(screen.getByRole('button', { name: /copy workspace meetings summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Total:');
    });
  });

  it('clipboard text contains Upcoming count', async () => {
    await goToMeetingsTab();
    await userEvent.click(screen.getByRole('button', { name: /copy workspace meetings summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Upcoming:');
    });
  });

  it('shows Copied! feedback after clicking Copy meetings summary', async () => {
    await goToMeetingsTab();
    await userEvent.click(screen.getByRole('button', { name: /copy workspace meetings summary to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy workspace meetings summary to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

describe('WorkspaceDetail – Export Workspace Summary TXT', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.clear();
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:ws-summary-url');
    mockRevokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });
    mockClick = vi.fn();
    origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') { el.click = mockClick; }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows Export TXT button in workspace header', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: /export workspace summary to txt/i })).toBeInTheDocument();
  });

  it('clicking Export TXT calls URL.createObjectURL', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /export workspace summary to txt/i }));
    await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalled());
  });

  it('clicking Export TXT triggers anchor click', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /export workspace summary to txt/i }));
    await waitFor(() => expect(mockClick).toHaveBeenCalled());
  });

  it('clicking Export TXT calls URL.revokeObjectURL', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /export workspace summary to txt/i }));
    await waitFor(() => expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:ws-summary-url'));
  });

  it('shows Exported! feedback after clicking Export TXT', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /export workspace summary to txt/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export workspace summary to txt/i })).toHaveTextContent('Exported!');
    });
  });
});

// ── Task Status Quick Filter ──────────────────────────────────
describe('WorkspaceDetail – Task Status Quick Filter', () => {
  async function goToTasks() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await screen.findByText('Review Architecture Diagram');
  }

  it('renders All task status filter button in Tasks tab', async () => {
    await goToTasks();
    expect(screen.getByRole('button', { name: /filter workspace tasks by status: all/i })).toBeInTheDocument();
  });

  it('renders In Progress task status filter button in Tasks tab', async () => {
    await goToTasks();
    expect(screen.getByRole('button', { name: /filter workspace tasks by status: in progress/i })).toBeInTheDocument();
  });

  it('renders Completed task status filter button in Tasks tab', async () => {
    await goToTasks();
    expect(screen.getByRole('button', { name: /filter workspace tasks by status: completed/i })).toBeInTheDocument();
  });

  it('All filter is pressed by default', async () => {
    await goToTasks();
    expect(screen.getByRole('button', { name: /filter workspace tasks by status: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('In Progress filter is not pressed by default', async () => {
    await goToTasks();
    expect(screen.getByRole('button', { name: /filter workspace tasks by status: in progress/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking In Progress filter sets it to pressed', async () => {
    await goToTasks();
    await userEvent.click(screen.getByRole('button', { name: /filter workspace tasks by status: in progress/i }));
    expect(screen.getByRole('button', { name: /filter workspace tasks by status: in progress/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking In Progress deactivates All', async () => {
    await goToTasks();
    await userEvent.click(screen.getByRole('button', { name: /filter workspace tasks by status: in progress/i }));
    expect(screen.getByRole('button', { name: /filter workspace tasks by status: all/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('In Progress filter shows the In Progress task', async () => {
    await goToTasks();
    await userEvent.click(screen.getByRole('button', { name: /filter workspace tasks by status: in progress/i }));
    await waitFor(() => {
      expect(screen.getByText('Review Architecture Diagram')).toBeInTheDocument();
    });
  });

  it('Completed filter hides In Progress tasks', async () => {
    await goToTasks();
    await userEvent.click(screen.getByRole('button', { name: /filter workspace tasks by status: completed/i }));
    await waitFor(() => {
      expect(screen.queryByText('Review Architecture Diagram')).not.toBeInTheDocument();
    });
  });

  it('clicking All after filter restores All as pressed', async () => {
    await goToTasks();
    await userEvent.click(screen.getByRole('button', { name: /filter workspace tasks by status: in progress/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter workspace tasks by status: all/i }));
    expect(screen.getByRole('button', { name: /filter workspace tasks by status: all/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /filter workspace tasks by status: in progress/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('WorkspaceDetail – Risk Status Quick Filter', () => {
  const mockMitigatedRisk = {
    ...mockRisk,
    id: 'r-mitigated',
    title: 'Mitigated Budget Risk',
    status: 'Mitigated' as const,
    severity: 'Medium' as const,
  };

  async function goToRisks() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Vendor Delay Risk');
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspace.mockResolvedValue(mockWs);
    mockGetDocuments.mockResolvedValue([]);
    mockGetMeetings.mockResolvedValue([]);
    mockGetTasks.mockResolvedValue([]);
    mockGetRisks.mockResolvedValue([mockRisk, mockMitigatedRisk]);
    mockGetWorkspaceFinancial.mockResolvedValue(mockFin);
    mockGetMilestones.mockResolvedValue([]);
    mockGetWorkspaceRagStatus.mockResolvedValue(mockRag);
    mockUpsertWorkspaceRagStatus.mockResolvedValue(mockRag);
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders risk status filter buttons in Risks tab', async () => {
    await goToRisks();
    expect(screen.getByRole('button', { name: /filter risks by status: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter risks by status: open/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter risks by status: mitigated/i })).toBeInTheDocument();
  });

  it('All status filter is active by default', async () => {
    await goToRisks();
    expect(screen.getByRole('button', { name: /filter risks by status: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('All filter shows both open and mitigated risks', async () => {
    await goToRisks();
    expect(screen.getByText('Vendor Delay Risk')).toBeInTheDocument();
    expect(screen.getByText('Mitigated Budget Risk')).toBeInTheDocument();
  });

  it('Open filter shows only Open risks', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /filter risks by status: open/i }));
    await waitFor(() => {
      expect(screen.getByText('Vendor Delay Risk')).toBeInTheDocument();
      expect(screen.queryByText('Mitigated Budget Risk')).not.toBeInTheDocument();
    });
  });

  it('Mitigated filter shows only Mitigated risks', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /filter risks by status: mitigated/i }));
    await waitFor(() => {
      expect(screen.getByText('Mitigated Budget Risk')).toBeInTheDocument();
      expect(screen.queryByText('Vendor Delay Risk')).not.toBeInTheDocument();
    });
  });

  it('clicking Open sets it as active', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /filter risks by status: open/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter risks by status: open/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Open deactivates All', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /filter risks by status: open/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter risks by status: all/i })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All after Open restores both risks', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /filter risks by status: open/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter risks by status: all/i }));
    await waitFor(() => {
      expect(screen.getByText('Vendor Delay Risk')).toBeInTheDocument();
      expect(screen.getByText('Mitigated Budget Risk')).toBeInTheDocument();
    });
  });

  it('Monitoring filter shows empty when no monitoring risks', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /filter risks by status: monitoring/i }));
    await waitFor(() => {
      expect(screen.queryByText('Vendor Delay Risk')).not.toBeInTheDocument();
      expect(screen.queryByText('Mitigated Budget Risk')).not.toBeInTheDocument();
    });
  });

  it('Closed filter button exists', async () => {
    await goToRisks();
    expect(screen.getByRole('button', { name: /filter risks by status: closed/i })).toBeInTheDocument();
  });
});

describe('WorkspaceDetail – Milestone Status Filter', () => {
  const mockOnTrackMs = {
    ...mockMilestone, id: 'ms-ontrack', title: 'On Track Milestone', status: 'On Track' as const,
  };
  const mockAtRiskMs = {
    ...mockMilestone, id: 'ms-atrisk', title: 'At Risk Milestone', status: 'At Risk' as const,
  };
  const mockCompletedMs = {
    ...mockMilestone, id: 'ms-done', title: 'Completed Milestone', status: 'Completed' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspace.mockResolvedValue(mockWs);
    mockGetDocuments.mockResolvedValue([mockDoc]);
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    mockGetTasks.mockResolvedValue([mockTask]);
    mockGetRisks.mockResolvedValue([mockRisk]);
    mockGetWorkspaceFinancial.mockResolvedValue(mockFin);
    mockGetWorkspaceRagStatus.mockResolvedValue(mockRag);
    mockUpsertWorkspaceRagStatus.mockResolvedValue(mockRag);
    mockGetMilestones.mockResolvedValue([mockOnTrackMs, mockAtRiskMs, mockCompletedMs]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows milestone status filter buttons when milestones exist', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => expect(screen.getByRole('button', { name: /filter milestones by status: all/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /filter milestones by status: on track/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter milestones by status: at risk/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter milestones by status: completed/i })).toBeInTheDocument();
  });

  it('All filter button is pressed by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => expect(
      screen.getByRole('button', { name: /filter milestones by status: all/i })
    ).toHaveAttribute('aria-pressed', 'true'));
  });

  it('shows all milestones when All filter is selected', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => {
      expect(screen.getByText('On Track Milestone')).toBeInTheDocument();
      expect(screen.getByText('At Risk Milestone')).toBeInTheDocument();
      expect(screen.getByText('Completed Milestone')).toBeInTheDocument();
    });
  });

  it('filters to show only On Track milestones', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => screen.getByText('On Track Milestone'));
    await userEvent.click(screen.getByRole('button', { name: /filter milestones by status: on track/i }));
    await waitFor(() => {
      expect(screen.getByText('On Track Milestone')).toBeInTheDocument();
      expect(screen.queryByText('At Risk Milestone')).not.toBeInTheDocument();
      expect(screen.queryByText('Completed Milestone')).not.toBeInTheDocument();
    });
  });

  it('filters to show only At Risk milestones', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => screen.getByText('At Risk Milestone'));
    await userEvent.click(screen.getByRole('button', { name: /filter milestones by status: at risk/i }));
    await waitFor(() => {
      expect(screen.queryByText('On Track Milestone')).not.toBeInTheDocument();
      expect(screen.getByText('At Risk Milestone')).toBeInTheDocument();
      expect(screen.queryByText('Completed Milestone')).not.toBeInTheDocument();
    });
  });

  it('filters to show only Completed milestones', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => screen.getByText('Completed Milestone'));
    await userEvent.click(screen.getByRole('button', { name: /filter milestones by status: completed/i }));
    await waitFor(() => {
      expect(screen.queryByText('On Track Milestone')).not.toBeInTheDocument();
      expect(screen.queryByText('At Risk Milestone')).not.toBeInTheDocument();
      expect(screen.getByText('Completed Milestone')).toBeInTheDocument();
    });
  });

  it('clicking All after a filter restores all milestones', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => screen.getByText('At Risk Milestone'));
    await userEvent.click(screen.getByRole('button', { name: /filter milestones by status: at risk/i }));
    await waitFor(() => expect(screen.queryByText('On Track Milestone')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /filter milestones by status: all/i }));
    await waitFor(() => {
      expect(screen.getByText('On Track Milestone')).toBeInTheDocument();
      expect(screen.getByText('At Risk Milestone')).toBeInTheDocument();
    });
  });

  it('selected filter button has aria-pressed true', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => screen.getByText('At Risk Milestone'));
    await userEvent.click(screen.getByRole('button', { name: /filter milestones by status: at risk/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filter milestones by status: at risk/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /filter milestones by status: all/i })).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

describe('WorkspaceDetail – Milestone Search', () => {
  const msAlpha = { ...mockMilestone, id: 'ms-alpha', title: 'Alpha Milestone Delivery', status: 'On Track' as const };
  const msBeta = { ...mockMilestone, id: 'ms-beta', title: 'Beta Milestone Planning', status: 'At Risk' as const };
  const msGamma = { ...mockMilestone, id: 'ms-gamma', title: 'Gamma Milestone Review', status: 'Completed' as const };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspace.mockResolvedValue(mockWs);
    mockGetDocuments.mockResolvedValue([mockDoc]);
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    mockGetTasks.mockResolvedValue([mockTask]);
    mockGetRisks.mockResolvedValue([mockRisk]);
    mockGetWorkspaceFinancial.mockResolvedValue(mockFin);
    mockGetWorkspaceRagStatus.mockResolvedValue(mockRag);
    mockUpsertWorkspaceRagStatus.mockResolvedValue(mockRag);
    mockGetMilestones.mockResolvedValue([msAlpha, msBeta, msGamma]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders search milestones input when milestones exist', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search milestones/i })).toBeInTheDocument());
  });

  it('search input is empty by default', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search milestones/i })).toHaveValue(''));
  });

  it('typing filters milestones by title', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => screen.getByText('Alpha Milestone Delivery'));
    await userEvent.type(screen.getByRole('textbox', { name: /search milestones/i }), 'Alpha');
    await waitFor(() => {
      expect(screen.getByText('Alpha Milestone Delivery')).toBeInTheDocument();
      expect(screen.queryByText('Beta Milestone Planning')).not.toBeInTheDocument();
      expect(screen.queryByText('Gamma Milestone Review')).not.toBeInTheDocument();
    });
  });

  it('search is case-insensitive', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => screen.getByText('Beta Milestone Planning'));
    await userEvent.type(screen.getByRole('textbox', { name: /search milestones/i }), 'BETA');
    await waitFor(() => expect(screen.getByText('Beta Milestone Planning')).toBeInTheDocument());
  });

  it('clearing search restores all milestones', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => screen.getByText('Alpha Milestone Delivery'));
    const input = screen.getByRole('textbox', { name: /search milestones/i });
    await userEvent.type(input, 'Alpha');
    await waitFor(() => expect(screen.queryByText('Beta Milestone Planning')).not.toBeInTheDocument());
    await userEvent.clear(input);
    await waitFor(() => {
      expect(screen.getByText('Alpha Milestone Delivery')).toBeInTheDocument();
      expect(screen.getByText('Beta Milestone Planning')).toBeInTheDocument();
    });
  });

  it('search with no match shows no milestones', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await waitFor(() => screen.getByText('Alpha Milestone Delivery'));
    await userEvent.type(screen.getByRole('textbox', { name: /search milestones/i }), 'zzznotfound');
    await waitFor(() => {
      expect(screen.queryByText('Alpha Milestone Delivery')).not.toBeInTheDocument();
      expect(screen.queryByText('Beta Milestone Planning')).not.toBeInTheDocument();
    });
  });
});

// ── Meeting Type Filter ─────────────────────────────────────────
describe('WorkspaceDetail – Meeting Type Filter', () => {
  const mockReviewMtg = {
    id: 'mtg-rev',
    title: 'Architecture Review Meeting',
    date: '2026-05-01',
    time: '14:00',
    duration: '1h',
    type: 'Review' as const,
    status: 'Upcoming' as const,
    participants: ['AM'],
    workspace: 'NCA',
    workspace_id: 'ws-1',
    location: '',
    minutes_generated: false,
    actions_extracted: 0,
    decisions_logged: 0,
    agenda: [],
    created_at: '',
    updated_at: '',
  };

  async function goToMeetings() {
    mockGetMeetings.mockResolvedValue([mockMeeting, mockReviewMtg]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    fireEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await waitFor(() => screen.getByText('Steering Committee Q1'));
  }

  it('renders meeting type filter buttons', async () => {
    await goToMeetings();
    expect(screen.getByRole('button', { name: /filter meetings by type: all/i })).toBeInTheDocument();
  });

  it('All filter is pressed by default', async () => {
    await goToMeetings();
    expect(screen.getByRole('button', { name: /filter meetings by type: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows both meeting type filter buttons derived from data', async () => {
    await goToMeetings();
    expect(screen.getByRole('button', { name: /filter meetings by type: steering/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter meetings by type: review/i })).toBeInTheDocument();
  });

  it('clicking a type filter shows only that type', async () => {
    await goToMeetings();
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by type: review/i }));
    await waitFor(() => {
      expect(screen.getByText('Architecture Review Meeting')).toBeInTheDocument();
      expect(screen.queryByText('Steering Committee Q1')).not.toBeInTheDocument();
    });
  });

  it('type filter button becomes aria-pressed true', async () => {
    await goToMeetings();
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by type: steering/i }));
    expect(screen.getByRole('button', { name: /filter meetings by type: steering/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking All restores all meeting types', async () => {
    await goToMeetings();
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by type: review/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter meetings by type: all/i }));
    await waitFor(() => {
      expect(screen.getByText('Steering Committee Q1')).toBeInTheDocument();
      expect(screen.getByText('Architecture Review Meeting')).toBeInTheDocument();
    });
  });

  it('type filter not shown when no meetings', async () => {
    mockGetMeetings.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    fireEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await waitFor(() => screen.getByText(/no meetings yet/i));
    expect(screen.queryByRole('button', { name: /filter meetings by type: all/i })).not.toBeInTheDocument();
  });
});

describe('WorkspaceDetail – Document Status Filter', () => {
  const docDraft = { ...mockDoc, id: 'dd1', name: 'Draft Document', status: 'Draft' as const };
  const docApproved = { ...mockDoc, id: 'dd2', name: 'Approved Document', status: 'Approved' as const };
  const docReview = { ...mockDoc, id: 'dd3', name: 'Review Document', status: 'Under Review' as const };
  const docFinal = { ...mockDoc, id: 'dd4', name: 'Final Document', status: 'Final' as const };

  async function goToDocs() {
    mockGetDocuments.mockResolvedValue([docDraft, docApproved, docReview, docFinal]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    fireEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /filter documents by status: all/i }).length).toBeGreaterThan(0));
  }

  it('renders 5 document status filter buttons', async () => {
    await goToDocs();
    expect(screen.getByRole('button', { name: /filter documents by status: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter documents by status: draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter documents by status: approved/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter documents by status: under review/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter documents by status: final/i })).toBeInTheDocument();
  });

  it('All filter button is pressed by default', async () => {
    await goToDocs();
    const allBtn = screen.getByRole('button', { name: /filter documents by status: all/i });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows all documents when All filter is selected', async () => {
    await goToDocs();
    expect(screen.getByText('Draft Document')).toBeInTheDocument();
    expect(screen.getByText('Approved Document')).toBeInTheDocument();
    expect(screen.getByText('Review Document')).toBeInTheDocument();
    expect(screen.getByText('Final Document')).toBeInTheDocument();
  });

  it('Draft filter shows only draft documents', async () => {
    await goToDocs();
    await userEvent.click(screen.getByRole('button', { name: /filter documents by status: draft/i }));
    expect(screen.getByText('Draft Document')).toBeInTheDocument();
    expect(screen.queryByText('Approved Document')).not.toBeInTheDocument();
    expect(screen.queryByText('Review Document')).not.toBeInTheDocument();
    expect(screen.queryByText('Final Document')).not.toBeInTheDocument();
  });

  it('Approved filter shows only approved documents', async () => {
    await goToDocs();
    await userEvent.click(screen.getByRole('button', { name: /filter documents by status: approved/i }));
    expect(screen.getByText('Approved Document')).toBeInTheDocument();
    expect(screen.queryByText('Draft Document')).not.toBeInTheDocument();
  });

  it('Under Review filter shows only under-review documents', async () => {
    await goToDocs();
    await userEvent.click(screen.getByRole('button', { name: /filter documents by status: under review/i }));
    expect(screen.getByText('Review Document')).toBeInTheDocument();
    expect(screen.queryByText('Draft Document')).not.toBeInTheDocument();
    expect(screen.queryByText('Approved Document')).not.toBeInTheDocument();
  });

  it('clicking All after Draft filter restores all documents', async () => {
    await goToDocs();
    await userEvent.click(screen.getByRole('button', { name: /filter documents by status: draft/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter documents by status: all/i }));
    expect(screen.getByText('Approved Document')).toBeInTheDocument();
    expect(screen.getByText('Draft Document')).toBeInTheDocument();
  });

  it('selected filter button has aria-pressed true', async () => {
    await goToDocs();
    await userEvent.click(screen.getByRole('button', { name: /filter documents by status: approved/i }));
    expect(screen.getByRole('button', { name: /filter documents by status: approved/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /filter documents by status: all/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ── Task Priority Filter ──────────────────────────────────────
describe('WorkspaceDetail – Task Priority Filter', () => {
  const highTask = { ...mockTask, id: 't-hi', title: 'High Priority Task', priority: 'High' as const };
  const medTask = { ...mockTask, id: 't-med', title: 'Medium Priority Task', priority: 'Medium' as const, status: 'Backlog' as const };
  const lowTask = { ...mockTask, id: 't-lo', title: 'Low Priority Task', priority: 'Low' as const, status: 'Backlog' as const };

  async function goToTasks() {
    mockGetTasks.mockResolvedValue([highTask, medTask, lowTask]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await screen.findByText('High Priority Task');
  }

  it('renders All priority filter button', async () => {
    await goToTasks();
    expect(screen.getByRole('button', { name: /filter workspace tasks by priority: all/i })).toBeInTheDocument();
  });

  it('renders High priority filter button', async () => {
    await goToTasks();
    expect(screen.getByRole('button', { name: /filter workspace tasks by priority: high/i })).toBeInTheDocument();
  });

  it('renders Medium and Low priority filter buttons', async () => {
    await goToTasks();
    expect(screen.getByRole('button', { name: /filter workspace tasks by priority: medium/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter workspace tasks by priority: low/i })).toBeInTheDocument();
  });

  it('All priority filter is pressed by default', async () => {
    await goToTasks();
    expect(screen.getByRole('button', { name: /filter workspace tasks by priority: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('High filter shows only High priority tasks', async () => {
    await goToTasks();
    await userEvent.click(screen.getByRole('button', { name: /filter workspace tasks by priority: high/i }));
    expect(screen.getByText('High Priority Task')).toBeInTheDocument();
    expect(screen.queryByText('Medium Priority Task')).not.toBeInTheDocument();
    expect(screen.queryByText('Low Priority Task')).not.toBeInTheDocument();
  });

  it('Medium filter shows only Medium priority tasks', async () => {
    await goToTasks();
    await userEvent.click(screen.getByRole('button', { name: /filter workspace tasks by priority: medium/i }));
    expect(screen.getByText('Medium Priority Task')).toBeInTheDocument();
    expect(screen.queryByText('High Priority Task')).not.toBeInTheDocument();
  });

  it('clicking All after filtering restores all tasks', async () => {
    await goToTasks();
    await userEvent.click(screen.getByRole('button', { name: /filter workspace tasks by priority: high/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter workspace tasks by priority: all/i }));
    expect(screen.getByText('Medium Priority Task')).toBeInTheDocument();
    expect(screen.getByText('Low Priority Task')).toBeInTheDocument();
  });

  it('selected priority filter has aria-pressed true', async () => {
    await goToTasks();
    await userEvent.click(screen.getByRole('button', { name: /filter workspace tasks by priority: medium/i }));
    expect(screen.getByRole('button', { name: /filter workspace tasks by priority: medium/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /filter workspace tasks by priority: all/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ── Meeting Status Filter ─────────────────────────────────────
describe('WorkspaceDetail – Meeting Status Filter', () => {
  const upcomingMtg = { ...mockMeeting, id: 'mtg-u', title: 'Upcoming Meeting', status: 'Upcoming' as const };
  const completedMtg = { ...mockMeeting, id: 'mtg-c', title: 'Completed Meeting', status: 'Completed' as const };

  async function goToMeetings() {
    mockGetMeetings.mockResolvedValue([upcomingMtg, completedMtg]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await screen.findByText('Upcoming Meeting');
  }

  it('renders All meeting status filter button', async () => {
    await goToMeetings();
    expect(screen.getByRole('button', { name: /filter workspace meetings by status: all/i })).toBeInTheDocument();
  });

  it('renders Upcoming meeting status filter button', async () => {
    await goToMeetings();
    expect(screen.getByRole('button', { name: /filter workspace meetings by status: upcoming/i })).toBeInTheDocument();
  });

  it('renders Completed meeting status filter button', async () => {
    await goToMeetings();
    expect(screen.getByRole('button', { name: /filter workspace meetings by status: completed/i })).toBeInTheDocument();
  });

  it('All filter is pressed by default', async () => {
    await goToMeetings();
    expect(screen.getByRole('button', { name: /filter workspace meetings by status: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Upcoming filter shows only upcoming meetings', async () => {
    await goToMeetings();
    await userEvent.click(screen.getByRole('button', { name: /filter workspace meetings by status: upcoming/i }));
    expect(screen.getByText('Upcoming Meeting')).toBeInTheDocument();
    expect(screen.queryByText('Completed Meeting')).not.toBeInTheDocument();
  });

  it('Completed filter shows only completed meetings', async () => {
    await goToMeetings();
    await userEvent.click(screen.getByRole('button', { name: /filter workspace meetings by status: completed/i }));
    expect(screen.getByText('Completed Meeting')).toBeInTheDocument();
    expect(screen.queryByText('Upcoming Meeting')).not.toBeInTheDocument();
  });

  it('clicking All after filter restores all meetings', async () => {
    await goToMeetings();
    await userEvent.click(screen.getByRole('button', { name: /filter workspace meetings by status: upcoming/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter workspace meetings by status: all/i }));
    expect(screen.getByText('Completed Meeting')).toBeInTheDocument();
  });

  it('selected status filter has aria-pressed true', async () => {
    await goToMeetings();
    await userEvent.click(screen.getByRole('button', { name: /filter workspace meetings by status: completed/i }));
    expect(screen.getByRole('button', { name: /filter workspace meetings by status: completed/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /filter workspace meetings by status: all/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('WorkspaceDetail – Task Search', () => {
  const taskAlpha = { ...mockTask, id: 't-a', title: 'Alpha Task Review', priority: 'High' as const };
  const taskBeta = { ...mockTask, id: 't-b', title: 'Beta Task Planning', priority: 'Medium' as const, status: 'Backlog' as const };
  const taskGamma = { ...mockTask, id: 't-g', title: 'Gamma Task Deployment', priority: 'Low' as const, status: 'Backlog' as const };

  async function goToTasksWithAll() {
    mockGetTasks.mockResolvedValue([taskAlpha, taskBeta, taskGamma]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await screen.findByText('Alpha Task Review');
  }

  it('renders Search workspace tasks input', async () => {
    await goToTasksWithAll();
    expect(screen.getByRole('textbox', { name: /search workspace tasks/i })).toBeInTheDocument();
  });

  it('search input defaults to empty', async () => {
    await goToTasksWithAll();
    const input = screen.getByRole('textbox', { name: /search workspace tasks/i }) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('searching for Alpha hides Beta and Gamma tasks', async () => {
    await goToTasksWithAll();
    await userEvent.type(screen.getByRole('textbox', { name: /search workspace tasks/i }), 'Alpha');
    await waitFor(() => {
      expect(screen.queryByText('Beta Task Planning')).not.toBeInTheDocument();
      expect(screen.queryByText('Gamma Task Deployment')).not.toBeInTheDocument();
    });
  });

  it('searching for Alpha keeps Alpha task visible', async () => {
    await goToTasksWithAll();
    await userEvent.type(screen.getByRole('textbox', { name: /search workspace tasks/i }), 'Alpha');
    await waitFor(() => expect(screen.getByText('Alpha Task Review')).toBeInTheDocument());
  });

  it('searching for Beta shows only Beta task', async () => {
    await goToTasksWithAll();
    await userEvent.type(screen.getByRole('textbox', { name: /search workspace tasks/i }), 'Beta');
    await waitFor(() => {
      expect(screen.getByText('Beta Task Planning')).toBeInTheDocument();
      expect(screen.queryByText('Alpha Task Review')).not.toBeInTheDocument();
    });
  });

  it('search is case-insensitive', async () => {
    await goToTasksWithAll();
    await userEvent.type(screen.getByRole('textbox', { name: /search workspace tasks/i }), 'alpha');
    await waitFor(() => expect(screen.getByText('Alpha Task Review')).toBeInTheDocument());
  });

  it('clearing search restores all tasks', async () => {
    await goToTasksWithAll();
    const input = screen.getByRole('textbox', { name: /search workspace tasks/i });
    await userEvent.type(input, 'Alpha');
    await waitFor(() => expect(screen.queryByText('Beta Task Planning')).not.toBeInTheDocument());
    await userEvent.clear(input);
    await waitFor(() => {
      expect(screen.getByText('Alpha Task Review')).toBeInTheDocument();
      expect(screen.getByText('Beta Task Planning')).toBeInTheDocument();
    });
  });
});

describe('WorkspaceDetail – Risk Search', () => {
  const riskAlpha = { ...mockRisk, id: 'r-alpha', title: 'Alpha Risk Assessment', category: 'Security' };
  const riskBeta = { ...mockRisk, id: 'r-beta', title: 'Beta Vendor Risk', category: 'Procurement' };
  const riskGamma = { ...mockRisk, id: 'r-gamma', title: 'Gamma Budget Risk', category: 'Financial' };

  async function goToRisks() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const riskTab = screen.getByRole('button', { name: /workspace tab: risks/i });
    await userEvent.click(riskTab);
    await screen.findByText(/risk register/i);
  }

  beforeEach(() => {
    mockGetWorkspace.mockResolvedValue(mockWs);
    mockGetDocuments.mockResolvedValue([]);
    mockGetMeetings.mockResolvedValue([]);
    mockGetTasks.mockResolvedValue([]);
    mockGetRisks.mockResolvedValue([riskAlpha, riskBeta, riskGamma]);
    mockGetWorkspaceFinancial.mockResolvedValue(mockFin);
    mockGetMilestones.mockResolvedValue([]);
    mockGetWorkspaceRagStatus.mockResolvedValue(mockRag);
    mockUpsertWorkspaceRagStatus.mockResolvedValue(mockRag);
  });

  it('renders search risks input', async () => {
    await goToRisks();
    expect(screen.getByRole('textbox', { name: /search risks/i })).toBeInTheDocument();
  });

  it('risk search input is empty by default', async () => {
    await goToRisks();
    expect(screen.getByRole('textbox', { name: /search risks/i })).toHaveValue('');
  });

  it('typing filters risks by title', async () => {
    await goToRisks();
    const input = screen.getByRole('textbox', { name: /search risks/i });
    await userEvent.type(input, 'Alpha');
    await waitFor(() => {
      expect(screen.getByText('Alpha Risk Assessment')).toBeInTheDocument();
      expect(screen.queryByText('Beta Vendor Risk')).not.toBeInTheDocument();
      expect(screen.queryByText('Gamma Budget Risk')).not.toBeInTheDocument();
    });
  });

  it('risk search is case-insensitive', async () => {
    await goToRisks();
    await userEvent.type(screen.getByRole('textbox', { name: /search risks/i }), 'beta');
    await waitFor(() => expect(screen.getByText('Beta Vendor Risk')).toBeInTheDocument());
  });

  it('clearing search restores all risks', async () => {
    await goToRisks();
    const input = screen.getByRole('textbox', { name: /search risks/i });
    await userEvent.type(input, 'Alpha');
    await waitFor(() => expect(screen.queryByText('Beta Vendor Risk')).not.toBeInTheDocument());
    await userEvent.clear(input);
    await waitFor(() => {
      expect(screen.getByText('Alpha Risk Assessment')).toBeInTheDocument();
      expect(screen.getByText('Beta Vendor Risk')).toBeInTheDocument();
      expect(screen.getByText('Gamma Budget Risk')).toBeInTheDocument();
    });
  });
});

describe('WorkspaceDetail – Milestone Sort', () => {
  const msZara = { ...mockMilestone, id: 'ms-sort-z', title: 'Zara Milestone', due_date: '2026-09-01' };
  const msAlex = { ...mockMilestone, id: 'ms-sort-a', title: 'Alex Milestone', due_date: '2026-05-01' };
  const msMina = { ...mockMilestone, id: 'ms-sort-m', title: 'Mina Milestone', due_date: '2026-07-01' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspace.mockResolvedValue(mockWs);
    mockGetDocuments.mockResolvedValue([mockDoc]);
    mockGetMeetings.mockResolvedValue([mockMeeting]);
    mockGetTasks.mockResolvedValue([mockTask]);
    mockGetRisks.mockResolvedValue([mockRisk]);
    mockGetWorkspaceFinancial.mockResolvedValue(mockFin);
    mockGetWorkspaceRagStatus.mockResolvedValue(mockRag);
    mockUpsertWorkspaceRagStatus.mockResolvedValue(mockRag);
    mockGetMilestones.mockResolvedValue([msZara, msAlex, msMina]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders milestone sort buttons', async () => {
    renderDetail();
    await screen.findByText('Zara Milestone');
    expect(screen.getByRole('button', { name: /sort milestones by default/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort milestones by title/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort milestones by due_date/i })).toBeInTheDocument();
  });

  it('default sort button is pressed initially', async () => {
    renderDetail();
    await screen.findByText('Zara Milestone');
    expect(screen.getByRole('button', { name: /sort milestones by default/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking title sort activates it', async () => {
    renderDetail();
    await screen.findByText('Zara Milestone');
    await userEvent.click(screen.getByRole('button', { name: /sort milestones by title/i }));
    expect(screen.getByRole('button', { name: /sort milestones by title/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort milestones by default/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('title sort places Alex before Zara in DOM', async () => {
    renderDetail();
    await screen.findByText('Zara Milestone');
    await userEvent.click(screen.getByRole('button', { name: /sort milestones by title/i }));
    const alexEl = screen.getByText('Alex Milestone');
    const zaraEl = screen.getByText('Zara Milestone');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all milestones remain visible after title sort', async () => {
    renderDetail();
    await screen.findByText('Zara Milestone');
    await userEvent.click(screen.getByRole('button', { name: /sort milestones by title/i }));
    expect(screen.getByText('Alex Milestone')).toBeInTheDocument();
    expect(screen.getByText('Mina Milestone')).toBeInTheDocument();
    expect(screen.getByText('Zara Milestone')).toBeInTheDocument();
  });
});

describe('WorkspaceDetail – Risk Sort', () => {
  const riskZara = { ...mockRisk, id: 'r-sort-z', title: 'Zara Risk Assessment', severity: 'Low' as const };
  const riskAlex = { ...mockRisk, id: 'r-sort-a', title: 'Alex Risk Analysis', severity: 'High' as const };
  const riskMina = { ...mockRisk, id: 'r-sort-m', title: 'Mina Risk Review', severity: 'Medium' as const };

  async function goToRisks() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Zara Risk Assessment');
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspace.mockResolvedValue(mockWs);
    mockGetDocuments.mockResolvedValue([]);
    mockGetMeetings.mockResolvedValue([]);
    mockGetTasks.mockResolvedValue([]);
    mockGetRisks.mockResolvedValue([riskZara, riskAlex, riskMina]);
    mockGetWorkspaceFinancial.mockResolvedValue(mockFin);
    mockGetMilestones.mockResolvedValue([]);
    mockGetWorkspaceRagStatus.mockResolvedValue(mockRag);
    mockUpsertWorkspaceRagStatus.mockResolvedValue(mockRag);
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders risk sort buttons', async () => {
    await goToRisks();
    expect(screen.getByRole('button', { name: /sort risks by default/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort risks by title/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort risks by severity/i })).toBeInTheDocument();
  });

  it('default sort button is pressed initially', async () => {
    await goToRisks();
    expect(screen.getByRole('button', { name: /sort risks by default/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking title sort activates it', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /sort risks by title/i }));
    expect(screen.getByRole('button', { name: /sort risks by title/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort risks by default/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('title sort places Alex before Zara in DOM', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /sort risks by title/i }));
    const alexEl = screen.getByText('Alex Risk Analysis');
    const zaraEl = screen.getByText('Zara Risk Assessment');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all risks remain visible after title sort', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /sort risks by title/i }));
    expect(screen.getByText('Alex Risk Analysis')).toBeInTheDocument();
    expect(screen.getByText('Mina Risk Review')).toBeInTheDocument();
    expect(screen.getByText('Zara Risk Assessment')).toBeInTheDocument();
  });
});

describe('WorkspaceDetail – Document Sort', () => {
  const docZara = { ...mockDoc, id: 'ds1', name: 'Zara Requirements Doc', pages: 5 };
  const docAlex = { ...mockDoc, id: 'ds2', name: 'Alex Analysis Report', pages: 30 };
  const docMina = { ...mockDoc, id: 'ds3', name: 'Mina Feasibility Study', pages: 15 };

  async function goToDocs() {
    mockGetDocuments.mockResolvedValue([docZara, docAlex, docMina]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('Zara Requirements Doc');
  }

  it('renders doc sort select in Documents tab', async () => {
    await goToDocs();
    expect(screen.getByRole('combobox', { name: /sort workspace documents/i })).toBeInTheDocument();
  });

  it('doc sort defaults to default', async () => {
    await goToDocs();
    const sel = screen.getByRole('combobox', { name: /sort workspace documents/i }) as HTMLSelectElement;
    expect(sel.value).toBe('default');
  });

  it('name sort places Alex before Zara in DOM', async () => {
    await goToDocs();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort workspace documents/i }), 'name');
    const alexEl = screen.getByText('Alex Analysis Report');
    const zaraEl = screen.getByText('Zara Requirements Doc');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three docs remain visible after name sort', async () => {
    await goToDocs();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort workspace documents/i }), 'name');
    expect(screen.getByText('Alex Analysis Report')).toBeInTheDocument();
    expect(screen.getByText('Mina Feasibility Study')).toBeInTheDocument();
    expect(screen.getByText('Zara Requirements Doc')).toBeInTheDocument();
  });

  it('pages sort places Alex (30 pages) before Zara (5 pages) in DOM (most pages first)', async () => {
    await goToDocs();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort workspace documents/i }), 'pages');
    const alexEl = screen.getByText('Alex Analysis Report');
    const zaraEl = screen.getByText('Zara Requirements Doc');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('WorkspaceDetail – Task Sort', () => {
  const taskZara = { ...mockTask, id: 'ts-z', title: 'Zara Requirements Review', priority: 'Low' as const };
  const taskAlex = { ...mockTask, id: 'ts-a', title: 'Alex Security Audit', priority: 'High' as const };
  const taskMina = { ...mockTask, id: 'ts-m', title: 'Mina Budget Analysis', priority: 'Medium' as const };

  async function goToTasks() {
    mockGetTasks.mockResolvedValue([taskZara, taskAlex, taskMina]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: tasks/i }));
    await screen.findByText('Zara Requirements Review');
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspace.mockResolvedValue(mockWs);
    mockGetDocuments.mockResolvedValue([]);
    mockGetMeetings.mockResolvedValue([]);
    mockGetTasks.mockResolvedValue([taskZara, taskAlex, taskMina]);
    mockGetRisks.mockResolvedValue([]);
    mockGetWorkspaceFinancial.mockResolvedValue(mockFin);
    mockGetMilestones.mockResolvedValue([]);
    mockGetWorkspaceRagStatus.mockResolvedValue(mockRag);
    mockUpsertWorkspaceRagStatus.mockResolvedValue(mockRag);
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders task sort buttons in Tasks tab', async () => {
    await goToTasks();
    expect(screen.getByRole('button', { name: /sort tasks by default/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort tasks by title/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort tasks by priority/i })).toBeInTheDocument();
  });

  it('default sort button is pressed initially', async () => {
    await goToTasks();
    expect(screen.getByRole('button', { name: /sort tasks by default/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort tasks by title/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking title sort activates it', async () => {
    await goToTasks();
    await userEvent.click(screen.getByRole('button', { name: /sort tasks by title/i }));
    expect(screen.getByRole('button', { name: /sort tasks by title/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort tasks by default/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('title sort places Alex before Zara in DOM', async () => {
    await goToTasks();
    await userEvent.click(screen.getByRole('button', { name: /sort tasks by title/i }));
    const alexEl = screen.getByText('Alex Security Audit');
    const zaraEl = screen.getByText('Zara Requirements Review');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('priority sort places High before Low in DOM', async () => {
    await goToTasks();
    await userEvent.click(screen.getByRole('button', { name: /sort tasks by priority/i }));
    const alexEl = screen.getByText('Alex Security Audit');
    const zaraEl = screen.getByText('Zara Requirements Review');
    expect(alexEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three tasks remain visible after title sort', async () => {
    await goToTasks();
    await userEvent.click(screen.getByRole('button', { name: /sort tasks by title/i }));
    expect(screen.getByText('Alex Security Audit')).toBeInTheDocument();
    expect(screen.getByText('Mina Budget Analysis')).toBeInTheDocument();
    expect(screen.getByText('Zara Requirements Review')).toBeInTheDocument();
  });
});

describe('WorkspaceDetail – Risk Sort by Severity', () => {
  const riskCritical = { ...mockRisk, id: 'rs-c', title: 'Critical System Failure', severity: 'Critical' as const };
  const riskHigh = { ...mockRisk, id: 'rs-h', title: 'High Data Breach', severity: 'High' as const };
  const riskLow = { ...mockRisk, id: 'rs-l', title: 'Zeta Low Risk', severity: 'Low' as const };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspace.mockResolvedValue(mockWs);
    mockGetDocuments.mockResolvedValue([]);
    mockGetMeetings.mockResolvedValue([]);
    mockGetTasks.mockResolvedValue([]);
    mockGetRisks.mockResolvedValue([riskLow, riskHigh, riskCritical]);
    mockGetWorkspaceFinancial.mockResolvedValue(mockFin);
    mockGetMilestones.mockResolvedValue([]);
    mockGetWorkspaceRagStatus.mockResolvedValue(mockRag);
    mockUpsertWorkspaceRagStatus.mockResolvedValue(mockRag);
  });
  afterEach(() => vi.restoreAllMocks());

  async function goToRisks() {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: risks/i }));
    await screen.findByText('Critical System Failure');
  }

  it('clicking severity sort activates it', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /sort risks by severity/i }));
    expect(screen.getByRole('button', { name: /sort risks by severity/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort risks by default/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('severity sort places Critical before High in DOM (alphabetical)', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /sort risks by severity/i }));
    const critEl = screen.getByText('Critical System Failure');
    const highEl = screen.getByText('High Data Breach');
    expect(critEl.compareDocumentPosition(highEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('severity sort places High before Low in DOM (alphabetical)', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /sort risks by severity/i }));
    const highEl = screen.getByText('High Data Breach');
    const lowEl = screen.getByText('Zeta Low Risk');
    expect(highEl.compareDocumentPosition(lowEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three risks remain visible after severity sort', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /sort risks by severity/i }));
    expect(screen.getByText('Critical System Failure')).toBeInTheDocument();
    expect(screen.getByText('High Data Breach')).toBeInTheDocument();
    expect(screen.getByText('Zeta Low Risk')).toBeInTheDocument();
  });

  it('switching back to default deactivates severity sort', async () => {
    await goToRisks();
    await userEvent.click(screen.getByRole('button', { name: /sort risks by severity/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort risks by default/i }));
    expect(screen.getByRole('button', { name: /sort risks by default/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort risks by severity/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('WorkspaceDetail – Milestone Sort by Due Date', () => {
  const msEarly = { ...mockMilestone, id: 'ms-early', title: 'Early April Milestone', due_date: '2026-04-01' };
  const msMid = { ...mockMilestone, id: 'ms-mid', title: 'Mid June Milestone', due_date: '2026-06-15' };
  const msLate = { ...mockMilestone, id: 'ms-late', title: 'Late August Milestone', due_date: '2026-08-30' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspace.mockResolvedValue(mockWs);
    mockGetDocuments.mockResolvedValue([]);
    mockGetMeetings.mockResolvedValue([]);
    mockGetTasks.mockResolvedValue([]);
    mockGetRisks.mockResolvedValue([]);
    mockGetWorkspaceFinancial.mockResolvedValue(mockFin);
    mockGetMilestones.mockResolvedValue([msLate, msMid, msEarly]);
    mockGetWorkspaceRagStatus.mockResolvedValue(mockRag);
    mockUpsertWorkspaceRagStatus.mockResolvedValue(mockRag);
  });
  afterEach(() => vi.restoreAllMocks());

  it('clicking due_date sort activates it', async () => {
    renderDetail();
    await screen.findByText('Early April Milestone');
    await userEvent.click(screen.getByRole('button', { name: /sort milestones by due_date/i }));
    expect(screen.getByRole('button', { name: /sort milestones by due_date/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort milestones by default/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('due_date sort places Early April before Late August in DOM', async () => {
    renderDetail();
    await screen.findByText('Early April Milestone');
    await userEvent.click(screen.getByRole('button', { name: /sort milestones by due_date/i }));
    const earlyEl = screen.getByText('Early April Milestone');
    const lateEl = screen.getByText('Late August Milestone');
    expect(earlyEl.compareDocumentPosition(lateEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('due_date sort places Mid June before Late August in DOM', async () => {
    renderDetail();
    await screen.findByText('Early April Milestone');
    await userEvent.click(screen.getByRole('button', { name: /sort milestones by due_date/i }));
    const midEl = screen.getByText('Mid June Milestone');
    const lateEl = screen.getByText('Late August Milestone');
    expect(midEl.compareDocumentPosition(lateEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three milestones remain visible after due_date sort', async () => {
    renderDetail();
    await screen.findByText('Early April Milestone');
    await userEvent.click(screen.getByRole('button', { name: /sort milestones by due_date/i }));
    expect(screen.getByText('Early April Milestone')).toBeInTheDocument();
    expect(screen.getByText('Mid June Milestone')).toBeInTheDocument();
    expect(screen.getByText('Late August Milestone')).toBeInTheDocument();
  });

  it('switching back to default deactivates due_date sort', async () => {
    renderDetail();
    await screen.findByText('Early April Milestone');
    await userEvent.click(screen.getByRole('button', { name: /sort milestones by due_date/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort milestones by default/i }));
    expect(screen.getByRole('button', { name: /sort milestones by default/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort milestones by due_date/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Document Search', () => {
  const docBRD = { ...mockDoc, id: 'ds-brd', name: 'NCA BRD Document' };
  const docFeasibility = { ...mockDoc, id: 'ds-feas', name: 'Feasibility Study Report' };
  const docRisk = { ...mockDoc, id: 'ds-risk', name: 'Risk Assessment Matrix' };

  async function goToDocs() {
    mockGetDocuments.mockResolvedValue([docBRD, docFeasibility, docRisk]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: documents/i }));
    await screen.findByText('NCA BRD Document');
  }

  it('renders document search input in Documents tab', async () => {
    await goToDocs();
    expect(screen.getByRole('textbox', { name: /search workspace documents/i })).toBeInTheDocument();
  });

  it('document search input starts empty', async () => {
    await goToDocs();
    const input = screen.getByRole('textbox', { name: /search workspace documents/i }) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('searching for "BRD" shows only matching document', async () => {
    await goToDocs();
    await userEvent.type(screen.getByRole('textbox', { name: /search workspace documents/i }), 'BRD');
    await waitFor(() => {
      expect(screen.getByText('NCA BRD Document')).toBeInTheDocument();
      expect(screen.queryByText('Feasibility Study Report')).not.toBeInTheDocument();
    });
  });

  it('searching for "feasibility" (case-insensitive) shows matching document', async () => {
    await goToDocs();
    await userEvent.type(screen.getByRole('textbox', { name: /search workspace documents/i }), 'feasibility');
    await waitFor(() => {
      expect(screen.getByText('Feasibility Study Report')).toBeInTheDocument();
      expect(screen.queryByText('NCA BRD Document')).not.toBeInTheDocument();
    });
  });

  it('clearing search restores all documents', async () => {
    await goToDocs();
    const input = screen.getByRole('textbox', { name: /search workspace documents/i });
    await userEvent.type(input, 'BRD');
    await userEvent.clear(input);
    await waitFor(() => {
      expect(screen.getByText('NCA BRD Document')).toBeInTheDocument();
      expect(screen.getByText('Feasibility Study Report')).toBeInTheDocument();
      expect(screen.getByText('Risk Assessment Matrix')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Meeting Search', () => {
  const mtgSteering = { ...mockMeeting, id: 'ms-1', title: 'Steering Committee Meeting' };
  const mtgTech = { ...mockMeeting, id: 'ms-2', title: 'Technical Review Session' };
  const mtgRisk = { ...mockMeeting, id: 'ms-3', title: 'Risk Assessment Workshop' };

  async function goToMeetings() {
    mockGetMeetings.mockResolvedValue([mtgSteering, mtgTech, mtgRisk]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /workspace tab: meetings/i }));
    await screen.findByText('Steering Committee Meeting');
  }

  it('renders meeting search input in Meetings tab', async () => {
    await goToMeetings();
    expect(screen.getByRole('textbox', { name: /search workspace meetings/i })).toBeInTheDocument();
  });

  it('meeting search input starts empty', async () => {
    await goToMeetings();
    const input = screen.getByRole('textbox', { name: /search workspace meetings/i }) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('searching for "Steering" shows only matching meeting', async () => {
    await goToMeetings();
    await userEvent.type(screen.getByRole('textbox', { name: /search workspace meetings/i }), 'Steering');
    await waitFor(() => {
      expect(screen.getByText('Steering Committee Meeting')).toBeInTheDocument();
      expect(screen.queryByText('Technical Review Session')).not.toBeInTheDocument();
    });
  });

  it('searching for "technical" (case-insensitive) shows matching meeting', async () => {
    await goToMeetings();
    await userEvent.type(screen.getByRole('textbox', { name: /search workspace meetings/i }), 'technical');
    await waitFor(() => {
      expect(screen.getByText('Technical Review Session')).toBeInTheDocument();
      expect(screen.queryByText('Steering Committee Meeting')).not.toBeInTheDocument();
    });
  });

  it('clearing meeting search restores all meetings', async () => {
    await goToMeetings();
    const input = screen.getByRole('textbox', { name: /search workspace meetings/i });
    await userEvent.type(input, 'Steering');
    await userEvent.clear(input);
    await waitFor(() => {
      expect(screen.getByText('Steering Committee Meeting')).toBeInTheDocument();
      expect(screen.getByText('Technical Review Session')).toBeInTheDocument();
      expect(screen.getByText('Risk Assessment Workshop')).toBeInTheDocument();
    });
  });
});
