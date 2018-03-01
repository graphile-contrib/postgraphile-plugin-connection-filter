# postgraphile-plugin-connection-filter
This plugin adds a `filter` argument to Connection types in PostGraphile v4.

> **Note:** This plugin targets the alpha release of PostGraphile v4.  Because of possible API changes, releases of this plugin are pinned to specific alpha versions of PostGraphile.  See the Compatibility table below for details.

> **Warning:** This plugin exposes a large number of operators (including some that can perform expensive pattern matching) by default.  Before enabling this plugin in production, you should consider the performance and security implications.  Use of the `connectionFilterAllowedOperators` option to limit the operators exposed through GraphQL is strongly encouraged.

## Compatibility

| PostGraphile version | Plugin version |
| --- | --- |
| 4.0.0-alpha2.20 | 1.0.0-alpha.0 |
| 4.0.0-alpha2.21 - 4.0.0-alpha2.25 | 1.0.0-alpha.1 |
| 4.0.0-alpha2.26 | 1.0.0-alpha.2 - 1.0.0-alpha.3 |
| 4.0.0-alpha2.27 - 4.0.0-alpha2.28 | 1.0.0-alpha.4 - 1.0.0-alpha.6 |
| 4.0.0-alpha2.30 | 1.0.0-alpha.7 - 1.0.0-alpha.8 |
| 4.0.0-alpha2.33 | 1.0.0-alpha.9 - 1.0.0-alpha.10 |

## Getting Started

### CLI

``` bash
postgraphile --append-plugins `pwd`/path/to/this/plugin/index.js
```

### Library

``` js
const express = require("express");
const { postgraphile } = require("postgraphile");
const PostGraphileConnectionFilterPlugin = require("postgraphile-plugin-connection-filter");

const app = express();

app.use(
  postgraphile(pgConfig, schema, {
    graphiql: true,
    appendPlugins: [PostGraphileConnectionFilterPlugin],
  })
);

app.listen(5000);
```

## Operators

The following filter operators are exposed by default:

### Logical Operators
| Postgres operator | GraphQL field | Type
| --- | --- | --- |
| AND | and | Array |
| OR | or | Array |
| NOT | not | Object |

### Comparison Operators
| Postgres expression | GraphQL field | Type |
| --- | --- | --- |
| IS NULL | null | Boolean |
| = | equalTo | Scalar |
| <> | notEqualTo | Scalar |
| IS DISTINCT FROM | distinctFrom | Scalar |
| IS NOT DISTINCT FROM | notDistinctFrom | Scalar |
| < | lessThan | Scalar |
| <= | lessThanOrEqualTo | Scalar |
| > | greaterThan | Scalar |
| >= | greaterThanOrEqualTo | Scalar |
| IN | in | Array |
| NOT IN | notIn | Array |
| LIKE '%...%' | contains | Scalar |
| NOT LIKE '%...%' | notContains | Scalar |
| ILIKE '%...%' | containsInsensitive | Scalar |
| NOT ILIKE '%...%' | notContainsInsensitive | Scalar |
| LIKE '...%' | startsWith | Scalar |
| NOT LIKE '...%' | notStartsWith | Scalar |
| ILIKE '...%' | startsWithInsensitive | Scalar |
| NOT ILIKE '...%' | notStartsWithInsensitive | Scalar |
| LIKE '%...' | endsWith | Scalar |
| NOT LIKE '%...' | notEndsWith | Scalar |
| ILIKE '%...' | endsWithInsensitive | Scalar |
| NOT ILIKE '%...' | notEndsWithInsensitive | Scalar |
| LIKE '...' | like | Scalar |
| NOT LIKE '...' | notLike | Scalar |
| ILIKE '...' | likeInsensitive | Scalar |
| NOT ILIKE '...' | notLikeInsensitive | Scalar |
| SIMILAR TO '...' | similarTo | Scalar |
| NOT SIMILAR TO '...' | notSimilarTo | Scalar |

