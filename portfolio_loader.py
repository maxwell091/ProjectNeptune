"""Load investment portfolio files and convert them into tree JSON.

The client workbook represents each node as one row. The first columns hold
node metadata, while ``Level 1``, ``Level 2`` ... columns hold the ancestor
chain. This module keeps that logic isolated from the web app.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Iterable

import pandas as pd


TICKER_COLUMNS = (
    "Portfolio/Port Group Ticker",
    "Portfolio Ticker",
    "Port Group Ticker",
    "Ticker",
)
NAME_COLUMNS = (
    "Portfolio/Port Group Full Name",
    "Portfolio Full Name",
    "Port Group Full Name",
    "Full Name",
    "Name",
)
CURRENCY_COLUMNS = ("Port Group CCY", "CCY", "Currency", "Ccy")
CSV_ENCODINGS = ("utf-8-sig", "utf-16", "utf-16-le", "cp1252", "latin1")


@dataclass(frozen=True)
class LoadedPortfolio:
    """Container returned by the loader."""

    source_name: str
    tree: dict
    row_count: int
    level_columns: list[str]


class PortfolioLoadError(ValueError):
    """Raised when a file cannot be converted into the expected tree shape."""


def load_portfolio(path: str | Path) -> LoadedPortfolio:
    """Load a CSV/XLSX file from disk."""

    file_path = Path(path)
    if not file_path.exists():
        raise PortfolioLoadError(f"Data file does not exist: {file_path}")

    frame = _read_dataframe(file_path)
    tree, level_columns = dataframe_to_tree(frame)
    return LoadedPortfolio(
        source_name=file_path.name,
        tree=tree,
        row_count=len(frame),
        level_columns=level_columns,
    )


def load_portfolio_upload(file_obj: BinaryIO, filename: str) -> LoadedPortfolio:
    """Load a CSV/XLSX file uploaded through the browser."""

    suffix = Path(filename).suffix.lower()
    data = file_obj.read()

    if _looks_like_ods(data):
        frame = _read_spreadsheet(io.BytesIO(data), engine="odf")
    elif suffix == ".ods":
        frame = _read_spreadsheet(io.BytesIO(data), engine="odf")
    elif suffix in {".xlsx", ".xls"}:
        frame = _read_spreadsheet(io.BytesIO(data))
    elif suffix == ".csv":
        frame = _read_csv_bytes(data)
    else:
        raise PortfolioLoadError("Please upload a .csv, .xlsx, .xls, or .ods file.")

    tree, level_columns = dataframe_to_tree(frame)
    return LoadedPortfolio(
        source_name=filename,
        tree=tree,
        row_count=len(frame),
        level_columns=level_columns,
    )


def dataframe_to_tree(frame: pd.DataFrame) -> tuple[dict, list[str]]:
    """Convert flat portfolio rows into nested tree JSON."""

    if frame.empty:
        raise PortfolioLoadError("The selected file does not contain any rows.")

    frame = _normalize_columns(frame)
    ticker_col = _find_column(frame.columns, TICKER_COLUMNS, "ticker")
    name_col = _find_column(frame.columns, NAME_COLUMNS, "full name")
    currency_columns = _find_optional_columns(frame.columns, CURRENCY_COLUMNS)
    level_columns = _level_columns(frame.columns)

    nodes: dict[str, dict] = {}
    root_ids: list[str] = []

    for row_number, row in frame.iterrows():
        ticker = _clean_cell(row.get(ticker_col))
        if not ticker:
            continue

        node = nodes.setdefault(ticker, _make_node(ticker))
        node["name"] = _clean_cell(row.get(name_col)) or node["name"] or ticker
        node["currency"] = _first_non_empty_cell(row, currency_columns)
        node["sourceRow"] = int(row_number) + 2

        ancestors = [
            value
            for value in (_clean_cell(row.get(column)) for column in level_columns)
            if value and value != ticker
        ]

        for ancestor in ancestors:
            nodes.setdefault(ancestor, _make_node(ancestor))

        parent_id = ancestors[-1] if ancestors else ""
        if parent_id:
            parent = nodes.setdefault(parent_id, _make_node(parent_id))
            _append_child(parent, node)
        elif ticker not in root_ids:
            root_ids.append(ticker)

    if not nodes:
        raise PortfolioLoadError("No portfolio tickers were found in the file.")

    _hydrate_paths(nodes, root_ids)
    roots = [nodes[root_id] for root_id in root_ids if root_id in nodes]

    if not roots:
        roots = _infer_roots(nodes)

    for node in nodes.values():
        node["type"] = "branch" if node["children"] else "leaf"
        node["childCount"] = len(node["children"])

    if len(roots) == 1:
        return roots[0], level_columns

    virtual_root = {
        "id": "portfolio-root",
        "ticker": "Portfolio",
        "label": "Portfolio",
        "name": "Portfolio",
        "currency": "",
        "type": "branch",
        "path": "Portfolio",
        "sourceRow": None,
        "childCount": len(roots),
        "children": roots,
    }
    return virtual_root, level_columns


def _read_dataframe(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    data = path.read_bytes()
    if _looks_like_ods(data):
        return _read_spreadsheet(io.BytesIO(data), engine="odf")
    if suffix == ".ods":
        return _read_spreadsheet(path, engine="odf")
    if suffix in {".xlsx", ".xls"}:
        return _read_spreadsheet(path)
    if suffix == ".csv":
        return _read_csv_bytes(data)
    raise PortfolioLoadError("Data file must be .csv, .xlsx, .xls, or .ods.")


def _read_csv_bytes(data: bytes) -> pd.DataFrame:
    if _looks_like_ods(data):
        return _read_spreadsheet(io.BytesIO(data), engine="odf")

    last_error: Exception | None = None
    for encoding in CSV_ENCODINGS:
        try:
            return pd.read_csv(io.BytesIO(data), encoding=encoding)
        except UnicodeError as exc:
            last_error = exc
        except pd.errors.ParserError as exc:
            last_error = exc
    raise PortfolioLoadError(f"Could not read CSV file: {last_error}")


def _looks_like_ods(data: bytes) -> bool:
    return data.startswith(b"PK") and b"application/vnd.oasis.opendocument.spreadsheet" in data[:200]


def _read_spreadsheet(source, engine: str | None = None) -> pd.DataFrame:
    sheets = pd.read_excel(source, sheet_name=None, engine=engine)
    frames = [
        frame
        for frame in sheets.values()
        if not frame.dropna(how="all").empty
    ]
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True, sort=False)


def _normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.copy()
    frame.columns = [str(column).replace("\ufeff", "").strip() for column in frame.columns]
    return frame.dropna(how="all")


def _find_column(columns: Iterable[str], candidates: tuple[str, ...], purpose: str) -> str:
    found = _find_optional_column(columns, candidates)
    if found:
        return found
    raise PortfolioLoadError(
        f"Missing {purpose} column. Expected one of: {', '.join(candidates)}"
    )


def _find_optional_column(columns: Iterable[str], candidates: tuple[str, ...]) -> str | None:
    normalized = {_normalize_key(column): column for column in columns}
    for candidate in candidates:
        found = normalized.get(_normalize_key(candidate))
        if found:
            return found
    return None


def _find_optional_columns(columns: Iterable[str], candidates: tuple[str, ...]) -> list[str]:
    normalized = {_normalize_key(column): column for column in columns}
    found_columns: list[str] = []
    for candidate in candidates:
        found = normalized.get(_normalize_key(candidate))
        if found and found not in found_columns:
            found_columns.append(found)
    return found_columns


def _level_columns(columns: Iterable[str]) -> list[str]:
    found: list[tuple[int, str]] = []
    for column in columns:
        match = re.fullmatch(r"level\s*(\d+)", str(column).strip(), flags=re.IGNORECASE)
        if match:
            found.append((int(match.group(1)), column))
    return [column for _, column in sorted(found)]


def _normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _clean_cell(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    text = str(value).strip()
    if text.endswith(".0") and text[:-2].isdigit():
        return text[:-2]
    return text


def _first_non_empty_cell(row: pd.Series, columns: list[str]) -> str:
    for column in columns:
        value = _clean_cell(row.get(column))
        if value:
            return value
    return ""


def _make_node(ticker: str) -> dict:
    return {
        "id": ticker,
        "ticker": ticker,
        "label": ticker,
        "name": ticker,
        "currency": "",
        "type": "leaf",
        "path": ticker,
        "sourceRow": None,
        "childCount": 0,
        "children": [],
    }


def _append_child(parent: dict, child: dict) -> None:
    if not any(existing["id"] == child["id"] for existing in parent["children"]):
        parent["children"].append(child)


def _hydrate_paths(nodes: dict[str, dict], root_ids: list[str]) -> None:
    visited: set[str] = set()

    def walk(node: dict, parts: list[str]) -> None:
        if node["id"] in visited:
            return
        visited.add(node["id"])
        node["path"] = " > ".join(parts + [node["ticker"]])
        for child in node["children"]:
            walk(child, parts + [node["ticker"]])

    for root_id in root_ids:
        node = nodes.get(root_id)
        if node:
            walk(node, [])


def _infer_roots(nodes: dict[str, dict]) -> list[dict]:
    child_ids = {
        child["id"]
        for node in nodes.values()
        for child in node["children"]
    }
    return [node for node_id, node in nodes.items() if node_id not in child_ids]
