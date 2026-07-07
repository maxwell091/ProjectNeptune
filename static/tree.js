const treeElement = document.querySelector("#tree");
const detailsElement = document.querySelector("#details");
const tooltip = document.querySelector("#tooltip");
const message = document.querySelector("#message");
const uploadForm = document.querySelector("#upload-form");
const fileInput = document.querySelector("#file-input");
const chooseFileButton = document.querySelector("#choose-file");
const fileNameLabel = document.querySelector("#file-name");
const datasetName = document.querySelector("#dataset-name");
const datasetMeta = document.querySelector("#dataset-meta");
const treeSearch = document.querySelector("#tree-search");
const searchCount = document.querySelector("#search-count");
const expandSelectedButton = document.querySelector("#expand-selected");
const collapseSelectedButton = document.querySelector("#collapse-selected");
const expandAllButton = document.querySelector("#expand-all");
const collapseAllButton = document.querySelector("#collapse-all");
const focusSelectedButton = document.querySelector("#focus-selected");
const resetViewButton = document.querySelector("#reset-view");

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls", ".ods"];
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

const DRAG_CLICK_DISTANCE = 8;
const LEVEL_GAP = 230;

const svg = d3
  .select(treeElement)
  .append("svg")
  .attr("width", "100%")
  .attr("height", "100%");

const viewport = svg.append("g");

const zoom = d3
  .zoom()
  .scaleExtent([0.25, 2.2])
  .on("zoom", (event) => viewport.attr("transform", event.transform));

svg.call(zoom);

fetchTree();

chooseFileButton.addEventListener("click", openFilePicker);
fileInput.addEventListener("change", () => {
  setSelectedFile(fileInput.files[0] || null);
});
treeSearch.addEventListener("input", handleSearch);
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

          const target = closestDropTarget(event.sourceEvent);
          if (target && moveNode(d.data.id, target.data.id)) {
            selectNode(d.data);
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
      const marker = d.data._collapsed ? " +" : "";
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
        <input id="edit-name" type="text" value="${escapeAttribute(data.name || "")}">
      </label>

      <label class="editor-field">
        <span>Currency</span>
        <input id="edit-currency" type="text" value="${escapeAttribute(data.currency || "")}" maxlength="12">
      </label>

      <label class="editor-field">
        <span>Move Under Parent</span>
        <select id="edit-parent" ${data.id === treeData.id ? "disabled" : ""}>
          ${parentOptions}
        </select>
      </label>

      <div class="editor-row">
        <span class="type-badge ${typeClass}">${typeLabel}</span>
        <span class="children-badge">${data.children?.length || 0} children</span>
      </div>

      <div class="detail-item">
        <dt>Path</dt>
        <dd>${escapeHtml(data.path || data.ticker || "")}</dd>
      </div>
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
  const parentSelect = document.querySelector("#edit-parent");

  nameInput?.addEventListener("input", (event) => {
    data.name = event.target.value;
  });

  nameInput?.addEventListener("change", () => {
    render();
    selectNode(data);
  });

  currencyInput?.addEventListener("input", (event) => {
    data.currency = event.target.value.toUpperCase();
    event.target.value = data.currency;
  });

  currencyInput?.addEventListener("change", () => {
    render();
    selectNode(data);
  });

  parentSelect?.addEventListener("change", (event) => {
    const newParentId = event.target.value;
    if (newParentId && moveNode(data.id, newParentId)) {
      updateDepths(treeData, 1);
      render();
      selectNode(data);
      focusNode(data.id);
    }
  });
}

function updateSelectedActionButtons(data) {
  const canToggleChildren = Boolean(data && hasChildren(data));
  expandSelectedButton.disabled = !canToggleChildren;
  collapseSelectedButton.disabled = !canToggleChildren;
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

function showTooltip(event, data) {
  const typeLabel = data.type === "branch" ? "Branch" : "Portfolio";
  tooltip.innerHTML = `
    <strong>${escapeHtml(data.ticker || "")}</strong>
    ${escapeHtml(data.name || "")}<br>
    Currency: ${escapeHtml(data.currency || "N/A")}
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
  node._collapsed = collapsed;
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
    node._collapsed = false;
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

function focusSelectedNode() {
  if (!selectedId) return;
  expandAncestors(selectedId);
  render();
  focusNode(selectedId);
}

function resetZoom() {
  svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
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
