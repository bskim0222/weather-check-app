import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(rootDir, 'data');
const databasePath = join(dataDir, 'weather-check-db.json');
const maxFieldReports = 200;
const maxReportRequests = 100;
const maxModerationEvents = 300;

export const storageLimits = {
  maxFieldReports,
  maxReportRequests,
  maxModerationEvents,
};

export async function readDatabase() {
  await mkdir(dataDir, { recursive: true });

  try {
    const raw = await readFile(databasePath, 'utf8');

    return normalizeDatabase(JSON.parse(raw));
  } catch {
    return createEmptyDatabase();
  }
}

export async function writeDatabase(database) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(databasePath, JSON.stringify(compactDatabase(normalizeDatabase(database)), null, 2), 'utf8');
}

export function createEmptyDatabase() {
  return {
    fieldReports: [],
    reportRequests: [],
    moderationEvents: [],
  };
}

function normalizeDatabase(database) {
  return {
    fieldReports: Array.isArray(database?.fieldReports) ? database.fieldReports : [],
    reportRequests: Array.isArray(database?.reportRequests) ? database.reportRequests : [],
    moderationEvents: Array.isArray(database?.moderationEvents) ? database.moderationEvents : [],
  };
}

export function compactDatabase(database) {
  return {
    fieldReports: sortByCreatedAt(database.fieldReports).slice(0, maxFieldReports),
    reportRequests: sortByCreatedAt(database.reportRequests).slice(0, maxReportRequests),
    moderationEvents: sortByCreatedAt(database.moderationEvents).slice(0, maxModerationEvents),
  };
}

function sortByCreatedAt(items) {
  return [...items].sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
}

function getTime(value) {
  const time = Date.parse(value);

  return Number.isFinite(time) ? time : 0;
}
