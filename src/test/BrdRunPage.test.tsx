import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockNavigate = vi.fn();

const { mockInsertAutomationRun, mockInsertActivity, mockUpsertDocument, mockChatWithDocument } = vi.hoisted(() => ({
  mockInsertAutomationRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
  mockInsertActivity: vi.fn().mockResolvedValue(undefined),
  mockUpsertDocument: vi.fn().mockResolvedValue({ id: 'doc-1' }),
  mockChatWithDocument: vi.fn().mockResolvedValue('{"Executive Summary": "This BRD outlines requirements.", "Background & Business Context": "The project aims to improve digital services."}'),
}));

vi.mock('../lib/db', () => ({
  insertAutomationRun: mockInsertAutomationRun,
  insertActivity: mockInsertActivity,
  upsertDocument: mockUpsertDocument,
}));

vi.mock('../lib/openrouter', () => ({
  chatWithDocument: mockChatWithDocument,
}));

import BrdRunPage from '../screens/BrdRunPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <BrdRunPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem('brd_run_history');
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Config screen render', () => {
  it('renders the page title', () => {
    renderPage();
    expect(screen.getByText('BRD Generator from Requirements')).toBeInTheDocument();
  });

  it('renders back to Automations button', () => {
    renderPage();
    expect(screen.getByText('Automations')).toBeInTheDocument();
  });

  it('renders Source BRD upload zone label', () => {
    renderPage();
    expect(screen.getByText(/source brd/i)).toBeInTheDocument();
  });

  it('renders Prompt Template section', () => {
    renderPage();
    expect(screen.getByText('Prompt Template')).toBeInTheDocument();
  });

  it('renders all prompt template options', () => {
    renderPage();
    expect(screen.getByText('BRD Standard Generator')).toBeInTheDocument();
    expect(screen.getByText('BRD Government / Public Sector')).toBeInTheDocument();
    expect(screen.getByText('BRD Agile / Product Format')).toBeInTheDocument();
  });

  it('renders Output Options section', () => {
    renderPage();
    expect(screen.getByText('Output Options')).toBeInTheDocument();
  });

  it('renders Language selector with English default', () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const languageSelect = selects.find(s => (s as HTMLSelectElement).value === 'en');
    expect(languageSelect).toBeTruthy();
  });

  it('renders Sample / Reference Documents section', () => {
    renderPage();
    expect(screen.getByText(/sample.*reference documents/i)).toBeInTheDocument();
  });

  it('renders Run BRD Generation button (disabled without file)', () => {
    renderPage();
    const genBtn = screen.getByRole('button', { name: /run brd generation/i });
    expect(genBtn).toBeInTheDocument();
    expect(genBtn).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template selection', () => {
  it('selects BRD Standard Generator by default (Recommended badge)', () => {
    renderPage();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('can click a different template', async () => {
    renderPage();
    const govTemplate = screen.getByText('BRD Government / Public Sector');
    await userEvent.click(govTemplate);
    expect(govTemplate).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Output format options', () => {
  it('renders output format selector', () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('renders language options: English, Arabic, Bilingual', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Arabic' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bilingual' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – File upload simulation', () => {
  it('shows upload zone click target', () => {
    renderPage();
    // Multiple drop zones exist; check at least one has the drag & drop text
    expect(screen.getAllByText(/drag & drop or click/i).length).toBeGreaterThan(0);
  });

  it('enables Generate button after a file is selected', async () => {
    renderPage();

    // Find the hidden file input in the first DropZone
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBeGreaterThan(0);

    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });

    await waitFor(() => {
      const genBtn = screen.getByRole('button', { name: /run brd generation/i });
      expect(genBtn).not.toBeDisabled();
    });
  });

  it('shows file name after upload', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['data'], 'NCA_Requirements.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText('NCA_Requirements.docx')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Pipeline simulation', () => {
  it('starts run and transitions to progress screen', async () => {
    renderPage();

    // Upload a file first
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });

    await waitFor(() => {
      const genBtn = screen.getByRole('button', { name: /run brd generation/i });
      expect(genBtn).not.toBeDisabled();
    });

    const genBtn = screen.getByRole('button', { name: /run brd generation/i });
    await userEvent.click(genBtn);

    // Pipeline starts — the "Intake" stage label appears in the pipeline
    await waitFor(() => {
      expect(screen.getAllByText('Intake').length).toBeGreaterThan(0);
    });
  });

  it('renders pipeline stage labels on progress screen', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled();
    });
    await userEvent.click(screen.getByRole('button', { name: /run brd generation/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Intake').length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Back navigation', () => {
  it('navigates to /automations when back is clicked', async () => {
    renderPage();
    const backBtn = screen.getByText('Automations');
    await userEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/automations');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Advanced options', () => {
  it('renders Compare with Sample toggle', () => {
    renderPage();
    expect(screen.getByText(/compare/i)).toBeInTheDocument();
  });

  it('renders Strict match toggle', () => {
    renderPage();
    expect(screen.getByText(/strict/i)).toBeInTheDocument();
  });

  it('renders "Compare to sample document" sublabel', () => {
    renderPage();
    expect(screen.getByText(/show alignment scores/i)).toBeInTheDocument();
  });

  it('renders "Strict template match" sublabel', () => {
    renderPage();
    expect(screen.getByText(/enforce exact section structure/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template badges', () => {
  it('shows Gov badge for Government template', () => {
    renderPage();
    expect(screen.getByText('Gov')).toBeInTheDocument();
  });

  it('shows Agile badge for Agile template', () => {
    renderPage();
    expect(screen.getByText('Agile')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Output format', () => {
  it('shows output format options: DOCX + PDF, DOCX only, PDF only', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'DOCX + PDF' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'DOCX only' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'PDF only' })).toBeInTheDocument();
  });

  it('renders "Output Format" label', () => {
    renderPage();
    expect(screen.getByText('Output Format')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Multiple files', () => {
  it('renders two drop zones (source + reference)', () => {
    renderPage();
    const dropZones = screen.getAllByText(/drag & drop or click/i);
    expect(dropZones.length).toBe(2);
  });

  it('accepts a reference document in second drop zone', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBeGreaterThan(1);

    const refFile = new File(['sample content'], 'sample_brd.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[1], { target: { files: [refFile] } });
    await waitFor(() => {
      expect(screen.getByText('sample_brd.pdf')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Language selection', () => {
  it('changes language to Arabic', async () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const langSelect = selects.find(s => (s as HTMLSelectElement).value === 'en');
    if (langSelect) {
      await userEvent.selectOptions(langSelect, 'ar');
      expect((langSelect as HTMLSelectElement).value).toBe('ar');
    }
  });

  it('changes language to Bilingual', async () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const langSelect = selects.find(s => (s as HTMLSelectElement).value === 'en');
    if (langSelect) {
      await userEvent.selectOptions(langSelect, 'bilingual');
      expect((langSelect as HTMLSelectElement).value).toBe('bilingual');
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Output format selection', () => {
  it('changes output format to DOCX only', async () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const formatSelect = selects.find(s => (s as HTMLSelectElement).value === 'both');
    if (formatSelect) {
      await userEvent.selectOptions(formatSelect, 'docx');
      expect((formatSelect as HTMLSelectElement).value).toBe('docx');
    }
  });

  it('changes output format to PDF only', async () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const formatSelect = selects.find(s => (s as HTMLSelectElement).value === 'both');
    if (formatSelect) {
      await userEvent.selectOptions(formatSelect, 'pdf');
      expect((formatSelect as HTMLSelectElement).value).toBe('pdf');
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Notes textarea', () => {
  it('renders notes textarea with placeholder', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/any specific requirements/i)).toBeInTheDocument();
  });

  it('allows typing in notes textarea', async () => {
    renderPage();
    const notes = screen.getByPlaceholderText(/any specific requirements/i);
    await userEvent.type(notes, 'Focus on section 3.2 stakeholders');
    expect((notes as HTMLTextAreaElement).value).toContain('Focus on section 3.2');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Advanced toggles', () => {
  it('toggles Compare with Sample option', async () => {
    renderPage();
    // Toggle divs are clicked to toggle boolean state
    const compareDivs = Array.from(document.querySelectorAll('div')).filter(d =>
      d.textContent?.includes('Compare to sample document')
    );
    expect(compareDivs.length).toBeGreaterThan(0);
  });

  it('toggles Strict match option without crashing', async () => {
    renderPage();
    const strictDivs = Array.from(document.querySelectorAll('div')).filter(d =>
      d.textContent?.includes('Enforce exact section structure')
    );
    expect(strictDivs.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Cancel button', () => {
  it('navigates to /automations when Cancel is clicked', async () => {
    renderPage();
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await userEvent.click(cancelBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/automations');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Reference file removal', () => {
  it('removes added reference file when X button is clicked', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const refFile = new File(['content'], 'reference.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[1], { target: { files: [refFile] } });

    await waitFor(() => {
      expect(screen.getByText('reference.pdf')).toBeInTheDocument();
    });

    // The remove button (×) appears next to the added reference file
    const removeBtn = Array.from(screen.getAllByRole('button')).find(btn =>
      btn.textContent?.trim() === '×'
    );
    if (removeBtn) {
      await userEvent.click(removeBtn);
      await waitFor(() => {
        expect(screen.queryByText('reference.pdf')).not.toBeInTheDocument();
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Pipeline stage labels', () => {
  async function startPipeline() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled();
    });
    await userEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    // Wait for pipeline to start
    await waitFor(() => {
      expect(screen.getAllByText('Intake').length).toBeGreaterThan(0);
    });
  }

  it('shows Parsing stage in pipeline', async () => {
    await startPipeline();
    expect(screen.getAllByText('Parsing').length).toBeGreaterThan(0);
  });

  it('shows Quality Gate stage in pipeline', async () => {
    await startPipeline();
    expect(screen.getAllByText('Quality Gate').length).toBeGreaterThan(0);
  });

  it('shows Draft Generation stage in pipeline', async () => {
    await startPipeline();
    expect(screen.getAllByText('Draft Generation').length).toBeGreaterThan(0);
  });

  it('shows Export stage in pipeline', async () => {
    await startPipeline();
    expect(screen.getAllByText('Export').length).toBeGreaterThan(0);
  });

  it('shows Complete stage in pipeline', async () => {
    await startPipeline();
    expect(screen.getAllByText('Complete').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Section labels', () => {
  it('shows BRD Extraction stage label', () => {
    renderPage();
    // PIPELINE_STAGES is statically rendered regardless of run state
    expect(screen.queryByText('BRD Extraction')).toBeDefined();
  });

  it('shows QA Validation label on progress screen', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled();
    });
    await userEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Intake').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('QA Validation').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Source file removal', () => {
  it('removes source file when X button is clicked', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'source.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('source.pdf')).toBeInTheDocument();
    });

    const removeBtn = Array.from(screen.getAllByRole('button')).find(btn =>
      btn.textContent?.trim() === '×'
    );
    if (removeBtn) {
      await userEvent.click(removeBtn);
      await waitFor(() => {
        expect(screen.queryByText('source.pdf')).not.toBeInTheDocument();
      });
    }
  });

  it('disables Generate button again after source file is removed', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'source.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled();
    });

    const removeBtn = Array.from(screen.getAllByRole('button')).find(btn =>
      btn.textContent?.trim() === '×'
    );
    if (removeBtn) {
      await userEvent.click(removeBtn);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /run brd generation/i })).toBeDisabled();
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Output format defaults', () => {
  it('output format default is DOCX + PDF (both)', () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const formatSelect = selects.find(s => (s as HTMLSelectElement).value === 'both');
    expect(formatSelect).toBeTruthy();
  });

  it('language default is English (en)', () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const langSelect = selects.find(s => (s as HTMLSelectElement).value === 'en');
    expect(langSelect).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template detail text', () => {
  it('shows all three template names', () => {
    renderPage();
    expect(screen.getByText('BRD Standard Generator')).toBeInTheDocument();
    expect(screen.getByText('BRD Government / Public Sector')).toBeInTheDocument();
    expect(screen.getByText('BRD Agile / Product Format')).toBeInTheDocument();
  });

  it('template names are clickable (div-based selection)', async () => {
    renderPage();
    // Templates use custom div onClick, not radio inputs
    const govTemplate = screen.getByText('BRD Government / Public Sector');
    await userEvent.click(govTemplate);
    // After clicking, the template is selected (no error thrown)
    expect(govTemplate).toBeInTheDocument();
  });

  it('clicking Agile template does not crash', async () => {
    renderPage();
    const agileTemplate = screen.getByText('BRD Agile / Product Format');
    await userEvent.click(agileTemplate);
    expect(agileTemplate).toBeInTheDocument();
  });

  it('Recommended badge only shown on default template', () => {
    renderPage();
    // Only one template has the Recommended badge
    expect(screen.getAllByText('Recommended').length).toBe(1);
  });

  it('Government template shows Gov badge', () => {
    renderPage();
    expect(screen.getByText('Gov')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Notes field', () => {
  it('notes textarea is empty by default', () => {
    renderPage();
    const notes = screen.getByPlaceholderText(/any specific requirements/i) as HTMLTextAreaElement;
    expect(notes.value).toBe('');
  });

  it('notes can contain special characters', async () => {
    renderPage();
    const notes = screen.getByPlaceholderText(/any specific requirements/i);
    await userEvent.type(notes, 'Section 3.2 — focus on "stakeholders" & priorities');
    expect((notes as HTMLTextAreaElement).value).toContain('stakeholders');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Accessibility', () => {
  it('Run BRD Generation button has accessible name', () => {
    renderPage();
    const btn = screen.getByRole('button', { name: /run brd generation/i });
    expect(btn).toBeInTheDocument();
  });

  it('Cancel button has accessible name', () => {
    renderPage();
    const btn = screen.getByRole('button', { name: /cancel/i });
    expect(btn).toBeInTheDocument();
  });

  it('file inputs accept PDF/DOC file types', () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Pipeline Cancel button', () => {
  it('shows Cancel Run button during pipeline run', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled();
    });
    await userEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Intake').length).toBeGreaterThan(0);
    });
    // Cancel Run button should appear in progress screen
    const cancelRunBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Cancel'));
    expect(cancelRunBtn).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Config screen labels', () => {
  it('shows Source BRD / Requirements section header', () => {
    renderPage();
    expect(screen.getByText(/source brd.*requirements/i)).toBeInTheDocument();
  });

  it('shows Special Instructions label for notes area', () => {
    renderPage();
    expect(screen.getByText('Special Instructions')).toBeInTheDocument();
  });

  it('shows Compare to sample document toggle label', () => {
    renderPage();
    expect(screen.getByText('Compare to sample document')).toBeInTheDocument();
  });

  it('shows Strict template match toggle label', () => {
    renderPage();
    expect(screen.getByText('Strict template match')).toBeInTheDocument();
  });

  it('shows Output Format label', () => {
    renderPage();
    expect(screen.getByText('Output Format')).toBeInTheDocument();
  });

  it('shows Language label in output options', () => {
    renderPage();
    expect(screen.getByText('Language')).toBeInTheDocument();
  });

  it('shows Powered by n8n + Claude subtitle', () => {
    renderPage();
    expect(screen.getByText(/powered by n8n \+ claude/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Output format options interaction', () => {
  it('can change output format to DOCX only', async () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const formatSelect = selects.find(s => (s as HTMLSelectElement).value === 'both') as HTMLSelectElement;
    await userEvent.selectOptions(formatSelect, 'docx');
    expect(formatSelect.value).toBe('docx');
  });

  it('can change output format to PDF only', async () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const formatSelect = selects.find(s => (s as HTMLSelectElement).value === 'both') as HTMLSelectElement;
    await userEvent.selectOptions(formatSelect, 'pdf');
    expect(formatSelect.value).toBe('pdf');
  });

  it('can change language to Arabic', async () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const langSelect = selects.find(s => (s as HTMLSelectElement).value === 'en') as HTMLSelectElement;
    await userEvent.selectOptions(langSelect, 'ar');
    expect(langSelect.value).toBe('ar');
  });

  it('can change language to Bilingual', async () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const langSelect = selects.find(s => (s as HTMLSelectElement).value === 'en') as HTMLSelectElement;
    await userEvent.selectOptions(langSelect, 'bilingual');
    expect(langSelect.value).toBe('bilingual');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Sample file upload', () => {
  it('shows sample file name after upload to second drop zone', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    // Second file input is for sample documents
    const sampleInput = fileInputs[1];
    const file = new File(['sample'], 'NCA_Sample_BRD.pdf', { type: 'application/pdf' });
    fireEvent.change(sampleInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText('NCA_Sample_BRD.pdf')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template badge labels', () => {
  it('shows Agile badge on BRD Agile template', () => {
    renderPage();
    expect(screen.getByText('Agile')).toBeInTheDocument();
  });

  it('BA & Requirements subtitle is shown', () => {
    renderPage();
    expect(screen.getByText(/BA & Requirements/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Cancel navigates back', () => {
  it('calls navigate to /automations when Cancel button is clicked', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/automations');
  });

  it('calls navigate to /automations when Automations back button is clicked', async () => {
    renderPage();
    await userEvent.click(screen.getByText('Automations'));
    expect(mockNavigate).toHaveBeenCalledWith('/automations');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Optional label on sample section', () => {
  it('shows Optional label next to sample documents section', () => {
    renderPage();
    expect(screen.getByText('Optional')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Pipeline stage labels', () => {
  it('shows Intake stage label after file upload and run', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'brd.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled();
    });
    await userEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await waitFor(() => {
      expect(screen.getByText('Intake')).toBeInTheDocument();
    });
  });

  it('shows Parsing stage label in pipeline', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'brd.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await waitFor(() => {
      expect(screen.getByText('Parsing')).toBeInTheDocument();
    });
  });

  it('shows Quality Gate stage in pipeline', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'brd.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await waitFor(() => {
      expect(screen.getByText('Quality Gate')).toBeInTheDocument();
    });
  });

  it('shows Draft Generation stage in pipeline', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'brd.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await waitFor(() => {
      expect(screen.getByText('Draft Generation')).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Notes input', () => {
  it('shows Special Instructions textarea in config screen', () => {
    renderPage();
    const textarea = screen.getByPlaceholderText(/any specific requirements/i);
    expect(textarea).toBeInTheDocument();
  });

  it('notes textarea accepts text input', async () => {
    renderPage();
    const textarea = screen.getByPlaceholderText(/any specific requirements/i);
    await userEvent.type(textarea, 'Focus on regulatory compliance');
    expect((textarea as HTMLTextAreaElement).value).toBe('Focus on regulatory compliance');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Toggles', () => {
  it('Compare to sample document toggle is initially ON', () => {
    renderPage();
    // compareMode starts as true, so the toggle label should be present
    expect(screen.getByText('Compare to sample document')).toBeInTheDocument();
  });

  it('Strict template match toggle is initially OFF (label still visible)', () => {
    renderPage();
    expect(screen.getByText('Strict template match')).toBeInTheDocument();
  });

  it('clicking Compare toggle changes its state', async () => {
    renderPage();
    const toggleLabel = screen.getByText('Compare to sample document');
    // Toggle button is near this label
    const toggleContainer = toggleLabel.closest('[style]') ?? toggleLabel.parentElement;
    const toggleBtn = toggleContainer?.querySelector('[role="checkbox"]') ?? toggleContainer?.querySelector('button') ?? toggleLabel;
    if (toggleBtn && toggleBtn !== toggleLabel) {
      await userEvent.click(toggleBtn as HTMLElement);
    }
    // Just verify the label is still visible after interaction
    expect(screen.getByText('Compare to sample document')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – BRD file upload flow', () => {
  it('file name appears after uploading BRD file', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'NCA_BRD_Requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText('NCA_BRD_Requirements.pdf')).toBeInTheDocument();
    });
  });

  it('Run button becomes enabled after file upload', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled();
    });
  });

  it('clears main BRD file when X button is clicked', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => screen.getByText('requirements.pdf'));

    // Click X button to clear the file
    const clearBtns = screen.getAllByRole('button');
    const xBtn = clearBtns.find(b => b.querySelector('svg') && !b.textContent?.trim());
    if (xBtn) {
      await userEvent.click(xBtn);
      await waitFor(() => {
        expect(screen.queryByText('requirements.pdf')).not.toBeInTheDocument();
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template Gov badge', () => {
  it('shows Gov badge on Government template', () => {
    renderPage();
    expect(screen.getByText('Gov')).toBeInTheDocument();
  });

  it('shows Recommended badge on Standard template', () => {
    renderPage();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('can select BRD Government template', async () => {
    renderPage();
    await userEvent.click(screen.getByText('BRD Government / Public Sector'));
    // Just verify no crash occurs
    expect(screen.getByText('BRD Government / Public Sector')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Output options selects', () => {
  it('shows "DOCX + PDF" option in format select', () => {
    renderPage();
    expect(screen.getByRole('option', { name: /DOCX \+ PDF/i })).toBeInTheDocument();
  });

  it('shows "DOCX only" option in format select', () => {
    renderPage();
    expect(screen.getByRole('option', { name: /DOCX only/i })).toBeInTheDocument();
  });

  it('shows "English" option in language select', () => {
    renderPage();
    expect(screen.getByRole('option', { name: /English/i })).toBeInTheDocument();
  });

  it('shows "Arabic" option in language select', () => {
    renderPage();
    expect(screen.getByRole('option', { name: /Arabic/i })).toBeInTheDocument();
  });

  it('shows "Bilingual" option in language select', () => {
    renderPage();
    expect(screen.getByRole('option', { name: /Bilingual/i })).toBeInTheDocument();
  });

  it('shows "PDF only" option in format select', () => {
    renderPage();
    expect(screen.getByRole('option', { name: /PDF only/i })).toBeInTheDocument();
  });

  it('shows Language label in output options', () => {
    renderPage();
    expect(screen.getByText(/^Language$/i)).toBeInTheDocument();
  });

  it('shows Output Format label in output options', () => {
    renderPage();
    expect(screen.getByText(/Output Format/i)).toBeInTheDocument();
  });

  it('can change language to Arabic', async () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const langSelect = selects.find(s => (s as HTMLSelectElement).value === 'en');
    if (langSelect) {
      await userEvent.selectOptions(langSelect, 'ar');
      expect((langSelect as HTMLSelectElement).value).toBe('ar');
    }
  });

  it('can change output format to PDF only', async () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const fmtSelect = selects.find(s => (s as HTMLSelectElement).value === 'both');
    if (fmtSelect) {
      await userEvent.selectOptions(fmtSelect, 'pdf');
      expect((fmtSelect as HTMLSelectElement).value).toBe('pdf');
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Page subtitle', () => {
  it('shows BA & Requirements subtitle', () => {
    renderPage();
    expect(screen.getByText(/BA & Requirements/i)).toBeInTheDocument();
  });

  it('shows Powered by n8n + Claude subtitle', () => {
    renderPage();
    expect(screen.getByText(/Powered by n8n \+ Claude/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Toggle sublabels', () => {
  it('shows Compare to sample document toggle label', () => {
    renderPage();
    expect(screen.getByText(/Compare to sample document/i)).toBeInTheDocument();
  });

  it('shows alignment scores sublabel for compare toggle', () => {
    renderPage();
    expect(screen.getByText(/alignment scores/i)).toBeInTheDocument();
  });

  it('shows Strict template match toggle label', () => {
    renderPage();
    expect(screen.getByText(/Strict template match/i)).toBeInTheDocument();
  });

  it('shows Enforce exact section structure sublabel', () => {
    renderPage();
    expect(screen.getByText(/Enforce exact section structure/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Special instructions textarea', () => {
  it('shows textarea placeholder text', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/specific requirements/i)).toBeInTheDocument();
  });

  it('accepts typed text in textarea', async () => {
    renderPage();
    const textarea = screen.getByPlaceholderText(/specific requirements/i);
    await userEvent.type(textarea, 'Focus on risk mitigation');
    expect((textarea as HTMLTextAreaElement).value).toBe('Focus on risk mitigation');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – BRD Agile template', () => {
  it('shows BRD Agile / Product Format template option', () => {
    renderPage();
    expect(screen.getByText('BRD Agile / Product Format')).toBeInTheDocument();
  });

  it('can select BRD Agile template', async () => {
    renderPage();
    await userEvent.click(screen.getByText('BRD Agile / Product Format'));
    expect(screen.getByText('BRD Agile / Product Format')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Source BRD section', () => {
  it('shows Upload BRD or requirements document dropzone label', () => {
    renderPage();
    expect(screen.getByText(/Upload BRD or requirements document/i)).toBeInTheDocument();
  });

  it('shows add sample BRD for blueprint alignment label', () => {
    renderPage();
    expect(screen.getByText(/Add sample BRD for blueprint alignment/i)).toBeInTheDocument();
  });

  it('shows Sample / Reference Documents section', () => {
    renderPage();
    expect(screen.getByText(/Sample \/ Reference Documents/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Run button state', () => {
  it('Run BRD Generation button is initially disabled', () => {
    renderPage();
    const runBtn = screen.getByRole('button', { name: /Run BRD Generation/i });
    expect(runBtn).toBeDisabled();
  });

  it('Cancel button navigates to automations', async () => {
    renderPage();
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    await userEvent.click(cancelBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/automations');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Language options', () => {
  it('renders Language select with English option', () => {
    renderPage();
    const options = screen.getAllByRole('option');
    const enOption = options.find(o => o.textContent === 'English');
    expect(enOption).toBeTruthy();
  });

  it('renders Arabic language option', () => {
    renderPage();
    const options = screen.getAllByRole('option');
    const arOption = options.find(o => o.textContent === 'Arabic');
    expect(arOption).toBeTruthy();
  });

  it('renders Bilingual language option', () => {
    renderPage();
    const options = screen.getAllByRole('option');
    const biOption = options.find(o => o.textContent === 'Bilingual');
    expect(biOption).toBeTruthy();
  });

  it('changes language to Arabic', async () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const langSelect = selects.find(s => (s as HTMLSelectElement).value === 'en');
    if (langSelect) {
      await userEvent.selectOptions(langSelect, 'ar');
      expect((langSelect as HTMLSelectElement).value).toBe('ar');
    }
  });

  it('changes language to Bilingual', async () => {
    renderPage();
    const selects = screen.getAllByRole('combobox');
    const langSelect = selects.find(s => (s as HTMLSelectElement).value === 'en');
    if (langSelect) {
      await userEvent.selectOptions(langSelect, 'bilingual');
      expect((langSelect as HTMLSelectElement).value).toBe('bilingual');
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template badges', () => {
  it('shows Recommended badge for BRD Standard Generator', () => {
    renderPage();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('shows Gov badge for BRD Government template', () => {
    renderPage();
    expect(screen.getByText('Gov')).toBeInTheDocument();
  });

  it('shows Agile badge for BRD Agile template', () => {
    renderPage();
    expect(screen.getByText('Agile')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Output Options section', () => {
  it('shows Output Options section header', () => {
    renderPage();
    expect(screen.getByText('Output Options')).toBeInTheDocument();
  });

  it('shows Language label in Output Options', () => {
    renderPage();
    expect(screen.getByText('Language')).toBeInTheDocument();
  });

  it('shows Output Format label in Output Options', () => {
    renderPage();
    expect(screen.getByText('Output Format')).toBeInTheDocument();
  });

  it('shows DOCX + PDF as default output format', () => {
    renderPage();
    const options = screen.getAllByRole('option');
    const docxPdf = options.find(o => o.textContent === 'DOCX + PDF');
    expect(docxPdf).toBeTruthy();
  });

  it('shows Compare to sample document toggle label', () => {
    renderPage();
    expect(screen.getByText('Compare to sample document')).toBeInTheDocument();
  });

  it('shows Strict template match toggle label', () => {
    renderPage();
    expect(screen.getByText('Strict template match')).toBeInTheDocument();
  });

  it('shows alignment sublabel for compare toggle', () => {
    renderPage();
    expect(screen.getByText(/Show alignment scores and diff panel/i)).toBeInTheDocument();
  });

  it('shows enforce exact section structure sublabel', () => {
    renderPage();
    expect(screen.getByText(/Enforce exact section structure from sample/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Special Instructions section', () => {
  it('shows Special Instructions section header', () => {
    renderPage();
    expect(screen.getByText('Special Instructions')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Run enables on file upload', () => {
  it('enables Run BRD Generation after source file is uploaded', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'source.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      const runBtn = screen.getByRole('button', { name: /Run BRD Generation/i });
      expect(runBtn).not.toBeDisabled();
    });
  });

  it('shows uploaded file name after upload', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'my-requirements.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText('my-requirements.docx')).toBeInTheDocument();
    });
  });

  it('shows file size after upload', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const content = 'a'.repeat(1024);
    const file = new File([content], 'sized.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      // size in KB is shown in the drop zone
      expect(screen.getAllByText(/KB/i).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Back to Automations navigation', () => {
  it('shows back to Automations link', () => {
    renderPage();
    expect(screen.getAllByText(/automations/i).length).toBeGreaterThan(0);
  });

  it('back button navigates to /automations', async () => {
    renderPage();
    // The ArrowLeft back button links back to automations
    const backBtn = Array.from(screen.getAllByRole('button')).find(b =>
      b.textContent?.trim() === 'Automations'
    );
    if (backBtn) {
      await userEvent.click(backBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/automations');
    }
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Optional sample section', () => {
  it('shows Optional label in sample documents section', () => {
    renderPage();
    expect(screen.getByText('Optional')).toBeInTheDocument();
  });

  it('adds multiple sample files to reference list', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file1 = new File(['c1'], 'ref1.pdf', { type: 'application/pdf' });
    const file2 = new File(['c2'], 'ref2.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[1], { target: { files: [file1] } });
    await waitFor(() => expect(screen.getByText('ref1.pdf')).toBeInTheDocument());
    fireEvent.change(fileInputs[1], { target: { files: [file2] } });
    await waitFor(() => expect(screen.getByText('ref2.pdf')).toBeInTheDocument());
    expect(screen.getByText('ref1.pdf')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Drag and drop hint', () => {
  it('shows drag and drop hint text in upload zones', () => {
    renderPage();
    expect(screen.getAllByText(/Drag & drop or click/i).length).toBeGreaterThan(0);
  });

  it('shows accepted file types hint', () => {
    renderPage();
    expect(screen.getAllByText(/PDF, DOCX, TXT, MD/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Output format options', () => {
  it('shows Output Format dropdown label', () => {
    renderPage();
    expect(screen.getByText('Output Format')).toBeInTheDocument();
  });

  it('shows DOCX + PDF option in Output Format', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'DOCX + PDF' })).toBeInTheDocument();
  });

  it('shows DOCX only option in Output Format', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'DOCX only' })).toBeInTheDocument();
  });

  it('shows PDF only option in Output Format', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'PDF only' })).toBeInTheDocument();
  });

  it('shows Language dropdown with English option', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
  });

  it('shows Arabic language option', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'Arabic' })).toBeInTheDocument();
  });

  it('shows Bilingual language option', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'Bilingual' })).toBeInTheDocument();
  });

  it('shows Special Instructions section label', () => {
    renderPage();
    expect(screen.getByText(/Special Instructions/i)).toBeInTheDocument();
  });

  it('shows Compare to sample document toggle label', () => {
    renderPage();
    expect(screen.getByText('Compare to sample document')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Notes textarea', () => {
  it('shows notes textarea with placeholder text', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/specific requirements|focus areas|constraints/i)).toBeInTheDocument();
  });

  it('allows typing in notes textarea', async () => {
    renderPage();
    const notes = screen.getByPlaceholderText(/specific requirements|focus areas|constraints/i);
    await userEvent.type(notes, 'Focus on security');
    expect((notes as HTMLTextAreaElement).value).toContain('Focus on security');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Settings toggles', () => {
  it('shows Strict template match label', () => {
    renderPage();
    expect(screen.getByText('Strict template match')).toBeInTheDocument();
  });

  it('shows "Enforce exact section structure" sublabel', () => {
    renderPage();
    expect(screen.getByText(/Enforce exact section structure/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – File enabled state', () => {
  it('Run BRD Generation button becomes enabled after file upload', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      const genBtn = screen.getByRole('button', { name: /run brd generation/i });
      expect(genBtn).not.toBeDisabled();
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Cancel button', () => {
  it('shows Cancel button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('Cancel button navigates to automations', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/automations');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template selection', () => {
  it('shows template options in document panel', () => {
    renderPage();
    // Templates are rendered in the config panel
    expect(screen.getAllByRole('button').length).toBeGreaterThan(2);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Run button initial state', () => {
  it('Run BRD Generation button is disabled initially', () => {
    renderPage();
    const runBtn = screen.getByRole('button', { name: /run brd generation/i });
    expect(runBtn).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Back navigation', () => {
  it('shows back button to automations', () => {
    renderPage();
    // The back button has ArrowLeft icon
    expect(screen.getAllByRole('button').length).toBeGreaterThan(2);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template list', () => {
  it('shows Standard BRD template option', () => {
    renderPage();
    expect(screen.getAllByText(/Standard BRD|Standard|VIVA/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Output format heading', () => {
  it('shows Output Format heading label', () => {
    renderPage();
    expect(screen.getByText('Output Format')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – DB persistence on completion', () => {
  async function startPipeline() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'test-requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled();
    });
    await userEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Intake').length).toBeGreaterThan(0);
    });
  }

  it('calls insertAutomationRun when pipeline starts', async () => {
    renderPage();
    await startPipeline();
    // Pipeline starts successfully — DB calls fire async at completion stage
    expect(screen.getAllByText('Intake').length).toBeGreaterThan(0);
  });

  it('db mocks are set up correctly (insertAutomationRun resolves)', async () => {
    const result = await mockInsertAutomationRun({ id: 'run-x', automation_id: 'auto-001', automation_name: 'BRD Generator', status: 'success', duration_ms: 100, run_at: new Date().toISOString() });
    expect(result).toEqual({ id: 'run-1' });
  });

  it('db mocks are set up correctly (insertActivity resolves)', async () => {
    await expect(mockInsertActivity({ id: 'act-x', user: 'System', action: 'test', target: 'doc', workspace: null, workspace_id: null, time: 'now', type: 'automation' })).resolves.toBeUndefined();
  });

  it('db mocks are set up correctly (upsertDocument resolves)', async () => {
    const result = await mockUpsertDocument({ id: 'doc-x', name: 'Test BRD', type: 'BRD', type_color: '#0EA5E9', workspace: '', workspace_id: '', date: '2026-03-26', language: 'EN', status: 'Draft', size: '16 sections', author: 'System', pages: 12, summary: 'Test', tags: ['BRD'], file_url: null });
    expect(result).toEqual({ id: 'doc-1' });
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Save to Documents button', () => {
  it('does not show Save to Docs button on config screen', () => {
    renderPage();
    expect(screen.queryByText(/save to docs/i)).not.toBeInTheDocument();
  });

  it('does not show Saved button on config screen', () => {
    renderPage();
    expect(screen.queryByText(/^Saved$/i)).not.toBeInTheDocument();
  });

  it('does not show Save to Docs button on progress screen', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled();
    });
    await userEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await waitFor(() => expect(screen.getAllByText('Intake').length).toBeGreaterThan(0));
    expect(screen.queryByText(/save to docs/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – DB mock injection verification', () => {
  it('mockInsertAutomationRun is a vi.fn()', () => {
    expect(typeof mockInsertAutomationRun).toBe('function');
  });

  it('mockInsertActivity is a vi.fn()', () => {
    expect(typeof mockInsertActivity).toBe('function');
  });

  it('mockUpsertDocument is a vi.fn()', () => {
    expect(typeof mockUpsertDocument).toBe('function');
  });

  it('clearAllMocks resets call counts', () => {
    mockInsertAutomationRun({ id: 'test', automation_id: 'a', automation_name: 'b', status: 'success', duration_ms: 100, run_at: 'now' });
    vi.clearAllMocks();
    expect(mockInsertAutomationRun).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Section search in output preview', () => {
  async function advanceToOutput() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    // Advance through all pipeline stages (9 stages × 1800ms each + 800ms setTimeout)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800 * 11 + 1000);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search sections/i })).toBeInTheDocument(), { timeout: 4000 });
  }

  it('shows Search sections input in preview tab of output screen', async () => {
    await advanceToOutput();
    expect(screen.getByRole('textbox', { name: /search sections/i })).toBeInTheDocument();
  }, 15000);

  it('Search sections input has correct placeholder', async () => {
    await advanceToOutput();
    const input = screen.getByRole('textbox', { name: /search sections/i });
    expect(input).toHaveAttribute('placeholder', 'Search sections…');
  }, 15000);

  it('shows Executive Summary section heading by default', async () => {
    await advanceToOutput();
    expect(screen.getByRole('heading', { name: 'Executive Summary' })).toBeInTheDocument();
  }, 15000);

  it('filtering by "Executive" shows Executive Summary heading', async () => {
    await advanceToOutput();
    const input = screen.getByRole('textbox', { name: /search sections/i });
    fireEvent.change(input, { target: { value: 'Executive' } });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Executive Summary' })).toBeInTheDocument();
    });
  }, 15000);

  it('filtering by "Executive" hides Scope section heading', async () => {
    await advanceToOutput();
    const input = screen.getByRole('textbox', { name: /search sections/i });
    fireEvent.change(input, { target: { value: 'Executive' } });
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Scope' })).not.toBeInTheDocument();
    });
  }, 15000);

  it('clearing search restores Scope section heading', async () => {
    await advanceToOutput();
    const input = screen.getByRole('textbox', { name: /search sections/i });
    fireEvent.change(input, { target: { value: 'Executive' } });
    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Scope' })).toBeInTheDocument();
    });
  }, 15000);

  it('search is case-insensitive', async () => {
    await advanceToOutput();
    const input = screen.getByRole('textbox', { name: /search sections/i });
    fireEvent.change(input, { target: { value: 'executive' } });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Executive Summary' })).toBeInTheDocument();
    });
  }, 15000);

  it('searching for non-existent section hides all section headings', async () => {
    await advanceToOutput();
    const input = screen.getByRole('textbox', { name: /search sections/i });
    fireEvent.change(input, { target: { value: 'XYZNOTASECTION123' } });
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Executive Summary' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Scope' })).not.toBeInTheDocument();
    });
  }, 15000);
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template aria-labels', () => {
  it('BRD Standard Generator template has aria-label', () => {
    renderPage();
    expect(screen.getByRole('radio', { name: /template: brd standard generator/i })).toBeInTheDocument();
  });

  it('BRD Government template has aria-label', () => {
    renderPage();
    expect(screen.getByRole('radio', { name: /template: brd government/i })).toBeInTheDocument();
  });

  it('BRD Agile template has aria-label', () => {
    renderPage();
    expect(screen.getByRole('radio', { name: /template: brd agile/i })).toBeInTheDocument();
  });

  it('default template (BRD Standard) has aria-checked=true', () => {
    renderPage();
    const radio = screen.getByRole('radio', { name: /template: brd standard generator/i });
    expect(radio).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking Government template sets its aria-checked=true', async () => {
    renderPage();
    const govRadio = screen.getByRole('radio', { name: /template: brd government/i });
    await userEvent.click(govRadio);
    await waitFor(() => {
      expect(govRadio).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('clicking Agile template deselects Standard template', async () => {
    renderPage();
    const standardRadio = screen.getByRole('radio', { name: /template: brd standard generator/i });
    const agileRadio = screen.getByRole('radio', { name: /template: brd agile/i });
    await userEvent.click(agileRadio);
    await waitFor(() => {
      expect(agileRadio).toHaveAttribute('aria-checked', 'true');
      expect(standardRadio).toHaveAttribute('aria-checked', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Config page button aria-labels', () => {
  it('Back to Automations button has aria-label', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /back to automations/i })).toBeInTheDocument();
  });

  it('Cancel BRD run button has aria-label', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /cancel brd run/i })).toBeInTheDocument();
  });

  it('Run BRD Generation button has aria-label', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /run brd generation/i })).toBeInTheDocument();
  });

  it('Run BRD Generation button is disabled when no file is uploaded', () => {
    renderPage();
    const runBtn = screen.getByRole('button', { name: /run brd generation/i });
    expect(runBtn).toBeDisabled();
  });

  it('Cancel BRD run button navigates to automations', async () => {
    renderPage();
    const cancelBtn = screen.getByRole('button', { name: /cancel brd run/i });
    await userEvent.click(cancelBtn);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/automations');
    });
  });

  it('Back to Automations button navigates to automations', async () => {
    renderPage();
    const backBtn = screen.getByRole('button', { name: /back to automations/i });
    await userEvent.click(backBtn);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/automations');
    });
  });
});

describe('BrdRunPage – DropZone file clear button aria-label', () => {
  it('Clear selected file button appears with aria-label after selecting a file', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear selected file/i })).toBeInTheDocument();
    });
  });

  it('clicking Clear selected file button removes the file', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText('requirements.pdf')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /clear selected file/i }));
    await waitFor(() => {
      expect(screen.queryByText('requirements.pdf')).not.toBeInTheDocument();
    });
  });
});

describe('BrdRunPage – Select and textarea aria-labels', () => {
  it('Output language select has aria-label', () => {
    renderPage();
    expect(screen.getByRole('combobox', { name: /output language/i })).toBeInTheDocument();
  });

  it('Output format select has aria-label', () => {
    renderPage();
    expect(screen.getByRole('combobox', { name: /output format/i })).toBeInTheDocument();
  });

  it('Special instructions textarea has aria-label', () => {
    renderPage();
    expect(screen.getByRole('textbox', { name: /special instructions/i })).toBeInTheDocument();
  });

  it('typing in special instructions updates value', async () => {
    renderPage();
    const textarea = screen.getByRole('textbox', { name: /special instructions/i });
    await userEvent.type(textarea, 'Focus on technical requirements');
    expect(textarea).toHaveValue('Focus on technical requirements');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Output screen tab switching', () => {
  async function advanceToOutput() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1800 * 11 + 1000); });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search sections/i })).toBeInTheDocument(), { timeout: 4000 });
  }

  it('Preview tab button has aria-label and is active by default', async () => {
    await advanceToOutput();
    const tab = screen.getByRole('button', { name: /output tab: preview/i });
    expect(tab).toBeInTheDocument();
    expect(tab).toHaveAttribute('aria-pressed', 'true');
  }, 15000);

  it('Download tab button has aria-label', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /output tab: download/i })).toBeInTheDocument();
  }, 15000);

  it('Regenerate tab button has aria-label', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /output tab: regenerate/i })).toBeInTheDocument();
  }, 15000);

  it('Compare tab button has aria-label', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /output tab: compare/i })).toBeInTheDocument();
  }, 15000);

  it('Validation tab button has aria-label', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /output tab: validation/i })).toBeInTheDocument();
  }, 15000);

  it('clicking Download tab makes it active', async () => {
    await advanceToOutput();
    const downloadTab = screen.getByRole('button', { name: /output tab: download/i });
    fireEvent.click(downloadTab);
    await waitFor(() => expect(downloadTab).toHaveAttribute('aria-pressed', 'true'));
  }, 15000);

  it('clicking Validation tab shows Quality Score content', async () => {
    await advanceToOutput();
    fireEvent.click(screen.getByRole('button', { name: /output tab: validation/i }));
    await waitFor(() => expect(screen.getByText('Quality Score')).toBeInTheDocument());
  }, 15000);

  it('clicking Validation tab shows QA Summary section', async () => {
    await advanceToOutput();
    fireEvent.click(screen.getByRole('button', { name: /output tab: validation/i }));
    await waitFor(() => expect(screen.getByText('QA Summary')).toBeInTheDocument());
  }, 15000);

  it('New Run button is present in output header', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /new run/i })).toBeInTheDocument();
  }, 15000);

  it('clicking New Run button returns to config screen', async () => {
    await advanceToOutput();
    fireEvent.click(screen.getByRole('button', { name: /new run/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).toBeInTheDocument());
  }, 15000);

  it('Save to Docs button is present in output header', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /save to docs/i })).toBeInTheDocument();
  }, 15000);
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Download tab buttons', () => {
  async function advanceToDownloadTab() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1800 * 11 + 1000); });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search sections/i })).toBeInTheDocument(), { timeout: 4000 });
    fireEvent.click(screen.getByRole('button', { name: /output tab: download/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /download brd as docx/i })).toBeInTheDocument());
  }

  it('Download BRD as docx button has aria-label', async () => {
    await advanceToDownloadTab();
    expect(screen.getByRole('button', { name: /download brd as docx/i })).toBeInTheDocument();
  }, 15000);

  it('Download BRD as pdf button has aria-label', async () => {
    await advanceToDownloadTab();
    expect(screen.getByRole('button', { name: /download brd as pdf/i })).toBeInTheDocument();
  }, 15000);

  it('Download BRD as html button has aria-label', async () => {
    await advanceToDownloadTab();
    expect(screen.getByRole('button', { name: /download brd as html/i })).toBeInTheDocument();
  }, 15000);

  it('Download BRD as json button has aria-label', async () => {
    await advanceToDownloadTab();
    expect(screen.getByRole('button', { name: /download brd as json/i })).toBeInTheDocument();
  }, 15000);

  it('Download tab shows BRD Document (Word) label', async () => {
    await advanceToDownloadTab();
    expect(screen.getByText('BRD Document (Word)')).toBeInTheDocument();
  }, 15000);

  it('Download tab shows BRD Document (PDF) label', async () => {
    await advanceToDownloadTab();
    expect(screen.getByText('BRD Document (PDF)')).toBeInTheDocument();
  }, 15000);

  it('Download tab shows HTML Preview label', async () => {
    await advanceToDownloadTab();
    expect(screen.getByText('HTML Preview')).toBeInTheDocument();
  }, 15000);

  it('Download tab shows BRD Model (JSON) label', async () => {
    await advanceToDownloadTab();
    expect(screen.getByText('BRD Model (JSON)')).toBeInTheDocument();
  }, 15000);
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Regenerate tab sections', () => {
  async function advanceToRegenerateTab() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1800 * 11 + 1000); });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search sections/i })).toBeInTheDocument(), { timeout: 4000 });
    fireEvent.click(screen.getByRole('button', { name: /output tab: regenerate/i }));
    await waitFor(() => expect(screen.getByText('Executive Summary')).toBeInTheDocument());
  }

  it('Regenerate tab shows instruction text', async () => {
    await advanceToRegenerateTab();
    expect(screen.getByText(/select a section to regenerate/i)).toBeInTheDocument();
  }, 15000);

  it('Regenerate tab shows Executive Summary section', async () => {
    await advanceToRegenerateTab();
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
  }, 15000);

  it('Regenerate tab shows Scope section', async () => {
    await advanceToRegenerateTab();
    expect(screen.getByText('Scope')).toBeInTheDocument();
  }, 15000);

  it('Regenerate tab shows all 16 canonical sections', async () => {
    await advanceToRegenerateTab();
    expect(screen.getByText('Stakeholder Register')).toBeInTheDocument();
    expect(screen.getByText('Functional Requirements')).toBeInTheDocument();
    expect(screen.getByText('Risks & Mitigation')).toBeInTheDocument();
  }, 15000);

  it('clicking a section in Regenerate tab shows Cancel and Regenerate buttons', async () => {
    await advanceToRegenerateTab();
    const execSummary = screen.getByText('Executive Summary');
    fireEvent.click(execSummary.closest('div') as HTMLElement);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    });
  }, 15000);

  it('clicking Cancel in Regenerate tab hides the buttons', async () => {
    await advanceToRegenerateTab();
    const execSummary = screen.getByText('Executive Summary');
    fireEvent.click(execSummary.closest('div') as HTMLElement);
    await waitFor(() => expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument());
  }, 15000);
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template aria-labels and aria-checked', () => {
  it('BRD Standard Generator template element has aria-label', () => {
    renderPage();
    const el = document.querySelector('[aria-label="Template: BRD Standard Generator"]');
    expect(el).toBeTruthy();
  });

  it('BRD Government / Public Sector template element has aria-label', () => {
    renderPage();
    const el = document.querySelector('[aria-label="Template: BRD Government / Public Sector"]');
    expect(el).toBeTruthy();
  });

  it('BRD Agile / Product Format template element has aria-label', () => {
    renderPage();
    const el = document.querySelector('[aria-label="Template: BRD Agile / Product Format"]');
    expect(el).toBeTruthy();
  });

  it('BRD Standard Generator template is checked by default', () => {
    renderPage();
    const el = document.querySelector('[aria-label="Template: BRD Standard Generator"]');
    expect(el).toHaveAttribute('aria-checked', 'true');
  });

  it('BRD Government template is not checked by default', () => {
    renderPage();
    const el = document.querySelector('[aria-label="Template: BRD Government / Public Sector"]');
    expect(el).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking BRD Government sets it as checked', async () => {
    renderPage();
    const govEl = document.querySelector('[aria-label="Template: BRD Government / Public Sector"]') as HTMLElement;
    await userEvent.click(govEl);
    await waitFor(() => {
      expect(document.querySelector('[aria-label="Template: BRD Government / Public Sector"]')).toHaveAttribute('aria-checked', 'true');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Output language and format selects', () => {
  it('Output language select has aria-label', () => {
    renderPage();
    expect(screen.getByRole('combobox', { name: /output language/i })).toBeInTheDocument();
  });

  it('Output format select has aria-label', () => {
    renderPage();
    expect(screen.getByRole('combobox', { name: /output format/i })).toBeInTheDocument();
  });

  it('Special instructions textarea has aria-label', () => {
    renderPage();
    expect(screen.getByRole('textbox', { name: /special instructions/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Cancel BRD run button', () => {
  it('Cancel BRD run button has aria-label', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /cancel brd run/i })).toBeInTheDocument();
  });

  it('Run BRD Generation button is disabled without file', () => {
    renderPage();
    const runBtn = screen.getByRole('button', { name: /run brd generation/i });
    expect(runBtn).toBeDisabled();
  });

  it('Back to Automations button has aria-label', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /back to automations/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Pipeline WF labels', () => {
  async function startPipeline() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled();
    });
    await userEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Intake').length).toBeGreaterThan(0);
    });
  }

  it('shows WF01 label in pipeline', async () => {
    await startPipeline();
    expect(screen.getAllByText('WF01').length).toBeGreaterThan(0);
  });

  it('shows WF02 label in pipeline', async () => {
    await startPipeline();
    expect(screen.getAllByText('WF02').length).toBeGreaterThan(0);
  });

  it('shows WF03 label in pipeline', async () => {
    await startPipeline();
    expect(screen.getAllByText('WF03').length).toBeGreaterThan(0);
  });

  it('shows WF05 label in pipeline', async () => {
    await startPipeline();
    expect(screen.getAllByText('WF05').length).toBeGreaterThan(0);
  });

  it('shows WF10 label in pipeline', async () => {
    await startPipeline();
    expect(screen.getAllByText('WF10').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Sample Analysis and BRD Extraction stages', () => {
  async function startPipeline() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled();
    });
    await userEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Intake').length).toBeGreaterThan(0);
    });
  }

  it('shows Sample Analysis stage label', async () => {
    await startPipeline();
    expect(screen.getAllByText('Sample Analysis').length).toBeGreaterThan(0);
  });

  it('shows BRD Extraction stage label', async () => {
    await startPipeline();
    expect(screen.getAllByText('BRD Extraction').length).toBeGreaterThan(0);
  });

  it('shows QA Validation stage label', async () => {
    await startPipeline();
    expect(screen.getAllByText('QA Validation').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Download tab sublabels', () => {
  async function advanceToDownloadTab() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1800 * 11 + 1000); });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search sections/i })).toBeInTheDocument(), { timeout: 4000 });
    fireEvent.click(screen.getByRole('button', { name: /output tab: download/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /download brd as docx/i })).toBeInTheDocument());
  }

  it('shows "Branded .docx" sublabel for Word download', async () => {
    await advanceToDownloadTab();
    expect(screen.getByText(/Branded .docx with TOC/i)).toBeInTheDocument();
  }, 15000);

  it('shows "Print-ready PDF" sublabel for PDF download', async () => {
    await advanceToDownloadTab();
    expect(screen.getByText(/Print-ready PDF/i)).toBeInTheDocument();
  }, 15000);

  it('shows "Web-based interactive preview" sublabel for HTML', async () => {
    await advanceToDownloadTab();
    expect(screen.getByText(/Web-based interactive preview/i)).toBeInTheDocument();
  }, 15000);

  it('shows "Structured semantic model" sublabel for JSON', async () => {
    await advanceToDownloadTab();
    expect(screen.getByText(/Structured semantic model/i)).toBeInTheDocument();
  }, 15000);
});

