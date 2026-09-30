// Axis helpers shared by the two charts.

export function linearScale(d0, d1, r0, r1) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v) => r0 + (v - d0) * k;
}

// Round tick values covering [lo, hi] with roughly `target` intervals.
export function niceTicks(lo, hi, target = 5) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const stepSize = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const first = Math.ceil(lo / stepSize - 1e-9) * stepSize;
  const out = [];
  for (let v = first; v <= hi + stepSize * 1e-9; v += stepSize) out.push(Number(v.toFixed(10)));
  return out;
}

// Fixed-length ring buffer for the r(t) trace.
export function createTrace(capacity) {
  return { values: new Float64Array(capacity), start: 0, length: 0 };
}

export function pushTrace(trace, v) {
  const cap = trace.values.length;
  if (trace.length < cap) {
    trace.values[(trace.start + trace.length) % cap] = v;
    trace.length++;
  } else {
    trace.values[trace.start] = v;
    trace.start = (trace.start + 1) % cap;
  }
}

export function traceValues(trace) {
  const out = new Array(trace.length);
  for (let i = 0; i < trace.length; i++) out[i] = trace.values[(trace.start + i) % trace.values.length];
  return out;
}
