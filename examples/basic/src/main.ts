import { generateCausalMap } from "@causalmap/core";
import { renderSVG } from "@causalmap/renderer";
import { datasets, type Dataset } from "./datasets";

// ─── DOM refs ───

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);
const app = $<HTMLDivElement>("#app")!;
const select = $<HTMLSelectElement>("#dataset-select")!;
const descEl = $<HTMLParagraphElement>("#desc")!;
const nodeCount = $<HTMLElement>("#node-count")!;
const edgeCount = $<HTMLElement>("#edge-count")!;
const regionCount = $<HTMLElement>("#region-count")!;
const timeEl = $<HTMLElement>("#time-ms")!;
const spinner = $<HTMLElement>("#spinner")!;

// ─── Populate dropdown ───

for (const ds of datasets) {
  const opt = document.createElement("option");
  opt.value = ds.id;
  opt.textContent = ds.name;
  select.appendChild(opt);
}

// ─── Render a dataset ───

function render(ds: Dataset) {
  descEl.textContent = ds.description;
  spinner.style.display = "";
  app.innerHTML = "";

  // Use requestAnimationFrame so the spinner paints before the heavy computation
  requestAnimationFrame(() => {
    const t0 = performance.now();
    const layout = generateCausalMap(ds.graph, ds.layoutOptions);
    const elapsed = performance.now() - t0;

    app.innerHTML = renderSVG(layout, ds.renderOptions);
    spinner.style.display = "none";

    nodeCount.textContent = String(ds.graph.nodes.length);
    edgeCount.textContent = String(ds.graph.edges.length);
    regionCount.textContent = String(
      layout.regionsByLevel.reduce((sum, lvl) => sum + lvl.length, 0),
    );
    timeEl.textContent = `${elapsed.toFixed(0)} ms`;

    // Dark-mode body when background is dark
    const bg = ds.renderOptions.background ?? "#f8f4ec";
    const isDark = parseInt(bg.slice(1, 3), 16) < 80;
    document.body.classList.toggle("dark", isDark);
  });
}

// ─── Events ───

select.addEventListener("change", () => {
  const ds = datasets.find((d) => d.id === select.value);
  if (ds) render(ds);
});

// ─── Initial render: default to first dataset OR from URL hash ───

const hashId = location.hash.slice(1);
const initial = datasets.find((d) => d.id === hashId) ?? datasets[0]!;
select.value = initial.id;
render(initial);