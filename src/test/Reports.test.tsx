import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Hoisted mocks ────────────────────────────────────────────
const {
  mockGetReports, mockGetWorkspaces, mockGetTasks, mockGetRisks,
  mockGetMilestones, mockUpsertReport, mockDeleteReport, mockChatWithDocument,
} = vi.hoisted(() => ({
  mockGetReports: vi.fn(),
  mockGetWorkspaces: vi.fn(),
  mockGetTasks: vi.fn(),
  mockGetRisks: vi.fn(),
  mockGetMilestones: vi.fn(),
  mockUpsertReport: vi.fn(),
  mockDeleteReport: vi.fn(),
  mockChatWithDocument: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  getReports: mockGetReports,
  getWorkspaces: mockGetWorkspaces,
  getTasks: mockGetTasks,
  getRisks: mockGetRisks,
  getMilestones: mockGetMilestones,
  upsertReport: mockUpsertReport,
  deleteReport: mockDeleteReport,
}));

vi.mock('../lib/openrouter', () => ({
  chatWithDocument: mockChatWithDocument,
}));

vi.mock('../hooks/useLayout', () => ({
  useLayout: () => ({ width: 1200, isMobile: false, isTablet: false }),
}));

vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
}));

import Reports from '../screens/Reports';

// ── Fixtures ──────────────────────────────────────────────────
const mockReport = {
  id: 'r1',
  title: 'Weekly Status Report — W10',
  type: 'Weekly Status',
  type_color: '#0EA5E9',
  workspace: 'MOCI',
  workspace_id: 'ws-1',
  date: '2026-03-17',
  status: 'Generated' as const,
  pages: 3,
  period: 'This Week (W10)',
  author: 'Consultant OS AI',
  created_at: '2026-03-17T10:00:00Z',
  updated_at: '2026-03-17T10:00:00Z',
};

const mockWorkspace = {
  id: 'ws-1', name: 'MOCI', type: 'Procurement', status: 'Active' as const,
  progress: 65, language: 'AR', sector: 'Government', contributors: [],
  created_at: '', updated_at: '',
};

function renderReports() {
  return render(<Reports />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetReports.mockResolvedValue([]);
  mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  mockGetTasks.mockResolvedValue([]);
  mockGetRisks.mockResolvedValue([]);
  mockGetMilestones.mockResolvedValue([]);
  mockUpsertReport.mockResolvedValue({ ...mockReport, id: 'saved-id' });
  mockDeleteReport.mockResolvedValue(undefined);
  mockChatWithDocument.mockResolvedValue('## Executive Summary\nPortfolio is on track.');
});

