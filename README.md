# postgraphile-filter-plugins
This set of plugins adds a new `filter:` argument to Connection types in PostGraphile v4.  No changes are made to the existing `condition:` argument.

## Disclaimer

This is an alpha-stage plugin for an alpha release of PostGraphile.  Bug reports and pull requests are very much welcome.

## Usage

You'll need to load all three plugins (ConnectionArgFilterPlugin, PgConnectionArgFilterPlugin, and PgConnectionArgFilterOperatorsPlugin) for the filter argument to work.  The available operators can be customized by modifying PgConnectionArgFilterOperatorsPlugin.js.

### CLI

``` bash
postgraphile --append-plugins `pwd`/src/ConnectionArgFilterPlugin.js,`pwd`/src/PgConnectionArgFilterPlugin.js,`pwd`/src/PgConnectionArgFilterOperatorsPlugin.js
```

### Library

``` js
const express = require("express");
const { postgraphql } = require("postgraphile");
const ConnectionArgFilterPlugin = require("./src/ConnectionArgFilterPlugin.js");
const PgConnectionArgFilterPlugin = require("./src/PgConnectionArgFilterPlugin.js");
const PgConnectionArgFilterOperatorsPlugin = require("./src/PgConnectionArgFilterOperatorsPlugin.js");

const app = express();

app.use(
  postgraphql(pgConfig, schema, {
    graphiql: true,
    appendPlugins: [
      ConnectionArgFilterPlugin,
      PgConnectionArgFilterPlugin,
      PgConnectionArgFilterOperatorsPlugin,
    ],
  })
);

app.listen(3000);
```

Plugin options can be passed via `graphqlBuildOptions`:

#### connectionFilterUsesShortNames
Use short names (e.g. eq, ne, lt, lte) for operators
``` js
postgraphql(pgConfig, schema, {
  ...
  graphqlBuildOptions: {
    connectionFilterUsesShortNames: true,
  },
})
```

#### connectionFilterAllowedFieldTypes
Restrict filters to specific field types
``` js
postgraphql(pgConfig, schema, {
  ...
  graphqlBuildOptions: {
    connectionFilterAllowedFieldTypes: ["String", "Int"],
  },
})
```
