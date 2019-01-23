[![Package on npm](https://img.shields.io/npm/v/postgraphile-plugin-connection-filter.svg)](https://www.npmjs.com/package/postgraphile-plugin-connection-filter)

# postgraphile-plugin-connection-filter
This plugin adds a `filter` argument for advanced filtering of list types.

> **Warning:** Use of this plugin (particularly with the default options) may make it **astoundingly trivial** for a malicious actor (or a well-intentioned application that generates complex GraphQL queries) to overwhelm your database with expensive queries. See the Performance and Security section below for details.

## Performance and Security

By default, this plugin:
- Exposes a large number of filter operators, including some that can perform expensive pattern matching.
- Allows filtering on [computed columns](https://www.graphile.org/postgraphile/computed-columns/), which can result in expensive operations.
- Allows filtering on functions that return `setof`, which can result in expensive operations.
- Allows filtering on List fields (Postgres arrays), which can result in expensive operations.

To protect your server, you can:
- Use the `connectionFilterAllowedFieldTypes` and `connectionFilterAllowedOperators` options to limit the filterable fields and operators exposed through GraphQL.
- Set `connectionFilterComputedColumns: false` to prevent filtering on [computed columns](https://www.graphile.org/postgraphile/computed-columns/).
- Set `connectionFilterSetofFunctions: false` to prevent filtering on functions that return `setof`.
- Set `connectionFilterLists: false` to prevent filtering on List fields (Postgres arrays).

Also see the [Production Considerations](https://www.graphile.org/postgraphile/production) page of the official PostGraphile docs, which discusses query whitelisting.

## Getting Started

### CLI

```bash
yarn add postgraphile
yarn add postgraphile-plugin-connection-filter
npx postgraphile --append-plugins postgraphile-plugin-connection-filter
```

### Library

```js
const express = require("express");
const { postgraphile } = require("postgraphile");
const ConnectionFilterPlugin = require("postgraphile-plugin-connection-filter");

const app = express();

app.use(
  postgraphile(process.env.DATABASE_URL, "app_public", {
    appendPlugins: [ConnectionFilterPlugin],
    graphiql: true,
  })
);

app.listen(5000);
```

## Handling `null` and empty objects

By default, this plugin will throw an error when `null` literals or empty objects (`{}`) are included in `filter` input objects. This prevents queries with ambiguous semantics such as `filter: { field: null }` and `filter: { field: { equalTo: null } }` from returning unexpected results. For background on this decision, see https://github.com/graphile-contrib/postgraphile-plugin-connection-filter/issues/58.

To allow `null` and `{}` in inputs, use the `connectionFilterAllowNullInput` and `connectionFilterAllowEmptyObjectInput` options documented under [Plugin Options](https://github.com/graphile-contrib/postgraphile-plugin-connection-filter#plugin-options). Please note that even with `connectionFilterAllowNullInput` enabled, `null` is never interpreted as a SQL `NULL`; fields with `null` values are simply ignored when resolving the query.

## Operators

The following filter operators are exposed by default:

### Logical Operators
| Postgres operator | GraphQL field | GraphQL field type
| --- | --- | --- |
| AND | and | List |
| OR | or | List |
| NOT | not | Object |

### Comparison Operators
| Postgres expression | GraphQL field | GraphQL field type |
| --- | --- | --- |
| IS [NOT] NULL | isNull | Boolean |
| = | equalTo | Scalar/Enum |
| <> | notEqualTo | Scalar/Enum |
| IS DISTINCT FROM | distinctFrom | Scalar/Enum |
| IS NOT DISTINCT FROM | notDistinctFrom | Scalar/Enum |
| < | lessThan | Scalar/Enum |
| <= | lessThanOrEqualTo | Scalar/Enum |
| > | greaterThan | Scalar/Enum |
| >= | greaterThanOrEqualTo | Scalar/Enum |
| IN | in | List |
| NOT IN | notIn | List |
| LIKE '%...%' | includes | String |
| NOT LIKE '%...%' | notIncludes | String |
| ILIKE '%...%' | includesInsensitive | String |
| NOT ILIKE '%...%' | notIncludesInsensitive | String |
| LIKE '...%' | startsWith | String |
| NOT LIKE '...%' | notStartsWith | String |
| ILIKE '...%' | startsWithInsensitive | String |
| NOT ILIKE '...%' | notStartsWithInsensitive | String |
| LIKE '%...' | endsWith | String |
| NOT LIKE '%...' | notEndsWith | String |
| ILIKE '%...' | endsWithInsensitive | String |
| NOT ILIKE '%...' | notEndsWithInsensitive | String |
| LIKE '...' | like | String |
| NOT LIKE '...' | notLike | String |
| ILIKE '...' | likeInsensitive | String |
| NOT ILIKE '...' | notLikeInsensitive | String |
| SIMILAR TO '...' | similarTo | String |
| NOT SIMILAR TO '...' | notSimilarTo | String |
| @> | contains | JSON |
| <@ | containedBy | JSON |
| << | containedBy | InternetAddress |
| <<= | containedByOrEqualTo | InternetAddress |
| >> | contains | InternetAddress |
| >>= | containsOrEqualTo | InternetAddress |
| && | containsOrContainedBy | InternetAddress |

### List Comparison Operators

| Postgres expression | GraphQL field | GraphQL field type |
| --- | --- | --- |
| IS [NOT] NULL | isNull | Boolean |
| = | equalTo | List |
| <> | notEqualTo | List |
| IS DISTINCT FROM | distinctFrom | List |
| IS NOT DISTINCT FROM | notDistinctFrom | List |
| < | lessThan | List |
| <= | lessThanOrEqualTo | List |
| > | greaterThan | List |
| >= | greaterThanOrEqualTo | List |
| = ANY() | anyEqualTo | Scalar/Enum |
| <> ANY() | anyNotEqualTo | Scalar/Enum |
| > ANY() | anyLessThan | Scalar/Enum |
| >= ANY() | anyLessThanOrEqualTo | Scalar/Enum |
| < ANY() | anyGreaterThan | Scalar/Enum |
| <= ANY() | anyGreaterThanOrEqualTo | Scalar/Enum |

## Examples

<details>

<summary>Null values</summary>

```graphql
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

```graphql
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

```graphql
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

```graphql
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

```graphql
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

```graphql
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

<summary>Compound logic</summary>

```graphql
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

<summary>Relations: Nested</summary>

```graphql
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

<details>

<summary>Relations: Root-level, many-to-one</summary>

> Requires `connectionFilterRelations: true`

```graphql
query {
  allPosts(filter: {
    personByAuthorId: { createdAt: { greaterThan: "2018-01-01" } }
  }) {
    ...
  }
}
```

</details>

<details>

<summary>Relations: Root-level, one-to-one</summary>

> Requires `connectionFilterRelations: true`

```graphql
query {
  allPeople(filter: {
    accountByPersonId: { status: { equalTo: ACTIVE } }
  }) {
    ...
  }
}
```

</details>

<details>

<summary>Relations: Root-level, one-to-many</summary>

> Requires `connectionFilterRelations: true`

One-to-many relation fields require the filter criteria to be nested under `every`, `some`, or `none`.

```graphql
query {
  allPeople(filter: {
    postsByAuthorId: {
      some: {
        status: { equalTo: PUBLISHED }
      }
    }
  }) {
    nodes {
      id
      createdAt
    }
  }
}
```

There is also an `exist` Boolean field for evaluating whether any related objects exist.

```graphql
query {
  allPeople(filter: {
    postsByAuthorId: {
      exist: true
    }
  }) {
    nodes {
      id
      createdAt
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

```js
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

```js
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

```js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterComputedColumns: false, // default: true
  },
})
```

</details>

<details>

<summary>connectionFilterLists</summary>

Enable/disable filtering on List fields:

```js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterLists: false, // default: true
  },
})
```

</details>

<details>

<summary>connectionFilterOperatorNames</summary>

Use alternative names (e.g. `eq`, `ne`) for operators:

```js
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

