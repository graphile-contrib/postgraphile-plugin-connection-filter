## Developing the filterable type whitelist

```sql
select oid, typname, typcategory
from pg_type
where typtype = 'b' and typcategory <> 'A'
order by typname;
```

```
 oid  |     typname     | typcategory 
------+-----------------+-------------
  702 | abstime         | D            SKIP
 1033 | aclitem         | U            SKIP
 1560 | bit             | V
   16 | bool            | B
  603 | box             | G
 1042 | bpchar          | S
   17 | bytea           | U
   18 | char            | S
   29 | cid             | U            SKIP
  650 | cidr            | I
  718 | circle          | G
 1082 | date            | D
  700 | float4          | N
  701 | float8          | N
 3642 | gtsvector       | U            SKIP; TODO: consider keeping this
  869 | inet            | I
   21 | int2            | N
   23 | int4            | N
   20 | int8            | N
 1186 | interval        | T
  114 | json            | U
 3802 | jsonb           | U
  628 | line            | G
  601 | lseg            | G
  829 | macaddr         | U
  774 | macaddr8        | U
  790 | money           | N
   19 | name            | S            SKIP
 1700 | numeric         | N
   26 | oid             | N            SKIP
  602 | path            | G
 3402 | pg_dependencies | S            SKIP
 3220 | pg_lsn          | U            SKIP
 3361 | pg_ndistinct    | S            SKIP
  194 | pg_node_tree    | S            SKIP
  600 | point           | G
  604 | polygon         | G
 1790 | refcursor       | U            SKIP
 2205 | regclass        | N            SKIP
 3734 | regconfig       | N            SKIP
 3769 | regdictionary   | N            SKIP
 4089 | regnamespace    | N            SKIP
 2203 | regoper         | N            SKIP
 2204 | regoperator     | N            SKIP
   24 | regproc         | N            SKIP
 2202 | regprocedure    | N            SKIP
 4096 | regrole         | N            SKIP
 2206 | regtype         | N            SKIP
  703 | reltime         | T            SKIP
  210 | smgr            | U            SKIP
   25 | text            | S
   27 | tid             | U            SKIP
 1083 | time            | D
 1114 | timestamp       | D
 1184 | timestamptz     | D
 1266 | timetz          | D
  704 | tinterval       | T            SKIP
 3615 | tsquery         | U            SKIP; TODO: consider keeping this
 3614 | tsvector        | U            SKIP; TODO: consider keeping this
 2970 | txid_snapshot   | U            SKIP
 2950 | uuid            | U
 1562 | varbit          | V
 1043 | varchar         | S
   28 | xid             | U            SKIP
  142 | xml             | U
(65 rows)
```

  After removing the skipped types:

```
 oid  |     typname     | typcategory 
------+-----------------+-------------
 1560 | bit             | V
   16 | bool            | B
  603 | box             | G
 1042 | bpchar          | S
   17 | bytea           | U
   18 | char            | S
  650 | cidr            | I
  718 | circle          | G
 1082 | date            | D
  700 | float4          | N
  701 | float8          | N
  869 | inet            | I
   21 | int2            | N
   23 | int4            | N
   20 | int8            | N
 1186 | interval        | T
  114 | json            | U
 3802 | jsonb           | U
  628 | line            | G
  601 | lseg            | G
  829 | macaddr         | U
  774 | macaddr8        | U
  790 | money           | N
 1700 | numeric         | N
  602 | path            | G
  600 | point           | G
  604 | polygon         | G
   25 | text            | S
 1083 | time            | D
 1114 | timestamp       | D
 1184 | timestamptz     | D
 1266 | timetz          | D
 2950 | uuid            | U
 1562 | varbit          | V
 1043 | varchar         | S
  142 | xml             | U
(36 rows)
```

Checking for the existence of standard comparison operators:

```
 oid  |     typname     |
------+-----------------+
 1560 | bit             | <, <=, <>, =, >, >=
   16 | bool            | <, <=, <>, =, >, >=
  603 | box             | <, <=,     =, >, >=
 1042 | bpchar          | <, <=, <>, =, >, >=
   17 | bytea           | <, <=, <>, =, >, >=
   18 | char            | <, <=, <>, =, >, >=
  650 | cidr            | 
  718 | circle          | <, <=, <>, =, >, >=
 1082 | date            | <, <=, <>, =, >, >=
  700 | float4          | <, <=, <>, =, >, >=
  701 | float8          | <, <=, <>, =, >, >=
  869 | inet            | <, <=, <>, =, >, >=
   21 | int2            | <, <=, <>, =, >, >=
   23 | int4            | <, <=, <>, =, >, >=
   20 | int8            | <, <=, <>, =, >, >=
 1186 | interval        | <, <=, <>, =, >, >=
  114 | json            | 
 3802 | jsonb           | <, <=, <>, =, >, >=
  628 | line            | =
  601 | lseg            | <, <=, <>, =, >, >=
  829 | macaddr         | <, <=, <>, =, >, >=
  774 | macaddr8        | <, <=, <>, =, >, >=
  790 | money           | <, <=, <>, =, >, >=
 1700 | numeric         | <, <=, <>, =, >, >=
  602 | path            | <, <=,     =, >, >=
  600 | point           |        <>
  604 | polygon         | 
   25 | text            | <, <=, <>, =, >, >=
 1083 | time            | <, <=, <>, =, >, >=
 1114 | timestamp       | <, <=, <>, =, >, >=
 1184 | timestamptz     | <, <=, <>, =, >, >=
 1266 | timetz          | <, <=, <>, =, >, >=
 2950 | uuid            | <, <=, <>, =, >, >=
 1562 | varbit          | <, <=, <>, =, >, >=
 1043 | varchar         | 
  142 | xml             | 
(36 rows)
```