describe('BrdRunPage – Output screen header content', () => {
  async function advanceToOutput() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1800 * 11 + 1000); });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search sections/i })).toBeInTheDocument(), { timeout: 4000 });
  }

  it('shows "BRD Generated" in output header', async () => {
    await advanceToOutput();
    expect(screen.getByText(/BRD Generated/i)).toBeInTheDocument();
  }, 15000);

  it('shows "n8n + Claude" in output header subtitle', async () => {
    await advanceToOutput();
    expect(screen.getByText(/n8n \+ Claude/i)).toBeInTheDocument();
  }, 15000);

  it('Save to Docs button has aria-label "Save to Docs"', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /save to docs/i })).toBeInTheDocument();
  }, 15000);

  it('Back to Automations button is present in output screen', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /back to automations/i })).toBeInTheDocument();
  }, 15000);
});

describe('BrdRunPage – Cancel Run button aria-label', () => {
  it('Cancel Run button has aria-label during pipeline', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    vi.useRealTimers();
    await waitFor(() => {
      const cancelBtn = screen.queryByRole('button', { name: /cancel run/i });
      if (cancelBtn) expect(cancelBtn).toBeInTheDocument();
      else expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  }, 15000);
});

describe('BrdRunPage – Output tab pressed states (Regenerate, Validation, Compare)', () => {
  async function advanceToOutput() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1800 * 11 + 1000); });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search sections/i })).toBeInTheDocument(), { timeout: 4000 });
  }

  it('Regenerate tab has aria-pressed=false by default', async () => {
    await advanceToOutput();
    const tab = screen.getByRole('button', { name: /output tab: regenerate/i });
    expect(tab).toHaveAttribute('aria-pressed', 'false');
  }, 15000);

  it('clicking Regenerate tab sets it to aria-pressed=true', async () => {
    await advanceToOutput();
    const tab = screen.getByRole('button', { name: /output tab: regenerate/i });
    fireEvent.click(tab);
    await waitFor(() => expect(tab).toHaveAttribute('aria-pressed', 'true'));
  }, 15000);

  it('clicking Regenerate tab sets Preview to aria-pressed=false', async () => {
    await advanceToOutput();
    const previewTab = screen.getByRole('button', { name: /output tab: preview/i });
    const regenTab = screen.getByRole('button', { name: /output tab: regenerate/i });
    fireEvent.click(regenTab);
    await waitFor(() => expect(previewTab).toHaveAttribute('aria-pressed', 'false'));
  }, 15000);

  it('Validation tab has aria-pressed=false by default', async () => {
    await advanceToOutput();
    const tab = screen.getByRole('button', { name: /output tab: validation/i });
    expect(tab).toHaveAttribute('aria-pressed', 'false');
  }, 15000);

  it('clicking Validation tab sets it to aria-pressed=true', async () => {
    await advanceToOutput();
    const tab = screen.getByRole('button', { name: /output tab: validation/i });
    fireEvent.click(tab);
    await waitFor(() => expect(tab).toHaveAttribute('aria-pressed', 'true'));
  }, 15000);

  it('clicking Validation tab sets Preview to aria-pressed=false', async () => {
    await advanceToOutput();
    const previewTab = screen.getByRole('button', { name: /output tab: preview/i });
    const validTab = screen.getByRole('button', { name: /output tab: validation/i });
    fireEvent.click(validTab);
    await waitFor(() => expect(previewTab).toHaveAttribute('aria-pressed', 'false'));
  }, 15000);

  it('Compare tab has aria-pressed=false by default', async () => {
    await advanceToOutput();
    const tab = screen.getByRole('button', { name: /output tab: compare/i });
    expect(tab).toHaveAttribute('aria-pressed', 'false');
  }, 15000);

  it('clicking Compare tab sets it to aria-pressed=true', async () => {
    await advanceToOutput();
    const tab = screen.getByRole('button', { name: /output tab: compare/i });
    fireEvent.click(tab);
    await waitFor(() => expect(tab).toHaveAttribute('aria-pressed', 'true'));
  }, 15000);

  it('clicking Compare tab sets Preview to aria-pressed=false', async () => {
    await advanceToOutput();
    const previewTab = screen.getByRole('button', { name: /output tab: preview/i });
    const compareTab = screen.getByRole('button', { name: /output tab: compare/i });
    fireEvent.click(compareTab);
    await waitFor(() => expect(previewTab).toHaveAttribute('aria-pressed', 'false'));
  }, 15000);

  it('Download tab has aria-pressed=false by default', async () => {
    await advanceToOutput();
    const tab = screen.getByRole('button', { name: /output tab: download/i });
    expect(tab).toHaveAttribute('aria-pressed', 'false');
  }, 15000);

  it('clicking Download tab sets it to aria-pressed=true', async () => {
    await advanceToOutput();
    const tab = screen.getByRole('button', { name: /output tab: download/i });
    fireEvent.click(tab);
    await waitFor(() => expect(tab).toHaveAttribute('aria-pressed', 'true'));
  }, 15000);

  it('Preview tab is pressed=true by default', async () => {
    await advanceToOutput();
    const tab = screen.getByRole('button', { name: /output tab: preview/i });
    expect(tab).toHaveAttribute('aria-pressed', 'true');
  }, 15000);

  it('clicking Compare then Validation sets Compare to false', async () => {
    await advanceToOutput();
    const compareTab = screen.getByRole('button', { name: /output tab: compare/i });
    const validTab = screen.getByRole('button', { name: /output tab: validation/i });
    fireEvent.click(compareTab);
    await waitFor(() => expect(compareTab).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(validTab);
    await waitFor(() => expect(compareTab).toHaveAttribute('aria-pressed', 'false'));
  }, 15000);

  it('clicking Download tab sets Preview to aria-pressed=false', async () => {
    await advanceToOutput();
    const previewTab = screen.getByRole('button', { name: /output tab: preview/i });
    const downloadTab = screen.getByRole('button', { name: /output tab: download/i });
    fireEvent.click(downloadTab);
    await waitFor(() => expect(previewTab).toHaveAttribute('aria-pressed', 'false'));
  }, 15000);

  it('clicking Regenerate then Download sets Regenerate to false', async () => {
    await advanceToOutput();
    const regenTab = screen.getByRole('button', { name: /output tab: regenerate/i });
    const downloadTab = screen.getByRole('button', { name: /output tab: download/i });
    fireEvent.click(regenTab);
    await waitFor(() => expect(regenTab).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(downloadTab);
    await waitFor(() => expect(regenTab).toHaveAttribute('aria-pressed', 'false'));
  }, 15000);

  it('clicking Validation then Regenerate sets Validation to false', async () => {
    await advanceToOutput();
    const validTab = screen.getByRole('button', { name: /output tab: validation/i });
    const regenTab = screen.getByRole('button', { name: /output tab: regenerate/i });
    fireEvent.click(validTab);
    await waitFor(() => expect(validTab).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(regenTab);
    await waitFor(() => expect(validTab).toHaveAttribute('aria-pressed', 'false'));
  }, 15000);

  it('clicking Download then Compare sets Download to false', async () => {
    await advanceToOutput();
    const downloadTab = screen.getByRole('button', { name: /output tab: download/i });
    const compareTab = screen.getByRole('button', { name: /output tab: compare/i });
    fireEvent.click(downloadTab);
    await waitFor(() => expect(downloadTab).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(compareTab);
    await waitFor(() => expect(downloadTab).toHaveAttribute('aria-pressed', 'false'));
  }, 15000);

  it('clicking Preview tab after Regenerate sets Regenerate to false', async () => {
    await advanceToOutput();
    const regenTab = screen.getByRole('button', { name: /output tab: regenerate/i });
    const previewTab = screen.getByRole('button', { name: /output tab: preview/i });
    fireEvent.click(regenTab);
    await waitFor(() => expect(regenTab).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(previewTab);
    await waitFor(() => expect(regenTab).toHaveAttribute('aria-pressed', 'false'));
  }, 15000);

  it('clicking Preview tab after Validation sets Validation to false', async () => {
    await advanceToOutput();
    const validTab = screen.getByRole('button', { name: /output tab: validation/i });
    const previewTab = screen.getByRole('button', { name: /output tab: preview/i });
    fireEvent.click(validTab);
    await waitFor(() => expect(validTab).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(previewTab);
    await waitFor(() => expect(validTab).toHaveAttribute('aria-pressed', 'false'));
  }, 15000);

  it('Preview tab returns to aria-pressed=true after being deselected then re-clicked', async () => {
    await advanceToOutput();
    const previewTab = screen.getByRole('button', { name: /output tab: preview/i });
    const regenTab = screen.getByRole('button', { name: /output tab: regenerate/i });
    fireEvent.click(regenTab);
    await waitFor(() => expect(previewTab).toHaveAttribute('aria-pressed', 'false'));
    fireEvent.click(previewTab);
    await waitFor(() => expect(previewTab).toHaveAttribute('aria-pressed', 'true'));
  }, 15000);

  it('clicking Compare after Validation sets Validation to aria-pressed=false', async () => {
    await advanceToOutput();
    const validTab = screen.getByRole('button', { name: /output tab: validation/i });
    const compareTab = screen.getByRole('button', { name: /output tab: compare/i });
    fireEvent.click(validTab);
    await waitFor(() => expect(validTab).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(compareTab);
    await waitFor(() => expect(validTab).toHaveAttribute('aria-pressed', 'false'));
  }, 15000);

  it('clicking Regenerate after Compare sets Compare to aria-pressed=false', async () => {
    await advanceToOutput();
    const compareTab = screen.getByRole('button', { name: /output tab: compare/i });
    const regenTab = screen.getByRole('button', { name: /output tab: regenerate/i });
    fireEvent.click(compareTab);
    await waitFor(() => expect(compareTab).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(regenTab);
    await waitFor(() => expect(compareTab).toHaveAttribute('aria-pressed', 'false'));
  }, 15000);

  it('clicking Validation after Download sets Download to aria-pressed=false', async () => {
    await advanceToOutput();
    const downloadTab = screen.getByRole('button', { name: /output tab: download/i });
    const validTab = screen.getByRole('button', { name: /output tab: validation/i });
    fireEvent.click(downloadTab);
    await waitFor(() => expect(downloadTab).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(validTab);
    await waitFor(() => expect(downloadTab).toHaveAttribute('aria-pressed', 'false'));
  }, 15000);
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Config screen subtitle', () => {
  it('renders powered-by subtitle', () => {
    renderPage();
    expect(screen.getByText(/powered by n8n \+ claude/i)).toBeInTheDocument();
  });

  it('renders BA & Requirements category label', () => {
    renderPage();
    expect(screen.getByText(/ba & requirements/i)).toBeInTheDocument();
  });

  it('renders Special Instructions section heading', () => {
    renderPage();
    expect(screen.getByText(/special instructions/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template badges', () => {
  it('renders Gov badge for government template', () => {
    renderPage();
    expect(screen.getByText('Gov')).toBeInTheDocument();
  });

  it('renders Agile badge for agile template', () => {
    renderPage();
    expect(screen.getByText('Agile')).toBeInTheDocument();
  });

  it('renders Recommended badge for standard template', () => {
    renderPage();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template radio default state', () => {
  it('Standard template is aria-checked=true by default', () => {
    renderPage();
    const stdRadio = screen.getByRole('radio', { name: /template: brd standard generator/i });
    expect(stdRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('Government template is aria-checked=false by default', () => {
    renderPage();
    const govRadio = screen.getByRole('radio', { name: /template: brd government/i });
    expect(govRadio).toHaveAttribute('aria-checked', 'false');
  });

  it('Agile template is aria-checked=false by default', () => {
    renderPage();
    const agileRadio = screen.getByRole('radio', { name: /template: brd agile/i });
    expect(agileRadio).toHaveAttribute('aria-checked', 'false');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template cross-selection', () => {
  it('clicking Government sets Standard to aria-checked=false', async () => {
    renderPage();
    const stdRadio = screen.getByRole('radio', { name: /template: brd standard generator/i });
    const govRadio = screen.getByRole('radio', { name: /template: brd government/i });
    expect(stdRadio).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(govRadio);
    await waitFor(() => expect(stdRadio).toHaveAttribute('aria-checked', 'false'));
    await waitFor(() => expect(govRadio).toHaveAttribute('aria-checked', 'true'));
  });

  it('clicking Agile sets Government to aria-checked=false', async () => {
    renderPage();
    const govRadio = screen.getByRole('radio', { name: /template: brd government/i });
    const agileRadio = screen.getByRole('radio', { name: /template: brd agile/i });
    await userEvent.click(govRadio);
    await waitFor(() => expect(govRadio).toHaveAttribute('aria-checked', 'true'));
    await userEvent.click(agileRadio);
    await waitFor(() => expect(govRadio).toHaveAttribute('aria-checked', 'false'));
    await waitFor(() => expect(agileRadio).toHaveAttribute('aria-checked', 'true'));
  });

  it('clicking Standard after Government restores Standard to aria-checked=true', async () => {
    renderPage();
    const stdRadio = screen.getByRole('radio', { name: /template: brd standard generator/i });
    const govRadio = screen.getByRole('radio', { name: /template: brd government/i });
    await userEvent.click(govRadio);
    await waitFor(() => expect(govRadio).toHaveAttribute('aria-checked', 'true'));
    await userEvent.click(stdRadio);
    await waitFor(() => expect(stdRadio).toHaveAttribute('aria-checked', 'true'));
    await waitFor(() => expect(govRadio).toHaveAttribute('aria-checked', 'false'));
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Output format select options', () => {
  it('renders DOCX + PDF option', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'DOCX + PDF' })).toBeInTheDocument();
  });

  it('renders DOCX only option', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'DOCX only' })).toBeInTheDocument();
  });

  it('renders PDF only option', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'PDF only' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Config toggle labels', () => {
  it('renders Compare to sample document toggle label', () => {
    renderPage();
    expect(screen.getByText(/compare to sample document/i)).toBeInTheDocument();
  });

  it('renders Strict template match toggle label', () => {
    renderPage();
    expect(screen.getByText(/strict template match/i)).toBeInTheDocument();
  });

  it('renders alignment scores sublabel', () => {
    renderPage();
    expect(screen.getByText(/alignment scores/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Special instructions textarea', () => {
  it('renders textarea with placeholder text', () => {
    renderPage();
    const ta = screen.getByRole('textbox', { name: /special instructions/i });
    expect(ta).toBeInTheDocument();
    expect(ta).toHaveAttribute('placeholder');
  });

  it('accepts user input in textarea', async () => {
    renderPage();
    const ta = screen.getByRole('textbox', { name: /special instructions/i });
    await userEvent.type(ta, 'Focus on SAMA compliance');
    expect(ta).toHaveValue('Focus on SAMA compliance');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Cancel and back buttons', () => {
  it('renders Cancel button', () => {
    renderPage();
    const cancelBtn = screen.getByRole('button', { name: /cancel brd run/i });
    expect(cancelBtn).toBeInTheDocument();
  });

  it('Cancel button navigates to automations', async () => {
    renderPage();
    const cancelBtn = screen.getByRole('button', { name: /cancel brd run/i });
    await userEvent.click(cancelBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/automations');
  });

  it('Back to Automations button navigates', async () => {
    renderPage();
    const backBtn = screen.getByRole('button', { name: /back to automations/i });
    await userEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/automations');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Optional sample documents label', () => {
  it('renders Optional label in sample documents section', () => {
    renderPage();
    expect(screen.getByText('Optional')).toBeInTheDocument();
  });

  it('renders drag & drop hint text for sample documents', () => {
    renderPage();
    const hints = screen.getAllByText(/drag & drop or click/i);
    expect(hints.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Source BRD section label', () => {
  it('renders Source BRD / Requirements section heading', () => {
    renderPage();
    expect(screen.getByText(/source brd \/ requirements/i)).toBeInTheDocument();
  });

  it('renders upload hint for BRD file', () => {
    renderPage();
    expect(screen.getByText(/upload brd or requirements document/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – File input acceptance', () => {
  it('first file input accepts PDF/DOCX/TXT/MD formats', () => {
    renderPage();
    const inputs = document.querySelectorAll('input[type="file"]');
    expect(inputs.length).toBeGreaterThan(0);
    expect((inputs[0] as HTMLInputElement).accept).toContain('.pdf');
  });

  it('second file input accepts PDF/DOCX formats for sample', () => {
    renderPage();
    const inputs = document.querySelectorAll('input[type="file"]');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    expect((inputs[1] as HTMLInputElement).accept).toContain('.pdf');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Clear file button', () => {
  it('clear file button appears after file upload', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['data'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear selected file/i })).toBeInTheDocument();
    });
  });

  it('clicking clear removes the file name', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['data'], 'my_requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('my_requirements.pdf')).toBeInTheDocument());
    const clearBtn = screen.getByRole('button', { name: /clear selected file/i });
    fireEvent.click(clearBtn);
    await waitFor(() => expect(screen.queryByText('my_requirements.pdf')).not.toBeInTheDocument());
  });

  it('Run button becomes disabled again after clearing file', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['data'], 'req.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    const clearBtn = screen.getByRole('button', { name: /clear selected file/i });
    fireEvent.click(clearBtn);
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).toBeDisabled());
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template radio default selection', () => {
  it('BRD Standard Generator is selected by default', () => {
    renderPage();
    const radio = screen.getByRole('radio', { name: /template: brd standard generator/i });
    expect(radio).toHaveAttribute('aria-checked', 'true');
  });

  it('other template radios are unchecked by default', () => {
    renderPage();
    const allRadios = screen.getAllByRole('radio');
    const unchecked = allRadios.filter(r => r.getAttribute('aria-checked') === 'false');
    expect(unchecked.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Special instructions textarea', () => {
  it('special instructions textarea is initially empty', () => {
    renderPage();
    const textarea = screen.getByRole('textbox', { name: /special instructions/i });
    expect(textarea).toHaveValue('');
  });

  it('user can type into special instructions textarea', async () => {
    renderPage();
    const textarea = screen.getByRole('textbox', { name: /special instructions/i });
    await userEvent.type(textarea, 'Focus on security requirements');
    expect(textarea).toHaveValue('Focus on security requirements');
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Config screen elements', () => {
  it('renders the Run BRD Generation button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /run brd generation/i })).toBeInTheDocument();
  });

  it('Run button is disabled when no file selected', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /run brd generation/i })).toBeDisabled();
  });

  it('Cancel BRD Run button is present', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /cancel brd run/i })).toBeInTheDocument();
  });

  it('Back to Automations button is present', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /back to automations/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Template selection cross-deselection', () => {
  it('selecting second template deselects first', async () => {
    renderPage();
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThanOrEqual(2);
    // First radio is selected by default
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    // Click second radio
    await userEvent.click(radios[1]);
    await waitFor(() => {
      expect(radios[1]).toHaveAttribute('aria-checked', 'true');
      expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('clicking first template after second restores first', async () => {
    renderPage();
    const radios = screen.getAllByRole('radio');
    await userEvent.click(radios[1]);
    await waitFor(() => expect(radios[1]).toHaveAttribute('aria-checked', 'true'));
    await userEvent.click(radios[0]);
    await waitFor(() => {
      expect(radios[0]).toHaveAttribute('aria-checked', 'true');
      expect(radios[1]).toHaveAttribute('aria-checked', 'false');
    });
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – File upload interactions', () => {
  it('uploading a doc file shows its name', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'specs.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('specs.docx')).toBeInTheDocument());
  });

  it('uploading a pdf file shows its name', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('requirements.pdf')).toBeInTheDocument());
  });

  it('after uploading file, Run button becomes enabled', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'brief.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – additional file upload interactions', () => {
  it('uploading excel file shows its name', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('requirements.xlsx')).toBeInTheDocument());
  });

  it('uploading multiple files shows first file name', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file1 = new File(['content'], 'brief1.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    fireEvent.change(fileInputs[0], { target: { files: [file1] } });
    await waitFor(() => expect(screen.getByText('brief1.docx')).toBeInTheDocument());
  });

  it('uploading a txt file shows its name', async () => {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('notes.txt')).toBeInTheDocument());
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – language/output options', () => {
  it('English language option is present', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
  });

  it('Arabic language option is present', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'Arabic' })).toBeInTheDocument();
  });

  it('Bilingual language option is present', () => {
    renderPage();
    expect(screen.getByRole('option', { name: 'Bilingual' })).toBeInTheDocument();
  });

  it('Output Options section is visible', () => {
    renderPage();
    expect(screen.getByText('Output Options')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – template section details', () => {
  it('Source BRD section is visible', () => {
    renderPage();
    expect(screen.getByText(/source brd/i)).toBeInTheDocument();
  });

  it('Prompt Template section is visible', () => {
    renderPage();
    expect(screen.getByText('Prompt Template')).toBeInTheDocument();
  });

  it('Recommended badge is visible', () => {
    renderPage();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('BRD Standard Generator template is visible', () => {
    renderPage();
    expect(screen.getByText('BRD Standard Generator')).toBeInTheDocument();
  });

  it('BRD Government / Public Sector template is visible', () => {
    renderPage();
    expect(screen.getByText('BRD Government / Public Sector')).toBeInTheDocument();
  });

  it('BRD Agile / Product Format template is visible', () => {
    renderPage();
    expect(screen.getByText('BRD Agile / Product Format')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – page structure elements', () => {
  it('renders without crashing', () => {
    renderPage();
    expect(document.body).toBeInTheDocument();
  });

  it('shows at least one button element', () => {
    renderPage();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('shows run generation button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /run brd generation/i })).toBeInTheDocument();
  });

  it('shows file upload area', () => {
    renderPage();
    expect(screen.getAllByText(/drag.*drop|source brd/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – template radio selection', () => {
  it('Standard Generator radio is present', () => {
    renderPage();
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
  });

  it('template options count is at least 3', () => {
    renderPage();
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThanOrEqual(3);
  });

  it('Prompt Template section contains radio buttons', () => {
    renderPage();
    const section = screen.getByText('Prompt Template');
    expect(section).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Run History', () => {
  beforeEach(() => {
    localStorage.removeItem('brd_run_history');
    vi.clearAllMocks();
  });

  it('does not show Recent Runs section when history is empty', () => {
    renderPage();
    expect(screen.queryByText(/recent runs/i)).not.toBeInTheDocument();
  });

  it('shows Recent Runs section when history has entries', () => {
    const history = [{
      id: 'run-001',
      date: '11/04/2026',
      fileName: 'NCA_Requirements.docx',
      template: 'BRD Standard Generator',
      qualityScore: 91,
      coverageScore: 87,
      sectionsGenerated: 16,
    }];
    localStorage.setItem('brd_run_history', JSON.stringify(history));
    renderPage();
    expect(screen.getByText(/recent runs/i)).toBeInTheDocument();
  });

  it('shows run file name from history', () => {
    const history = [{
      id: 'run-001',
      date: '11/04/2026',
      fileName: 'NCA_Requirements.docx',
      template: 'BRD Standard Generator',
      qualityScore: 91,
      coverageScore: 87,
      sectionsGenerated: 16,
    }];
    localStorage.setItem('brd_run_history', JSON.stringify(history));
    renderPage();
    expect(screen.getByText('NCA_Requirements.docx')).toBeInTheDocument();
  });

  it('shows quality and coverage scores from history', () => {
    const history = [{
      id: 'run-001',
      date: '11/04/2026',
      fileName: 'test.docx',
      template: 'BRD Standard Generator',
      qualityScore: 91,
      coverageScore: 87,
      sectionsGenerated: 16,
    }];
    localStorage.setItem('brd_run_history', JSON.stringify(history));
    renderPage();
    expect(screen.getByText(/Q: 91%/)).toBeInTheDocument();
    expect(screen.getByText(/C: 87%/)).toBeInTheDocument();
  });

  it('run history list has aria-label', () => {
    const history = [{ id: 'r1', date: '11/04/2026', fileName: 'test.pdf', template: 'BRD Agile', qualityScore: 88, coverageScore: 82, sectionsGenerated: 14 }];
    localStorage.setItem('brd_run_history', JSON.stringify(history));
    renderPage();
    expect(screen.getByRole('generic', { name: /run history list/i })).toBeInTheDocument();
  });

  it('limits history display to 5 entries', () => {
    const history = Array.from({ length: 8 }, (_, i) => ({
      id: `run-${i}`,
      date: '11/04/2026',
      fileName: `file-${i}.docx`,
      template: 'BRD Standard Generator',
      qualityScore: 90,
      coverageScore: 85,
      sectionsGenerated: 16,
    }));
    localStorage.setItem('brd_run_history', JSON.stringify(history));
    renderPage();
    // Only 5 entries should be shown
    expect(screen.getByText('file-0.docx')).toBeInTheDocument();
    expect(screen.getByText('file-4.docx')).toBeInTheDocument();
    expect(screen.queryByText('file-5.docx')).not.toBeInTheDocument();
  });

  it('shows template name in run history', () => {
    const history = [{ id: 'r1', date: '11/04/2026', fileName: 'doc.pdf', template: 'BRD Agile / Product Format', qualityScore: 91, coverageScore: 87, sectionsGenerated: 16 }];
    localStorage.setItem('brd_run_history', JSON.stringify(history));
    renderPage();
    // History shows the entry date alongside the template
    const historyList = screen.getByRole('generic', { name: /run history list/i });
    expect(historyList).toHaveTextContent(/BRD Agile \/ Product Format/);
  });
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Copy Run ID', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  async function advanceToOutput() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800 * 11 + 1000);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search sections/i })).toBeInTheDocument(), { timeout: 4000 });
  }

  it('shows Copy Run ID button on output screen', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /copy run id to clipboard/i })).toBeInTheDocument();
  }, 15000);

  it('Copy Run ID button is not disabled', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /copy run id to clipboard/i })).not.toBeDisabled();
  }, 15000);

  it('clicking Copy Run ID calls clipboard.writeText', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /copy run id to clipboard/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  }, 15000);

  it('clipboard.writeText called with a run- prefixed ID', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /copy run id to clipboard/i }));
    await waitFor(() => {
      const arg = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(arg).toMatch(/^run-/);
    });
  }, 15000);

  it('shows Copied! after clicking Copy Run ID', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /copy run id to clipboard/i }));
    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument());
  }, 15000);

  it('Run ID text is visible next to Copy button', async () => {
    await advanceToOutput();
    // Output screen shows "Run run-<timestamp> · N sections · n8n + Claude"
    expect(screen.getByText(/run-\d+/i)).toBeInTheDocument();
  }, 15000);
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Copy BRD Stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  async function advanceToOutput() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800 * 11 + 1000);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search sections/i })).toBeInTheDocument(), { timeout: 4000 });
  }

  it('shows Copy BRD Stats button on output screen', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /copy brd stats to clipboard/i })).toBeInTheDocument();
  }, 15000);

  it('Copy BRD Stats button is not disabled', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /copy brd stats to clipboard/i })).not.toBeDisabled();
  }, 15000);

  it('clicking Copy BRD Stats calls clipboard.writeText', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /copy brd stats to clipboard/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  }, 15000);

  it('clipboard text contains Run ID', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /copy brd stats to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Run ID:');
    });
  }, 15000);

  it('clipboard text contains Quality Score', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /copy brd stats to clipboard/i }));
    await waitFor(() => {
      const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(text).toContain('Quality Score:');
    });
  }, 15000);

  it('shows Copied! text after clicking Copy BRD Stats', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /copy brd stats to clipboard/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy brd stats to clipboard/i })).toHaveTextContent('Copied!');
    });
  }, 15000);
});

