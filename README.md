[![Package on npm](https://img.shields.io/npm/v/postgraphile-plugin-connection-filter.svg)](https://www.npmjs.com/package/postgraphile-plugin-connection-filter)

# postgraphile-plugin-connection-filter

Adds a powerful suite of filtering capabilities to a PostGraphile schema.

> [!WARNING]
> Use of this plugin with the default options may make it **astoundingly trivial** for a malicious actor (or a well-intentioned application that generates complex GraphQL queries) to overwhelm your database with expensive queries. See the [Performance and Security](https://github.com/graphile-contrib/postgraphile-plugin-connection-filter#performance-and-security) section below for details.

## Usage

Install with:

```
yarn add postgraphile postgraphile-plugin-connection-filter
```

Add to your `graphile.config.ts` configuration:

```ts
import { makePgService } from "postgraphile/adaptors/pg";
import { PostGraphileAmberPreset } from "postgraphile/presets/amber";
import { PostGraphileConnectionFilterPreset } from "postgraphile-plugin-connection-filter";

const preset: GraphileConfig.Preset = {
  extends: [PostGraphileAmberPreset, PostGraphileConnectionFilterPreset],
  pgServices: [
    makePgService({
      connectionString: process.env.DATABASE_URL!,
      schemas: ["app_public"],
    }),
  ],
};

export default preset;
```

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
- Set `connectionFilterArrays: false` to prevent filtering on List fields (Postgres arrays).

Also see the [Production Considerations](https://www.graphile.org/postgraphile/production) page of the official PostGraphile docs, which discusses query whitelisting.

## Features

This plugin supports filtering on almost all PostgreSQL types, including complex types such as domains, ranges, arrays, and composite types. For details on the specific operators supported for each type, see [docs/operators.md](https://github.com/graphile-contrib/postgraphile-plugin-connection-filter/blob/master/docs/operators.md).

See also:

- [@graphile/pg-aggregates](https://github.com/graphile/pg-aggregates) - integrates with this plugin to enable powerful aggregate filtering
- [postgraphile-plugin-connection-filter-postgis](https://github.com/graphile-contrib/postgraphile-plugin-connection-filter-postgis) - adds PostGIS functions and operators for filtering on `geography`/`geometry` columns
- [postgraphile-plugin-fulltext-filter](https://github.com/mlipscombe/postgraphile-plugin-fulltext-filter) - adds a full text search operator for filtering on `tsvector` columns
- [postgraphile-plugin-unaccented-text-search-filter](https://github.com/spacefill/postgraphile-plugin-unaccented-text-search-filter) - adds unaccent text search operators

## Handling `null` and empty objects

By default, this plugin will throw an error when `null` literals or empty objects (`{}`) are included in `filter` input objects. This prevents queries with ambiguous semantics such as `filter: { field: null }` and `filter: { field: { equalTo: null } }` from returning unexpected results. For background on this decision, see https://github.com/graphile-contrib/postgraphile-plugin-connection-filter/issues/58.

To allow `null` and `{}` in inputs, use the `connectionFilterAllowNullInput` and `connectionFilterAllowEmptyObjectInput` options documented under [Plugin Options](https://github.com/graphile-contrib/postgraphile-plugin-connection-filter#plugin-options). Please note that even with `connectionFilterAllowNullInput` enabled, `null` is never interpreted as a SQL `NULL`; fields with `null` values are simply ignored when resolving the query.

## Plugin Options

These options live in the `schema` section of your Graphile config:

#### connectionFilterAllowedOperators

Restrict filtering to specific operators:

```ts
const preset: GraphileConfig.Preset = {
  extends: [PostGraphileConnectionFilterPreset],
  schema: {
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
};
```

#### connectionFilterAllowedFieldTypes

Restrict filtering to specific field types:

```ts
const preset: GraphileConfig.Preset = {
  extends: [PostGraphileConnectionFilterPreset],
  schema: {
    connectionFilterAllowedFieldTypes: ["String", "Int"],
  },
};
```

The available field types will depend on your database schema.

#### connectionFilterArrays

Enable/disable filtering on PostgreSQL arrays:

```ts
const preset: GraphileConfig.Preset = {
  extends: [PostGraphileConnectionFilterPreset],
  schema: {
    connectionFilterArrays: false, // default: true
  },
};
```

#### connectionFilterComputedColumns

Enable/disable filtering by computed columns:

```ts
const preset: GraphileConfig.Preset = {
  extends: [PostGraphileConnectionFilterPreset],
  schema: {
    connectionFilterComputedColumns: false, // default: true
  },
};
```

Consider setting this to `false` and using `@filterable` [smart comments](https://www.graphile.org/postgraphile/smart-comments/) to selectively enable filtering:

```sql
create function app_public.foo_computed(foo app_public.foo)
  returns ... as $$ ... $$ language sql stable;

comment on function app_public.foo_computed(foo app_public.foo) is E'@filterable';
```

#### connectionFilterOperatorNames

Use alternative names (e.g. `eq`, `ne`) for operators:

```ts
const preset: GraphileConfig.Preset = {
  extends: [PostGraphileConnectionFilterPreset],
  schema: {
    connectionFilterOperatorNames: {
      equalTo: "eq",
      notEqualTo: "ne",
    },
  },
};
```

#### connectionFilterRelations

Enable/disable filtering on related fields:

```ts
const preset: GraphileConfig.Preset = {
  extends: [PostGraphileConnectionFilterPreset],
  schema: {
    connectionFilterRelations: true, // default: false
  },
};
```

#### connectionFilterSetofFunctions

Enable/disable filtering on functions that return `setof`:

```ts
const preset: GraphileConfig.Preset = {
  extends: [PostGraphileConnectionFilterPreset],
  schema: {
    connectionFilterSetofFunctions: false, // default: true
  },
};
```

Consider setting this to `false` and using `@filterable` [smart comments](https://www.graphile.org/postgraphile/smart-comments/) to selectively enable filtering:

```sql
create function app_public.some_foos()
  returns setof ... as $$ ... $$ language sql stable;

comment on function app_public.some_foos() is E'@filterable';
```

#### connectionFilterLogicalOperators

Enable/disable filtering with logical operators (`and`/`or`/`not`):

```ts
const preset: GraphileConfig.Preset = {
  extends: [PostGraphileConnectionFilterPreset],
  schema: {
    connectionFilterLogicalOperators: false, // default: true
  },
};
```

#### connectionFilterAllowNullInput

Allow/forbid `null` literals in input:

```ts
const preset: GraphileConfig.Preset = {
  extends: [PostGraphileConnectionFilterPreset],
  schema: {
    connectionFilterAllowNullInput: true, // default: false
  },
};
```

When `false`, passing `null` as a field value will throw an error.
When `true`, passing `null` as a field value is equivalent to omitting the field.

#### connectionFilterAllowEmptyObjectInput

Allow/forbid empty objects (`{}`) in input:

```ts
const preset: GraphileConfig.Preset = {
  extends: [PostGraphileConnectionFilterPreset],
  schema: {
    connectionFilterAllowEmptyObjectInput: true, // default: false
  },
};
```

When `false`, passing `{}` as a field value will throw an error.
When `true`, passing `{}` as a field value is equivalent to omitting the field.

## Per-column operator profiles

`connectionFilterAllowedOperators` applies one operator set to every column of a
type. When a few more operators make sense only on specific columns — because
an index serves them there and not elsewhere — register **operator profiles**
and let a column opt into one:

```ts
import {
  makeFilterOperatorProfilesPlugin,
  PostGraphileConnectionFilterPreset,
} from "postgraphile-plugin-connection-filter";

const preset: GraphileConfig.Preset = {
  extends: [PostGraphileConnectionFilterPreset],
  plugins: [
    makeFilterOperatorProfilesPlugin({
      search: ["includes", "startsWith", "endsWith"],
      prefix: ["startsWith"],
    }),
  ],
  schema: {
    connectionFilterAllowedOperators: ["equalTo", "notEqualTo"],
  },
};
```

A profile maps to the canonical operator names that its filter input type adds
to the base set (the set limited by `connectionFilterAllowedOperators`; when that
option is not set every operator is already available and a profile adds
nothing). `connectionFilterOperatorNames` renames profile operators like any
other operator.

Profiles are off by default: a column opts in through the
`attribute:filterBy:<profile>` behavior, for example with a smart comment:

```sql
comment on column app_public.post.title is E'@behavior +attribute:filterBy:search';
```

The behavior can also be set by another plugin. The plugin does not check
indexes — the behavior is the configuration's promise that an access path
exists for that column.

The filter field of an opted-in column uses a separate input type carrying the
base operators plus the profile's:

- `${Type}${UpperCamel(profile)}Filter` — the `search` profile on a `String`
  field gives `StringSearchFilter`;
- for lists, `${Type}List${UpperCamel(profile)}Filter` — e.g.
  `StringListSearchFilter`.

Columns without the behavior keep the shared `${Type}Filter` type, so a profile
is visible only on the columns that opted in; this also holds inside relation
filters. Profiles are independent: each column can opt into one profile, and a
profile type exists only when some column uses it. A profile adds to the base
set and never removes from it: operators another plugin contributes through
`addConnectionFilterOperator` also appear on the profile type, and a profile may
name them.

Profiles are a schema-wide singleton, so add the factory plugin once with the
merged map of every profile the application needs. The plugin name is fixed, so
a second factory call is rejected — merge the maps into one call instead.

Schema build fails with an error naming the column, the profile and the type
when: a column opts into two profiles, a column with a profile has no published
filter (`attribute:filterBy` is off), a profile adds no operator the column's
type offers, a profile name produces a filter type name that is already taken,
or a profile names an operator that the plugin and its add-on plugins do not
know. A profile on a column of a table whose own filter is omitted (`@omit
filter` on the table) is accepted and has no effect: the table publishes no
filter input type for the profile to extend.

## Examples

```graphql
query {
  allPosts(filter: {
    createdAt: { greaterThan: "2021-01-01" }
  }) {
    ...
  }
}
```

For an extensive set of examples, see [docs/examples.md](https://github.com/graphile-contrib/postgraphile-plugin-connection-filter/blob/master/docs/examples.md).

## Development

To establish a test environment, create an empty PostgreSQL database with C collation (required for consistent ordering of strings) and set a `TEST_DATABASE_URL` environment variable with your database connection string.

```bash
createdb graphile_test_c --template template0 --lc-collate C
export TEST_DATABASE_URL=postgres://localhost:5432/graphile_test_c
yarn
yarn test
```