<summary>connectionFilterRelations</summary>

Enable/disable filtering on related fields:

```js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterRelations: true, // default: false
  },
})
```

</details>

<details>

<summary>connectionFilterSetofFunctions</summary>

Enable/disable filtering on functions that return `setof`:

```js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterSetofFunctions: false, // default: true
  },
})
```

</details>

<details>

<summary>connectionFilterLogicalOperators</summary>

Enable/disable filtering with logical operators (`and`/`or`/`not`):

```js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterLogicalOperators: false, // default: true
  },
})
```

</details>

<details>

<summary>connectionFilterAllowNullInput</summary>

Allow/forbid `null` literals in input:

```js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterAllowNullInput: true, // default: false
  },
})
```

When `false`, passing `null` as a field value will throw an error.
When `true`, passing `null` as a field value is equivalent to omitting the field.

</details>

<details>

<summary>connectionFilterAllowEmptyObjectInput</summary>

Allow/forbid empty objects (`{}`) in input:

```js
postgraphile(pgConfig, schema, {
  graphileBuildOptions: {
    connectionFilterAllowEmptyObjectInput: true, // default: false
  },
})
```

When `false`, passing `{}` as a field value will throw an error.
When `true`, passing `{}` as a field value is equivalent to omitting the field.

</details>

## Development

To establish a test environment, create an empty Postgres database (e.g. `graphile_build_test`) and set a `TEST_DATABASE_URL` environment variable with your connection string (e.g. `postgres://localhost:5432/graphile_build_test`).  Ensure that `psql` is installed locally and then run:
```bash
yarn
npm run test
```