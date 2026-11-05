import { PgConditionArgumentPlugin } from "graphile-build-pg";
import type * as pg from "pg";
import { makeFilterOperatorProfilesPlugin } from "../../../src/index";
import { printSchemaOrdered, withTransaction } from "../../helpers";
import { createPostGraphileSchema } from "./core";

const options = {
  skipPlugins: [PgConditionArgumentPlugin],
  disableDefaultMutations: true,
  legacyRelations: "omit",
};

const setup = `
  create schema operator_profiles_test;
  create table operator_profiles_test.item (
    id serial primary key,
    title text,
    tags text[],
    payload json
  );
`;

const buildSchema = (
  client: pg.PoolClient,
  plugin?: GraphileConfig.Plugin,
  extraOptions: Record<string, unknown> = {}
) =>
  createPostGraphileSchema(
    client,
    ["operator_profiles_test"],
    {
      ...options,
      ...extraOptions,
    } as any,
    plugin ? { plugins: [plugin] } : {}
  );

test("adding the plugin with no column opted in leaves the schema unchanged", () =>
  withTransaction(async (client) => {
    await client.query(setup);
    const base = await buildSchema(client);
    const withProfiles = await buildSchema(
      client,
      makeFilterOperatorProfilesPlugin({
        search: ["includes", "startsWith", "endsWith"],
      })
    );
    expect(printSchemaOrdered(withProfiles)).toBe(printSchemaOrdered(base));
  }));

test("fails when a profile lists an unknown operator", () =>
  withTransaction(async (client) => {
    await client.query(setup);
    await expect(
      buildSchema(
        client,
        makeFilterOperatorProfilesPlugin({ search: ["include"] })
      )
    ).rejects.toThrow(
      'Operator profile "search" lists unknown operator "include"'
    );
  }));

test("fails when a column opts into two profiles", () =>
  withTransaction(async (client) => {
    await client.query(setup);
    await client.query(
      `comment on column operator_profiles_test.item.title is E'@behavior +attribute:filterBy:search +attribute:filterBy:prefix';`
    );
    await expect(
      buildSchema(
        client,
        makeFilterOperatorProfilesPlugin({
          search: ["includes"],
          prefix: ["startsWith"],
        })
      )
    ).rejects.toThrow(
      'Column "operator_profiles_test.item.title" opts into more than one operator profile (search, prefix)'
    );
  }));

test("fails when a column opts into a profile but its filter is not published", () =>
  withTransaction(async (client) => {
    await client.query(setup);
    await client.query(
      `comment on column operator_profiles_test.item.title is E'@behavior +attribute:filterBy:search';`
    );
    await expect(
      buildSchema(
        client,
        makeFilterOperatorProfilesPlugin({ search: ["includes"] }),
        { ignoreIndexes: false }
      )
    ).rejects.toThrow(
      'Column "operator_profiles_test.item.title" opts into operator profile "search" but its filter is not published'
    );
  }));

test("fails when a column opts into a profile but its type has no filter operators", () =>
  withTransaction(async (client) => {
    await client.query(setup);
    await client.query(
      `comment on column operator_profiles_test.item.payload is E'@behavior +attribute:filterBy:search';`
    );
    await expect(
      buildSchema(
        client,
        makeFilterOperatorProfilesPlugin({ search: ["includes"] })
      )
    ).rejects.toThrow(
      'Column "operator_profiles_test.item.payload" opts into operator profile "search" but its type "json" has no filter operators'
    );
  }));

test("rejects a profile without operators", () => {
  expect(() => makeFilterOperatorProfilesPlugin({ search: [] })).toThrow(
    'Operator profile "search" in makeFilterOperatorProfilesPlugin lists no operators'
  );
});

test("rejects a profile name that is not a behavior string segment", () => {
  expect(() =>
    makeFilterOperatorProfilesPlugin({ "search-insensitive": ["includes"] })
  ).toThrow('Invalid operator profile name "search-insensitive"');
});
