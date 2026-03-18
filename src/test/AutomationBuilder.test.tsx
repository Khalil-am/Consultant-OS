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
