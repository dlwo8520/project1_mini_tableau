// src/utils/stats.js

// 히스토그램 빈도 계산 (5개 구간 예시)
export function makeHistogram(values, bins = 10) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const width = (max - min) / bins;
    const data = Array(bins).fill(0);
  
    values.forEach(v => {
      const idx = Math.min(bins - 1, Math.floor((v - min) / width));
      data[idx]++;
    });
  
    const categories = data.map((_, i) => (min + i * width).toFixed(2));
    return { categories, data };
  }
  
  // 박스플롯 사분위수 계산
  export function makeBoxplot(values) {
    const sorted = [...values].sort((a,b) => a-b);
    const q = idx => {
      const p = (sorted.length - 1) * idx;
      const base = Math.floor(p);
      const rest = p - base;
      if (sorted[base+1] !== undefined) {
        return sorted[base] + rest * (sorted[base+1] - sorted[base]);
      }
      return sorted[base];
    };
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const q1 = q(0.25);
    const q2 = q(0.5);
    const q3 = q(0.75);
    return [min, q1, q2, q3, max];
  }
  
  // 바이올린용 커널 밀도 추정 간단 구현 (Gaussian KDE)
  export function makeViolin(values, points = 50) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const step = range / (points - 1);
    const xs = Array(points).fill(0).map((_,i) => min + i * step);
    // Gaussian kernel
    const bw = 1.06 * Math.sqrt(variance(values)) * Math.pow(values.length, -0.2);
    const kernel = (u) => Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
    const ys = xs.map(x =>
      values.reduce((sum, v) => sum + kernel((x - v) / bw), 0) / (values.length * bw)
    );
    return { xs, ys };
  }
  
  function variance(arr) {
    const m = arr.reduce((a,b) => a+b, 0) / arr.length;
    return arr.reduce((a,b) => a + (b-m)**2, 0) / arr.length;
  }
  