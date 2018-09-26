[![Package on npm](https://img.shields.io/npm/v/postgraphile-plugin-connection-filter.svg)](https://www.npmjs.com/package/postgraphile-plugin-connection-filter)

# postgraphile-plugin-connection-filter
This plugin adds a `filter` argument for advanced filtering of list types.

> **Note:** This plugin targets the beta/RC releases of PostGraphile v4. See the Compatibility table below for details.

> **Warning:** Use of this plugin (particularly with the default options) may make it **astoundingly trivial** for a malicious actor (or a well-intentioned application that generates complex GraphQL queries) to overwhelm your database with expensive queries. See the Performance and Security section for details.

## Breaking change in beta.15

The v1.0.0-beta.15 release of this plugin relies on the `pgOmit` function introduced in PostGraphile v4.0.0-rc.2 and the `inet` type support introduced in PostGraphile v4.0.0-rc.4.  As a result, the PostGraphile peer dependency was bumped to v4.0.0-rc.4 or later.

## Breaking change in beta.9

The deprecated `is` and `null` operators were removed. Use the `isNull` operator instead.

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
| 4.0.0-beta.0 - 4.0.0-beta.7 | 1.0.0-beta.0 - 1.0.0-beta.6 |
| 4.0.0-beta.8 - 4.0.0-rc.3 | 1.0.0-beta.7 - 1.0.0-beta.14 |
| 4.0.0-rc.4 or later | 1.0.0-beta.15 or later |

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
| &lt;&lt; | inetContainedBy | InternetAddress |
| &lt;&lt;= | inetContainedByOrEquals | InternetAddress |
| &gt;&gt; | inetContains | InternetAddress |
| &gt;&gt;= | inetContainsOrEquals | InternetAddress |
| &amp;&amp; | inetContainsOrIsContainedBy | InternetAddress |


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

<summary>connectionFilterLists</summary>

Enable/disable filtering on List fields:

``` js
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