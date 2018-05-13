drop schema if exists p cascade;

create schema p;

create table p.filterable (
  id serial primary key,
  "string" text,
  "int" int,
  "real" real,
  "numeric" numeric,
  "boolean" boolean,
  "jsonb" jsonb
);

create function p.filterable_computed(filterable p.filterable) returns text as $$
  select filterable.string || ' computed'
$$ language sql stable;