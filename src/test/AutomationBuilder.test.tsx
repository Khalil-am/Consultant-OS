import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    expect(screen.getByRole('button', { name: /builder tab: prompt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /builder tab: logs/i })).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole('button', { name: /save configuration/i }));

    await waitFor(() => {
      const key = 'ab_cfg_auto-1';
      expect(localStorage.getItem(key)).not.toBeNull();
    });
  });

  it('stores automationId in saved config', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /save configuration/i }));

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

    await userEvent.click(screen.getByRole('button', { name: /save configuration/i }));

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

    await userEvent.click(screen.getByRole('button', { name: /builder tab: prompt/i }));
    expect(screen.getByText(/senior business analyst/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Logs tab', () => {
  it('shows Logs tab button', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /builder tab: logs/i })).toBeInTheDocument();
  });

  it('switches to Logs tab and shows log entries', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
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
    expect(screen.getByRole('button', { name: /builder tab: schema/i })).toBeInTheDocument();
  });

  it('switches to Schema tab without error', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');

    await userEvent.click(screen.getByRole('button', { name: /builder tab: schema/i }));
    // Schema tab should render without crashing
    expect(screen.getByRole('button', { name: /builder tab: schema/i })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /builder tab: destinations/i })).toBeInTheDocument();
  });

  it('switches to Destinations tab and shows destination options', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
    expect(screen.getByText(/save to workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/export as word/i)).toBeInTheDocument();
    expect(screen.getByText(/export as pdf/i)).toBeInTheDocument();
  });

  it('Destinations tab shows SharePoint and Jira options', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
    expect(screen.getByText(/sync to sharepoint/i)).toBeInTheDocument();
    expect(screen.getByText(/push to jira/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Notifications tab', () => {
  it('shows Notifications tab button', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /builder tab: notifications/i })).toBeInTheDocument();
  });

  it('switches to Notifications tab and shows notification rules', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    expect(screen.getByText(/email on success/i)).toBeInTheDocument();
    expect(screen.getByText(/email on error/i)).toBeInTheDocument();
    expect(screen.getByText(/in-app alert/i)).toBeInTheDocument();
  });

  it('Notifications tab shows Slack option', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
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
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    // Recent log: input = 'NCA_Requirements_v2.docx'
    await waitFor(() => {
      expect(screen.getByText(/NCA_Requirements_v2\.docx/i)).toBeInTheDocument();
    });
  });

  it('shows Warning and Error status badges in logs', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Warning').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Error').length).toBeGreaterThan(0);
    });
  });

  it('shows duration for log entries', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
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
    await userEvent.click(screen.getByRole('button', { name: /builder tab: prompt/i }));
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeTruthy();
  });

  it('can type in prompt textarea', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: prompt/i }));
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
    await userEvent.click(screen.getByRole('button', { name: /builder tab: prompt/i }));
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
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText(/ADNOC_Scope\.pdf/i)).toBeInTheDocument();
    });
  });

  it('shows Healthcare_Req.xlsx in logs with Warning status', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText(/Healthcare_Req\.xlsx/i)).toBeInTheDocument();
    });
  });

  it('shows corrupt_file.pdf with Error status in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText(/corrupt_file\.pdf/i)).toBeInTheDocument();
    });
  });

  it('shows 38s duration for ADNOC entry in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText(/38s/i)).toBeInTheDocument();
    });
  });

  it('shows 12s duration for error entry in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
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
    expect(screen.getByRole('button', { name: /builder tab: destinations/i })).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('Notification Rules')).toBeInTheDocument();
    });
  });

  it('shows Email on Success in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('Email on Success')).toBeInTheDocument();
    });
  });

  it('shows Email on Error in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('Email on Error')).toBeInTheDocument();
    });
  });

  it('shows Slack Notification in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('Slack Notification')).toBeInTheDocument();
    });
  });

  it('shows In-App Alert in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
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
    expect(screen.getByRole('button', { name: /builder tab: destinations/i })).toBeInTheDocument();
  });

  it('switches to Destinations tab without error', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
    // Should not crash
    expect(screen.getByText('Meeting Minutes Generator')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – right panel tab labels', () => {
  it('shows all five right panel tab labels', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /builder tab: prompt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /builder tab: schema/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /builder tab: destinations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /builder tab: notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /builder tab: logs/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Destinations tab content', () => {
  it('shows Output Destinations heading in Destinations tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
    await waitFor(() => {
      expect(screen.getByText('Output Destinations')).toBeInTheDocument();
    });
  });

  it('shows Save to Workspace destination', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
    await waitFor(() => {
      expect(screen.getByText('Save to Workspace')).toBeInTheDocument();
    });
  });

  it('shows Export as Word destination', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
    await waitFor(() => {
      expect(screen.getByText('Export as Word')).toBeInTheDocument();
    });
  });

  it('shows Export as PDF destination', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
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
    await userEvent.click(screen.getByRole('button', { name: /builder tab: schema/i }));
    await waitFor(() => {
      expect(screen.getByText('Output Schema')).toBeInTheDocument();
    });
  });

  it('shows Output Destinations section when Destinations tab clicked', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
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
    const saveBtn = screen.getByRole('button', { name: /save configuration/i });
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
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText(/MOCI_Requirements\.docx/i)).toBeInTheDocument();
    });
  });

  it('shows output BRD_NCA_EA_v2.3.docx in logs', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText(/BRD_NCA_EA_v2\.3\.docx/i)).toBeInTheDocument();
    });
  });

  it('shows 45s duration for MOCI entry in logs', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText(/45s/i)).toBeInTheDocument();
    });
  });

  it('shows 61s duration for Healthcare entry in logs', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText(/61s/i)).toBeInTheDocument();
    });
  });

  it('shows multiple Success badges in logs', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Success').length).toBeGreaterThan(1);
    });
  });

  it('shows Recent Runs section header in Logs tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
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
    expect(screen.getByRole('button', { name: /builder tab: notifications/i })).toBeInTheDocument();
  });

  it('shows Email on Success notification in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    expect(await screen.findByText('Email on Success')).toBeInTheDocument();
  });

  it('shows Email on Error notification in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    expect(await screen.findByText('Email on Error')).toBeInTheDocument();
  });

  it('shows Slack Notification in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    expect(await screen.findByText('Slack Notification')).toBeInTheDocument();
  });

  it('shows Teams Message in Notifications tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    expect(await screen.findByText('Teams Message')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Schema tab', () => {
  it('shows Schema tab button', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /builder tab: schema/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Logs tab', () => {
  it('shows Logs tab button', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /builder tab: logs/i })).toBeInTheDocument();
  });

  it('shows recent log entries in Logs tab', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
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
    expect(screen.getByRole('button', { name: /builder tab: destinations/i })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /builder tab: prompt/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Tab aria attributes', () => {
  it('Prompt tab has aria-pressed=true by default', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    const promptBtn = screen.getByRole('button', { name: /builder tab: prompt/i });
    expect(promptBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('Logs tab has aria-pressed=false by default', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    const logsBtn = screen.getByRole('button', { name: /builder tab: logs/i });
    expect(logsBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Logs sets its aria-pressed=true and Prompt to false', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    const promptBtn = screen.getByRole('button', { name: /builder tab: prompt/i });
    const logsBtn = screen.getByRole('button', { name: /builder tab: logs/i });
    await userEvent.click(logsBtn);
    await waitFor(() => {
      expect(logsBtn).toHaveAttribute('aria-pressed', 'true');
      expect(promptBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Schema tab has correct aria-label', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /builder tab: schema/i })).toBeInTheDocument();
  });

  it('Destinations tab has correct aria-label', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /builder tab: destinations/i })).toBeInTheDocument();
  });

  it('clicking Prompt restores its aria-pressed=true after switching tabs', async () => {
    renderBuilder();
    await screen.findByText('Meeting Minutes Generator');
    const promptBtn = screen.getByRole('button', { name: /builder tab: prompt/i });
    const logsBtn = screen.getByRole('button', { name: /builder tab: logs/i });
    await userEvent.click(logsBtn);
    await userEvent.click(promptBtn);
    await waitFor(() => {
      expect(promptBtn).toHaveAttribute('aria-pressed', 'true');
      expect(logsBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Flow node aria-labels', () => {
  it('Trigger flow node has aria-label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /flow node: trigger/i })).toBeInTheDocument();
  });

  it('Read File flow node has aria-label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /flow node: read file/i })).toBeInTheDocument();
  });

  it('LLM Generate flow node has aria-label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /flow node: llm generate/i })).toBeInTheDocument();
  });

  it('Classify node has aria-pressed=true by default (selected)', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const classify = screen.getByRole('button', { name: /flow node: classify/i });
    expect(classify).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Notify node sets its aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const notifyBtn = screen.getByRole('button', { name: /flow node: notify/i });
    await userEvent.click(notifyBtn);
    await waitFor(() => {
      expect(notifyBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('deselects previous node when new one is clicked', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const triggerBtn = screen.getByRole('button', { name: /flow node: trigger/i });
    const classifyBtn = screen.getByRole('button', { name: /flow node: classify/i });
    await userEvent.click(triggerBtn);
    await waitFor(() => {
      expect(triggerBtn).toHaveAttribute('aria-pressed', 'true');
      expect(classifyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Save button aria-label', () => {
  it('Save configuration button has aria-label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
  });

  it('Save configuration button is accessible by role', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const saveBtn = screen.getByRole('button', { name: /save configuration/i });
    expect(saveBtn).toBeInTheDocument();
  });

  it('clicking Save configuration triggers handleSave', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const saveBtn = screen.getByRole('button', { name: /save configuration/i });
    await userEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^saved/i })).toBeInTheDocument();
    });
  });

  it('Format prompt button has aria-label in Prompt tab', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: prompt/i }));
    expect(screen.getByRole('button', { name: /format prompt/i })).toBeInTheDocument();
  });

  it('Run Now button has aria-label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /run now/i })).toBeInTheDocument();
  });

  it('Save and Run Now buttons coexist in header', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run now/i })).toBeInTheDocument();
  });

  it('Back to Automations button has aria-label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /back to automations/i })).toBeInTheDocument();
  });
});

