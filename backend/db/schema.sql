create table if not exists report_requests (
  id text primary key,
  author_device_id text,
  question text not null,
  place text not null,
  distance text,
  time_label text,
  answers integer not null default 0,
  latitude double precision,
  longitude double precision,
  cluster_latitude double precision,
  cluster_longitude double precision,
  privacy_radius_meters integer not null default 1500,
  status text not null default 'open',
  hint text,
  mark text,
  accent text,
  source text not null default 'api',
  last_answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create table if not exists field_reports (
  id text primary key,
  request_id text references report_requests(id) on delete set null,
  author_device_id text,
  place text not null,
  time_label text,
  condition text not null,
  body text not null,
  latitude double precision,
  longitude double precision,
  cluster_latitude double precision,
  cluster_longitude double precision,
  privacy_radius_meters integer not null default 1500,
  moderation_status text not null default 'visible',
  source text not null default 'api',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

alter table report_requests add column if not exists author_device_id text;
alter table report_requests add column if not exists latitude double precision;
alter table report_requests add column if not exists longitude double precision;
alter table report_requests add column if not exists cluster_latitude double precision;
alter table report_requests add column if not exists cluster_longitude double precision;
alter table report_requests add column if not exists privacy_radius_meters integer not null default 1500;

alter table field_reports add column if not exists request_id text references report_requests(id) on delete set null;
alter table field_reports add column if not exists author_device_id text;
alter table field_reports add column if not exists latitude double precision;
alter table field_reports add column if not exists longitude double precision;
alter table field_reports add column if not exists cluster_latitude double precision;
alter table field_reports add column if not exists cluster_longitude double precision;
alter table field_reports add column if not exists privacy_radius_meters integer not null default 1500;

update report_requests
set
  cluster_latitude = coalesce(
    cluster_latitude,
    (round((latitude / 0.015)::numeric) * 0.015)::double precision
  ),
  cluster_longitude = coalesce(
    cluster_longitude,
    (round((longitude / 0.015)::numeric) * 0.015)::double precision
  ),
  latitude = null,
  longitude = null
where latitude is not null or longitude is not null;

update field_reports
set
  cluster_latitude = coalesce(
    cluster_latitude,
    (round((latitude / 0.015)::numeric) * 0.015)::double precision
  ),
  cluster_longitude = coalesce(
    cluster_longitude,
    (round((longitude / 0.015)::numeric) * 0.015)::double precision
  ),
  latitude = null,
  longitude = null
where latitude is not null or longitude is not null;

create table if not exists moderation_events (
  id text primary key,
  target_type text not null,
  target_id text not null,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_report_requests_visible_time
  on report_requests (created_at desc)
  where deleted_at is null;

create index if not exists idx_report_requests_cluster
  on report_requests (cluster_latitude, cluster_longitude)
  where deleted_at is null;

create index if not exists idx_field_reports_visible_time
  on field_reports (created_at desc)
  where deleted_at is null and moderation_status <> 'hidden';

create index if not exists idx_field_reports_request
  on field_reports (request_id, created_at desc)
  where deleted_at is null and moderation_status <> 'hidden';

create index if not exists idx_field_reports_cluster
  on field_reports (cluster_latitude, cluster_longitude)
  where deleted_at is null and moderation_status <> 'hidden';
