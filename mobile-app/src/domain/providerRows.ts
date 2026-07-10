import type { CompareForecastCell, CompareRow } from '../types/weather';

export function getThirdProviderCell(row: CompareRow): CompareForecastCell {
  return row.fmi ?? row.windy;
}

export function normalizeProviderRow(row: CompareRow): CompareRow {
  const third = getThirdProviderCell(row);

  return {
    ...row,
    windy: third,
    fmi: third,
  };
}

export function normalizeProviderRows(rows: CompareRow[] | undefined): CompareRow[] {
  if (!Array.isArray(rows)) return [];

  return rows.map(normalizeProviderRow);
}
