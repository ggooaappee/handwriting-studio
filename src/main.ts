import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileUp,
  ImageDown,
  PenLine,
  ScanLine,
  Shuffle,
  SlidersHorizontal,
  TriangleAlert,
  createIcons,
} from "lucide";
import "./style.css";
import {
  canvasToBlob,
  getFontOption,
  loadHandwritingFonts,
  renderHandwritingDocument,
} from "./handwriting";
import type {
  FontId,
  HandwritingConfig,
  InkId,
  PaperStyle,
  TextAlign,
} from "./types";

const SAMPLE_TEXT = `消防安全，人人有责。

校园里的每一处细节，都可能关系到我们的安全。离开宿舍及时断电，不私拉电线，不使用明火；在实验室遵守操作规范，在教室和楼道保持通道畅通。

把警惕放在平时，把安全落到实处，才是真正对自己和他人负责。`;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  return element as T;
}

const textInput = byId<HTMLTextAreaElement>("textInput");
const fontSelect = byId<HTMLSelectElement>("fontSelect");
const fontHint = byId<HTMLParagraphElement>("fontHint");
const paperSelect = byId<HTMLSelectElement>("paperSelect");
const fontSizeRange = byId<HTMLInputElement>("fontSizeRange");
const lineHeightRange = byId<HTMLInputElement>("lineHeightRange");
const marginRange = byId<HTMLInputElement>("marginRange");
const messinessRange = byId<HTMLInputElement>("messinessRange");
const tremorRange = byId<HTMLInputElement>("tremorRange");
const mistakesRange = byId<HTMLInputElement>("mistakesRange");
const fontSizeValue = byId<HTMLOutputElement>("fontSizeValue");
const lineHeightValue = byId<HTMLOutputElement>("lineHeightValue");
const marginValue = byId<HTMLOutputElement>("marginValue");
const messinessValue = byId<HTMLOutputElement>("messinessValue");
const tremorValue = byId<HTMLOutputElement>("tremorValue");
const mistakesValue = byId<HTMLOutputElement>("mistakesValue");
const inkSwatches = byId<HTMLDivElement>("inkSwatches");
const alignControl = byId<HTMLDivElement>("alignControl");
const canvasStage = byId<HTMLDivElement>("canvasStage");
const renderStatus = byId<HTMLSpanElement>("renderStatus");
const charCount = byId<HTMLSpanElement>("charCount");
const pageIndicator = byId<HTMLSpanElement>("pageIndicator");
const prevPageButton = byId<HTMLButtonElement>("prevPageButton");
const nextPageButton = byId<HTMLButtonElement>("nextPageButton");
const reshuffleButton = byId<HTMLButtonElement>("reshuffleButton");
const exportPngButton = byId<HTMLButtonElement>("exportPngButton");
const exportPdfButton = byId<HTMLButtonElement>("exportPdfButton");
const fileInput = byId<HTMLInputElement>("fileInput");
const settingsToggle = byId<HTMLButtonElement>("settingsToggle");
const controlsPanel = byId<HTMLDivElement>("controlsPanel");

let activeInk: InkId = "black";
let activeAlign: TextAlign = "left";
let currentPage = 0;
let renderedPages: HTMLCanvasElement[] = [];
let handwritingSeed = 20261022;
let renderTimer: number | undefined;
let renderVersion = 0;

const iconSet = {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileUp,
  ImageDown,
  PenLine,
  ScanLine,
  Shuffle,
  SlidersHorizontal,
  TriangleAlert,
};

createIcons({ icons: iconSet });

function readConfig(): HandwritingConfig {
  return {
    fontId: fontSelect.value as FontId,
    paper: paperSelect.value as PaperStyle,
    ink: activeInk,
    fontSize: Number(fontSizeRange.value),
    lineHeight: Number(lineHeightRange.value),
    letterSpacing: 0,
    margin: Number(marginRange.value),
    messiness: Number(messinessRange.value),
    tremor: Number(tremorRange.value),
    mistakes: Number(mistakesRange.value),
    textAlign: activeAlign,
    seed: handwritingSeed,
  };
}

let config = readConfig();