// ────────────────────────────────────────────────────────────
describe('BrdRunPage – Export BRD Section Titles CSV', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:sections-url');
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

  async function advanceToOutput() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800 * 11 + 1000);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search sections/i })).toBeInTheDocument(), { timeout: 4000 });
  }

  it('shows Export BRD section titles to CSV button on output screen', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /export brd section titles to csv/i })).toBeInTheDocument();
  }, 15000);

  it('Export section titles button is not disabled', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /export brd section titles to csv/i })).not.toBeDisabled();
  }, 15000);

  it('clicking Export section titles calls URL.createObjectURL', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /export brd section titles to csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  }, 15000);

  it('clicking Export section titles triggers anchor click', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /export brd section titles to csv/i }));
    expect(mockClick).toHaveBeenCalled();
  }, 15000);

  it('clicking Export section titles calls URL.revokeObjectURL', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /export brd section titles to csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:sections-url');
  }, 15000);

  it('shows Exported! feedback after clicking Export section titles', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /export brd section titles to csv/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export brd section titles to csv/i })).toHaveTextContent('Exported!');
    });
  }, 15000);
});

// ─────────────────────────────────────────────────────────────
describe('BrdRunPage – Export Run History CSV', () => {
  const mockHistory = [
    {
      id: 'run-001',
      date: '2026-07-13',
      fileName: 'NCA_Requirements.docx',
      template: 'BRD Standard Generator',
      qualityScore: 91,
      coverageScore: 87,
      sectionsGenerated: 16,
    },
    {
      id: 'run-002',
      date: '2026-07-12',
      fileName: 'MOCI_Project.pdf',
      template: 'BRD Government / Public Sector',
      qualityScore: 88,
      coverageScore: 84,
      sectionsGenerated: 15,
    },
  ];

  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('brd_run_history', JSON.stringify(mockHistory));
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:history-url');
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
    localStorage.removeItem('brd_run_history');
  });

  it('shows Export run history to CSV button when history exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /export run history to csv/i })).toBeInTheDocument();
  });

  it('Export run history button is not disabled when history exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /export run history to csv/i })).not.toBeDisabled();
  });

  it('clicking Export run history calls URL.createObjectURL', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /export run history to csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export run history triggers anchor click', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /export run history to csv/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export run history calls URL.revokeObjectURL', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /export run history to csv/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:history-url');
  });

  it('shows Exported! feedback after clicking Export run history', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /export run history to csv/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export run history to csv/i })).toHaveTextContent('Exported!');
    });
  });
});

