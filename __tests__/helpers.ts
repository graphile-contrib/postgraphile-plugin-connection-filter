import * as pg from "pg";
import { parse, buildASTSchema, GraphQLSchema } from "graphql";
import { printSchema } from "graphql/utilities";

export async function withPgPool<T>(
  cb: (pool: pg.Pool) => Promise<T>
): Promise<T> {
  const pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
  });
  try {
    return await cb(pool);
  } finally {
    pool.end();
  }
}

export async function withPgClient<T>(
  cb: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  return withPgPool(async (pool) => {
    const client = await pool.connect();
    try {
      return await cb(client);
    } finally {
      client.release();
    }
  });
}

export async function withTransaction<T>(
  cb: (client: pg.PoolClient) => Promise<T>,
  closeCommand = "rollback"
): Promise<T> {
  return withPgClient(async (client) => {
    await client.query("begin");
    try {
      return await cb(client);
    } finally {
      await client.query(closeCommand);
    }
  });
}

export function printSchemaOrdered(originalSchema: GraphQLSchema): string {
  // Clone schema so we don't damage anything
  const schema = buildASTSchema(parse(printSchema(originalSchema)));

  const typeMap = schema.getTypeMap();
  Object.keys(typeMap).forEach((name) => {
    const gqlType = typeMap[name];

    // Object?
    if ("getFields" in gqlType) {
      const fields = gqlType.getFields();
      const keys = Object.keys(fields).sort();
      keys.forEach((key) => {
        const value = fields[key];

        // Move the key to the end of the object
        delete fields[key];
        fields[key] = value;

        // Sort args
        if ("args" in value) {
          value.args.sort((a, b) => a.name.localeCompare(b.name));
        }
      });
    }

    // Enum?
    if ("getValues" in gqlType) {
      gqlType.getValues().sort((a, b) => a.name.localeCompare(b.name));
    }
  });

  return printSchema(schema);
}
