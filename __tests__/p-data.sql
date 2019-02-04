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
  (id, "bit4",  "bool", "bpchar4", "bytea", "char4", "cidr", "date",       "float4", "float8", "inet",         "int2", "int4", "int8", "interval",       "json", "jsonb",      "macaddr", "macaddr8", "money", "numeric", "text", "time",     "timestamp",        "timestamptz",      "timetz",   "uuid",                                 "varbit", "varchar", "xml", "parent_id", "forward_id", "forward_compound_1", "forward_compound_2", "backward_compound_1", "backward_compound_2") values
  (1,  B'0001', false,  'test',    '\x01',  'test',  null,   '1999-01-01', 0.1,      0.1,      '192.168.1/24', 1,      1,      1,      'P0Y0M1DT0H0M0S', null,   '{"key1":1}', null,      null,       0.1,     0.1,       'test', '00:01:00', '1999-01-01 00:00', '1999-01-01 00:00', '00:01:00', '00000000-0000-0000-0000-000000000001', B'0001',  'test',    null,  1,           1,            1,                    1,                    1,                     1),
  (2,  B'0010', true,   'tEST',    '\x02',  'tEST',  null,   '1999-02-01', 0.2,      0.2,      '192.168.1.2',  2,      2,      2,      'P0Y0M2DT0H0M0S', null,   '{"key2":2}', null,      null,       0.2,     0.2,       'tEST', '00:02:00', '1999-02-01 00:00', '1999-02-01 00:00', '00:02:00', '00000000-0000-0000-0000-000000000002', B'0010',  'tEST',    null,  1,           2,            1,                    2,                    1,                     2),
  (3,  B'0011', false,  'Test',    '\x03',  'Test',  null,   '1999-03-01', 0.3,      0.3,      '192.168.1.3',  3,      3,      3,      'P0Y0M3DT0H0M0S', null,   '{"key3":3}', null,      null,       0.3,     0.3,       'Test', '00:03:00', '1999-03-01 00:00', '1999-03-01 00:00', '00:03:00', '00000000-0000-0000-0000-000000000003', B'0011',  'Test',    null,  2,           3,            2,                    1,                    2,                     1),
  (4,  B'0100', false,  'TEST',    '\x04',  'TEST',  null,   '1999-04-01', 0.4,      0.4,      '192.168.1.4',  4,      4,      4,      'P0Y0M4DT0H0M0S', null,   '{"key4":4}', null,      null,       0.4,     0.4,       'TEST', '00:04:00', '1999-04-01 00:00', '1999-04-01 00:00', '00:04:00', '00000000-0000-0000-0000-000000000004', B'0100',  'TEST',    null,  2,           4,            2,                    2,                    2,                     2),
  (5,  null,    null,   null,      null,    null,    null,   null,         null,     null,     null,           null,   null,   null,   null,             null,   null,         null,      null,       null,    null,      null,   null,       null,               null,               null,       null,                                   null,     null,      null,  null,        null,         null,                 null,                 null,                  null);

insert into p.array_types
  (id, "bit4_array",  "bool_array",    "bpchar4_array", "char4_array", "date_array",              "float4_array", "float8_array", "inet_array",                 "int2_array", "int4_array", "int8_array", "jsonb_array",                       "money_array", "numeric_array", "text_array",  "time_array",          "timestamp_array",                     "timestamptz_array",                   "timetz_array",        "uuid_array", "varbit_array", "varchar_array") values
  (1,  '{0001,0010}', '{false,true}',  '{test,tEST}',   '{test,tEST}', '{1999-01-01,1999-02-01}', '{0.1,0.2}',    '{0.1,0.2}',    '{192.168.1/24,192.168.1.2}', '{1,2}',      '{1,2}',      '{1,2}',      '{"{\"key1\": 1}","{\"key2\": 2}"}', '{0.1,0.2}',   '{0.1,0.2}',     '{test,tEST}', '{00:01:00,00:02:00}', '{1999-01-01 00:00,1999-02-01 00:00}', '{1999-01-01 00:00,1999-02-01 00:00}', '{00:01:00,00:02:00}', '{00000000-0000-0000-0000-000000000001,00000000-0000-0000-0000-000000000002}', '{0001,0010}',  '{test,tEST}'),
  (2,  '{0010,0011}', '{true,false}',  '{tEST,Test}',   '{tEST,Test}', '{1999-02-01,1999-03-01}', '{0.2,0.3}',    '{0.2,0.3}',    '{192.168.1.2,192.168.1.3}',  '{2,3}',      '{2,3}',      '{2,3}',      '{"{\"key2\": 2}","{\"key3\": 3}"}', '{0.2,0.3}',   '{0.2,0.3}',     '{tEST,Test}', '{00:02:00,00:03:00}', '{1999-02-01 00:00,1999-03-01 00:00}', '{1999-02-01 00:00,1999-03-01 00:00}', '{00:02:00,00:03:00}', '{00000000-0000-0000-0000-000000000002,00000000-0000-0000-0000-000000000003}', '{0010,0011}',  '{tEST,Test}'),
  (3,  '{0011,0100}', '{false,false}', '{Test,TEST}',   '{Test,TEST}', '{1999-03-01,1999-04-01}', '{0.3,0.4}',    '{0.3,0.4}',    '{192.168.1.3,192.168.1.4}',  '{3,4}',      '{3,4}',      '{3,4}',      '{"{\"key3\": 3}","{\"key4\": 4}"}', '{0.3,0.4}',   '{0.3,0.4}',     '{Test,TEST}', '{00:03:00,00:04:00}', '{1999-03-01 00:00,1999-04-01 00:00}', '{1999-03-01 00:00,1999-04-01 00:00}', '{00:03:00,00:04:00}', '{00000000-0000-0000-0000-000000000003,00000000-0000-0000-0000-000000000004}', '{0011,0100}',  '{Test,TEST}'),
  (4,  '{0100,0101}', '{false,false}', '{TEST,ZEST}',   '{TEST,ZEST}', '{1999-04-01,1999-05-01}', '{0.4,0.5}',    '{0.4,0.5}',    '{192.168.1.4,192.168.1.5}',  '{4,5}',      '{4,5}',      '{4,5}',      '{"{\"key4\": 4}","{\"key5\": 5}"}', '{0.4,0.5}',   '{0.4,0.5}',     '{TEST,ZEST}', '{00:04:00,00:05:00}', '{1999-04-01 00:00,1999-05-01 00:00}', '{1999-04-01 00:00,1999-05-01 00:00}', '{00:04:00,00:05:00}', '{00000000-0000-0000-0000-000000000004,00000000-0000-0000-0000-000000000005}', '{0100,0101}',  '{TEST,ZEST}'),
  (5,  null,          null,            null,            null,          null,                      null,           null,           null,                         null,         null,         null,         null,                                null,          null,            null,          null,                  null,                                  null,                                  null,                  null,                                                                          null,           null);

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
  