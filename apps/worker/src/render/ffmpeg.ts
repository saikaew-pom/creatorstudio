// Thin promise wrapper around the system ffmpeg/ffprobe binaries (verified: ffmpeg 8.1).
import { spawn } from "node:child_process";

// Memory-safe libx264 flags for every re-encode. In a container ffmpeg auto-detects the
// HOST core count and spawns that many x264 threads, each buffering 1080x1920 frames —
// which OOM-kills ffmpeg on small instances (seen live on Railway: the child dies with a
// signal, surfacing as "ffmpeg exited null"). Capping threads + a light preset keeps the
// encoder's memory bounded regardless of how many cores the host advertises.
export const X264 = ["-c:v", "libx264", "-preset", "veryfast", "-threads", "2", "-pix_fmt", "yuv420p"];

export function ffmpeg(args: string[]): Promise<void> {
  return run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
}

export async function ffprobeDuration(path: string): Promise<number> {
  const out = await capture("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", path,
  ]);
  return parseFloat(out.trim()) || 0;
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`))
    );
  });
}

function capture(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err))));
  });
}
