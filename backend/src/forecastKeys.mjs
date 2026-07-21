import { getSeoulParts } from './timeIntent.mjs';

export function getHourlyForecastKey(value) {
  const date = toValidDate(value);
  if (!date) return '';

  const parts = getSeoulParts(date);
  return `${formatYear(parts.year)}-${formatTwo(parts.month)}-${formatTwo(parts.day)}T${formatTwo(parts.hour)}`;
}

export function getDailyForecastKey(value) {
  const date = toValidDate(value);
  if (!date) return '';

  const parts = getSeoulParts(date);
  return `${formatYear(parts.year)}-${formatTwo(parts.month)}-${formatTwo(parts.day)}`;
}

export function getKmaHourlyForecastAt(dateValue, timeValue) {
  const date = String(dateValue ?? '');
  const time = String(timeValue ?? '');
  if (!/^\d{8}$/.test(date) || !/^\d{2,4}$/.test(time)) return '';

  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(4, 6));
  const day = Number(date.slice(6, 8));
  const hour = Number(time.slice(0, 2));
  const value = new Date(Date.UTC(year, month - 1, day, hour - 9, 0, 0));

  return Number.isNaN(value.getTime()) ? '' : value.toISOString();
}

export function getKmaDailyForecastKey(dateValue) {
  const date = String(dateValue ?? '');
  if (!/^\d{8}$/.test(date)) return '';

  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

export function formatHourlyKeyLabel(key) {
  const match = String(key ?? '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/);
  if (!match) return '예보';

  return `${match[2]}/${match[3]} ${match[4]}시`;
}

export function formatDailyKeyLabel(key, index = 0) {
  const match = String(key ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '예보';
  if (index === 0) return '오늘';
  if (index === 1) return '내일';
  if (index === 2) return '모레';

  return `${match[2]}/${match[3]}`;
}

function toValidDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatYear(value) {
  return String(value).padStart(4, '0');
}

function formatTwo(value) {
  return String(value).padStart(2, '0');
}
