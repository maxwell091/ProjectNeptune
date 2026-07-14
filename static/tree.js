const treeElement = document.querySelector("#tree");
const detailsElement = document.querySelector("#details");
const tooltip = document.querySelector("#tooltip");
const message = document.querySelector("#message");
const qcErrorCallout = document.querySelector("#qc-error-callout");
const uploadForm = document.querySelector("#upload-form");
const fileInput = document.querySelector("#file-input");
const chooseFileButton = document.querySelector("#choose-file");
const fileNameLabel = document.querySelector("#file-name");
const datasetName = document.querySelector("#dataset-name");
const datasetMeta = document.querySelector("#dataset-meta");
const treeSearch = document.querySelector("#tree-search");
const searchCount = document.querySelector("#search-count");
const editModeToggle = document.querySelector("#edit-mode-toggle");
const undoButton = document.querySelector("#undo-change");
const redoButton = document.querySelector("#redo-change");
const undoAllButton = document.querySelector("#undo-all");
const expandSelectedButton = document.querySelector("#expand-selected");
const collapseSelectedButton = document.querySelector("#collapse-selected");
const expandAllButton = document.querySelector("#expand-all");
const collapseAllButton = document.querySelector("#collapse-all");
const focusSelectedButton = document.querySelector("#focus-selected");
const zoomInButton = document.querySelector("#zoom-in");
const zoomOutButton = document.querySelector("#zoom-out");
const resetViewButton = document.querySelector("#reset-view");
const treeScrollTrack = document.querySelector("#tree-scroll-track");
const treeScrollThumb = document.querySelector("#tree-scroll-thumb");
const treeScrollControl = document.querySelector(".tree-scroll-control");
const auditCount = document.querySelector("#audit-count");
const auditTableBody = document.querySelector("#audit-table-body");
const qcCount = document.querySelector("#qc-count");
const qcTableBody = document.querySelector("#qc-table-body");
const qcFilterError = document.querySelector("#qc-filter-error");
const qcFilterLevel = document.querySelector("#qc-filter-level");
const crossheldCount = document.querySelector("#crossheld-count");
const crossheldTableBody = document.querySelector("#crossheld-table-body");
const bulkPaste = document.querySelector("#bulk-paste");
const bulkClearButton = document.querySelector("#bulk-clear");
const bulkAddButton = document.querySelector("#bulk-add");
const bulkPreviewBody = document.querySelector("#bulk-preview-body");
const confirmDialog = document.querySelector("#confirm-dialog");
const dialogIcon = document.querySelector("#dialog-icon");
const dialogTitle = document.querySelector("#dialog-title");
const dialogMessage = document.querySelector("#dialog-message");
const dialogDetails = document.querySelector("#dialog-details");
const dialogCancelButton = document.querySelector("#dialog-cancel");
const dialogConfirmButton = document.querySelector("#dialog-confirm");
const sideTabs = document.querySelectorAll(".side-tab");
const tabPanels = document.querySelectorAll(".tab-panel");

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls", ".ods"];
const MAX_PORTFOLIO_NAME_LENGTH = 10;
const MAX_TREE_DEPTH = 10;
const VALID_CURRENCIES = new Set(
  "AED,AFN,ALL,AMD,ANG,AOA,ARS,AUD,AWG,AZN,BAM,BBD,BDT,BGN,BHD,BIF,BMD,BND,BOB,BRL,BSD,BTN,BWP,BYN,BZD,CAD,CDF,CHF,CLP,CNY,COP,CRC,CUP,CVE,CZK,DJF,DKK,DOP,DZD,EGP,ERN,ETB,EUR,FJD,FKP,GBP,GEL,GHS,GIP,GMD,GNF,GTQ,GYD,HKD,HNL,HTG,HUF,IDR,ILS,INR,IQD,IRR,ISK,JMD,JOD,JPY,KES,KGS,KHR,KID,KMF,KPW,KRW,KWD,KYD,KZT,LAK,LBP,LKR,LRD,LSL,LYD,MAD,MDL,MGA,MKD,MMK,MNT,MOP,MRU,MUR,MVR,MWK,MXN,MYR,MZN,NAD,NGN,NIO,NOK,NPR,NZD,OMR,PAB,PEN,PGK,PHP,PKR,PLN,PYG,QAR,RON,RSD,RUB,RWF,SAR,SBD,SCR,SDG,SEK,SGD,SHP,SLE,SOS,SRD,SSP,STN,SYP,SZL,THB,TJS,TMT,TND,TOP,TRY,TTD,TVD,TWD,TZS,UAH,UGX,USD,UYU,UZS,VES,VND,VUV,WST,XAF,XCD,XCG,XDR,XOF,XPF,YER,ZAR,ZMW,ZWL"
    .split(",")
);
const PORTFOLIO_FILE_TYPES = [
  {
    description: "Portfolio files",
    accept: {
      "application/vnd.oasis.opendocument.spreadsheet": [".ods"],
      "application/octet-stream": [".ods"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls", ".xlsx"],
    },
  },
];

let treeData = null;
let selectedId = null;
let dropTargetId = null;
let draggingId = null;
let selectedFile = null;
let dragMoved = false;
let latestNodePositions = new Map();
let originalTreeSnapshot = null;
let undoStack = [];
let redoStack = [];
let auditEntries = [];
let changedNodeIds = new Set();
let qcErrors = [];
let qcErrorNodeIds = new Set();
let crossHeldRows = [];
let editModeEnabled = false;
let pendingFieldSnapshot = null;
let dialogResolve = null;
let bulkRows = [];
let currentTransform = d3.zoomIdentity;
let verticalScrollState = null;
let treeScrollDragging = false;
let treeScrollDragOffset = 0;

const DRAG_CLICK_DISTANCE = 8;
const LEVEL_GAP = 230;
const ZOOM_STEP_RATIO = 1.1;

const svg = d3
  .select(treeElement)
  .append("svg")
  .attr("width", "100%")
  .attr("height", "100%");

const viewport = svg.append("g");

const zoom = d3
  .zoom()
  .scaleExtent([0.25, 2.2])
  .filter((event) => {
    if (event.type === "wheel") return event.ctrlKey || event.metaKey;
    return !event.ctrlKey && !event.button;
  })
  .on("zoom", (event) => {
    currentTransform = event.transform;
    viewport.attr("transform", currentTransform);
    syncTreeScrollbar();
  });

svg.call(zoom);
svg.on("wheel.treepan", (event) => {
  if (event.ctrlKey || event.metaKey) return;
  if (!verticalScrollState?.canScroll) return;
  event.preventDefault();
  panTreeVertically(-event.deltaY);
});

fetchTree();

chooseFileButton.addEventListener("click", openFilePicker);
fileInput.addEventListener("change", () => {
  setSelectedFile(fileInput.files[0] || null);
});
sideTabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});
treeSearch.addEventListener("input", handleSearch);
editModeToggle.addEventListener("click", toggleEditMode);
undoButton.addEventListener("click", undoLastChange);
redoButton.addEventListener("click", redoLastChange);
undoAllButton.addEventListener("click", undoAllChanges);
bulkPaste.addEventListener("input", handleBulkPaste);
bulkClearButton.addEventListener("click", clearBulkRows);
bulkAddButton.addEventListener("click", addBulkPortfolios);
qcFilterError?.addEventListener("change", renderQcReport);
qcFilterLevel?.addEventListener("change", renderQcReport);
qcTableBody?.addEventListener("click", (event) => {
  const row = event.target.closest("[data-qc-error-id]");
  if (row) focusQcError(row.dataset.qcErrorId);
});
crossheldTableBody?.addEventListener("click", (event) => {
  const row = event.target.closest("[data-node-id]");
  if (row) focusReportNode(row.dataset.nodeId);
});
bindTreeScrollControl();
dialogCancelButton.addEventListener("click", () => closeConfirmDialog(false));
dialogConfirmButton.addEventListener("click", () => closeConfirmDialog(true));
confirmDialog.addEventListener("click", (event) => {
  if (event.target === confirmDialog) closeConfirmDialog(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !confirmDialog.hidden) {
    closeConfirmDialog(false);
  }
});
expandSelectedButton.addEventListener("click", () => {
  const selectedNode = findNode(selectedId, treeData);
  if (selectedNode) expandSelectedNode(selectedNode);
});
collapseSelectedButton.addEventListener("click", () => {
  const selectedNode = findNode(selectedId, treeData);
  if (selectedNode) collapseSelectedNode(selectedNode);
});
expandAllButton.addEventListener("click", () => {
  setCollapsedState(treeData, false);
  render();
  updateSearchCount();
});
collapseAllButton.addEventListener("click", () => {
  collapseBelowRoot(treeData);
  render();
  updateSearchCount();
});
focusSelectedButton.addEventListener("click", focusSelectedNode);
zoomInButton.addEventListener("click", () => zoomTreeBy(ZOOM_STEP_RATIO));
zoomOutButton.addEventListener("click", () => zoomTreeBy(1 / ZOOM_STEP_RATIO));
resetViewButton.addEventListener("click", resetZoom);

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  if (!selectedFile) {
    showMessage("Choose a CSV, Excel, or ODS file first.");
    return;
  }

  if (!isAllowedFile(selectedFile.name)) {
    showMessage("Only .csv, .xlsx, .xls, and .ods files are supported.");
    return;
  }

  const body = new FormData();
  body.append("file", selectedFile);

  try {
    const response = await fetch("/api/upload", { method: "POST", body });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Upload failed.");
    }
    applyDataset(payload);
  } catch (error) {
    showMessage(error.message);
  }
});

