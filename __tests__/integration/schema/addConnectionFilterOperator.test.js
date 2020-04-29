const core = require("./core");
const { PgConnectionArgCondition } = require("graphile-build-pg");
const CustomOperatorsPlugin = require("../../customOperatorsPlugin");

test(
  "prints a schema with the filter plugin and a custom operators plugin using addConnectionFilterOperator",
  core.test(["p"], {
    skipPlugins: [PgConnectionArgCondition],
    appendPlugins: [require("../../../index.js"), CustomOperatorsPlugin],
    disableDefaultMutations: true,
    legacyRelations: "omit",
  })
);
