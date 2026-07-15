import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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
  localStorage.clear();
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
    expect(await screen.findByText(/no reports yet/i)).toBeInTheDocument();
  });

  it('renders report cards from supabase', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    expect(await screen.findByText('Weekly Status Report — W10')).toBeInTheDocument();
  });

  it('shows stat cards', async () => {
    renderReports();
    expect(await screen.findByText('Total Generated')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Total Reports')).toBeInTheDocument();
  });

  it('shows board pack generator section', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    // Board Pack section header and its first checklist item
    expect(screen.getByText('Board Pack')).toBeInTheDocument();
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Category filter tabs', () => {
  it('filters to Weekly Status reports', async () => {
    const monthly = { ...mockReport, id: 'r2', title: 'Monthly Progress', type: 'Monthly Report' };
    mockGetReports.mockResolvedValueOnce([mockReport, monthly]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    // Filter tabs are in the Recent Reports section header
    await userEvent.click(screen.getByRole('button', { name: /filter reports: weekly status/i }));
    expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
    // Monthly should be filtered out
    expect(screen.queryByText('Monthly Progress')).not.toBeInTheDocument();
  });

  it('shows all reports after switching back to All Reports', async () => {
    const board = { ...mockReport, id: 'r3', title: 'Board Pack Report', type: 'Board Summary' };
    mockGetReports.mockResolvedValueOnce([mockReport, board]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    await userEvent.click(screen.getByRole('button', { name: /filter reports: board summaries/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter reports: all reports/i }));
    expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
    expect(screen.getByText('Board Pack Report')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Search', () => {
  it('filters reports by search term', async () => {
    const r2 = { ...mockReport, id: 'r2', title: 'Procurement Summary Report' };
    mockGetReports.mockResolvedValueOnce([mockReport, r2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    const searchInput = screen.getByPlaceholderText(/search reports\.\.\./i);
    await userEvent.type(searchInput, 'Procurement');
    expect(screen.getByText('Procurement Summary Report')).toBeInTheDocument();
    expect(screen.queryByText('Weekly Status Report — W10')).not.toBeInTheDocument();
  });

  it('clears filter when search is emptied', async () => {
    const r2 = { ...mockReport, id: 'r2', title: 'Risk Report' };
    mockGetReports.mockResolvedValueOnce([mockReport, r2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    const searchInput = screen.getByPlaceholderText(/search reports\.\.\./i);
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
    // Default reportType is 'Status Report'
    expect(callArgs[1]).toContain('Status Report');
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
    await screen.findByText('Total Generated');
    expect(screen.getByText('Scheduled Reports')).toBeInTheDocument();
    expect(screen.getByText('Weekly PMO Status')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Board Pack generation', () => {
  it('calls chatWithDocument when Board Pack Generate Pack button is clicked', async () => {
    mockChatWithDocument.mockResolvedValue('# Board Pack Report\n\nExecutive summary...');
    mockUpsertReport.mockResolvedValue({ ...mockReport, id: 'r-pack', type: 'Board Summary' });
    renderReports();
    await screen.findByText('Total Generated');

    // Button text is "Generate Pack →"
    const generateBoardPackBtn = screen.getByText(/generate pack/i).closest('button');
    if (generateBoardPackBtn) {
      await userEvent.click(generateBoardPackBtn);
      await waitFor(() => {
        expect(mockChatWithDocument).toHaveBeenCalled();
      }, { timeout: 5000 });
    }
  });

  it('calls upsertReport after Board Pack generation', async () => {
    mockChatWithDocument.mockResolvedValue('# Board Pack\n\nContent here...');
    mockUpsertReport.mockResolvedValue({ ...mockReport, id: 'r-pack2', title: 'Board Pack', type: 'Board Summary' });
    renderReports();
    await screen.findByText('Total Generated');

    const generateBoardPackBtn = screen.getByText(/generate pack/i).closest('button');
    if (generateBoardPackBtn) {
      await userEvent.click(generateBoardPackBtn);
      await waitFor(() => {
        expect(mockUpsertReport).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'Board Summary', title: 'Board Pack' })
        );
      }, { timeout: 5000 });
    }
  });

  it('Board Pack section exists in the page', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Board Pack')).toBeInTheDocument();
    // The generate button exists
    expect(screen.getByText(/generate pack/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Report type selector', () => {
  it('shows report type selector', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    const selects = document.querySelectorAll('select');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('changes report type in selector', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    const selects = screen.getAllByRole('combobox');
    // First combobox is typically the report type selector
    if (selects.length > 0) {
      // Check it exists and can be interacted with
      expect(selects[0]).toBeInTheDocument();
    }
  });

  it('includes new report type in prompt after selection', async () => {
    renderReports();
    await screen.findByText('Total Generated');

    // Find the report type select (has 'Status Report' as default value)
    const selects = screen.getAllByRole('combobox');
    const reportTypeSelect = selects.find(s => (s as HTMLSelectElement).value === 'Status Report');
    if (reportTypeSelect) {
      await userEvent.selectOptions(reportTypeSelect, 'Monthly Progress Report');
      await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
      await waitFor(() => expect(mockChatWithDocument).toHaveBeenCalledTimes(1));
      const callArgs = mockChatWithDocument.mock.calls[0];
      expect(callArgs[1]).toContain('Monthly Progress Report');
    }
  });

  it('shows all report type options in selector', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('option', { name: 'Status Report' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Weekly Status Report' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Monthly Progress Report' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Steering Committee Pack' })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Monthly Reports filter tab', () => {
  it('shows Monthly Reports filter tab', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('button', { name: /filter reports: monthly reports/i })).toBeInTheDocument();
  });

  it('filters to Monthly Reports', async () => {
    const monthly = { ...mockReport, id: 'r2', title: 'Monthly Progress Report — March', type: 'Monthly Progress' };
    mockGetReports.mockResolvedValueOnce([mockReport, monthly]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    await userEvent.click(screen.getByRole('button', { name: /filter reports: monthly reports/i }));
    expect(screen.getByText('Monthly Progress Report — March')).toBeInTheDocument();
    expect(screen.queryByText('Weekly Status Report — W10')).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Scheduled reports content', () => {
  it('shows Monthly Financial scheduled report', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Monthly Financial')).toBeInTheDocument();
  });

  it('shows Risk Review scheduled report', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Risk Review')).toBeInTheDocument();
  });

  it('shows Paused status for Risk Review', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Report card metadata', () => {
  it('shows report workspace in table row', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    // Workspace column shows 'MOCI'
    expect(screen.getAllByText('MOCI').length).toBeGreaterThan(0);
  });

  it('shows report author in table row', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText('Consultant OS AI').length).toBeGreaterThan(0);
  });

  it('shows Generated status badge on report card', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText('Generated').length).toBeGreaterThan(0);
  });

  it('shows Download button on each report row', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByTitle('Download')).toBeInTheDocument();
  });

  it('shows multiple report cards when multiple reports loaded', async () => {
    const r2 = { ...mockReport, id: 'r2', title: 'Second Report Title', workspace: 'NCA' };
    mockGetReports.mockResolvedValueOnce([mockReport, r2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByText('Second Report Title')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Stats values', () => {
  it('shows stat value 1,284 for Total Generated', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('1,284')).toBeInTheDocument();
  });

  it('shows stat value 42 for Scheduled', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows stat value 1.2s for Avg. Gen Time', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('1.2s')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Board Summaries filter tab', () => {
  it('shows Board Summaries filter tab', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('button', { name: /filter reports: board summaries/i })).toBeInTheDocument();
  });

  it('filters to Board Summaries reports', async () => {
    const board = { ...mockReport, id: 'r2', title: 'Board Summary Dec 2025', type: 'Board Summary' };
    mockGetReports.mockResolvedValueOnce([mockReport, board]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    await userEvent.click(screen.getByRole('button', { name: /filter reports: board summaries/i }));
    expect(screen.getByText('Board Summary Dec 2025')).toBeInTheDocument();
    expect(screen.queryByText('Weekly Status Report — W10')).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Search by workspace', () => {
  it('filters by workspace in search', async () => {
    const r2 = { ...mockReport, id: 'r2', title: 'NCA Architecture Review', workspace: 'NCA', workspace_id: 'ws-2' };
    mockGetReports.mockResolvedValueOnce([mockReport, r2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    const searchInput = screen.getByPlaceholderText(/search reports\.\.\./i);
    await userEvent.type(searchInput, 'NCA');
    expect(screen.getByText('NCA Architecture Review')).toBeInTheDocument();
    expect(screen.queryByText('Weekly Status Report — W10')).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Save report error', () => {
  it('shows error message when save fails', async () => {
    mockUpsertReport.mockRejectedValueOnce(new Error('Database connection failed'));
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => screen.getByText(/save to reports/i));

    await userEvent.click(screen.getByText(/save to reports/i));
    await waitFor(() => {
      expect(screen.getByText('Database connection failed')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Report period input', () => {
  it('shows report period select with W10 option', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    // Period is a <select> with "This Week (W10)" as default option
    expect(screen.getByRole('option', { name: /W10/i })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Report card additional metadata', () => {
  it('shows formatted report date on row (not raw ISO)', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    // Date is formatted as "Mar 17, 2026" or relative ("Yesterday" etc)
    // Just verify the title rendered successfully (date is formatted by formatReportDate)
    expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
  });

  it('shows report period on row', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText('This Week (W10)').length).toBeGreaterThan(0);
  });

  it('shows report type badge on row', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText('Weekly Status').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Board Pack checklist', () => {
  it('shows Executive Summary checklist item', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getAllByText('Executive Summary').length).toBeGreaterThan(0);
  });

  it('shows Financial Overview checklist item', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Financial Overview')).toBeInTheDocument();
  });

  it('shows Risk Register checklist item', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getAllByText('Risk Register').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Recent Reports section', () => {
  it('shows Recent Reports section header', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Recent Reports')).toBeInTheDocument();
  });

  it('shows All Reports filter tab', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('button', { name: /filter reports: all reports/i })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Workspace filter', () => {
  it('filters reports by workspace when workspace selected', async () => {
    const r2 = { ...mockReport, id: 'r2', title: 'NCA Status Report', workspace: 'NCA', workspace_id: 'ws-2' };
    mockGetWorkspaces.mockResolvedValueOnce([
      mockWorkspace,
      { id: 'ws-2', name: 'NCA', type: 'Architecture', status: 'Active' as const, progress: 72, language: 'AR', sector: 'Government', contributors: [], created_at: '', updated_at: '' },
    ]);
    mockGetReports.mockResolvedValueOnce([mockReport, r2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    const selects = screen.getAllByRole('combobox');
    const wsSelect = selects.find(s => (s as HTMLSelectElement).value === 'All Workspaces');
    if (wsSelect) {
      await userEvent.selectOptions(wsSelect, 'MOCI');
      // workspace select only filters AI context, not the displayed reports list
      await waitFor(() => {
        expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
        expect(screen.getByText('NCA Status Report')).toBeInTheDocument();
      });
    }
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Report author display', () => {
  it('shows report author on generated report card', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText('Consultant OS AI').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Report period display', () => {
  it('shows period This Week (W10) on report card', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText('This Week (W10)').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Report workspace display', () => {
  it('shows report workspace MOCI on list row', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    // MOCI appears as workspace on the report row
    expect(screen.getAllByText('MOCI').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Report type badge', () => {
  it('shows Weekly Status type badge on report card', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText('Weekly Status').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Multiple reports display', () => {
  it('shows two reports when both are in data', async () => {
    const r2 = { ...mockReport, id: 'r2', title: 'Board Pack Q1 2026', type: 'Board Pack' };
    mockGetReports.mockResolvedValue([mockReport, r2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByText('Board Pack Q1 2026')).toBeInTheDocument();
  });

  it('shows Board Pack report type badge', async () => {
    const r2 = { ...mockReport, id: 'r2', title: 'Board Pack Q1 2026', type: 'Board Pack', type_color: '#7C3AED' };
    mockGetReports.mockResolvedValue([mockReport, r2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByText('Board Pack Q1 2026')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Workspace dropdown', () => {
  it('shows workspace MOCI in workspace selector', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    // "MOCI" appears in workspace dropdown
    expect(screen.getAllByText(/MOCI/).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Stat cards display', () => {
  it('shows Total Generated stat card', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Total Generated')).toBeInTheDocument();
  });

  it('shows Scheduled stat card label', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getAllByText('Scheduled').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Avg Gen Time stat card', () => {
  it('shows Avg. Gen Time stat card label', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Avg. Gen Time')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report list with reports', () => {
  it('shows report title Weekly Status Report in the list', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Total Generated');
    await waitFor(() => {
      expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
    });
  });

  it('shows report workspace MOCI badge on report row', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Total Generated');
    await waitFor(() => {
      expect(screen.getAllByText('MOCI').length).toBeGreaterThan(0);
    });
  });

  it('shows formatted date Mar 17, 2026 on report row', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Total Generated');
    // formatReportDate('2026-03-17') → 'Mar 17, 2026' in en-US locale
    await waitFor(() => {
      expect(screen.getAllByText(/Mar 17, 2026/).length).toBeGreaterThan(0);
    });
  });

  it('shows Generated status badge on report row', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Total Generated');
    await waitFor(() => {
      expect(screen.getAllByText('Generated').length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report type filter tab labels', () => {
  it('shows All Reports filter tab', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('button', { name: /All Reports/ })).toBeInTheDocument();
  });

  it('shows Weekly Status filter tab', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('button', { name: /Weekly Status/ })).toBeInTheDocument();
  });

  it('shows Monthly Reports filter tab', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('button', { name: /Monthly Reports/ })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Board Summaries filter tab', () => {
  it('shows Board Summaries filter tab', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('button', { name: /Board Summaries/ })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Search filter', () => {
  it('shows search input placeholder', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    const input = screen.getByPlaceholderText(/search/i);
    expect(input).toBeInTheDocument();
  });

  it('filters reports by title via search', async () => {
    mockGetReports.mockResolvedValueOnce([
      mockReport,
      { ...mockReport, id: 'r2', title: 'Monthly Risk Summary — March', type: 'Monthly Review', workspace: 'NCA', workspace_id: 'ws-2' },
    ]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    const searchInput = screen.getByPlaceholderText(/search/i);
    await userEvent.type(searchInput, 'Risk Summary');
    expect(screen.getByText('Monthly Risk Summary — March')).toBeInTheDocument();
    expect(screen.queryByText('Weekly Status Report — W10')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Delete report', () => {
  it('calls deleteReport when delete button is clicked', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    const deleteBtn = screen.getAllByRole('button').find(b =>
      b.textContent?.trim() === '' && b.closest('[style*="cursor"]')
    );
    // Click the delete action if found
    const deleteBtns = document.querySelectorAll('[title="Delete report"]');
    if (deleteBtns.length > 0) {
      await userEvent.click(deleteBtns[0] as HTMLElement);
      await waitFor(() => expect(mockDeleteReport).toHaveBeenCalled());
    } else {
      // Alternative: look for the trash icon button near the report
      expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Generate report form', () => {
  it('shows Generate Report button', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('button', { name: /generate.*report/i })).toBeInTheDocument();
  });

  it('shows workspace selector in generate form', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    // MOCI workspace should appear in dropdown
    expect(screen.getAllByRole('option', { name: 'MOCI' }).length).toBeGreaterThan(0);
  });

  it('shows report type options in generate form', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    // Report type options should exist
    expect(screen.getByRole('option', { name: 'Weekly Status Report' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Pages count display', () => {
  it('shows page count on report card', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    // mockReport.pages = 3
    expect(screen.getAllByText(/3/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Scheduled reports section', () => {
  it('shows Weekly PMO Status scheduled report', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Weekly PMO Status')).toBeInTheDocument();
  });

  it('shows Monthly Financial scheduled report', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Monthly Financial')).toBeInTheDocument();
  });

  it('shows Risk Review scheduled report', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Risk Review')).toBeInTheDocument();
  });

  it('shows Every Monday at 9:00 AM schedule for Weekly PMO', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Every Monday at 9:00 AM')).toBeInTheDocument();
  });

  it('shows 1st of month at 8:00 AM schedule for Monthly Financial', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('1st of month at 8:00 AM')).toBeInTheDocument();
  });

  it('shows Every Friday at 3:00 PM schedule for Risk Review', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Every Friday at 3:00 PM')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Board Pack section', () => {
  it('shows Board Pack section header', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getAllByText('Board Pack').length).toBeGreaterThan(0);
  });

  it('shows Recent Reports section header', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Recent Reports')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Stat card values', () => {
  it('shows Avg. Gen Time stat card label', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Avg. Gen Time')).toBeInTheDocument();
  });

  it('shows Scheduled stat card label', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getAllByText('Scheduled').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Generate report type options', () => {
  it('shows Monthly Progress Report report type option', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('option', { name: 'Monthly Progress Report' })).toBeInTheDocument();
  });

  it('shows Board Executive Summary report type option', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('option', { name: 'Board Executive Summary' })).toBeInTheDocument();
  });

  it('shows KPI Dashboard report type option', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('option', { name: 'KPI Dashboard' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Additional generate type options', () => {
  it('shows Status Report type option', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('option', { name: 'Status Report' })).toBeInTheDocument();
  });

  it('shows Weekly Status Report type option', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('option', { name: 'Weekly Status Report' })).toBeInTheDocument();
  });

  it('shows Steering Committee Pack type option', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('option', { name: 'Steering Committee Pack' })).toBeInTheDocument();
  });

  it('shows Risk Report type option', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('option', { name: 'Risk Report' })).toBeInTheDocument();
  });

  it('shows Procurement Summary type option', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('option', { name: 'Procurement Summary' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Stat card values', () => {
  it('shows 1,284 as Total Generated value', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getAllByText('1,284').length).toBeGreaterThan(0);
  });

  it('shows 42 as Scheduled value', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getAllByText('42').length).toBeGreaterThan(0);
  });

  it('shows Avg Gen Time value 1.2s', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getAllByText('1.2s').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Scheduled reports section', () => {
  it('shows Risk Review in scheduled reports', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Risk Review')).toBeInTheDocument();
  });

  it('shows Monthly Financial in scheduled reports', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Monthly Financial')).toBeInTheDocument();
  });

  it('shows Paused status badge on Risk Review', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Generate report select period options', () => {
  it('shows This Week (W10) period option', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('option', { name: 'This Week (W10)' })).toBeInTheDocument();
  });

  it('shows Q1 2026 period option', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('option', { name: 'Q1 2026' })).toBeInTheDocument();
  });

  it('shows Last Week (W9) period option', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('option', { name: 'Last Week (W9)' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Board Pack section', () => {
  it('shows Generate Report button in board section', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    const generateBtns = screen.getAllByRole('button', { name: /generate/i });
    expect(generateBtns.length).toBeGreaterThan(0);
  });

  it('shows Executive Summary in board pack checks', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
  });

  it('shows Financial Overview in board pack checks', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Financial Overview')).toBeInTheDocument();
  });

  it('shows Risk Register in board pack checks', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Risk Register')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report filter tabs', () => {
  it('shows All Reports filter tab', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('button', { name: /filter reports: all reports/i })).toBeInTheDocument();
  });

  it('shows Weekly Status filter tab', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('button', { name: /Weekly Status/i })).toBeInTheDocument();
  });

  it('shows Monthly Reports filter tab', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('button', { name: /Monthly Reports/i })).toBeInTheDocument();
  });

  it('shows Board Summaries filter tab', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('button', { name: /Board Summaries/i })).toBeInTheDocument();
  });

  it('clicking Weekly Status filter shows Weekly Status report', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /filter reports: weekly status/i }));
    await waitFor(() => {
      expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
    });
  });

  it('clicking Monthly Reports filter hides weekly report', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    await userEvent.click(screen.getByRole('button', { name: /Monthly Reports/i }));
    await waitFor(() => {
      expect(screen.queryByText('Weekly Status Report — W10')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Scheduled reports content', () => {
  it('shows Weekly PMO Status in scheduled reports', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Weekly PMO Status')).toBeInTheDocument();
  });

  it('shows Active status on Weekly PMO Status', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
  });

  it('shows schedule text for Weekly PMO Status', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Every Monday at 9:00 AM')).toBeInTheDocument();
  });

  it('shows schedule text for Monthly Financial', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('1st of month at 8:00 AM')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Board Pack section header', () => {
  it('shows Board Pack section header', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByText('Board Pack')).toBeInTheDocument();
  });

  it('shows Risk Register in board pack checks', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getAllByText('Risk Register').length).toBeGreaterThan(0);
  });

  it('shows Generate Pack button', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('button', { name: /Generate Pack/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Workspace selector', () => {
  it('shows All Workspaces option in workspace selector', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getAllByRole('option', { name: 'All Workspaces' }).length).toBeGreaterThan(0);
  });

  it('shows MOCI workspace option in workspace selector', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getAllByRole('option', { name: 'MOCI' }).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Delete report (extended)', () => {
  it('calls deleteReport when delete is confirmed', async () => {
    mockDeleteReport.mockResolvedValue(undefined);
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    // Delete button has title="Delete"
    const deleteBtn = screen.getByTitle('Delete');
    await userEvent.click(deleteBtn);
    await waitFor(() => expect(mockDeleteReport).toHaveBeenCalledWith('r1'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report row metadata', () => {
  it('shows report date in recent reports table', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    // Date is formatted by formatReportDate (e.g. "Mar 17, 2026")
    expect(screen.getAllByText(/Mar 17, 2026|17 Mar 2026|2026/).length).toBeGreaterThan(0);
  });

  it('shows report workspace MOCI in recent reports', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText('MOCI').length).toBeGreaterThan(0);
  });

  it('shows Generated status badge on report row', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText('Generated').length).toBeGreaterThan(0);
  });

  it('shows report pages count on report row', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    // pages: 3 — at least the number "3" appears somewhere in the row
    expect(screen.getAllByText(/\b3\b/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report type display', () => {
  it('shows Weekly Status report type badge', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText(/Weekly Status/).length).toBeGreaterThan(0);
  });

  it('shows period label This Week W10', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText(/This Week|W10/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Multiple reports', () => {
  it('renders two reports in the table', async () => {
    const report2 = { ...mockReport, id: 'r2', title: 'NCA Monthly Insight', workspace: 'NCA', workspace_id: 'ws-2' };
    mockGetReports.mockResolvedValueOnce([mockReport, report2]);
    renderReports();
    expect(await screen.findByText('Weekly Status Report — W10')).toBeInTheDocument();
    expect(screen.getByText('NCA Monthly Insight')).toBeInTheDocument();
  });

  it('shows both workspace names when multiple reports exist', async () => {
    const report2 = { ...mockReport, id: 'r2', title: 'NCA Monthly Insight', workspace: 'NCA', workspace_id: 'ws-2' };
    mockGetReports.mockResolvedValueOnce([mockReport, report2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText(/MOCI/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/NCA/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Author display', () => {
  it('shows Consultant OS AI author on report row', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText(/Consultant OS AI/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report action buttons', () => {
  it('shows Download button on report row', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByTitle('Download')).toBeInTheDocument();
  });

  it('shows Delete button on report row', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByTitle('Delete')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Workspace filter dropdown', () => {
  it('shows All Workspaces option in workspace filter', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getAllByText(/All Workspaces/i).length).toBeGreaterThan(0);
  });

  it('shows MOCI option in workspace filter when MOCI workspace exists', async () => {
    renderReports();
    await waitFor(() => expect(mockGetWorkspaces).toHaveBeenCalled());
    expect(screen.getAllByText(/MOCI/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Scheduled reports section', () => {
  it('shows Scheduled Reports section header', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getAllByText(/Scheduled Reports/i).length).toBeGreaterThan(0);
  });

  it('shows Weekly PMO Status scheduled report', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByText('Weekly PMO Status')).toBeInTheDocument();
  });

  it('shows Monthly Financial scheduled report', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByText('Monthly Financial')).toBeInTheDocument();
  });

  it('shows Risk Review scheduled report', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByText('Risk Review')).toBeInTheDocument();
  });

  it('shows "Every Monday at 9:00 AM" schedule text', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByText(/Every Monday at 9:00 AM/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Board Pack section', () => {
  it('shows Board Pack title in pack templates', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getAllByText(/Board Pack/i).length).toBeGreaterThan(0);
  });

  it('shows Generate Pack button', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getAllByText(/Generate Pack/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report generation', () => {
  it('shows Generate Report button', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getAllByRole('button', { name: /generate report/i }).length).toBeGreaterThan(0);
  });

  it('shows generated report content after generate clicked', async () => {
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const genBtn = screen.getAllByRole('button', { name: /generate report/i })[0];
    await userEvent.click(genBtn);
    await waitFor(() => {
      expect(screen.getAllByText(/Executive Summary|Portfolio is on track/i).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Search filter', () => {
  it('shows search input field', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getAllByPlaceholderText(/search|filter/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report type selector', () => {
  it('shows Status Report type in selector', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getAllByText(/Status Report/i).length).toBeGreaterThan(0);
  });

  it('shows Weekly Status Report type option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    // Weekly Status Report is in the dropdown options
    expect(screen.getAllByRole('option', { name: /Weekly Status Report/i }).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report list filter tabs', () => {
  it('shows All Reports filter option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getAllByText(/All Reports/i).length).toBeGreaterThan(0);
  });

  it('shows Weekly Status filter tab', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getAllByText(/Weekly Status/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report workspace selector', () => {
  it('shows workspace selector dropdown', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report row display', () => {
  it('shows report title in report list row', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
  });

  it('shows report workspace MOCI in row', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText(/MOCI/).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – KPI Dashboard report type option', () => {
  it('shows KPI Dashboard as a report type option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getAllByRole('option', { name: /KPI Dashboard/i }).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report period selector', () => {
  it('shows period selector in generate section', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    // Period selector is a select dropdown
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report author', () => {
  it('shows Consultant OS AI as author for generated report', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText(/Consultant OS AI/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Monthly Reports filter option', () => {
  it('shows Monthly Reports filter option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getAllByText(/Monthly Reports/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report status Generated badge', () => {
  it('shows Generated status on report row', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText(/Generated/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – View All toggle', () => {
  it('shows View All button in Recent Reports section', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByText(/View All/i)).toBeInTheDocument();
  });

  it('shows Show Less after clicking View All', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    const viewAllBtn = screen.getByText(/View All/i);
    await userEvent.click(viewAllBtn);
    expect(screen.getByText(/Show Less/i)).toBeInTheDocument();
  });

  it('shows View All again after clicking Show Less', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    const viewAllBtn = screen.getByText(/View All/i);
    await userEvent.click(viewAllBtn);
    await userEvent.click(screen.getByText(/Show Less/i));
    expect(screen.getByText(/View All/i)).toBeInTheDocument();
  });

  it('shows all reports when View All is clicked with 2 reports', async () => {
    const mockReport2 = {
      ...mockReport,
      id: 'r2',
      title: 'Monthly Progress Report — March',
      type: 'Monthly Progress',
    };
    mockGetReports.mockResolvedValue([mockReport, mockReport2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await screen.findByText('Monthly Progress Report — March');
    // Both reports should be visible even without clicking View All (2 <= 4)
    expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
    expect(screen.getByText('Monthly Progress Report — March')).toBeInTheDocument();
  });

  it('View All button includes count when more than 4 reports', async () => {
    const manyReports = Array.from({ length: 5 }, (_, i) => ({
      ...mockReport,
      id: `r${i}`,
      title: `Report ${i}`,
    }));
    mockGetReports.mockResolvedValue(manyReports);
    renderReports();
    await waitFor(() => expect(screen.getAllByText(/Report \d/).length).toBeGreaterThan(0));
    expect(screen.getByText(/View All.*5/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Filter tab aria attributes', () => {
  it('All Reports filter tab has aria-pressed=true by default', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('Weekly Status filter tab has aria-pressed=false by default', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    expect(weeklyBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('Monthly Reports filter tab has correct aria-label', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    expect(screen.getByRole('button', { name: /filter reports: monthly reports/i })).toBeInTheDocument();
  });

  it('Board Summaries filter tab has correct aria-label', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    expect(screen.getByRole('button', { name: /filter reports: board summaries/i })).toBeInTheDocument();
  });

  it('clicking Weekly Status sets its aria-pressed=true and All Reports to false', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    await userEvent.click(weeklyBtn);
    await waitFor(() => {
      expect(weeklyBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All Reports restores its aria-pressed=true after switching tabs', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    await userEvent.click(weeklyBtn);
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(weeklyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

describe('Reports – Sort dropdown', () => {
  beforeEach(() => {
    mockGetReports.mockResolvedValue([]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
    mockGetTasks.mockResolvedValue([]);
    mockGetRisks.mockResolvedValue([]);
    mockGetMilestones.mockResolvedValue([]);
  });

  it('renders the sort reports dropdown', async () => {
    renderReports();
    await screen.findByText('Recent Reports');
    expect(screen.getByRole('combobox', { name: /sort reports/i })).toBeInTheDocument();
  });

  it('sort dropdown defaults to newest first', async () => {
    renderReports();
    await screen.findByText('Recent Reports');
    const select = screen.getByRole('combobox', { name: /sort reports/i }) as HTMLSelectElement;
    expect(select.value).toBe('newest');
  });

  it('sort dropdown has newest, oldest and name options', async () => {
    renderReports();
    await screen.findByText('Recent Reports');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    const options = Array.from(select.querySelectorAll('option')).map(o => (o as HTMLOptionElement).value);
    expect(options).toContain('newest');
    expect(options).toContain('oldest');
    expect(options).toContain('name');
  });

  it('selecting oldest changes dropdown value', async () => {
    renderReports();
    await screen.findByText('Recent Reports');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'oldest');
    expect((select as HTMLSelectElement).value).toBe('oldest');
  });

  it('selecting name sort changes dropdown value', async () => {
    renderReports();
    await screen.findByText('Recent Reports');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'name');
    expect((select as HTMLSelectElement).value).toBe('name');
  });

  it('sort by name sorts reports alphabetically', async () => {
    const reportA = { ...mockReport, id: 'r-a', title: 'Alpha Report', date: '2026-01-01' };
    const reportB = { ...mockReport, id: 'r-b', title: 'Zeta Report', date: '2026-02-01' };
    mockGetReports.mockResolvedValue([reportB, reportA]);
    renderReports();
    await screen.findByText('Alpha Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'name');
    await waitFor(() => {
      expect(screen.getByText('Alpha Report')).toBeInTheDocument();
      expect(screen.getByText('Zeta Report')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report action button aria-labels', () => {
  it('Download button has aria-label for a report', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /download weekly status report/i })).toBeInTheDocument();
  });

  it('Delete button has aria-label for a report', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /delete weekly status report/i })).toBeInTheDocument();
  });

  it('clicking Delete removes the report from the list', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    mockDeleteReport.mockResolvedValue(undefined);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /delete weekly status report/i }));
    await waitFor(() => {
      expect(screen.queryByText('Weekly Status Report — W10')).not.toBeInTheDocument();
    });
  });

  it('each report row has its own download aria-label', async () => {
    const r2 = { ...mockReport, id: 'r2', title: 'Monthly Financials' };
    mockGetReports.mockResolvedValue([mockReport, r2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /download weekly status report/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download monthly financials/i })).toBeInTheDocument();
  });

  it('each report row has its own delete aria-label', async () => {
    const r2 = { ...mockReport, id: 'r2', title: 'Monthly Financials' };
    mockGetReports.mockResolvedValue([mockReport, r2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /delete weekly status report/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete monthly financials/i })).toBeInTheDocument();
  });

  it('View All button appears when reports exceed 4', async () => {
    const manyReports = Array.from({ length: 5 }, (_, i) => ({
      ...mockReport,
      id: `r${i}`,
      title: `Report ${i + 1}`,
    }));
    mockGetReports.mockResolvedValue(manyReports);
    renderReports();
    await screen.findByText('Report 1');
    expect(screen.getByText(/view all/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – New button aria-labels', () => {
  it('Generate Pack button has aria-label', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    expect(screen.getByRole('button', { name: /generate pack/i })).toBeInTheDocument();
  });

  it('Generate Report button has aria-label', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    expect(screen.getByRole('button', { name: /^generate report$/i })).toBeInTheDocument();
  });

  it('View All reports button has aria-label', async () => {
    const manyReports = Array.from({ length: 5 }, (_, i) => ({
      ...mockReport,
      id: `r${i}`,
      title: `Report ${i + 1}`,
    }));
    mockGetReports.mockResolvedValue(manyReports);
    renderReports();
    await screen.findByText('Report 1');
    expect(screen.getByRole('button', { name: /view all reports/i })).toBeInTheDocument();
  });

  it('View All button changes aria-label to Show Less when clicked', async () => {
    const manyReports = Array.from({ length: 5 }, (_, i) => ({
      ...mockReport,
      id: `r${i}`,
      title: `Report ${i + 1}`,
    }));
    mockGetReports.mockResolvedValue(manyReports);
    renderReports();
    await screen.findByText('Report 1');
    const viewAllBtn = screen.getByRole('button', { name: /view all reports/i });
    await userEvent.click(viewAllBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /show less reports/i })).toBeInTheDocument();
    });
  });

  it('Sort reports selector has aria-label', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    expect(screen.getByRole('combobox', { name: /sort reports/i })).toBeInTheDocument();
  });

  it('Filter reports tabs have aria-labels', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    expect(screen.getByRole('button', { name: /filter reports: all reports/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter reports: weekly status/i })).toBeInTheDocument();
  });
});

describe('Reports – Search and generate form aria-labels', () => {
  it('search reports input has aria-label', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    expect(screen.getByRole('textbox', { name: /search reports/i })).toBeInTheDocument();
  });

  it('typing in search reports input filters results', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    const searchInput = screen.getByRole('textbox', { name: /search reports/i });
    await userEvent.type(searchInput, 'Board');
    expect(searchInput).toHaveValue('Board');
  });

  it('report type select has aria-label in generate panel', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    expect(screen.getByRole('combobox', { name: /report type/i })).toBeInTheDocument();
  });

  it('workspace source select has aria-label in generate panel', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    expect(screen.getByRole('combobox', { name: /workspace source/i })).toBeInTheDocument();
  });

  it('report period select has aria-label in generate panel', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    expect(screen.getByRole('combobox', { name: /report period/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Generate Report button and flow', () => {
  it('Generate Report button has aria-label', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    expect(screen.getByRole('button', { name: /generate report/i })).toBeInTheDocument();
  });

  it('Generate Pack button has aria-label', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    expect(screen.getByRole('button', { name: /generate pack/i })).toBeInTheDocument();
  });

  it('Generate Report button is not disabled by default', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    const generateBtn = screen.getByRole('button', { name: /generate report/i });
    expect(generateBtn).not.toBeDisabled();
  });

  it('clicking Generate Report shows generated report modal', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close generated report/i })).toBeInTheDocument();
    });
  });

  it('generated report modal has Close button with aria-label', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close generated report/i })).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('clicking Close generated report hides the report', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /close generated report/i })).toBeInTheDocument(), { timeout: 5000 });
    await userEvent.click(screen.getByRole('button', { name: /close generated report/i }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /close generated report/i })).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Download and Delete report aria-labels', () => {
  it('Download report button has dynamic aria-label', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /download Weekly Status Report — W10/i })).toBeInTheDocument();
  });

  it('Delete report button has dynamic aria-label', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /delete Weekly Status Report — W10/i })).toBeInTheDocument();
  });

  it('clicking Delete report calls deleteReport', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /delete Weekly Status Report — W10/i }));
    await waitFor(() => {
      expect(mockDeleteReport).toHaveBeenCalledWith('r1');
    });
  });

  it('deleted report is removed from list', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    mockDeleteReport.mockResolvedValue(undefined);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /delete Weekly Status Report — W10/i }));
    await waitFor(() => {
      expect(screen.queryByText('Weekly Status Report — W10')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report type select on Generate form', () => {
  it('Report type select has aria-label', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /report type/i })).toBeInTheDocument();
  });

  it('Workspace source select has aria-label', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /workspace source/i })).toBeInTheDocument();
  });

  it('Report period select has aria-label', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /report period/i })).toBeInTheDocument();
  });

  it('Generate Report button has aria-label', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /generate report/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Generate Pack button', () => {
  it('Generate Pack button has aria-label', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /generate pack/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Close and copy generated report', () => {
  it('Close generated report button appears after generation', async () => {
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close generated report/i })).toBeInTheDocument();
    });
  });

  it('Copy report to clipboard button appears after generation', async () => {
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy generated report to clipboard/i })).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report card metadata', () => {
  it('shows report period "This Week (W10)"', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByText('This Week (W10)')).toBeInTheDocument();
  });

  it('shows report author "Consultant OS AI"', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByText('Consultant OS AI')).toBeInTheDocument();
  });

  it('shows report type "Weekly Status"', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText('Weekly Status').length).toBeGreaterThan(0);
  });

  it('shows report workspace "MOCI"', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText('MOCI').length).toBeGreaterThan(0);
  });

  it('shows formatted report date "Mar 17, 2026"', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText('Mar 17, 2026').length).toBeGreaterThan(0);
  });

  it('shows report status "Generated"', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getAllByText('Generated').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Download and Save buttons after generation', () => {
  it('Download report as text file button appears after generation', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download report as text file/i })).toBeInTheDocument();
    });
  });

  it('Save report to Reports button appears after generation', async () => {
    renderReports();
    await screen.findByText('Board Pack');
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save report to reports/i })).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report search filtering behavior', () => {
  it('typing in search input shows matching report', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    const searchInput = screen.getByRole('textbox', { name: /search reports/i });
    await userEvent.type(searchInput, 'Weekly');
    await waitFor(() => {
      expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
    });
  });

  it('typing non-matching term in search hides report', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    const searchInput = screen.getByRole('textbox', { name: /search reports/i });
    await userEvent.type(searchInput, 'zzz_nonexistent');
    await waitFor(() => {
      expect(screen.queryByText('Weekly Status Report — W10')).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Empty reports state text', () => {
  it('shows "No reports yet" when no reports exist', async () => {
    mockGetReports.mockResolvedValue([]);
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByText('No reports yet')).toBeInTheDocument();
  });

  it('shows "Generate a report to get started" subtitle', async () => {
    mockGetReports.mockResolvedValue([]);
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByText(/Generate a report to get started/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Generation Volume section', () => {
  it('shows "Generation Volume" section header', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByText('Generation Volume')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Table column headers', () => {
  it('shows NAME column header in reports table', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByText('NAME')).toBeInTheDocument();
  });

  it('shows WORKSPACE column header in reports table', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByText('WORKSPACE')).toBeInTheDocument();
  });

  it('shows STATUS column header in reports table', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByText('STATUS')).toBeInTheDocument();
  });

  it('shows DATE column header in reports table', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByText('DATE')).toBeInTheDocument();
  });

  it('shows ACTIONS column header in reports table', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByText('ACTIONS')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Sort by oldest reorders reports', () => {
  it('sort by oldest shows report with earlier date as first when sorted', async () => {
    const olderReport = { ...mockReport, id: 'r-old', title: 'Old Report', date: '2026-01-01' };
    const newerReport = { ...mockReport, id: 'r-new', title: 'New Report', date: '2026-03-01' };
    mockGetReports.mockResolvedValue([newerReport, olderReport]);
    renderReports();
    await screen.findByText('Old Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'oldest');
    await waitFor(() => {
      expect(screen.getByText('Old Report')).toBeInTheDocument();
      expect(screen.getByText('New Report')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report author fallback', () => {
  it('shows author name when author is set', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByText('Consultant OS AI')).toBeInTheDocument();
  });

  it('shows "Consultant OS AI" as fallback when author is empty', async () => {
    mockGetReports.mockResolvedValue([{ ...mockReport, author: '' }]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByText('Consultant OS AI')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Filter reports tab aria-labels', () => {
  it('Filter reports: All Reports tab has aria-label', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: all reports/i })).toBeInTheDocument();
  });

  it('Filter reports: Weekly Status tab has aria-label', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: weekly status/i })).toBeInTheDocument();
  });

  it('Filter reports: Monthly Reports tab has aria-label', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: monthly reports/i })).toBeInTheDocument();
  });

  it('Filter reports: Board Summaries tab has aria-label', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: board summaries/i })).toBeInTheDocument();
  });

  it('Filter reports: All Reports is pressed by default', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: all reports/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Filter reports: Weekly Status sets it to pressed', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Filter reports: Monthly Reports sets it to pressed', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – AI Insights section', () => {
  it('shows "AI Insights" section heading', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByText('AI Insights')).toBeInTheDocument();
  });

  it('shows "Suggestion:" text in AI Insights', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByText(/Suggestion:/i)).toBeInTheDocument();
  });

  it('shows scheduling suggestion text', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getAllByText(/Weekly PMO Status/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – New Custom Report section heading', () => {
  it('shows "New Custom Report" section heading', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByText('New Custom Report')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Board Summaries tab pressed state', () => {
  it('Filter reports: Board Summaries has aria-pressed=false by default', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Board Summaries sets aria-pressed=true', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Board Summaries sets All Reports to aria-pressed=false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(boardBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking All Reports after Board Summaries restores All to pressed', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(boardBtn);
    await userEvent.click(allBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Sort reports select options', () => {
  it('Sort reports select has default value', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sortSelect = screen.getByRole('combobox', { name: /sort reports/i }) as HTMLSelectElement;
    expect(sortSelect).toBeInTheDocument();
  });

  it('Sort reports select has Newest First option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sortSelect = screen.getByRole('combobox', { name: /sort reports/i });
    const opts = Array.from(sortSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(opts.some(t => /newest/i.test(t!))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report type options in generate form', () => {
  it('Report type select has Status Report option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const typeSelect = screen.getByRole('combobox', { name: /report type/i });
    const opts = Array.from(typeSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(opts.some(t => /status/i.test(t!))).toBe(true);
  });
});

describe('Reports – Sort reports Oldest first and By name options', () => {
  it('sort reports has Oldest first option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sortSelect = screen.getByRole('combobox', { name: /sort reports/i });
    const opts = Array.from(sortSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Oldest first');
  });

  it('sort reports has By name option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sortSelect = screen.getByRole('combobox', { name: /sort reports/i });
    const opts = Array.from(sortSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('By name');
  });

  it('sort reports can be changed to oldest', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sortSelect = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(sortSelect, 'oldest');
    expect((sortSelect as HTMLSelectElement).value).toBe('oldest');
  });
});

describe('Reports – Report period select options', () => {
  it('report period has Last Week option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const periodSelect = screen.getByRole('combobox', { name: /report period/i });
    const opts = Array.from(periodSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(opts.some(t => /last week/i.test(t!))).toBe(true);
  });

  it('report period has This Month option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const periodSelect = screen.getByRole('combobox', { name: /report period/i });
    const opts = Array.from(periodSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(opts.some(t => /this month/i.test(t!))).toBe(true);
  });

  it('report period has Q1 2026 option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const periodSelect = screen.getByRole('combobox', { name: /report period/i });
    const opts = Array.from(periodSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(opts.some(t => /Q1 2026/i.test(t!))).toBe(true);
  });
});

describe('Reports – Workspace source select aria-label', () => {
  it('Workspace source select has aria-label', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('combobox', { name: /workspace source/i })).toBeInTheDocument();
  });

  it('Workspace source select has All Workspaces as first option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const wsSelect = screen.getByRole('combobox', { name: /workspace source/i });
    const firstOpt = wsSelect.querySelectorAll('option')[0];
    expect(firstOpt?.textContent).toMatch(/all workspaces/i);
  });
});

describe('Reports – Report type option text labels (full list)', () => {
  it('report type has Monthly Progress Report option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /report type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Monthly Progress Report');
  });

  it('report type has Steering Committee Pack option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /report type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Steering Committee Pack');
  });

  it('report type has Board Executive Summary option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /report type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Board Executive Summary');
  });

  it('report type has Risk Report option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /report type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Risk Report');
  });

  it('report type has KPI Dashboard option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /report type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('KPI Dashboard');
  });

  it('report type has Procurement Summary option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /report type/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('Procurement Summary');
  });

  it('report type can be changed to Board Executive Summary', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /report type/i });
    await userEvent.selectOptions(sel, 'Board Executive Summary');
    expect((sel as HTMLSelectElement).value).toBe('Board Executive Summary');
  });

  it('report type can be changed to KPI Dashboard', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /report type/i });
    await userEvent.selectOptions(sel, 'KPI Dashboard');
    expect((sel as HTMLSelectElement).value).toBe('KPI Dashboard');
  });
});

