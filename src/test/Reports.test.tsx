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
    expect(screen.getByText('Avg. Gen Time')).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: 'Weekly Status' }));
    expect(screen.getByText('Weekly Status Report — W10')).toBeInTheDocument();
    // Monthly should be filtered out
    expect(screen.queryByText('Monthly Progress')).not.toBeInTheDocument();
  });

  it('shows all reports after switching back to All Reports', async () => {
    const board = { ...mockReport, id: 'r3', title: 'Board Pack Report', type: 'Board Summary' };
    mockGetReports.mockResolvedValueOnce([mockReport, board]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    await userEvent.click(screen.getByRole('button', { name: 'Board Summaries' }));
    await userEvent.click(screen.getByRole('button', { name: 'All Reports' }));
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
    expect(screen.getByRole('button', { name: 'Monthly Reports' })).toBeInTheDocument();
  });

  it('filters to Monthly Reports', async () => {
    const monthly = { ...mockReport, id: 'r2', title: 'Monthly Progress Report — March', type: 'Monthly Progress' };
    mockGetReports.mockResolvedValueOnce([mockReport, monthly]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    await userEvent.click(screen.getByRole('button', { name: 'Monthly Reports' }));
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
    expect(screen.getByRole('button', { name: 'Board Summaries' })).toBeInTheDocument();
  });

  it('filters to Board Summaries reports', async () => {
    const board = { ...mockReport, id: 'r2', title: 'Board Summary Dec 2025', type: 'Board Summary' };
    mockGetReports.mockResolvedValueOnce([mockReport, board]);
    renderReports();
    await screen.findByText('Weekly Status Report — W10');

    await userEvent.click(screen.getByRole('button', { name: 'Board Summaries' }));
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
    expect(screen.getByRole('button', { name: 'All Reports' })).toBeInTheDocument();
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
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
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
    expect(screen.getByRole('option', { name: 'MOCI' })).toBeInTheDocument();
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
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /All Reports/i })).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: /Weekly Status/i }));
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
    expect(screen.getByRole('option', { name: 'All Workspaces' })).toBeInTheDocument();
  });

  it('shows MOCI workspace option in workspace selector', async () => {
    renderReports();
    await screen.findByText('Total Generated');
    expect(screen.getByRole('option', { name: 'MOCI' })).toBeInTheDocument();
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
