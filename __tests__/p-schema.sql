drop schema if exists p cascade;

create schema p;

create table p.parent (
  id serial primary key,
  "name" text not null
);

create table p.forward (
  id serial primary key,
  "name" text not null
);

create table p.filterable (
  id serial primary key,
  "string" text,
  "int" int,
  "real" real,
  "numeric" numeric,
  "boolean" boolean,
  "jsonb" jsonb,
  "int_array" int[],
  "inet" inet,
  "parent_id" int references p.parent (id),
  "forward_id" int unique references p.forward (id)
);

comment on column p.filterable.real is E'@omit filter';

create table p.backward (
  id serial primary key,
  "name" text not null,
  "filterable_id" int unique references p.filterable (id)
);

create table p.child (
  id serial primary key,
  "name" text not null,
  "filterable_id" int references p.filterable (id)
);

create table p.unfilterable (
  id serial primary key,
  "string" text
);

comment on table p.unfilterable is E'@omit filter';

create function p.filterable_computed(filterable p.filterable) returns text as $$
  select filterable.string || ' computed'
$$ language sql stable;

create function p.filterable_computed2(filterable p.filterable) returns text as $$
  select filterable.string || ' computed2'
$$ language sql stable;

comment on function p.filterable_computed2(p.filterable) is E'@omit filter';