// Two renderers from one resolved style, so preview (CSS) and export (SVG) match.
import { resolveStyle, type CaptionCard, type CaptionStyle, type ResolvedStyle } from "./index";

/** Browser preview: inline style object for a caption <div> over the <video>.
 * `scale` maps the 1080-reference font size to the on-screen preview width. */
export function styleToCss(
  style: CaptionStyle,
  card: CaptionCard,
  scale = 1
): Record<string, string> {
  const r = resolveStyle(style, card);
  const size = r.fontSizePx * scale;
  const ow = r.outlineWidth * scale;
  const css: Record<string, string> = {
    position: "absolute",
    left: "5%",
    width: "90%",
    top: `${r.posVerticalPct}%`,
    transform: "translateY(-50%)",
    textAlign: "center",
    fontFamily: `${r.fontFamily}, "Noto Sans Thai", sans-serif`,
    fontWeight: String(r.weight),
    fontSize: `${size}px`,
    lineHeight: "1.15",
    color: r.fill,
    textTransform: r.uppercase ? "uppercase" : "none",
    pointerEvents: "none",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };
  if (r.box) {
    css.background = r.box;
    css.padding = `${8 * scale}px ${18 * scale}px`;
    css.borderRadius = `${6 * scale}px`;
    css.width = "auto";
    css.maxWidth = "90%";
    css.left = "50%";
    css.transform = "translate(-50%, -50%)";
    css.display = "inline-block";
  } else if (r.outlineWidth > 0) {
    // CSS text outline via layered text-shadow (paint-order stroke isn't universal).
    const o = ow;
    const c = r.outlineColor;
    css.textShadow = [
      `${o}px 0 ${c}`, `-${o}px 0 ${c}`, `0 ${o}px ${c}`, `0 -${o}px ${c}`,
      `${o}px ${o}px ${c}`, `-${o}px -${o}px ${c}`, `${o}px -${o}px ${c}`, `-${o}px ${o}px ${c}`,
      ...(r.shadow ? [`0 ${4 * scale}px ${8 * scale}px rgba(0,0,0,0.6)`] : []),
    ].join(", ");
  } else if (r.shadow) {
    css.textShadow = `0 ${4 * scale}px ${8 * scale}px rgba(0,0,0,0.7)`;
  }
  return css;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Export: a full-frame transparent SVG with the caption positioned per the style,
 * ready to rasterize (resvg) and overlay via ffmpeg. Matches styleToCss visually. */
export function cardToSvg(
  style: CaptionStyle,
  card: CaptionCard,
  width = 1080,
  height = 1920
): string {
  const r = resolveStyle(style, card);
  const cx = width / 2;
  const cy = (r.posVerticalPct / 100) * height;
  const text = r.uppercase ? r.text.toUpperCase() : r.text;

  // Simple word-wrap to keep within ~90% width (rough char-based estimate; good enough
  // for short caption cards, which are 1 sentence / a few words).
  const maxChars = Math.max(8, Math.floor((width * 0.9) / (r.fontSizePx * 0.55)));
  const lines = wrap(text, maxChars);
  const lineH = r.fontSizePx * 1.15;
  const totalH = lines.length * lineH;
  const startY = cy - totalH / 2 + r.fontSizePx * 0.8;

  const shadow = r.shadow
    ? `<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="${Math.round(r.fontSizePx * 0.05)}" stdDeviation="${Math.round(r.fontSizePx * 0.08)}" flood-color="black" flood-opacity="0.75"/></filter>`
    : "";
  const filterAttr = r.shadow ? ` filter="url(#sh)"` : "";
  const fontStack = `${r.fontFamily}, Sarabun, sans-serif`;

  let body = "";
  if (r.box) {
    // Box background sized to the widest line, centered.
    const widest = Math.max(...lines.map((l) => l.length));
    const boxW = Math.min(width * 0.9, widest * r.fontSizePx * 0.55 + 40);
    const boxH = totalH + 24;
    const boxX = cx - boxW / 2;
    const boxY = cy - boxH / 2;
    body += `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="8" fill="${r.box}"/>`;
    lines.forEach((line, i) => {
      body += `<text x="${cx}" y="${startY + i * lineH}" text-anchor="middle" font-family="${fontStack}" font-size="${r.fontSizePx}" font-weight="${r.weight}" fill="${r.fill}">${esc(line)}</text>`;
    });
  } else {
    const stroke = r.outlineWidth > 0
      ? ` stroke="${r.outlineColor}" stroke-width="${r.outlineWidth}" paint-order="stroke"`
      : "";
    lines.forEach((line, i) => {
      body += `<text x="${cx}" y="${startY + i * lineH}" text-anchor="middle" font-family="${fontStack}" font-size="${r.fontSizePx}" font-weight="${r.weight}" fill="${r.fill}"${stroke}${filterAttr}>${esc(line)}</text>`;
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>${shadow}</defs>${body}</svg>`;
}

/** Break text into "tokens" we can wrap on without splitting a word. Thai has no
 * spaces between words, so use Intl.Segmenter (word granularity) which knows Thai
 * word boundaries — otherwise a long Thai caption breaks mid-word (verified: ขึ้น
 * was being split ขึ้/น). Falls back to space-splitting if Segmenter is unavailable. */
function tokenize(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return text.split(/(\s+)/);
}

function wrap(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const tokens = tokenize(text);
  const lines: string[] = [];
  let cur = "";
  for (const tok of tokens) {
    if (cur.length + tok.length > maxChars && cur.trim()) {
      lines.push(cur.trim());
      cur = tok.trimStart();
    } else {
      cur += tok;
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  // Only hard-split a token that is itself longer than a line (rare — a very long
  // unbroken word); keeps normal words intact.
  return lines.flatMap((l) =>
    l.length <= maxChars ? [l] : (l.match(new RegExp(`.{1,${maxChars}}`, "g")) ?? [l])
  );
}

export { resolveStyle, type CaptionCard, type CaptionStyle, type ResolvedStyle };
