const core = require("./core");
const { PgConnectionArgCondition } = require("graphile-build-pg");

test(
  "prints a schema with the filter plugin and the `connectionFilterAdditionalInsensitiveOperators: true` option",
  core.test(["p"], {
    skipPlugins: [PgConnectionArgCondition],
    appendPlugins: [require("../../../index.js")],
    disableDefaultMutations: true,
    legacyRelations: "omit",
    graphileBuildOptions: {
      connectionFilterAdditionalInsensitiveOperators: true,
    },
  })
);
