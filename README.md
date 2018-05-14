[![Package on npm](https://img.shields.io/npm/v/postgraphile-plugin-connection-filter.svg)](https://www.npmjs.com/package/postgraphile-plugin-connection-filter)

# postgraphile-plugin-connection-filter
This plugin adds a `filter` argument to Connection types in PostGraphile v4.

> **Note:** This plugin targets the beta release of PostGraphile v4. See the Compatibility table below for details.

> **Warning:** Use of this plugin (particularly with the default options) may make it **astoundingly trivial** for a malicious actor (or a well-intentioned application that generates complex GraphQL queries) to overwhelm your database with expensive queries. See the Performance and Security section for details.

## Breaking change in beta.7

The v1.0.0-beta.7 release of this plugin uses the pluggable inflector and [smart comments](https://www.graphile.org/postgraphile/smart-comments/) functionality introduced in PostGraphile v4.0.0-beta.8.  As a result, the PostGraphile peer dependency was bumped to v4.0.0-beta.8 or later.

## Breaking change in beta.4

The `contains` string comparison operator was renamed to `includes` to make room for JSONB operators `contains` and `containedBy`. To maintain the old names, you can specify the following in `graphileBuildOptions`:

```js
connectionFilterOperatorNames: {
  includes: "contains",
  includesInsensitive: "containsInsensitive",
  notIncludes: "notContains",
  notIncludesInsensitive: "notContainsInsensitive",
  contains: "jsonbContains",
  containedBy: "jsonbContainedBy"
}
```

## Compatibility

| PostGraphile version | Plugin version |
| --- | --- |
| 4.0.0-alpha2.20 | 1.0.0-alpha.0 |
| 4.0.0-alpha2.21 - 4.0.0-alpha2.25 | 1.0.0-alpha.1 |
| 4.0.0-alpha2.26 | 1.0.0-alpha.2 - 1.0.0-alpha.3 |
| 4.0.0-alpha2.27 - 4.0.0-alpha2.28 | 1.0.0-alpha.4 - 1.0.0-alpha.6 |
| 4.0.0-alpha2.30 | 1.0.0-alpha.7 - 1.0.0-alpha.8 |
| 4.0.0-alpha2.33 | 1.0.0-alpha.9 - 1.0.0-alpha.10 |
| 4.0.0-beta.0 or later | 1.0.0-beta.0 or later |
| 4.0.0-beta.8 or later | 1.0.0-beta.7 or later |

## Performance and Security

By default, this plugin:
- Exposes a large number of filter operators, including some that can perform expensive pattern matching.
- Allows filtering on [computed columns](https://www.graphile.org/postgraphile/computed-columns/), which can result in expensive operations.
- Allows filtering on functions that return `setof`, which can result in expensive operations.

To protect your server, you can:
- Use the `connectionFilterAllowedFieldTypes` and `connectionFilterAllowedOperators` options to limit the filterable fields and operators exposed through GraphQL.
- Set `connectionFilterComputedColumns: false` to prevent filtering on [computed columns](https://www.graphile.org/postgraphile/computed-columns/).
- Set `connectionFilterSetofFunctions: false` to prevent filtering on functions that return `setof`.

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
| IS NULL | is | Enum (`NULL`, `NOT_NULL`) |
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
| LIKE '%...%' | includes | Scalar |
| NOT LIKE '%...%' | notIncludes | Scalar |
| ILIKE '%...%' | includesInsensitive | Scalar |
| NOT ILIKE '%...%' | notIncludesInsensitive | Scalar |
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
| @> | contains | JSON |
| <@ | containedBy | JSON |

## Examples

<details>

<summary>Null values</summary>

``` graphql
query {
  allPosts(filter: {
    body: { isNull: true }
  }) {
    ...
  }
}
```

</details>

<details>

<summary>Non-null values</summary>

``` graphql
query {
  allPosts(filter: {
    body: { isNull: false }
  }) {
    ...
  }
}
```

</details>

<details>

<summary>Comparison operator with scalar input</summary>

``` graphql
query {
  allPosts(filter: {
    createdAt: { greaterThan: "2016-01-01" }
  }) {
    ...
  }
}
```

</details>

<details>

<summary>Comparison operator with array input</summary>

``` graphql
query {
  allPosts(filter: {
    authorId: { in: [1, 2] }
  }) {
    ...
  }
}
```

</details>

<details>

<summary>Multiple comparison operators</summary>

Note: Objects with multiple keys are interpreted with an implicit `AND` between the conditions.

``` graphql
query {
  allPosts(filter: {
    body: { isNull: false },
    createdAt: { greaterThan: "2016-01-01" }
  }) {
    ...
  }
}
```

</details>

<details>

<summary>Logical operator</summary>

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

</details>

<details>

<summary>Nested logic</summary>

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

</details>

<details>

<summary>Related tables</summary>

``` graphql
query {
  allPeople(filter: {
    firstName: { startsWith:"John" }
  }) {
    nodes {
      firstName
      lastName
      postsByAuthorId(filter: {
        createdAt: { greaterThan: "2016-01-01" }
      }) {
        nodes {
          ...
        }
      }
    }
  }
}
```

</details>

For additional examples, see the [tests](https://github.com/graphile-contrib/postgraphile-plugin-connection-filter/blob/master/__tests__/fixtures/queries/connections-filter.graphql).

## Plugin Options

When using PostGraphile as a library, the following plugin options can be passed via `graphileBuildOptions`:

<details>

<summary>connectionFilterAllowedOperators</summary>

Restrict filtering to specific operators:

``` js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterAllowedOperators: [
      "isNull",
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

</details>

<details>

<summary>connectionFilterAllowedFieldTypes</summary>

Restrict filtering to specific field types:

``` js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterAllowedFieldTypes: ["String", "Int"],
  },
})
```

The available field types will depend on your database schema.

</details>

<details>

<summary>connectionFilterComputedColumns</summary>

Enable/disable filtering by computed columns:

``` js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterComputedColumns: false, // default: true
  },
})
```

</details>

<details>

<summary>connectionFilterOperatorNames</summary>

Use alternative names (e.g. `eq`, `ne`) for operators:

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

</details>

<details>

<summary>connectionFilterSetofFunctions</summary>

Enable/disable filtering on functions that return `setof`:

``` js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterSetofFunctions: false, // default: true
  },
})
```

</details>

## Development

To establish a test environment, create an empty Postgres database (e.g. `graphile_build_test`) and set a `TEST_DATABASE_URL` environment variable with your connection string (e.g. `postgres://localhost:5432/graphile_build_test`).  Ensure that `psql` is installed locally and then run:
``` bash
npm install
npm test
```