import type { CompareRow, SearchContext } from '../types/weather';

export function normalizeHourlyLabels(rows: CompareRow[], searchContext: SearchContext) {
  const baseDate = getForecastBaseDate(searchContext);
  const isCurrentContext = isCurrentForecastContext(searchContext);

  return rows.map((row, index) => ({
    ...row,
    label: row.forecastKey
      ? formatForecastKeyLabel(row.forecastKey, index, isCurrentContext)
      : formatForecastHourLabel(index, baseDate, isCurrentContext),
  }));
}

function formatForecastKeyLabel(key: string, index: number, isCurrentContext: boolean) {
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/);
  if (!match) return key;
  if (index === 0) return isCurrentContext ? '지금' : '기준';

  const [, , month, day, hour] = match;
  const today = getLocalDateKey(new Date());
  const rowDate = `${match[1]}-${month}-${day}`;
  if (rowDate === today) return `${hour}시`;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayLabel = rowDate === getLocalDateKey(tomorrow) ? '내일' : `${Number(month)}/${Number(day)}`;
  return `${dayLabel} ${hour}시`;
}

function getLocalDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatForecastHourLabel(index: number, baseDate: Date, isCurrentContext: boolean) {
  if (index === 0 && isCurrentContext) return '지금';
  if (index === 0) return '기준';

  const itemDate = new Date(baseDate.getTime() + index * 60 * 60 * 1000);
  const hour = `${String(itemDate.getHours()).padStart(2, '0')}시`;

  if (isSameLocalDay(itemDate, baseDate)) return hour;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const dayLabel = isSameLocalDay(itemDate, tomorrow)
    ? '내일'
    : `${itemDate.getMonth() + 1}/${itemDate.getDate()}`;

  return `${dayLabel} ${hour}`;
}

function getForecastBaseDate(searchContext: SearchContext) {
  const now = new Date();
  const clean = `${searchContext.raw} ${searchContext.timeLabel}`.replace(/\s+/g, '');

  if (isCurrentForecastContext(searchContext)) return now;

  const dayOffset = clean.includes('모레') ? 2 : clean.includes('내일') ? 1 : 0;
  const hour = getForecastBaseHour(clean, now.getHours());
  const baseDate = new Date(now);
  baseDate.setDate(now.getDate() + dayOffset);
  baseDate.setHours(hour, 0, 0, 0);

  return baseDate;
}

function isCurrentForecastContext(searchContext: SearchContext) {
  const raw = (searchContext.raw || '').replace(/\s+/g, '');
  const label = (searchContext.timeLabel || '').replace(/\s+/g, '');

  if (searchContext.target.kind === 'current' && (!raw || raw === '현재위치')) return true;
  return label === '지금' || label === '현재';
}

function getForecastBaseHour(cleanLabel: string, fallbackHour: number) {
  const hourMatch = cleanLabel.match(/(\d{1,2})시?/);

  if (hourMatch) {
    const rawHour = Number(hourMatch[1]);

    if (Number.isFinite(rawHour)) return normalizeForecastHour(cleanLabel, rawHour);
  }

  if (cleanLabel.includes('새벽')) return 6;
  if (cleanLabel.includes('아침') || cleanLabel.includes('오전')) return 9;
  if (cleanLabel.includes('점심') || cleanLabel.includes('낮')) return 12;
  if (cleanLabel.includes('오후')) return 15;
  if (cleanLabel.includes('저녁') || cleanLabel.includes('퇴근')) return 18;
  if (cleanLabel.includes('밤')) return 21;

  return fallbackHour;
}

function normalizeForecastHour(cleanLabel: string, rawHour: number) {
  if (rawHour < 0 || rawHour > 24) return new Date().getHours();
  if ((cleanLabel.includes('오후') || cleanLabel.includes('저녁') || cleanLabel.includes('밤')) && rawHour < 12) {
    return rawHour + 12;
  }
  if ((cleanLabel.includes('오전') || cleanLabel.includes('아침') || cleanLabel.includes('새벽')) && rawHour === 12) {
    return 0;
  }

  return rawHour === 24 ? 0 : rawHour;
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
  );
}
