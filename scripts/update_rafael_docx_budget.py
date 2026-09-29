"""Add budget and timeline estimates to Rafael suggestion docx."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor


def add_table(doc: Document, headers: list[str], rows: list[tuple[str, ...]]):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    for col, text in enumerate(headers):
        table.rows[0].cells[col].text = text
        for run in table.rows[0].cells[col].paragraphs[0].runs:
            run.bold = True
    for row in rows:
        cells = table.add_row().cells
        for col, value in enumerate(row):
            cells[col].text = value
    doc.add_paragraph("")


def add_budget_section(doc: Document) -> None:
    doc.add_heading("Development Budget & Timeline Estimate", level=1)
    doc.add_paragraph(
        "The estimates below cover optional future work on Portfolio Tree Explorer, including "
        "a local AI assistant (Ollama) and the 17-feature enhancement roadmap. Figures reflect "
        "a freelancer delivery model with AI-assisted development (e.g. Cursor, Copilot), which "
        "reduces build time compared to traditional estimates. Assumes one developer familiar "
        "with this codebase, local deployment, English-only UI, and confirm-before-apply for "
        "all AI-driven product edits."
    )

    doc.add_heading("Package Options — Summary", level=2)
    add_table(
        doc,
        ["Package", "Scope", "Effort", "Timeline", "Budget (USD)"],
        [
            (
                "A — Local AI MVP",
                "Chat Q&A + move/rename/focus via natural language (with confirmation)",
                "35–50 hours",
                "1–1.5 weeks",
                "USD 900 – 2,000",
            ),
            (
                "B — Local AI complete",
                "Package A + smarter context, fuzzy ticker match, Ollama setup docs",
                "45–60 hours",
                "1.5–2 weeks",
                "USD 1,200 – 2,400",
            ),
            (
                "C — AI + top priorities",
                "Package B + round-trip export, QC gate, changes-only export, expanded QC",
                "85–110 hours",
                "3–4 weeks",
                "USD 2,100 – 4,400",
            ),
            (
                "D — Full roadmap",
                "All 17 suggested enhancements (Steps 1–17)",
                "130–190 hours",
                "6–10 weeks",
                "USD 3,250 – 7,600",
            ),
        ],
    )

    doc.add_heading("Local AI Assistant — Detailed Breakdown", level=2)
    doc.add_paragraph(
        "Recommended approach: Ollama (local LLM) + Flask API + chat panel in the existing UI. "
        "The AI answers questions about the tree and proposes edits; the user confirms before "
        "changes are applied using the existing edit, undo, and audit system."
    )
    add_table(
        doc,
        ["Phase", "Deliverables", "Effort", "Timeline", "Budget (USD)"],
        [
            ("Phase 1 — Read-only", "Chat UI, Ollama integration, tree Q&A", "10–14 h", "2–3 days", "USD 300 – 550"),
            ("Phase 2 — Actions", "Move, rename, focus via AI + confirm dialogs", "14–22 h", "3–4 days", "USD 400 – 900"),
            ("Phase 3 — Polish", "Smart context, error handling, setup docs", "10–14 h", "2–3 days", "USD 300 – 550"),
            ("Total (Phases 1–3)", "Production-ready local AI v1", "34–50 h", "1–1.5 weeks", "USD 900 – 2,000"),
        ],
    )

    doc.add_heading("17-Feature Roadmap — Effort by Tier", level=2)
    add_table(
        doc,
        ["Tier", "Features", "Effort", "Timeline", "Budget (USD)"],
        [
            ("High impact (Steps 1–5)", "Round-trip export, QC gate, changes export, expanded QC, import report", "45–65 h", "1.5–2 weeks", "USD 1,125 – 2,600"),
            ("Medium (Steps 6–11)", "Stats, filters, shortcuts, session recovery, preview, copy path", "30–45 h", "1–1.5 weeks", "USD 750 – 1,800"),
            ("Nice to have (Steps 12–17)", "Compare datasets, snapshots, image export, bulk ops, README, tests", "40–60 h", "1.5–2 weeks", "USD 1,000 – 2,400"),
            ("Full total", "All 17 enhancements", "130–190 h", "6–10 weeks", "USD 3,250 – 7,600"),
        ],
    )

    doc.add_heading("Rate Assumptions", level=2)
    add_table(
        doc,
        ["Rate tier", "Hourly rate", "Notes"],
        [
            ("Freelancer (AI-assisted)", "USD 25 – 40 / hour", "Budget ranges above use this tier"),
            ("Standard freelancer", "USD 45 – 60 / hour", "Add approximately 50–75% to totals"),
            ("Senior / agency", "USD 70 – 90+ / hour", "Add approximately 100–150% to totals"),
        ],
    )

    doc.add_heading("Optional Add-Ons", level=2)
    for item in [
        "Cloud AI fallback (OpenAI): +USD 200 – 400 (5–10 hours)",
        "Client training / workshop: +USD 150 – 300 (3–6 hours)",
        "Ongoing maintenance retainer: USD 150 – 400 / month",
    ]:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_heading("Recommended Next Step", level=2)
    doc.add_paragraph(
        "Start with Package A (Local AI MVP) or Steps 1–5 of the roadmap for the fastest business value. "
        "Package C combines AI with the highest-priority product gaps for a complete "
        "edit → validate → export workflow."
    )


def copy_paragraph(doc: Document, para) -> None:
    text = para.text.strip()
    if not text:
        return
    if para.style.name.startswith("Heading"):
        level = int(para.style.name.replace("Heading ", "") or "1")
        doc.add_heading(text, level=level)
    elif "List Bullet" in para.style.name:
        doc.add_paragraph(text, style="List Bullet")
    else:
        doc.add_paragraph(text)


def rebuild_document(path: Path) -> None:
    source = path.parent / "Portfolio-Tree-Explorer-Feature-Roadmap.docx"
    rafael_line = "I am ready for this project. Rafael"

    doc = Document()
    title = doc.add_heading("Portfolio Tree Explorer", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    subtitle = doc.add_paragraph("Feature Suggestions, Budget & Timeline")
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.runs[0].bold = True
    subtitle.runs[0].font.size = Pt(14)

    if source.exists():
        src = Document(source)
        for para in src.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            if text in {"Portfolio Tree Explorer", "17 Feature Suggestions for a Complete, Polished Product"}:
                continue
            if text.startswith("Document prepared for"):
                break
            copy_paragraph(doc, para)

        for table in src.tables:
            new_table = doc.add_table(rows=len(table.rows), cols=len(table.columns))
            new_table.style = "Table Grid"
            for r, row in enumerate(table.rows):
                for c, cell in enumerate(row.cells):
                    new_table.rows[r].cells[c].text = cell.text
            doc.add_paragraph("")
    else:
        doc.add_paragraph(
            "See Portfolio-Tree-Explorer-Feature-Roadmap.docx for the full 17-feature description."
        )

    add_budget_section(doc)

    sign = doc.add_paragraph(rafael_line)
    sign.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sign.runs[0].bold = True

    footer = doc.add_paragraph(
        "Document prepared for client review — Portfolio Tree Explorer (features, budget & timeline)"
    )
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.runs[0].italic = True
    footer.runs[0].font.size = Pt(10)
    footer.runs[0].font.color.rgb = RGBColor(100, 100, 100)

    doc.save(path)


def main() -> None:
    docs = Path(__file__).resolve().parents[1] / "docs"
    primary = docs / "Rafael suggestion for this project.docx"
    fallback = docs / "Rafael suggestion for this project - with budget.docx"

    try:
        rebuild_document(primary)
        print(f"Updated: {primary}")
    except PermissionError:
        rebuild_document(fallback)
        print(f"Original file is open — saved instead to: {fallback}")
        print("Close the original in Word, then replace it with this file.")


if __name__ == "__main__":
    main()
