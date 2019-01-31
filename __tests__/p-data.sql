insert into p.parent(id, name) values
  (1, 'parent1'),
  (2, 'parent2');

insert into p.forward(id, name) values
  (1, 'forward1'),
  (2, 'forward2'),
  (3, 'forward3'),
  (4, 'forward4');

insert into p.forward_compound(forward_compound_1, forward_compound_2, name) values
  (1, 1, 'forwardCompound11'),
  (1, 2, 'forwardCompound12'),
  (2, 1, 'forwardCompound21'),
  (2, 2, 'forwardCompound22');

insert into p.filterable
  (id, "bit4",  "bool", "bpchar4", "bytea", "char4", "cidr",        "date",       "float4", "float8", "inet",        "int2", "int4", "int8", "interval",       "json",       "jsonb",      "macaddr", "macaddr8", "money", "numeric", "text", "time", "timestamp",        "timestamptz",      "timetz", "uuid", "varbit", "varchar", "xml", "parent_id", "forward_id", "forward_compound_1", "forward_compound_2", "backward_compound_1", "backward_compound_2") values
  (1,  B'0001', false,  'TEST',    '\x01',  'TEST',  '192.168.0.1', '1999-01-01', 0.1,      0.1,      '192.168.0.1', 1,      1,      1,      'P0Y0M1DT0H0M0S', '{"key1":1}', '{"key1":1}', null,      null,       null,    0.1,       'TEST', null,   '1999-01-01 00:00', '1999-01-01 00:00', null,     null,   B'0001',  'TEST',    null,  1,           1,            1,                    1,                    1,                     1),
  (2,  B'0010', true,   'Test',    '\x02',  'Test',  '192.168.1.1', '1999-02-01', 0.2,      0.2,      '192.168.1.1', 2,      2,      2,      'P0Y0M2DT0H0M0S', '{"key2":2}', '{"key2":2}', null,      null,       null,    0.2,       'Test', null,   '1999-02-01 00:00', '1999-01-01 00:00', null,     null,   B'0010',  'Test',    null,  1,           2,            1,                    2,                    1,                     2),
  (3,  B'0011', false,  'tEST',    '\x03',  'tEST',  '10.0.0.0/24', '1999-03-01', 0.3,      0.3,      '10.0.0.0/24', 3,      3,      3,      'P0Y0M3DT0H0M0S', '{"key3":3}', '{"key3":3}', null,      null,       null,    0.3,       'tEST', null,   '1999-03-01 00:00', '1999-01-01 00:00', null,     null,   B'0011',  'tEST',    null,  2,           3,            2,                    1,                    2,                     1),
  (4,  B'0100', false,  'test',    '\x04',  'test',  '172.168.1.1', '1999-04-01', 0.4,      0.4,      '172.168.1.1', 4,      4,      4,      'P0Y0M4DT0H0M0S', '{"key4":4}', '{"key4":4}', null,      null,       null,    0.4,       'test', null,   '1999-04-01 00:00', '1999-01-01 00:00', null,     null,   B'0100',  'test',    null,  2,           4,            2,                    2,                    2,                     2),
  (5,  null,    null,   null,      null,    null,    null,          null,         null,     null,     null,          null,   null,   null,   null,             null,         null,         null,      null,       null,    null,      null,   null,   null,               null,               null,     null,   null,     null,      null,  null,        null,         null,                 null,                 null,                  null);

insert into p.array_types
  (id, "date_array",               "int4_array", "jsonb_array",                       "text_array") values
  (1,  '{1999-01-01, 1999-02-01}', '{1,10}',     '{"{\"key1\": 1}","{\"key1\": 1}"}', '{1,2}'),
  (2,  '{1999-02-01, 1999-03-01}', '{2,20}',     '{"{\"key2\": 2}","{\"key2\": 2}"}', '{2,3}'),
  (3,  '{1999-03-01, 1999-04-01}', '{3,30}',     '{"{\"key3\": 3}","{\"key3\": 3}"}', '{3,4}'),
  (4,  '{1999-04-01, 1999-05-01}', '{4,40}',     '{"{\"key4\": 4}","{\"key4\": 4}"}', '{4,5}'),
  (5,  null,                       null,         null,                                null);

insert into p.range_types
  (id, "date_range",               "int4_range", "int8_range", "numeric_range", "timestamp_range",                      "timestamptz_range") values
  (1,  '[1999-01-01, 1999-02-01)', '[1,2)',      '[1,2)',      '[1,2)',         '[1999-01-01 00:00, 1999-02-01 00:00)', '[1999-01-01 00:00, 1999-02-01 00:00)'),
  (2,  '[1999-02-01, 1999-03-01)', '[2,3)',      '[2,3)',      '[2,3)',         '[1999-02-01 00:00, 1999-03-01 00:00)', '[1999-02-01 00:00, 1999-03-01 00:00)'),
  (3,  '[1999-03-01, 1999-04-01)', '[3,4)',      '[3,4)',      '[3,4)',         '[1999-03-01 00:00, 1999-04-01 00:00)', '[1999-03-01 00:00, 1999-04-01 00:00)'),
  (4,  '[1999-04-01, 1999-05-01)', '[4,5)',      '[4,5)',      '[4,5)',         '[1999-04-01 00:00, 1999-05-01 00:00)', '[1999-04-01 00:00, 1999-05-01 00:00)'),
  (5,  null,                       null,         null,         null,            null,                                   null);

insert into p.enum_types
  (id, "enum") values
  (1,  'sad'),
  (2,  'ok'),
  (3,  'happy'),
  (4,  'happy'),
  (5,  null);

insert into p.backward(id, name, filterable_id) values
  (1, 'backward1', 1),
  (2, 'backward2', 2),
  (3, 'backward3', 3),
  (4, 'backward4', 4);

insert into p.backward_compound(backward_compound_1, backward_compound_2, name) values
  (1, 1, 'backwardCompound11'),
  (1, 2, 'backwardCompound12'),
  (2, 1, 'backwardCompound21'),
  (2, 2, 'backwardCompound22');

insert into p.child(id, name, filterable_id) values
  (1, 'child1', 1),
  (2, 'child2', 1),
  (3, 'child3', 2),
  (4, 'child4', 2);

insert into p.side_a(a_id, name) values
  (11, 'a11'),
  (12, 'a12'),
  (13, 'a13');

insert into p.side_b(b_id, name) values
  (21, 'b21'),
  (22, 'b22'),
  (23, 'b23');

insert into p.junction(side_a_id, side_b_id) values
  (11, 21),
  (11, 22),
  (12, 21);
  