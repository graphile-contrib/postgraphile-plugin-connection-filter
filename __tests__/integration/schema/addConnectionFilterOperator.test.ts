import * as core from "./core";
import { PgConditionArgumentPlugin } from "graphile-build-pg";
import CustomOperatorsPlugin from "../../customOperatorsPlugin";

test(
  "prints a schema with the filter plugin and a custom operators plugin using addConnectionFilterOperator",
  core.test(["p"], {
    skipPlugins: [PgConditionArgumentPlugin],
    appendPlugins: [CustomOperatorsPlugin],
    disableDefaultMutations: true,
    legacyRelations: "omit",
  })
);
