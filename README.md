# postgraphile-plugin-connection-filter
This plugin adds a `filter:` argument to Connection types in PostGraphile v4.

## Disclaimer

These plugins target the alpha releases of PostGraphile v4.  Bug reports and pull requests are very much welcome.

## Compatibility

PostGraphile `4.0.0-alpha2.20` and earlier requires a `1.0.0-alpha.0` version of this plugin.

PostGraphile `4.0.0-alpha2.21` through 4.0.0-alpha2.25 requires a `1.0.0-alpha.1` version of this plugin.

PostGraphile `4.0.0-alpha2.26` and later requires a `1.0.0-alpha.2` version of this plugin.

## Usage

### CLI

``` bash
postgraphile --append-plugins `pwd`/path/to/this/plugin/index.js
```

### Library

``` js
const express = require("express");
const { postgraphile } = require("postgraphile");
const PostGraphileConnectionFilterPlugin = require("./path/to/this/plugin/index.js");

const app = express();

app.use(
  postgraphile(pgConfig, schema, {
    graphiql: true,
    appendPlugins: [PostGraphileConnectionFilterPlugin],
  })
);

app.listen(3000);
```

The following options can be passed via `graphileBuildOptions` (called `graphqlBuildOptions` in PostGraphile 4.0.0-alpha2.20 and earlier):

#### connectionFilterUsesShortNames
Use short names (e.g. eq, ne, lt, lte) for operators
``` js
postgraphile(pgConfig, schema, {
  ...
  graphileBuildOptions: {
    connectionFilterUsesShortNames: true,
  },
})
```

#### connectionFilterAllowedFieldTypes
Restrict filters to specific field types
``` js
postgraphile(pgConfig, schema, {
  ...
  graphileBuildOptions: {
    connectionFilterAllowedFieldTypes: ["String", "Int"],
  },
})
```

To add/remove/modify individual operators, you can edit src/PgConnectionArgFilterOperatorsPlugin.js.

## Development

To establish a test environment, create an empty Postgres database (e.g. `graphile_build_test`) and set a `TEST_DATABASE_URL` environment variable with your connection string (e.g. `postgres://localhost:5432/graphile_build_test`).  Ensure that `psql` is installed locally and then run:
``` bash
npm install
npm test
```