function timestampForFile(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join("");
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function updateRangeLabels(): void {
  fontSizeValue.value = fontSizeRange.value;
  lineHeightValue.value = Number(lineHeightRange.value).toFixed(2);
  marginValue.value = marginRange.value;
  messinessValue.value = `${messinessRange.value}%`;
  tremorValue.value = `${tremorRange.value}%`;
  mistakesValue.value = `${Number(mistakesRange.value).toFixed(1)}%`;
}

function updateFontHint(): void {
  const font = getFontOption(fontSelect.value as FontId);
  fontHint.textContent = font.description;
}

function setRenderedPage(): void {
  const canvas = renderedPages[currentPage];
  if (!canvas) {
    return;
  }
  const surface = document.createElement("canvas");
  surface.width = canvas.width;
  surface.height = canvas.height;
  surface.className = "paper-canvas";
  surface.setAttribute("aria-label", `手写稿第 ${currentPage + 1} 页预览`);
  const context = surface.getContext("2d");
  if (!context) {
    return;
  }
  context.drawImage(canvas, 0, 0);
  canvasStage.replaceChildren(surface);
  pageIndicator.textContent = `${currentPage + 1} / ${renderedPages.length}`;
  prevPageButton.disabled = currentPage === 0;
  nextPageButton.disabled = currentPage >= renderedPages.length - 1;
  renderStatus.textContent =
    renderedPages.length > 1 ? `已生成 ${renderedPages.length} 页` : "实时预览";
  renderStatus.classList.add("is-ready");
}

function renderNow(): void {
  const version = ++renderVersion;
  updateRangeLabels();
  config = readConfig();
  charCount.textContent = `${textInput.value.replace(/\s/g, "").length} 字`;

  if (textInput.value.trim().length === 0) {
    renderedPages = [];
    currentPage = 0;
    canvasStage.innerHTML =
      '<div class="empty-state"><i data-lucide="pen-line"></i><strong>等待落笔</strong><span>在左侧输入文字后，这里会生成手写稿。</span></div>';
    createIcons({ icons: iconSet });
    renderStatus.textContent = "请输入内容";
    renderStatus.classList.remove("is-ready");
    pageIndicator.textContent = "0 / 0";
    prevPageButton.disabled = true;
    nextPageButton.disabled = true;
    return;
  }

  renderStatus.textContent = "正在排版…";
  renderStatus.classList.remove("is-ready");

  try {
    const result = renderHandwritingDocument(textInput.value, config);
    if (version !== renderVersion) {
      return;
    }
    renderedPages = result.pages;
    currentPage = Math.min(currentPage, renderedPages.length - 1);
    setRenderedPage();
  } catch (error) {
    renderedPages = [];
    currentPage = 0;
    renderStatus.textContent = "生成失败";
    renderStatus.classList.remove("is-ready");
    canvasStage.innerHTML = `<div class="empty-state"><i data-lucide="triangle-alert"></i><strong>生成失败</strong><span>${String(
      error instanceof Error ? error.message : error,
    )}</span></div>`;
    createIcons({ icons: iconSet });
  }
}

function scheduleRender(): void {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(renderNow, 110);
}

function selectInk(ink: InkId): void {
  activeInk = ink;
  for (const button of inkSwatches.querySelectorAll<HTMLButtonElement>("[data-ink]")) {
    const selected = button.dataset.ink === ink;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-checked", String(selected));
  }
  scheduleRender();
}

function selectAlign(align: TextAlign): void {
  activeAlign = align;
  for (const button of alignControl.querySelectorAll<HTMLButtonElement>("[data-align]")) {
    const selected = button.dataset.align === align;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-checked", String(selected));
  }
  scheduleRender();
}

function bindControls(): void {
  fontSelect.addEventListener("change", () => {
    updateFontHint();
    scheduleRender();
  });
  paperSelect.addEventListener("change", scheduleRender);
  for (const range of [
    fontSizeRange,
    lineHeightRange,
    marginRange,
    messinessRange,
    tremorRange,
    mistakesRange,
  ]) {
    range.addEventListener("input", scheduleRender);
  }
  textInput.addEventListener("input", scheduleRender);
  inkSwatches.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-ink]",
    );
    if (button?.dataset.ink) {
      selectInk(button.dataset.ink as InkId);
    }
  });
  alignControl.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-align]",
    );
    if (button?.dataset.align) {
      selectAlign(button.dataset.align as TextAlign);
    }
  });
  reshuffleButton.addEventListener("click", () => {
    handwritingSeed = Math.floor(Math.random() * 2_000_000_000);
    renderedPages = [];
    currentPage = 0;
    renderNow();
  });
  settingsToggle.addEventListener("click", () => {
    const open = controlsPanel.classList.toggle("is-open");
    settingsToggle.setAttribute("aria-expanded", String(open));
  });
  prevPageButton.addEventListener("click", () => {
    currentPage = Math.max(0, currentPage - 1);
    setRenderedPage();
  });
  nextPageButton.addEventListener("click", () => {
    currentPage = Math.min(renderedPages.length - 1, currentPage + 1);
    setRenderedPage();
  });
}

async function importTextFile(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });
    return result.value.trim();
  }
  return (await file.text()).trim();
}

async function exportPng(): Promise<void> {
  if (renderedPages.length === 0) {
    return;
  }
  const baseName = `手写稿-${timestampForFile()}`;
  if (renderedPages.length === 1) {
    downloadBlob(await canvasToBlob(renderedPages[0]), `${baseName}.png`);
    return;
  }
  const { default: JSZip } = await import("jszip");
  const archive = new JSZip();
  for (const [index, canvas] of renderedPages.entries()) {
    archive.file(`page-${index + 1}.png`, await canvasToBlob(canvas));
  }
  downloadBlob(
    await archive.generateAsync({ type: "blob" }),
    `${baseName}.zip`,
  );
}

async function exportPdf(): Promise<void> {
  if (renderedPages.length === 0) {
    return;
  }
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  for (const [index, canvas] of renderedPages.entries()) {
    if (index > 0) {
      pdf.addPage("a4", "portrait");
    }
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      0,
      0,
      210,
      297,
      undefined,
      "FAST",
    );
  }
  pdf.save(`手写稿-${timestampForFile()}.pdf`);
}

async function initialize(): Promise<void> {
  updateRangeLabels();
  updateFontHint();
  textInput.value = SAMPLE_TEXT;
  bindControls();
  exportPngButton.addEventListener("click", () => void exportPng());
  exportPdfButton.addEventListener("click", () => void exportPdf());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }
    try {
      const imported = await importTextFile(file);
      if (imported) {
        textInput.value = imported;
        currentPage = 0;
        scheduleRender();
      }
    } catch (error) {
      renderStatus.textContent = "导入失败";
      renderStatus.classList.remove("is-ready");
      console.error(error);
    } finally {
      fileInput.value = "";
    }
  });

  try {
    await loadHandwritingFonts(import.meta.env.BASE_URL);
  } catch (error) {
    console.error("Font loading failed", error);
  }
  renderNow();
}

void initialize();
