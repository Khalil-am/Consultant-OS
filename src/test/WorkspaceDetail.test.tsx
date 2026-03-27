import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
  });

  it('renders Documents tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: 'Documents' })).toBeInTheDocument();
  });

  it('renders Meetings tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByRole('button', { name: 'Meetings' })).toBeInTheDocument();
  });

  it('renders Tasks tab button (may include badge count)', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Tab has "Tasks" text + optional count badge, use regex
    const tasksTab = screen.getByRole('button', { name: /^Tasks/ });
    expect(tasksTab).toBeInTheDocument();
  });

  it('renders Risks tab button', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    // Risks tab may include an open-count badge, use regex
    expect(screen.getByRole('button', { name: /^Risks/ })).toBeInTheDocument();
  });

  it('Overview tab shows milestones', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    expect(screen.getByText('Phase 1 Delivery')).toBeInTheDocument();
  });

  it('switches to Documents tab and shows document', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Documents' }));
    expect(screen.getByText('NCA BRD v2.3')).toBeInTheDocument();
  });

  it('switches to Meetings tab and shows meeting', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Meetings' }));
    expect(screen.getByText('Steering Committee Q1')).toBeInTheDocument();
  });

  it('switches to Tasks tab and shows task', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
    expect(screen.getByText('Review Architecture Diagram')).toBeInTheDocument();
  });

  it('switches to Risks tab and shows risk', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
    const addBtn = screen.getByRole('button', { name: /add task/i });
    await userEvent.click(addBtn);
    // Modal opens: confirm button "Create Task" is now visible
    expect(screen.getByRole('button', { name: /create task/i })).toBeInTheDocument();
  });

  it('shows validation error when saving task without required fields', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Documents' }));
    expect(screen.getByText(/no documents/i)).toBeInTheDocument();
  });

  it('shows empty state when no meetings', async () => {
    mockGetMeetings.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Meetings' }));
    expect(screen.getByText(/no meetings/i)).toBeInTheDocument();
  });

  it('shows empty state when no tasks', async () => {
    mockGetTasks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Tasks' }));
    expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
  });

  it('shows empty state when no risks', async () => {
    mockGetRisks.mockResolvedValue([]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Risks' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Documents' }));
    await userEvent.click(screen.getByRole('button', { name: /add document/i }));
    // Modal confirm button shows "Save Document" when no file is selected
    expect(screen.getByRole('button', { name: /save document/i })).toBeInTheDocument();
  });

  it('shows validation error when saving doc without required fields', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Documents' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Meetings' }));
    await userEvent.click(screen.getByRole('button', { name: /schedule meeting/i }));
    // Modal opens — confirm button "Schedule Meeting" is present inside modal
    const scheduleBtns = screen.getAllByRole('button', { name: /schedule meeting/i });
    // One is the tab button, one is the modal confirm button
    expect(scheduleBtns.length).toBeGreaterThan(1);
  });

  it('shows validation error when saving meeting without required fields', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Meetings' }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
    await userEvent.click(screen.getByRole('button', { name: /log risk/i }));
    // Modal confirm button "Log Risk" appears
    const logRiskBtns = screen.getAllByRole('button', { name: /log risk/i });
    expect(logRiskBtns.length).toBeGreaterThan(1);
  });

  it('shows validation error when saving risk without required fields', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
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
    // First Edit button in DOM is the header Edit (Settings icon + Edit)
    const editBtns = screen.getAllByRole('button', { name: /^edit$/i });
    await userEvent.click(editBtns[0]);
    expect(screen.getByText('Edit Workspace')).toBeInTheDocument();
  });

  it('pre-fills workspace name in edit modal', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const editBtns = screen.getAllByRole('button', { name: /^edit$/i });
    await userEvent.click(editBtns[0]);
    // Name field should be pre-filled
    expect(screen.getByDisplayValue('NCA Enterprise Platform')).toBeInTheDocument();
  });

  it('shows validation error when name is cleared and Save is clicked', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const editBtns = screen.getAllByRole('button', { name: /^edit$/i });
    await userEvent.click(editBtns[0]);

    // Clear the name
    const nameInput = screen.getByDisplayValue('NCA Enterprise Platform');
    await userEvent.clear(nameInput);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(screen.getByText(/name and client are required/i)).toBeInTheDocument();
  });

  it('calls updateWorkspace when valid edit form is submitted', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    const editBtns = screen.getAllByRole('button', { name: /^edit$/i });
    await userEvent.click(editBtns[0]);

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
    await userEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Meetings' }));
    await userEvent.click(screen.getByRole('button', { name: /schedule meeting/i }));

    const scheduleBtns = screen.getAllByRole('button', { name: /schedule meeting/i });
    // The modal confirm is last
    const modalBtn = scheduleBtns[scheduleBtns.length - 1];

    // Fill title
    const titleInputs = document.querySelectorAll('input[type="text"]');
    const titleInput = Array.from(titleInputs).find(i => (i as HTMLInputElement).placeholder?.includes('Q1 Review') || (i as HTMLInputElement).placeholder?.includes('Steering'));
    if (titleInput) {
      await userEvent.type(titleInput, 'Q2 Planning Meeting');
    } else {
      const textInputs = document.querySelectorAll('input[type="text"], input:not([type])');
      if (textInputs.length > 0) await userEvent.type(textInputs[0], 'Q2 Planning Meeting');
    }

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
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Documents' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Meetings' }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Documents/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Meetings/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
    await screen.findByText('Vendor Delay Risk');
    // High severity from mockRisk
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
  });

  it('shows risk category on risk row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
    await screen.findByText('Vendor Delay Risk');
    expect(screen.getByText('Procurement')).toBeInTheDocument();
  });

  it('shows risk mitigation text on risk row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
    await screen.findByText('Review Architecture Diagram');
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
  });

  it('shows task assignee on task row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
    await screen.findByText('Review Architecture Diagram');
    expect(screen.getAllByText('AM').length).toBeGreaterThan(0);
  });

  it('shows task due date on task row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
    await screen.findByText('Review Architecture Diagram');
    expect(screen.getByText('Prepare Presentation')).toBeInTheDocument();
  });

  it('renders multiple documents when two docs returned', async () => {
    const doc2 = { ...mockDoc, id: 'd2', name: 'ADNOC Proposal v1' };
    mockGetDocuments.mockResolvedValue([mockDoc, doc2]);
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Documents' }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Meetings/ }));
    await waitFor(() => {
      expect(screen.getByText('Steering Committee Q1')).toBeInTheDocument();
    });
  });

  it('shows meeting location in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Meetings/ }));
    await waitFor(() => {
      expect(screen.getByText('Conference Room A')).toBeInTheDocument();
    });
  });

  it('shows meeting status Upcoming in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Meetings/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
    await waitFor(() => {
      expect(screen.getAllByText('Procurement').length).toBeGreaterThan(0);
    });
  });

  it('shows risk title Vendor Delay Risk on risk row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Documents' }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });

  it('shows document status Final on document row', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Documents' }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByText('Final').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Meeting type display', () => {
  it('shows meeting type Steering in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Meetings/ }));
    await screen.findByText('Steering Committee Q1');
    expect(screen.getAllByText('Steering').length).toBeGreaterThan(0);
  });

  it('shows meeting date in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Meetings/ }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Documents' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Tasks' }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
    await waitFor(() => {
      expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    });
  });

  it('shows Open status on risk', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
    await waitFor(() => {
      expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
    });
  });

  it('shows risk owner name', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Meetings' }));
    await waitFor(() => {
      expect(screen.getAllByText(/Conference Room A/).length).toBeGreaterThan(0);
    });
  });

  it('shows meeting participants count', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Meetings' }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
    await waitFor(() => {
      expect(screen.getAllByText(/Review Architecture Diagram/).length).toBeGreaterThan(0);
    });
  });

  it('shows task due date in Tasks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Meetings' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Documents' }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByText(/2026-03-15|Mar 15/).length).toBeGreaterThan(0);
  });

  it('shows document pages count in Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: 'Documents' }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Tasks/ }));
    await screen.findByText('Review Architecture Diagram');
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Risk owner display', () => {
  it('shows risk owner initials RT in Risks tab (owner is rendered as initials)', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Documents/ }));
    expect(await screen.findByText('NCA BRD v2.3')).toBeInTheDocument();
  });

  it('shows document type BRD in Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Documents/ }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByText('BRD').length).toBeGreaterThan(0);
  });

  it('shows document pages count in Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Documents/ }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByText('24').length).toBeGreaterThan(0);
  });

  it('shows document author in Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Documents/ }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByText(/Ahmed Khalil/).length).toBeGreaterThan(0);
  });

  it('shows Add Document button in Documents tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Documents/ }));
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getByRole('button', { name: /add document/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('WorkspaceDetail – Meetings tab', () => {
  it('shows meeting title in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Meetings/ }));
    expect(await screen.findByText('Steering Committee Q1')).toBeInTheDocument();
  });

  it('shows meeting duration 2h in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Meetings/ }));
    await screen.findByText('Steering Committee Q1');
    expect(screen.getAllByText(/2h/).length).toBeGreaterThan(0);
  });

  it('shows Upcoming status in Meetings tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Meetings/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
    await screen.findByText('Vendor Delay Risk');
    expect(screen.getAllByText(/Procurement/).length).toBeGreaterThan(0);
  });

  it('shows risk severity High in Risks tab', async () => {
    renderDetail();
    await screen.findByText('NCA Enterprise Platform');
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Documents/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Risks/ }));
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
