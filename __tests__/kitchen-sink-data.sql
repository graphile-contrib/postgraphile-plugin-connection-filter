insert into a.filterable (id, string, int, real, numeric, boolean, jsonb) values
  (1, 'TEST', 1, 0.1, 0.1, true, '{"string":"TEST","int":1,"boolean":true}'),
  (2, 'Test', 2, 0.2, 0.2, true, '{"string":"Test","int":2,"boolean":true}'),
  (3, 'tEST', 3, 0.3, 0.3, false, '{"string":"tEST","int":3,"boolean":false}'),
  (4, 'test', 4, 0.4, 0.4, false, '{"string":"test","int":4,"boolean":false}'),
  (5, null, null, null, null, null, null);