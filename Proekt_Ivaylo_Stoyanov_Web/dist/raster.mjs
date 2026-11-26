import {size} from './model.mjs';

// Keep small drawings and drawings near the edge recognizable by fitting
// their centerlines into the same model space before sampling.
export function rasterize(strokes) {
  const grid = new Uint8Array(size * size);
  if (!strokes.length) return grid;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const stroke of strokes) {
    for (const [x, y] of stroke) {
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  const scale = 10 / Math.max(right - left, bottom - top, 12);
  const map = ([x, y]) => [
    Math.round(size / 2 + (x - (left + right) / 2) * scale),
    Math.round(size / 2 + (y - (top + bottom) / 2) * scale),
  ];
  for (const stroke of strokes) {
    let [x, y] = map(stroke[0]);
    grid[y * size + x] = 1;
    for (let i = 1; i < stroke.length; i++) {
      const [nextX, nextY] = map(stroke[i]);
      const dx = nextX - x, dy = nextY - y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let step = 1; step <= steps; step++) {
        const px = Math.round(x + dx * step / steps);
        const py = Math.round(y + dy * step / steps);
        grid[py * size + px] = 1;
      }
      x = nextX;
      y = nextY;
    }
  }
  return grid;
}