Note that the "same as" operator, ~=, represents the usual notion of equality for the point, box, polygon, and circle types. Some of these types also have an = operator, but = compares for equal areas only. The other scalar comparison operators (<= and so on) likewise compare areas for these types.
Ref: https://www.postgresql.org/docs/11/catalog-pg-type.html

To avoid this complexity, exclude the geometric types (box, circle, line, lseg, path, point, polygon):

```
 oid  |     typname     |
------+-----------------+
 1560 | bit             | <, <=, <>, =, >, >=
   16 | bool            | <, <=, <>, =, >, >=
 1042 | bpchar          | <, <=, <>, =, >, >=
   17 | bytea           | <, <=, <>, =, >, >=
   18 | char            | <, <=, <>, =, >, >=
  650 | cidr            | 
 1082 | date            | <, <=, <>, =, >, >=
  700 | float4          | <, <=, <>, =, >, >=
  701 | float8          | <, <=, <>, =, >, >=
  869 | inet            | <, <=, <>, =, >, >=
   21 | int2            | <, <=, <>, =, >, >=
   23 | int4            | <, <=, <>, =, >, >=
   20 | int8            | <, <=, <>, =, >, >=
 1186 | interval        | <, <=, <>, =, >, >=
  114 | json            | 
 3802 | jsonb           | <, <=, <>, =, >, >=
  829 | macaddr         | <, <=, <>, =, >, >=
  774 | macaddr8        | <, <=, <>, =, >, >=
  790 | money           | <, <=, <>, =, >, >=
 1700 | numeric         | <, <=, <>, =, >, >=
   25 | text            | <, <=, <>, =, >, >=
 1083 | time            | <, <=, <>, =, >, >=
 1114 | timestamp       | <, <=, <>, =, >, >=
 1184 | timestamptz     | <, <=, <>, =, >, >=
 1266 | timetz          | <, <=, <>, =, >, >=
 2950 | uuid            | <, <=, <>, =, >, >=
 1562 | varbit          | <, <=, <>, =, >, >=
 1043 | varchar         | 
  142 | xml             | 
(29 rows)
```

Reviewing the remaining gaps:
`cidr` can use the `inet` operators
`json` has no valid operators; exclude from filtering
`varchar` can use the `text operators
`xml` has no valid operators; exclude from filtering

Final whitelist:

```
 oid  |     typname     |
------+-----------------+
 1560 | bit             | <, <=, <>, =, >, >=
   16 | bool            | <, <=, <>, =, >, >=
 1042 | bpchar          | <, <=, <>, =, >, >=
   17 | bytea           | <, <=, <>, =, >, >=
   18 | char            | <, <=, <>, =, >, >=
  650 | cidr            | (same as inet)
 1082 | date            | <, <=, <>, =, >, >=
  700 | float4          | <, <=, <>, =, >, >=
  701 | float8          | <, <=, <>, =, >, >=
  869 | inet            | <, <=, <>, =, >, >=
   21 | int2            | <, <=, <>, =, >, >=
   23 | int4            | <, <=, <>, =, >, >=
   20 | int8            | <, <=, <>, =, >, >=
 1186 | interval        | <, <=, <>, =, >, >=
 3802 | jsonb           | <, <=, <>, =, >, >=
  829 | macaddr         | <, <=, <>, =, >, >=
  774 | macaddr8        | <, <=, <>, =, >, >=
  790 | money           | <, <=, <>, =, >, >=
 1700 | numeric         | <, <=, <>, =, >, >=
   25 | text            | <, <=, <>, =, >, >=
 1083 | time            | <, <=, <>, =, >, >=
 1114 | timestamp       | <, <=, <>, =, >, >=
 1184 | timestamptz     | <, <=, <>, =, >, >=
 1266 | timetz          | <, <=, <>, =, >, >=
 2950 | uuid            | <, <=, <>, =, >, >=
 1562 | varbit          | <, <=, <>, =, >, >=
 1043 | varchar         | (same as text)
(27 rows)
```
