import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ── Hoisted mocks ────────────────────────────────────────────
const { mockGetActivities, mockGetMilestones, mockGetWorkspaceFinancials, mockGetBoardDecisions, mockGetRagStatusWithWorkspaces, mockGetApprovals, mockUpdateApproval, mockUpsertApproval } = vi.hoisted(() => ({
  mockGetActivities: vi.fn(),
  mockGetMilestones: vi.fn(),
  mockGetWorkspaceFinancials: vi.fn(),
  mockGetBoardDecisions: vi.fn(),
  mockGetRagStatusWithWorkspaces: vi.fn(),
  mockGetApprovals: vi.fn(),
  mockUpdateApproval: vi.fn(),
  mockUpsertApproval: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getActivities: mockGetActivities,
  getMilestones: mockGetMilestones,
  getWorkspaceFinancials: mockGetWorkspaceFinancials,
  getBoardDecisions: mockGetBoardDecisions,
  getRagStatusWithWorkspaces: mockGetRagStatusWithWorkspaces,
  getApprovals: mockGetApprovals,
  updateApproval: mockUpdateApproval,
  upsertApproval: mockUpsertApproval,
}));

vi.mock('../hooks/useLayout', () => ({
  useLayout: () => ({ width: 1280, isMobile: false, isTablet: false }),
}));

vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
}));


import Dashboard from '../screens/Dashboard';

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

const mockActivity = {
  id: 'a1', action: 'Report generated', target: '', project: 'MOCI', workspace: 'MOCI',
  user: 'Ahmed Khalil', time: '2h ago', timestamp: '2h ago', type: 'automation',
};

