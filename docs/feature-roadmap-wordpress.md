# Portfolio Tree Explorer — 17 Feature Suggestions for a Complete, Polished Product

**Portfolio Tree Explorer** is a local web app for importing portfolio hierarchy files, exploring them as an interactive tree, editing and modeling rebalancing changes, running quality checks, and generating standardized output files.

This roadmap lists **17 suggested enhancements** to make the product more complete and production-ready, organized by priority.

---

## What the App Already Does Well

- Import hierarchy files (CSV, XLSX, ODS)
- Interactive tree visualization with search, zoom, pan, and custom scrollbars
- Edit mode: rename, change currency, move nodes, drag-and-drop, delete, bulk add
- Undo / redo / undo all with change audit log
- QC report (invalid CCY, ticker length, tree depth)
- Cross-held analyzer (duplicate portfolios across portgroups)
- Generate Output download (CSV, TXT, XLSX, ODS) reflecting in-session edits

---

## High Impact — Core Workflow (Steps 1–5)

### 1. Save / Round-Trip Export to Input Format

**Current state:** Generate Output downloads the **downstream output schema** (`parent`, `portfolio_name`, `portfolio_type`, etc.), not the original import format (`Level 1`, `Level 2`, `CCY`, …).

**Suggestion:** Add **“Export hierarchy”** or **“Save as input file”** to export the edited tree back to the original Level 1 / Level 2 / … CSV or Excel structure so users can re-import, share with colleagues, or keep the source workbook up to date.

**Why it matters:** Closes the full **edit → validate → export → re-import** loop for teams that work in the hierarchy template.

---

### 2. “Changes Only” Export

**Current state:** The audit log and changed-node tracking exist in the browser session, but exports always include the full tree.

**Suggestion:**
- Export only modified rows (input or output format)
- Export the audit log as CSV
- Show a **Before vs After** summary before Generate Output

**Why it matters:** Supports review and approval workflows where stakeholders need to see exactly what changed.

---

### 3. QC Gate Before Output

**Current state:** QC runs independently; Generate Output does not block or warn when errors exist.

**Suggestion:**
- Show a warning if QC errors are present
- Offer **“Fix first”** vs **“Export anyway”**
- Display a QC summary badge in the header (e.g. “3 errors”)

**Why it matters:** Prevents accidental export of invalid portfolio data.

---

### 4. Expanded QC Rules

**Current state:** QC checks invalid CCY, ticker length (> 10 chars), and tree depth (> 10 levels).

**Suggestion:** Add rules such as:
- Duplicate ticker under the **same parent**
- Empty ticker or name
- Invalid ticker characters
- Path inconsistency (Level columns vs tree path)
- Broken hierarchy on import

**Why it matters:** Catches more real-world data issues before export.

---

### 5. Import Validation Report

**Current state:** Upload succeeds or fails with a single error message.

**Suggestion:** After upload, show a structured report:
- Rows loaded / skipped
- Warnings (duplicate paths, missing CCY, unrecognized columns)
- Auto-run QC immediately after load

**Why it matters:** Users know upfront whether the file is clean before editing.

---

## Medium Impact — Polish & Usability (Steps 6–11)

### 6. Tree Statistics Panel

**Suggestion:** A compact panel showing:
- Total nodes, branches vs leaves
- Count by level and by currency
- Maximum depth

**Why it matters:** Quick overview for large portfolios without expanding the whole tree.

---

### 7. Filter / Highlight Modes

**Suggestion:**
- Highlight by currency or level
- Show only branches or only leaves
- “Show changed nodes only”

**Why it matters:** Makes navigation and review faster on complex trees.

---

### 8. Keyboard Shortcuts & Navigation

**Suggestion:** Document and expand shortcuts, for example:
- `/` — focus search
- `Ctrl+Z` / `Ctrl+Y` — undo / redo
- Arrow keys — move selection in the tree
- `Enter` — expand / collapse selected node

**Why it matters:** Power users can work much faster.

---

### 9. Session Recovery

**Suggestion:**
- Warn on page refresh if unsaved edits exist
- Optional `localStorage` backup of edited tree and audit log

**Why it matters:** Reduces lost work from accidental refresh or browser close.

---

### 10. Output Preview

**Suggestion:** Before download, show a preview table with first N rows, total row count, and QC status.

