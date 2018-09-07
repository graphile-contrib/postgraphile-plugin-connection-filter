drop schema if exists p cascade;

create schema p;

create table p.filterable (
  id serial primary key,
  "string" text,
  "int" int,
  "real" real,
  "numeric" numeric,
  "boolean" boolean,
  "jsonb" jsonb,
  "int_array" int[],
  "inet" inet
);

comment on column p.filterable.real is E'@omit filter';

create function p.filterable_computed(filterable p.filterable) returns text as $$
  select filterable.string || ' computed'
$$ language sql stable;

create function p.filterable_computed2(filterable p.filterable) returns text as $$
  select filterable.string || ' computed2'
$$ language sql stable;

comment on function p.filterable_computed2(p.filterable) is E'@omit filter';