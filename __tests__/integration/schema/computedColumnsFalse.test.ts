import * as core from "./core";
import { PgConditionArgumentPlugin } from "graphile-build-pg";

test(
  "prints a schema with the filter plugin and the `connectionFilterComputedColumns: false` option",
  core.test(["p"], {
    skipPlugins: [PgConditionArgumentPlugin],
    disableDefaultMutations: true,
    legacyRelations: "omit",
    graphileBuildOptions: {
      connectionFilterComputedColumns: false,
    },
  })
);