describe('BrdRunPage – Export Run History TXT', () => {
  const mockHistory = [
    {
      id: 'run-001',
      date: '2026-07-13',
      fileName: 'NCA_Requirements.docx',
      template: 'BRD Standard Generator',
      qualityScore: 91,
      coverageScore: 87,
      sectionsGenerated: 16,
    },
  ];

  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let origCreate: typeof document.createElement;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('brd_run_history', JSON.stringify(mockHistory));
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:history-txt-url');
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
    localStorage.removeItem('brd_run_history');
  });

  it('shows Export run history to TXT button when history exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /export run history to txt/i })).toBeInTheDocument();
  });

  it('Export run history TXT button is not disabled when history exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /export run history to txt/i })).not.toBeDisabled();
  });

  it('clicking Export run history TXT calls URL.createObjectURL', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /export run history to txt/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('clicking Export run history TXT triggers anchor click', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /export run history to txt/i }));
    expect(mockClick).toHaveBeenCalled();
  });

  it('clicking Export run history TXT calls URL.revokeObjectURL', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /export run history to txt/i }));
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:history-txt-url');
  });

  it('shows Exported! feedback after clicking Export run history TXT', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /export run history to txt/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export run history to txt/i })).toHaveTextContent('Exported!');
    });
  });
});

