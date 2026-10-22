export type FontId = "long-cang" | "ma-shan-zheng" | "zhi-mang-xing";

export type PaperStyle = "plain" | "ruled" | "grid" | "dot";

export type InkId = "black" | "blue" | "graphite";

export type TextAlign = "left" | "center" | "right";

export interface FontOption {
  id: FontId;
  label: string;
  description: string;
  family: string;
  file: string;
  weight: number;
}

export interface InkOption {
  id: InkId;
  label: string;
  color: string;
}

export interface HandwritingConfig {
  fontId: FontId;
  paper: PaperStyle;
  ink: InkId;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  margin: number;
  messiness: number;
  tremor: number;
  mistakes: number;
  textAlign: TextAlign;
  seed: number;
}

export interface LayoutToken {
  char: string;
  advance: number;
  sourceIndex: number;
}

export interface LayoutLine {
  tokens: LayoutToken[];
  width: number;
  isParagraphEnd: boolean;
}
