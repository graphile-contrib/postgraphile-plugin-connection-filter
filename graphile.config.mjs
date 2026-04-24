// @ts-check
import "postgraphile";
import "./dist/index.js";
import { makePgService } from "postgraphile/@dataplan/pg/adaptors/pg";
import { makeV4Preset } from "postgraphile/presets/v4";

/** @type {GraphileConfig.Preset} */
const preset = {
  extends: [makeV4Preset({})],
  pgServices: [
    makePgService({
      connectionString: "postgres:///graphile_test_c",
      schemas: ["p"],
    }),
  ],
};

export default preset;