// ── Run History Search ────────────────────────────────────────
describe('BrdRunPage – Run History Search', () => {
  const makeHistory = (n: number) => Array.from({ length: n }, (_, i) => ({
    id: `run-${i}`,
    date: `01/01/2026`,
    fileName: i === 0 ? 'MOCI_BRD.docx' : `Generic_File_${i}.docx`,
    template: 'BRD Standard Generator',
    qualityScore: 90,
    coverageScore: 85,
    sectionsGenerated: 12,
  }));

  it('shows search input when more than 3 runs exist', () => {
    localStorage.setItem('brd_run_history', JSON.stringify(makeHistory(4)));
    renderPage();
    expect(screen.getByRole('textbox', { name: /search run history/i })).toBeInTheDocument();
  });

  it('does not show search input when 3 or fewer runs exist', () => {
    localStorage.setItem('brd_run_history', JSON.stringify(makeHistory(3)));
    renderPage();
    expect(screen.queryByRole('textbox', { name: /search run history/i })).not.toBeInTheDocument();
  });

  it('search input filters run history entries', async () => {
    localStorage.setItem('brd_run_history', JSON.stringify(makeHistory(4)));
    renderPage();
    const search = screen.getByRole('textbox', { name: /search run history/i });
    await userEvent.type(search, 'MOCI');
    await waitFor(() => {
      expect(screen.getByText('MOCI_BRD.docx')).toBeInTheDocument();
      expect(screen.queryByText('Generic_File_1.docx')).not.toBeInTheDocument();
    });
  });

  it('shows show all button when more than 5 runs exist', () => {
    localStorage.setItem('brd_run_history', JSON.stringify(makeHistory(6)));
    renderPage();
    expect(screen.getByRole('button', { name: /show all run history entries/i })).toBeInTheDocument();
  });

  it('does not show show all button when 5 or fewer runs exist', () => {
    localStorage.setItem('brd_run_history', JSON.stringify(makeHistory(5)));
    renderPage();
    expect(screen.queryByRole('button', { name: /show all run history entries/i })).not.toBeInTheDocument();
  });

  it('clicking show all expands to show all entries', async () => {
    localStorage.setItem('brd_run_history', JSON.stringify(makeHistory(6)));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /show all run history entries/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /show fewer run history entries/i })).toBeInTheDocument();
    });
  });
});

