# postgraphile-filter-plugins
These plugins add a new `filter:` argument to Connection types in PostGraphile v4.  No changes are made to the existing `condition:` argument.

## Disclaimer

These plugins target the alpha release of PostGraphile.  Bug reports and pull requests are very much welcome.

## Usage

### CLI

``` bash
postgraphile --append-plugins `pwd`/path/to/this/plugin/index.js
```

### Library

``` js
const express = require("express");
const { postgraphql } = require("postgraphile");
const GraphileBuildPgContribConnectionFilter = require("./path/to/this/plugin/index.js");

const app = express();

app.use(
  postgraphql(pgConfig, schema, {
    graphiql: true,
    appendPlugins: [GraphileBuildPgContribConnectionFilter],
  })
);

app.listen(3000);
```

The following options can be passed via `graphqlBuildOptions`:

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

## Customization

The operators exposed through GraphQL can be customized by modifying /src/PgConnectionArgFilterOperatorsPlugin.js.