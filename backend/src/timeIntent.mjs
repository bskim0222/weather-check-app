const oneHourMs = 60 * 60 * 1000;

export function getTargetTimestampMs(context, now = new Date()) {
  const text = `${context?.timeLabel ?? ''} ${context?.raw ?? ''}`;
  const hasExplicitTime =
    /내일|모레|오늘|주말|오전|오후|저녁|퇴근|밤|새벽|아침|점심|낮/.test(text);

  if (!hasExplicitTime) return null;

  const dayOffset = getDayOffset(text, now);
  const hour = getTargetHour(text);
  const parts = getSeoulParts(now);

  return Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset, hour - 9, 0, 0);
}

export function getForecastWindow(items, getTimeMs, targetMs, limit = 8) {
  const normalized = items
    .map((item) => ({ item, timeMs: getTimeMs(item) }))
    .filter((row) => Number.isFinite(row.timeMs))
    .sort((a, b) => a.timeMs - b.timeMs);

  if (normalized.length === 0) return items.slice(0, limit);
  if (!Number.isFinite(targetMs)) return normalized.slice(0, limit).map((row) => row.item);

  const startIndex = findForecastStartIndex(normalized, targetMs);

  return normalized.slice(startIndex, startIndex + limit).map((row) => row.item);
}

export function pickTargetItem(items, getTimeMs, targetMs) {
  const window = getForecastWindow(items, getTimeMs, targetMs, 1);

  return window[0] ?? items[0];
}

export function getSeoulParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    hour: Number(value.hour),
  };
}

function getDayOffset(text, now) {
  if (text.includes('모레')) return 2;
  if (text.includes('내일')) return 1;
  if (text.includes('주말')) return getWeekendOffset(now);

  return 0;
}

function getTargetHour(text) {
  if (text.includes('새벽')) return 6;
  if (text.includes('아침') || text.includes('오전')) return 9;
  if (text.includes('점심') || text.includes('낮')) return 12;
  if (text.includes('오후')) return 15;
  if (text.includes('퇴근') || text.includes('저녁')) return 18;
  if (text.includes('밤')) return 21;

  return 12;
}

function getWeekendOffset(now) {
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(now);
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayName);

  if (dayIndex === -1) return 0;
  if (dayIndex === 0) return 0;

  return 6 - dayIndex;
}

function findForecastStartIndex(rows, targetMs) {
  const thresholdMs = targetMs - oneHourMs;
  const futureIndex = rows.findIndex((row) => row.timeMs >= thresholdMs);

  if (futureIndex >= 0) return futureIndex;

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  rows.forEach((row, index) => {
    const distance = Math.abs(row.timeMs - targetMs);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}
