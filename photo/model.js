export const width = 741;
export const height = 497;
export const examples = {near: [410,350], far: [90,100], edge: [470,80]};
export function depth(disparity) {
  const denominator = disparity + 32.778;
  return denominator > 0 ? 999.421 * 0.193001 / denominator : null;
}
export function reference(map,x,y) {
  const value = map.getUint16(2*(y*width+x),true);
  if (value === 65535) return {kind:'unknown'};
  if (value === 65534) return {kind:'occluded'};
  return {kind:'visible', disparity:value/256};
}
