import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ── Hoisted mocks ────────────────────────────────────────────
const { mockGetActivities, mockGetMilestones, mockGetWorkspaceFinancials } = vi.hoisted(() => ({
  mockGetActivities: vi.fn(),
  mockGetMilestones: vi.fn(),
  mockGetWorkspaceFinancials: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getActivities: mockGetActivities,
  getMilestones: mockGetMilestones,
  getWorkspaceFinancials: mockGetWorkspaceFinancials,
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

vi.mock('../data/mockData', () => ({
  automationRunsData: [],
  documentsByTypeData: [],
  portfolioKPIs: [
    { id: 'kpi-1', label: 'Active Engagements', value: '8', unit: '', trend: '+1', trendDir: 'up', trendUp: true, icon: 'briefcase', color: '#0EA5E9', subValue: '2 new this month' },
    { id: 'kpi-2', label: 'Pipeline Revenue', value: 'SAR 32M', unit: '', trend: '+6%', trendDir: 'up', trendUp: true, icon: 'revenue', color: '#10B981', subValue: 'YTD recognized' },
  ],
  ragStatusData: [
    { workspace: 'NCA', rag: 'Green', lastUpdated: '2026-03-15' },
    { workspace: 'MOCI', rag: 'Amber', lastUpdated: '2026-03-14' },
  ],
  deliveryTrendData: [],
  boardDecisions: [
    { id: 'bd-1', project: 'MOCI', title: 'Approve vendor shortlist', dueDate: '2026-03-20', priority: 'High', status: 'Open' },
  ],
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
  mockGetActivities.mockResolvedValue([]);
  mockGetMilestones.mockResolvedValue([]);
  mockGetWorkspaceFinancials.mockResolvedValue([]);
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – Render', () => {
  it('renders the dashboard hero banner', async () => {
    renderDashboard();
    expect(await screen.findByText(/live · board overview/i)).toBeInTheDocument();
  });

  it('renders KPI cards from mockData', async () => {
    renderDashboard();
    expect(await screen.findByText('Active Engagements')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Revenue')).toBeInTheDocument();
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

  it('shows a pending decision from mockData', async () => {
    renderDashboard();
    expect(await screen.findByText('Approve vendor shortlist')).toBeInTheDocument();
  });

  it('removes decision on Done button click', async () => {
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