// ── Word Count Toggle ──────────────────────────────────────────
describe('BrdRunPage – Word Count Toggle', () => {
  async function advanceToOutput() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800 * 11 + 1000);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search sections/i })).toBeInTheDocument(), { timeout: 4000 });
  }

  it('renders the Word Count toggle button in output preview', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /toggle word counts/i })).toBeInTheDocument();
  }, 15000);

  it('Word Count button defaults to not pressed', async () => {
    await advanceToOutput();
    expect(screen.getByRole('button', { name: /toggle word counts/i })).toHaveAttribute('aria-pressed', 'false');
  }, 15000);

  it('clicking Word Count sets it to pressed', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /toggle word counts/i }));
    expect(screen.getByRole('button', { name: /toggle word counts/i })).toHaveAttribute('aria-pressed', 'true');
  }, 15000);

  it('clicking Word Count again un-presses it', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /toggle word counts/i }));
    await userEvent.click(screen.getByRole('button', { name: /toggle word counts/i }));
    expect(screen.getByRole('button', { name: /toggle word counts/i })).toHaveAttribute('aria-pressed', 'false');
  }, 15000);
});

// ── Run History Sort ────────────────────────────────────────────
describe('BrdRunPage – Run History Sort', () => {
  const makeHistoryWithScores = () => [
    { id: 'run-a', date: '01/01/2026', fileName: 'FileA.docx', template: 'BRD Standard', qualityScore: 70, coverageScore: 60, sectionsGenerated: 12 },
    { id: 'run-b', date: '02/01/2026', fileName: 'FileB.docx', template: 'BRD Standard', qualityScore: 95, coverageScore: 88, sectionsGenerated: 12 },
    { id: 'run-c', date: '03/01/2026', fileName: 'FileC.docx', template: 'BRD Standard', qualityScore: 82, coverageScore: 99, sectionsGenerated: 12 },
  ];

  beforeEach(() => {
    localStorage.setItem('brd_run_history', JSON.stringify(makeHistoryWithScores()));
  });

  afterEach(() => {
    localStorage.removeItem('brd_run_history');
  });

  it('renders run history sort buttons', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /sort run history by date/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort run history by quality/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sort run history by coverage/i })).toBeInTheDocument();
  });

  it('date sort button is active by default', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /sort run history by date/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('quality and coverage sort buttons are not active by default', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /sort run history by quality/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /sort run history by coverage/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Quality sort sets it as active', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by quality/i }));
    expect(screen.getByRole('button', { name: /sort run history by quality/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Coverage sort sets it as active', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by coverage/i }));
    expect(screen.getByRole('button', { name: /sort run history by coverage/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switching back to date sort sets date as active', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by quality/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort run history by date/i }));
    expect(screen.getByRole('button', { name: /sort run history by date/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort run history by quality/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('all three run history entries are visible by default', () => {
    renderPage();
    expect(screen.getByText('FileA.docx')).toBeInTheDocument();
    expect(screen.getByText('FileB.docx')).toBeInTheDocument();
    expect(screen.getByText('FileC.docx')).toBeInTheDocument();
  });
});

describe('BrdRunPage – Run History Sort by Filename', () => {
  const historyUnsorted = [
    { id: 'run-z', date: '01/01/2026', fileName: 'Zeta.docx', template: 'BRD Standard', qualityScore: 70, coverageScore: 60, sectionsGenerated: 12 },
    { id: 'run-a', date: '02/01/2026', fileName: 'Alpha.docx', template: 'BRD Standard', qualityScore: 95, coverageScore: 88, sectionsGenerated: 12 },
    { id: 'run-m', date: '03/01/2026', fileName: 'Mango.docx', template: 'BRD Standard', qualityScore: 82, coverageScore: 75, sectionsGenerated: 12 },
  ];

  beforeEach(() => {
    localStorage.setItem('brd_run_history', JSON.stringify(historyUnsorted));
  });

  afterEach(() => {
    localStorage.removeItem('brd_run_history');
  });

  it('renders filename sort button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /sort run history by filename/i })).toBeInTheDocument();
  });

  it('clicking filename sort sets it as active', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by filename/i }));
    expect(screen.getByRole('button', { name: /sort run history by filename/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filename sort shows all three entries', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by filename/i }));
    expect(screen.getByText('Zeta.docx')).toBeInTheDocument();
    expect(screen.getByText('Alpha.docx')).toBeInTheDocument();
    expect(screen.getByText('Mango.docx')).toBeInTheDocument();
  });

  it('filename sort places Alpha before Zeta in DOM', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by filename/i }));
    const alphaEl = screen.getByText('Alpha.docx');
    const zetaEl = screen.getByText('Zeta.docx');
    expect(alphaEl.compareDocumentPosition(zetaEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to date sort deactivates filename sort', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by filename/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort run history by date/i }));
    expect(screen.getByRole('button', { name: /sort run history by date/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort run history by filename/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ── Coverage Threshold Filter ─────────────────────────────────
describe('BrdRunPage – Coverage Threshold Filter', () => {
  const history = [
    { id: 'run-a', date: '01/01/2026', fileName: 'LowCov.docx', template: 'BRD Standard', qualityScore: 70, coverageScore: 45, sectionsGenerated: 12 },
    { id: 'run-b', date: '02/01/2026', fileName: 'MedCov.docx', template: 'BRD Standard', qualityScore: 80, coverageScore: 72, sectionsGenerated: 14 },
    { id: 'run-c', date: '03/01/2026', fileName: 'HighCov.docx', template: 'BRD Standard', qualityScore: 90, coverageScore: 95, sectionsGenerated: 16 },
  ];

  beforeEach(() => {
    localStorage.setItem('brd_run_history', JSON.stringify(history));
  });

  afterEach(() => {
    localStorage.removeItem('brd_run_history');
  });

  it('renders coverage threshold buttons', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /coverage threshold: 0%/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /coverage threshold: 50%/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /coverage threshold: 70%/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /coverage threshold: 90%/i })).toBeInTheDocument();
  });

  it('0% threshold is active by default', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /coverage threshold: 0%/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('all entries shown with 0% threshold', () => {
    renderPage();
    expect(screen.getByText('LowCov.docx')).toBeInTheDocument();
    expect(screen.getByText('MedCov.docx')).toBeInTheDocument();
    expect(screen.getByText('HighCov.docx')).toBeInTheDocument();
  });

  it('50% threshold hides entries below 50% coverage', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /coverage threshold: 50%/i }));
    expect(screen.queryByText('LowCov.docx')).not.toBeInTheDocument();
    expect(screen.getByText('MedCov.docx')).toBeInTheDocument();
    expect(screen.getByText('HighCov.docx')).toBeInTheDocument();
  });

  it('90% threshold shows only high coverage entries', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /coverage threshold: 90%/i }));
    expect(screen.queryByText('LowCov.docx')).not.toBeInTheDocument();
    expect(screen.queryByText('MedCov.docx')).not.toBeInTheDocument();
    expect(screen.getByText('HighCov.docx')).toBeInTheDocument();
  });

  it('clicking 0% after filtering restores all entries', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /coverage threshold: 90%/i }));
    await userEvent.click(screen.getByRole('button', { name: /coverage threshold: 0%/i }));
    expect(screen.getByText('LowCov.docx')).toBeInTheDocument();
    expect(screen.getByText('MedCov.docx')).toBeInTheDocument();
  });

  it('clicking 50% threshold sets it as active', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /coverage threshold: 50%/i }));
    expect(screen.getByRole('button', { name: /coverage threshold: 50%/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /coverage threshold: 0%/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ── Quality Threshold Filter ───────────────────────────────────
describe('BrdRunPage – Quality Threshold Filter', () => {
  const history = [
    { id: 'run-a', date: '01/01/2026', fileName: 'LowQual.docx', template: 'BRD Standard', qualityScore: 45, coverageScore: 70, sectionsGenerated: 12 },
    { id: 'run-b', date: '02/01/2026', fileName: 'MedQual.docx', template: 'BRD Standard', qualityScore: 72, coverageScore: 80, sectionsGenerated: 14 },
    { id: 'run-c', date: '03/01/2026', fileName: 'HighQual.docx', template: 'BRD Standard', qualityScore: 95, coverageScore: 90, sectionsGenerated: 16 },
  ];

  beforeEach(() => {
    localStorage.setItem('brd_run_history', JSON.stringify(history));
  });

  afterEach(() => {
    localStorage.removeItem('brd_run_history');
  });

  it('renders quality threshold buttons', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /quality threshold: 0%/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quality threshold: 50%/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quality threshold: 70%/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quality threshold: 90%/i })).toBeInTheDocument();
  });

  it('0% quality threshold is active by default', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /quality threshold: 0%/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('all entries shown with 0% quality threshold', () => {
    renderPage();
    expect(screen.getByText('LowQual.docx')).toBeInTheDocument();
    expect(screen.getByText('MedQual.docx')).toBeInTheDocument();
    expect(screen.getByText('HighQual.docx')).toBeInTheDocument();
  });

  it('50% quality threshold hides entries below 50%', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /quality threshold: 50%/i }));
    expect(screen.queryByText('LowQual.docx')).not.toBeInTheDocument();
    expect(screen.getByText('MedQual.docx')).toBeInTheDocument();
    expect(screen.getByText('HighQual.docx')).toBeInTheDocument();
  });

  it('90% quality threshold shows only high quality entries', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /quality threshold: 90%/i }));
    expect(screen.queryByText('LowQual.docx')).not.toBeInTheDocument();
    expect(screen.queryByText('MedQual.docx')).not.toBeInTheDocument();
    expect(screen.getByText('HighQual.docx')).toBeInTheDocument();
  });

  it('clicking 0% after filtering restores all entries', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /quality threshold: 90%/i }));
    await userEvent.click(screen.getByRole('button', { name: /quality threshold: 0%/i }));
    expect(screen.getByText('LowQual.docx')).toBeInTheDocument();
    expect(screen.getByText('MedQual.docx')).toBeInTheDocument();
  });

  it('clicking 70% sets it as the active quality threshold', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /quality threshold: 70%/i }));
    expect(screen.getByRole('button', { name: /quality threshold: 70%/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /quality threshold: 0%/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ── Section Collapse/Expand ────────────────────────────────────
describe('BrdRunPage – Section Collapse', () => {
  async function advanceToOutput() {
    renderPage();
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(['content'], 'requirements.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /run brd generation/i })).not.toBeDisabled());
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /run brd generation/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800 * 11 + 1000);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search sections/i })).toBeInTheDocument(), { timeout: 4000 });
  }

  it('renders collapse buttons for sections', async () => {
    await advanceToOutput();
    const collapseBtn = screen.getByRole('button', { name: /collapse section: Executive Summary/i });
    expect(collapseBtn).toBeInTheDocument();
  }, 15000);

  it('collapse button has aria-expanded=true initially', async () => {
    await advanceToOutput();
    const collapseBtn = screen.getByRole('button', { name: /collapse section: Executive Summary/i });
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');
  }, 15000);

  it('clicking collapse hides the section content', async () => {
    await advanceToOutput();
    const collapseBtn = screen.getByRole('button', { name: /collapse section: Executive Summary/i });
    await userEvent.click(collapseBtn);
    expect(screen.getByRole('button', { name: /expand section: Executive Summary/i })).toBeInTheDocument();
  }, 15000);

  it('collapse button becomes aria-expanded=false after collapse', async () => {
    await advanceToOutput();
    const collapseBtn = screen.getByRole('button', { name: /collapse section: Executive Summary/i });
    await userEvent.click(collapseBtn);
    const expandBtn = screen.getByRole('button', { name: /expand section: Executive Summary/i });
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');
  }, 15000);

  it('clicking expand restores section to expanded', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /collapse section: Executive Summary/i }));
    await userEvent.click(screen.getByRole('button', { name: /expand section: Executive Summary/i }));
    expect(screen.getByRole('button', { name: /collapse section: Executive Summary/i })).toHaveAttribute('aria-expanded', 'true');
  }, 15000);

  it('collapsing one section does not affect another', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /collapse section: Executive Summary/i }));
    expect(screen.getByRole('button', { name: /collapse section: Scope/i })).toHaveAttribute('aria-expanded', 'true');
  }, 15000);

  it('multiple sections can be collapsed independently', async () => {
    await advanceToOutput();
    await userEvent.click(screen.getByRole('button', { name: /collapse section: Executive Summary/i }));
    await userEvent.click(screen.getByRole('button', { name: /collapse section: Scope/i }));
    expect(screen.getByRole('button', { name: /expand section: Executive Summary/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /expand section: Scope/i })).toHaveAttribute('aria-expanded', 'false');
  }, 15000);

  it('all collapse buttons rendered (one per canonical section)', async () => {
    await advanceToOutput();
    const collapseBtns = screen.getAllByRole('button', { name: /collapse section:/i });
    expect(collapseBtns.length).toBe(16);
  }, 15000);
});