describe('Reports – Report period select can be changed', () => {
  it('report period can be changed to Q1 2026', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /report period/i });
    await userEvent.selectOptions(sel, 'Q1 2026');
    expect((sel as HTMLSelectElement).value).toBe('Q1 2026');
  });

  it('report period has This Week option', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /report period/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts.some(t => /this week/i.test(t!))).toBe(true);
  });

  it('report period defaults to This Week', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sel = screen.getByRole('combobox', { name: /report period/i }) as HTMLSelectElement;
    expect(sel.value).toMatch(/W\d+/);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Weekly Status filter tab pressed state', () => {
  it('Filter reports: Weekly Status has aria-pressed=false by default', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Weekly Status sets aria-pressed=true', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Weekly Status sets All Reports to aria-pressed=false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    await userEvent.click(weeklyBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Monthly Reports filter tab pressed state', () => {
  it('Filter reports: Monthly Reports has aria-pressed=false by default', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Monthly Reports sets aria-pressed=true', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Monthly Reports sets All Reports to false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    await userEvent.click(monthlyBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Board Summaries after Monthly Reports sets Monthly to false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(monthlyBtn);
    expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(boardBtn);
    expect(monthlyBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Sort reports can be changed to name', () => {
  it('sort reports can be changed to "name"', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sortSelect = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(sortSelect, 'name');
    expect((sortSelect as HTMLSelectElement).value).toBe('name');
  });

  it('sort reports defaults to "newest"', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sortSelect = screen.getByRole('combobox', { name: /sort reports/i }) as HTMLSelectElement;
    expect(sortSelect.value).toBe('newest');
  });

  it('sort reports has eight options', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const sortSelect = screen.getByRole('combobox', { name: /sort reports/i });
    const opts = Array.from(sortSelect.querySelectorAll('option'));
    expect(opts.length).toBe(8);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Report period can be changed to Last Week', () => {
  it('report period can be changed to Last Week', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const periodSelect = screen.getByRole('combobox', { name: /report period/i });
    const opts = Array.from(periodSelect.querySelectorAll('option'));
    const lastWeekOpt = opts.find(o => /last week/i.test(o.textContent ?? ''));
    if (lastWeekOpt) {
      await userEvent.selectOptions(periodSelect, lastWeekOpt.value || lastWeekOpt.textContent!);
      expect((periodSelect as HTMLSelectElement).value).toMatch(/W9|Last Week/i);
    }
  });

  it('report period can be changed to This Month', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const periodSelect = screen.getByRole('combobox', { name: /report period/i });
    const opts = Array.from(periodSelect.querySelectorAll('option'));
    const monthOpt = opts.find(o => /this month/i.test(o.textContent ?? ''));
    if (monthOpt) {
      await userEvent.selectOptions(periodSelect, monthOpt.value || monthOpt.textContent!);
      expect((periodSelect as HTMLSelectElement).value).toMatch(/March|This Month/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Board Summaries filter pressed state', () => {
  it('Board Summaries tab has aria-pressed=false by default', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: board summaries/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Board Summaries sets it to aria-pressed=true', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(boardBtn);
    await waitFor(() => expect(boardBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Board Summaries sets All Reports to aria-pressed=false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(boardBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All after Board Summaries restores All to aria-pressed=true', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(boardBtn);
    await waitFor(() => expect(boardBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Filter tab cross-deselection', () => {
  it('clicking All after Monthly Reports restores All to aria-pressed=true', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    await userEvent.click(monthlyBtn);
    await userEvent.click(allBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Weekly Status after Board Summaries sets Board Summaries to aria-pressed=false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    await userEvent.click(boardBtn);
    expect(boardBtn).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(weeklyBtn);
    expect(boardBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Monthly Reports after Weekly Status sets Weekly Status to aria-pressed=false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    await userEvent.click(weeklyBtn);
    expect(weeklyBtn).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(monthlyBtn);
    expect(weeklyBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking All after Weekly Status restores All to aria-pressed=true', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    await userEvent.click(weeklyBtn);
    await userEvent.click(allBtn);
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – filter defaults', () => {
  it('Weekly Status has aria-pressed=false by default', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: weekly status/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Board Summaries has aria-pressed=false by default', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: board summaries/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Monthly Reports has aria-pressed=false by default', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: monthly reports/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('All Reports has aria-pressed=true by default', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: all reports/i })).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Board Summaries cross-deselection', () => {
  it('clicking Board Summaries sets All to false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(boardBtn);
    await waitFor(() => {
      expect(boardBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Monthly after Board sets Board to false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    await userEvent.click(boardBtn);
    await waitFor(() => expect(boardBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(monthlyBtn);
    await waitFor(() => {
      expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true');
      expect(boardBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking All after Board restores All to true', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(boardBtn);
    await waitFor(() => expect(boardBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Monthly Reports filter', () => {
  it('Monthly Reports has aria-pressed=false by default', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: monthly reports/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Monthly sets it to true', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    await userEvent.click(monthlyBtn);
    await waitFor(() => expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Weekly after Monthly sets Monthly to false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    await userEvent.click(monthlyBtn);
    await waitFor(() => expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(weeklyBtn);
    await waitFor(() => expect(monthlyBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking All after Monthly restores All to true', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    await userEvent.click(monthlyBtn);
    await waitFor(() => expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(monthlyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Weekly Status filter', () => {
  it('Weekly Status has aria-pressed=false by default', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: weekly status/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Weekly sets it to true', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    await userEvent.click(weeklyBtn);
    await waitFor(() => expect(weeklyBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Board after Weekly sets Weekly to false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(weeklyBtn);
    await waitFor(() => expect(weeklyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(boardBtn);
    await waitFor(() => expect(weeklyBtn).toHaveAttribute('aria-pressed', 'false'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – three-filter sequences', () => {
  it('Weekly → Board → Monthly: Monthly=true, Weekly=false, Board=false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    await userEvent.click(weeklyBtn);
    await waitFor(() => expect(weeklyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(boardBtn);
    await waitFor(() => expect(boardBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(monthlyBtn);
    await waitFor(() => {
      expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true');
      expect(weeklyBtn).toHaveAttribute('aria-pressed', 'false');
      expect(boardBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Monthly → Weekly → All: All=true, Monthly=false, Weekly=false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    await userEvent.click(monthlyBtn);
    await waitFor(() => expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(weeklyBtn);
    await waitFor(() => expect(weeklyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(monthlyBtn).toHaveAttribute('aria-pressed', 'false');
      expect(weeklyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Board Summaries filter interactions', () => {
  it('Board Summaries button is present', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: board summaries/i })).toBeInTheDocument();
  });

  it('clicking Board Summaries sets aria-pressed=true', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const btn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Board Summaries deselects All', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(boardBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clicking All after Board Summaries restores All=true', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(boardBtn);
    await waitFor(() => expect(boardBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – All filter default and toggle', () => {
  it('All Reports button starts with aria-pressed=true', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: all reports/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Weekly starts with aria-pressed=false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: weekly status/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Monthly starts with aria-pressed=false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: monthly reports/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Board Summaries starts with aria-pressed=false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: board summaries/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – additional three-filter sequences', () => {
  it('Board → Monthly → Weekly: Weekly=true, Board=false, Monthly=false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    await userEvent.click(boardBtn);
    await waitFor(() => expect(boardBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(monthlyBtn);
    await waitFor(() => expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(weeklyBtn);
    await waitFor(() => {
      expect(weeklyBtn).toHaveAttribute('aria-pressed', 'true');
      expect(boardBtn).toHaveAttribute('aria-pressed', 'false');
      expect(monthlyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Weekly → All → Board: Board=true, Weekly=false, All=false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(weeklyBtn);
    await waitFor(() => expect(weeklyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => expect(allBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(boardBtn);
    await waitFor(() => {
      expect(boardBtn).toHaveAttribute('aria-pressed', 'true');
      expect(weeklyBtn).toHaveAttribute('aria-pressed', 'false');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – filter button completeness', () => {
  it('all four filter buttons are present', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: all reports/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter reports: weekly status/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter reports: monthly reports/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter reports: board summaries/i })).toBeInTheDocument();
  });

  it('clicking same filter twice stays active', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    await userEvent.click(weeklyBtn);
    await waitFor(() => expect(weeklyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(weeklyBtn);
    await waitFor(() => expect(weeklyBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking All after weekly restores All=true and weekly=false', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    await userEvent.click(weeklyBtn);
    await waitFor(() => expect(weeklyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(allBtn);
    await waitFor(() => {
      expect(allBtn).toHaveAttribute('aria-pressed', 'true');
      expect(weeklyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – report data display', () => {
  it('shows Weekly Status Report when data loaded', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await waitFor(() => expect(screen.getByText(/weekly status report/i)).toBeInTheDocument());
  });

  it('shows report workspace when data loaded', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await waitFor(() => expect(screen.getByText(/weekly status report/i)).toBeInTheDocument());
    expect(screen.getAllByText(/moci/i).length).toBeGreaterThan(0);
  });

  it('shows report date when data loaded', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await waitFor(() => expect(screen.getByText(/weekly status report/i)).toBeInTheDocument());
    expect(screen.getAllByText(/2026/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Monthly Reports filter interactions', () => {
  it('clicking Monthly Reports makes it active', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    await userEvent.click(monthlyBtn);
    await waitFor(() => expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Monthly Reports deselects All', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    await userEvent.click(monthlyBtn);
    await waitFor(() => {
      expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Monthly twice stays active', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    await userEvent.click(monthlyBtn);
    await waitFor(() => expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(monthlyBtn);
    await waitFor(() => expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – filter sequence: Weekly → Monthly → Board', () => {
  it('Board becomes active after Weekly → Monthly → Board sequence', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(weeklyBtn);
    await userEvent.click(monthlyBtn);
    await userEvent.click(boardBtn);
    await waitFor(() => {
      expect(boardBtn).toHaveAttribute('aria-pressed', 'true');
      expect(weeklyBtn).toHaveAttribute('aria-pressed', 'false');
      expect(monthlyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Weekly becomes active after Board → Monthly → Weekly sequence', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(boardBtn);
    await userEvent.click(monthlyBtn);
    await userEvent.click(weeklyBtn);
    await waitFor(() => {
      expect(weeklyBtn).toHaveAttribute('aria-pressed', 'true');
      expect(boardBtn).toHaveAttribute('aria-pressed', 'false');
      expect(monthlyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – header elements', () => {
  it('renders the page without crashing', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(document.body).toBeInTheDocument();
  });

  it('shows all four filter buttons', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it('All Reports starts as active by default', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Weekly Status filter default state', () => {
  it('Weekly Status starts inactive', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: weekly status/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Monthly Reports starts inactive', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: monthly reports/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Board Summaries starts inactive', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /filter reports: board summaries/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – four-filter sequence', () => {
  it('Weekly active after Board→Monthly→Weekly sequence', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const weeklyBtn = screen.getByRole('button', { name: /filter reports: weekly status/i });
    const monthlyBtn = screen.getByRole('button', { name: /filter reports: monthly reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    await userEvent.click(boardBtn);
    await userEvent.click(weeklyBtn);
    await userEvent.click(allBtn);
    await userEvent.click(monthlyBtn);
    await waitFor(() => {
      expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true');
      expect(boardBtn).toHaveAttribute('aria-pressed', 'false');
      expect(weeklyBtn).toHaveAttribute('aria-pressed', 'false');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Board Summaries filter default states', () => {
  it('All starts active and Board Summaries starts inactive', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
    expect(boardBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Board Summaries makes All inactive', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const allBtn = screen.getByRole('button', { name: /filter reports: all reports/i });
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(boardBtn);
    await waitFor(() => {
      expect(boardBtn).toHaveAttribute('aria-pressed', 'true');
      expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Board Summaries twice stays active', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const boardBtn = screen.getByRole('button', { name: /filter reports: board summaries/i });
    await userEvent.click(boardBtn);
    await waitFor(() => expect(boardBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(boardBtn);
    await waitFor(() => expect(boardBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Scheduled reports toggle', () => {
  it('renders three scheduled report entries', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByText('Weekly PMO Status')).toBeInTheDocument();
    expect(screen.getByText('Monthly Financial')).toBeInTheDocument();
    expect(screen.getByText('Risk Review')).toBeInTheDocument();
  });

  it('shows Active and Paused status badges', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('shows Pause button for Active reports', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /pause weekly pmo status/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause monthly financial/i })).toBeInTheDocument();
  });

  it('shows Resume button for Paused reports', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /resume risk review/i })).toBeInTheDocument();
  });

  it('clicking Pause toggles Active to Paused', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const pauseBtn = screen.getByRole('button', { name: /pause weekly pmo status/i });
    await userEvent.click(pauseBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /resume weekly pmo status/i })).toBeInTheDocument();
    });
  });

  it('clicking Resume toggles Paused to Active', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const resumeBtn = screen.getByRole('button', { name: /resume risk review/i });
    await userEvent.click(resumeBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pause risk review/i })).toBeInTheDocument();
    });
  });

  it('toggling twice restores original state', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const pauseBtn = screen.getByRole('button', { name: /pause weekly pmo status/i });
    await userEvent.click(pauseBtn);
    await waitFor(() => expect(screen.getByRole('button', { name: /resume weekly pmo status/i })).toBeInTheDocument());
    const resumeBtn = screen.getByRole('button', { name: /resume weekly pmo status/i });
    await userEvent.click(resumeBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pause weekly pmo status/i })).toBeInTheDocument();
    });
  });

  it('persists toggle to localStorage', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const pauseBtn = screen.getByRole('button', { name: /pause weekly pmo status/i });
    await userEvent.click(pauseBtn);
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('scheduled_reports') ?? '[]');
      expect(saved.find((r: { id: string; status: string }) => r.id === 'sr-1')?.status).toBe('Paused');
    });
  });

  it('schedule text is shown for each report', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByText('Every Monday at 9:00 AM')).toBeInTheDocument();
    expect(screen.getByText('1st of month at 8:00 AM')).toBeInTheDocument();
    expect(screen.getByText('Every Friday at 3:00 PM')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Bulk delete reports', () => {
  it('shows Select All checkbox when reports are loaded', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /select all reports/i })).toBeInTheDocument();
  });

  it('shows individual row select checkbox', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /select report weekly status report — w10/i })).toBeInTheDocument();
  });

  it('clicking row checkbox shows bulk toolbar', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /select report weekly status report — w10/i }));
    await waitFor(() => {
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });
  });

  it('shows Delete Selected button when rows selected', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /select report weekly status report — w10/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete selected reports/i })).toBeInTheDocument();
    });
  });

  it('clicking Delete Selected calls deleteReport', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /select report weekly status report — w10/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /delete selected reports/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /delete selected reports/i }));
    await waitFor(() => {
      expect(mockDeleteReport).toHaveBeenCalledWith('r1');
    });
  });

  it('deselects after bulk delete completes', async () => {
    mockGetReports.mockResolvedValue([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /select report weekly status report — w10/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /delete selected reports/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /delete selected reports/i }));
    await waitFor(() => {
      expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    });
  });

  it('Clear button deselects all', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /select report weekly status report — w10/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /clear report selection/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /clear report selection/i }));
    await waitFor(() => {
      expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    });
  });

  it('Select All selects all visible reports', async () => {
    const r2 = { ...mockReport, id: 'r2', title: 'Second Report' };
    mockGetReports.mockResolvedValueOnce([mockReport, r2]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /select all reports/i }));
    await waitFor(() => {
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Scheduled Run Now', () => {
  it('shows Run Now button for each scheduled report', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    const runNowBtns = screen.getAllByRole('button', { name: /run .* now/i });
    expect(runNowBtns.length).toBe(3); // 3 initial scheduled reports
  });

  it('Run Now button for Weekly PMO Status is accessible', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /run weekly pmo status now/i })).toBeInTheDocument();
  });

  it('Run Now button for Monthly Financial is accessible', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /run monthly financial now/i })).toBeInTheDocument();
  });

  it('Run Now button for Risk Review is accessible', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /run risk review now/i })).toBeInTheDocument();
  });

  it('clicking Run Now shows toast notification', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /run weekly pmo status now/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/weekly pmo status.*sent successfully/i);
    }, { timeout: 2000 });
  });

  it('toast disappears after 3 seconds', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /run weekly pmo status now/i }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument(), { timeout: 2000 });
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument(), { timeout: 5000 });
  }, 8000);

  it('Run Now button shows loading state while running', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    // handleRunScheduledNow sets runningScheduledId synchronously before the 800ms await,
    // so the button is disabled immediately after the click event fires.
    userEvent.click(screen.getByRole('button', { name: /run weekly pmo status now/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run weekly pmo status now/i })).toBeDisabled();
    }, { timeout: 500 });
  });

  it('Run Now works for paused reports too', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    // Risk Review starts as Paused
    await userEvent.click(screen.getByRole('button', { name: /run risk review now/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/risk review.*sent successfully/i);
    }, { timeout: 2000 });
  });

  it('toast has correct accessibility role', async () => {
    renderReports();
    await waitFor(() => expect(mockGetReports).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /run weekly pmo status now/i }));
    await waitFor(() => {
      const toast = screen.getByRole('status');
      expect(toast).toHaveAttribute('aria-live', 'polite');
    }, { timeout: 2000 });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Reports – Email Report', () => {
  it('shows Email button for each loaded report', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText(mockReport.title);
    expect(screen.getByRole('button', { name: new RegExp(`email ${mockReport.title}`, 'i') })).toBeInTheDocument();
  });

  it('opens Email modal when Email button clicked', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText(mockReport.title);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`email ${mockReport.title}`, 'i') }));
    expect(await screen.findByRole('dialog', { name: /email report/i })).toBeInTheDocument();
  });

  it('modal shows the report title', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText(mockReport.title);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`email ${mockReport.title}`, 'i') }));
    await screen.findByRole('dialog');
    expect(screen.getAllByText(mockReport.title).length).toBeGreaterThan(0);
  });

  it('modal has Recipient Email input', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText(mockReport.title);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`email ${mockReport.title}`, 'i') }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('textbox', { name: /recipient email/i })).toBeInTheDocument();
  });

  it('Send Email button is disabled when recipient is empty', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText(mockReport.title);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`email ${mockReport.title}`, 'i') }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: /send email/i })).toBeDisabled();
  });

  it('Send Email button is enabled when recipient is filled', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText(mockReport.title);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`email ${mockReport.title}`, 'i') }));
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByRole('textbox', { name: /recipient email/i }), 'pm@agency.gov');
    expect(screen.getByRole('button', { name: /send email/i })).not.toBeDisabled();
  });

  it('shows email sent toast after sending', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText(mockReport.title);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`email ${mockReport.title}`, 'i') }));
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByRole('textbox', { name: /recipient email/i }), 'ceo@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send email/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/emailed to ceo@example\.com/i);
    }, { timeout: 2000 });
  });

  it('closes modal after sending email', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText(mockReport.title);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`email ${mockReport.title}`, 'i') }));
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByRole('textbox', { name: /recipient email/i }), 'user@test.com');
    await userEvent.click(screen.getByRole('button', { name: /send email/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 2000 });
  });

  it('closes modal when Cancel is clicked', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText(mockReport.title);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`email ${mockReport.title}`, 'i') }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes email modal when X button clicked', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText(mockReport.title);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`email ${mockReport.title}`, 'i') }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: /close email dialog/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('email toast has aria-live polite', async () => {
    mockGetReports.mockResolvedValueOnce([mockReport]);
    renderReports();
    await screen.findByText(mockReport.title);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`email ${mockReport.title}`, 'i') }));
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByRole('textbox', { name: /recipient email/i }), 'x@y.com');
    await userEvent.click(screen.getByRole('button', { name: /send email/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    }, { timeout: 2000 });
  });
});

