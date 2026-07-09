// Shared caption styling — the single source of truth for BOTH the browser preview
// (CSS) and the export burn (SVG → PNG → ffmpeg overlay). doc 04 §6. Keeping the
// style values here means preview and export can't drift: styleToCss() and cardToSvg()
// both derive from the same resolveStyle() output.

export interface CaptionCard {
  idx: number;
  start_ms: number;
  end_ms: number;
  text: string;
  type: "hook" | "normal" | "cta";
}

export type ThemeKey =
  | "neon_green" | "pastel" | "classic" | "hormozi" | "beast" | "white_box"
  | "yellow_box" | "retro" | "news" | "red_fire" | "electric";

export interface CaptionStyle {
  theme: ThemeKey | null;
  font_family: string;      // "Kanit" | "Sarabun" | "Prompt" | "Mitr"
  font_weight: "bold" | "light";
  font_size_px: number;     // default 80 (at 1080-wide reference)
  color_base: string;
  color_emphasis: string;   // used for hook/cta cards
  shadow: boolean;
  outline: boolean;
  outline_width: number;
  pos_vertical_pct: number; // 0..100 (12 top / 50 mid / 88 bottom)
}

export const DEFAULT_STYLE: CaptionStyle = {
  theme: "hormozi",
  font_family: "Kanit",
  font_weight: "bold",
  font_size_px: 80,
  color_base: "#ffffff",
  color_emphasis: "#ffe14d",
  shadow: true,
  outline: true,
  outline_width: 8,
  pos_vertical_pct: 88,
};

/** A theme's concrete look. Themes override the base color/outline/box/shadow so
 * they read as distinct presets (doc 04 §6 "เลือกกลุ่มนี้แล้วใช้เอฟเฟกต์ประจำสไตล์"). */
interface Theme {
  fill: string;
  emphasisFill: string;
  outlineColor: string;
  outlineWidth: number;
  shadow: boolean;
  box: string | null;   // solid box behind text, or null
  boxText?: string;     // text color when on a box
  weight: number;       // font-weight
  uppercase?: boolean;
}

export const THEMES: Record<ThemeKey, Theme> = {
  hormozi:    { fill: "#ffffff", emphasisFill: "#ffe14d", outlineColor: "#000000", outlineWidth: 10, shadow: true, box: null, weight: 800 },
  beast:      { fill: "#ffffff", emphasisFill: "#4ade80", outlineColor: "#000000", outlineWidth: 12, shadow: true, box: null, weight: 800 },
  neon_green: { fill: "#39ff14", emphasisFill: "#ffffff", outlineColor: "#062b00", outlineWidth: 6, shadow: true, box: null, weight: 700 },
  pastel:     { fill: "#5b4b8a", emphasisFill: "#e26d9c", outlineColor: "#ffffff", outlineWidth: 6, shadow: false, box: null, weight: 700 },
  classic:    { fill: "#ffffff", emphasisFill: "#ffd166", outlineColor: "#000000", outlineWidth: 5, shadow: true, box: null, weight: 700 },
  white_box:  { fill: "#111111", emphasisFill: "#d11a1a", outlineColor: "#00000000", outlineWidth: 0, shadow: false, box: "#ffffff", boxText: "#111111", weight: 800 },
  yellow_box: { fill: "#111111", emphasisFill: "#111111", outlineColor: "#00000000", outlineWidth: 0, shadow: false, box: "#ffe14d", boxText: "#111111", weight: 800 },
  retro:      { fill: "#ffdd00", emphasisFill: "#ff5e5b", outlineColor: "#3a2200", outlineWidth: 7, shadow: true, box: null, weight: 800 },
  news:       { fill: "#ffffff", emphasisFill: "#ffcc00", outlineColor: "#00000000", outlineWidth: 0, shadow: false, box: "#c1121f", boxText: "#ffffff", weight: 700 },
  red_fire:   { fill: "#ffffff", emphasisFill: "#ff3b1d", outlineColor: "#4a0000", outlineWidth: 10, shadow: true, box: null, weight: 800 },
  electric:   { fill: "#eaf6ff", emphasisFill: "#26c6ff", outlineColor: "#00294d", outlineWidth: 9, shadow: true, box: null, weight: 800 },
};

export const THEME_LABELS: Record<ThemeKey, string> = {
  neon_green: "นีออนเขียว", pastel: "พาสเทล", classic: "คลาสสิก", hormozi: "Hormozi",
  beast: "Beast", white_box: "กล่องขาว", yellow_box: "กล่องเหลือง", retro: "เรโทร",
  news: "ข่าว", red_fire: "ไฟแดง", electric: "ไฟฟ้า",
};

export interface ResolvedStyle {
  text: string;
  fill: string;
  outlineColor: string;
  outlineWidth: number;
  shadow: boolean;
  box: string | null;
  weight: number;
  fontFamily: string;
  fontSizePx: number;
  posVerticalPct: number;
  uppercase: boolean;
}

/** Resolve a card + style into concrete values. Theme (when set) drives colors/
 * outline/box; hook/cta cards use the emphasis color. */
export function resolveStyle(style: CaptionStyle, card: CaptionCard): ResolvedStyle {
  const t = style.theme ? THEMES[style.theme] : null;
  const emphasize = card.type === "hook" || card.type === "cta";
  const box = t ? t.box : null;
  let fill: string;
  if (box && t?.boxText) fill = emphasize ? t.emphasisFill : t.boxText;
  else if (t) fill = emphasize ? t.emphasisFill : t.fill;
  else fill = emphasize ? style.color_emphasis : style.color_base;
  return {
    text: card.text,
    fill,
    outlineColor: t ? t.outlineColor : style.color_base === "#ffffff" ? "#000000" : "#ffffff",
    outlineWidth: t ? t.outlineWidth : style.outline ? style.outline_width : 0,
    shadow: t ? t.shadow : style.shadow,
    box,
    weight: t ? t.weight : style.font_weight === "bold" ? 800 : 400,
    fontFamily: style.font_family,
    fontSizePx: style.font_size_px,
    posVerticalPct: style.pos_vertical_pct,
    uppercase: t?.uppercase ?? false,
  };
}

export { styleToCss, cardToSvg } from "./render";
