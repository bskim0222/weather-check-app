import type { LocalReport } from '../types/weather';

export function visibleReportsOnly(reports: LocalReport[]) {
  return reports.filter((report) => report.moderationStatus !== 'hidden' && !isMockOrSeedReport(report));
}

export function removeMockOrSeedReports(reports: LocalReport[]) {
  return reports.filter((report) => !isMockOrSeedReport(report));
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

function isMockOrSeedReport(report: LocalReport) {
  if (report.source === 'mock') return true;

  const seedIds = new Set([
    'seed-report-jamsil-north',
    'seed-report-sports-complex-exit-6',
  ]);
  if (report.id && seedIds.has(report.id)) return true;

  const seedPlaces = ['잠실운동장 북문', '종합운동장역 6번 출구'];
  const seedBodies = [
    '바닥은 조금 젖었는데 지금은 안 내려요.',
    '우산 든 사람은 많지만 아직 비는 없어요.',
  ];

  return seedPlaces.includes(report.place) && seedBodies.includes(report.body);
}
