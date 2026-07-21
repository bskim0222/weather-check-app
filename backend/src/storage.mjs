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
const maxOwnedItems = 500;
let pgPool;
let pgSchemaReady = false;

export const storageLimits = {
  maxFieldReports,
  maxReportRequests,
  maxModerationEvents,
};

export async function getStorageStatus() {
  const mode = shouldUsePostgresStorage() ? 'postgres' : 'json';

  try {
    if (mode === 'postgres') {
      const pool = await getPostgresPool();
      await ensurePostgresSchema(pool);
      await pool.query('select 1 as ok');
    } else {
      await readDatabase();
    }

    return { ok: true, mode };
  } catch (error) {
    return {
      ok: false,
      mode,
      error: error instanceof Error ? error.message : 'Storage check failed.',
    };
  }
}

export async function readDatabase(options = {}) {
  if (shouldUsePostgresStorage()) {
    return readPostgresDatabase(options);
  }

  await mkdir(dataDir, { recursive: true });

  try {
    const raw = await readFile(databasePath, 'utf8');

    return normalizeDatabase(JSON.parse(raw));
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return createEmptyDatabase();
    }
    throw error;
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

export async function findFieldReportById(reportId) {
  if (shouldUsePostgresStorage()) {
    const pool = await getPostgresPool();
    await ensurePostgresSchema(pool);
    const result = await pool.query(
      `
        select
          id, request_id, author_device_id, place, time_label, condition, body,
          latitude, longitude, cluster_latitude, cluster_longitude, privacy_radius_meters,
          moderation_status, source, created_at, updated_at, deleted_at
        from field_reports
        where id = $1 and deleted_at is null
      `,
      [reportId],
    );

    return result.rows[0] ? mapFieldReportRow(result.rows[0]) : null;
  }

  const database = await readDatabase();

  return database.fieldReports.find((report) => report.id === reportId) ?? null;
}

export async function saveFieldReport(report) {
  if (shouldUsePostgresStorage()) {
    const pool = await getPostgresPool();
    await ensurePostgresSchema(pool);
    const client = await pool.connect();

    try {
      await client.query('begin');
      await upsertFieldReportQuery(client, report);
      if (report.requestId) await refreshReportRequestAnswerStats(client, report.requestId);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    return findFieldReportById(report.id);
  }

  const database = await readDatabase();
  database.fieldReports = upsertById(database.fieldReports, report);
  if (report.requestId) refreshJsonRequestAnswerStats(database, report.requestId);
  await writeDatabase(database);

  return report;
}

export async function updateFieldReportById(reportId, updates) {
  if (shouldUsePostgresStorage()) {
    const pool = await getPostgresPool();
    await ensurePostgresSchema(pool);
    const result = await pool.query(
      `
        update field_reports
        set
          condition = coalesce($2, condition),
          body = coalesce($3, body),
          updated_at = now()
        where id = $1 and deleted_at is null
        returning id
      `,
      [reportId, updates.condition ?? null, updates.body ?? null],
    );

    return result.rowCount > 0 ? findFieldReportById(reportId) : null;
  }

  const existingReport = await findFieldReportById(reportId);

  if (!existingReport) return null;

  const updatedReport = {
    ...existingReport,
    condition: textOr(updates.condition, existingReport.condition),
    body: textOr(updates.body, existingReport.body),
    updatedAt: new Date().toISOString(),
  };

  return saveFieldReport(updatedReport);
}

export async function deleteFieldReportById(reportId) {
  if (shouldUsePostgresStorage()) {
    const pool = await getPostgresPool();
    await ensurePostgresSchema(pool);
    const client = await pool.connect();

    try {
      await client.query('begin');
      const result = await client.query(
        `
          update field_reports
          set deleted_at = now(), updated_at = now()
          where id = $1 and deleted_at is null
          returning request_id
        `,
        [reportId],
      );
      const requestId = result.rows[0]?.request_id;
      if (requestId) await refreshReportRequestAnswerStats(client, requestId);
      await client.query('commit');

      return result.rowCount > 0;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  const database = await readDatabase();
  const deletedReport = database.fieldReports.find((report) => report.id === reportId);
  const beforeCount = database.fieldReports.length;
  database.fieldReports = database.fieldReports.filter((report) => report.id !== reportId);
  if (deletedReport?.requestId) refreshJsonRequestAnswerStats(database, deletedReport.requestId);
  await writeDatabase(database);

  return database.fieldReports.length !== beforeCount;
}

export async function findReportRequestById(requestId) {
  if (shouldUsePostgresStorage()) {
    const pool = await getPostgresPool();
    await ensurePostgresSchema(pool);
    const result = await pool.query(
      `
        select
          id, author_device_id, question, place, distance, time_label, answers,
          latitude, longitude, cluster_latitude, cluster_longitude, privacy_radius_meters,
          status, hint, mark, accent, source, last_answered_at, created_at, updated_at, deleted_at
        from report_requests
        where id = $1 and deleted_at is null
      `,
      [requestId],
    );

    return result.rows[0] ? mapReportRequestRow(result.rows[0]) : null;
  }

  const database = await readDatabase();

  return database.reportRequests.find((requestItem) => requestItem.id === requestId) ?? null;
}

export async function saveReportRequest(requestItem) {
  if (shouldUsePostgresStorage()) {
    const pool = await getPostgresPool();
    await ensurePostgresSchema(pool);
    await upsertReportRequestQuery(pool, requestItem);

    return findReportRequestById(requestItem.id);
  }

  const database = await readDatabase();
  database.reportRequests = upsertById(database.reportRequests, requestItem);
  await writeDatabase(database);

  return requestItem;
}

export async function updateReportRequestById(requestId, updates) {
  if (shouldUsePostgresStorage()) {
    const pool = await getPostgresPool();
    await ensurePostgresSchema(pool);
    const result = await pool.query(
      `
        update report_requests
        set question = coalesce($2, question), updated_at = now()
        where id = $1 and deleted_at is null
        returning id
      `,
      [requestId, updates.question ?? null],
    );

    return result.rowCount > 0 ? findReportRequestById(requestId) : null;
  }

  const existingRequest = await findReportRequestById(requestId);

  if (!existingRequest) return null;

  const updatedRequest = {
    ...existingRequest,
    question: textOr(updates.question, existingRequest.question),
    updatedAt: new Date().toISOString(),
  };

  return saveReportRequest(updatedRequest);
}

export async function deleteReportRequestById(requestId) {
  if (shouldUsePostgresStorage()) {
    const pool = await getPostgresPool();
    await ensurePostgresSchema(pool);
    const client = await pool.connect();

    try {
      await client.query('begin');
      const result = await client.query(
        'update report_requests set deleted_at = now(), updated_at = now() where id = $1 and deleted_at is null',
        [requestId],
      );
      await client.query(
        'update field_reports set deleted_at = now(), updated_at = now() where request_id = $1 and deleted_at is null',
        [requestId],
      );
      await client.query('commit');

      return result.rowCount > 0;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  const database = await readDatabase();
  const beforeCount = database.reportRequests.length;
  database.reportRequests = database.reportRequests.filter((requestItem) => requestItem.id !== requestId);
  database.fieldReports = database.fieldReports.filter((report) => report.requestId !== requestId);
  await writeDatabase(database);

  return database.reportRequests.length !== beforeCount;
}

export async function updateReportRequestAnswerStatus(requestId, updates) {
  if (shouldUsePostgresStorage()) {
    const pool = await getPostgresPool();
    await ensurePostgresSchema(pool);
    await refreshReportRequestAnswerStats(
      pool,
      requestId,
      textOr(updates.status, '답변 있음'),
      textOr(updates.hint, '방금 답변이 추가됐어요.'),
    );

    return findReportRequestById(requestId);
  }

  const database = await readDatabase();
  const existingRequest = database.reportRequests.find((requestItem) => requestItem.id === requestId);

  if (!existingRequest) return null;

  refreshJsonRequestAnswerStats(
    database,
    requestId,
    textOr(updates.status, '답변 있음'),
    textOr(updates.hint, '방금 답변이 추가됐어요.'),
  );
  await writeDatabase(database);

  return database.reportRequests.find((requestItem) => requestItem.id === requestId) ?? null;
}

export async function moderateFieldReportById(reportId, moderationStatus, reason) {
  const status = ['visible', 'pending', 'hidden'].includes(moderationStatus)
    ? moderationStatus
    : 'pending';

  if (shouldUsePostgresStorage()) {
    const pool = await getPostgresPool();
    await ensurePostgresSchema(pool);
    const client = await pool.connect();

    try {
      await client.query('begin');
      const updatedReport = await client.query(
        `
          update field_reports
          set moderation_status = $2, updated_at = now()
          where id = $1 and deleted_at is null
          returning request_id
        `,
        [reportId, status],
      );
      if (updatedReport.rowCount === 0) {
        await client.query('rollback');
        return null;
      }
      await client.query(
        `
          insert into moderation_events (id, target_type, target_id, action, reason, created_at)
          values ($1, 'field_report', $2, $3, $4, now())
        `,
        [createStorageId('moderation'), reportId, status, textOr(reason, '')],
      );
      const requestId = updatedReport.rows[0]?.request_id;
      if (requestId) await refreshReportRequestAnswerStats(client, requestId);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    return { ok: true, reportId, moderationStatus: status };
  }

  const database = await readDatabase();
  const moderatedReport = database.fieldReports.find((report) => report.id === reportId);
  if (!moderatedReport) return null;
  database.fieldReports = database.fieldReports.map((report) =>
    report.id === reportId ? { ...report, moderationStatus: status } : report,
  );
  if (moderatedReport?.requestId) refreshJsonRequestAnswerStats(database, moderatedReport.requestId);
  database.moderationEvents.unshift({
    id: createStorageId('moderation'),
    reportId,
    moderationStatus: status,
    reason: textOr(reason, ''),
    createdAt: new Date().toISOString(),
  });
  await writeDatabase(database);

  return { ok: true, reportId, moderationStatus: status };
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

async function readPostgresDatabase(options = {}) {
  const pool = await getPostgresPool();
  await ensurePostgresSchema(pool);
  const ownerDeviceId = typeof options.ownerDeviceId === 'string'
    ? options.ownerDeviceId.trim()
    : '';
  const fieldReportParams = ownerDeviceId
    ? [maxFieldReports, ownerDeviceId, maxFieldReports + maxOwnedItems]
    : [maxFieldReports];
  const reportRequestParams = ownerDeviceId
    ? [maxReportRequests, ownerDeviceId, maxReportRequests + maxOwnedItems]
    : [maxReportRequests];
  const fieldReportSelection = ownerDeviceId
    ? `
      where deleted_at is null
        and (
          author_device_id = $2
          or id in (
            select id
            from field_reports
            where deleted_at is null
            order by created_at desc
            limit $1
          )
        )
      order by created_at desc
      limit $3
    `
    : `
      where deleted_at is null
      order by created_at desc
      limit $1
    `;
  const reportRequestSelection = ownerDeviceId
    ? `
      where report_requests.deleted_at is null
        and (
          report_requests.author_device_id = $2
          or report_requests.id in (
            select id
            from report_requests
            where deleted_at is null
            order by created_at desc
            limit $1
          )
        )
      order by report_requests.created_at desc
      limit $3
    `
    : `
      where report_requests.deleted_at is null
      order by report_requests.created_at desc
      limit $1
    `;

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
      ${fieldReportSelection}
    `, fieldReportParams),
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
        coalesce(answer_stats.answer_count, 0) as answers,
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
      ${reportRequestSelection}
    `, reportRequestParams),
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
  for (const report of reports) {
    await upsertFieldReportQuery(client, report);
  }
}

async function syncReportRequests(client, requests) {
  for (const requestItem of requests) {
    await upsertReportRequestQuery(client, requestItem);
  }
}

async function upsertFieldReportQuery(clientOrPool, report) {
  return clientOrPool.query(
    `
      insert into field_reports (
        id, request_id, author_device_id, place, time_label, condition, body,
        cluster_latitude, cluster_longitude, privacy_radius_meters,
        moderation_status, source, created_at, updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12, coalesce($13::timestamptz, now()), $14::timestamptz
      )
      on conflict (id) do update set
        request_id = excluded.request_id,
        author_device_id = coalesce(field_reports.author_device_id, excluded.author_device_id),
        place = excluded.place,
        time_label = excluded.time_label,
        condition = excluded.condition,
        body = excluded.body,
        cluster_latitude = excluded.cluster_latitude,
        cluster_longitude = excluded.cluster_longitude,
        privacy_radius_meters = excluded.privacy_radius_meters,
        moderation_status = excluded.moderation_status,
        source = excluded.source,
        updated_at = coalesce(excluded.updated_at, now()),
        deleted_at = null
      where field_reports.deleted_at is null
    `,
    [
      report.id,
      report.requestId ?? null,
      report.authorDeviceId ?? null,
      textOr(report.place, '현재 위치 주변'),
      textOr(report.time, '방금'),
      textOr(report.condition, '날씨 확인'),
      textOr(report.body, ''),
      finiteNumberOrNull(report.clusterLatitude),
      finiteNumberOrNull(report.clusterLongitude),
      Number.isFinite(report.privacyRadiusMeters) ? report.privacyRadiusMeters : 1500,
      report.moderationStatus ?? 'visible',
      report.source ?? 'api',
      report.createdAt ?? null,
      report.updatedAt ?? null,
    ],
  );
}

async function upsertReportRequestQuery(clientOrPool, requestItem) {
  return clientOrPool.query(
    `
      insert into report_requests (
        id, author_device_id, question, place, distance, time_label, answers,
        cluster_latitude, cluster_longitude, privacy_radius_meters,
        status, hint, mark, accent, source, last_answered_at, created_at, updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16::timestamptz, coalesce($17::timestamptz, now()), $18::timestamptz
      )
      on conflict (id) do update set
        author_device_id = coalesce(report_requests.author_device_id, excluded.author_device_id),
        question = excluded.question,
        place = excluded.place,
        distance = excluded.distance,
        time_label = excluded.time_label,
        answers = excluded.answers,
        cluster_latitude = excluded.cluster_latitude,
        cluster_longitude = excluded.cluster_longitude,
        privacy_radius_meters = excluded.privacy_radius_meters,
        status = excluded.status,
        hint = excluded.hint,
        mark = excluded.mark,
        accent = excluded.accent,
        source = excluded.source,
        last_answered_at = excluded.last_answered_at,
        updated_at = coalesce(excluded.updated_at, now()),
        deleted_at = null
      where report_requests.deleted_at is null
    `,
    [
      requestItem.id,
      requestItem.authorDeviceId ?? null,
      textOr(requestItem.question, `${textOr(requestItem.place, '현재 위치 주변')} 지금 날씨 어때요?`),
      textOr(requestItem.place, '현재 위치 주변'),
      textOr(requestItem.distance, '근처'),
      textOr(requestItem.time, '방금'),
      Number.isFinite(requestItem.answers) ? requestItem.answers : 0,
      finiteNumberOrNull(requestItem.clusterLatitude),
      finiteNumberOrNull(requestItem.clusterLongitude),
      Number.isFinite(requestItem.privacyRadiusMeters) ? requestItem.privacyRadiusMeters : 1500,
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
    authorDeviceId: row.author_device_id ?? undefined,
    place: row.place,
    time: row.time_label ?? '방금',
    condition: row.condition,
    body: row.body,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    moderationStatus: row.moderation_status ?? 'visible',
    source: row.source ?? 'api',
    clusterLatitude: finiteNumberOrUndefined(row.cluster_latitude),
    clusterLongitude: finiteNumberOrUndefined(row.cluster_longitude),
    privacyRadiusMeters: Number(row.privacy_radius_meters) || 1500,
  };
}

function mapReportRequestRow(row) {
  return {
    id: row.id,
    authorDeviceId: row.author_device_id ?? undefined,
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
    clusterLatitude: finiteNumberOrUndefined(row.cluster_latitude),
    clusterLongitude: finiteNumberOrUndefined(row.cluster_longitude),
    privacyRadiusMeters: Number(row.privacy_radius_meters) || 1500,
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

async function refreshReportRequestAnswerStats(
  clientOrPool,
  requestId,
  answeredStatus = '답변 있음',
  answeredHint = '현장 답변이 도착했어요.',
) {
  const result = await clientOrPool.query(
    `
      with answer_stats as (
        select
          count(*)::int as answer_count,
          max(created_at) as last_answered_at
        from field_reports
        where request_id = $1
          and deleted_at is null
          and moderation_status <> 'hidden'
      )
      update report_requests
      set
        answers = answer_stats.answer_count,
        status = case when answer_stats.answer_count > 0 then $2 else '답변 대기' end,
        hint = case when answer_stats.answer_count > 0 then $3 else '현장 답변을 기다리는 중' end,
        last_answered_at = answer_stats.last_answered_at,
        updated_at = now()
      from answer_stats
      where report_requests.id = $1
        and report_requests.deleted_at is null
      returning report_requests.id
    `,
    [requestId, answeredStatus, answeredHint],
  );

  return result.rowCount > 0;
}

function refreshJsonRequestAnswerStats(
  database,
  requestId,
  answeredStatus = '답변 있음',
  answeredHint = '현장 답변이 도착했어요.',
) {
  const answers = database.fieldReports.filter(
    (report) =>
      report.requestId === requestId &&
      report.moderationStatus !== 'hidden',
  );
  const latestAnswer = sortByCreatedAt(answers)[0];

  database.reportRequests = database.reportRequests.map((requestItem) =>
    requestItem.id === requestId
      ? {
          ...requestItem,
          answers: answers.length,
          status: answers.length > 0 ? answeredStatus : '답변 대기',
          hint: answers.length > 0 ? answeredHint : '현장 답변을 기다리는 중',
          lastAnsweredAt: latestAnswer?.createdAt,
          updatedAt: new Date().toISOString(),
        }
      : requestItem,
  );
}

function toIso(value) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);

  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function textOr(value, fallback) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function finiteNumberOrNull(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function finiteNumberOrUndefined(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}

function upsertById(items, nextItem) {
  return [
    nextItem,
    ...items.filter((item) => item.id !== nextItem.id),
  ];
}

function createStorageId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
