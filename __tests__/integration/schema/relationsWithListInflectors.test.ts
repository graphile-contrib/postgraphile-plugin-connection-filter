import * as core from "./core";
import { PgConditionArgumentPlugin } from "graphile-build-pg";
// TODO: import PgSimplify from "@graphile-contrib/pg-simplify-inflector";

test(
  "prints a schema with the filter plugin, the simplify plugin, and both `connectionFilterRelations` and `connectionFilterUseListInflectors` set to `true`",
  core.test(["p"], {
    skipPlugins: [PgConditionArgumentPlugin],
    // TODO: appendPlugins: [PgSimplify],
    disableDefaultMutations: true,
    legacyRelations: "omit",
    simpleCollections: "both",
    graphileBuildOptions: {
      connectionFilterRelations: true,
      pgOmitListSuffix: true,
      connectionFilterUseListInflectors: true,
    },
  })
);
