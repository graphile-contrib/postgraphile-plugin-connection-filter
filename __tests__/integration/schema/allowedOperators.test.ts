import * as core from "./core";
import { PgConnectionArgCondition } from "graphile-build-pg";
import ConnectionFilterPlugin from "../../../src/index";

test(
  "prints a schema with the filter plugin and the connectionFilterAllowedOperators option",
  core.test(["p"], {
    skipPlugins: [PgConnectionArgCondition],
    appendPlugins: [ConnectionFilterPlugin],
    disableDefaultMutations: true,
    legacyRelations: "omit",
    graphileBuildOptions: {
      connectionFilterAllowedOperators: ["equalTo", "notEqualTo"],
    },
  })
);