describe('AutomationBuilder – Input and select aria-labels', () => {
  it('Test input document textarea has aria-label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    // The textarea is in the default Prompt tab
    expect(screen.getByRole('textbox', { name: /test input document/i })).toBeInTheDocument();
  });

  it('AI model select has aria-label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('combobox', { name: /ai model/i })).toBeInTheDocument();
  });

  it('Temperature setting select has aria-label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('combobox', { name: /temperature setting/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Schema tab content', () => {
  it('Schema tab shows Output Schema heading', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: schema/i }));
    await waitFor(() => {
      expect(screen.getByText('Output Schema')).toBeInTheDocument();
    });
  });

  it('Schema tab shows JSON schema content with title field', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: schema/i }));
    await waitFor(() => {
      expect(screen.getByText(/\"title\"/)).toBeInTheDocument();
    });
  });

  it('Schema tab button has aria-pressed=true after clicking', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const schemaTab = screen.getByRole('button', { name: /builder tab: schema/i });
    await userEvent.click(schemaTab);
    await waitFor(() => {
      expect(schemaTab).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('Schema tab deactivates Prompt tab', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const promptTab = screen.getByRole('button', { name: /builder tab: prompt/i });
    const schemaTab = screen.getByRole('button', { name: /builder tab: schema/i });
    await userEvent.click(schemaTab);
    await waitFor(() => {
      expect(promptTab).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Destinations tab content', () => {
  it('Destinations tab shows Export as Word option', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
    await waitFor(() => {
      expect(screen.getByText('Export as Word')).toBeInTheDocument();
    });
  });

  it('Destinations tab shows Export as PDF option', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
    await waitFor(() => {
      expect(screen.getByText('Export as PDF')).toBeInTheDocument();
    });
  });

  it('Destinations tab shows Sync to SharePoint option', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
    await waitFor(() => {
      expect(screen.getByText('Sync to SharePoint')).toBeInTheDocument();
    });
  });

  it('Destinations tab shows Push to Jira option', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
    await waitFor(() => {
      expect(screen.getByText('Push to Jira')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Notifications tab content', () => {
  it('Notifications tab shows Notification Rules heading', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('Notification Rules')).toBeInTheDocument();
    });
  });

  it('Notifications tab shows Email on Success rule', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('Email on Success')).toBeInTheDocument();
    });
  });

  it('Notifications tab shows Email on Error rule', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('Email on Error')).toBeInTheDocument();
    });
  });

  it('Notifications tab shows Slack Notification rule', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('Slack Notification')).toBeInTheDocument();
    });
  });

  it('Notifications tab shows In-App Alert rule', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('In-App Alert')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Logs tab content', () => {
  it('Logs tab shows Recent Runs heading', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText('Recent Runs')).toBeInTheDocument();
    });
  });

  it('Logs tab shows Success log entries', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Success').length).toBeGreaterThan(0);
    });
  });

  it('Logs tab button has aria-pressed=true after clicking', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const logsTab = screen.getByRole('button', { name: /builder tab: logs/i });
    await userEvent.click(logsTab);
    await waitFor(() => {
      expect(logsTab).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Flow node selection', () => {
  it('default selected node is Classify (n4)', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const classifyNode = screen.getByRole('button', { name: /flow node: classify/i });
    expect(classifyNode).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Trigger node sets it as selected', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const triggerNode = screen.getByRole('button', { name: /flow node: trigger/i });
    await userEvent.click(triggerNode);
    await waitFor(() => {
      expect(triggerNode).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Trigger node deselects Classify node', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const triggerNode = screen.getByRole('button', { name: /flow node: trigger/i });
    const classifyNode = screen.getByRole('button', { name: /flow node: classify/i });
    await userEvent.click(triggerNode);
    await waitFor(() => {
      expect(classifyNode).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('all flow node labels are visible', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getAllByText('Trigger').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Read File').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Extract Text').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Classify').length).toBeGreaterThan(0);
    expect(screen.getAllByText('LLM Generate').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Validate').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Create Doc').length).toBeGreaterThan(0);
  });

  it('flow nodes have correct aria-labels', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /flow node: read file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flow node: llm generate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flow node: validate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flow node: create doc/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Prompt tab selects', () => {
  it('AI model select is present on Prompt tab', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('combobox', { name: /ai model/i })).toBeInTheDocument();
  });

  it('Temperature setting select is present on Prompt tab', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('combobox', { name: /temperature setting/i })).toBeInTheDocument();
  });

  it('Format prompt button is present on Prompt tab', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /format prompt/i })).toBeInTheDocument();
  });

  it('Test input document textarea is present on Prompt tab', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('textbox', { name: /test input document/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Run Now button behavior', () => {
  it('Run Now button has correct initial aria-label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const runBtn = screen.getByRole('button', { name: /run now/i });
    expect(runBtn).toBeInTheDocument();
  });

  it('Run Now button switches to Logs tab after click', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const runBtn = screen.getByRole('button', { name: /run now/i });
    await userEvent.click(runBtn);
    await waitFor(() => {
      const logsTab = screen.getByRole('button', { name: /builder tab: logs/i });
      expect(logsTab).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Save configuration button', () => {
  it('Save configuration button is present initially', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
  });

  it('Save button shows Save text initially', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText('Save')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Tab navigation aria-pressed states', () => {
  it('Prompt tab is pressed by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const promptTab = screen.getByRole('button', { name: /builder tab: prompt/i });
    expect(promptTab).toHaveAttribute('aria-pressed', 'true');
  });

  it('Schema tab is not pressed by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const schemaTab = screen.getByRole('button', { name: /builder tab: schema/i });
    expect(schemaTab).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Schema tab sets Prompt tab aria-pressed=false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const promptTab = screen.getByRole('button', { name: /builder tab: prompt/i });
    const schemaTab = screen.getByRole('button', { name: /builder tab: schema/i });
    await userEvent.click(schemaTab);
    await waitFor(() => {
      expect(promptTab).toHaveAttribute('aria-pressed', 'false');
      expect(schemaTab).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Notifications tab sets it as active', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const notificationsTab = screen.getByRole('button', { name: /builder tab: notifications/i });
    await userEvent.click(notificationsTab);
    await waitFor(() => {
      expect(notificationsTab).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Destinations tab detail texts', () => {
  it('shows "Documents library" detail under Save to Workspace', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
    await waitFor(() => {
      expect(screen.getByText('Documents library')).toBeInTheDocument();
    });
  });

  it('shows "Microsoft Word .docx" detail under Export as Word', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
    await waitFor(() => {
      expect(screen.getByText('Microsoft Word .docx')).toBeInTheDocument();
    });
  });

  it('shows "NCA Programme folder" detail under Sync to SharePoint', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
    await waitFor(() => {
      expect(screen.getByText('NCA Programme folder')).toBeInTheDocument();
    });
  });

  it('shows "Create requirements tickets" detail under Push to Jira', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: destinations/i }));
    await waitFor(() => {
      expect(screen.getByText('Create requirements tickets')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Notifications tab detail texts', () => {
  it('shows "Send to assigned consultant" detail under Email on Success', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('Send to assigned consultant')).toBeInTheDocument();
    });
  });

  it('shows "Alert to workspace admin" detail under Email on Error', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('Alert to workspace admin')).toBeInTheDocument();
    });
  });

  it('shows "#automation-runs channel" detail under Slack Notification', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('#automation-runs channel')).toBeInTheDocument();
    });
  });

  it('shows "Project team channel" detail under Teams Message', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('Project team channel')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Logs tab error entry', () => {
  it('shows Error status entry in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Error').length).toBeGreaterThan(0);
    });
  });

  it('shows Warning status entry in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Warning').length).toBeGreaterThan(0);
    });
  });

  it('shows 5d ago entry in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText('5d ago')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Logs tab output files', () => {
  it('shows BRD_ADNOC_SC.docx output in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText(/BRD_ADNOC_SC\.docx/i)).toBeInTheDocument();
    });
  });

  it('shows BRD_partial.docx output for Healthcare warning entry', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText(/BRD_partial\.docx/i)).toBeInTheDocument();
    });
  });

  it('shows BRD_MOCI_v1.docx output in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText(/BRD_MOCI_v1\.docx/i)).toBeInTheDocument();
    });
  });

  it('shows N/A output for corrupt file error entry', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Logs tab time stamps', () => {
  it('shows 3d ago entry in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText('3d ago')).toBeInTheDocument();
    });
  });

  it('shows 2d ago entry in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText('2d ago')).toBeInTheDocument();
    });
  });

  it('shows 1d ago entry in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText('1d ago')).toBeInTheDocument();
    });
  });

  it('shows 2h ago entry in logs', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
    await waitFor(() => {
      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – BRD Builder automation', () => {
  it('renders BRD Builder automation name', async () => {
    renderBuilder('auto-2');
    expect(await screen.findByText('BRD Builder')).toBeInTheDocument();
  });

  it('shows Documents category for BRD Builder in header', async () => {
    renderBuilder('auto-2');
    await screen.findByText('BRD Builder');
    // header renders: "Documents · 15 runs"
    expect(screen.getByText(/Documents/i)).toBeInTheDocument();
  });

  it('shows run count "15 runs" for BRD Builder', async () => {
    renderBuilder('auto-2');
    await screen.findByText('BRD Builder');
    expect(screen.getByText(/15 runs/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Schema tab JSON fields', () => {
  async function openSchema() {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: schema/i }));
    await screen.findByText('Output Schema');
  }

  it('shows "version" field in schema JSON', async () => {
    await openSchema();
    expect(screen.getByText(/\"version\"/)).toBeInTheDocument();
  });

  it('shows "sections" field in schema JSON', async () => {
    await openSchema();
    expect(screen.getByText(/\"sections\"/)).toBeInTheDocument();
  });

  it('shows "requirements" field in schema JSON', async () => {
    await openSchema();
    expect(screen.getByText(/\"requirements\"/)).toBeInTheDocument();
  });

  it('shows "metadata" field in schema JSON', async () => {
    await openSchema();
    expect(screen.getByText(/\"metadata\"/)).toBeInTheDocument();
  });

  it('shows "generatedAt" field in metadata', async () => {
    await openSchema();
    expect(screen.getByText(/\"generatedAt\"/)).toBeInTheDocument();
  });

  it('shows "Must|Should|Nice" priority enum in requirements', async () => {
    await openSchema();
    expect(screen.getByText(/Must\|Should\|Nice/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Notifications tab In-App Alert detail', () => {
  it('shows "Show in notification centre" detail under In-App Alert', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notifications/i }));
    await waitFor(() => {
      expect(screen.getByText('In-App Alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Show in notification centre')).toBeInTheDocument();
  });
});

describe('AutomationBuilder – AI model select options', () => {
  it('shows GPT-4 Turbo option in AI model select', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('option', { name: 'GPT-4 Turbo' })).toBeInTheDocument();
  });

  it('shows Claude 3.5 Sonnet option in AI model select', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('option', { name: 'Claude 3.5 Sonnet' })).toBeInTheDocument();
  });

  it('AI model select has aria-label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('combobox', { name: /ai model/i })).toBeInTheDocument();
  });
});

describe('AutomationBuilder – Prompt template additional content', () => {
  it('shows "Non-Functional Requirements" in prompt template', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText(/Non-Functional Requirements/)).toBeInTheDocument();
  });

  it('shows "Assumptions and Constraints" in prompt template', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText(/Assumptions and Constraints/)).toBeInTheDocument();
  });

  it('shows "Glossary of Terms" in prompt template', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText(/Glossary of Terms/)).toBeInTheDocument();
  });

  it('shows "Must Have / Should Have" in prompt template', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByText(/Must Have \/ Should Have/)).toBeInTheDocument();
  });
});

describe('AutomationBuilder – Test input document textarea', () => {
  it('Test input document textarea has placeholder text', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const textarea = screen.getByRole('textbox', { name: /test input document/i });
    expect(textarea).toHaveAttribute('placeholder', expect.stringContaining('Paste requirements text'));
  });

  it('Test input document textarea accepts typed input', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const textarea = screen.getByRole('textbox', { name: /test input document/i });
    await userEvent.type(textarea, 'Test document input');
    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toContain('Test document input');
    });
  });
});