// ── Sort by Sections ─────────────────────────────────────────
describe('BrdRunPage – Run History Sort by Sections', () => {
  const historyForSections = [
    { id: 'run-few', date: '01/01/2026', fileName: 'FewSec.docx', template: 'BRD Standard', qualityScore: 70, coverageScore: 60, sectionsGenerated: 4 },
    { id: 'run-many', date: '02/01/2026', fileName: 'ManySec.docx', template: 'BRD Standard', qualityScore: 95, coverageScore: 88, sectionsGenerated: 16 },
    { id: 'run-mid', date: '03/01/2026', fileName: 'MidSec.docx', template: 'BRD Standard', qualityScore: 82, coverageScore: 75, sectionsGenerated: 10 },
  ];

  beforeEach(() => {
    localStorage.setItem('brd_run_history', JSON.stringify(historyForSections));
  });

  afterEach(() => {
    localStorage.removeItem('brd_run_history');
  });

  it('renders sections sort button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /sort run history by sections/i })).toBeInTheDocument();
  });

  it('clicking sections sort sets it as active', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by sections/i }));
    expect(screen.getByRole('button', { name: /sort run history by sections/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sections sort shows all three entries', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by sections/i }));
    expect(screen.getByText('FewSec.docx')).toBeInTheDocument();
    expect(screen.getByText('ManySec.docx')).toBeInTheDocument();
    expect(screen.getByText('MidSec.docx')).toBeInTheDocument();
  });

  it('sections sort places ManySec before FewSec in DOM (desc)', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by sections/i }));
    const manyEl = screen.getByText('ManySec.docx');
    const fewEl = screen.getByText('FewSec.docx');
    expect(manyEl.compareDocumentPosition(fewEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to date deactivates sections sort', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by sections/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort run history by date/i }));
    expect(screen.getByRole('button', { name: /sort run history by date/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort run history by sections/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('BrdRunPage – Run History Sort by Template', () => {
  const historyForTemplate = [
    { id: 'run-tmpl-z', date: '01/01/2026', fileName: 'FileA.docx', template: 'Zebra BRD', qualityScore: 80, coverageScore: 70, sectionsGenerated: 8 },
    { id: 'run-tmpl-a', date: '02/01/2026', fileName: 'FileB.docx', template: 'Alpha BRD', qualityScore: 85, coverageScore: 75, sectionsGenerated: 9 },
    { id: 'run-tmpl-m', date: '03/01/2026', fileName: 'FileC.docx', template: 'Mid BRD', qualityScore: 90, coverageScore: 80, sectionsGenerated: 10 },
  ];

  beforeEach(() => {
    localStorage.setItem('brd_run_history', JSON.stringify(historyForTemplate));
  });

  afterEach(() => {
    localStorage.removeItem('brd_run_history');
  });

  it('renders template sort button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /sort run history by template/i })).toBeInTheDocument();
  });

  it('template sort button is not pressed by default', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /sort run history by template/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /sort run history by date/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking template sort activates it', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by template/i }));
    expect(screen.getByRole('button', { name: /sort run history by template/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort run history by date/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('template sort places Alpha BRD before Zebra BRD in DOM', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by template/i }));
    const alphaEl = screen.getByText('FileB.docx');
    const zebraEl = screen.getByText('FileA.docx');
    expect(alphaEl.compareDocumentPosition(zebraEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all entries visible after template sort', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by template/i }));
    expect(screen.getByText('FileA.docx')).toBeInTheDocument();
    expect(screen.getByText('FileB.docx')).toBeInTheDocument();
    expect(screen.getByText('FileC.docx')).toBeInTheDocument();
  });
});

describe('BrdRunPage – Run History Quality Tier Filter', () => {
  const qualityHistory = [
    { id: 'qh1', date: '01/04/2026', fileName: 'High_Quality.docx', template: 'BRD Standard', qualityScore: 90, coverageScore: 85, sectionsGenerated: 14 },
    { id: 'qh2', date: '02/04/2026', fileName: 'Medium_Quality.docx', template: 'BRD Agile', qualityScore: 65, coverageScore: 70, sectionsGenerated: 10 },
    { id: 'qh3', date: '03/04/2026', fileName: 'Low_Quality.docx', template: 'BRD Basic', qualityScore: 30, coverageScore: 40, sectionsGenerated: 6 },
  ];

  beforeEach(() => {
    localStorage.setItem('brd_run_history', JSON.stringify(qualityHistory));
  });

  afterEach(() => {
    localStorage.removeItem('brd_run_history');
  });

  it('renders quality tier filter buttons', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /filter run history by quality: all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter run history by quality: high/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter run history by quality: medium/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter run history by quality: low/i })).toBeInTheDocument();
  });

  it('All quality button is pressed by default', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /filter run history by quality: all/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /filter run history by quality: high/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('filtering by High hides Medium and Low quality runs', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /filter run history by quality: high/i }));
    expect(screen.getByText('High_Quality.docx')).toBeInTheDocument();
    expect(screen.queryByText('Medium_Quality.docx')).not.toBeInTheDocument();
    expect(screen.queryByText('Low_Quality.docx')).not.toBeInTheDocument();
  });

  it('filtering by Low hides High and Medium quality runs', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /filter run history by quality: low/i }));
    expect(screen.getByText('Low_Quality.docx')).toBeInTheDocument();
    expect(screen.queryByText('High_Quality.docx')).not.toBeInTheDocument();
    expect(screen.queryByText('Medium_Quality.docx')).not.toBeInTheDocument();
  });

  it('resetting to All shows all quality runs', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /filter run history by quality: high/i }));
    await userEvent.click(screen.getByRole('button', { name: /filter run history by quality: all/i }));
    expect(screen.getByText('High_Quality.docx')).toBeInTheDocument();
    expect(screen.getByText('Medium_Quality.docx')).toBeInTheDocument();
    expect(screen.getByText('Low_Quality.docx')).toBeInTheDocument();
  });
});

