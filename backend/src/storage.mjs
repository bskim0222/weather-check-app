import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(rootDir, 'data');
const databasePath = join(dataDir, 'weather-check-db.json');
const schemaPath = join(rootDir, 'db', 'schema.sql');
const maxFieldReports = 200;
const maxReportRequests = 100;
const maxModerationEvents = 300;
let pgPool;
let pgSchemaReady = false;

export const storageLimits = {
  maxFieldReports,
  maxReportRequests,
  maxModerationEvents,
};

export async function readDatabase() {
  if (shouldUsePostgresStorage()) {
    return readPostgresDatabase();
  }

  await mkdir(dataDir, { recursive: true });

  try {
    const raw = await readFile(databasePath, 'utf8');

    return normalizeDatabase(JSON.parse(raw));
  } catch {
    return createEmptyDatabase();
  }
}

export async function writeDatabase(database) {
  if (shouldUsePostgresStorage()) {
    await writePostgresDatabase(compactDatabase(normalizeDatabase(database)));
    return;
  }

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

function shouldUsePostgresStorage() {
  const mode = process.env.REPORT_STORAGE_MODE;

  return mode === 'postgres' || (!mode && Boolean(process.env.DATABASE_URL));
}

async function readPostgresDatabase() {
  const pool = await getPostgresPool();
  await ensurePostgresSchema(pool);

  const [fieldReportsResult, reportRequestsResult, moderationEventsResult] = await Promise.all([
    pool.query(`
      select
        id,
        request_id,
        author_device_id,
        place,
        time_label,
        condition,
        body,
        latitude,
        longitude,
        cluster_latitude,
        cluster_longitude,
        privacy_radius_meters,
        moderation_status,
        source,
        created_at,
        updated_at,
        deleted_at
      from field_reports
      where deleted_at is null
      order by created_at desc
      limit $1
    `, [maxFieldReports]),
    pool.query(`
      with answer_stats as (
        select
          request_id,
          count(*)::int as answer_count,
          max(created_at) as last_answered_at
        from field_reports
        where request_id is not null
          and deleted_at is null
          and moderation_status <> 'hidden'
        group by request_id
      )
      select
        report_requests.id,
        report_requests.author_device_id,
        report_requests.question,
        report_requests.place,
        report_requests.distance,
        report_requests.time_label,
        greatest(report_requests.answers, coalesce(answer_stats.answer_count, 0)) as answers,
        report_requests.latitude,
        report_requests.longitude,
        report_requests.cluster_latitude,
        report_requests.cluster_longitude,
        report_requests.privacy_radius_meters,
        report_requests.status,
        report_requests.hint,
        report_requests.mark,
        report_requests.accent,
        report_requests.source,
        coalesce(answer_stats.last_answered_at, report_requests.last_answered_at) as last_answered_at,
        report_requests.created_at,
        report_requests.updated_at,
        report_requests.deleted_at
      from report_requests
      left join answer_stats on answer_stats.request_id = report_requests.id
      where report_requests.deleted_at is null
      order by report_requests.created_at desc
      limit $1
    `, [maxReportRequests]),
    pool.query(`
      select id, target_type, target_id, action, reason, created_at
      from moderation_events
      order by created_at desc
      limit $1
    `, [maxModerationEvents]),
  ]);

  return normalizeDatabase({
    fieldReports: fieldReportsResult.rows.map(mapFieldReportRow),
    reportRequests: reportRequestsResult.rows.map(mapReportRequestRow),
    moderationEvents: moderationEventsResult.rows.map(mapModerationEventRow),
  });
}

async function writePostgresDatabase(database) {
  const pool = await getPostgresPool();
  await ensurePostgresSchema(pool);
  const client = await pool.connect();

  try {
    await client.query('begin');
    await syncFieldReports(client, database.fieldReports);
    await syncReportRequests(client, database.reportRequests);
    await syncModerationEvents(client, database.moderationEvents);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function getPostgresPool() {
  if (pgPool) return pgPool;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when REPORT_STORAGE_MODE=postgres.');
  }

  const { Pool } = await import('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: shouldUsePostgresSsl() ? { rejectUnauthorized: false } : undefined,
  });

  return pgPool;
}

function shouldUsePostgresSsl() {
  return process.env.DATABASE_SSL === 'false' ? false : true;
}

async function ensurePostgresSchema(pool) {
  if (pgSchemaReady) return;

  const schemaSql = await readFile(schemaPath, 'utf8');
  await pool.query(schemaSql);
  pgSchemaReady = true;
}

async function syncFieldReports(client, reports) {
  const ids = reports.map((report) => report.id).filter(Boolean);

  if (ids.length > 0) {
    await client.query(
      'update field_reports set deleted_at = now() where deleted_at is null and not (id = any($1::text[]))',
      [ids],
    );
  } else {
    await client.query('update field_reports set deleted_at = now() where deleted_at is null');
  }

  for (const report of reports) {
    await client.query(
      `
        insert into field_reports (
          id, request_id, place, time_label, condition, body, moderation_status, source, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9::timestamptz, now()), $10::timestamptz)
        on conflict (id) do update set
          request_id = excluded.request_id,
          place = excluded.place,
          time_label = excluded.time_label,
          condition = excluded.condition,
          body = excluded.body,
          moderation_status = excluded.moderation_status,
          source = excluded.source,
          updated_at = coalesce(excluded.updated_at, now()),
          deleted_at = null
      `,
      [
        report.id,
        report.requestId ?? null,
        textOr(report.place, '현재 위치 주변'),
        textOr(report.time, '방금'),
        textOr(report.condition, '날씨 확인'),
        textOr(report.body, ''),
        report.moderationStatus ?? 'visible',
        report.source ?? 'api',
        report.createdAt ?? null,
        report.updatedAt ?? null,
      ],
    );
  }
}

async function syncReportRequests(client, requests) {
  const ids = requests.map((requestItem) => requestItem.id).filter(Boolean);

  if (ids.length > 0) {
    await client.query(
      'update report_requests set deleted_at = now() where deleted_at is null and not (id = any($1::text[]))',
      [ids],
    );
  } else {
    await client.query('update report_requests set deleted_at = now() where deleted_at is null');
  }

  for (const requestItem of requests) {
    await client.query(
      `
        insert into report_requests (
          id, question, place, distance, time_label, answers, status, hint, mark, accent, source,
          last_answered_at, created_at, updated_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12::timestamptz, coalesce($13::timestamptz, now()), $14::timestamptz
        )
        on conflict (id) do update set
          question = excluded.question,
          place = excluded.place,
          distance = excluded.distance,
          time_label = excluded.time_label,
          answers = excluded.answers,
          status = excluded.status,
          hint = excluded.hint,
          mark = excluded.mark,
          accent = excluded.accent,
          source = excluded.source,
          last_answered_at = excluded.last_answered_at,
          updated_at = coalesce(excluded.updated_at, now()),
          deleted_at = null
      `,
      [
        requestItem.id,
        textOr(requestItem.question, `${textOr(requestItem.place, '현재 위치 주변')} 지금 날씨 어때요?`),
        textOr(requestItem.place, '현재 위치 주변'),
        textOr(requestItem.distance, '근처'),
        textOr(requestItem.time, '방금'),
        Number.isFinite(requestItem.answers) ? requestItem.answers : 0,
        textOr(requestItem.status, '답변 대기'),
        textOr(requestItem.hint, '근처 사용자에게 현장 제보를 요청합니다.'),
        textOr(requestItem.mark, '요'),
        textOr(requestItem.accent, '#d6d2c4'),
        requestItem.source ?? 'api',
        requestItem.lastAnsweredAt ?? null,
        requestItem.createdAt ?? null,
        requestItem.updatedAt ?? null,
      ],
    );
  }
}

async function syncModerationEvents(client, events) {
  for (const event of events) {
    await client.query(
      `
        insert into moderation_events (id, target_type, target_id, action, reason, created_at)
        values ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()))
        on conflict (id) do nothing
      `,
      [
        event.id,
        textOr(event.targetType, event.reportId ? 'field_report' : 'field_report'),
        textOr(event.targetId, event.reportId ?? ''),
        textOr(event.action, event.moderationStatus ?? 'reported'),
        textOr(event.reason, ''),
        event.createdAt ?? null,
      ],
    );
  }
}

function mapFieldReportRow(row) {
  return {
    id: row.id,
    requestId: row.request_id ?? undefined,
    place: row.place,
    time: row.time_label ?? '방금',
    condition: row.condition,
    body: row.body,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    moderationStatus: row.moderation_status ?? 'visible',
    source: row.source ?? 'api',
  };
}

function mapReportRequestRow(row) {
  return {
    id: row.id,
    question: row.question,
    hint: row.hint ?? '',
    place: row.place,
    distance: row.distance ?? '근처',
    answers: Number.isFinite(row.answers) ? row.answers : 0,
    time: row.time_label ?? '방금',
    status: row.status ?? '답변 대기',
    mark: row.mark ?? '요',
    accent: row.accent ?? '#d6d2c4',
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    lastAnsweredAt: toIso(row.last_answered_at),
    source: row.source ?? 'api',
  };
}

function mapModerationEventRow(row) {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    action: row.action,
    reason: row.reason ?? '',
    createdAt: toIso(row.created_at),
  };
}

function toIso(value) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);

  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function textOr(value, fallback) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}