async function fetchTree() {
  try {
    const response = await fetch("/api/tree");
    const payload = await response.json();
    applyDataset(payload);
  } catch (error) {
    showMessage(`Could not load tree: ${error.message}`);
  }
}

async function openFilePicker() {
  clearMessage();

  if (window.showOpenFilePicker) {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: false,
        types: PORTFOLIO_FILE_TYPES,
      });
      setSelectedFile(await handles[0].getFile());
      return;
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
    }
  }

  fileInput.click();
}

function setSelectedFile(file) {
  selectedFile = file;
  fileNameLabel.textContent = file ? file.name : "No file chosen";
}

function activateTab(tabName) {
  sideTabs.forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  tabPanels.forEach((panel) => {
    const active = panel.id === `tab-${tabName}`;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

function isAllowedFile(filename) {
  const lowerName = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function applyDataset(payload) {
  clearMessage();
  treeData = payload.tree;
  selectedId = null;
  dropTargetId = null;
  updateNodeTypes(treeData);
  updatePaths(treeData, []);
  updateDepths(treeData, 1);
  originalTreeSnapshot = cloneTree(treeData);
  undoStack = [];
  redoStack = [];
  auditEntries = [];
  changedNodeIds = new Set();
  qcErrors = [];
  qcErrorNodeIds = new Set();
  crossHeldRows = [];
  bulkRows = [];
  bulkPaste.value = "";
  hideQcCallout();
  editModeEnabled = false;
  updateEditModeUi();
  renderAudit();
  renderBulkPreview();
  refreshReports();

  datasetName.textContent = payload.sourceName || "Loaded portfolio";
  datasetMeta.textContent = `${payload.rowCount || 0} rows · ${
    payload.levelColumns?.length || 0
  } level columns`;

  render();
  updateSearchCount();
  selectNode(treeData);
}

function render() {
  if (!treeData) return;

  const width = treeElement.clientWidth || 900;
  const height = treeElement.clientHeight || 620;
  svg.attr("viewBox", [0, 0, width, height]);
  viewport.selectAll("*").remove();

  const root = d3.hierarchy(treeData, (node) =>
    node._collapsed ? null : node.children
  );
  const layout = d3.tree().nodeSize([46, LEVEL_GAP]);
  layout(root);

  const descendants = root.descendants();
  const links = root.links();
  const minX = d3.min(descendants, (node) => node.x) ?? 0;
  const maxX = d3.max(descendants, (node) => node.x) ?? 0;
  const startX = Math.max(60, (height - (maxX - minX)) / 2 - minX);
  const startY = 80;
  latestNodePositions = new Map(
    descendants.map((node) => [
      node.data.id,
      { x: node.y + startY, y: node.x + startX, node },
    ])
  );
  updateTreeScrollbarState();

  const layer = viewport
    .append("g")
    .attr("transform", `translate(${startY},${startX})`);

  const maxDepth = d3.max(descendants, (node) => node.depth) ?? 0;
  const levelGuideTop = minX - 38;
  const levelGuideBottom = maxX + 38;

  layer
    .append("g")
    .attr("class", "level-guides")
    .selectAll("g")
    .data(d3.range(maxDepth + 1))
    .join("g")
    .attr("transform", (depth) => `translate(${depth * LEVEL_GAP},0)`)
    .call((group) => {
      group
        .append("line")
        .attr("y1", levelGuideTop)
        .attr("y2", levelGuideBottom);
      group
        .append("text")
        .attr("y", levelGuideTop - 12)
        .attr("text-anchor", "middle")
        .text((depth) => `Level ${depth + 1}`);
    });

  layer
    .append("g")
    .selectAll("path")
    .data(links)
    .join("path")
    .attr("class", "link")
    .attr(
      "d",
      d3
        .linkHorizontal()
        .x((node) => node.y)
        .y((node) => node.x)
    );

  const node = layer
    .append("g")
    .selectAll("g")
    .data(descendants, (d) => d.data.id)
    .join("g")
    .attr("class", (d) => nodeClass(d.data))
    .attr("transform", (d) => `translate(${d.y},${d.x})`)
    .on("click", (event, d) => {
      if (event.defaultPrevented) return;
      selectNode(d.data);
      if (hasChildren(d.data)) {
        d.data._collapsed = !d.data._collapsed;
        render();
      }
    })
    .on("mouseenter", (event, d) => showTooltip(event, d.data))
    .on("mousemove", (event) => moveTooltip(event))
    .on("mouseleave", hideTooltip)
    .call(
      d3
        .drag()
        .clickDistance(DRAG_CLICK_DISTANCE)
        .on("start", function (event, d) {
          draggingId = d.data.id;
          dragMoved = false;
          selectNode(d.data);
          d3.select(this).raise();
        })
        .on("drag", (event, d) => {
          dragMoved = true;
          const target = closestDropTarget(event.sourceEvent);
          dropTargetId = target?.data.id || null;
          refreshNodeClasses();
        })
        .on("end", (event, d) => {
          const moved = dragMoved;
          dropTargetId = null;
          draggingId = null;
          dragMoved = false;

          if (!moved) {
            refreshNodeClasses();
            return;
          }

          if (!editModeEnabled) {
            showMessage("Enable edit mode before moving portfolios.");
            render();
            selectNode(d.data);
            return;
          }

          const target = closestDropTarget(event.sourceEvent);
          if (target) {
            moveNodeWithHistory(d.data.id, target.data.id, "drag/drop move");
          }
          render();
          event.sourceEvent?.stopPropagation?.();
        })
    );

  node.append("circle").attr("r", 11);

  node
    .append("text")
    .attr("dy", "0.32em")
    .attr("x", (d) => (hasChildren(d.data) ? -18 : 18))
    .attr("text-anchor", (d) => (hasChildren(d.data) ? "end" : "start"))
    .text((d) => {
      const marker = hasChildren(d.data) && d.data._collapsed ? " +" : "";
      return `${d.data.ticker}${marker}`;
    });

  node
    .append("text")
    .attr("class", "level-chip")
    .attr("dy", "1.95em")
    .attr("text-anchor", "middle")
    .text((d) => `L${d.data.depth || d.depth + 1}`);
}

function nodeClass(data) {
  const classes = ["node", data.type || "leaf"];
  if (data.id === selectedId) classes.push("selected");
  if (data.id === dropTargetId) classes.push("drop-target");
  if (qcErrorNodeIds.has(data.id)) classes.push("qc-error");
  if (changedNodeIds.has(data.id)) classes.push("changed");
  return classes.join(" ");
}

function selectNode(data) {
  selectedId = data.id;
  const typeLabel =
    data.type === "branch" ? "Portfolio Group / Branch" : "Portfolio / Leaf";
  const typeClass = data.type === "branch" ? "branch" : "leaf";
  const parentId = findParentId(data.id, treeData);
  const parentOptions = parentSelectOptions(data.id, parentId);

  detailsElement.innerHTML = `
    <div class="editor-panel">
      <div class="detail-item highlight">
        <dt>Ticker</dt>
        <dd>${escapeHtml(data.ticker || "")} <span class="level-inline">Level ${data.depth || 1}</span></dd>
      </div>

      <label class="editor-field">
        <span>Full Name</span>
        <input id="edit-name" type="text" value="${escapeAttribute(data.name || "")}" ${editModeEnabled ? "" : "disabled"}>
      </label>

      <label class="editor-field">
        <span>Currency</span>
        <div class="currency-combobox ${editModeEnabled ? "" : "disabled"}">
          <input
            id="edit-currency"
            type="text"
            value="${escapeAttribute(data.currency || "")}"
            maxlength="3"
            placeholder="Search currency"
            autocomplete="off"
            role="combobox"
            aria-controls="currency-options"
            aria-expanded="false"
            ${editModeEnabled ? "" : "disabled"}
          >
          <div id="currency-options" class="currency-options" role="listbox" hidden>
            ${currencyOptionButtons(data.currency || "")}
          </div>
        </div>
        ${editModeEnabled ? '<small class="field-hint">Search or select an approved 3-letter CCY code.</small>' : ""}
      </label>

      <label class="editor-field">
        <span>Move Under Parent</span>
        <select id="edit-parent" ${editModeEnabled && data.id !== treeData.id ? "" : "disabled"}>
          ${parentOptions}
        </select>
      </label>
      ${editModeEnabled ? "" : '<p class="edit-mode-note">Enable edit mode to change name, currency, or location.</p>'}

      <div class="editor-row">
        <span class="type-badge ${typeClass}">${typeLabel}</span>
        <span class="children-badge">${data.children?.length || 0} children</span>
        ${changedNodeIds.has(data.id) ? '<span class="changed-badge">Changed</span>' : ""}
      </div>

      <div class="detail-item">
        <dt>Path</dt>
        <dd>${escapeHtml(data.path || data.ticker || "")}</dd>
      </div>

      ${
        editModeEnabled && data.id !== treeData.id
          ? `<div class="editor-actions">
        <button type="button" id="delete-portfolio" class="btn-danger small">Delete portfolio</button>
      </div>`
          : ""
      }
    </div>
  `;
  bindEditor(data);
  updateSelectedActionButtons(data);
  refreshNodeClasses();
}

function refreshNodeClasses() {
  viewport.selectAll(".node").attr("class", (d) => nodeClass(d.data));
}

function bindEditor(data) {
  const nameInput = document.querySelector("#edit-name");
  const currencyInput = document.querySelector("#edit-currency");
  const currencyOptions = document.querySelector("#currency-options");
  const parentSelect = document.querySelector("#edit-parent");

  nameInput?.addEventListener("focus", () => {
    pendingFieldSnapshot = cloneTree(treeData);
  });

  nameInput?.addEventListener("input", (event) => {
    data.name = event.target.value;
  });

  nameInput?.addEventListener("change", () => {
    if (pendingFieldSnapshot) {
      recordChange({
        type: "Name",
        nodeId: data.id,
        summary: `${data.ticker}: full name changed`,
        before: pendingFieldSnapshot,
      });
      pendingFieldSnapshot = null;
    }
    render();
    selectNode(data);
  });

  currencyInput?.addEventListener("focus", () => {
    pendingFieldSnapshot = cloneTree(treeData);
    showCurrencyOptions(currencyInput, currencyOptions);
  });

  currencyInput?.addEventListener("input", (event) => {
    data.currency = event.target.value.toUpperCase();
    event.target.value = data.currency;
    showCurrencyOptions(currencyInput, currencyOptions);
  });

  currencyInput?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideCurrencyOptions(currencyInput, currencyOptions);
    }
    if (event.key === "Enter") {
      const firstOption = currencyOptions?.querySelector(".currency-option");
      if (firstOption) {
        event.preventDefault();
        selectCurrencyOption(data, currencyInput, currencyOptions, firstOption.dataset.currency);
      }
    }
  });

  currencyInput?.addEventListener("blur", () => {
    setTimeout(() => hideCurrencyOptions(currencyInput, currencyOptions), 120);
  });

  currencyOptions?.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  currencyOptions?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-currency]");
    if (option) {
      selectCurrencyOption(data, currencyInput, currencyOptions, option.dataset.currency);
    }
  });

  currencyInput?.addEventListener("change", () => {
    commitCurrencyChange(data, currencyInput);
  });

  parentSelect?.addEventListener("change", (event) => {
    const newParentId = event.target.value;
    if (newParentId) moveNodeWithHistory(data.id, newParentId, "editor move");
  });

  document.querySelector("#delete-portfolio")?.addEventListener("click", () => {
    deleteSelectedPortfolio(data);
  });
}

