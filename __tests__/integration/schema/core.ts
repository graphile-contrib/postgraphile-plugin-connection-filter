import * as pg from "pg";
import * as adaptor from "postgraphile/@dataplan/pg/adaptors/pg";
import { printSchemaOrdered, withPgClient } from "../../helpers";
import { PostGraphileAmberPreset } from "postgraphile/presets/amber";
import { makeV4Preset, V4Options } from "postgraphile/presets/v4";
import { makeSchema } from "postgraphile";
import { PostGraphileConnectionFilterPreset } from "../../../src/index";
import { FilterAllPlugin } from "../../FilterAllPlugin";
import { GraphQLSchema } from "graphql";

const createPostGraphileSchema = async (
  pgClient: pg.PoolClient,
  schemas: string[],
  v4Options: V4Options,
  anotherPreset: GraphileConfig.Preset = {}
) => {
  const preset: GraphileConfig.Preset = {
    extends: [
      PostGraphileAmberPreset,
      PostGraphileConnectionFilterPreset,
      makeV4Preset(v4Options),
      ...(anotherPreset ? [anotherPreset] : []),
    ],
    plugins: [FilterAllPlugin],
    pgServices: [
      {
        adaptor,
        name: "main",
        withPgClientKey: "withPgClient",
        pgSettingsKey: "pgSettings",
        schemas: schemas,
        adaptorSettings: {
          poolClient: pgClient,
        },
      } as any, //GraphileConfig.PgDatabaseConfiguration<"@dataplan/pg/adaptors/pg">,
    ],
  };
  const { schema } = await makeSchema(preset);
  return schema;
};

export const test =
  (
    schemas: string[],
    config: V4Options & {
      legacyRelations?: string;
      preset?: GraphileConfig.Preset;
    },
    setup?: (client: pg.PoolClient) => void,
    moreAssertions?: (details: { schema: GraphQLSchema }) => void
  ) =>
  (): Promise<void> =>
    withPgClient(async (client) => {
      if (setup) {
        if (typeof setup === "function") {
          await setup(client);
        } else {
          await client.query(setup);
        }
      }
      const { preset, ...options } = config;
      const schema = await createPostGraphileSchema(
        client,
        schemas,
        options,
        preset
      );
      moreAssertions?.({ schema });
      expect(printSchemaOrdered(schema)).toMatchSnapshot();
    });