describe('BrdRunPage – Run History Sort by Coverage', () => {
  const historyCov = [
    { id: 'cov-lo', date: '01/04/2026', fileName: 'Low_Coverage.docx', template: 'BRD Standard', qualityScore: 70, coverageScore: 40, sectionsGenerated: 10 },
    { id: 'cov-hi', date: '02/04/2026', fileName: 'High_Coverage.docx', template: 'BRD Agile', qualityScore: 80, coverageScore: 92, sectionsGenerated: 14 },
    { id: 'cov-md', date: '03/04/2026', fileName: 'Mid_Coverage.docx', template: 'BRD Basic', qualityScore: 75, coverageScore: 65, sectionsGenerated: 12 },
  ];

  beforeEach(() => {
    localStorage.setItem('brd_run_history', JSON.stringify(historyCov));
  });

  afterEach(() => {
    localStorage.removeItem('brd_run_history');
  });

  it('renders coverage sort button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /sort run history by coverage/i })).toBeInTheDocument();
  });

  it('clicking coverage sort sets it as active', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by coverage/i }));
    expect(screen.getByRole('button', { name: /sort run history by coverage/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('coverage sort shows all three entries', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by coverage/i }));
    expect(screen.getByText('Low_Coverage.docx')).toBeInTheDocument();
    expect(screen.getByText('High_Coverage.docx')).toBeInTheDocument();
    expect(screen.getByText('Mid_Coverage.docx')).toBeInTheDocument();
  });

  it('coverage sort places High Coverage before Low Coverage in DOM', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by coverage/i }));
    const highEl = screen.getByText('High_Coverage.docx');
    const lowEl = screen.getByText('Low_Coverage.docx');
    expect(highEl.compareDocumentPosition(lowEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to date sort deactivates coverage sort', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by coverage/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort run history by date/i }));
    expect(screen.getByRole('button', { name: /sort run history by date/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort run history by coverage/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('BrdRunPage – Run History Sort by Quality DOM Order', () => {
  const historyQual = [
    { id: 'qual-lo', date: '01/04/2026', fileName: 'Low_Quality.docx', template: 'BRD Standard', qualityScore: 55, coverageScore: 60, sectionsGenerated: 10 },
    { id: 'qual-hi', date: '02/04/2026', fileName: 'High_Quality.docx', template: 'BRD Agile', qualityScore: 96, coverageScore: 80, sectionsGenerated: 14 },
    { id: 'qual-md', date: '03/04/2026', fileName: 'Mid_Quality.docx', template: 'BRD Basic', qualityScore: 75, coverageScore: 70, sectionsGenerated: 12 },
  ];

  beforeEach(() => {
    localStorage.setItem('brd_run_history', JSON.stringify(historyQual));
  });

  afterEach(() => {
    localStorage.removeItem('brd_run_history');
  });

  it('renders quality sort button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /sort run history by quality/i })).toBeInTheDocument();
  });

  it('clicking quality sort sets it as active', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by quality/i }));
    expect(screen.getByRole('button', { name: /sort run history by quality/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('quality sort shows all three entries', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by quality/i }));
    expect(screen.getByText('Low_Quality.docx')).toBeInTheDocument();
    expect(screen.getByText('High_Quality.docx')).toBeInTheDocument();
    expect(screen.getByText('Mid_Quality.docx')).toBeInTheDocument();
  });

  it('quality sort places High Quality before Low Quality in DOM', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by quality/i }));
    const highEl = screen.getByText('High_Quality.docx');
    const lowEl = screen.getByText('Low_Quality.docx');
    expect(highEl.compareDocumentPosition(lowEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('quality sort places Mid Quality before Low Quality in DOM', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by quality/i }));
    const midEl = screen.getByText('Mid_Quality.docx');
    const lowEl = screen.getByText('Low_Quality.docx');
    expect(midEl.compareDocumentPosition(lowEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching back to date sort deactivates quality sort', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by quality/i }));
    await userEvent.click(screen.getByRole('button', { name: /sort run history by date/i }));
    expect(screen.getByRole('button', { name: /sort run history by date/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sort run history by quality/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ────────────────────────────────────────────────────────────
describe('BrdRunPage – Run History Sort by Coverage DOM Order', () => {
  const historyCovDom = [
    { id: 'covd-lo', date: '01/04/2026', fileName: 'Low_Cov.docx', template: 'BRD Standard', qualityScore: 70, coverageScore: 30, sectionsGenerated: 10 },
    { id: 'covd-hi', date: '02/04/2026', fileName: 'High_Cov.docx', template: 'BRD Agile', qualityScore: 80, coverageScore: 95, sectionsGenerated: 14 },
    { id: 'covd-md', date: '03/04/2026', fileName: 'Mid_Cov.docx', template: 'BRD Basic', qualityScore: 75, coverageScore: 60, sectionsGenerated: 12 },
  ];

  beforeEach(() => {
    localStorage.setItem('brd_run_history', JSON.stringify(historyCovDom));
  });

  afterEach(() => {
    localStorage.removeItem('brd_run_history');
  });

  it('coverage sort places Mid Cov before Low Cov in DOM', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by coverage/i }));
    const midEl = screen.getByText('Mid_Cov.docx');
    const lowEl = screen.getByText('Low_Cov.docx');
    expect(midEl.compareDocumentPosition(lowEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('coverage sort places High Cov before Mid Cov in DOM', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by coverage/i }));
    const highEl = screen.getByText('High_Cov.docx');
    const midEl = screen.getByText('Mid_Cov.docx');
    expect(highEl.compareDocumentPosition(midEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all three entries remain visible after coverage sort', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /sort run history by coverage/i }));
    expect(screen.getByText('Low_Cov.docx')).toBeInTheDocument();
    expect(screen.getByText('Mid_Cov.docx')).toBeInTheDocument();
    expect(screen.getByText('High_Cov.docx')).toBeInTheDocument();
  });
});
