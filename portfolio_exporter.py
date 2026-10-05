"""Export portfolio output rows to CSV, TXT, XLSX, or ODS."""

from __future__ import annotations

import io
from typing import Any

import pandas as pd

OUTPUT_HEADERS = [
    "parent",
    "portfolio_code",
    "portfolio_name",
    "full_name",
    "portfolio_type",
    "pos_table",
    "nav_subtotal",
    "currency",
    "group",
    "benchmark",
    "extern_entity",
    "extern_entity_type",
    "extern_acct",
    "operating_timezone",
    "duration_type",
    "legal_s",
    "portfolio_manager",
    "asst_portfolio_manager",
    "portfolio_perms",
    "importance",
    "comment",
]

SUPPORTED_OUTPUT_FORMATS = {"csv", "txt", "xlsx", "ods"}

MIME_TYPES = {
    "csv": "text/csv; charset=utf-8",
    "txt": "text/plain; charset=utf-8",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ods": "application/vnd.oasis.opendocument.spreadsheet",
}


def export_output_rows(rows: list[dict[str, Any]], fmt: str) -> tuple[bytes, str]:
    """Return file bytes and MIME type for the requested output format."""

    return _export_rows(rows, fmt, OUTPUT_HEADERS)


def export_hierarchy_rows(
    rows: list[dict[str, Any]], headers: list[str], fmt: str
) -> tuple[bytes, str]:
    """Export rows back to the original Level 1 / Level 2 / ... input shape."""

    return _export_rows(rows, fmt, headers)


def export_hierarchy_workbook(
    sheets: dict[str, list[dict[str, Any]]], headers: list[str], fmt: str
) -> tuple[bytes, str]:
    """Export hierarchy rows split into one sheet per tree level.

    Mirrors the client's original workbook layout, where each ``Level_N``
    sheet holds the rows for that depth but shares the same columns.
    """

    normalized = (fmt or "xlsx").lower()
    if normalized not in {"xlsx", "ods"}:
        raise ValueError("A multi-sheet hierarchy export requires xlsx or ods.")
    if not sheets:
        raise ValueError("No rows were provided for the hierarchy export.")

    engine = "openpyxl" if normalized == "xlsx" else "odf"
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine=engine) as writer:
        for sheet_name, rows in sheets.items():
            frame = pd.DataFrame(rows).reindex(columns=headers, fill_value="")
            frame.to_excel(writer, index=False, sheet_name=str(sheet_name)[:31] or "Sheet1")

    buffer.seek(0)
    return buffer.read(), MIME_TYPES[normalized]


def _export_rows(
    rows: list[dict[str, Any]], fmt: str, headers: list[str]
) -> tuple[bytes, str]:
    normalized = (fmt or "csv").lower()
    if normalized not in SUPPORTED_OUTPUT_FORMATS:
        raise ValueError("Output format must be csv, txt, xlsx, or ods.")

    frame = pd.DataFrame(rows)
    frame = frame.reindex(columns=headers, fill_value="")

    buffer = io.BytesIO()
    if normalized == "csv":
        frame.to_csv(buffer, index=False)
    elif normalized == "txt":
        frame.to_csv(buffer, index=False, sep="\t")
    elif normalized == "xlsx":
        frame.to_excel(buffer, index=False, engine="openpyxl")
    else:
        frame.to_excel(buffer, index=False, engine="odf")

    buffer.seek(0)
    return buffer.read(), MIME_TYPES[normalized]
