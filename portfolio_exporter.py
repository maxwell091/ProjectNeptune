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

    normalized = (fmt or "csv").lower()
    if normalized not in SUPPORTED_OUTPUT_FORMATS:
        raise ValueError("Output format must be csv, txt, xlsx, or ods.")

    frame = pd.DataFrame(rows)
    frame = frame.reindex(columns=OUTPUT_HEADERS, fill_value="")

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