// ────────────────────────────────────────────────────────────
describe('Reports – Initial load', () => {
  it('calls getReports and getWorkspaces on mount', async () => {
    renderReports();
    await waitFor(() => {
      expect(mockGetReports).toHaveBeenCalledTimes(1);
      expect(mockGetWorkspaces).toHaveBeenCalledTimes(1);
    });
  });

  it('shows empty state when no reports', async () => {
    renderReports();
    expect(await screen.findByText(/no reports found/i)).toBeInTheDocument();
  });

  it('renders report cards from supabase', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    expect(await screen.findByText('Weekly Status Report — W10')).toBeInTheDocument();
  });

  it('shows stat cards', async () => {
    renderReports();
    expect(await screen.findByText('Reports This Month')).toBeInTheDocument();
    expect(screen.getByText('Pending Sign-offs')).toBeInTheDocument();
    expect(screen.getByText('Total Downloads')).toBeInTheDocument();
  });

  it('shows board pack generator section', async () => {
    renderReports();
    await screen.findByText('Reports This Month');
    expect(screen.getByText('Generate Board Pack')).toBeInTheDocument();
    expect(screen.getByText('Executive Dashboard')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Category filter tabs', () => {
  it('filters to Weekly Status reports', async () => {
    const monthly = { ...mockReport, id: 'r2', title: 'Monthly Progress', type: 'Monthly Report' };
    mockGetReports.mockResolvedValueOnce([mockReport, monthly]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    await userEvent.click(screen.getByRole('button', { name: 'Weekly Status' }));
    expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
    expect(screen.queryByText('Monthly Progress')).not.toBeInTheDocument();
  });

  it('shows all reports after switching back to All Reports', async () => {
    const board = { ...mockReport, id: 'r3', title: 'Board Pack', type: 'Board Summary' };
    mockGetReports.mockResolvedValueOnce([mockReport, board]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    await userEvent.click(screen.getByRole('button', { name: 'Board Summaries' }));
    await userEvent.click(screen.getByRole('button', { name: 'All Reports' }));
    expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
    expect(screen.getByText('Board Pack')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Search', () => {
  it('filters reports by search term', async () => {
    const r2 = { ...mockReport, id: 'r2', title: 'Procurement Summary Report' };
    mockGetReports.mockResolvedValueOnce([mockReport, r2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    const searchInput = screen.getByPlaceholderText(/search reports/i);
    await userEvent.type(searchInput, 'Procurement');
    expect(screen.getByText('Procurement Summary Report')).toBeInTheDocument();
    expect(screen.queryByText('Weekly Status Report — W10')).not.toBeInTheDocument();
  });

  it('clears filter when search is emptied', async () => {
    const r2 = { ...mockReport, id: 'r2', title: 'Risk Report' };
    mockGetReports.mockResolvedValueOnce([mockReport, r2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    const searchInput = screen.getByPlaceholderText(/search reports/i);
    await userEvent.type(searchInput, 'Risk');
    expect(screen.queryByText('Weekly Status Report — W10')).not.toBeInTheDocument();
    await userEvent.clear(searchInput);
    expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Generate Report', () => {
  it('calls chatWithDocument when Generate Report is clicked', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => expect(mockChatWithDocument).toHaveBeenCalledTimes(1));
  });

  it('shows generated report modal with AI content', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));

    // "Executive Summary" also appears in <option> elements; use unique text from the mock response
    await waitFor(() => {
      expect(screen.getByText(/Portfolio is on track/i)).toBeInTheDocument();
    });
  });

  it('shows Save to Reports button in modal', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => screen.getByText(/save to reports/i));
    expect(screen.getByText(/save to reports/i)).toBeInTheDocument();
  });

  it('shows error message on generation failure', async () => {
    mockChatWithDocument.mockRejectedValueOnce(new Error('API rate limited'));
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));

    await waitFor(() => {
      expect(screen.getByText('API rate limited')).toBeInTheDocument();
    });
  });

  it('closes modal on Close button click', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => screen.getByText(/save to reports/i));

    await userEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(screen.queryByText(/save to reports/i)).not.toBeInTheDocument();
  });

  it('chatWithDocument is called with the current report type in the prompt', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));

    await waitFor(() => expect(mockChatWithDocument).toHaveBeenCalledTimes(1));
    const callArgs = mockChatWithDocument.mock.calls[0];
    // First arg is messages array, second is system prompt
    expect(callArgs[1]).toContain('Weekly Status Report');
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Save Report', () => {
  it('calls upsertReport when Save to Reports is clicked', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => screen.getByText(/save to reports/i));

    await userEvent.click(screen.getByText(/save to reports/i));
    await waitFor(() => expect(mockUpsertReport).toHaveBeenCalledTimes(1));
  });

  it('upsertReport receives correct status and author fields', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => screen.getByText(/save to reports/i));
    await userEvent.click(screen.getByText(/save to reports/i));

    await waitFor(() => {
      const call = mockUpsertReport.mock.calls[0][0];
      expect(call.status).toBe('Generated');
      expect(call.author).toBe('Consultant OS AI');
    });
  });

  it('closes modal after successful save', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => screen.getByText(/save to reports/i));

    await userEvent.click(screen.getByText(/save to reports/i));
    await waitFor(() => {
      expect(screen.queryByText(/save to reports/i)).not.toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Delete Report', () => {
  it('calls deleteReport with correct id', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    const deleteBtn = screen.getByTitle('Delete');
    await userEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockDeleteReport).toHaveBeenCalledWith('r1');
    });
  });

  it('removes report from list after delete', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    await userEvent.click(screen.getByTitle('Delete'));
    await waitFor(() => {
      expect(screen.queryByText('Weekly Status Report — W10')).not.toBeInTheDocument();
    });
  });

  it('deletes correct report when multiple exist', async () => {
    const r2 = { ...mockReport, id: 'r2', title: 'Second Report' };
    mockGetReports.mockResolvedValueOnce([mockReport, r2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    const deleteBtns = screen.getAllByTitle('Delete');
    await userEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(mockDeleteReport).toHaveBeenCalledWith('r1');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Workspace dropdown', () => {
  it('shows All Workspaces option by default', async () => {
    renderReports();
    await waitFor(() => expect(mockGetWorkspaces).toHaveBeenCalled());
    const selects = screen.getAllByRole('combobox');
    const workspaceSelect = selects.find(s => (s as HTMLSelectElement).value === 'All Workspaces');
    expect(workspaceSelect).toBeDefined();
  });

  it('populates workspace options from DB', async () => {
    renderReports();
    await waitFor(() => expect(mockGetWorkspaces).toHaveBeenCalled());
    // MOCI workspace should appear as an option
    const selects = screen.getAllByRole('combobox');
    const hasOption = selects.some(s => s.innerHTML.includes('MOCI'));
    expect(hasOption).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Scheduled Reports', () => {
  it('shows scheduled reports table', async () => {
    renderReports();
    await screen.findByText('Reports This Month');
    expect(screen.getByText('Scheduled Reports')).toBeInTheDocument();
    expect(screen.getByText('Weekly Portfolio Status')).toBeInTheDocument();
  });
});
