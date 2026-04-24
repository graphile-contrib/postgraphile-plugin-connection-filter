import * as core from "./core";
import { PgConditionArgumentPlugin } from "graphile-build-pg";

test(
  "prints a schema with the filter plugin and the `ignoreIndexes: false` option",
  core.test(["p"], {
    skipPlugins: [PgConditionArgumentPlugin],
    disableDefaultMutations: true,
    legacyRelations: "omit",
    ignoreIndexes: false,
    graphileBuildOptions: {
      connectionFilterComputedColumns: false,
      connectionFilterSetofFunctions: false,
    },
  })
);
