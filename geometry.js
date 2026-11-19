export const SENSOR_WIDTH = 640;
export const CX = SENSOR_WIDTH / 2;

export function project({x, z, baseline, focal}) {
  if (![x, z, baseline, focal].every(Number.isFinite) || z <= 0 || baseline <= 0 || focal <= 0) {
    throw new RangeError('Expected finite coordinates, positive depth, baseline and focal length.');
  }
  return {left: CX + focal * (x + baseline / 2) / z, right: CX + focal * (x - baseline / 2) / z};
}

export function triangulate(left, right, baseline, focal) {
  const disparity = left - right;
  if (![left, right, baseline, focal].every(Number.isFinite) || baseline <= 0 || focal <= 0 || disparity <= 1e-6) return null;
  const z = focal * baseline / disparity;
  return {x: ((left + right) / 2 - CX) * z / focal, z, disparity};
}

export function inFrame({left, right}) {
  return [left, right].every(u => u >= 0 && u < SENSOR_WIDTH);
}

export function normalPairs(seed, count) {
  let state = seed >>> 0;
  function uniform() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return (state + 0.5) / 4294967296;
  }
  return Array.from({length: count}, () => {
    const radius = Math.sqrt(-2 * Math.log(uniform()));
    const angle = 2 * Math.PI * uniform();
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  });
}

export function observe(parameters, noisePair) {
  const ideal = project(parameters);
  const measured = {left: ideal.left + noisePair[0] * parameters.sigma, right: ideal.right + noisePair[1] * parameters.sigma};
  return {ideal, measured, estimate: inFrame(ideal) && inFrame(measured)
    ? triangulate(measured.left, measured.right, parameters.baseline, parameters.focal) : null};
}

export function experiment(parameters, seed = 2026, trials = 256) {
  const errors = [];
  for (const pair of normalPairs(seed, trials)) {
    const {estimate} = observe(parameters, pair);
    if (estimate) errors.push(Math.abs(estimate.z - parameters.z) / parameters.z);
  }
  errors.sort((a, b) => a - b);
  const median = errors.length ? (errors[Math.floor((errors.length - 1) / 2)] + errors[Math.floor(errors.length / 2)]) / 2 : null;
  return {trials, valid: errors.length, invalid: trials - errors.length, medianRelativeError: median};
}