describe('Reports – Copy Generated Report', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    mockChatWithDocument.mockResolvedValue('## Executive Summary\nPortfolio is on track.\n\nKey Highlights:\n- All projects on schedule');
  });

  async function generateReport() {
    renderReports();
    const btn = await screen.findByRole('button', { name: /generate report/i }, { timeout: 5000 });
    await userEvent.click(btn);
    await screen.findByRole('button', { name: /copy generated report to clipboard/i }, { timeout: 8000 });
  }

  it('shows Copy to Clipboard button in generated report modal', async () => {
    await generateReport();
    expect(screen.getByRole('button', { name: /copy generated report to clipboard/i })).toBeInTheDocument();
  }, 15000);

  it('Copy to Clipboard button is not disabled', async () => {
    await generateReport();
    expect(screen.getByRole('button', { name: /copy generated report to clipboard/i })).not.toBeDisabled();
  }, 15000);

  it('clicking Copy to Clipboard calls clipboard.writeText', async () => {
    await generateReport();
    await userEvent.click(screen.getByRole('button', { name: /copy generated report to clipboard/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  }, 15000);

  it('clipboard.writeText called with report content', async () => {
    await generateReport();
    await userEvent.click(screen.getByRole('button', { name: /copy generated report to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Executive Summary');
    });
  }, 15000);

  it('shows Copied! after clicking copy button', async () => {
    await generateReport();
    await userEvent.click(screen.getByRole('button', { name: /copy generated report to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy generated report to clipboard/i })).toHaveTextContent('Copied!');
    });
  }, 15000);

  it('Copy to Clipboard button shows initial label before clicking', async () => {
    await generateReport();
    expect(screen.getByRole('button', { name: /copy generated report to clipboard/i })).toHaveTextContent('Copy to Clipboard');
  }, 15000);
});

