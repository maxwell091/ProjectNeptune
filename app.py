"""Local portfolio tree web app.

Run with:
    python app.py --data "portfolio tree input.csv"
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from flask import Flask, jsonify, render_template, request
from werkzeug.utils import secure_filename

from portfolio_loader import PortfolioLoadError, load_portfolio, load_portfolio_upload


DEFAULT_PORT = 5088
DEFAULT_DATA = Path("portfolio tree input.csv")
FALLBACK_DATA = Path("data/sample_portfolio.csv")
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".ods"}

app = Flask(__name__)
active_dataset: dict = {}


def create_app(data_path: str | Path | None = None) -> Flask:
    """Initialize the active dataset and return the Flask app."""

    selected_path = _resolve_data_path(data_path)
    _set_active_dataset(load_portfolio(selected_path))
    return app


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/tree")
def tree():
    return jsonify(active_dataset)


@app.post("/api/upload")
def upload():
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "Choose a CSV, Excel, or ODS file to upload."}), 400

    filename = secure_filename(uploaded.filename)
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Only .csv, .xlsx, .xls, and .ods files are supported."}), 400

    try:
        loaded = load_portfolio_upload(uploaded.stream, filename)
    except PortfolioLoadError as exc:
        return jsonify({"error": str(exc)}), 400

    _set_active_dataset(loaded)
    return jsonify(active_dataset)


def _set_active_dataset(loaded) -> None:
    active_dataset.clear()
    active_dataset.update(
        {
            "sourceName": loaded.source_name,
            "rowCount": loaded.row_count,
            "levelColumns": loaded.level_columns,
            "tree": loaded.tree,
        }
    )


def _resolve_data_path(data_path: str | Path | None) -> Path:
    configured = data_path or os.environ.get("PORTFOLIO_DATA")
    if configured:
        return Path(configured)
    if DEFAULT_DATA.exists():
        return DEFAULT_DATA
    return FALLBACK_DATA


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the portfolio tree app locally.")
    parser.add_argument(
        "--data",
        help="Path to a CSV/XLSX/ODS portfolio file. Defaults to PORTFOLIO_DATA, "
        "'portfolio tree input.csv', then data/sample_portfolio.csv.",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind.")
    parser.add_argument(
        "--port",
        default=int(os.environ.get("PORT", DEFAULT_PORT)),
        type=int,
        help=f"Port to run on (default: {DEFAULT_PORT}).",
    )
    parser.add_argument("--debug", action="store_true", help="Enable Flask debug mode.")
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    create_app(args.data)
    app.run(host=args.host, port=args.port, debug=args.debug)