## Examples

### Null values

``` graphql
query {
  allPosts(filter: { body: { null: true } }) {
    ...
  }
}
```

### Non-null values

``` graphql
query {
  allPosts(filter: { body: { null: false } }) {
    ...
  }
}
```

### Comparison operator with scalar input
``` graphql
query {
  allPosts(filter: { createdAt: { greaterThan: "2016-01-01" } }) {
    ...
  }
}
```

### Comparison operator with array input
``` graphql
query {
  allPosts(filter: { authorId: { in: [1, 2] } }) {
    ...
  }
}
```

### Multiple comparison operators
``` graphql
query {
  allPosts(filter: {
    body: { null: false },
    createdAt: { greaterThan: "2016-01-01" }
  }) {
    ...
  }
}
```

Note: Objects with multiple keys are interpreted with an implicit `AND` between the conditions.

### Logical operator
``` graphql
query {
  allPosts(filter: {
    or: [
      { authorId: { equalTo: 6 } },
      { createdAt: { greaterThan: "2016-01-01" } }
    ]
  }) {
    ...
  }
}
```

### Nested logic

``` graphql
query {
  allPosts(filter: {
    not: {
      or: [
        { authorId: { equalTo: 6 } },
        { createdAt: { greaterThan: "2016-01-01" } }
      ]
    }
  }) {
    ...
  }
}
```

For additional examples, see the [tests](https://github.com/mattbretl/postgraphile-plugin-connection-filter/blob/master/__tests__/fixtures/queries/connections-filter.graphql).

## Plugin Options

When using PostGraphile as a library, the following plugin options can be passed via `graphileBuildOptions` (called `graphqlBuildOptions` in PostGraphile 4.0.0-alpha2.20 and earlier):

### connectionFilterAllowedOperators

Restrict filtering to specific operators
``` js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterAllowedOperators: [
      "null",
      "equalTo",
      "notEqualTo",
      "distinctFrom",
      "notDistinctFrom",
      "lessThan",
      "lessThanOrEqualTo",
      "greaterThan",
      "greaterThanOrEqualTo",
      "in",
      "notIn",
    ],
  },
})
```

For a full list of the available operators, see the Comparison Operators table above.

### connectionFilterAllowedFieldTypes

Restrict filtering to specific field types
``` js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterAllowedFieldTypes: ["String", "Int"],
  },
})
```

The available field types will depend on your database schema.

### connectionFilterOperatorNames

Use alternative names (e.g. `eq`, `ne`) for operators
``` js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterOperatorNames: {
      equalTo: "eq",
      notEqualTo: "ne",
    },
  },
})
``` 

Note: The `connectionFilterUsesShortNames` option was removed in v1.0.0-alpha.6.  To restore the old functionality, you can use this:
``` js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterOperatorNames: {
      equalTo: "eq",
      notEqualTo: "ne",
      lessThan: "lt",
      lessThanOrEqualTo: "lte",
      greaterThan: "gt",
      greaterThanOrEqualTo: "gte",
      in: "in",
      notIn: "nin",
      contains: "cont",
      notContains: "ncont",
      containsInsensitive: "conti",
      notContainsInsensitive: "nconti",
      startsWith: "starts",
      notStartsWith: "nstarts",
      startsWithInsensitive: "startsi",
      notStartsWithInsensitive: "nstartsi",
      endsWith: "ends",
      notEndsWith: "nends",
      endsWithInsensitive: "endsi",
      notEndsWithInsensitive: "nendsi",
      like: "like",
      notLike: "nlike",
      likeInsensitive: "ilike",
      notLikeInsensitive: "nilike",
    },
  },
})
```

## Development

To establish a test environment, create an empty Postgres database (e.g. `graphile_build_test`) and set a `TEST_DATABASE_URL` environment variable with your connection string (e.g. `postgres://localhost:5432/graphile_build_test`).  Ensure that `psql` is installed locally and then run:
``` bash
npm install
npm test
```