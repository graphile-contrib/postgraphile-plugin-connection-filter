# postgraphile-filter-plugins
This set of plugins adds a new `filter:` argument to Connection types in PostGraphile v4.  No changes are made to the existing `condition:` argument.

## Disclaimer

This is an alpha-stage plugin for an alpha release of PostGraphile.  Bug reports and pull requests are very much welcome.

## Usage

You'll need to load all three plugins (FilterTypesPlugin, PgConnectionArgFilterPlugin, and PgConnectionArgFilterOperatorsPlugin) for the filter argument to work.  The available operators can be customized by modifying PgConnectionArgFilterOperatorsPlugin.js.

### CLI

``` bash
postgraphile --append-plugins `pwd`/src/FilterTypesPlugin.js,`pwd`/src/PgConnectionArgFilterPlugin.js,`pwd`/src/PgConnectionArgFilterOperatorsPlugin.js
```

### Library

``` js
const express = require("express");
const { postgraphql } = require("postgraphile");
const FilterTypesPlugin = require("./src/FilterTypesPlugin.js");
const PgConnectionArgFilterPlugin = require("./src/PgConnectionArgFilterPlugin.js");
const PgConnectionArgFilterOperatorsPlugin = require("./src/PgConnectionArgFilterOperatorsPlugin.js");

const app = express();

app.use(
  postgraphql("postgres://localhost:5432/postgres", "public", {
    graphiql: true,
    appendPlugins: [
      FilterTypesPlugin,
      PgConnectionArgFilterPlugin,
      PgConnectionArgFilterOperatorsPlugin,
    ],
  })
);

app.listen(3000);
```

