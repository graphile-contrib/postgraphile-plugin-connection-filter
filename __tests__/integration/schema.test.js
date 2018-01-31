// TODO: There may be some excessive waste, if we could somehow filter what
// these guys see, that would be great 👍

const printSchemaOrdered = require("../printSchemaOrdered");
const { withPgClient } = require("../helpers");
const { createPostGraphQLSchema } = require("postgraphile-core");

// This test suite can be flaky. Increase it’s timeout.
jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000 * 20;

let testResults;

const testFixtures = [
  {
    name: "prints a schema with the filter plugin",
    createSchema: client =>
      createPostGraphQLSchema(client, ["a", "b", "c"], {
        appendPlugins: [require("../../index.js")]
      })
  },
  {
    name:
      "prints a schema with the filter plugin and the connectionFilterAllowedOperators option",
    createSchema: client =>
      createPostGraphQLSchema(client, ["a"], {
        appendPlugins: [require("../../index.js")],
        graphileBuildOptions: {
          connectionFilterAllowedOperators: ["equalTo", "notEqualTo"]
        }
      })
  },
  {
    name:
      "prints a schema with the filter plugin and the connectionFilterOperatorNames option",
    createSchema: client =>
      createPostGraphQLSchema(client, ["a"], {
        appendPlugins: [require("../../index.js")],
        graphileBuildOptions: {
          connectionFilterOperatorNames: {
            equalTo: "eq",
            notEqualTo: "ne",
          }
        }
      })
  }
];

beforeAll(() => {
  testResults = testFixtures.map(testFixture =>
    withPgClient(async client => {
      return await testFixture.createSchema(client);
    })
  );
});

for (let i = 0; i < testFixtures.length; i++) {
  test(testFixtures[i].name, async () => {
    expect(printSchemaOrdered(await testResults[i])).toMatchSnapshot();
  });
}
