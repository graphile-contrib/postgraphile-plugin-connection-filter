drop schema if exists a cascade;

create schema a;

create table a.filterable (
  id serial primary key,
  "string" text,
  "int" int,
  "real" real,
  "numeric" numeric,
  "boolean" boolean,
  "jsonb" jsonb
);

create function a.filterable_computed(filterable a.filterable) returns text as $$
  select filterable.string || ' computed'
$$ language sql stable;