// Depth of the grooves cut by an engraving G-code (Z=0 is the top of the
// workpiece). Used to show the engraved part in the viewer.

export const TOOL_FLAT = 'flat'
export const TOOL_BALL = 'ball'
export const TOOL_VBIT = 'vbit'

export const PLATE_MARGIN_MM = 2
export const BASE_THICKNESS_MM = 3
const MIN_PIXEL_MM = 0.05
const EDGE_WIDTH_CELLS = 1.5

const COMMENT_RE = /;.*|\([^)]*\)/g
const WORD_RE = /([GXYZ])\s*(-?\d+(?:\.\d*)?|-?\.\d+)/gi

/**
 * Straight feed moves (G1) of an absolute G-code, cut to the part below Z=0.
 * Returns a Float64Array of rows (x0, y0, z0, x1, y1, z1).
 */
export function parseCuttingSegments (gcode) {
  const segments = []
  let position = [0, 0, 0]
  let feed = false

  for (const line of gcode.split('\n')) {
    const target = position.slice()
    let moved = false
    for (const [, letter, value] of line
      .replace(COMMENT_RE, '')
      .matchAll(WORD_RE)) {
      const code = letter.toUpperCase()
      if (code === 'G') {
        const g = Math.trunc(parseFloat(value))
        if (g === 0 || g === 1) feed = g === 1
      } else {
        target['XYZ'.indexOf(code)] = parseFloat(value)
        moved = true
      }
    }
    if (!moved) continue
    if (feed) {
      const segment = clipBelowSurface(position, target)
      if (segment) segments.push(...segment)
    }
    position = target
  }
  return Float64Array.from(segments)
}

function clipBelowSurface (start, end) {
  const z0 = start[2]
  const z1 = end[2]
  if (z0 >= 0 && z1 >= 0) return null
  let a = start
  let b = end
  if (z0 > 0 || z1 > 0) {
    const t = z0 / (z0 - z1)
    const crossing = a.map((v, i) => v + (b[i] - v) * t)
    crossing[2] = 0
    if (z0 > 0) a = crossing
    else b = crossing
  }
  return [...a, ...b]
}

function liftFunction (tool) {
  const radius = tool.diameter / 2
  if (tool.type === TOOL_BALL) {
    return d => radius - Math.sqrt(Math.max(radius * radius - d * d, 0))
  }
  if (tool.type === TOOL_VBIT) {
    const k = 1 / Math.tan((tool.angle * Math.PI) / 360)
    return d => d * k
  }
  return () => 0
}

/**
 * Depth map of the grooves. Every cell holds the depth below the top of the
 * workpiece, found from the exact distance from the cell centre to the tool
 * path, so the walls of the grooves do not depend on the grid.
 *
 * Returns null when nothing is cut, otherwise
 * { depth: Float32Array, cols, rows, x0, y0, pixel, maxDepth },
 * where cell (col, row) covers machine X from x0 + col * pixel and Y from
 * y0 + row * pixel.
 */
export function buildDepthField (segments, tool, maxSide = 4096) {
  const count = segments.length / 6
  if (count === 0) return null

  const radius = tool.diameter / 2
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let s = 0; s < count; s++) {
    for (const o of [0, 3]) {
      minX = Math.min(minX, segments[s * 6 + o])
      maxX = Math.max(maxX, segments[s * 6 + o])
      minY = Math.min(minY, segments[s * 6 + o + 1])
      maxY = Math.max(maxY, segments[s * 6 + o + 1])
    }
  }

  const margin = radius + PLATE_MARGIN_MM
  const x0 = minX - margin
  const y0 = minY - margin
  const width = maxX + margin - x0
  const height = maxY + margin - y0
  const pixel = Math.max(Math.max(width, height) / maxSide, MIN_PIXEL_MM)
  const cols = Math.ceil(width / pixel)
  const rows = Math.ceil(height / pixel)

  const depth = new Float32Array(cols * rows)
  const lift = liftFunction(tool)
  const reach = radius + pixel
  const r2 = reach * reach
  const edgeScale = 1 / (EDGE_WIDTH_CELLS * pixel)
  let maxDepth = 0

  for (let s = 0; s < count; s++) {
    const o = s * 6
    const ax = segments[o]
    const ay = segments[o + 1]
    const bx = segments[o + 3]
    const by = segments[o + 4]
    let za = -segments[o + 2]
    let zb = -segments[o + 5]
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    if (len2 < 1e-12) za = zb = Math.max(za, zb) // a plunge

    const iFrom = Math.max(0, Math.floor((Math.min(ax, bx) - reach - x0) / pixel))
    const iTo = Math.min(cols - 1, Math.floor((Math.max(ax, bx) + reach - x0) / pixel))
    const jFrom = Math.max(0, Math.floor((Math.min(ay, by) - reach - y0) / pixel))
    const jTo = Math.min(rows - 1, Math.floor((Math.max(ay, by) + reach - y0) / pixel))

    for (let j = jFrom; j <= jTo; j++) {
      const cy = y0 + (j + 0.5) * pixel
      for (let i = iFrom; i <= iTo; i++) {
        const cx = x0 + (i + 0.5) * pixel
        let t = 0
        if (len2 > 1e-12) {
          t = ((cx - ax) * dx + (cy - ay) * dy) / len2
          t = t < 0 ? 0 : t > 1 ? 1 : t
        }
        const px = ax + dx * t - cx
        const py = ay + dy * t - cy
        const d2 = px * px + py * py
        if (d2 > r2) continue
        const dist = Math.sqrt(d2)
        // the wall is spread over about a cell, so its position is
        // not rounded to the grid
        const cover = Math.min(1, (radius - dist) * edgeScale + 0.5)
        const value = (za + (zb - za) * t - lift(dist)) * cover
        const index = j * cols + i
        if (value > depth[index]) {
          depth[index] = value
          if (value > maxDepth) maxDepth = value
        }
      }
    }
  }

  if (maxDepth <= 0) return null
  return { depth, cols, rows, x0, y0, pixel, maxDepth }
}
