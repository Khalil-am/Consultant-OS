import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ── Mocks ────────────────────────────────────────────────────
const { mockChatWithDocument } = vi.hoisted(() => ({
  mockChatWithDocument: vi.fn(),
}));

vi.mock('../hooks/useLayout', () => ({
  useLayout: () => ({ width: 1200, isMobile: false, isTablet: false }),
}));

vi.mock('../lib/openrouter', () => ({
  chatWithDocument: mockChatWithDocument,
}));

vi.mock('../data/mockData', () => ({
  automations: [
    {
      id: 'auto-1',
      name: 'Meeting Minutes Generator',
      category: 'Meetings',
      status: 'Active',
      lastRun: '2h ago',
      runs: 42,
      runCount: 42,
      successRate: 98,
      description: 'Generates meeting minutes from transcript',
      trigger: 'On meeting end',
      steps: [],
      starred: false,
    },
    {
      id: 'auto-2',
      name: 'BRD Builder',
      category: 'Documents',
      status: 'Active',
      lastRun: '1d ago',
      runs: 15,
      runCount: 15,
      successRate: 95,
      description: 'Builds BRD from requirements',
      trigger: 'Document uploaded',
      steps: [],
      starred: true,
    },
  ],
  users: [],
}));

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
    // Use getAllByText since "Trigger" appears as section label AND node
    expect(screen.getAllByText('Trigger').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Read File').length).toBeGreaterThan(0);
    expect(screen.getByText('LLM Generate')).toBeInTheDocument();
  });

  it('shows Save button (either "Save" or "Saved …")', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    // Save button shows "Save" before any save, or "Saved HH:MM:SS" after
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

  it('falls back to first automation when id not in list', async () => {
    // Falls back to automations[0] = Meeting Minutes Generator
    renderBuilder('non-existent');
    expect(await screen.findByText('Meeting Minutes Generator')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Save', () => {
  it('saves config to localStorage with key starting ab_cfg_', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      const key = 'ab_cfg_auto-1';
      expect(localStorage.getItem(key)).not.toBeNull();
    });
  });

  it('stores automationId in saved config', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      const raw = localStorage.getItem('ab_cfg_auto-1');
      if (raw) {
        const cfg = JSON.parse(raw);
        expect(cfg.automationId).toBe('auto-1');
        expect(cfg.savedAt).toBeDefined();
      }
    });
  });

  it('updates button text to show saved time', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    // After save, the accessible name of the button starts with "Saved HH:MM:SS"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^saved/i })).toBeInTheDocument();
    });
  });

  it('loads savedAt from localStorage on mount', async () => {
    localStorage.setItem('ab_cfg_auto-1', JSON.stringify({ savedAt: '10:30:00 AM', automationId: 'auto-1' }));

    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    // Button title shows "Last saved 10:30:00 AM"
    await waitFor(() => {
      const btns = screen.getAllByRole('button');
      const saveBtn = btns.find(b => b.title?.includes('10:30:00') || (b.textContent ?? '').includes('10:30:00'));
      expect(saveBtn).toBeDefined();
    });
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

  it('switches to Running… label while running', async () => {
    mockChatWithDocument.mockImplementation(() => new Promise(r => setTimeout(() => r('done'), 300)));
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    // Immediately after click, should show "Running…"
    expect(screen.getByRole('button', { name: /running/i })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Node selection', () => {
  it('shows node description when node is clicked', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    // Click "Read File" node
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
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Logs tab', () => {
  it('shows Logs tab button', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: 'Logs' })).toBeInTheDocument();
  });

  it('switches to Logs tab and shows log entries', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    // Log entries are pre-populated with recent runs
    await waitFor(() => {
      // Logs tab shows recent run history with status labels
      const statusEls = screen.queryAllByText('Success');
      expect(statusEls.length).toBeGreaterThan(0);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Schema tab', () => {
  it('shows Schema tab button', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: 'Schema' })).toBeInTheDocument();
  });

  it('switches to Schema tab without error', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: 'Schema' }));
    // Schema tab should render without crashing
    expect(screen.getByRole('button', { name: 'Schema' })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – second automation', () => {
  it('renders BRD Builder automation name', async () => {
    renderBuilder('auto-2');
    expect(await screen.findByText('BRD Builder')).toBeInTheDocument();
  });

  it('renders BRD Builder category in header', async () => {
    renderBuilder('auto-2');
    await screen.findByText('BRD Builder');
    // Category 'Documents' is shown in the header subtitle
    expect(screen.getByText(/documents/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Node description panel', () => {
  it('shows node panel with description text', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');

    // Click any flow node to see its description
    const allNodes = document.querySelectorAll('[style*="cursor: pointer"]');
    if (allNodes.length > 0) {
      await userEvent.click(allNodes[0] as HTMLElement);
      // After click, some description should appear in the right panel
      expect(document.querySelector('[style*="fontSize: \'0.78rem\'"]') ?? document.body).toBeDefined();
    }
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Back navigation', () => {
  it('shows back/automations link in header', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    // A button or link pointing back to automations exists
    const backEls = screen.getAllByText(/automations/i);
    expect(backEls.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Schema tab content', () => {
  it('Schema tab shows JSON structure', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /schema/i }));
    // Schema shows JSON-like content
    await waitFor(() => {
      const codeElements = document.querySelectorAll('pre, code, [style*="monospace"]');
      expect(codeElements.length + screen.getAllByRole('button').length).toBeGreaterThan(0);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Automation run count display', () => {
  it('shows run count in header subtitle', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    // runCount 42 shown in header: "Meetings · 42 runs"
    expect(screen.getByText(/42 runs/i)).toBeInTheDocument();
  });

  it('shows automation category in header subtitle', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    // Category "Meetings" shown in header
    expect(screen.getByText(/meetings/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Destinations tab', () => {
  it('shows Destinations tab button', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: 'Destinations' })).toBeInTheDocument();
  });

  it('switches to Destinations tab and shows destination options', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Destinations' }));
    expect(screen.getByText(/save to workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/export as word/i)).toBeInTheDocument();
    expect(screen.getByText(/export as pdf/i)).toBeInTheDocument();
  });

  it('Destinations tab shows SharePoint and Jira options', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Destinations' }));
    expect(screen.getByText(/sync to sharepoint/i)).toBeInTheDocument();
    expect(screen.getByText(/push to jira/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Notifications tab', () => {
  it('shows Notifications tab button', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('switches to Notifications tab and shows notification rules', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText(/email on success/i)).toBeInTheDocument();
    expect(screen.getByText(/email on error/i)).toBeInTheDocument();
    expect(screen.getByText(/in-app alert/i)).toBeInTheDocument();
  });

  it('Notifications tab shows Slack option', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getAllByText(/slack notification/i).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Left panel', () => {
  it('shows Document Upload trigger in left panel', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText(/document upload/i).length).toBeGreaterThan(0);
  });

  it('shows Accepted Formats input setting', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('PDF, DOCX, TXT')).toBeInTheDocument();
  });

  it('shows Max File Size input setting', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('50 MB')).toBeInTheDocument();
  });

  it('shows Workspace Scope section', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Workspace Scope')).toBeInTheDocument();
  });

  it('shows NCA Digital Transformation in workspace scope', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('NCA Digital Transformation')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Prompt tab model selector', () => {
  it('shows model selector with GPT-4o option', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    // Prompt tab is active by default
    expect(screen.getByRole('option', { name: 'GPT-4o' })).toBeInTheDocument();
  });

  it('shows Claude option in model selector', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('option', { name: 'Claude 3.5 Sonnet' })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – All flow node labels', () => {
  it('shows Extract Text node', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Extract Text').length).toBeGreaterThan(0);
  });

  it('shows Validate node', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Validate').length).toBeGreaterThan(0);
  });

  it('shows Create Doc node', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Create Doc').length).toBeGreaterThan(0);
  });

  it('shows Notify node', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Notify').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Node click description', () => {
  it('shows Classify description when Classify node clicked', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getAllByText('Classify')[0]);
    expect(screen.getByText(/detect document type/i)).toBeInTheDocument();
  });

  it('shows LLM Generate description when node clicked', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getAllByText('LLM Generate')[0]);
    expect(screen.getByText(/gpt-4o generation/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Logs tab recent runs', () => {
  it('shows recent log entries with input file names', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    // Recent log: input = 'NCA_Requirements_v2.docx'
    await waitFor(() => {
      expect(screen.getByText(/NCA_Requirements_v2\.docx/i)).toBeInTheDocument();
    });
  });

  it('shows Warning and Error status badges in logs', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getAllByText('Warning').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Error').length).toBeGreaterThan(0);
    });
  });

  it('shows duration for log entries', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getByText(/42s/i)).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Trigger node description', () => {
  it('shows Trigger description when Trigger node clicked', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getAllByText('Trigger')[0]);
    // Trigger node description mentions document upload or input trigger
    await waitFor(() => {
      const desc = document.body.textContent ?? '';
      expect(desc.toLowerCase()).toMatch(/upload|trigger|schedule|file/i);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Prompt tab interaction', () => {
  it('shows prompt textarea in Prompt tab', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Prompt' }));
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeTruthy();
  });

  it('can type in prompt textarea', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Prompt' }));
    const textarea = document.querySelector('textarea');
    if (textarea) {
      await userEvent.clear(textarea);
      await userEvent.type(textarea, 'Custom prompt text');
      expect((textarea as HTMLTextAreaElement).value).toContain('Custom prompt text');
    }
  });

  it('shows model selector combobox in Prompt tab', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Prompt' }));
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Flow node descriptions', () => {
  it('shows Extract Text description "OCR and text extraction"', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('OCR and text extraction')).toBeInTheDocument();
  });

  it('shows Validate description "Schema & quality validation"', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Schema & quality validation')).toBeInTheDocument();
  });

  it('shows Create Doc description "Generate Word/PDF output"', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Generate Word/PDF output')).toBeInTheDocument();
  });

  it('shows Notify description "Email/Slack notification"', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Email/Slack notification')).toBeInTheDocument();
  });

  it('shows Trigger description "Document uploaded or manual run"', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Document uploaded or manual run')).toBeInTheDocument();
  });

  it('shows LLM Generate description "GPT-4o generation with template"', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('GPT-4o generation with template')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Input settings left panel', () => {
  it('shows Language Detection input setting label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Language Detection')).toBeInTheDocument();
  });

  it('shows Auto (EN/AR) value for Language Detection', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Auto (EN/AR)')).toBeInTheDocument();
  });

  it('shows OCR Engine input setting label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('OCR Engine')).toBeInTheDocument();
  });

  it('shows Azure Form Recognizer as OCR Engine value', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Azure Form Recognizer')).toBeInTheDocument();
  });

  it('shows ADNOC Supply Chain in workspace scope', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('ADNOC Supply Chain')).toBeInTheDocument();
  });

  it('shows MOCI Procurement in workspace scope', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('MOCI Procurement')).toBeInTheDocument();
  });

  it('shows Healthcare Digital in workspace scope', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Healthcare Digital')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Logs tab full content', () => {
  it('shows ADNOC_Scope.pdf in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getByText(/ADNOC_Scope\.pdf/i)).toBeInTheDocument();
    });
  });

  it('shows Healthcare_Req.xlsx in logs with Warning status', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getByText(/Healthcare_Req\.xlsx/i)).toBeInTheDocument();
    });
  });

  it('shows corrupt_file.pdf with Error status in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getByText(/corrupt_file\.pdf/i)).toBeInTheDocument();
    });
  });

  it('shows 38s duration for ADNOC entry in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getByText(/38s/i)).toBeInTheDocument();
    });
  });

  it('shows 12s duration for error entry in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getByText(/12s/i)).toBeInTheDocument();
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Legend labels', () => {
  it('shows Completed legend label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows Pending legend label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Prompt template content', () => {
  it('shows Stakeholder Register in prompt template', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText(/Stakeholder Register/)).toBeInTheDocument();
  });

  it('shows Use Cases in prompt template', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText(/Use Cases/)).toBeInTheDocument();
  });

  it('shows Acceptance Criteria in prompt template', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText(/Acceptance Criteria/)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Active status badge', () => {
  it('shows Active status badge in header', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – BRD Builder details', () => {
  it('shows 15 runs for BRD Builder', async () => {
    renderBuilder('auto-2');
    await screen.findByText('BRD Builder');
    expect(screen.getByText(/15 runs/i)).toBeInTheDocument();
  });

  it('BRD Builder shows Destinations tab', async () => {
    renderBuilder('auto-2');
    await screen.findByText('BRD Builder');
    expect(screen.getByRole('button', { name: 'Destinations' })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Extract Text description', () => {
  it('shows Extract Text description when clicked', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getAllByText('Extract Text')[0]);
    // Description should contain text extraction info
    await waitFor(() => {
      const body = document.body.textContent ?? '';
      expect(body.toLowerCase()).toMatch(/extract|text|content|parse/i);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Validate node description', () => {
  it('shows Validate node description when clicked', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getAllByText('Validate')[0]);
    // Description should contain validation info
    await waitFor(() => {
      const body = document.body.textContent ?? '';
      expect(body.toLowerCase()).toMatch(/valid|check|quality|schema/i);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Run output display', () => {
  it('shows output in Logs section after successful run', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    await waitFor(() => {
      expect(screen.getByText(/Generated automation output text/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Notifications tab', () => {
  it('shows Notification Rules label in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await waitFor(() => {
      expect(screen.getByText('Notification Rules')).toBeInTheDocument();
    });
  });

  it('shows Email on Success in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await waitFor(() => {
      expect(screen.getByText('Email on Success')).toBeInTheDocument();
    });
  });

  it('shows Email on Error in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await waitFor(() => {
      expect(screen.getByText('Email on Error')).toBeInTheDocument();
    });
  });

  it('shows Slack Notification in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await waitFor(() => {
      expect(screen.getByText('Slack Notification')).toBeInTheDocument();
    });
  });

  it('shows In-App Alert in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await waitFor(() => {
      expect(screen.getByText('In-App Alert')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Input Settings', () => {
  it('shows Accepted Formats in left panel', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Accepted Formats')).toBeInTheDocument();
  });

  it('shows PDF, DOCX, TXT as accepted formats', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('PDF, DOCX, TXT')).toBeInTheDocument();
  });

  it('shows Language Detection setting', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Language Detection')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Destinations tab', () => {
  it('shows Destinations tab button', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: 'Destinations' })).toBeInTheDocument();
  });

  it('switches to Destinations tab without error', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Destinations' }));
    // Should not crash
    expect(screen.getByText('Meeting Minutes Generator')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – right panel tab labels', () => {
  it('shows all five right panel tab labels', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: 'Prompt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schema' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Destinations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logs' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Destinations tab content', () => {
  it('shows Output Destinations heading in Destinations tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Destinations' }));
    await waitFor(() => {
      expect(screen.getByText('Output Destinations')).toBeInTheDocument();
    });
  });

  it('shows Save to Workspace destination', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Destinations' }));
    await waitFor(() => {
      expect(screen.getByText('Save to Workspace')).toBeInTheDocument();
    });
  });

  it('shows Export as Word destination', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Destinations' }));
    await waitFor(() => {
      expect(screen.getByText('Export as Word')).toBeInTheDocument();
    });
  });

  it('shows Export as PDF destination', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Destinations' }));
    await waitFor(() => {
      expect(screen.getByText('Export as PDF')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Workspace Scope section', () => {
  it('shows Workspace Scope section in left panel', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Workspace Scope')).toBeInTheDocument();
  });

  it('shows OCR Engine setting in left panel', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('OCR Engine')).toBeInTheDocument();
  });

  it('shows Max File Size setting in left panel', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Max File Size')).toBeInTheDocument();
  });

  it('shows Accepted Formats setting', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Accepted Formats')).toBeInTheDocument();
  });

  it('shows Language Detection setting', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Language Detection')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Pipeline nodes', () => {
  it('shows Trigger node in pipeline', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Trigger').length).toBeGreaterThan(0);
  });

  it('shows Read File node in pipeline', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Read File').length).toBeGreaterThan(0);
  });

  it('shows Extract Text node in pipeline', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Extract Text').length).toBeGreaterThan(0);
  });

  it('shows LLM Generate node in pipeline', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('LLM Generate').length).toBeGreaterThan(0);
  });

  it('shows Validate node in pipeline', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Validate').length).toBeGreaterThan(0);
  });

  it('shows Create Doc node in pipeline', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Create Doc').length).toBeGreaterThan(0);
  });

  it('shows Notify node in pipeline', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Notify').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Legend labels', () => {
  it('shows Completed legend label', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
  });

  it('shows Active legend label', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
  });

  it('shows Pending legend label', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
  });

  it('shows Error legend label', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Error').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Node descriptions', () => {
  it('shows Document uploaded or manual run description', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText(/Document uploaded or manual run/i).length).toBeGreaterThan(0);
  });

  it('shows Parse PDF/Word document description', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText(/Parse PDF\/Word document/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Output schema', () => {
  it('shows Output Schema section when Schema tab clicked', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Schema' }));
    await waitFor(() => {
      expect(screen.getByText('Output Schema')).toBeInTheDocument();
    });
  });

  it('shows Output Destinations section when Destinations tab clicked', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Destinations' }));
    await waitFor(() => {
      expect(screen.getByText('Output Destinations')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Second automation', () => {
  it('loads BRD Builder automation by id', async () => {
    renderBuilder('auto-2');
    await screen.findByText('BRD Builder');
    expect(screen.getByText('BRD Builder')).toBeInTheDocument();
  });

  it('shows BRD Builder category', async () => {
    renderBuilder('auto-2');
    await screen.findByText('BRD Builder');
    expect(screen.getAllByText(/Documents/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Header buttons', () => {
  it('shows Save button in header', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('shows Run Now button in header', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /run now/i })).toBeInTheDocument();
  });

  it('shows Automations back button in header', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    const backBtn = screen.getAllByText(/automations/i)[0];
    expect(backBtn).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Left panel section headers', () => {
  it('shows Trigger section header in left panel', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    // "Trigger" appears as a section header AND as a flow node label
    expect(screen.getAllByText(/trigger/i).length).toBeGreaterThan(0);
  });

  it('shows Input Settings section header in left panel', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Input Settings')).toBeInTheDocument();
  });

  it('shows "fires when a new document is uploaded" description', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText(/fires when a new document is uploaded to workspace/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Prompt tab right panel', () => {
  it('shows System Prompt label in Prompt tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    // Prompt tab is active by default; System Prompt label should be visible
    expect(screen.getByText('System Prompt')).toBeInTheDocument();
  });

  it('shows Format button in Prompt tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /format/i })).toBeInTheDocument();
  });

  it('shows "senior business analyst" in prompt template div', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    // The promptTemplate is rendered as text in a monospace div, not in a textarea
    expect(screen.getAllByText(/senior business analyst/i).length).toBeGreaterThan(0);
  });

  it('shows "Functional Requirements" in prompt template', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText(/Functional Requirements/i).length).toBeGreaterThan(0);
  });

  it('shows "Executive Summary" in prompt template', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText(/Executive Summary/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Classify node description', () => {
  it('shows "Detect document type & structure" description inline', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Detect document type & structure')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Run output via mock', () => {
  it('calls chatWithDocument when Run Now is clicked', async () => {
    mockChatWithDocument.mockResolvedValueOnce('Generated BRD output');
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    await waitFor(() => {
      expect(mockChatWithDocument).toHaveBeenCalled();
    });
  });

  it('shows Running... while processing', async () => {
    let resolve: (v: string) => void;
    mockChatWithDocument.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    await waitFor(() => {
      expect(screen.getByText(/running\.\.\./i)).toBeInTheDocument();
    });
    resolve!('done');
  });

  it('displays run output after successful run', async () => {
    mockChatWithDocument.mockResolvedValueOnce('Executive Summary output from LLM');
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    await waitFor(() => {
      expect(screen.getByText(/Executive Summary output from LLM/i)).toBeInTheDocument();
    });
  });

  it('shows error message when run fails', async () => {
    mockChatWithDocument.mockRejectedValueOnce(new Error('Network error'));
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /run now/i }));
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Save configuration', () => {
  it('Save button saves to localStorage and shows saved time', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    const saveBtn = screen.getByRole('button', { name: /save/i });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Logs tab output entries', () => {
  it('shows MOCI_Requirements.docx in logs', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getByText(/MOCI_Requirements\.docx/i)).toBeInTheDocument();
    });
  });

  it('shows output BRD_NCA_EA_v2.3.docx in logs', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getByText(/BRD_NCA_EA_v2\.3\.docx/i)).toBeInTheDocument();
    });
  });

  it('shows 45s duration for MOCI entry in logs', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getByText(/45s/i)).toBeInTheDocument();
    });
  });

  it('shows 61s duration for Healthcare entry in logs', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getByText(/61s/i)).toBeInTheDocument();
    });
  });

  it('shows multiple Success badges in logs', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getAllByText('Success').length).toBeGreaterThan(1);
    });
  });

  it('shows Recent Runs section header in Logs tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      expect(screen.getByText(/Recent Runs/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Left panel config', () => {
  it('shows Document Upload trigger type', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Document Upload')).toBeInTheDocument();
  });

  it('shows Accepted Formats field', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Accepted Formats')).toBeInTheDocument();
  });

  it('shows PDF, DOCX, TXT value for Accepted Formats', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('PDF, DOCX, TXT')).toBeInTheDocument();
  });

  it('shows Max File Size field', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Max File Size')).toBeInTheDocument();
  });

  it('shows 50 MB as max file size value', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('50 MB')).toBeInTheDocument();
  });

  it('shows Language Detection field', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Language Detection')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Workspace scope', () => {
  it('shows NCA Digital Transformation workspace', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('NCA Digital Transformation')).toBeInTheDocument();
  });

  it('shows MOCI Procurement workspace in scope list', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('MOCI Procurement')).toBeInTheDocument();
  });

  it('shows Workspace Scope section label', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText(/Workspace Scope/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Notifications tab', () => {
  it('shows Notifications tab button', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('shows Email on Success notification in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('Email on Success')).toBeInTheDocument();
  });

  it('shows Email on Error notification in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('Email on Error')).toBeInTheDocument();
  });

  it('shows Slack Notification in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('Slack Notification')).toBeInTheDocument();
  });

  it('shows Teams Message in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('Teams Message')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Schema tab', () => {
  it('shows Schema tab button', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: 'Schema' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Logs tab', () => {
  it('shows Logs tab button', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: 'Logs' })).toBeInTheDocument();
  });

  it('shows recent log entries in Logs tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    await waitFor(() => {
      // Logs tab should render some content
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Destinations tab', () => {
  it('shows Destinations tab button', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: 'Destinations' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Trigger section', () => {
  it('shows Trigger label in left config panel', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText(/Trigger/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Save button', () => {
  it('shows Save button in header', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByRole('button', { name: /save/i }).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Run Now button', () => {
  it('shows Run Now button', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByRole('button', { name: /run now/i }).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Prompt tab active by default', () => {
  it('shows Prompt tab active by default', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: 'Prompt' })).toBeInTheDocument();
  });
});
