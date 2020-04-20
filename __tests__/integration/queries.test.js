const { graphql } = require("graphql");
const { withPgClient } = require("../helpers");
const { createPostGraphileSchema } = require("postgraphile-core");
const { readdirSync, readFile: rawReadFile } = require("fs");
const { resolve: resolvePath } = require("path");
const { printSchema } = require("graphql/utilities");
const debug = require("debug")("graphile-build:schema");
const { PgConnectionArgCondition } = require("graphile-build-pg");
const CustomOperatorsPlugin = require("./../customOperatorsPlugin");

function readFile(filename, encoding) {
  return new Promise((resolve, reject) => {
    rawReadFile(filename, encoding, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

const queriesDir = `${__dirname}/../fixtures/queries`;
const queryFileNames = readdirSync(queriesDir);
let queryResults = [];

const kitchenSinkData = () => readFile(`${__dirname}/../p-data.sql`, "utf8");

beforeAll(() => {
  // Get a few GraphQL schema instance that we can query.
  const gqlSchemasPromise = withPgClient(async pgClient => {
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
        appendPlugins: [require("../../index.js")],
      }),
      createPostGraphileSchema(pgClient, ["p"], {
        skipPlugins: [PgConnectionArgCondition],
        appendPlugins: [require("../../index.js")],
        dynamicJson: true,
      }),
      createPostGraphileSchema(pgClient, ["p"], {
        skipPlugins: [PgConnectionArgCondition],
        appendPlugins: [require("../../index.js")],
        graphileBuildOptions: {
          pgUseCustomNetworkScalars: true,
        },
      }),
      createPostGraphileSchema(pgClient, ["p"], {
        skipPlugins: [PgConnectionArgCondition],
        appendPlugins: [require("../../index.js")],
        graphileBuildOptions: {
          connectionFilterRelations: true,
        },
      }),
      createPostGraphileSchema(pgClient, ["p"], {
        skipPlugins: [PgConnectionArgCondition],
        appendPlugins: [require("../../index.js")],
        simpleCollections: "only",
      }),
      createPostGraphileSchema(pgClient, ["p"], {
        skipPlugins: [PgConnectionArgCondition],
        appendPlugins: [require("../../index.js")],
        graphileBuildOptions: {
          connectionFilterAllowNullInput: true,
          connectionFilterAllowEmptyObjectInput: true,
        },
      }),
      createPostGraphileSchema(pgClient, ["p"], {
        skipPlugins: [PgConnectionArgCondition],
        appendPlugins: [require("../../index.js"), CustomOperatorsPlugin],
      }),
    ]);
    debug(printSchema(normal));
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

  // Execute all of the queries in parallel. We will not wait for them to
  // resolve or reject. The tests will do that.
  //
  // All of our queries share a single client instance.
  const queryResultsPromise = (async () => {
    // Wait for the schema to resolve. We need the schema to be introspected
    // before we can do anything else!
    const gqlSchemas = await gqlSchemasPromise;
    // Get a new Postgres client instance.
    return await withPgClient(async pgClient => {
      // Add data to the client instance we are using.
      await pgClient.query(await kitchenSinkData());
      // Run all of our queries in parallel.
      return await Promise.all(
        queryFileNames.map(async fileName => {
          // Read the query from the file system.
          const query = await readFile(
            resolvePath(queriesDir, fileName),
            "utf8"
          );
          // Get the appropriate GraphQL schema for this fixture. We want to test
          // some specific fixtures against a schema configured slightly
          // differently.
          const schemas = {
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
          const gqlSchema = schemas[fileName]
            ? schemas[fileName]
            : gqlSchemas.normal;
          // Return the result of our GraphQL query.
          const result = await graphql(gqlSchema, query, null, {
            pgClient: pgClient,
          });
          if (result.errors) {
            console.log(result.errors.map(e => e.originalError)); // eslint-disable-line no-console
          }
          return result;
        })
      );
    });
  })();

  // Flatten out the query results promise.
  queryResults = queryFileNames.map(async (_, i) => {
    return await (await queryResultsPromise)[i];
  });
});

for (let i = 0; i < queryFileNames.length; i++) {
  test(queryFileNames[i], async () => {
    expect(await queryResults[i]).toMatchSnapshot();
  });
}