function updateSelectedActionButtons(data) {
  const canToggleChildren = Boolean(data && hasChildren(data));
  expandSelectedButton.disabled = !canToggleChildren;
  collapseSelectedButton.disabled = !canToggleChildren;
}

async function toggleEditMode() {
  if (!editModeEnabled) {
    const confirmed = await openConfirmDialog({
      title: "Enter Edit Mode?",
      message: "You are about to make live changes to the portfolio tree in this browser session.",
      details: [
        "Edit full name, currency, and portfolio location",
        "Delete portfolios from the selected node panel",
        "Drag and drop nodes to model rebalancing moves",
        "Every change is tracked in the audit log",
        "Use Undo, Redo, or Undo all before reloading",
      ],
      confirmText: "Enable edit mode",
      cancelText: "Stay in view mode",
      variant: "warning",
    });
    if (!confirmed) return;
    editModeEnabled = true;
  } else {
    editModeEnabled = false;
  }

  updateEditModeUi();
  const selectedNode = findNode(selectedId, treeData);
  if (selectedNode) selectNode(selectedNode);
}

function updateEditModeUi() {
  editModeToggle.textContent = editModeEnabled ? "Exit edit mode" : "Enable edit mode";
  editModeToggle.classList.toggle("active", editModeEnabled);
  undoButton.disabled = undoStack.length === 0;
  redoButton.disabled = redoStack.length === 0;
  undoAllButton.disabled = undoStack.length === 0;
  bulkPaste.disabled = !editModeEnabled;
  bulkClearButton.disabled = !editModeEnabled || !bulkPaste.value.trim();
  bulkAddButton.disabled = !editModeEnabled || !bulkRows.some((row) => row.valid);
}

