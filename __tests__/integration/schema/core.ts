import * as pg from "pg";
import { createPostGraphileSchema } from "postgraphile-core";
import { printSchemaOrdered, withPgClient } from "../../helpers";

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
