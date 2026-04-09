import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ── Mocks ────────────────────────────────────────────────────
const { mockChatWithDocument, mockGetAutomation, mockGetWorkspaces, mockGetAutomationRuns, mockCreateAutomationRun, mockUpdateAutomationRun, mockCreateAutomationRunSection } = vi.hoisted(() => ({
  mockChatWithDocument: vi.fn(),
  mockGetAutomation: vi.fn(),
  mockGetWorkspaces: vi.fn(),
  mockGetAutomationRuns: vi.fn(),
  mockCreateAutomationRun: vi.fn(),
  mockUpdateAutomationRun: vi.fn(),
  mockCreateAutomationRunSection: vi.fn(),
}));

vi.mock('../hooks/useLayout', () => ({
  useLayout: () => ({ width: 1200, isMobile: false, isTablet: false }),
}));

vi.mock('../lib/openrouter', () => ({
  chatWithDocument: mockChatWithDocument,
}));

vi.mock('../lib/db', () => ({
  getAutomation: mockGetAutomation,
  getWorkspaces: mockGetWorkspaces,
  getAutomationRuns: mockGetAutomationRuns,
  createAutomationRun: mockCreateAutomationRun,
  updateAutomationRun: mockUpdateAutomationRun,
  createAutomationRunSection: mockCreateAutomationRunSection,
  upsertDocument: vi.fn().mockResolvedValue({}),
}));

// Mock Supabase client used for prompt_templates
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      upsert: () => Promise.resolve({ error: null }),
    }),
  },
}));

const mockAutomation = {
  id: 'auto-1',
  name: 'Meeting Minutes Generator',
  category: 'Meetings',
  category_color: '#8B5CF6',
  status: 'Active',
  last_run: '2h ago',
  run_count: 42,
  success_rate: 98,
  description: 'Generates meeting minutes from transcript',
  input_type: 'Audio',
  output_type: 'Minutes',
  starred: false,
  created_at: '',
  updated_at: '',
};

const mockWorkspace = {
  id: 'ws-1',
  name: 'NCA Digital Transformation',
  client: 'NCA',
  sector: 'Government',
  sector_color: '#0EA5E9',
  type: 'Client' as const,
  language: 'EN' as const,
  progress: 60,
  status: 'Active' as const,
  docs_count: 10,
  meetings_count: 5,
  tasks_count: 8,
  contributors: [],
  last_activity: '2h ago',
  description: '',
  created_at: '',
  updated_at: '',
};

import AutomationBuilder from '../screens/AutomationBuilder';