function recordChange({ type, nodeId, summary, before }) {
  const after = cloneTree(treeData);
  if (sameSnapshot(before, after)) return;

  undoStack.push({
    type,
    nodeId,
    summary,
    before,
    after,
    timestamp: new Date().toLocaleTimeString(),
  });
  redoStack = [];
  auditEntries.push({ type, nodeId, summary, timestamp: new Date().toLocaleTimeString() });
  refreshChangeState();
}

function undoLastChange() {
  const entry = undoStack.pop();
  if (!entry) return;

  redoStack.push(entry);
  restoreTreeSnapshot(entry.before, entry.nodeId);
}

function redoLastChange() {
  const entry = redoStack.pop();
  if (!entry) return;

  undoStack.push(entry);
  restoreTreeSnapshot(entry.after, entry.nodeId);
}

async function undoAllChanges() {
  if (!undoStack.length || !originalTreeSnapshot) return;
  const confirmed = await openConfirmDialog({
    title: "Undo All Changes?",
    message: "This will restore the portfolio tree to the state it had when the dataset was loaded.",
    details: [
      `${auditEntries.length} tracked change${auditEntries.length === 1 ? "" : "s"} will be cleared`,
      "You can still use Redo to bring changes back",
    ],
    confirmText: "Undo all changes",
    cancelText: "Keep current changes",
    variant: "danger",
  });
  if (!confirmed) return;

  redoStack = [...undoStack].reverse();
  undoStack = [];
  auditEntries = [];
  restoreTreeSnapshot(originalTreeSnapshot, selectedId);
}

function openConfirmDialog({
  title,
  message,
  details = [],
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
}) {
  return new Promise((resolve) => {
    dialogResolve = resolve;
    dialogTitle.textContent = title;
    dialogMessage.textContent = message;
    dialogConfirmButton.textContent = confirmText;
    dialogCancelButton.textContent = cancelText;
    dialogIcon.className = `dialog-icon ${variant}`;

    if (details.length) {
      dialogDetails.hidden = false;
      dialogDetails.innerHTML = details
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
    } else {
      dialogDetails.hidden = true;
      dialogDetails.innerHTML = "";
    }

    dialogConfirmButton.className =
      variant === "danger" ? "btn-danger" : "btn-warning";
    confirmDialog.hidden = false;
    dialogConfirmButton.focus();
  });
}

function closeConfirmDialog(result) {
  if (confirmDialog.hidden) return;
  confirmDialog.hidden = true;
  if (dialogResolve) {
    dialogResolve(result);
    dialogResolve = null;
  }
}

function handleBulkPaste() {
  bulkRows = parseBulkRows(bulkPaste.value);
  renderBulkPreview();
  updateEditModeUi();
}

function parseBulkRows(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isBulkHeaderRow(splitPastedLine(line)))
    .map((line) => {
      const cells = splitPastedLine(line);
      const [name = "", currency = "", location = ""] = cells.map((cell) => cell.trim());
      const parent = findBulkParent(location);
      const valid = Boolean(name && currency && parent);
      const status = valid
        ? "Ready"
        : missingBulkFields(name, currency, location, parent).join(", ");

      return {
        name,
        currency: currency.toUpperCase(),
        location,
        parent,
        valid,
        status,
      };
    });
}

function isBulkHeaderRow(cells) {
  const normalized = cells.map((cell) => cell.trim().toLowerCase());
  return (
    normalized.includes("full name") &&
    normalized.includes("currency") &&
    (normalized.includes("location") || normalized.includes("parent"))
  );
}

function findBulkParent(location) {
  const normalizedLocation = location.trim().toLowerCase();
  if (!normalizedLocation) return null;
  return flattenNodes(treeData).find(
    (node) =>
      node.ticker.toLowerCase() === normalizedLocation ||
      (node.name || "").toLowerCase() === normalizedLocation
  );
}

function splitPastedLine(line) {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(",")) return line.split(",");
  return line.split(/\s{2,}/);
}

function missingBulkFields(name, currency, location, parent) {
  const missing = [];
  if (!name) missing.push("Missing full name");
  if (!currency) missing.push("Missing currency");
  if (!location) missing.push("Missing location");
  if (location && !parent) missing.push(`Unknown location: ${location}`);
  return missing;
}

function renderBulkPreview() {
  if (!bulkRows.length) {
    bulkPreviewBody.innerHTML = `
      <tr class="bulk-empty-row">
        <td colspan="4">${editModeEnabled ? "Paste rows from Excel to preview them here." : "Enable edit mode, then paste rows from Excel."}</td>
      </tr>
    `;
    return;
  }

  bulkPreviewBody.innerHTML = bulkRows
    .map(
      (row) => `
        <tr class="${row.valid ? "valid" : "invalid"}">
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.currency)}</td>
          <td>${escapeHtml(row.location)}</td>
          <td><span class="bulk-status ${row.valid ? "ready" : "error"}">${escapeHtml(row.status)}</span></td>
        </tr>
      `
    )
    .join("");
}

function clearBulkRows() {
  bulkPaste.value = "";
  bulkRows = [];
  renderBulkPreview();
  updateEditModeUi();
}

