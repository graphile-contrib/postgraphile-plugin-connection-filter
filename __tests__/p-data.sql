insert into p.parent(id, name) values
  (1, 'parent1'),
  (2, 'parent2');

insert into p.forward(id, name) values
  (1, 'forward1'),
  (2, 'forward2'),
  (3, 'forward3'),
  (4, 'forward4');

insert into p.filterable (id, string, int, real, numeric, boolean, jsonb, int_array, inet, enum, parent_id, forward_id) values
  (1, 'TEST', 1, 0.1, 0.1, true, '{"string":"TEST","int":1,"boolean":true}', '{1, 10}', '192.168.0.1', 'sad', 1, 1),
  (2, 'Test', 2, 0.2, 0.2, true, '{"string":"Test","int":2,"boolean":true}', '{2, 20}', '192.168.1.1', 'ok', 1, 2),
  (3, 'tEST', 3, 0.3, 0.3, false, '{"string":"tEST","int":3,"boolean":false}', '{3, 30}', '10.0.0.0/24', 'happy', 2, 3),
  (4, 'test', 4, 0.4, 0.4, false, '{"string":"test","int":4,"boolean":false}', '{4, 40}', '172.168.1.1', 'happy', 2, 4),
  (5, null, null, null, null, null, null, null, null, null, null, null);

insert into p.backward(id, name, filterable_id) values
  (1, 'backward1', 1),
  (2, 'backward2', 2),
  (3, 'backward3', 3),
  (4, 'backward4', 4);

insert into p.child(id, name, filterable_id) values
  (1, 'child1', 1),
  (2, 'child2', 1),
  (3, 'child3', 2),
  (4, 'child4', 2);