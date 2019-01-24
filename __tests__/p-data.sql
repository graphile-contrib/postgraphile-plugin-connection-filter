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

insert into p.filterable (id, "text", "char4", "int4", "float4", "float8", "numeric", "bool", "jsonb", "int4_array", "int4_range", "int8_range", "numeric_range", "timestamp_range", "timestamptz_range", "date_range", "inet", "enum", "parent_id", "forward_id", "forward_compound_1", "forward_compound_2", "backward_compound_1", "backward_compound_2") values
  (1, 'TEST', 'TEST', 1, 0.1, 0.1, 0.1, false, '{"key1":1}', '{1, 10}', '[1,2)', '[1,2)', '[1,2)', '[1999-01-01 00:00, 1999-02-01 00:00)', '[1999-01-01 00:00, 1999-02-01 00:00)', '[1999-01-01, 1999-02-01)', '192.168.0.1', 'sad', 1, 1, 1, 1, 1, 1),
  (2, 'Test', 'Test', 2, 0.2, 0.2, 0.2, true, '{"key2":2}', '{2, 20}', '[2,3)', '[2,3)', '[2,3)', '[1999-02-01 00:00, 1999-03-01 00:00)', '[1999-02-01 00:00, 1999-03-01 00:00)', '[1999-02-01, 1999-03-01)', '192.168.1.1', 'ok', 1, 2, 1, 2, 1, 2),
  (3, 'tEST', 'tEST', 3, 0.3, 0.3, 0.3, false, '{"key3":3}', '{3, 30}', '[3,4)', '[3,4)', '[3,4)', '[1999-03-01 00:00, 1999-04-01 00:00)', '[1999-03-01 00:00, 1999-04-01 00:00)', '[1999-03-01, 1999-04-01)', '10.0.0.0/24', 'happy', 2, 3, 2, 1, 2, 1),
  (4, 'test', 'test', 4, 0.4, 0.4, 0.4, false, '{"key4":4}', '{4, 40}', '[4,5)', '[4,5)', '[4,5)', '[1999-04-01 00:00, 1999-05-01 00:00)', '[1999-04-01 00:00, 1999-05-01 00:00)', '[1999-04-01, 1999-05-01)', '172.168.1.1', 'happy', 2, 4, 2, 2, 2, 2),
  (5, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);

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