function addBulkPortfolios() {
  if (!editModeEnabled) {
    showMessage("Enable edit mode before adding portfolios.");
    return;
  }

  const validRows = bulkRows.filter((row) => row.valid);
  if (!validRows.length) return;

  const before = cloneTree(treeData);
  const addedTickers = [];

  for (const row of validRows) {
    const ticker = uniqueTickerFromName(row.name);
    const node = {
      id: ticker,
      ticker,
      label: ticker,
      name: row.name,
      currency: row.currency,
      type: "leaf",
      path: ticker,
      sourceRow: null,
      childCount: 0,
      children: [],
    };
    row.parent.children = row.parent.children || [];
    row.parent.children.push(node);
    row.parent._collapsed = false;
    addedTickers.push(ticker);
  }

  updateNodeTypes(treeData);
  updatePaths(treeData, []);
  updateDepths(treeData, 1);
  recordChange({
    type: "Add",
    nodeId: addedTickers.join(", "),
    summary: `Added ${addedTickers.length} portfolio${addedTickers.length === 1 ? "" : "s"}: ${addedTickers.join(", ")}`,
    before,
  });
  render();
  const firstAdded = findNode(addedTickers[0], treeData);
  if (firstAdded) {
    selectNode(firstAdded);
    focusNode(firstAdded.id);
  }
  clearBulkRows();
}

function uniqueTickerFromName(name) {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 12) || "PORTFOLIO";
  let ticker = base;
  let index = 1;
  while (findNode(ticker, treeData)) {
    ticker = `${base.slice(0, 10)}${String(index).padStart(2, "0")}`;
    index += 1;
  }
  return ticker;
}

function restoreTreeSnapshot(snapshot, preferredSelectedId) {
  treeData = cloneTree(snapshot);
  updateNodeTypes(treeData);
  updatePaths(treeData, []);
  updateDepths(treeData, 1);
  refreshChangeState();
  render();

  const selectedNode = findNode(preferredSelectedId, treeData) || treeData;
  selectNode(selectedNode);
}

function refreshChangeState() {
  changedNodeIds = changedNodesFromOriginal();
  refreshReports();
  updateEditModeUi();
  renderAudit();
}

function changedNodesFromOriginal() {
  if (!treeData || !originalTreeSnapshot) return new Set();

  const originalSignatures = nodeSignatureMap(originalTreeSnapshot);
  const currentSignatures = nodeSignatureMap(treeData);
  const changed = new Set();

  for (const [nodeId, signature] of currentSignatures) {
    if (originalSignatures.get(nodeId) !== signature) {
      changed.add(nodeId);
    }
  }

  return changed;
}

function nodeSignatureMap(root) {
  const map = new Map();

  function walk(node, parentId = "") {
    map.set(
      node.id,
      JSON.stringify({
        parentId,
        name: node.name || "",
        currency: node.currency || "",
      })
    );
    for (const child of node.children || []) {
      walk(child, node.id);
    }
  }

  walk(root);
  return map;
}

function renderAudit() {
  auditCount.textContent = auditEntries.length
    ? `${auditEntries.length} change${auditEntries.length === 1 ? "" : "s"} tracked`
    : "No changes yet";

  if (!auditEntries.length) {
    auditTableBody.innerHTML = `
      <tr class="audit-empty-row">
        <td colspan="4">Edits and moves will appear here.</td>
      </tr>
    `;
    return;
  }

  auditTableBody.innerHTML = auditEntries
    .map(
      (entry, index) => `
        <tr>
          <td class="audit-num">${index + 1}</td>
          <td><span class="audit-type ${escapeAttribute(entry.type.toLowerCase())}">${escapeHtml(entry.type)}</span></td>
          <td class="audit-summary">${escapeHtml(entry.summary)}</td>
          <td class="audit-time">${escapeHtml(entry.timestamp)}</td>
        </tr>
      `
    )
    .join("");
}

function refreshReports() {
  qcErrors = buildQcErrors();
  qcErrorNodeIds = new Set(qcErrors.map((error) => error.nodeId));
  crossHeldRows = buildCrossHeldRows();
  renderQcFilters();
  renderQcReport();
  renderCrossHeldReport();
}

function buildQcErrors() {
  if (!treeData) return [];

  const errors = [];
  for (const node of flattenNodes(treeData)) {
    const currency = (node.currency || "").trim().toUpperCase();
    const level = node.depth || 1;

    if (currency && !VALID_CURRENCIES.has(currency)) {
      addQcError(errors, node, "Invalid CCY", `Currency "${currency}" is not in the approved CCY list.`, currency, level);
    }

    if ((node.name || "").length > MAX_PORTFOLIO_NAME_LENGTH) {
      addQcError(
        errors,
        node,
        "Portfolio Name Length",
        `Portfolio name is longer than ${MAX_PORTFOLIO_NAME_LENGTH} characters.`,
        currency || "N/A",
        level
      );
    }

    if (level > MAX_TREE_DEPTH) {
      addQcError(errors, node, "Tree Level Limit", `Level ${level} exceeds the ${MAX_TREE_DEPTH}-level tree limit.`, currency || "N/A", level);
    }
  }

  return errors;
}

function addQcError(errors, node, type, message, currency, level) {
  errors.push({
    id: `qc-${errors.length + 1}`,
    number: errors.length + 1,
    nodeId: node.id,
    ticker: node.ticker || node.id,
    name: node.name || "",
    path: node.path || node.ticker || "",
    type,
    message,
    currency,
    level,
  });
}

function renderQcFilters() {
  if (!qcFilterError || !qcFilterLevel) return;

  const selectedError = qcFilterError.value || "all";
  const selectedLevel = qcFilterLevel.value || "all";
  const errorTypes = [...new Set(qcErrors.map((error) => error.type))].sort();
  const levels = [...new Set(qcErrors.map((error) => error.level))].sort((a, b) => a - b);

  qcFilterError.innerHTML = [
    '<option value="all">All Errors</option>',
    ...errorTypes.map((type) => `<option value="${escapeAttribute(type)}">${escapeHtml(type)}</option>`),
  ].join("");
  qcFilterLevel.innerHTML = [
    '<option value="all">All Levels</option>',
    ...levels.map((level) => `<option value="${level}">Level ${level}</option>`),
  ].join("");

  qcFilterError.value = errorTypes.includes(selectedError) ? selectedError : "all";
  qcFilterLevel.value = levels.map(String).includes(selectedLevel) ? selectedLevel : "all";
}

function renderQcReport() {
  if (!qcCount || !qcTableBody) return;

  const filtered = filteredQcErrors();
  qcCount.textContent = qcErrors.length
    ? `${filtered.length} of ${qcErrors.length} QC error${qcErrors.length === 1 ? "" : "s"} shown`
    : "No QC errors";

  if (!filtered.length) {
    qcTableBody.innerHTML = `
      <tr class="audit-empty-row">
        <td colspan="4">${qcErrors.length ? "No QC errors match the selected filters." : "No QC errors found."}</td>
      </tr>
    `;
    return;
  }

  qcTableBody.innerHTML = filtered
    .map(
      (error) => `
        <tr class="clickable-report-row" data-qc-error-id="${escapeAttribute(error.id)}">
          <td class="audit-num">${error.number}</td>
          <td class="audit-summary">
            <strong>${escapeHtml(error.type)}</strong>
            <span>${escapeHtml(error.ticker)}: ${escapeHtml(error.message)}</span>
          </td>
          <td>${escapeHtml(error.currency || "N/A")}</td>
          <td>Level ${escapeHtml(error.level)}</td>
        </tr>
      `
    )
    .join("");
}

