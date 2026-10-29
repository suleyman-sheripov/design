export type RibbonVertex = { x: number; y: number; z: number; twist: number; card?: number }
// Equal-distance samples keep the normal stable when a connector meets an orbit.
// A short Gaussian pass blends curvature across that join, not just its tangent.
export function smoothRibbonPath(source: RibbonVertex[], step = 5, sigma = 22) {
  if (source.length < 3) return source.map((p, index) => ({ ...p, sourceIndex: index }))
  const distance = [0]
  for (let i = 1; i < source.length; i++) distance.push(distance[i - 1] + Math.hypot(source[i].x - source[i - 1].x, source[i].y - source[i - 1].y))
  const total = distance[distance.length - 1]
  if (!total) return source.map((p, index) => ({ ...p, sourceIndex: index }))
  const count = Math.ceil(total / step), spacing = total / count
  let segment = 1
  const samples = Array.from({ length: count + 1 }, (_, i) => {
    const d = i * spacing
    while (segment < source.length - 1 && distance[segment] < d) segment++
    const a = source[segment - 1], b = source[segment]
    const t = (d - distance[segment - 1]) / (distance[segment] - distance[segment - 1] || 1)
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
      twist: a.twist + (b.twist - a.twist) * t, card: t < .5 ? a.card : b.card, sourceIndex: segment - 1 + t }
  })
  const radius = Math.ceil(3 * sigma / spacing)
  const weights = Array.from({ length: radius * 2 + 1 }, (_, i) => Math.exp(-.5 * ((i - radius) * spacing / sigma) ** 2))
  return samples.map((point, i) => {
    let x = 0, y = 0, sum = 0
    for (let k = -radius; k <= radius; k++) {
      const n = i + k
      // Linear extrapolation preserves the endpoints of open, offscreen paths.
      const sample = samples[Math.max(0, Math.min(samples.length - 1, n))]
      let sx = sample.x, sy = sample.y
      if (n < 0) { sx += n * (samples[1].x - samples[0].x); sy += n * (samples[1].y - samples[0].y) }
      if (n >= samples.length) { const last = samples.length - 1; sx += (n - last) * (samples[last].x - samples[last - 1].x); sy += (n - last) * (samples[last].y - samples[last - 1].y) }
      const weight = weights[k + radius]
      x += sx * weight; y += sy * weight; sum += weight
    }
    return { ...point, x: x / sum, y: y / sum }
  })
}