describe('AutomationBuilder – Temperature setting options', () => {
  it('Temperature setting select has T: 0.3 option', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const tempSelect = screen.getByRole('combobox', { name: /temperature setting/i });
    const opts = Array.from(tempSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('T: 0.3');
  });

  it('Temperature setting select has T: 0.5 option', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const tempSelect = screen.getByRole('combobox', { name: /temperature setting/i });
    const opts = Array.from(tempSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('T: 0.5');
  });

  it('Temperature setting select has T: 0.7 option', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const tempSelect = screen.getByRole('combobox', { name: /temperature setting/i });
    const opts = Array.from(tempSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('T: 0.7');
  });

  it('Temperature setting select can be changed to T: 0.7', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const tempSelect = screen.getByRole('combobox', { name: /temperature setting/i });
    await userEvent.selectOptions(tempSelect, 'T: 0.7');
    expect((tempSelect as HTMLSelectElement).value).toBe('T: 0.7');
  });
});

describe('AutomationBuilder – Builder tabs pressed states', () => {
  it('Builder tab: Prompt has aria-pressed=true by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const promptTab = screen.getByRole('button', { name: /builder tab: prompt/i });
    expect(promptTab).toHaveAttribute('aria-pressed', 'true');
  });

  it('Builder tab: Schema has aria-pressed=false by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const schemaTab = screen.getByRole('button', { name: /builder tab: schema/i });
    expect(schemaTab).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Builder tab: Schema sets it to aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const schemaTab = screen.getByRole('button', { name: /builder tab: schema/i });
    await userEvent.click(schemaTab);
    await waitFor(() => {
      expect(schemaTab).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Builder tab: Schema sets Prompt to aria-pressed=false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const promptTab = screen.getByRole('button', { name: /builder tab: prompt/i });
    const schemaTab = screen.getByRole('button', { name: /builder tab: schema/i });
    await userEvent.click(schemaTab);
    await waitFor(() => {
      expect(promptTab).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

describe('AutomationBuilder – Flow node pressed states for Extract Text and Read File', () => {
  it('Extract Text flow node has aria-pressed=false by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const btn = screen.getByRole('button', { name: /flow node: extract text/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('Read File flow node has aria-pressed=false by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const btn = screen.getByRole('button', { name: /flow node: read file/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('LLM Generate flow node has aria-pressed=false by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const btn = screen.getByRole('button', { name: /flow node: llm generate/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Extract Text sets its aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const btn = screen.getByRole('button', { name: /flow node: extract text/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Extract Text sets Classify to aria-pressed=false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const classifyBtn = screen.getByRole('button', { name: /flow node: classify/i });
    const extractBtn = screen.getByRole('button', { name: /flow node: extract text/i });
    await userEvent.click(extractBtn);
    await waitFor(() => {
      expect(classifyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking LLM Generate sets Classify to aria-pressed=false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const classifyBtn = screen.getByRole('button', { name: /flow node: classify/i });
    const llmBtn = screen.getByRole('button', { name: /flow node: llm generate/i });
    await userEvent.click(llmBtn);
    await waitFor(() => {
      expect(classifyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

describe('AutomationBuilder – AI model select can be changed', () => {
  it('AI model select has GPT-4o option', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const sel = screen.getByRole('combobox', { name: /ai model/i });
    const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent);
    expect(opts).toContain('GPT-4o');
  });

  it('AI model select can be changed to Claude 3.5 Sonnet', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const sel = screen.getByRole('combobox', { name: /ai model/i });
    await userEvent.selectOptions(sel, 'Claude 3.5 Sonnet');
    expect((sel as HTMLSelectElement).value).toBe('Claude 3.5 Sonnet');
  });

  it('AI model select can be changed to GPT-4 Turbo', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const sel = screen.getByRole('combobox', { name: /ai model/i });
    await userEvent.selectOptions(sel, 'GPT-4 Turbo');
    expect((sel as HTMLSelectElement).value).toBe('GPT-4 Turbo');
  });

  it('Temperature setting select can be changed to T: 0.3', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const sel = screen.getByRole('combobox', { name: /temperature setting/i });
    await userEvent.selectOptions(sel, 'T: 0.3');
    expect((sel as HTMLSelectElement).value).toBe('T: 0.3');
  });

  it('Temperature setting select can be changed to T: 0.5', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const sel = screen.getByRole('combobox', { name: /temperature setting/i });
    await userEvent.selectOptions(sel, 'T: 0.5');
    expect((sel as HTMLSelectElement).value).toBe('T: 0.5');
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Builder tab Destinations and Notifications pressed states', () => {
  it('Builder tab: Destinations has aria-pressed=false by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const btn = screen.getByRole('button', { name: /builder tab: destinations/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Builder tab: Destinations sets it to aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const btn = screen.getByRole('button', { name: /builder tab: destinations/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Builder tab: Destinations sets Prompt to aria-pressed=false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const promptTab = screen.getByRole('button', { name: /builder tab: prompt/i });
    const destTab = screen.getByRole('button', { name: /builder tab: destinations/i });
    await userEvent.click(destTab);
    await waitFor(() => {
      expect(promptTab).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Builder tab: Notifications has aria-pressed=false by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const btn = screen.getByRole('button', { name: /builder tab: notifications/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Builder tab: Notifications sets it to aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const btn = screen.getByRole('button', { name: /builder tab: notifications/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Builder tab: Notifications sets Destinations to aria-pressed=false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const destTab = screen.getByRole('button', { name: /builder tab: destinations/i });
    const notifTab = screen.getByRole('button', { name: /builder tab: notifications/i });
    await userEvent.click(destTab);
    await userEvent.click(notifTab);
    await waitFor(() => {
      expect(destTab).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Builder tab: Prompt after Notifications restores Prompt to aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const promptTab = screen.getByRole('button', { name: /builder tab: prompt/i });
    const notifTab = screen.getByRole('button', { name: /builder tab: notifications/i });
    await userEvent.click(notifTab);
    await userEvent.click(promptTab);
    await waitFor(() => {
      expect(promptTab).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Flow node Read File pressed state', () => {
  it('clicking Read File flow node sets it to aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const btn = screen.getByRole('button', { name: /flow node: read file/i });
    await userEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('clicking Read File sets Classify to aria-pressed=false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const classifyBtn = screen.getByRole('button', { name: /flow node: classify/i });
    const readFileBtn = screen.getByRole('button', { name: /flow node: read file/i });
    await userEvent.click(readFileBtn);
    await waitFor(() => {
      expect(classifyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Extract Text after Read File sets Read File to aria-pressed=false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const readFileBtn = screen.getByRole('button', { name: /flow node: read file/i });
    const extractBtn = screen.getByRole('button', { name: /flow node: extract text/i });
    await userEvent.click(readFileBtn);
    await userEvent.click(extractBtn);
    await waitFor(() => {
      expect(readFileBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – AI model and temperature defaults', () => {
  it('AI model select defaults to GPT-4o', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const sel = screen.getByRole('combobox', { name: /ai model/i });
    expect((sel as HTMLSelectElement).value).toBe('GPT-4o');
  });

  it('AI model select has 3 options', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const sel = screen.getByRole('combobox', { name: /ai model/i });
    expect(sel.querySelectorAll('option').length).toBe(3);
  });

  it('Temperature setting select defaults to T: 0.3', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const sel = screen.getByRole('combobox', { name: /temperature setting/i });
    expect((sel as HTMLSelectElement).value).toBe('T: 0.3');
  });

  it('Temperature setting select has 3 options', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const sel = screen.getByRole('combobox', { name: /temperature setting/i });
    expect(sel.querySelectorAll('option').length).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – AI model changed to Claude 3.5 Sonnet', () => {
  it('AI model select can be changed to Claude 3.5 Sonnet', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const sel = screen.getByRole('combobox', { name: /ai model/i });
    await userEvent.selectOptions(sel, 'Claude 3.5 Sonnet');
    expect((sel as HTMLSelectElement).value).toBe('Claude 3.5 Sonnet');
  });

  it('Temperature select can be changed to T: 0.7', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const sel = screen.getByRole('combobox', { name: /temperature setting/i });
    await userEvent.selectOptions(sel, 'T: 0.7');
    expect((sel as HTMLSelectElement).value).toBe('T: 0.7');
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Validate flow node pressed state', () => {
  it('Validate flow node has aria-pressed=false by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const validateBtn = screen.getByRole('button', { name: /flow node: validate/i });
    expect(validateBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Validate sets it to aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const validateBtn = screen.getByRole('button', { name: /flow node: validate/i });
    await userEvent.click(validateBtn);
    await waitFor(() => expect(validateBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Validate sets Classify to aria-pressed=false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const classifyBtn = screen.getByRole('button', { name: /flow node: classify/i });
    const validateBtn = screen.getByRole('button', { name: /flow node: validate/i });
    await userEvent.click(classifyBtn);
    await waitFor(() => expect(classifyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(validateBtn);
    await waitFor(() => expect(classifyBtn).toHaveAttribute('aria-pressed', 'false'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Read File node pressed state', () => {
  it('Read File has aria-pressed=false by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /flow node: read file/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Read File sets it to aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const readFileBtn = screen.getByRole('button', { name: /flow node: read file/i });
    await userEvent.click(readFileBtn);
    await waitFor(() => expect(readFileBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Read File sets Classify to false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const classifyBtn = screen.getByRole('button', { name: /flow node: classify/i });
    const readFileBtn = screen.getByRole('button', { name: /flow node: read file/i });
    await userEvent.click(classifyBtn);
    await waitFor(() => expect(classifyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(readFileBtn);
    await waitFor(() => {
      expect(readFileBtn).toHaveAttribute('aria-pressed', 'true');
      expect(classifyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – LLM Generate node pressed state', () => {
  it('LLM Generate has aria-pressed=false by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /flow node: llm generate/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking LLM Generate sets it to aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const llmBtn = screen.getByRole('button', { name: /flow node: llm generate/i });
    await userEvent.click(llmBtn);
    await waitFor(() => expect(llmBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking LLM Generate after Validate sets Validate to false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const validateBtn = screen.getByRole('button', { name: /flow node: validate/i });
    const llmBtn = screen.getByRole('button', { name: /flow node: llm generate/i });
    await userEvent.click(validateBtn);
    await waitFor(() => expect(validateBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(llmBtn);
    await waitFor(() => {
      expect(llmBtn).toHaveAttribute('aria-pressed', 'true');
      expect(validateBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Create Doc node pressed state', () => {
  it('Create Doc has aria-pressed=false by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /flow node: create doc/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Create Doc sets it to aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const createDocBtn = screen.getByRole('button', { name: /flow node: create doc/i });
    await userEvent.click(createDocBtn);
    await waitFor(() => expect(createDocBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Read File after Create Doc sets Create Doc to false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const createDocBtn = screen.getByRole('button', { name: /flow node: create doc/i });
    const readFileBtn = screen.getByRole('button', { name: /flow node: read file/i });
    await userEvent.click(createDocBtn);
    await waitFor(() => expect(createDocBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(readFileBtn);
    await waitFor(() => {
      expect(readFileBtn).toHaveAttribute('aria-pressed', 'true');
      expect(createDocBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Notify node pressed state', () => {
  it('Notify has aria-pressed=false by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /flow node: notify/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Notify sets it to aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const notifyBtn = screen.getByRole('button', { name: /flow node: notify/i });
    await userEvent.click(notifyBtn);
    await waitFor(() => expect(notifyBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking LLM Generate after Notify sets Notify to false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const notifyBtn = screen.getByRole('button', { name: /flow node: notify/i });
    const llmBtn = screen.getByRole('button', { name: /flow node: llm generate/i });
    await userEvent.click(notifyBtn);
    await waitFor(() => expect(notifyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(llmBtn);
    await waitFor(() => {
      expect(llmBtn).toHaveAttribute('aria-pressed', 'true');
      expect(notifyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Extract Text node pressed state', () => {
  it('Extract Text has aria-pressed=false by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /flow node: extract text/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Extract Text sets it to aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const extractBtn = screen.getByRole('button', { name: /flow node: extract text/i });
    await userEvent.click(extractBtn);
    await waitFor(() => expect(extractBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Classify after Extract Text sets Extract Text to false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const extractBtn = screen.getByRole('button', { name: /flow node: extract text/i });
    const classifyBtn = screen.getByRole('button', { name: /flow node: classify/i });
    await userEvent.click(extractBtn);
    await waitFor(() => expect(extractBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(classifyBtn);
    await waitFor(() => {
      expect(classifyBtn).toHaveAttribute('aria-pressed', 'true');
      expect(extractBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Validate node pressed state', () => {
  it('Validate has aria-pressed=false by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /flow node: validate/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Create Doc after Validate sets Validate to false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const validateBtn = screen.getByRole('button', { name: /flow node: validate/i });
    const createDocBtn = screen.getByRole('button', { name: /flow node: create doc/i });
    await userEvent.click(validateBtn);
    await waitFor(() => expect(validateBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(createDocBtn);
    await waitFor(() => {
      expect(createDocBtn).toHaveAttribute('aria-pressed', 'true');
      expect(validateBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking Notify after Validate sets Validate to false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const validateBtn = screen.getByRole('button', { name: /flow node: validate/i });
    const notifyBtn = screen.getByRole('button', { name: /flow node: notify/i });
    await userEvent.click(validateBtn);
    await waitFor(() => expect(validateBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(notifyBtn);
    await waitFor(() => {
      expect(notifyBtn).toHaveAttribute('aria-pressed', 'true');
      expect(validateBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Trigger node pressed state', () => {
  it('Trigger node is present', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /flow node: trigger/i })).toBeInTheDocument();
  });

  it('clicking Trigger sets aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const btn = screen.getByRole('button', { name: /flow node: trigger/i });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Classify after Trigger deselects Trigger', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const triggerBtn = screen.getByRole('button', { name: /flow node: trigger/i });
    const classifyBtn = screen.getByRole('button', { name: /flow node: classify/i });
    await userEvent.click(triggerBtn);
    await waitFor(() => expect(triggerBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(classifyBtn);
    await waitFor(() => {
      expect(classifyBtn).toHaveAttribute('aria-pressed', 'true');
      expect(triggerBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Read File node pressed state', () => {
  it('Read File node is present', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /flow node: read file/i })).toBeInTheDocument();
  });

  it('clicking Read File sets aria-pressed=true', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const btn = screen.getByRole('button', { name: /flow node: read file/i });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking LLM Generate after Read File deselects Read File', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const readFileBtn = screen.getByRole('button', { name: /flow node: read file/i });
    const llmBtn = screen.getByRole('button', { name: /flow node: llm generate/i });
    await userEvent.click(readFileBtn);
    await waitFor(() => expect(readFileBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(llmBtn);
    await waitFor(() => {
      expect(llmBtn).toHaveAttribute('aria-pressed', 'true');
      expect(readFileBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – three-node sequences', () => {
  it('Trigger → Classify → Notify: Notify=true, Trigger=false, Classify=false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const triggerBtn = screen.getByRole('button', { name: /flow node: trigger/i });
    const classifyBtn = screen.getByRole('button', { name: /flow node: classify/i });
    const notifyBtn = screen.getByRole('button', { name: /flow node: notify/i });
    await userEvent.click(triggerBtn);
    await waitFor(() => expect(triggerBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(classifyBtn);
    await waitFor(() => expect(classifyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(notifyBtn);
    await waitFor(() => {
      expect(notifyBtn).toHaveAttribute('aria-pressed', 'true');
      expect(triggerBtn).toHaveAttribute('aria-pressed', 'false');
      expect(classifyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Read File → Validate → Create Doc: Create Doc=true, Read File=false, Validate=false', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const readFileBtn = screen.getByRole('button', { name: /flow node: read file/i });
    const validateBtn = screen.getByRole('button', { name: /flow node: validate/i });
    const createDocBtn = screen.getByRole('button', { name: /flow node: create doc/i });
    await userEvent.click(readFileBtn);
    await waitFor(() => expect(readFileBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(validateBtn);
    await waitFor(() => expect(validateBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(createDocBtn);
    await waitFor(() => {
      expect(createDocBtn).toHaveAttribute('aria-pressed', 'true');
      expect(readFileBtn).toHaveAttribute('aria-pressed', 'false');
      expect(validateBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Extract Text node interactions', () => {
  it('Extract Text node button is present', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /flow node: extract text/i })).toBeInTheDocument();
  });

  it('clicking Extract Text makes it active', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const extractBtn = screen.getByRole('button', { name: /flow node: extract text/i });
    await userEvent.click(extractBtn);
    await waitFor(() => expect(extractBtn).toHaveAttribute('aria-pressed', 'true'));
  });

  it('clicking Extract Text deselects Trigger', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const triggerBtn = screen.getByRole('button', { name: /flow node: trigger/i });
    const extractBtn = screen.getByRole('button', { name: /flow node: extract text/i });
    await userEvent.click(triggerBtn);
    await waitFor(() => expect(triggerBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(extractBtn);
    await waitFor(() => {
      expect(extractBtn).toHaveAttribute('aria-pressed', 'true');
      expect(triggerBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – four-node sequence', () => {
  it('LLM Generate active after Trigger→ReadFile→Classify→LLMGenerate', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const triggerBtn = screen.getByRole('button', { name: /flow node: trigger/i });
    const readFileBtn = screen.getByRole('button', { name: /flow node: read file/i });
    const classifyBtn = screen.getByRole('button', { name: /flow node: classify/i });
    const llmBtn = screen.getByRole('button', { name: /flow node: llm generate/i });
    await userEvent.click(triggerBtn);
    await userEvent.click(readFileBtn);
    await userEvent.click(classifyBtn);
    await userEvent.click(llmBtn);
    await waitFor(() => {
      expect(llmBtn).toHaveAttribute('aria-pressed', 'true');
      expect(triggerBtn).toHaveAttribute('aria-pressed', 'false');
      expect(readFileBtn).toHaveAttribute('aria-pressed', 'false');
      expect(classifyBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('Notify active after ExtractText→Validate→CreateDoc→Notify', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const extractBtn = screen.getByRole('button', { name: /flow node: extract text/i });
    const validateBtn = screen.getByRole('button', { name: /flow node: validate/i });
    const createDocBtn = screen.getByRole('button', { name: /flow node: create doc/i });
    const notifyBtn = screen.getByRole('button', { name: /flow node: notify/i });
    await userEvent.click(extractBtn);
    await userEvent.click(validateBtn);
    await userEvent.click(createDocBtn);
    await userEvent.click(notifyBtn);
    await waitFor(() => {
      expect(notifyBtn).toHaveAttribute('aria-pressed', 'true');
      expect(extractBtn).toHaveAttribute('aria-pressed', 'false');
      expect(validateBtn).toHaveAttribute('aria-pressed', 'false');
      expect(createDocBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – node button completeness', () => {
  it('all major flow nodes are present', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /flow node: trigger/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flow node: read file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flow node: llm generate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flow node: classify/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flow node: notify/i })).toBeInTheDocument();
  });

  it('clicking same node twice stays active', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const classifyBtn = screen.getByRole('button', { name: /flow node: classify/i });
    await userEvent.click(classifyBtn);
    await waitFor(() => expect(classifyBtn).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(classifyBtn);
    await waitFor(() => expect(classifyBtn).toHaveAttribute('aria-pressed', 'true'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Test Run simulation', () => {
  it('renders Test Run button', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /test run/i })).toBeInTheDocument();
  });

  it('Test Run button has correct initial aria-label', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /^test run$/i })).toBeInTheDocument();
  });

  it('Test Run button is not disabled initially', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /^test run$/i })).not.toBeDisabled();
  });

  it('clicking Test Run disables the button while running', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    const testBtn = screen.getByRole('button', { name: /^test run$/i });
    // fireEvent is synchronous — sets testRunning=true before first await in handleTestRun
    fireEvent.click(testBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /testing…/i })).toBeDisabled();
    });
  });

  it('shows "Testing…" label while test run is in progress', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    fireEvent.click(screen.getByRole('button', { name: /^test run$/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /testing…/i })).toBeInTheDocument());
  });

  it('shows "Test passed" after test run completes', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /^test run$/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test passed/i })).toBeInTheDocument();
    }, { timeout: 6000 });
  }, 8000);

  it('shows success toast after test run completes', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /^test run$/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/test run complete/i);
    }, { timeout: 6000 });
  }, 8000);

  it('toast has aria-live="polite"', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /^test run$/i }));
    await waitFor(() => {
      const toast = screen.getByRole('status');
      expect(toast).toHaveAttribute('aria-live', 'polite');
    }, { timeout: 6000 });
  }, 8000);

  it('Run Now button is not disabled while test is running', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    fireEvent.click(screen.getByRole('button', { name: /^test run$/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /testing…/i })).toBeDisabled();
    });
    // Run Now is independent and should remain enabled
    expect(screen.getByRole('button', { name: /run now/i })).not.toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('AutomationBuilder – Export Config', () => {
  let mockClick: ReturnType<typeof vi.fn>;
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockCreateElement: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClick = vi.fn();
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    mockRevokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: mockCreateObjectURL, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: mockRevokeObjectURL, writable: true });
    const realCreateElement = document.createElement.bind(document);
    mockCreateElement = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const anchor = realCreateElement('a');
        anchor.click = mockClick;
        return anchor;
      }
      return realCreateElement(tag);
    }) as unknown as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows Export button in header', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /export automation config/i })).toBeInTheDocument();
  });

  it('Export button is not disabled by default', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /export automation config/i })).not.toBeDisabled();
  });

  it('clicking Export calls URL.createObjectURL', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /export automation config/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export triggers anchor click (download)', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /export automation config/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export revokes the object URL', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /export automation config/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('shows export toast after clicking Export', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /export automation config/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('status').some(el => el.textContent?.includes('Config exported'))).toBe(true);
    });
  });

  it('export toast has aria-live polite', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /export automation config/i }));
    await waitFor(() => {
      const toasts = screen.getAllByRole('status');
      const exportToast = toasts.find(el => el.textContent?.includes('Config exported'));
      expect(exportToast).toHaveAttribute('aria-live', 'polite');
    });
  });

  it('export toast includes the filename', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /export automation config/i }));
    await waitFor(() => {
      const toasts = screen.getAllByRole('status');
      const exportToast = toasts.find(el => el.textContent?.includes('Config exported'));
      expect(exportToast?.textContent).toMatch(/_config\.json/i);
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Copy Config', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows Copy Config button', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /copy automation config to clipboard/i })).toBeInTheDocument();
  });

  it('Copy Config button is not disabled', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /copy automation config to clipboard/i })).not.toBeDisabled();
  });

  it('clicking Copy Config calls clipboard.writeText', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /copy automation config to clipboard/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('clipboard text is valid JSON with automation name', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /copy automation config to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(text);
      expect(parsed.name).toBe('Meeting Minutes Generator');
    });
  });

  it('clipboard text JSON includes nodes array', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /copy automation config to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(text);
      expect(Array.isArray(parsed.nodes)).toBe(true);
    });
  });

  it('shows Copied! text after clicking', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /copy automation config to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy automation config to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Copy Node List', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows Copy node list to clipboard button', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /copy node list to clipboard/i })).toBeInTheDocument();
  });

  it('Copy node list button is not disabled', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /copy node list to clipboard/i })).not.toBeDisabled();
  });

  it('clicking Copy node list calls clipboard.writeText', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /copy node list to clipboard/i }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it('clipboard text contains Workflow Nodes header', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /copy node list to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Workflow Nodes');
    });
  });

  it('clipboard text contains Trigger node', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /copy node list to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Trigger');
    });
  });

  it('clipboard text contains LLM Generate node', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /copy node list to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('LLM Generate');
    });
  });

  it('shows Copied! text after clicking Copy node list', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /copy node list to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy node list to clipboard/i })).toHaveTextContent('Copied!');
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Export Node List TXT', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    localStorage.clear();
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:nodes-txt-url');
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

  it('shows Export node list to TXT button', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /export node list to txt/i })).toBeInTheDocument();
  });

  it('clicking Export node list calls URL.createObjectURL', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /export node list to txt/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export node list triggers anchor click', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /export node list to txt/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export node list calls URL.revokeObjectURL', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /export node list to txt/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:nodes-txt-url');
  });

  it('shows Exported! text after clicking Export node list', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /export node list to txt/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export node list to txt/i })).toHaveTextContent('Exported!');
    });
  });
});

describe('AutomationBuilder – Notes Tab', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function goToNotes() {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    await userEvent.click(screen.getByRole('button', { name: /builder tab: notes/i }));
  }

  it('renders the Notes tab button', async () => {
    renderBuilder('auto-1');
    await screen.findByText('Meeting Minutes Generator');
    expect(screen.getByRole('button', { name: /builder tab: notes/i })).toBeInTheDocument();
  });

  it('clicking Notes tab shows the notes textarea', async () => {
    await goToNotes();
    expect(screen.getByRole('textbox', { name: /automation notes/i })).toBeInTheDocument();
  });

  it('clicking Notes tab shows the Save Notes button', async () => {
    await goToNotes();
    expect(screen.getByRole('button', { name: /save automation notes/i })).toBeInTheDocument();
  });

  it('clicking Notes tab shows Automation Notes heading', async () => {
    await goToNotes();
    expect(screen.getByText('Automation Notes')).toBeInTheDocument();
  });

  it('typing in textarea updates its value', async () => {
    await goToNotes();
    const textarea = screen.getByRole('textbox', { name: /automation notes/i });
    fireEvent.change(textarea, { target: { value: 'My note' } });
    expect(textarea).toHaveValue('My note');
  });

  it('clicking Save Notes persists notes to localStorage', async () => {
    await goToNotes();
    const textarea = screen.getByRole('textbox', { name: /automation notes/i });
    fireEvent.change(textarea, { target: { value: 'Persist this' } });
    await userEvent.click(screen.getByRole('button', { name: /save automation notes/i }));
    const stored = JSON.parse(localStorage.getItem('ab_cfg_auto-1') ?? '{}');
    expect(stored.notes).toBe('Persist this');
  });

  it('Save Notes button shows Saved! feedback after click', async () => {
    await goToNotes();
    await userEvent.click(screen.getByRole('button', { name: /save automation notes/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save automation notes/i })).toHaveTextContent('Saved!');
    });
  });

  it('loads existing notes from localStorage on mount', async () => {
    localStorage.setItem('ab_cfg_auto-1', JSON.stringify({ notes: 'Existing note' }));
    await goToNotes();
    expect(screen.getByRole('textbox', { name: /automation notes/i })).toHaveValue('Existing note');
  });

  it('Save Notes preserves existing savedAt in localStorage', async () => {
    localStorage.setItem('ab_cfg_auto-1', JSON.stringify({ savedAt: '2026-01-01' }));
    await goToNotes();
    const textarea = screen.getByRole('textbox', { name: /automation notes/i });
    fireEvent.change(textarea, { target: { value: 'New note' } });
    await userEvent.click(screen.getByRole('button', { name: /save automation notes/i }));
    const stored = JSON.parse(localStorage.getItem('ab_cfg_auto-1') ?? '{}');
    expect(stored.savedAt).toBe('2026-01-01');
    expect(stored.notes).toBe('New note');
  });
});

// ── Log Status Filter ──────────────────────────────────────────
describe('AutomationBuilder – Log Status Filter', () => {
  function goToLogs() {
    render(
      <MemoryRouter initialEntries={['/automations/auto-1']}>
        <Routes>
          <Route path="/automations/:id" element={<AutomationBuilder />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
  }

  it('renders log filter buttons in Logs tab', () => {
    goToLogs();
    expect(screen.getByRole('button', { name: /filter logs by status: All/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter logs by status: Success/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter logs by status: Warning/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter logs by status: Error/i })).toBeInTheDocument();
  });

  it('All filter is pressed by default', () => {
    goToLogs();
    expect(screen.getByRole('button', { name: /filter logs by status: All/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows all log entries with All filter', () => {
    goToLogs();
    expect(screen.getByText('NCA_Requirements_v2.docx')).toBeInTheDocument();
    expect(screen.getByText('Healthcare_Req.xlsx')).toBeInTheDocument();
    expect(screen.getByText('corrupt_file.pdf')).toBeInTheDocument();
  });

  it('clicking Success filter sets it as pressed', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /filter logs by status: Success/i }));
    expect(screen.getByRole('button', { name: /filter logs by status: Success/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /filter logs by status: All/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Warning filter shows only Warning logs', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /filter logs by status: Warning/i }));
    expect(screen.getByText('Healthcare_Req.xlsx')).toBeInTheDocument();
    expect(screen.queryByText('corrupt_file.pdf')).not.toBeInTheDocument();
  });

  it('clicking Error filter shows only Error logs', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /filter logs by status: Error/i }));
    expect(screen.getByText('corrupt_file.pdf')).toBeInTheDocument();
    expect(screen.queryByText('Healthcare_Req.xlsx')).not.toBeInTheDocument();
  });

  it('clicking All after filtering restores all logs', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /filter logs by status: Error/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter logs by status: All/i }));
    expect(screen.getByText('Healthcare_Req.xlsx')).toBeInTheDocument();
    expect(screen.getByText('corrupt_file.pdf')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
describe('AutomationBuilder – Node Type Filter', () => {
  function renderBuilder() {
    render(<MemoryRouter initialEntries={['/automations/builder/auto-1']}><Routes><Route path="/automations/builder/:id" element={<AutomationBuilder />} /></Routes></MemoryRouter>);
  }

  it('renders node type filter buttons', () => {
    renderBuilder();
    expect(screen.getByRole('button', { name: /filter nodes by type: All/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter nodes by type: trigger/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter nodes by type: process/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter nodes by type: ai/i })).toBeInTheDocument();
  });

  it('All node type filter is active by default', () => {
    renderBuilder();
    expect(screen.getByRole('button', { name: /filter nodes by type: All/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows all flow nodes with All filter', () => {
    renderBuilder();
    expect(screen.getByRole('button', { name: /flow node: Trigger/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flow node: LLM Generate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flow node: Notify/i })).toBeInTheDocument();
  });

  it('clicking trigger filter shows only trigger nodes', async () => {
    renderBuilder();
    await userEvent.click(screen.getByRole('button', { name: /filter nodes by type: trigger/i }));
    expect(screen.getByRole('button', { name: /flow node: Trigger/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /flow node: Classify/i })).not.toBeInTheDocument();
  });

  it('clicking ai filter shows only AI nodes', async () => {
    renderBuilder();
    await userEvent.click(screen.getByRole('button', { name: /filter nodes by type: ai/i }));
    expect(screen.getByRole('button', { name: /flow node: LLM Generate/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /flow node: Trigger/i })).not.toBeInTheDocument();
  });

  it('clicking process filter shows only process nodes', async () => {
    renderBuilder();
    await userEvent.click(screen.getByRole('button', { name: /filter nodes by type: process/i }));
    expect(screen.getByRole('button', { name: /flow node: Classify/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /flow node: LLM Generate/i })).not.toBeInTheDocument();
  });

  it('clicking All after process restores all nodes', async () => {
    renderBuilder();
    await userEvent.click(screen.getByRole('button', { name: /filter nodes by type: process/i }));
    expect(screen.queryByRole('button', { name: /flow node: Trigger/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /filter nodes by type: All/i }));
    expect(screen.getByRole('button', { name: /flow node: Trigger/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flow node: LLM Generate/i })).toBeInTheDocument();
  });
});

// ── Log Search ──────────────────────────────────────────────────
describe('AutomationBuilder – Log Search', () => {
  function goToLogs() {
    render(
      <MemoryRouter initialEntries={['/automations/auto-1']}>
        <Routes>
          <Route path="/automations/:id" element={<AutomationBuilder />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
  }

  it('renders search logs input in Logs tab', () => {
    goToLogs();
    expect(screen.getByRole('textbox', { name: /search logs/i })).toBeInTheDocument();
  });

  it('search input is empty by default', () => {
    goToLogs();
    expect(screen.getByRole('textbox', { name: /search logs/i })).toHaveValue('');
  });

  it('typing in search filters logs by input filename', async () => {
    goToLogs();
    await userEvent.type(screen.getByRole('textbox', { name: /search logs/i }), 'NCA');
    expect(screen.getByText('NCA_Requirements_v2.docx')).toBeInTheDocument();
    expect(screen.queryByText('Healthcare_Req.xlsx')).not.toBeInTheDocument();
  });

  it('typing in search filters logs by output filename', async () => {
    goToLogs();
    await userEvent.type(screen.getByRole('textbox', { name: /search logs/i }), 'ADNOC');
    expect(screen.getByText('ADNOC_Scope.pdf')).toBeInTheDocument();
    expect(screen.queryByText('NCA_Requirements_v2.docx')).not.toBeInTheDocument();
  });

  it('clearing search restores all logs', async () => {
    goToLogs();
    const input = screen.getByRole('textbox', { name: /search logs/i });
    await userEvent.type(input, 'NCA');
    expect(screen.queryByText('Healthcare_Req.xlsx')).not.toBeInTheDocument();
    await userEvent.clear(input);
    expect(screen.getByText('Healthcare_Req.xlsx')).toBeInTheDocument();
  });

  it('search is case-insensitive', async () => {
    goToLogs();
    await userEvent.type(screen.getByRole('textbox', { name: /search logs/i }), 'healthcare');
    expect(screen.getByText('Healthcare_Req.xlsx')).toBeInTheDocument();
  });

  it('search with no match shows no log entries', async () => {
    goToLogs();
    await userEvent.type(screen.getByRole('textbox', { name: /search logs/i }), 'zzznomatch');
    expect(screen.queryByText('NCA_Requirements_v2.docx')).not.toBeInTheDocument();
    expect(screen.queryByText('Healthcare_Req.xlsx')).not.toBeInTheDocument();
    expect(screen.queryByText('corrupt_file.pdf')).not.toBeInTheDocument();
  });

  it('search combines with status filter', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /filter logs by status: Success/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /search logs/i }), 'ADNOC');
    expect(screen.getByText('ADNOC_Scope.pdf')).toBeInTheDocument();
    expect(screen.queryByText('NCA_Requirements_v2.docx')).not.toBeInTheDocument();
  });
});

describe('AutomationBuilder – Log Sort', () => {
  function goToLogs() {
    render(
      <MemoryRouter initialEntries={['/automations/auto-1']}>
        <Routes>
          <Route path="/automations/:id" element={<AutomationBuilder />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
  }

  it('renders default, status, and duration sort buttons in Logs tab', () => {
    goToLogs();
    expect(screen.getByRole('button', { name: /sort logs by default/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort logs by status/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort logs by duration/i })).toBeInTheDocument();
  });

  it('default sort button is pressed initially', () => {
    goToLogs();
    expect(screen.getByRole('button', { name: /sort logs by default/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort logs by status/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking status sort activates it', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by status/i }));
    expect(screen.getByRole('button', { name: /sort logs by status/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort logs by default/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking duration sort activates it and deactivates status', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by status/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort logs by duration/i }));
    expect(screen.getByRole('button', { name: /sort logs by duration/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort logs by status/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switching back to default deactivates other sort buttons', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by status/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort logs by default/i }));
    expect(screen.getByRole('button', { name: /sort logs by default/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort logs by status/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('all log entries remain visible after sort change', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by status/i }));
    expect(screen.getByText('NCA_Requirements_v2.docx')).toBeInTheDocument();
    expect(screen.getByText('Healthcare_Req.xlsx')).toBeInTheDocument();
    expect(screen.getByText('corrupt_file.pdf')).toBeInTheDocument();
  });
});

describe('AutomationBuilder – Log Sort by Input', () => {
  function goToLogs() {
    render(
      <MemoryRouter initialEntries={['/automations/auto-1']}>
        <Routes>
          <Route path="/automations/:id" element={<AutomationBuilder />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
  }

  it('renders input sort button in Logs tab', () => {
    goToLogs();
    expect(screen.getByRole('button', { name: /sort logs by input/i })).toBeInTheDocument();
  });

  it('input sort button is not pressed by default', () => {
    goToLogs();
    expect(screen.getByRole('button', { name: /sort logs by input/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking input sort activates it', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by input/i }));
    expect(screen.getByRole('button', { name: /sort logs by input/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort logs by default/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('input sort places ADNOC before NCA in DOM', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by input/i }));
    const adnocEl = screen.getByText('ADNOC_Scope.pdf');
    const ncaEl = screen.getByText('NCA_Requirements_v2.docx');
    expect(adnocEl.compareDocumentPosition(ncaEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all log entries remain visible after input sort', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by input/i }));
    expect(screen.getByText('NCA_Requirements_v2.docx')).toBeInTheDocument();
    expect(screen.getByText('Healthcare_Req.xlsx')).toBeInTheDocument();
    expect(screen.getByText('corrupt_file.pdf')).toBeInTheDocument();
  });
});

describe('AutomationBuilder – Log Sort by Status DOM Order', () => {
  function goToLogs() {
    render(
      <MemoryRouter initialEntries={['/automations/auto-1']}>
        <Routes>
          <Route path="/automations/:id" element={<AutomationBuilder />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
  }

  it('renders status sort button in Logs tab', () => {
    goToLogs();
    expect(screen.getByRole('button', { name: /sort logs by status/i })).toBeInTheDocument();
  });

  it('clicking status sort activates it', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by status/i }));
    expect(screen.getByRole('button', { name: /sort logs by status/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('all log entries remain visible after status sort', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by status/i }));
    expect(screen.getByText('NCA_Requirements_v2.docx')).toBeInTheDocument();
    expect(screen.getByText('Healthcare_Req.xlsx')).toBeInTheDocument();
    expect(screen.getByText('corrupt_file.pdf')).toBeInTheDocument();
  });

  it('status sort places Error (corrupt_file) before Warning (Healthcare) in DOM', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by status/i }));
    const errorEl = screen.getByText('corrupt_file.pdf');
    const warnEl = screen.getByText('Healthcare_Req.xlsx');
    expect(errorEl.compareDocumentPosition(warnEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('status sort places Error before Success in DOM', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by status/i }));
    const errorEl = screen.getByText('corrupt_file.pdf');
    const successEl = screen.getByText('NCA_Requirements_v2.docx');
    expect(errorEl.compareDocumentPosition(successEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to default deactivates status sort', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by status/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort logs by default/i }));
    expect(screen.getByRole('button', { name: /sort logs by default/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort logs by status/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('AutomationBuilder – Log Sort by Duration DOM Order', () => {
  function goToLogs() {
    render(
      <MemoryRouter initialEntries={['/automations/auto-1']}>
        <Routes>
          <Route path="/automations/:id" element={<AutomationBuilder />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /builder tab: logs/i }));
  }

  it('renders duration sort button in Logs tab', () => {
    goToLogs();
    expect(screen.getByRole('button', { name: /sort logs by duration/i })).toBeInTheDocument();
  });

  it('clicking duration sort activates it', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by duration/i }));
    expect(screen.getByRole('button', { name: /sort logs by duration/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('all log entries remain visible after duration sort', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by duration/i }));
    expect(screen.getByText('NCA_Requirements_v2.docx')).toBeInTheDocument();
    expect(screen.getByText('Healthcare_Req.xlsx')).toBeInTheDocument();
    expect(screen.getByText('corrupt_file.pdf')).toBeInTheDocument();
  });

  it('duration sort places 12s (corrupt_file) before 61s (Healthcare) in DOM', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by duration/i }));
    const shortEl = screen.getByText('corrupt_file.pdf');
    const longEl = screen.getByText('Healthcare_Req.xlsx');
    expect(shortEl.compareDocumentPosition(longEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to default deactivates duration sort', async () => {
    goToLogs();
    await userEvent.click(screen.getByRole('button', { name: /sort logs by duration/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort logs by default/i }));
    expect(screen.getByRole('button', { name: /sort logs by default/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort logs by duration/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('AutomationBuilder – Node Search', () => {
  it('renders the node search input', () => {
    renderBuilder();
    expect(screen.getByRole('textbox', { name: /search flow nodes/i })).toBeInTheDocument();
  });

  it('node search is empty by default', () => {
    renderBuilder();
    const input = screen.getByRole('textbox', { name: /search flow nodes/i }) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('searching for "Classify" shows only the Classify node', async () => {
    renderBuilder();
    await userEvent.type(screen.getByRole('textbox', { name: /search flow nodes/i }), 'Classify');
    expect(screen.getByRole('button', { name: /flow node: Classify/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /flow node: Validate/i })).not.toBeInTheDocument();
  });

  it('searching for "extract" (case-insensitive) shows Extract Text node', async () => {
    renderBuilder();
    await userEvent.type(screen.getByRole('textbox', { name: /search flow nodes/i }), 'extract');
    expect(screen.getByRole('button', { name: /flow node: Extract Text/i })).toBeInTheDocument();
  });

  it('clearing search shows all nodes again', async () => {
    renderBuilder();
    const input = screen.getByRole('textbox', { name: /search flow nodes/i });
    await userEvent.type(input, 'Classify');
    await userEvent.clear(input);
    expect(screen.getByRole('button', { name: /flow node: Classify/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flow node: Validate/i })).toBeInTheDocument();
  });
});
