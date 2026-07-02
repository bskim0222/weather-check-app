import { readDatabase, writeDatabase } from '../src/storage.mjs';

const [command, reportId, ...reasonParts] = process.argv.slice(2);
const reason = reasonParts.join(' ').trim();

if (!command || command === 'help') {
  printHelp();
  process.exit(0);
}

const database = await readDatabase();

if (command === 'list') {
  const reports = database.fieldReports.slice(0, 30);

  if (reports.length === 0) {
    console.log('No field reports saved yet.');
    process.exit(0);
  }

  reports.forEach((report) => {
    console.log(
      [
        report.id,
        report.moderationStatus ?? 'visible',
        report.place,
        report.condition,
        report.body,
      ].join(' | '),
    );
  });
  process.exit(0);
}

if (!reportId) {
  throw new Error('Report id is required.');
}

const nextStatus = resolveModerationStatus(command);
const existing = database.fieldReports.find((report) => report.id === reportId);

if (!existing) {
  throw new Error(`Report not found: ${reportId}`);
}

database.fieldReports = database.fieldReports.map((report) =>
  report.id === reportId
    ? {
        ...report,
        moderationStatus: nextStatus,
      }
    : report,
);
database.moderationEvents.unshift({
  id: `moderation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  reportId,
  moderationStatus: nextStatus,
  reason,
  createdAt: new Date().toISOString(),
  source: 'script',
});

await writeDatabase(database);
console.log(`${reportId} -> ${nextStatus}`);

function resolveModerationStatus(value) {
  if (value === 'hide') return 'hidden';
  if (value === 'pending') return 'pending';
  if (value === 'show') return 'visible';

  throw new Error(`Unknown moderation command: ${value}`);
}

function printHelp() {
  console.log(`Usage:
  node scripts/moderate-report.mjs list
  node scripts/moderate-report.mjs hide <report-id> [reason]
  node scripts/moderate-report.mjs pending <report-id> [reason]
  node scripts/moderate-report.mjs show <report-id> [reason]`);
}
