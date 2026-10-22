import type {
  FontId,
  FontOption,
  HandwritingConfig,
  InkId,
  InkOption,
  LayoutLine,
  LayoutToken,
  PaperStyle,
} from "./types";

export const PAGE_WIDTH = 2480;
export const PAGE_HEIGHT = 3508;
export const PAGE_RATIO = PAGE_WIDTH / PAGE_HEIGHT;

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "long-cang",
    label: "清瘦行书",
    description: "字形偏细，适合笔记与答题",
    family: "Long Cang",
    file: "fonts/LongCang-Regular.woff2",
    weight: 400,
  },
  {
    id: "ma-shan-zheng",
    label: "自然随笔",
    description: "笔锋更明显，适合摘抄与书信",
    family: "Ma Shan Zheng",
    file: "fonts/MaShanZheng-Regular.woff2",
    weight: 400,
  },
  {
    id: "zhi-mang-xing",
    label: "连笔速写",
    description: "连接感更强，适合快速手记",
    family: "Zhi Mang Xing",
    file: "fonts/ZhiMangXing-Regular.woff2",
    weight: 400,
  },
];

export const INK_OPTIONS: InkOption[] = [
  { id: "black", label: "黑色", color: "#171717" },
  { id: "blue", label: "蓝色", color: "#17377a" },
  { id: "graphite", label: "铅灰", color: "#424a49" },
];

const PUNCTUATION_START = new Set(
  Array.from("，。！？；：、）》】」』”’…—,.!?;:)]}"),
);

export interface RenderResult {
  pages: HTMLCanvasElement[];
  lineCount: number;
  pageCount: number;
}

export interface LayoutResult {
  lines: LayoutLine[];
  lineHeightPx: number;
  contentWidth: number;
  topBaseline: number;
}

export function getFontOption(fontId: FontId): FontOption {
  return FONT_OPTIONS.find((font) => font.id === fontId) ?? FONT_OPTIONS[0];
}

export function getInkOption(inkId: InkId): InkOption {
  return INK_OPTIONS.find((ink) => ink.id === inkId) ?? INK_OPTIONS[0];
}

export function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function segmentGraphemes(text: string): string[] {
  if ("Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }
  return Array.from(text);
}

export function paginateLines<T>(lines: T[], maxLinesPerPage: number): T[][] {
  if (lines.length === 0) {
    return [[]];
  }
  const pages: T[][] = [];
  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    pages.push(lines.slice(index, index + maxLinesPerPage));
  }
  return pages;
}

export async function loadHandwritingFonts(baseUrl: string): Promise<void> {
  await Promise.all(
    FONT_OPTIONS.map(async (font) => {
      const face = new FontFace(
        font.family,
        `url(${baseUrl}${font.file}) format("woff2")`,
        { weight: String(font.weight), style: "normal" },
      );
      await face.load();
      document.fonts.add(face);
    }),
  );
}

function setCanvasFont(
  context: CanvasRenderingContext2D,
  config: HandwritingConfig,
): void {
  const font = getFontOption(config.fontId);
  context.font = `${font.weight} ${config.fontSize}px "${font.family}"`;
}

function createLine(
  tokens: LayoutToken[],
  isParagraphEnd: boolean,
): LayoutLine {
  return {
    tokens,
    width: tokens.reduce((total, token) => total + token.advance, 0),
    isParagraphEnd,
  };
}

export function layoutText(
  text: string,
  config: HandwritingConfig,
  measureText: (char: string) => number,
): LayoutResult {
  const contentWidth = PAGE_WIDTH - config.margin * 2;
  const lineHeightPx = config.fontSize * config.lineHeight;
  const lines: LayoutLine[] = [];
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  let sourceIndex = 0;

  for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
    if (paragraph.length === 0) {
      lines.push(createLine([], true));
      continue;
    }

    let currentTokens: LayoutToken[] = [];
    let currentWidth = 0;
    const graphemes = segmentGraphemes(paragraph);

    for (const char of graphemes) {
      const advance = measureText(char) + config.letterSpacing;
      const mustWrap =
        currentTokens.length > 0 &&
        currentWidth + advance > contentWidth &&
        !PUNCTUATION_START.has(char);

      if (mustWrap) {
        lines.push(createLine(currentTokens, false));
        currentTokens = [];
        currentWidth = 0;
      }

      currentTokens.push({ char, advance, sourceIndex });
      currentWidth += advance;
      sourceIndex += 1;
    }

    if (currentTokens.length > 0 || paragraphIndex === paragraphs.length - 1) {
      lines.push(createLine(currentTokens, true));
    }
  }

  if (lines.length === 0) {
    lines.push(createLine([], true));
  }

  return {
    lines,
    lineHeightPx,
    contentWidth,
    topBaseline: config.margin + config.fontSize,
  };
}