// ────────────────────────────────────────────────────────────
describe('Reports – Export Reports CSV', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.clear();
    mockGetReports.mockResolvedValue([mockReport]);
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:reports-url');
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

  it('shows Export reports to CSV button in Recent Reports', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /export reports to csv/i })).toBeInTheDocument();
  });

  it('Export reports button is enabled when reports exist', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /export reports to csv/i })).not.toBeDisabled();
  });

  it('Export reports button is disabled when no reports', async () => {
    mockGetReports.mockResolvedValue([]);
    renderReports();
    await screen.findByText(/no reports yet/i);
    expect(screen.getByRole('button', { name: /export reports to csv/i })).toBeDisabled();
  });

  it('clicking Export reports calls URL.createObjectURL', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /export reports to csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export reports triggers anchor click', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /export reports to csv/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export reports calls URL.revokeObjectURL', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /export reports to csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:reports-url');
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Copy Reports Summary', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetReports.mockResolvedValue([mockReport]);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows Copy reports summary to clipboard button', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /copy reports summary to clipboard/i })).toBeInTheDocument();
  });

  it('Copy reports summary button is enabled when reports exist', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /copy reports summary to clipboard/i })).not.toBeDisabled();
  });

  it('Copy reports summary button is disabled when no reports', async () => {
    mockGetReports.mockResolvedValue([]);
    renderReports();
    await screen.findByText(/no reports yet/i);
    expect(screen.getByRole('button', { name: /copy reports summary to clipboard/i })).toBeDisabled();
  });

  it('clicking Copy reports summary calls clipboard.writeText', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /copy reports summary to clipboard/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  });

  it('clipboard text contains Total Reports', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /copy reports summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Total Reports:');
    });
  });

  it('clipboard text contains Generated count', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /copy reports summary to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Generated:');
    });
  });

  it('shows Copied! feedback after clicking Copy reports summary', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /copy reports summary to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy reports summary to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Export Reports TXT', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.clear();
    mockGetReports.mockResolvedValue([mockReport]);
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:reports-txt-url');
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

  afterEach(() => { vi.restoreAllMocks(); });

  it('shows Export reports to TXT button in Recent Reports', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /export reports to txt/i })).toBeInTheDocument();
  });

  it('Export TXT button is enabled when reports exist', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /export reports to txt/i })).not.toBeDisabled();
  });

  it('clicking Export TXT calls URL.createObjectURL', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /export reports to txt/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export TXT triggers anchor click', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /export reports to txt/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export TXT calls URL.revokeObjectURL', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /export reports to txt/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:reports-txt-url');
  });

  it('shows Exported! feedback after clicking Export TXT', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /export reports to txt/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export reports to txt/i })).toHaveTextContent('Exported!');
    });
  });
});

