# Consultant OS — n8n BRD Automation Workflows

## Overview

10 modular n8n workflows + 5 sub-workflows that implement the full BRD generation pipeline.

```
WF01 Intake → WF02 Parse → WF03 Quality Gate → WF04 Sample Blueprint
→ WF05 Semantic Extraction → WF06 Gap Analysis → WF07 Section Generation
→ WF08 Assembly + QA → WF09 Export → WF10 Callback
```

---

## Import Order

Import into n8n in this order (sub-workflows first):

1. `sub-workflows/SUB_Callback_Status.json`
2. `sub-workflows/SUB_Parse_Document_By_Type.json`
3. `sub-workflows/SUB_Call_Claude_JSON.json`
4. `sub-workflows/SUB_Validate_JSON_Schema.json`
5. `sub-workflows/SUB_Render_DOCX.json`
6. `WF01_BRD_Intake_Run_Init.json`
7. `WF02_BRD_Parse_Normalize.json`
8. `WF03_BRD_Quality_Gate.json`
9. `WF04_BRD_Sample_Blueprint.json`
10. `WF05_BRD_Extract_Semantic_Model.json`
11. `WF06_BRD_Gap_Analysis.json`
12. `WF07_BRD_Generate_Sections.json`
13. `WF08_BRD_Assemble_Validate.json`
14. `WF09_BRD_Export_Output.json`
15. `WF10_BRD_Callback_Complete.json`

---

## Required Environment Variables (n8n)

| Variable | Description |
|---|---|
| `CONSULTANT_OS_URL` | Base URL of Consultant OS API (e.g. `http://localhost:3001`) |
| `N8N_CALLBACK_SECRET` | Shared secret for callback authentication |
| `STORAGE_BASE_URL` | Object storage base URL (S3 / Supabase Storage) |
| `DOCX_RENDER_URL` | URL of DOCX render service (pandoc/docxtemplater) |
| `RENDER_SERVICE_KEY` | Auth key for render service |

---

## Required n8n Credentials

| Credential | Used by |
|---|---|
| **Supabase** | All WF nodes that read/write `automation_runs`, `automation_run_events`, `automation_run_sections`, `automation_run_files` |
| **Anthropic (Claude)** | WF04, WF05, WF06, WF07, WF08 — all LLM generation nodes |

---

## Webhook Endpoint

WF01 exposes:
```
POST /webhook/automation/brd/run
```

Consultant OS calls this to start a run. Payload:
```json
{
  "runId": "uuid",
  "workspaceId": "uuid",
  "userId": "uuid",
  "automationType": "brd_generator",
  "promptTemplateId": "brd_standard_v1",
  "inputFile": { "fileId": "uuid", "name": "source.pdf", "mimeType": "application/pdf", "url": "signed_url" },
  "sampleFiles": [{ "fileId": "uuid", "name": "sample.docx", "url": "signed_url" }],
  "options": { "language": "en", "outputFormat": "docx", "comparisonMode": true }
}
```

---

## Callback

WF10 POSTs to `CONSULTANT_OS_URL/api/automation/brd/callback` with:
```json
{
  "runId": "uuid",
  "status": "completed",
  "outputs": { "previewUrl": "...", "docxUrl": "...", "pdfUrl": "..." },
  "qualityReport": { "score": 0.91, "consistencyScore": 0.88, "warnings": [] },
  "comparison": { "sampleCoverage": 0.87, "missingSectionsBeforeGeneration": 3, "resolvedAfterGeneration": 3 }
}
```

---

## Production Notes

### DOCX Rendering
`SUB_Render_DOCX` calls `DOCX_RENDER_URL`. Recommended options:
- **Pandoc** (self-hosted): `pandoc -f markdown -t docx`
- **CloudConvert API**: Convert markdown → DOCX via API
- **docxtemplater** (Node.js Lambda): Template-based Word generation

### PDF Parsing
`SUB_Parse_Document_By_Type` stubs are provided. Connect to:
- **AWS Textract** for scanned PDFs
- **Azure Form Recognizer** for structured forms
- **pdfminer/pymupdf** (Python service) for clean PDFs

### Claude Models Used
| Workflow | Model | Reason |
|---|---|---|
| WF04 Blueprint | `claude-opus-4-6` | Best structural analysis |
| WF05 Extraction | `claude-opus-4-6` | Complex JSON extraction |
| WF06 Gap Analysis | `claude-sonnet-4-6` | Fast analysis |
| WF07 Section Gen | `claude-sonnet-4-6` | Per-section generation |
| WF08 QA | `claude-sonnet-4-6` | Review tasks |

---

## Database

Run `supabase/add_automation_tables.sql` before activating workflows.

Tables created:
- `prompt_templates`
- `automation_runs`
- `automation_run_files`
- `automation_run_events`
- `automation_run_sections`