function filteredQcErrors() {
  const selectedError = qcFilterError?.value || "all";
  const selectedLevel = qcFilterLevel?.value || "all";
  return qcErrors.filter(
    (error) =>
      (selectedError === "all" || error.type === selectedError) &&
      (selectedLevel === "all" || String(error.level) === selectedLevel)
  );
}

function focusQcError(errorId) {
  const error = qcErrors.find((item) => item.id === errorId);
  if (!error) return;

  focusReportNode(error.nodeId);
  showQcCallout(error);
}

function focusReportNode(nodeId) {
  const node = findNode(nodeId, treeData);
  if (!node) return;

  expandAncestors(nodeId);
  render();
  selectNode(node);
  focusNode(nodeId);
}

function showQcCallout(error) {
  if (!qcErrorCallout) return;

  qcErrorCallout.innerHTML = `
    <button type="button" class="qc-callout-close" aria-label="Close QC error">&times;</button>
    <strong>QC Error #${escapeHtml(error.number)}: ${escapeHtml(error.type)}</strong>
    <span>${escapeHtml(error.ticker)} · Level ${escapeHtml(error.level)} · CCY ${escapeHtml(error.currency || "N/A")}</span>
    <p>${escapeHtml(error.message)}</p>
  `;
  qcErrorCallout.hidden = false;
  qcErrorCallout.querySelector(".qc-callout-close")?.addEventListener("click", hideQcCallout);
}

function hideQcCallout() {
  if (qcErrorCallout) qcErrorCallout.hidden = true;
}

function buildCrossHeldRows() {
  if (!treeData) return [];

  const groups = new Map();
  walkNodeOccurrences(treeData, null, (node, parent) => {
    if (!parent || node.id === treeData.id) return;
    const key = (node.ticker || node.id || "").trim().toUpperCase();
    if (!key) return;

    if (!groups.has(key)) {
      groups.set(key, {
        ticker: node.ticker || node.id,
        name: node.name || "",
        firstNodeId: node.id,
        parents: new Map(),
        occurrences: 0,
      });
    }

    const group = groups.get(key);
    const parentLabel = parent.ticker || parent.name || parent.id;
    group.parents.set(parent.id, parentLabel);
    group.occurrences += 1;
  });

  return [...groups.values()]
    .filter((group) => group.parents.size > 1 || group.occurrences > 1)
    .sort((left, right) => left.ticker.localeCompare(right.ticker));
}

function renderCrossHeldReport() {
  if (!crossheldCount || !crossheldTableBody) return;

  crossheldCount.textContent = crossHeldRows.length
    ? `${crossHeldRows.length} cross-held portfolio${crossHeldRows.length === 1 ? "" : "s"}`
    : "No cross-held portfolios";

  if (!crossHeldRows.length) {
    crossheldTableBody.innerHTML = `
      <tr class="audit-empty-row">
        <td colspan="3">No cross-held portfolios found.</td>
      </tr>
    `;
    return;
  }

  crossheldTableBody.innerHTML = crossHeldRows
    .map(
      (row) => `
        <tr class="clickable-report-row" data-node-id="${escapeAttribute(row.firstNodeId)}">
          <td class="audit-summary">
            <strong>${escapeHtml(row.ticker)}</strong>
            <span>${escapeHtml(row.name || "No name")}</span>
          </td>
          <td>${escapeHtml([...row.parents.values()].join(", "))}</td>
          <td>${row.occurrences}</td>
        </tr>
      `
    )
    .join("");
}

function walkNodeOccurrences(node, parent, callback) {
  if (!node) return;
  callback(node, parent);
  for (const child of node.children || []) {
    walkNodeOccurrences(child, node, callback);
  }
}

function parentSelectOptions(selectedNodeId, parentId) {
  return flattenNodes(treeData)
    .filter((node) => node.id !== selectedNodeId && !isDescendant(selectedNodeId, node.id, treeData))
    .map((node) => {
      const selected = node.id === parentId ? "selected" : "";
      const indent = "&nbsp;".repeat(Math.max(0, (node.depth || 1) - 1) * 2);
      return `<option value="${escapeAttribute(node.id)}" ${selected}>${indent}L${node.depth || 1} - ${escapeHtml(node.ticker)}</option>`;
    })
    .join("");
}

function currencyOptionButtons(query = "") {
  const normalizedQuery = query.trim().toUpperCase();
  const matches = [...VALID_CURRENCIES]
    .sort()
    .filter((currency) => !normalizedQuery || currency.includes(normalizedQuery));

  if (!matches.length) {
    return '<div class="currency-empty">No matching currency</div>';
  }

  return matches
    .map(
      (currency) => `
        <button type="button" class="currency-option" data-currency="${currency}" role="option">
          ${currency}
        </button>
      `
    )
    .join("");
}

