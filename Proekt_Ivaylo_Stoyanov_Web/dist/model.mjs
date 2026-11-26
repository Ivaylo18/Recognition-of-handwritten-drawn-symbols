export const size = 16;

function resample(values, length) {
  const scale = values.length / length;
  const radius = Math.max(1, scale);
  return Array.from({length}, (_, index) => {
    const center = (index + 0.5) * scale;
    let weightSum = 0;
    let weightedSum = 0;
    for (let i = 0; i < values.length; i++) {
      const weight = Math.max(0, 1 - Math.abs(i + 0.5 - center) / radius);
      weightSum += weight;
      weightedSum += weight * values[i];
    }
    return Math.round(weightedSum / weightSum);
  });
}

export function features(grid) {
  let left = size, right = -1, top = size, bottom = -1;
  for (let index = 0; index < grid.length; index++) {
    if (!grid[index]) continue;
    const x = index % size, y = Math.floor(index / size);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  if (right < 0) return null;
  const width = right - left + 1, height = bottom - top + 1;
  const scale = Math.max(width, height);
  // Python round закръгля половинките към четното число.
  const targetLength = length => {
    const quotient = 12 * length / scale;
    const floor = Math.floor(quotient);
    return Math.max(1, quotient - floor === 0.5 ? floor + floor % 2 : Math.round(quotient));
  };
  const w = targetLength(width), h = targetLength(height);
  const rows = Array.from({length: height}, (_, y) => {
    const offset = (top + y) * size + left;
    return resample(Array.from(grid.slice(offset, offset + width), bit => bit * 255), w);
  });
  const vector = new Uint8Array(size * size);
  const offset = Math.floor((size - h) / 2) * size + Math.floor((size - w) / 2);
  for (let x = 0; x < w; x++) {
    const column = resample(rows.map(row => row[x]), h);
    for (let y = 0; y < h; y++) vector[offset + y * size + x] = column[y];
  }
  return vector;
}

export function classify(vector, training, classCount) {
  const stride = size * size + 1;
  const distances = [];
  for (let start = 0; start < training.length; start += stride) {
    let distance = 0;
    for (let i = 0; i < vector.length; i++) {
      const difference = vector[i] - training[start + 1 + i];
      distance += difference * difference;
    }
    distances.push({distance, label: training[start]});
  }
  distances.sort((a, b) => a.distance - b.distance);
  const votes = Array(classCount).fill(0);
  for (const item of distances.slice(0, 5)) votes[item.label]++;
  return votes.map((count, index) => ({count, index}))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count || a.index - b.index);
}