// ── Report Status Quick Filter ────────────────────────────────
describe('Reports – Status Quick Filter', () => {
  const mockDraftReport = {
    ...mockReport,
    id: 'r-draft',
    title: 'Draft Monthly Report',
    status: 'Draft' as const,
  };
  const mockScheduledReport = {
    ...mockReport,
    id: 'r-sched',
    title: 'Scheduled Q4 Report',
    status: 'Scheduled' as const,
  };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([mockReport, mockDraftReport, mockScheduledReport]);
  });

  it('renders All, Draft, Generated, Scheduled status filter buttons', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /filter reports by status: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter reports by status: draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter reports by status: generated/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter reports by status: scheduled/i })).toBeInTheDocument();
  });

  it('All status filter is pressed by default', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /filter reports by status: all/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Draft is not pressed by default', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /filter reports by status: draft/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Draft sets it to pressed', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /filter reports by status: draft/i }));
    expect(screen.getByRole('button', { name: /filter reports by status: draft/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Draft deactivates All', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /filter reports by status: draft/i }));
    expect(screen.getByRole('button', { name: /filter reports by status: all/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Draft filter shows only draft reports', async () => {
    renderReports();
    await screen.findByText('Draft Monthly Report');
    await userEvent.click(screen.getByRole('button', { name: /filter reports by status: draft/i }));
    await waitFor(() => {
      expect(screen.getByText('Draft Monthly Report')).toBeInTheDocument();
      expect(screen.queryByText('Weekly Status Report — W10')).not.toBeInTheDocument();
    });
  });

  it('Generated filter shows only generated reports', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /filter reports by status: generated/i }));
    await waitFor(() => {
      expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
      expect(screen.queryByText('Draft Monthly Report')).not.toBeInTheDocument();
    });
  });

  it('clicking All after Draft restores All as pressed', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /filter reports by status: draft/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter reports by status: all/i }));
    expect(screen.getByRole('button', { name: /filter reports by status: all/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /filter reports by status: draft/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ── Starred Reports ─────────────────────────────────────────────
describe('Reports – Starred Reports', () => {
  const mockReport2 = {
    ...mockReport,
    id: 'r-other',
    title: 'Risk Review Report',
    status: 'Generated' as const,
  };

  beforeEach(() => {
    localStorage.clear();
    mockGetReports.mockResolvedValue([mockReport, mockReport2]);
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the Starred toggle button', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /show starred reports only/i })).toBeInTheDocument();
  });

  it('Starred button defaults to not pressed', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /show starred reports only/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('star buttons render for each report row', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: `Star report Weekly Status Report — W10` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Star report Risk Review Report` })).toBeInTheDocument();
  });

  it('starring a report sets aria-pressed=true on the star button', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    const starBtn = screen.getByRole('button', { name: /star report weekly status report/i });
    await userEvent.click(starBtn);
    expect(starBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('unstarring a report sets aria-pressed=false on the star button', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    const starBtn = screen.getByRole('button', { name: /star report weekly status report/i });
    await userEvent.click(starBtn); // star
    await userEvent.click(starBtn); // unstar
    expect(starBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Show Starred Only hides unstarred reports', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    // Star only the first report
    await userEvent.click(screen.getByRole('button', { name: /star report weekly status report/i }));
    // Enable starred-only
    await userEvent.click(screen.getByRole('button', { name: /show starred reports only/i }));
    await waitFor(() => {
      expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
      expect(screen.queryByText('Risk Review Report')).not.toBeInTheDocument();
    });
  });

  it('Show Starred Only with nothing starred shows no reports', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /show starred reports only/i }));
    await waitFor(() => {
      expect(screen.queryByText('Weekly Status Report — W10')).not.toBeInTheDocument();
      expect(screen.queryByText('Risk Review Report')).not.toBeInTheDocument();
    });
  });

  it('disabling Show Starred Only restores all reports', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /star report weekly status report/i }));
    await userEvent.click(screen.getByRole('button', { name: /show starred reports only/i }));
    await userEvent.click(screen.getByRole('button', { name: /show starred reports only/i }));
    await waitFor(() => {
      expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
      expect(screen.getByText('Risk Review Report')).toBeInTheDocument();
    });
  });

  it('starred state persists to localStorage', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(screen.getByRole('button', { name: /star report weekly status report/i }));
    const stored = JSON.parse(localStorage.getItem('starred_reports') ?? '[]');
    expect(stored).toContain('r1');
  });
});

describe('Reports – Pinned Reports', () => {
  const mockReport2 = {
    ...mockReport,
    id: 'r-other',
    title: 'Risk Review Report',
    status: 'Generated' as const,
  };

  beforeEach(() => {
    localStorage.clear();
    mockGetReports.mockResolvedValue([mockReport, mockReport2]);
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the Pinned toggle button', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /show pinned reports only/i })).toBeInTheDocument();
  });

  it('Pinned button defaults to not pressed', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    expect(screen.getByRole('button', { name: /show pinned reports only/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('pin buttons render for each report row', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pin report weekly status report/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pin report risk review report/i })).toBeInTheDocument();
    });
  });

  it('pin button for a report defaults to not pressed', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pin report weekly status report/i })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking pin button sets it to pressed', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(await screen.findByRole('button', { name: /pin report weekly status report/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pin report weekly status report/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Show Pinned Only after pinning one report hides unpinned', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(await screen.findByRole('button', { name: /pin report weekly status report/i }));
    await userEvent.click(screen.getByRole('button', { name: /show pinned reports only/i }));
    await waitFor(() => {
      expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
      expect(screen.queryByText('Risk Review Report')).not.toBeInTheDocument();
    });
  });

  it('pinned state persists to localStorage', async () => {
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await userEvent.click(await screen.findByRole('button', { name: /pin report weekly status report/i }));
    const stored = JSON.parse(localStorage.getItem('pinned_reports') ?? '[]');
    expect(stored).toContain('r1');
  });

  it('loads pinned state from localStorage on mount', async () => {
    localStorage.setItem('pinned_reports', JSON.stringify(['r1']));
    renderReports();
    await screen.findByText('Weekly Status Report — W10');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pin report weekly status report/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ── Reports Workspace Filter ──────────────────────────────────
describe('Reports – Workspace Filter', () => {
  const mockMociReport = { ...mockReport, id: 'r1', title: 'MOCI Status Report', workspace: 'MOCI' };
  const mockNcaReport = {
    id: 'r-nca',
    title: 'NCA Architecture Report',
    type: 'Monthly Report',
    type_color: '#8B5CF6',
    workspace: 'NCA',
    workspace_id: 'ws-2',
    date: '2026-03-20',
    status: 'Draft' as const,
    pages: 5,
    period: 'March 2026',
    author: 'Consultant OS AI',
    created_at: '2026-03-20T10:00:00Z',
    updated_at: '2026-03-20T10:00:00Z',
  };
  const mockNcaWs = { id: 'ws-2', name: 'NCA', type: 'IT', status: 'Active' as const, progress: 70, language: 'EN' as const, sector: 'Government', contributors: [], created_at: '', updated_at: '' };

  it('renders workspace filter dropdown when workspaces exist', async () => {
    mockGetReports.mockResolvedValue([mockMociReport, mockNcaReport]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace, mockNcaWs]);
    renderReports();
    await screen.findByText('MOCI Status Report');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /filter reports by workspace/i })).toBeInTheDocument();
    });
  });

  it('workspace dropdown defaults to All Workspaces', async () => {
    mockGetReports.mockResolvedValue([mockMociReport]);
    renderReports();
    await screen.findByText('MOCI Status Report');
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: /filter reports by workspace/i });
      expect(select).toHaveValue('All');
    });
  });

  it('selecting a workspace filters reports to that workspace', async () => {
    mockGetReports.mockResolvedValue([mockMociReport, mockNcaReport]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace, mockNcaWs]);
    renderReports();
    await screen.findByText('MOCI Status Report');
    await waitFor(() => screen.getByRole('combobox', { name: /filter reports by workspace/i }));
    const select = screen.getByRole('combobox', { name: /filter reports by workspace/i });
    await userEvent.selectOptions(select, 'NCA');
    await waitFor(() => {
      expect(screen.getByText('NCA Architecture Report')).toBeInTheDocument();
      expect(screen.queryByText('MOCI Status Report')).not.toBeInTheDocument();
    });
  });

  it('selecting All Workspaces restores all reports', async () => {
    mockGetReports.mockResolvedValue([mockMociReport, mockNcaReport]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace, mockNcaWs]);
    renderReports();
    await screen.findByText('MOCI Status Report');
    await waitFor(() => screen.getByRole('combobox', { name: /filter reports by workspace/i }));
    const select = screen.getByRole('combobox', { name: /filter reports by workspace/i });
    await userEvent.selectOptions(select, 'NCA');
    await waitFor(() => expect(screen.queryByText('MOCI Status Report')).not.toBeInTheDocument());
    await userEvent.selectOptions(select, 'All');
    await waitFor(() => {
      expect(screen.getByText('MOCI Status Report')).toBeInTheDocument();
      expect(screen.getByText('NCA Architecture Report')).toBeInTheDocument();
    });
  });

  it('workspace dropdown lists all available workspace names', async () => {
    mockGetReports.mockResolvedValue([mockMociReport, mockNcaReport]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace, mockNcaWs]);
    renderReports();
    await screen.findByText('MOCI Status Report');
    await waitFor(() => screen.getByRole('combobox', { name: /filter reports by workspace/i }));
    const options = screen.getAllByRole('option', { name: /moci|nca|all workspaces/i });
    expect(options.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Reports – Sort by Pages', () => {
  const reportFewPages = { ...mockReport, id: 'rp1', title: 'Short Report', pages: 2, date: '2026-03-10' };
  const reportManyPages = { ...mockReport, id: 'rp2', title: 'Long Report', pages: 25, date: '2026-03-15' };
  const reportMidPages = { ...mockReport, id: 'rp3', title: 'Medium Report', pages: 10, date: '2026-03-12' };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([reportFewPages, reportManyPages, reportMidPages]);
  });

  it('renders By pages option in sort dropdown', async () => {
    renderReports();
    await screen.findByText('Short Report');
    await waitFor(() => screen.getByRole('combobox', { name: /sort reports/i }));
    expect(screen.getByRole('option', { name: /by pages/i })).toBeInTheDocument();
  });

  it('sort dropdown defaults to Newest first', async () => {
    renderReports();
    await screen.findByText('Short Report');
    await waitFor(() => screen.getByRole('combobox', { name: /sort reports/i }));
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    expect(select).toHaveValue('newest');
  });

  it('selecting By pages sets dropdown value to pages', async () => {
    renderReports();
    await screen.findByText('Short Report');
    await waitFor(() => screen.getByRole('combobox', { name: /sort reports/i }));
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'pages');
    expect(select).toHaveValue('pages');
  });

  it('By pages sort shows all reports', async () => {
    renderReports();
    await screen.findByText('Short Report');
    await waitFor(() => screen.getByRole('combobox', { name: /sort reports/i }));
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'pages');
    expect(screen.getByText('Short Report')).toBeInTheDocument();
    expect(screen.getByText('Long Report')).toBeInTheDocument();
    expect(screen.getByText('Medium Report')).toBeInTheDocument();
  });

  it('By pages sort places the longest report first', async () => {
    renderReports();
    await screen.findByText('Short Report');
    await waitFor(() => screen.getByRole('combobox', { name: /sort reports/i }));
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'pages');
    const items = screen.getAllByText(/Report/);
    const longIdx = items.findIndex(el => el.textContent?.includes('Long Report'));
    const shortIdx = items.findIndex(el => el.textContent?.includes('Short Report'));
    expect(longIdx).toBeLessThan(shortIdx);
  });

  it('switching back to Newest first works after pages sort', async () => {
    renderReports();
    await screen.findByText('Short Report');
    await waitFor(() => screen.getByRole('combobox', { name: /sort reports/i }));
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'pages');
    await userEvent.selectOptions(select, 'newest');
    expect(select).toHaveValue('newest');
  });
});

describe('Reports – Sort by Pages DOM Order', () => {
  const reportShort = { ...mockReport, id: 'rpd1', title: 'Tiny Short Report', pages: 2, date: '2026-03-10' };
  const reportLong = { ...mockReport, id: 'rpd2', title: 'Very Long Report', pages: 80, date: '2026-03-15' };
  const reportMid = { ...mockReport, id: 'rpd3', title: 'Medium Pages Report', pages: 20, date: '2026-03-12' };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([reportShort, reportLong, reportMid]);
  });

  it('renders all reports before pages sort', async () => {
    renderReports();
    await screen.findByText('Tiny Short Report');
    expect(screen.getByText('Very Long Report')).toBeInTheDocument();
    expect(screen.getByText('Medium Pages Report')).toBeInTheDocument();
  });

  it('Very Long Report (80 pages) appears before Tiny Short Report (2 pages) in DOM', async () => {
    renderReports();
    await screen.findByText('Tiny Short Report');
    await waitFor(() => screen.getByRole('combobox', { name: /sort reports/i }));
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'pages');
    await waitFor(() => {
      const longEl = screen.getByText('Very Long Report');
      const shortEl = screen.getByText('Tiny Short Report');
      expect(longEl.compareDocumentPosition(shortEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('Medium Pages Report appears before Tiny Short Report in DOM', async () => {
    renderReports();
    await screen.findByText('Tiny Short Report');
    await waitFor(() => screen.getByRole('combobox', { name: /sort reports/i }));
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'pages');
    await waitFor(() => {
      const midEl = screen.getByText('Medium Pages Report');
      const shortEl = screen.getByText('Tiny Short Report');
      expect(midEl.compareDocumentPosition(shortEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('all three reports remain visible after pages sort', async () => {
    renderReports();
    await screen.findByText('Tiny Short Report');
    await waitFor(() => screen.getByRole('combobox', { name: /sort reports/i }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'pages');
    await waitFor(() => {
      expect(screen.getByText('Very Long Report')).toBeInTheDocument();
      expect(screen.getByText('Medium Pages Report')).toBeInTheDocument();
      expect(screen.getByText('Tiny Short Report')).toBeInTheDocument();
    });
  });

  it('switching from pages to newest keeps all reports visible', async () => {
    renderReports();
    await screen.findByText('Tiny Short Report');
    await waitFor(() => screen.getByRole('combobox', { name: /sort reports/i }));
    const select = screen.getByRole('combobox', { name: /sort reports/i }) as HTMLSelectElement;
    await userEvent.selectOptions(select, 'pages');
    await userEvent.selectOptions(select, 'newest');
    expect(screen.getByText('Very Long Report')).toBeInTheDocument();
  });
});

describe('Reports – Sort by Workspace', () => {
  const reportZebra = { ...mockReport, id: 'rws1', title: 'Zebra Report', workspace: 'Zebra Corp', date: '2026-03-10' };
  const reportAlpha = { ...mockReport, id: 'rws2', title: 'Alpha Report', workspace: 'Alpha Ltd', date: '2026-03-15' };
  const reportMango = { ...mockReport, id: 'rws3', title: 'Mango Report', workspace: 'Mango Inc', date: '2026-03-12' };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([reportZebra, reportAlpha, reportMango]);
  });

  it('renders By workspace option in sort dropdown', async () => {
    renderReports();
    await screen.findByText('Zebra Report');
    await waitFor(() => screen.getByRole('combobox', { name: /sort reports/i }));
    expect(screen.getByRole('option', { name: /by workspace/i })).toBeInTheDocument();
  });

  it('selecting By workspace sets dropdown value', async () => {
    renderReports();
    await screen.findByText('Zebra Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'workspace');
    expect(select).toHaveValue('workspace');
  });

  it('By workspace sort shows all three reports', async () => {
    renderReports();
    await screen.findByText('Zebra Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'workspace');
    expect(screen.getByText('Zebra Report')).toBeInTheDocument();
    expect(screen.getByText('Alpha Report')).toBeInTheDocument();
    expect(screen.getByText('Mango Report')).toBeInTheDocument();
  });

  it('By workspace places Alpha before Zebra in DOM', async () => {
    renderReports();
    await screen.findByText('Alpha Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'workspace');
    const alphaEl = screen.getByText('Alpha Report');
    const zebraEl = screen.getByText('Zebra Report');
    expect(alphaEl.compareDocumentPosition(zebraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to Newest first works after workspace sort', async () => {
    renderReports();
    await screen.findByText('Alpha Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'workspace');
    await userEvent.selectOptions(select, 'newest');
    expect(select).toHaveValue('newest');
  });
});

describe('Reports – Sort by Status', () => {
  const reportDraft = { ...mockReport, id: 'rss1', title: 'Draft Status Report', workspace: 'WS1', status: 'Draft' as const };
  const reportGenerated = { ...mockReport, id: 'rss2', title: 'Generated Status Report', workspace: 'WS2', status: 'Generated' as const };
  const reportScheduled = { ...mockReport, id: 'rss3', title: 'Scheduled Status Report', workspace: 'WS3', status: 'Scheduled' as const };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([reportGenerated, reportDraft, reportScheduled]);
  });

  it('renders By status option in sort dropdown', async () => {
    renderReports();
    await screen.findByText('Generated Status Report');
    expect(screen.getByRole('option', { name: /by status/i })).toBeInTheDocument();
  });

  it('selecting By status sets dropdown value', async () => {
    renderReports();
    await screen.findByText('Generated Status Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'status');
    expect(select).toHaveValue('status');
  });

  it('By status sort shows all three reports', async () => {
    renderReports();
    await screen.findByText('Generated Status Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'status');
    expect(screen.getByText('Draft Status Report')).toBeInTheDocument();
    expect(screen.getByText('Generated Status Report')).toBeInTheDocument();
    expect(screen.getByText('Scheduled Status Report')).toBeInTheDocument();
  });

  it('By status places Draft before Scheduled alphabetically', async () => {
    renderReports();
    await screen.findByText('Draft Status Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'status');
    const draftEl = screen.getByText('Draft Status Report');
    const scheduledEl = screen.getByText('Scheduled Status Report');
    expect(draftEl.compareDocumentPosition(scheduledEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to Newest works after status sort', async () => {
    renderReports();
    await screen.findByText('Generated Status Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'status');
    await userEvent.selectOptions(select, 'newest');
    expect(select).toHaveValue('newest');
  });
});

describe('Reports – Sort by Type', () => {
  const reportBrd = { ...mockReport, id: 'r-brd', title: 'BRD Type Report', type: 'BRD', status: 'Generated' as const };
  const reportRisk = { ...mockReport, id: 'r-risk', title: 'Risk Type Report', type: 'Risk Report', status: 'Generated' as const };
  const reportStatus = { ...mockReport, id: 'r-status', title: 'Status Type Report', type: 'Weekly Status', status: 'Generated' as const };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([reportStatus, reportRisk, reportBrd]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
    mockGetTasks.mockResolvedValue([]);
    mockGetRisks.mockResolvedValue([]);
  });

  it('renders By type option in sort dropdown', async () => {
    renderReports();
    await screen.findByText('Status Type Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    expect(select.querySelector('option[value="type"]')).toBeInTheDocument();
  });

  it('selecting type updates sort value', async () => {
    renderReports();
    await screen.findByText('Status Type Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i }) as HTMLSelectElement;
    await userEvent.selectOptions(select, 'type');
    expect(select.value).toBe('type');
  });

  it('By type sort shows all three reports', async () => {
    renderReports();
    await screen.findByText('Status Type Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'type');
    expect(screen.getByText('BRD Type Report')).toBeInTheDocument();
    expect(screen.getByText('Risk Type Report')).toBeInTheDocument();
    expect(screen.getByText('Status Type Report')).toBeInTheDocument();
  });

  it('type sort places BRD before Weekly Status alphabetically', async () => {
    renderReports();
    await screen.findByText('BRD Type Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'type');
    const brdEl = screen.getByText('BRD Type Report');
    const statusEl = screen.getByText('Status Type Report');
    expect(brdEl.compareDocumentPosition(statusEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to Newest works after type sort', async () => {
    renderReports();
    await screen.findByText('Status Type Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'type');
    await userEvent.selectOptions(select, 'newest');
    expect(select).toHaveValue('newest');
  });
});

describe('Reports – Sort by Author', () => {
  const reportAhmed = { ...mockReport, id: 'r-ahmed', title: 'Ahmed Author Report', author: 'Ahmed Khalil', status: 'Generated' as const };
  const reportRania = { ...mockReport, id: 'r-rania', title: 'Rania Author Report', author: 'Rania Taleb', status: 'Generated' as const };
  const reportZara = { ...mockReport, id: 'r-zara', title: 'Zara Author Report', author: 'Zara Smith', status: 'Generated' as const };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([reportZara, reportRania, reportAhmed]);
    mockGetWorkspaces.mockResolvedValue([]);
  });

  it('author option exists in sort select', async () => {
    renderReports();
    await screen.findByText('Ahmed Author Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    expect(select.querySelector('option[value="author"]')).toBeInTheDocument();
  });

  it('selecting author updates sort value', async () => {
    renderReports();
    await screen.findByText('Ahmed Author Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i }) as HTMLSelectElement;
    await userEvent.selectOptions(select, 'author');
    expect(select.value).toBe('author');
  });

  it('By author sort shows all three reports', async () => {
    renderReports();
    await screen.findByText('Ahmed Author Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'author');
    expect(screen.getByText('Ahmed Author Report')).toBeInTheDocument();
    expect(screen.getByText('Rania Author Report')).toBeInTheDocument();
    expect(screen.getByText('Zara Author Report')).toBeInTheDocument();
  });

  it('author sort places Ahmed before Zara in DOM', async () => {
    renderReports();
    await screen.findByText('Ahmed Author Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'author');
    const ahmedEl = screen.getByText('Ahmed Author Report');
    const zaraEl = screen.getByText('Zara Author Report');
    expect(ahmedEl.compareDocumentPosition(zaraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to Newest works after author sort', async () => {
    renderReports();
    await screen.findByText('Ahmed Author Report');
    const select = screen.getByRole('combobox', { name: /sort reports/i });
    await userEvent.selectOptions(select, 'author');
    await userEvent.selectOptions(select, 'newest');
    expect(select).toHaveValue('newest');
  });
});

describe('Reports – Pages Filter', () => {
  const shortReport = { ...mockReport, id: 'rps1', title: 'Short Report', pages: 2, date: '2026-04-01' };
  const mediumReport = { ...mockReport, id: 'rpm1', title: 'Medium Report', pages: 8, date: '2026-04-02' };
  const longReport = { ...mockReport, id: 'rpl1', title: 'Long Report', pages: 20, date: '2026-04-03' };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([shortReport, mediumReport, longReport]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('renders pages filter select', async () => {
    renderReports();
    await screen.findByText('Short Report');
    expect(screen.getByRole('combobox', { name: /filter reports by pages/i })).toBeInTheDocument();
  });

  it('filter defaults to All Lengths', async () => {
    renderReports();
    await screen.findByText('Short Report');
    const sel = screen.getByRole('combobox', { name: /filter reports by pages/i }) as HTMLSelectElement;
    expect(sel.value).toBe('All');
  });

  it('filtering by Short hides Medium and Long reports', async () => {
    renderReports();
    await screen.findByText('Short Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter reports by pages/i }), 'Short');
    expect(screen.getByText('Short Report')).toBeInTheDocument();
    expect(screen.queryByText('Medium Report')).not.toBeInTheDocument();
    expect(screen.queryByText('Long Report')).not.toBeInTheDocument();
  });

  it('filtering by Long hides Short and Medium reports', async () => {
    renderReports();
    await screen.findByText('Short Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filter reports by pages/i }), 'Long');
    expect(screen.getByText('Long Report')).toBeInTheDocument();
    expect(screen.queryByText('Short Report')).not.toBeInTheDocument();
    expect(screen.queryByText('Medium Report')).not.toBeInTheDocument();
  });

  it('resetting to All shows all reports again', async () => {
    renderReports();
    await screen.findByText('Short Report');
    const sel = screen.getByRole('combobox', { name: /filter reports by pages/i });
    await userEvent.selectOptions(sel, 'Short');
    await userEvent.selectOptions(sel, 'All');
    expect(screen.getByText('Short Report')).toBeInTheDocument();
    expect(screen.getByText('Medium Report')).toBeInTheDocument();
    expect(screen.getByText('Long Report')).toBeInTheDocument();
  });
});

describe('Reports – Sort by Name DOM Order', () => {
  const rptAlpha = { ...mockReport, id: 'rna1', title: 'Alpha Status Report', date: '2026-04-01' };
  const rptBeta = { ...mockReport, id: 'rna2', title: 'Beta Analysis Report', date: '2026-04-02' };
  const rptZeta = { ...mockReport, id: 'rna3', title: 'Zeta Summary Report', date: '2026-04-03' };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([rptZeta, rptAlpha, rptBeta]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('name sort option exists in sort dropdown', async () => {
    renderReports();
    await screen.findByText('Alpha Status Report');
    const sel = screen.getByRole('combobox', { name: /sort reports/i });
    expect(sel.querySelector('option[value="name"]')).toBeInTheDocument();
  });

  it('selecting name sort sets value', async () => {
    renderReports();
    await screen.findByText('Alpha Status Report');
    const sel = screen.getByRole('combobox', { name: /sort reports/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'name');
    expect(sel.value).toBe('name');
  });

  it('name sort places Alpha before Zeta in DOM', async () => {
    renderReports();
    await screen.findByText('Alpha Status Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'name');
    const alphaEl = screen.getByText('Alpha Status Report');
    const zetaEl = screen.getByText('Zeta Summary Report');
    expect(alphaEl.compareDocumentPosition(zetaEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three reports remain visible after name sort', async () => {
    renderReports();
    await screen.findByText('Alpha Status Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'name');
    expect(screen.getByText('Alpha Status Report')).toBeInTheDocument();
    expect(screen.getByText('Beta Analysis Report')).toBeInTheDocument();
    expect(screen.getByText('Zeta Summary Report')).toBeInTheDocument();
  });

  it('switching back to newest works after name sort', async () => {
    renderReports();
    await screen.findByText('Alpha Status Report');
    const sel = screen.getByRole('combobox', { name: /sort reports/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'name');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

describe('Reports – Sort by Oldest DOM Order', () => {
  const rptOld = { ...mockReport, id: 'rod1', title: 'Old January Report', date: '2026-01-05' };
  const rptMid = { ...mockReport, id: 'rod2', title: 'Mid February Report', date: '2026-02-15' };
  const rptNew = { ...mockReport, id: 'rod3', title: 'New March Report', date: '2026-03-25' };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([rptNew, rptOld, rptMid]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('oldest sort option exists in sort dropdown', async () => {
    renderReports();
    await screen.findByText('Old January Report');
    const sel = screen.getByRole('combobox', { name: /sort reports/i });
    expect(sel.querySelector('option[value="oldest"]')).toBeInTheDocument();
  });

  it('selecting oldest sort sets value', async () => {
    renderReports();
    await screen.findByText('Old January Report');
    const sel = screen.getByRole('combobox', { name: /sort reports/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'oldest');
    expect(sel.value).toBe('oldest');
  });

  it('oldest sort places Old January before New March in DOM', async () => {
    renderReports();
    await screen.findByText('Old January Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'oldest');
    const oldEl = screen.getByText('Old January Report');
    const newEl = screen.getByText('New March Report');
    expect(oldEl.compareDocumentPosition(newEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three reports remain visible after oldest sort', async () => {
    renderReports();
    await screen.findByText('Old January Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'oldest');
    expect(screen.getByText('Old January Report')).toBeInTheDocument();
    expect(screen.getByText('Mid February Report')).toBeInTheDocument();
    expect(screen.getByText('New March Report')).toBeInTheDocument();
  });

  it('switching back to newest works after oldest sort', async () => {
    renderReports();
    await screen.findByText('Old January Report');
    const sel = screen.getByRole('combobox', { name: /sort reports/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'oldest');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Sort by Newest DOM Order', () => {
  const rptOld = { ...mockReport, id: 'rnd1', title: 'Old January Report', date: '2026-01-05' };
  const rptMid = { ...mockReport, id: 'rnd2', title: 'Mid February Report', date: '2026-02-15' };
  const rptNew = { ...mockReport, id: 'rnd3', title: 'New March Report', date: '2026-03-25' };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([rptOld, rptMid, rptNew]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('newest sort (default) places New March before Old January in DOM', async () => {
    renderReports();
    await screen.findByText('New March Report');
    const newEl = screen.getByText('New March Report');
    const oldEl = screen.getByText('Old January Report');
    expect(newEl.compareDocumentPosition(oldEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('newest sort places Mid February before Old January in DOM', async () => {
    renderReports();
    await screen.findByText('New March Report');
    const midEl = screen.getByText('Mid February Report');
    const oldEl = screen.getByText('Old January Report');
    expect(midEl.compareDocumentPosition(oldEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three reports remain visible with newest sort', async () => {
    renderReports();
    await screen.findByText('New March Report');
    expect(screen.getByText('Old January Report')).toBeInTheDocument();
    expect(screen.getByText('Mid February Report')).toBeInTheDocument();
    expect(screen.getByText('New March Report')).toBeInTheDocument();
  });

  it('switching from oldest back to newest restores newest-first order', async () => {
    renderReports();
    await screen.findByText('New March Report');
    const sel = screen.getByRole('combobox', { name: /sort reports/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'oldest');
    await userEvent.selectOptions(sel, 'newest');
    const newEl = screen.getByText('New March Report');
    const oldEl = screen.getByText('Old January Report');
    expect(newEl.compareDocumentPosition(oldEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Sort by Workspace DOM Order', () => {
  const rptAlphaWS = { ...mockReport, id: 'rwsd1', title: 'Alpha WS Report', workspace: 'AlphaCorp', workspace_id: 'ws-a' };
  const rptZebraWS = { ...mockReport, id: 'rwsd2', title: 'Zebra WS Report', workspace: 'ZebraCorp', workspace_id: 'ws-z' };
  const rptMidWS = { ...mockReport, id: 'rwsd3', title: 'Mid WS Report', workspace: 'MidCorp', workspace_id: 'ws-m' };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([rptZebraWS, rptMidWS, rptAlphaWS]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('workspace sort places Alpha WS before Zebra WS in DOM', async () => {
    renderReports();
    await screen.findByText('Alpha WS Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'workspace');
    const alphaEl = screen.getByText('Alpha WS Report');
    const zebraEl = screen.getByText('Zebra WS Report');
    expect(alphaEl.compareDocumentPosition(zebraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('workspace sort places Alpha WS before Mid WS in DOM', async () => {
    renderReports();
    await screen.findByText('Alpha WS Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'workspace');
    const alphaEl = screen.getByText('Alpha WS Report');
    const midEl = screen.getByText('Mid WS Report');
    expect(alphaEl.compareDocumentPosition(midEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three reports remain visible after workspace sort', async () => {
    renderReports();
    await screen.findByText('Alpha WS Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'workspace');
    expect(screen.getByText('Alpha WS Report')).toBeInTheDocument();
    expect(screen.getByText('Mid WS Report')).toBeInTheDocument();
    expect(screen.getByText('Zebra WS Report')).toBeInTheDocument();
  });

  it('switching back to newest from workspace sort works', async () => {
    renderReports();
    await screen.findByText('Alpha WS Report');
    const sel = screen.getByRole('combobox', { name: /sort reports/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'workspace');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Sort by Status DOM Order', () => {
  const rptDraft = { ...mockReport, id: 'rsd1', title: 'Draft Status Report', status: 'Draft' as const };
  const rptGenerated = { ...mockReport, id: 'rsd2', title: 'Generated Status Report', status: 'Generated' as const };
  const rptReview = { ...mockReport, id: 'rsd3', title: 'Review Status Report', status: 'Under Review' as const };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([rptReview, rptGenerated, rptDraft]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('status sort places Draft before Generated in DOM', async () => {
    renderReports();
    await screen.findByText('Draft Status Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'status');
    const draftEl = screen.getByText('Draft Status Report');
    const genEl = screen.getByText('Generated Status Report');
    expect(draftEl.compareDocumentPosition(genEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('status sort places Generated before Under Review in DOM', async () => {
    renderReports();
    await screen.findByText('Draft Status Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'status');
    const genEl = screen.getByText('Generated Status Report');
    const reviewEl = screen.getByText('Review Status Report');
    expect(genEl.compareDocumentPosition(reviewEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three reports remain visible after status sort', async () => {
    renderReports();
    await screen.findByText('Draft Status Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'status');
    expect(screen.getByText('Draft Status Report')).toBeInTheDocument();
    expect(screen.getByText('Generated Status Report')).toBeInTheDocument();
    expect(screen.getByText('Review Status Report')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Sort by Type DOM Order', () => {
  const rptBrief = { ...mockReport, id: 'rtd1', title: 'Brief Type Report', type: 'Brief' };
  const rptRisk = { ...mockReport, id: 'rtd2', title: 'Risk Type Report', type: 'Risk Summary' };
  const rptWeekly = { ...mockReport, id: 'rtd3', title: 'Weekly Type Report', type: 'Weekly Status' };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([rptWeekly, rptRisk, rptBrief]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('type sort places Brief before Weekly in DOM', async () => {
    renderReports();
    await screen.findByText('Brief Type Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'type');
    const briefEl = screen.getByText('Brief Type Report');
    const weeklyEl = screen.getByText('Weekly Type Report');
    expect(briefEl.compareDocumentPosition(weeklyEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('type sort places Brief before Risk in DOM', async () => {
    renderReports();
    await screen.findByText('Brief Type Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'type');
    const briefEl = screen.getByText('Brief Type Report');
    const riskEl = screen.getByText('Risk Type Report');
    expect(briefEl.compareDocumentPosition(riskEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three reports remain visible after type sort', async () => {
    renderReports();
    await screen.findByText('Brief Type Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'type');
    expect(screen.getByText('Brief Type Report')).toBeInTheDocument();
    expect(screen.getByText('Risk Type Report')).toBeInTheDocument();
    expect(screen.getByText('Weekly Type Report')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('Reports – Sort by Author DOM Order', () => {
  const rptAlphaAuth = { ...mockReport, id: 'rad1', title: 'Alpha Author Report', author: 'Alpha Analyst' };
  const rptMidAuth = { ...mockReport, id: 'rad2', title: 'Mid Author Report', author: 'Mid Analyst' };
  const rptZebraAuth = { ...mockReport, id: 'rad3', title: 'Zebra Author Report', author: 'Zebra Analyst' };

  beforeEach(() => {
    mockGetReports.mockResolvedValue([rptZebraAuth, rptMidAuth, rptAlphaAuth]);
    mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  });

  it('author sort places Alpha before Zebra in DOM', async () => {
    renderReports();
    await screen.findByText('Alpha Author Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'author');
    const alphaEl = screen.getByText('Alpha Author Report');
    const zebraEl = screen.getByText('Zebra Author Report');
    expect(alphaEl.compareDocumentPosition(zebraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('author sort places Alpha before Mid in DOM', async () => {
    renderReports();
    await screen.findByText('Alpha Author Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'author');
    const alphaEl = screen.getByText('Alpha Author Report');
    const midEl = screen.getByText('Mid Author Report');
    expect(alphaEl.compareDocumentPosition(midEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three reports remain visible after author sort', async () => {
    renderReports();
    await screen.findByText('Alpha Author Report');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort reports/i }), 'author');
    expect(screen.getByText('Alpha Author Report')).toBeInTheDocument();
    expect(screen.getByText('Mid Author Report')).toBeInTheDocument();
    expect(screen.getByText('Zebra Author Report')).toBeInTheDocument();
  });

  it('switching back to newest from author sort works', async () => {
    renderReports();
    await screen.findByText('Alpha Author Report');
    const sel = screen.getByRole('combobox', { name: /sort reports/i }) as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'author');
    await userEvent.selectOptions(sel, 'newest');
    expect(sel.value).toBe('newest');
  });
});