function drawPaperTexture(
  context: CanvasRenderingContext2D,
  seed: number,
): void {
  const random = mulberry32(seed ^ 0x9a7f5c31);
  context.save();
  for (let index = 0; index < 1100; index += 1) {
    const x = random() * PAGE_WIDTH;
    const y = random() * PAGE_HEIGHT;
    const radius = 0.35 + random() * 0.9;
    context.fillStyle = `rgba(83, 72, 54, ${0.008 + random() * 0.018})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

export function drawPaper(
  context: CanvasRenderingContext2D,
  config: HandwritingConfig,
): void {
  const palettes: Record<PaperStyle, string> = {
    plain: "#fffdf8",
    ruled: "#fbfaf4",
    grid: "#fbfcf8",
    dot: "#fbfaf6",
  };
  context.fillStyle = palettes[config.paper];
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  drawPaperTexture(context, config.seed);

  const lineGap = config.fontSize * config.lineHeight;
  context.save();
  context.lineWidth = 1.2;

  if (config.paper === "ruled") {
    context.strokeStyle = "rgba(88, 122, 126, 0.27)";
    for (let y = config.margin; y < PAGE_HEIGHT - config.margin; y += lineGap) {
      context.beginPath();
      context.moveTo(config.margin * 0.58, y);
      context.lineTo(PAGE_WIDTH - config.margin * 0.58, y);
      context.stroke();
    }
    context.strokeStyle = "rgba(190, 99, 81, 0.42)";
    context.beginPath();
    context.moveTo(config.margin - 28, config.margin * 0.55);
    context.lineTo(config.margin - 28, PAGE_HEIGHT - config.margin * 0.55);
    context.stroke();
  }

  if (config.paper === "grid") {
    const gap = Math.max(52, config.fontSize * 1.08);
    context.strokeStyle = "rgba(92, 125, 114, 0.18)";
    for (let x = config.margin; x <= PAGE_WIDTH - config.margin; x += gap) {
      context.beginPath();
      context.moveTo(x, config.margin);
      context.lineTo(x, PAGE_HEIGHT - config.margin);
      context.stroke();
    }
    for (let y = config.margin; y <= PAGE_HEIGHT - config.margin; y += gap) {
      context.beginPath();
      context.moveTo(config.margin, y);
      context.lineTo(PAGE_WIDTH - config.margin, y);
      context.stroke();
    }
  }

  if (config.paper === "dot") {
    const gap = Math.max(54, config.fontSize * 1.05);
    context.fillStyle = "rgba(80, 112, 107, 0.26)";
    for (let y = config.margin; y <= PAGE_HEIGHT - config.margin; y += gap) {
      for (let x = config.margin; x <= PAGE_WIDTH - config.margin; x += gap) {
        context.beginPath();
        context.arc(x, y, 1.6, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  context.restore();
}

function drawMistakeMark(
  context: CanvasRenderingContext2D,
  x: number,
  baseline: number,
  width: number,
  random: () => number,
): void {
  context.save();
  context.strokeStyle = context.fillStyle;
  context.globalAlpha = 0.28 + random() * 0.18;
  context.lineWidth = 1.25;
  context.beginPath();
  context.moveTo(x + width * 0.1, baseline + 6 + random() * 3);
  context.quadraticCurveTo(
    x + width * 0.46,
    baseline + 9 + random() * 8,
    x + width * 0.94,
    baseline + 4 + random() * 4,
  );
  context.stroke();
  context.restore();
}

function alignedStart(
  lineWidth: number,
  config: HandwritingConfig,
  random: () => number,
): number {
  const contentWidth = PAGE_WIDTH - config.margin * 2;
  let start = config.margin;
  if (config.textAlign === "center") {
    start = config.margin + (contentWidth - lineWidth) / 2;
  } else if (config.textAlign === "right") {
    start = PAGE_WIDTH - config.margin - lineWidth;
  }
  if (config.textAlign === "left") {
    start += random() * config.fontSize * (config.messiness / 100) * 0.28;
  }
  return start;
}

export function renderHandwritingDocument(
  text: string,
  config: HandwritingConfig,
): RenderResult {
  if (text.trim().length === 0) {
    throw new Error("请先输入需要生成的内容");
  }

  const probe = document.createElement("canvas");
  const probeContext = probe.getContext("2d");
  if (!probeContext) {
    throw new Error("当前浏览器无法创建画布");
  }
  setCanvasFont(probeContext, config);

  const layout = layoutText(
    text,
    config,
    (char) => probeContext.measureText(char).width,
  );
  const pageBottom = PAGE_HEIGHT - config.margin;
  const availableHeight = pageBottom - layout.topBaseline + config.fontSize * 0.3;
  const maxLinesPerPage = Math.max(1, Math.floor(availableHeight / layout.lineHeightPx));
  const pageLines = paginateLines(layout.lines, maxLinesPerPage);
  const ink = getInkOption(config.ink);
  setCanvasFont(probeContext, config);
  const pages: HTMLCanvasElement[] = [];

  for (const [pageIndex, lines] of pageLines.entries()) {
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("当前浏览器无法创建画布");
    }
    drawPaper(context, config);
    setCanvasFont(context, config);
    context.textBaseline = "alphabetic";
    context.fillStyle = ink.color;

    for (const [lineIndex, line] of lines.entries()) {
      const lineRandom = mulberry32(
        config.seed + pageIndex * 100003 + lineIndex * 997,
      );
      const start = alignedStart(line.width, config, lineRandom);
      const slope = (lineRandom() - 0.5) * (config.messiness / 100) * 0.012;
      let cursor = start;

      for (const token of line.tokens) {
        const random = mulberry32(
          config.seed +
            pageIndex * 100003 +
            lineIndex * 997 +
            token.sourceIndex * 37,
        );
        const messy = config.messiness / 100;
        const tremor = config.tremor / 100;
        const jitterRange = config.fontSize * (0.008 + messy * 0.1);
        const x = cursor + (random() - 0.5) * jitterRange;
        const y =
          layout.topBaseline +
          lineIndex * layout.lineHeightPx +
          (x - start) * slope +
          (random() - 0.5) * jitterRange * 1.5;
        const angle = (random() - 0.5) * (0.004 + tremor * 0.16);
        const scale = 1 + (random() - 0.5) * tremor * 0.3;

        context.save();
        context.translate(x, y);
        context.rotate(angle);
        context.scale(scale, scale);
        context.globalAlpha = 0.82 + random() * 0.18;
        setCanvasFont(context, config);
        context.fillText(token.char, 0, 0);
        context.restore();

        if (random() < (config.mistakes / 100) * 0.55) {
          drawMistakeMark(context, x, y, token.advance, random);
        }

        cursor += token.advance + (random() - 0.5) * tremor * 1.8;
      }
    }

    if (pageLines.length > 1) {
      context.save();
      context.globalAlpha = 0.5;
      context.fillStyle = "#2f3a38";
      context.font = '26px "Segoe UI", "Microsoft YaHei", sans-serif';
      context.textAlign = "center";
      context.fillText(
        `${pageIndex + 1} / ${pageLines.length}`,
        PAGE_WIDTH / 2,
        PAGE_HEIGHT - 44,
      );
      context.restore();
    }

    pages.push(canvas);
  }

  return {
    pages,
    pageCount: pages.length,
    lineCount: layout.lines.length,
  };
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("图片生成失败"));
      }
    }, "image/png");
  });
}