**Why it matters:** Users can confirm format and content before saving the file.

---

### 11. Copy Path / Copy Row

**Suggestion:** For the selected node:
- Copy breadcrumb path (e.g. `BCPP-ALL > BCPROP > BCPROPEQ`)
- Copy as an input-format row for pasting into Excel

**Why it matters:** Speeds up manual updates and communication with other teams.

---

## Nice to Have — Completeness (Steps 12–17)

### 12. Compare Two Datasets

**Suggestion:** Load a baseline file vs current tree and highlight added, moved, deleted, or renamed nodes.

**Why it matters:** Useful for regression checks after rebalancing or version comparisons.

---

### 13. Named Snapshots (What-If Scenarios)

**Suggestion:** Save tree state as named scenarios (e.g. “Scenario A”, “Scenario B”), switch between them, and compare.

**Why it matters:** Supports rebalancing exploration without losing the original structure.

---

### 14. Export Tree as Image

**Suggestion:** Export the visible tree as PNG or SVG for reports and presentations.

**Why it matters:** Non-technical stakeholders often need visuals, not spreadsheets.

---

### 15. Bulk Operations

**Suggestion:**
- Bulk CCY update under a selected branch
- Find & replace ticker or name
- Bulk delete under a node (with confirmation)

**Why it matters:** Large restructuring tasks become practical.

---

### 16. README & Onboarding

**Current state:** README describes an earlier version of the app (basic load and drag/drop only).

**Suggestion:**
- Update README with all current features
- Add a short in-app tour or help panel for first-time users

**Why it matters:** Reduces learning curve and support questions.

---

### 17. Tests & Offline Reliability

**Suggestion:**
- Unit tests for `portfolio_loader.py`, `portfolio_exporter.py`, and QC rules
- Vendor D3.js locally (app currently loads D3 from a CDN)

**Why it matters:** Safer refactors and reliable use without internet on first load.

---

## Recommended Priority Order

| Priority | Step | Feature | Main benefit |
|:--------:|:----:|---------|--------------|
| 1 | 1 | Round-trip input export | Complete edit workflow |
| 2 | 3 | QC gate before output | Prevent bad exports |
| 3 | 2 | Changes-only export + audit export | Review & approval |
| 4 | 4 | Expanded QC rules | Catch more data issues |
| 5 | 5 | Import validation report | Trust at upload time |
| 6 | 6 | Tree statistics | Large-tree overview |
| 7 | 7 | Filters & highlights | Faster navigation |
| 8 | 10 | Output preview | Fewer download mistakes |
| 9 | 8 | Keyboard shortcuts | Power-user efficiency |
| 10 | 16 | README & onboarding | Easier adoption |
| 11 | 9 | Session recovery | Less lost work |
| 12 | 11 | Copy path / row | Manual workflow support |
| 13 | 12 | Compare datasets | Version control |
| 14 | 15 | Bulk operations | Large restructures |
| 15 | 13 | Named snapshots | What-if analysis |
| 16 | 14 | Export as image | Reporting |
| 17 | 17 | Tests & offline D3 | Stability & offline use |

---

## Clarification: Generate Output vs Round-Trip Export

| Question | Answer |
|----------|--------|
| Can users download after editing? | **Yes** — via **Generate Output** |
| Can users download as Excel? | **Yes** — XLSX and ODS |
| Do edits appear in the download? | **Yes** — built from current in-memory tree |
| Is it the same format as the uploaded file? | **No** — output uses a different downstream schema |
| Can the download be re-imported as hierarchy input? | **Not reliably** — different column structure |

If the workflow ends with the **output file** for another system, Generate Output may be sufficient. If teams also need the **original hierarchy workbook** updated, **Step 1** remains the highest-value addition.

---

## Summary

Portfolio Tree Explorer already delivers a strong **import → explore → edit → analyze → export** flow. The largest gap for a “complete” product is **exporting back to the original hierarchy format**, followed by **stronger validation**, **change tracking in exports**, and **usability polish** for large trees.

Implementing these 17 steps in priority order would move the app from a capable internal tool to a polished, production-ready portfolio hierarchy platform.

---

*Document prepared for Portfolio Tree Explorer — feature roadmap for client review. Word version: `Portfolio-Tree-Explorer-Feature-Roadmap.docx`.*
