export function getPinchTargetLevel(
  startLevel: number,
  startDistance: number,
  currentDistance: number,
) {
  if (
    !Number.isFinite(startLevel)
    || !Number.isFinite(startDistance)
    || !Number.isFinite(currentDistance)
    || startDistance <= 0
    || currentDistance <= 0
  ) {
    return startLevel;
  }

  const scale = currentDistance / startDistance;
  const levelDelta = Math.round(Math.log2(scale));
  return Math.max(1, Math.min(14, startLevel - levelDelta));
}
