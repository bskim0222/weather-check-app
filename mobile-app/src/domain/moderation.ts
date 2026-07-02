import type { LocalReport } from '../types/weather';

export function visibleReportsOnly(reports: LocalReport[]) {
  return reports.filter((report) => report.moderationStatus !== 'hidden');
}

export function markReportHidden(reports: LocalReport[], reportId: string) {
  return reports.map((report) =>
    report.id === reportId
      ? {
          ...report,
          moderationStatus: 'hidden' as const,
        }
      : report,
  );
}

export function markReportPending(reports: LocalReport[], reportId: string) {
  return reports.map((report) =>
    report.id === reportId
      ? {
          ...report,
          moderationStatus: 'pending' as const,
        }
      : report,
  );
}
