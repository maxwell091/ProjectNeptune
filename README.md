# Portfolio Tree Explorer

A simple local Python web app for exploring investment portfolio hierarchy files.
It loads CSV or Excel data, renders a hierarchical tree, and supports click,
hover, and drag/drop interactions in the browser.

## Features

- Load `.csv`, `.xlsx`, `.xls`, or `.ods` files without changing code.
- Click a branch to expand or collapse it.
- Click any node to inspect ticker, full name, currency, type, path, and child count.
- Hover any node to see full name and currency.
- Drag a node onto another node to model a rebalancing move in real time.
- Pan and zoom around large portfolio trees.

## Setup

```bash
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
```

On macOS/Linux, activate with:

```bash
source .venv/bin/activate
```

## Run

Use the supplied client CSV if it is in the project folder:

```bash
python app.py --data "portfolio tree input.csv"
```

Or run with the bundled sample data:

```bash
python app.py --data data/sample_portfolio.csv
```

Then open:

```text
http://127.0.0.1:5088
```

You can also configure the data path with an environment variable:

```bash
PORTFOLIO_DATA=data/sample_portfolio.csv python app.py
```

If no path is provided, the app tries `portfolio tree input.csv` first and then
falls back to `data/sample_portfolio.csv`.

## Input Format

The first columns describe the current portfolio or portfolio group:

```text
Portfolio/Port Group Ticker
Portfolio/Port Group Full Name
CCY
```

The app also accepts `Port Group CCY` instead of `CCY`. If Excel or LibreOffice
saves an OpenDocument spreadsheet with the wrong extension, the loader detects
the file content and still reads it correctly.

Hierarchy is defined by level columns:

```text
Level 1, Level 2, Level 3, Level 4, ...
```

Each row represents the node in `Portfolio/Port Group Ticker`. The populated
`Level N` cells are that node's ancestor path. For example:

```csv
Portfolio/Port Group Ticker,Portfolio/Port Group Full Name,CCY,Level 1,Level 2
BCPP-ALL,TestCo - All Assets,GBP,,
BCPROP,TestCo Propositions,GBP,BCPP-ALL,
BCPROPEQ,TestCo Equity Propositions,GBP,BCPP-ALL,BCPROP
```

This creates:

```text
BCPP-ALL
  BCPROP
    BCPROPEQ
```

## Loading New Data

There are three ways to load a new dataset:

1. Start the app with `python app.py --data path/to/file.csv`.
2. Set `PORTFOLIO_DATA=path/to/file.xlsx`.
3. Use the upload control in the browser.

Uploaded files replace the active tree for the current running session. The app
does not overwrite or modify the original input file.

## Notes

- The drag/drop rebalancing is visual and in-memory only.
- Branch nodes are any nodes with children.
- Leaf nodes are portfolio nodes without children.
- The browser uses D3.js from a CDN, so the first page load needs network access
  unless D3 is vendored locally.
