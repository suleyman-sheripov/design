// Seconds, in the coordinate system of the supplied SVG master.
export const INTRO_END = 3.72
export const T = { draw: 0.16, drawEnd: 1.14, h: 0.91, hEnd: 1.49, sweep: 1.61, stop: 2.94 }
export const DOT_START = 1340.2
export const DOT_END = 4759.5
export const DOT_RADIUS = 86
const unit = (v: number) => Math.max(0, Math.min(1, v))
const phase = (t: number, start: number, end: number) => unit((t - start) / (end - start))
const smooth = (v: number) => v * v * (3 - 2 * v)
// Invert the x coordinate of cubic-bezier(.62, 0, .24, 1).
// A continuous velocity curve: measured takeoff, fast sweep, long braking.
function sweep(v: number) {
  if (v === 0 || v === 1) return v
  let low = 0, high = 1
  for (let i = 0; i < 20; i++) {
    const u = (low + high) / 2
    const x = 3 * (1 - u) ** 2 * u * .62 + 3 * (1 - u) * u * u * .24 + u ** 3
    if (x < v) low = u
    else high = u
  }
  return smooth((low + high) / 2)
}
export function frameAt(t: number) {
  const travel = sweep(phase(t, T.sweep, T.stop))
  const dotX = DOT_START + (DOT_END - DOT_START) * travel
  return {
    stroke: smooth(phase(t, T.draw, T.drawEnd)),
    lower: smooth(phase(t, 0.91, 1.13)),
    hLeft: smooth(phase(t, T.h, 1.26)),
    hCross: smooth(phase(t, 1.04, 1.39)),
    hRight: smooth(phase(t, 1.14, T.hEnd)),
    dot: smooth(phase(t, 1.38, 1.58)),
    dotX,
    // Keep letters behind the dot; release the V tip as the dot reaches its final cutout.
    wordEdge: dotX - DOT_RADIUS + 2 * DOT_RADIUS * smooth(phase(t, T.stop - .18, T.stop)),
    wordVisible: t >= T.sweep,
    offset: (DOT_END - dotX) / 2,
  }
}
export type IntroFrame = ReturnType<typeof frameAt>