const mockMilestone = {
  id: 'ms-1', title: 'Phase 1 Delivery', status: 'On Track', due_date: '2026-04-01',
  workspace_id: 'ws-1', owner: 'AM', description: null, progress: 60,
  created_at: '', updated_at: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockGetActivities.mockResolvedValue([]);
  mockGetMilestones.mockResolvedValue([]);
  mockGetWorkspaceFinancials.mockResolvedValue([]);
  mockGetBoardDecisions.mockResolvedValue([]);
  mockGetRagStatusWithWorkspaces.mockResolvedValue([]);
  mockGetApprovals.mockResolvedValue([]);
  mockUpdateApproval.mockResolvedValue({});
  mockUpsertApproval.mockResolvedValue({});
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – Render', () => {
  it('renders the dashboard hero banner', async () => {
    renderDashboard();
    expect(await screen.findByText(/live · board overview/i)).toBeInTheDocument();
  });

  it('renders KPI cards from live data', async () => {
    renderDashboard();
    expect(await screen.findByText('Total Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Revenue Recognized')).toBeInTheDocument();
  });

  it('renders quick actions section', async () => {
    renderDashboard();
    await screen.findByText(/live · board overview/i);
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Upload Doc')).toBeInTheDocument();
    expect(screen.getByText('Run Automation')).toBeInTheDocument();
    expect(screen.getByText('New Meeting')).toBeInTheDocument();
    expect(screen.getByText('Create Report')).toBeInTheDocument();
  });

  it('loads activities from supabase on mount', async () => {
    renderDashboard();
    await waitFor(() => expect(mockGetActivities).toHaveBeenCalledWith(30));
  });

  it('loads milestones from supabase on mount', async () => {
    renderDashboard();
    await waitFor(() => expect(mockGetMilestones).toHaveBeenCalledTimes(1));
  });

  it('loads workspace financials on mount', async () => {
    renderDashboard();
    await waitFor(() => expect(mockGetWorkspaceFinancials).toHaveBeenCalledTimes(1));
  });
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – Approvals', () => {
  it('renders Pending Approvals section', async () => {
    renderDashboard();
    await screen.findByText(/live · board overview/i);
    expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
  });

  it('renders specific approval items', async () => {
    renderDashboard();
    expect(await screen.findByText('NCA BRD v2.3')).toBeInTheDocument();
    expect(screen.getByText('SC-10 Budget SAR 2.4M')).toBeInTheDocument();
  });

  it('shows Approve and Reject buttons for pending approvals', async () => {
    renderDashboard();
    await screen.findByText('NCA BRD v2.3');
    expect(screen.getAllByRole('button', { name: /approve/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /reject/i }).length).toBeGreaterThan(0);
  });

  it('approves an item and shows "approved" status badge', async () => {
    renderDashboard();
    await screen.findByText('NCA BRD v2.3');
    const approveButtons = screen.getAllByRole('button', { name: /approve/i });
    fireEvent.click(approveButtons[0]);
    await waitFor(() => {
      // The status badge changes from urgency to item.status = "approved"
      expect(screen.getAllByText('approved').length).toBeGreaterThan(0);
    });
  });

  it('rejects an item and shows "rejected" status badge', async () => {
    renderDashboard();
    await screen.findByText('NCA BRD v2.3');
    const rejectButtons = screen.getAllByRole('button', { name: /reject/i });
    fireEvent.click(rejectButtons[0]);
    await waitFor(() => {
      expect(screen.getAllByText('rejected').length).toBeGreaterThan(0);
    });
  });

  it('removes Approve/Reject buttons after action', async () => {
    renderDashboard();
    await screen.findByText('NCA BRD v2.3');
    const before = screen.getAllByRole('button', { name: /approve/i }).length;
    fireEvent.click(screen.getAllByRole('button', { name: /approve/i })[0]);
    await waitFor(() => {
      expect(screen.queryAllByRole('button', { name: /approve/i }).length).toBeLessThan(before);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – Activity feed', () => {
  it('shows Activity Feed section header', async () => {
    renderDashboard();
    await screen.findByText(/live · board overview/i);
    expect(screen.getByText('Activity Feed')).toBeInTheDocument();
  });

  it('shows activity items when data loaded', async () => {
    mockGetActivities.mockResolvedValueOnce([mockActivity]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Report generated/i)).toBeInTheDocument();
    });
  });

  it('shows activity type filter buttons', async () => {
    renderDashboard();
    await screen.findByText('Activity Feed');
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Document' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Meeting' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Automation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Task' })).toBeInTheDocument();
  });

  it('filters activities by Document type', async () => {
    const docActivity = { ...mockActivity, id: 'a2', action: 'Document uploaded', type: 'document' };
    const mtgActivity = { ...mockActivity, id: 'a3', action: 'Meeting scheduled', type: 'meeting' };
    mockGetActivities.mockResolvedValueOnce([mockActivity, docActivity, mtgActivity]);
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/Report generated/i)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Document' }));
    expect(screen.getByText(/Document uploaded/i)).toBeInTheDocument();
    expect(screen.queryByText(/Report generated/i)).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – Milestones', () => {
  it('shows Milestones section header', async () => {
    renderDashboard();
    await screen.findByText(/live · board overview/i);
    expect(screen.getByText('Milestones')).toBeInTheDocument();
  });

  it('renders milestones from supabase', async () => {
    mockGetMilestones.mockResolvedValueOnce([mockMilestone]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Phase 1 Delivery')).toBeInTheDocument();
    });
  });

  it('does not render Phase 1 Delivery when milestones is empty', async () => {
    renderDashboard();
    await waitFor(() => expect(mockGetMilestones).toHaveBeenCalled());
    expect(screen.queryByText('Phase 1 Delivery')).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – Board Decisions', () => {
  it('renders Board Decisions section', async () => {
    renderDashboard();
    await screen.findByText(/live · board overview/i);
    expect(screen.getByText('Board Decisions')).toBeInTheDocument();
  });

  it('shows a pending decision from Supabase', async () => {
    mockGetBoardDecisions.mockResolvedValue([
      { id: 'bd-1', title: 'Approve vendor shortlist', committee: 'Procurement', date: '2026-03-20', due_date: '2026-03-25', status: 'In Progress', owner: 'AM', workspace_id: 'ws-1', priority: 'High', created_at: '', updated_at: '' },
    ]);
    renderDashboard();
    expect(await screen.findByText('Approve vendor shortlist')).toBeInTheDocument();
  });

  it('removes decision on Done button click', async () => {
    mockGetBoardDecisions.mockResolvedValue([
      { id: 'bd-1', title: 'Approve vendor shortlist', committee: 'Procurement', date: '2026-03-20', due_date: '2026-03-25', status: 'In Progress', owner: 'AM', workspace_id: 'ws-1', priority: 'High', created_at: '', updated_at: '' },
    ]);
    renderDashboard();
    await screen.findByText('Approve vendor shortlist');
    // The Done button in board decisions
    const doneBtn = screen.getByRole('button', { name: /done/i });
    await userEvent.click(doneBtn);
    await waitFor(() => {
      expect(screen.queryByText('Approve vendor shortlist')).not.toBeInTheDocument();
    });
  });

  it('shows "All Clear" when all decisions complete', async () => {
    renderDashboard();
    await screen.findByText('Approve vendor shortlist');
    await userEvent.click(screen.getByRole('button', { name: /done/i }));
    await waitFor(() => {
      expect(screen.getByText('All Clear')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – AI Recommendations', () => {
  it('shows AI Recommendations section', async () => {
    renderDashboard();
    await screen.findByText(/live · board overview/i);
    expect(screen.getByText('AI Recommendations')).toBeInTheDocument();
  });

  it('renders initial recommendation items', async () => {
    renderDashboard();
    expect(await screen.findByText(/generate sc-10 committee pack/i)).toBeInTheDocument();
    expect(screen.getByText(/review 3 critical risks/i)).toBeInTheDocument();
  });

  it('shows active count badge', async () => {
    renderDashboard();
    await screen.findByText(/live · board overview/i);
    expect(screen.getByText(/3 active/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – Refresh button', () => {
  it('shows Refresh text on desktop', async () => {
    renderDashboard();
    await screen.findByText(/live · board overview/i);
    // On desktop (isMobile=false), shows "Refresh" text
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('clicking Refresh does not crash the app', async () => {
    renderDashboard();
    await screen.findByText('Refresh');
    await userEvent.click(screen.getByText('Refresh'));
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – Period selector', () => {
  it('shows Today, Week, Month period tabs', async () => {
    renderDashboard();
    await screen.findByText(/live · board overview/i);
    // Period tabs render as "Today", "Week", "Month"
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument();
  });

  it('switches period on click without crashing', async () => {
    renderDashboard();
    await screen.findByText(/live · board overview/i);
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – Client Health Matrix', () => {
  it('shows Client Health Matrix section', async () => {
    renderDashboard();
    await screen.findByText(/live · board overview/i);
    expect(screen.getByText('Client Health Matrix')).toBeInTheDocument();
  });

  it('shows workspace items from ragStatusData', async () => {
    renderDashboard();
    await screen.findByText(/live · board overview/i);
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MOCI').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – Overdue alert banner', () => {
  it('shows overdue tasks alert', async () => {
    renderDashboard();
    await screen.findByText(/live · board overview/i);
    expect(screen.getByText(/12 overdue tasks/i)).toBeInTheDocument();
  });

  it('shows Review Tasks button', async () => {
    renderDashboard();
    await screen.findByText(/live · board overview/i);
    expect(screen.getByRole('button', { name: /review tasks/i })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – Approval localStorage persistence', () => {
  it('saves approved status to localStorage', async () => {
    renderDashboard();
    await screen.findByText('NCA BRD v2.3');
    const approveButtons = screen.getAllByRole('button', { name: /approve/i });
    fireEvent.click(approveButtons[0]);
    await waitFor(() => {
      const stored = localStorage.getItem('dashboard_approvals');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      const approved = parsed.find((a: { id: number }) => a.id === 1);
      expect(approved?.status).toBe('approved');
    });
  });

  it('saves rejected status to localStorage', async () => {
    renderDashboard();
    await screen.findByText('NCA BRD v2.3');
    const rejectButtons = screen.getAllByRole('button', { name: /reject/i });
    fireEvent.click(rejectButtons[0]);
    await waitFor(() => {
      const stored = localStorage.getItem('dashboard_approvals');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      const rejected = parsed.find((a: { id: number }) => a.id === 1);
      expect(rejected?.status).toBe('rejected');
    });
  });

  it('restores approval state from localStorage on mount', async () => {
    const savedApprovals = [
      { id: 1, title: 'NCA BRD v2.3', requester: 'AM', type: 'Document Approval', urgency: 'High', status: 'approved' },
      { id: 2, title: 'SC-10 Budget SAR 2.4M', requester: 'RT', type: 'Budget Approval', urgency: 'High', status: 'pending' },
      { id: 3, title: 'MOCI Vendor Shortlist', requester: 'FH', type: 'Procurement Decision', urgency: 'Medium', status: 'pending' },
      { id: 4, title: 'Healthcare Strategy Report', requester: 'SK', type: 'Report Sign-off', urgency: 'Low', status: 'pending' },
    ];
    localStorage.setItem('dashboard_approvals', JSON.stringify(savedApprovals));
    renderDashboard();
    await screen.findByText('NCA BRD v2.3');
    await waitFor(() => {
      expect(screen.getByText('approved')).toBeInTheDocument();
    });
  });
});