function showCurrencyOptions(input, options) {
  if (!input || !options || input.disabled) return;
  options.innerHTML = currencyOptionButtons(input.value);
  options.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function hideCurrencyOptions(input, options) {
  if (!input || !options) return;
  options.hidden = true;
  input.setAttribute("aria-expanded", "false");
}

function selectCurrencyOption(data, input, options, currency) {
  if (!currency) return;
  data.currency = currency;
  input.value = currency;
  hideCurrencyOptions(input, options);
  commitCurrencyChange(data, input);
}

function commitCurrencyChange(data, input) {
  data.currency = input.value.trim().toUpperCase();
  input.value = data.currency;

  if (data.currency && !VALID_CURRENCIES.has(data.currency)) {
    showMessage("Select a valid 3-letter currency code from the list.");
  } else {
    clearMessage();
  }

  if (pendingFieldSnapshot) {
    recordChange({
      type: "Currency",
      nodeId: data.id,
      summary: `${data.ticker}: currency changed to ${data.currency || "blank"}`,
      before: pendingFieldSnapshot,
    });
    pendingFieldSnapshot = null;
  }
  render();
  selectNode(data);
}

function showTooltip(event, data) {
  const typeLabel = data.type === "branch" ? "Branch" : "Portfolio";
  const childCount = data.children?.length || 0;
  const parentId = findParentId(data.id, treeData);
  const parent = parentId ? findNode(parentId, treeData) : null;
  const parentLabel = parent ? parent.ticker || parent.name || "—" : "—";

  tooltip.innerHTML = `
    <strong>${escapeHtml(data.ticker || "")}</strong>
    ${escapeHtml(data.name || "")}<br>
    Currency: ${escapeHtml(data.currency || "N/A")}
    <div class="tooltip-details">
      <div><span class="tooltip-label">Parent</span> ${escapeHtml(parentLabel)}</div>
      <div><span class="tooltip-label">Children</span> ${childCount}</div>
    </div>
    <span class="tooltip-meta">${typeLabel}</span>
  `;
  tooltip.hidden = false;
  moveTooltip(event);
}

function moveTooltip(event) {
  tooltip.style.left = `${event.clientX + 14}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

function handleSearch() {
  const query = treeSearch.value.trim().toLowerCase();
  updateSearchCount();

  if (!query) {
    refreshNodeClasses();
    return;
  }

  const match = flattenNodes(treeData).find((node) =>
    `${node.ticker} ${node.name}`.toLowerCase().includes(query)
  );

  if (match) {
    expandAncestors(match.id);
    render();
    selectNode(match);
    focusNode(match.id);
  }
}

function updateSearchCount() {
  if (!treeData) return;
  const query = treeSearch.value.trim().toLowerCase();
  if (!query) {
    searchCount.textContent = `${flattenNodes(treeData).length} nodes`;
    return;
  }
  const count = flattenNodes(treeData).filter((node) =>
    `${node.ticker} ${node.name}`.toLowerCase().includes(query)
  ).length;
  searchCount.textContent = `${count} match${count === 1 ? "" : "es"}`;
}

function setCollapsedState(node, collapsed) {
  if (!node) return;
  if (hasChildren(node)) {
    node._collapsed = collapsed;
  } else {
    delete node._collapsed;
  }
  for (const child of node.children || []) {
    setCollapsedState(child, collapsed);
  }
}

function collapseBelowRoot(node) {
  if (!node) return;
  node._collapsed = false;
  for (const child of node.children || []) {
    setCollapsedState(child, true);
  }
}

function expandSelectedNode(node) {
  if (!hasChildren(node)) return;
  setCollapsedState(node, false);
  render();
  selectNode(node);
  focusNode(node.id);
  updateSearchCount();
}

function collapseSelectedNode(node) {
  if (!hasChildren(node)) return;
  node._collapsed = true;
  setCollapsedStateForChildren(node, true);
  render();
  selectNode(node);
  focusNode(node.id);
  updateSearchCount();
}

function setCollapsedStateForChildren(node, collapsed) {
  for (const child of node.children || []) {
    setCollapsedState(child, collapsed);
  }
}

function expandAncestors(nodeId) {
  const path = findPathToNode(nodeId, treeData);
  for (const node of path) {
    if (hasChildren(node)) {
      node._collapsed = false;
    }
  }
}

function focusNode(nodeId) {
  if (!nodeId || !latestNodePositions.has(nodeId)) return;
  const width = treeElement.clientWidth || 900;
  const height = treeElement.clientHeight || 620;
  const position = latestNodePositions.get(nodeId);
  const scale = 1.15;
  const transform = d3.zoomIdentity
    .translate(width / 2 - position.x * scale, height / 2 - position.y * scale)
    .scale(scale);
  svg.transition().duration(350).call(zoom.transform, transform);
}

function getVerticalScrollMetrics() {
  if (!verticalScrollState) return null;

  const { minY, maxY, margin, height } = verticalScrollState;
  const scale = currentTransform.k;
  const topTranslate = margin - minY * scale;
  const bottomTranslate = height - margin - maxY * scale;
  const canScroll = bottomTranslate < topTranslate;

  return {
    topTranslate,
    bottomTranslate,
    canScroll,
    scrollSpan: topTranslate - bottomTranslate,
  };
}

function applyVerticalScrollPercent(percent) {
  const metrics = getVerticalScrollMetrics();
  if (!metrics?.canScroll) return;

  const clamped = Math.max(0, Math.min(100, percent));
  const nextY =
    metrics.topTranslate + (metrics.bottomTranslate - metrics.topTranslate) * (clamped / 100);
  const transform = d3.zoomIdentity.translate(currentTransform.x, nextY).scale(currentTransform.k);
  svg.call(zoom.transform, transform);
}

function panTreeVertically(deltaY) {
  const metrics = getVerticalScrollMetrics();
  if (!metrics?.canScroll) return;

  const nextY = Math.max(
    metrics.bottomTranslate,
    Math.min(metrics.topTranslate, currentTransform.y + deltaY)
  );
  if (nextY === currentTransform.y) return;

  const transform = d3.zoomIdentity.translate(currentTransform.x, nextY).scale(currentTransform.k);
  svg.call(zoom.transform, transform);
}

function bindTreeScrollControl() {
  if (!treeScrollTrack || !treeScrollThumb) return;

  treeScrollThumb.addEventListener("pointerdown", (event) => {
    if (!verticalScrollState?.canScroll) return;
    treeScrollDragging = true;
    treeScrollDragOffset = event.clientY - treeScrollThumb.offsetTop;
    treeScrollThumb.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  treeScrollThumb.addEventListener("pointermove", (event) => {
    if (!treeScrollDragging || !verticalScrollState?.canScroll) return;
    const trackHeight = treeScrollTrack.clientHeight;
    const thumbHeight = treeScrollThumb.clientHeight;
    const maxThumbTop = Math.max(trackHeight - thumbHeight, 0);
    const nextTop = Math.max(0, Math.min(maxThumbTop, event.clientY - treeScrollTrack.getBoundingClientRect().top - treeScrollDragOffset));
    const percent = maxThumbTop > 0 ? (nextTop / maxThumbTop) * 100 : 0;
    applyVerticalScrollPercent(percent);
  });

  const stopTreeScrollDrag = () => {
    treeScrollDragging = false;
  };

  treeScrollThumb.addEventListener("pointerup", stopTreeScrollDrag);
  treeScrollThumb.addEventListener("pointercancel", stopTreeScrollDrag);

  treeScrollTrack.addEventListener("pointerdown", (event) => {
    if (!verticalScrollState?.canScroll || event.target === treeScrollThumb) return;
    const trackRect = treeScrollTrack.getBoundingClientRect();
    const thumbHeight = treeScrollThumb.clientHeight;
    const maxThumbTop = Math.max(treeScrollTrack.clientHeight - thumbHeight, 0);
    const clickTop = event.clientY - trackRect.top - thumbHeight / 2;
    const nextTop = Math.max(0, Math.min(maxThumbTop, clickTop));
    const percent = maxThumbTop > 0 ? (nextTop / maxThumbTop) * 100 : 0;
    applyVerticalScrollPercent(percent);
  });
}

function updateTreeScrollbarState() {
  if (!treeScrollTrack || !latestNodePositions.size) return;

  const height = treeElement.clientHeight || 620;
  const positions = [...latestNodePositions.values()].map((position) => position.y);
  const minY = Math.min(...positions);
  const maxY = Math.max(...positions);
  const margin = 80;

  verticalScrollState = {
    minY,
    maxY,
    margin,
    height,
    canScroll: false,
  };

  const metrics = getVerticalScrollMetrics();
  verticalScrollState.canScroll = Boolean(metrics?.canScroll);
  treeScrollControl?.classList.toggle("disabled", !verticalScrollState.canScroll);
  syncTreeScrollbar();
}

function syncTreeScrollbar() {
  if (!treeScrollTrack || !treeScrollThumb || !verticalScrollState || treeScrollDragging) return;

  const metrics = getVerticalScrollMetrics();
  if (!metrics?.canScroll) {
    treeScrollThumb.style.height = "100%";
    treeScrollThumb.style.top = "0";
    return;
  }

  const trackHeight = treeScrollTrack.clientHeight;
  const contentHeight =
    (verticalScrollState.maxY - verticalScrollState.minY) * currentTransform.k +
    verticalScrollState.margin * 2;
  const thumbHeight = Math.max(36, trackHeight * (verticalScrollState.height / contentHeight));
  const maxThumbTop = Math.max(trackHeight - thumbHeight, 0);
  const percent =
    ((currentTransform.y - metrics.topTranslate) / (metrics.bottomTranslate - metrics.topTranslate)) * 100;
  const clamped = Math.max(0, Math.min(100, percent));
  const thumbTop = maxThumbTop * (clamped / 100);

  treeScrollThumb.style.height = `${thumbHeight}px`;
  treeScrollThumb.style.top = `${thumbTop}px`;
}

function focusSelectedNode() {
  if (!selectedId) return;
  expandAncestors(selectedId);
  render();
  focusNode(selectedId);
}

function resetZoom() {
  svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
}

function zoomTreeBy(factor) {
  const width = treeElement.clientWidth || 900;
  const height = treeElement.clientHeight || 620;
  svg.transition().duration(180).call(zoom.scaleBy, factor, [width / 2, height / 2]);
}

function closestDropTarget(sourceEvent) {
  if (!sourceEvent) return null;

  const candidates = Array.from(document.querySelectorAll(".node"));
  let best = null;
  let bestDistance = Infinity;

  for (const element of candidates) {
    const datum = element.__data__;
    if (!datum || datum.data.id === draggingId) continue;

    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const distance = Math.hypot(sourceEvent.clientX - x, sourceEvent.clientY - y);

    if (distance < bestDistance) {
      bestDistance = distance;
      best = datum;
    }
  }

  return bestDistance <= 90 ? best : null;
}

function moveNodeWithHistory(sourceId, targetId, source) {
  if (!editModeEnabled) {
    showMessage("Enable edit mode before moving portfolios.");
    return false;
  }

  const sourceNode = findNode(sourceId, treeData);
  const targetNode = findNode(targetId, treeData);
  const oldParentId = findParentId(sourceId, treeData);
  if (!sourceNode || !targetNode || oldParentId === targetId) return false;

  const before = cloneTree(treeData);
  const moved = moveNode(sourceId, targetId);
  if (!moved) return false;

  const oldParentLabel = oldParentId || "root";
  recordChange({
    type: "Move",
    nodeId: sourceId,
    summary: `${sourceNode.ticker}: moved from ${oldParentLabel} to ${targetNode.ticker} (${source})`,
    before,
  });
  render();
  selectNode(sourceNode);
  focusNode(sourceId);
  return true;
}

async function deleteSelectedPortfolio(data) {
  if (!editModeEnabled) {
    showMessage("Enable edit mode before deleting portfolios.");
    return;
  }

  if (data.id === treeData.id) {
    showMessage("The root portfolio group cannot be deleted.");
    return;
  }

  const deletedNodes = flattenNodes(data);
  const childCount = deletedNodes.length - 1;
  const parentId = findParentId(data.id, treeData);
  const parent = parentId ? findNode(parentId, treeData) : null;
  const parentLabel = parent?.ticker || "root";
  const details = [
    `Ticker: ${data.ticker}`,
    `Full name: ${data.name || "—"}`,
    `Parent: ${parentLabel}`,
  ];

  if (childCount > 0) {
    details.push(
      `${childCount} child node${childCount === 1 ? "" : "s"} will also be removed`
    );
  }

  details.push("You can undo this action from the toolbar");

  const confirmed = await openConfirmDialog({
    title: "Delete Portfolio?",
    message:
      childCount > 0
        ? `This will remove ${data.ticker} and all nodes beneath it from this session.`
        : `This will remove ${data.ticker} from this session.`,
    details,
    confirmText: "Delete portfolio",
    cancelText: "Keep portfolio",
    variant: "danger",
  });
  if (!confirmed) return;

  const before = cloneTree(treeData);
  const deleted = deleteNode(data.id);
  if (!deleted) return;

  const summary =
    childCount > 0
      ? `Deleted ${data.ticker} and ${childCount} child node${childCount === 1 ? "" : "s"} under ${parentLabel}`
      : `Deleted portfolio ${data.ticker} from ${parentLabel}`;

  recordChange({
    type: "Delete",
    nodeId: data.id,
    summary,
    before,
  });

  render();
  updateSearchCount();
  const nextSelection = parent || treeData;
  selectNode(nextSelection);
  focusNode(nextSelection.id);
}

function deleteNode(id) {
  if (id === treeData.id) return false;

  const detached = detachNode(id, treeData);
  if (!detached) return false;

  updateNodeTypes(treeData);
  updatePaths(treeData, []);
  updateDepths(treeData, 1);
  return true;
}

function moveNode(sourceId, targetId) {
  if (sourceId === targetId || isDescendant(sourceId, targetId, treeData)) {
    return false;
  }

  const source = detachNode(sourceId, treeData);
  const target = findNode(targetId, treeData);
  if (!source || !target) return false;

  target.children = target.children || [];
  target.children.push(source);
  target._collapsed = false;

  updateNodeTypes(treeData);
  updatePaths(treeData, []);
  updateDepths(treeData, 1);
  return true;
}

function detachNode(id, current) {
  if (!current.children) return null;

  const index = current.children.findIndex((child) => child.id === id);
  if (index >= 0) {
    return current.children.splice(index, 1)[0];
  }

  for (const child of current.children) {
    const found = detachNode(id, child);
    if (found) return found;
  }

  return null;
}

function findNode(id, current) {
  if (current.id === id) return current;
  for (const child of current.children || []) {
    const found = findNode(id, child);
    if (found) return found;
  }
  return null;
}

function findParentId(id, current, parent = null) {
  if (current.id === id) return parent?.id || "";
  for (const child of current.children || []) {
    const found = findParentId(id, child, current);
    if (found !== null) return found;
  }
  return null;
}

function findPathToNode(id, current, path = []) {
  if (!current) return [];
  const nextPath = [...path, current];
  if (current.id === id) return nextPath;
  for (const child of current.children || []) {
    const found = findPathToNode(id, child, nextPath);
    if (found.length) return found;
  }
  return [];
}

function flattenNodes(node) {
  if (!node) return [];
  return [node, ...(node.children || []).flatMap((child) => flattenNodes(child))];
}

function isDescendant(ancestorId, possibleChildId, current) {
  const ancestor = findNode(ancestorId, current);
  if (!ancestor) return false;
  return Boolean(findNode(possibleChildId, { ...ancestor, id: "__ancestor__" }));
}

function updateNodeTypes(node) {
  node.children = node.children || [];
  node.childCount = node.children.length;
  node.type = node.children.length ? "branch" : "leaf";
  for (const child of node.children) {
    updateNodeTypes(child);
  }
}

function updatePaths(node, parents) {
  const pathParts = [...parents, node.ticker || node.id];
  node.path = pathParts.join(" > ");
  for (const child of node.children || []) {
    updatePaths(child, pathParts);
  }
}

function updateDepths(node, depth) {
  node.depth = depth;
  for (const child of node.children || []) {
    updateDepths(child, depth + 1);
  }
}

function hasChildren(data) {
  return Boolean(data.children?.length);
}

function showMessage(text) {
  message.textContent = text;
  message.classList.add("visible");
}

function clearMessage() {
  message.textContent = "";
  message.classList.remove("visible");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function cloneTree(value) {
  return JSON.parse(JSON.stringify(value));
}

function sameSnapshot(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
