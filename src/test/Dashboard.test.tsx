import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Hoisted mocks ────────────────────────────────────────────
const { mockGetActivities, mockGetMilestones, mockGetWorkspaceFinancials, mockGetRagStatusWithWorkspaces, mockGetApprovals, mockUpdateApproval, mockUpsertApproval, mockGetBoardDecisions, mockGetDocuments } = vi.hoisted(() => ({
  mockGetActivities: vi.fn(),
  mockGetMilestones: vi.fn(),
  mockGetWorkspaceFinancials: vi.fn(),
  mockGetRagStatusWithWorkspaces: vi.fn(),
  mockGetApprovals: vi.fn(),
  mockUpdateApproval: vi.fn(),
  mockUpsertApproval: vi.fn(),
  mockGetBoardDecisions: vi.fn(),
  mockGetDocuments: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getActivities: mockGetActivities,
  getMilestones: mockGetMilestones,
  getWorkspaceFinancials: mockGetWorkspaceFinancials,
  getRagStatusWithWorkspaces: mockGetRagStatusWithWorkspaces,
  getApprovals: mockGetApprovals,
  updateApproval: mockUpdateApproval,
  upsertApproval: mockUpsertApproval,
  getBoardDecisions: mockGetBoardDecisions,
  getDocuments: mockGetDocuments,
}));

vi.mock('../hooks/useLayout', () => ({
  useLayout: () => ({ width: 1280, isMobile: false, isTablet: false }),
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
  id: 'a1', action: 'generated', target: 'MOCI report', workspace: 'MOCI',
  workspace_id: 'ws-1', user: 'Ahmed Khalil', time: '2h ago', type: 'automation',
  created_at: new Date().toISOString(),
};

const MOCK_APPROVALS = [
  { id: 'appr-001', title: 'NCA BRD v2.3', requester: 'AM', type: 'Document Approval', urgency: 'High', status: 'pending' as const, workspace_id: null, notes: null, created_at: '', updated_at: '' },
  { id: 'appr-002', title: 'SC-10 Budget SAR 2.4M', requester: 'RT', type: 'Budget Approval', urgency: 'High', status: 'pending' as const, workspace_id: null, notes: null, created_at: '', updated_at: '' },
  { id: 'appr-003', title: 'MOCI Vendor Shortlist', requester: 'FH', type: 'Procurement Decision', urgency: 'Medium', status: 'pending' as const, workspace_id: null, notes: null, created_at: '', updated_at: '' },
  { id: 'appr-004', title: 'Healthcare Strategy Report', requester: 'SK', type: 'Report Sign-off', urgency: 'Low', status: 'pending' as const, workspace_id: null, notes: null, created_at: '', updated_at: '' },
];

const MOCK_RAG = [
  { workspace_id: 'ws-1', workspace: 'NCA', rag: 'Green' as const, budget: 'Green' as const, schedule: 'Green' as const, risk: 'Amber' as const, lastUpdated: '' },
  { workspace_id: 'ws-2', workspace: 'MOCI', rag: 'Amber' as const, budget: 'Amber' as const, schedule: 'Green' as const, risk: 'Green' as const, lastUpdated: '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockGetActivities.mockResolvedValue([]);
  mockGetMilestones.mockResolvedValue([]);
  mockGetWorkspaceFinancials.mockResolvedValue([]);
  mockGetRagStatusWithWorkspaces.mockResolvedValue(MOCK_RAG);
  mockGetApprovals.mockResolvedValue(MOCK_APPROVALS);
  mockUpdateApproval.mockResolvedValue({});
  mockUpsertApproval.mockResolvedValue({});
  mockGetBoardDecisions.mockResolvedValue([]);
  mockGetDocuments.mockResolvedValue([]);
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – Render', () => {
  it('renders the greeting hero', async () => {
    renderDashboard();
    expect(await screen.findByText(/good morning, khalil/i)).toBeInTheDocument();
  });

  it('renders KPI cards from live data', async () => {
    renderDashboard();
    expect(await screen.findByText('Total Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Revenue Recognized')).toBeInTheDocument();
    expect(screen.getByText('Budget at Risk')).toBeInTheDocument();
    expect(screen.getByText('Milestones Due')).toBeInTheDocument();
    expect(screen.getByText('On-Time Delivery')).toBeInTheDocument();
    expect(screen.getByText('Client Satisfaction')).toBeInTheDocument();
  });

  it('renders quick actions section', async () => {
    renderDashboard();
    await screen.findByText(/good morning, khalil/i);
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
  it('renders the action inbox section', async () => {
    renderDashboard();
    await screen.findByText(/good morning, khalil/i);
    expect(screen.getByText(/needs your attention/i)).toBeInTheDocument();
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
    await screen.findByText(/good morning, khalil/i);
    expect(screen.getByText('Activity Feed')).toBeInTheDocument();
  });

  it('shows activity items when data loaded', async () => {
    mockGetActivities.mockResolvedValueOnce([mockActivity]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/MOCI report/i)).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – Active workspaces', () => {
  it('shows active workspaces section', async () => {
    renderDashboard();
    await screen.findByText(/good morning, khalil/i);
    expect(screen.getAllByText(/active workspaces/i).length).toBeGreaterThan(0);
  });

  it('shows workspace items from ragStatusData', async () => {
    renderDashboard();
    await screen.findByText(/good morning, khalil/i);
    expect(screen.getAllByText('NCA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MOCI').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Dashboard – Approval Supabase persistence', () => {
  it('calls updateApproval with approved status when Approve is clicked', async () => {
    renderDashboard();
    await screen.findByText('NCA BRD v2.3');
    const approveButtons = screen.getAllByRole('button', { name: /approve/i });
    fireEvent.click(approveButtons[0]);
    await waitFor(() => {
      expect(mockUpdateApproval).toHaveBeenCalledWith('appr-001', { status: 'approved' });
    });
  });

  it('calls updateApproval with rejected status when Reject is clicked', async () => {
    renderDashboard();
    await screen.findByText('NCA BRD v2.3');
    const rejectButtons = screen.getAllByRole('button', { name: /reject/i });
    fireEvent.click(rejectButtons[0]);
    await waitFor(() => {
      expect(mockUpdateApproval).toHaveBeenCalledWith('appr-001', { status: 'rejected' });
    });
  });

  it('loads and displays approvals from Supabase on mount', async () => {
    renderDashboard();
    expect(await screen.findByText('NCA BRD v2.3')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockGetApprovals).toHaveBeenCalledTimes(1);
    });
  });
});
