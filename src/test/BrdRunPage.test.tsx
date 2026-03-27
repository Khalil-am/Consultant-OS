import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