function renderBuilder(id = 'auto-1') {
  return render(
    <MemoryRouter initialEntries={[`/automations/${id}`]}>
      <Routes>
        <Route path="/automations/:id" element={<AutomationBuilder />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockChatWithDocument.mockResolvedValue('Generated automation output text');
  mockGetAutomation.mockResolvedValue(mockAutomation);
  mockGetWorkspaces.mockResolvedValue([mockWorkspace]);
  mockGetAutomationRuns.mockResolvedValue([]);
  mockCreateAutomationRun.mockResolvedValue({ id: 'run-1', status: 'running' });
  mockUpdateAutomationRun.mockResolvedValue({ id: 'run-1', status: 'completed' });
  mockCreateAutomationRunSection.mockResolvedValue({ id: 'sec-1' });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Render', () => {
  it('renders automation name in header', async () => {
    renderBuilder('auto-1');
    expect(await screen.findByText('Meeting Minutes Generator')).toBeInTheDocument();
  });

  it('renders the built-in flow node labels', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Trigger').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Read File').length).toBeGreaterThan(0);
    expect(screen.getByText('LLM Generate')).toBeInTheDocument();
  });

  it('shows Save button', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const saveBtn = screen.getByRole('button', { name: /^save/i });
    expect(saveBtn).toBeInTheDocument();
  });

  it('shows Run Now button', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /run now/i })).toBeInTheDocument();
  });

  it('shows right panel tabs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: 'Prompt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logs' })).toBeInTheDocument();
  });

  it('shows not found message when automation id is missing', async () => {
    mockGetAutomation.mockResolvedValue(null);
    renderBuilder('non-existent');
    expect(await screen.findByText(/automation not found/i)).toBeInTheDocument();
  });

  it('loads workspaces from Supabase and shows them in workspace scope', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await waitFor(() => {
      expect(screen.getByText('NCA Digital Transformation')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Save', () => {
  it('calls supabase upsert (not localStorage) when Save is clicked', async () => {
    const { supabase } = await import('../lib/supabase');
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('prompt_templates');
    });
  });

  it('updates button text to show saved time after successful save', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^saved/i })).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Run', () => {
  it('calls chatWithDocument when Run Now is clicked', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    await waitFor(() => expect(mockChatWithDocument).toHaveBeenCalledTimes(1));
  });

  it('creates automation_runs record in Supabase on run', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    await waitFor(() => expect(mockCreateAutomationRun).toHaveBeenCalledTimes(1));
  });

  it('updates run status to completed after successful run', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    await waitFor(() => {
      expect(mockUpdateAutomationRun).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: 'completed' }),
      );
    }, { timeout: 3000 });
  });

  it('saves run section with output content', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    await waitFor(() => {
      expect(mockCreateAutomationRunSection).toHaveBeenCalledWith(
        expect.objectContaining({ section_name: 'full_output' }),
      );
    }, { timeout: 3000 });
  });

  it('shows run output after completion', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    await waitFor(() => {
      expect(screen.getByText(/Generated automation output text/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows error message when run fails', async () => {
    mockChatWithDocument.mockRejectedValueOnce(new Error('LLM unavailable'));
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    await waitFor(() => {
      expect(screen.getByText(/LLM unavailable/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('updates run status to failed on error', async () => {
    mockChatWithDocument.mockRejectedValueOnce(new Error('LLM unavailable'));
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    await waitFor(() => {
      expect(mockUpdateAutomationRun).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: 'failed' }),
      );
    }, { timeout: 3000 });
  });

  it('switches to Running… label while running', async () => {
    mockChatWithDocument.mockImplementation(() => new Promise(r => setTimeout(() => r('done'), 300)));
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    expect(screen.getByRole('button', { name: /running/i })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Node selection', () => {
  it('shows node description when node is clicked', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getAllByText('Read File')[0]);
    expect(screen.getByText(/parse pdf\/word document/i)).toBeInTheDocument();
  });

  it('Classify node is selected by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Classify')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Prompt tab', () => {
  it('shows prompt template when Prompt tab is active', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: 'Prompt' }));
    expect(screen.getByText(/senior business analyst/i)).toBeInTheDocument();
  });

  it('shows Edit button in Prompt tab to enable editing', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: 'Prompt' }));
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Logs tab', () => {
  it('shows empty state when no runs exist', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getByText(/no runs recorded yet/i)).toBeInTheDocument();
    });
  });

  it('shows run history from Supabase', async () => {
    mockGetAutomationRuns.mockResolvedValue([{
      id: 'run-abc',
      automation_type: 'auto-1',
      status: 'completed',
      options_json: JSON.stringify({ input: 'Test input document' }),
      started_at: new Date(Date.now() - 60000).toISOString(),
      completed_at: new Date(Date.now() - 30000).toISOString(),
      created_at: new Date(Date.now() - 60000).toISOString(),
      error_message: null,
    }]);

    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Destinations tab', () => {
  it('shows destination options', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: 'Destinations' }));
    expect(screen.getByText('Save to Workspace')).toBeInTheDocument();
    expect(screen.getByText('Export as Word')).toBeInTheDocument();
    expect(screen.getByText('Export as PDF')).toBeInTheDocument();
  });

  it('marks SharePoint and Jira as coming soon', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: 'Destinations' }));
    const soonBadges = screen.getAllByText('Soon');
    expect(soonBadges.length).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Notifications tab', () => {
  it('shows notification options', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('Email on Success')).toBeInTheDocument();
    expect(screen.getByText('Slack Notification')).toBeInTheDocument();
  });

  it('shows Slack webhook URL input when Slack toggle is enabled', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    // Slack is initially disabled — enable it
    const slackRow = screen.getByText('Slack Notification').closest('div')!.parentElement!;
    const toggle = slackRow.querySelector('div[style*="cursor: pointer"]') as HTMLElement;
    if (toggle) await userEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/hooks\.slack\.com/i)).toBeInTheDocument();
    });
  });
});
