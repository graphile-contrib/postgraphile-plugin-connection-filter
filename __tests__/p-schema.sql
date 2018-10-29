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

create table p.forward_compound (
  forward_compound_1 int,
  forward_compound_2 int,
  "name" text,
  primary key ("forward_compound_1", "forward_compound_2")
);

create type p.mood as enum ('sad', 'ok', 'happy');

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
  "enum" p.mood,
  "parent_id" int references p.parent (id),
  "forward_id" int unique references p.forward (id),
  "forward_compound_1" int,
  "forward_compound_2" int,
  "backward_compound_1" int,
  "backward_compound_2" int,
  unique ("backward_compound_1", "backward_compound_2"),
  foreign key ("forward_compound_1", "forward_compound_2") references p.forward_compound ("forward_compound_1", "forward_compound_2")
);

comment on column p.filterable.real is E'@omit filter';

create table p.backward (
  id serial primary key,
  "name" text not null,
  "filterable_id" int unique references p.filterable (id)
);

create table p.backward_compound (
  backward_compound_1 int,
  backward_compound_2 int,
  "name" text,
  primary key ("backward_compound_1", "backward_compound_2"),
  foreign key ("backward_compound_1", "backward_compound_2") references p.filterable ("backward_compound_1", "backward_compound_2")
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

create function p.filterable_computed_int_array(f p.filterable) returns int[] as $$
  select
    case
      when f.id = 1 then array[1, 10]
      when f.id = 2 then array[2, 20]
      when f.id = 3 then array[3, 30]
      when f.id = 4 then array[4, 40]
      else null
    end;
$$ language sql stable;

create function p.filterable_computed_setof_int(f p.filterable) returns setof int as $$
  values (42), (43);
$$ language sql stable;

create function p.filterable_computed_child(f p.filterable) returns p.child as $$
  select p.child.*
  from p.child
  where filterable_id = f.id
  limit 1;
$$ language sql stable;

create function p.filterable_computed_setof_child(f p.filterable) returns setof p.child as $$
  select p.child.*
  from p.child
  where filterable_id = f.id;
$$ language sql stable;
