import * as core from "./core";
import { PgConditionArgumentPlugin } from "graphile-build-pg";
import { makeFilterOperatorProfilesPlugin } from "../../../src/index";

const operatorProfiles = makeFilterOperatorProfilesPlugin({
  search: ["includes", "startsWith", "endsWith"],
  prefix: ["startsWith"],
  arrayOps: ["contains"],
});

test(
  "prints a schema where columns opt into operator profiles on top of connectionFilterAllowedOperators",
  core.test(["p"], {
    skipPlugins: [PgConditionArgumentPlugin],
    disableDefaultMutations: true,
    legacyRelations: "omit",
    graphileBuildOptions: {
      connectionFilterAllowedOperators: ["equalTo", "notEqualTo"],
    },
    preset: {
      plugins: [operatorProfiles],
    },
  })
);

test(
  "prints a schema where profile operators follow connectionFilterOperatorNames",
  core.test(["p"], {
    skipPlugins: [PgConditionArgumentPlugin],
    disableDefaultMutations: true,
    legacyRelations: "omit",
    graphileBuildOptions: {
      connectionFilterAllowedOperators: ["equalTo", "notEqualTo"],
      connectionFilterOperatorNames: {
        equalTo: "eq",
        includes: "contains",
      },
    },
    preset: {
      plugins: [
        makeFilterOperatorProfilesPlugin({
          search: ["includes", "startsWith", "endsWith"],
          prefix: ["startsWith"],
          arrayOps: ["contains"],
        }),
      ],
    },
  })
);
