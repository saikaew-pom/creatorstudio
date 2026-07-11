"use client";
// Multi-track timeline (mirrors Hero AI): เสียงพูด · บีโรล · ซับ · เพลง. The subtitle
// track shows the (karaoke-split) caption cards positioned by time; the voice track
// renders a stylized waveform; B-roll shows one block per sentence segment. Click to seek.
import type { CaptionCard } from "@cs/captions";

const PPS = 80; // pixels per second

// Deterministic integer hash → waveform bar height (20..79%). Uses only uint32 integer
// ops (no Math.sin/float) so SSR and client produce byte-identical values — otherwise the
// bar heights hydrate-mismatch (Math.sin isn't bit-stable across Node vs browser V8).
function barH(i: number): number {
  let x = (i * 2654435761) >>> 0;
  x ^= x >>> 15; x = (x * 2246822519) >>> 0; x ^= x >>> 13;
  return 20 + ((x >>> 0) % 60);
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Timeline({
  cards, baseCards, currentMs, onSeek,
}: {
  cards: CaptionCard[];
  baseCards: CaptionCard[];
  currentMs: number;
  onSeek: (ms: number) => void;
}) {
  const durMs = Math.max(
    cards.at(-1)?.end_ms ?? 0,
    baseCards.at(-1)?.end_ms ?? 0,
    1000
  );
  const width = Math.max(320, (durMs / 1000) * PPS);
  const xOf = (ms: number) => (ms / 1000) * PPS;

  function seekAt(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
    onSeek((x / PPS) * 1000);
  }

  const bars = Math.floor(width / 4);
  const ticks: number[] = [];
  for (let s = 0; s <= durMs / 1000; s += 5) ticks.push(s);

  const TRACK_LABEL: React.CSSProperties = {
    position: "sticky", left: 0, zIndex: 2, width: 78, flexShrink: 0,
    display: "flex", alignItems: "center", gap: 6, padding: "0 8px",
    fontSize: 11.5, color: "var(--text-dim)", background: "var(--bg-raised)",
    borderRight: "1px solid var(--border)",
  };
  const laneH = 34;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto", position: "relative" }}>
        <div style={{ width: width + 78, position: "relative" }} onClick={seekAt}>
          {/* Ruler */}
          <div style={{ display: "flex", height: 22, borderBottom: "1px solid var(--border)" }}>
            <div style={{ ...TRACK_LABEL, height: 22 }} />
            <div style={{ position: "relative", flex: 1 }}>
              {ticks.map((s) => (
                <span key={s} style={{ position: "absolute", left: xOf(s * 1000), top: 4, fontSize: 10, color: "var(--text-dim)" }}>{fmt(s * 1000)}</span>
              ))}
            </div>
          </div>

          {/* Voice waveform */}
          <div style={{ display: "flex", height: laneH, alignItems: "center", borderBottom: "1px solid var(--border)" }}>
            <div style={TRACK_LABEL}>🎙 เสียงพูด</div>
            <div style={{ position: "relative", flex: 1, height: "100%", display: "flex", alignItems: "center", gap: 1, paddingLeft: 2 }}>
              {Array.from({ length: bars }).map((_, i) => (
                <span key={i} style={{ width: 2, height: `${barH(i)}%`, background: "var(--accent-2)", opacity: 0.55, borderRadius: 1 }} />
              ))}
            </div>
          </div>

          {/* B-roll blocks (one per sentence) */}
          <div style={{ display: "flex", height: laneH, alignItems: "center", borderBottom: "1px solid var(--border)" }}>
            <div style={TRACK_LABEL}>🎞 บีโรล</div>
            <div style={{ position: "relative", flex: 1, height: "100%" }}>
              {baseCards.map((c, i) => (
                <div key={c.idx} title={c.text} style={{
                  position: "absolute", left: xOf(c.start_ms), width: Math.max(2, xOf(c.end_ms - c.start_ms) - 2), top: 5, bottom: 5,
                  background: i % 2 ? "rgba(124,92,255,.25)" : "rgba(167,139,250,.25)",
                  border: "1px solid var(--border)", borderRadius: 5,
                }} />
              ))}
            </div>
          </div>

          {/* Subtitle cards */}
          <div style={{ display: "flex", height: laneH, alignItems: "center", borderBottom: "1px solid var(--border)" }}>
            <div style={TRACK_LABEL}>💬 ซับ</div>
            <div style={{ position: "relative", flex: 1, height: "100%" }}>
              {cards.map((c) => {
                const on = currentMs >= c.start_ms && currentMs < c.end_ms;
                return (
                  <div key={c.idx} title={c.text} style={{
                    position: "absolute", left: xOf(c.start_ms), width: Math.max(3, xOf(c.end_ms - c.start_ms) - 2), top: 5, bottom: 5,
                    background: on ? "var(--accent)" : "var(--bg-inset)",
                    border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, borderRadius: 5,
                    color: on ? "#fff" : "var(--text-dim)", fontSize: 10, lineHeight: "22px",
                    padding: "0 5px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                  }}>{c.text}</div>
                );
              })}
            </div>
          </div>

          {/* Music */}
          <div style={{ display: "flex", height: laneH, alignItems: "center" }}>
            <div style={TRACK_LABEL}>🎵 เพลง</div>
            <div style={{ position: "relative", flex: 1, height: "100%", display: "flex", alignItems: "center" }}>
              <div style={{ marginLeft: 2, height: 8, width: width - 6, borderRadius: 4, background: "repeating-linear-gradient(90deg, rgba(52,211,153,.35) 0 8px, transparent 8px 14px)" }} />
            </div>
          </div>

          {/* Playhead */}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 78 + xOf(currentMs), width: 2, background: "var(--danger)", pointerEvents: "none", zIndex: 3 }} />
        </div>
      </div>
    </div>
  );
}
