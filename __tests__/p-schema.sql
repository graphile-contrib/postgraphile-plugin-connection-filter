create extension if not exists hstore;
create extension if not exists citext;

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

create type p."composite" as (a int, b text);

create table p.filterable (
  id serial primary key,
  "bit4" bit(4),
  "bool" bool,
  "bpchar4" bpchar(4),
  "bytea" bytea, -- treated as String in PostGraphile v4
  "char4" char(4),
  "cidr" cidr, -- treated as String in PostGraphile v4 unless useCustomNetworkScalars is specified
  "citext" citext,
  "date" date,
  "float4" float4,
  "float8" float8,
  "hstore" hstore,
  "inet" inet,
  "int2" int2,
  "int4" int4,
  "int8" int8,
  "interval" interval,
  "json" json, -- not filterable
  "jsonb" jsonb,
  "macaddr" macaddr, -- treated as String in PostGraphile v4 unless useCustomNetworkScalars is specified
  --"macaddr8" macaddr8, -- treated as String in PostGraphile v4 unless useCustomNetworkScalars is specified; excluded from tests because it requires PG10+
  "money" money,
  "name" name,
  "numeric" numeric,
  "text" text,
  "time" time,
  "timestamp" timestamp,
  "timestamptz" timestamptz,
  "timetz" timetz,
  "uuid" uuid,
  "varbit" varbit,
  "varchar" varchar,
  "xml" xml, -- not filterable
  "composite_column" p."composite",
  "forward_column" p.forward, -- not filterable
  "text_omit_filter" text, -- not filterable
  "parent_id" int references p.parent (id),
  "forward_id" int unique references p.forward (id),
  "forward_compound_1" int,
  "forward_compound_2" int,
  "backward_compound_1" int,
  "backward_compound_2" int,
  unique ("forward_compound_1", "forward_compound_2"),
  unique ("backward_compound_1", "backward_compound_2"),
  foreign key ("forward_compound_1", "forward_compound_2") references p.forward_compound ("forward_compound_1", "forward_compound_2")
);

comment on column p.filterable."text_omit_filter" is E'@omit filter';

create table p.array_types (
  id serial primary key,
  "bit4_array" bit(4)[],
  "bool_array" bool[],
  "bpchar4_array" bpchar(4)[],
  "bytea_array" bytea[],
  "char4_array" char(4)[],
  "cidr_array" cidr[],
  "citext_array" citext[],
  "date_array" date[],
  "float4_array" float4[],
  "float8_array" float8[],
  "hstore_array" hstore[],
  "inet_array" inet[],
  "int2_array" int2[],
  "int4_array" int4[],
  "int8_array" int8[],
  "interval_array" interval[],
  "json_array" json[], -- not filterable
  "jsonb_array" jsonb[],
  "macaddr_array" macaddr[],
  --"macaddr8_array" macaddr8[], -- excluded from tests because it requires PG10+
  "money_array" money[],
  "name_array" name[],
  "numeric_array" numeric[],
  "text_array" text[],
  "time_array" time[],
  "timestamp_array" timestamp[],
  "timestamptz_array" timestamptz[],
  "timetz_array" timetz[],
  "uuid_array" uuid[],
  "varbit_array" varbit[],
  "varchar_array" varchar[],
  "xml_array" xml[] -- not filterable
);

create table p.range_types (
  id serial primary key,
  "date_range" daterange,
  "int4_range" int4range,
  "int8_range" int8range,
  "numeric_range" numrange,
  "timestamp_range" tsrange,
  "timestamptz_range" tstzrange
);

create table p.range_array_types (
  id serial primary key,
  "date_range_array" daterange[],
  "int4_range_array" int4range[],
  "int8_range_array" int8range[],
  "numeric_range_array" numrange[],
  "timestamp_range_array" tsrange[],
  "timestamptz_range_array" tstzrange[]
);

create domain p.char4_domain as char(4) check (lower(value) = 'test');
create domain p.date_domain as date check (value >= '1990-01-01'::date);
create domain p.int4_domain as int4 check (value > 0);

create table p.domain_types (
  id serial primary key,
  "char4_domain" p.char4_domain,
  "date_domain" p.date_domain,
  "int4_domain" p.int4_domain  
);

create table p.enum_types (
  id serial primary key,
  "enum" p.mood
);

create table p.enum_array_types (
  id serial primary key,
  "enum_array" p.mood[]
);

create table p.jsonb_test (
  id serial primary key,
  jsonb_with_array jsonb,
  jsonb_with_object jsonb
);

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

create table p."side_a" (
  a_id integer primary key,
  name text not null
);

create table p."side_b" (
  b_id integer primary key,
  name text not null
);

create table p."junction" (
  side_a_id integer not null references p."side_a" (a_id),
  side_b_id integer not null references p."side_b" (b_id),
  primary key (side_a_id, side_b_id)
);

create table p.unfilterable (
  id serial primary key,
  "text" text
);

comment on table p.unfilterable is E'@omit filter';

create table p.fully_omitted (
  id serial primary key,
  "text" text
);

comment on column p.fully_omitted.id is '@omit filter';
comment on column p.fully_omitted."text" is '@omit filter';

create table p.child_no_related_filter (
  id serial primary key,
  "name" text not null,
  unfilterable_id int references p.unfilterable (id),
  filterable_id int,
  constraint child_no_related_filter_filterable_id_fkey foreign key (filterable_id) references p.filterable(id)
);
comment on constraint child_no_related_filter_filterable_id_fkey on p.child_no_related_filter is '@omit filter';

create function p.filterable_computed(filterable p.filterable) returns text as $$
  select filterable."text" || ' computed'
$$ language sql stable;

create function p.filterable_computed2(filterable p.filterable) returns text as $$
  select filterable."text" || ' computed2'
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

create function p.filterable_computed_with_required_arg(f p.filterable, i int) returns int as $$
  select 1;
$$ language sql stable strict;

create function p.func_returns_table_one_col(i int) returns table (col1 int) as $$
  select i + 42 as col1
  union
  select i + 43 as col1;
$$ language sql stable;

create function p.func_returns_table_multi_col(i int) returns table (col1 int, col2 text) as $$
  select i + 42 as col1, 'out'::text as col2
  union
  select i + 43 as col1, 'out2'::text as col2;
$$ language sql stable;

-- @filterable smart comments

create function p.filterable_computed_tagged_filterable(filterable p.filterable) returns int as $$
  select 42;
$$ language sql stable;

comment on function p.filterable_computed_tagged_filterable (filterable p.filterable) is E'@filterable';

create function p.func_tagged_filterable_returns_setof_filterable() returns setof p.filterable as $$
  select * from p.filterable;
$$ language sql stable;

comment on function p.func_tagged_filterable_returns_setof_filterable() is E'@filterable';

create function p.func_tagged_filterable_returns_table_multi_col() returns table (col1 int, col2 text) as $$
  select 42 as col1, 'out'::text as col2
  union
  select 43 as col1, 'out2'::text as col2;
$$ language sql stable;

comment on function p.func_tagged_filterable_returns_table_multi_col() is E'@filterable';

create table p.protected (
  id int primary key,
  other_id int,
  name text
);

comment on table p.protected is E'@omit all';

create function p.protecteds_by_other_id (other_id int) returns setof p.protected as $$
  select * from p.protected where other_id = other_id;
$$ language sql stable;

create table p.filterable_closure (
  id serial primary key,
  ancestor_id integer not null references p.filterable (id),
  descendant_id integer not null references p.filterable (id),
  depth integer not null
);
comment on table p.filterable_closure is E'@omit all';
