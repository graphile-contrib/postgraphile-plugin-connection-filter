import * as fs from "fs";
import * as path from "path";
import * as pg from "pg";
import { promisify } from "util";
import { GraphQLSchema, graphql } from "graphql";
import { withPgClient } from "../helpers";
import { createPostGraphileSchema } from "postgraphile-core";
import { PgConnectionArgCondition } from "graphile-build-pg";
import ConnectionFilterPlugin from "../../src/index";
import CustomOperatorsPlugin from "./../customOperatorsPlugin";

const readFile = promisify(fs.readFile);

const queriesDir = `${__dirname}/../fixtures/queries`;
const queryFileNames = fs.readdirSync(queriesDir);

let gqlSchemas: {
  normal: GraphQLSchema;
  dynamicJson: GraphQLSchema;
  networkScalars: GraphQLSchema;
  relations: GraphQLSchema;
  simpleCollections: GraphQLSchema;
  nullAndEmptyAllowed: GraphQLSchema;
  addConnectionFilterOperator: GraphQLSchema;
};

beforeAll(async () => {
  // Ensure process.env.TEST_DATABASE_URL is set
  if (!process.env.TEST_DATABASE_URL) {
    console.error(
      "ERROR: No test database configured; aborting. To resolve this, ensure environmental variable TEST_DATABASE_URL is set."
    );
    process.exit(1);
  }
  // Setup the DB schema and data
  await withPgClient(async (pgClient) => {
    await pgClient.query(
      await readFile(`${__dirname}/../p-schema.sql`, "utf8")
    );
    await pgClient.query(await readFile(`${__dirname}/../p-data.sql`, "utf8"));
  });
  // Get GraphQL schema instances that we can query.
  gqlSchemas = await withPgClient(async (pgClient) => {
    // Different fixtures need different schemas with different configurations.
    // Make all of the different schemas with different configurations that we
    // need and wait for them to be created in parallel.
    const [
      normal,
      dynamicJson,
      networkScalars,
      relations,
      simpleCollections,
      nullAndEmptyAllowed,
      addConnectionFilterOperator,
    ] = await Promise.all([
      createPostGraphileSchema(pgClient, ["p"], {
        skipPlugins: [PgConnectionArgCondition],
        appendPlugins: [ConnectionFilterPlugin],
      }),
      createPostGraphileSchema(pgClient, ["p"], {
        skipPlugins: [PgConnectionArgCondition],
        appendPlugins: [ConnectionFilterPlugin],
        dynamicJson: true,
      }),
      createPostGraphileSchema(pgClient, ["p"], {
        skipPlugins: [PgConnectionArgCondition],
        appendPlugins: [ConnectionFilterPlugin],
        graphileBuildOptions: {
          pgUseCustomNetworkScalars: true,
        },
      }),
      createPostGraphileSchema(pgClient, ["p"], {
        skipPlugins: [PgConnectionArgCondition],
        appendPlugins: [ConnectionFilterPlugin],
        graphileBuildOptions: {
          connectionFilterRelations: true,
        },
      }),
      createPostGraphileSchema(pgClient, ["p"], {
        skipPlugins: [PgConnectionArgCondition],
        appendPlugins: [ConnectionFilterPlugin],
        simpleCollections: "only",
      }),
      createPostGraphileSchema(pgClient, ["p"], {
        skipPlugins: [PgConnectionArgCondition],
        appendPlugins: [ConnectionFilterPlugin],
        graphileBuildOptions: {
          connectionFilterAllowNullInput: true,
          connectionFilterAllowEmptyObjectInput: true,
        },
      }),
      createPostGraphileSchema(pgClient, ["p"], {
        skipPlugins: [PgConnectionArgCondition],
        appendPlugins: [ConnectionFilterPlugin, CustomOperatorsPlugin],
      }),
    ]);
    return {
      normal,
      dynamicJson,
      networkScalars,
      relations,
      simpleCollections,
      nullAndEmptyAllowed,
      addConnectionFilterOperator,
    };
  });
});

for (const queryFileName of queryFileNames) {
  // eslint-disable-next-line jest/valid-title
  test(queryFileName, async () => {
    // Read the query from the file system.
    const query = await readFile(
      path.resolve(queriesDir, queryFileName),
      "utf8"
    );
    // Get the appropriate GraphQL schema for this fixture. We want to test
    // some specific fixtures against a schema configured slightly
    // differently.
    const gqlSchemaByQueryFileName: {
      [queryFileName: string]: GraphQLSchema;
    } = {
      "addConnectionFilterOperator.graphql":
        gqlSchemas.addConnectionFilterOperator,
      "dynamicJsonTrue.graphql": gqlSchemas.dynamicJson,
      "types.cidr.graphql": gqlSchemas.networkScalars,
      "types.macaddr.graphql": gqlSchemas.networkScalars,
      "arrayTypes.cidrArray.graphql": gqlSchemas.networkScalars,
      "arrayTypes.macaddrArray.graphql": gqlSchemas.networkScalars,
      "relations.graphql": gqlSchemas.relations,
      "simpleCollections.graphql": gqlSchemas.simpleCollections,
      "nullAndEmptyAllowed.graphql": gqlSchemas.nullAndEmptyAllowed,
    };
    const gqlSchema =
      queryFileName in gqlSchemaByQueryFileName
        ? gqlSchemaByQueryFileName[queryFileName]
        : gqlSchemas.normal;
    const result = await withPgClient(async (client: pg.PoolClient) =>
      graphql(gqlSchema, query, null, { pgClient: client })
    );
    expect(result).toMatchSnapshot();
  });
}
