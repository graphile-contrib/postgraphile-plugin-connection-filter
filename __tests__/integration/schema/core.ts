import * as pg from "pg";
import { printSchemaOrdered, withPgClient } from "../../helpers";
import { postgraphilePresetAmber } from "postgraphile/presets/amber";
import { makeV4Preset, V4Options } from "postgraphile/presets/v4";
import { makeSchema } from "postgraphile";

const createPostGraphileSchema = async (
  pgClient: pg.PoolClient,
  schemas: string[],
  v4Options: V4Options,
  anotherPreset: GraphileConfig.Preset = {}
) => {
  const preset: GraphileConfig.Preset = {
    extends: [
      postgraphilePresetAmber,
      makeV4Preset(v4Options),
      ...(anotherPreset ? [anotherPreset] : []),
    ],
    pgSources: [
      {
        adaptor: "@dataplan/pg/adaptors/node-postgres",
        name: "main",
        withPgClientKey: "withPgClient",
        pgSettingsKey: "pgSettings",
        schemas: schemas,
        adaptorSettings: {
          poolClient: pgClient,
        },
      } as any, //GraphileConfig.PgDatabaseConfiguration<"@dataplan/pg/adaptors/node-postgres">,
    ],
  };
  const { schema } = await makeSchema(preset);
  return schema;
};

export const test =
  (
    schemas: string[],
    options: Record<string, unknown>,
    setup?: (client: pg.PoolClient) => void
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
      const schema = await createPostGraphileSchema(client, schemas, options);
      expect(printSchemaOrdered(schema)).toMatchSnapshot();
    });
