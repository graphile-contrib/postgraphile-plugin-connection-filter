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
    note text,
    tags text[],
    payload json,
    count int
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

test("fails when a profile adds no operator for the column type", () =>
  withTransaction(async (client) => {
    await client.query(setup);
    await client.query(
      `comment on column operator_profiles_test.item.count is E'@behavior +attribute:filterBy:search';`
    );
    await expect(
      buildSchema(
        client,
        makeFilterOperatorProfilesPlugin({ search: ["startsWith"] })
      )
    ).rejects.toThrow(
      'Operator profile "search" adds no operator for column "operator_profiles_test.item.count" (type "int4")'
    );
  }));

test("fails when a profile type name collides with an existing filter type", () =>
  withTransaction(async (client) => {
    await client.query(setup);
    await client.query(
      `comment on column operator_profiles_test.item.title is E'@behavior +attribute:filterBy:list';`
    );
    await expect(
      buildSchema(
        client,
        makeFilterOperatorProfilesPlugin({ list: ["includes"] })
      )
    ).rejects.toThrow(
      'Operator profile "list" generates filter type name "StringListFilter" for "String" fields, which is already the base filter type for "String List" fields'
    );
  }));

test("fails when a profile type name collides with an object filter type", () =>
  withTransaction(async (client) => {
    await client.query(`
      create schema operator_profiles_test;
      create table operator_profiles_test.string_search (id serial primary key);
      create table operator_profiles_test.item (id serial primary key, title text);
      comment on column operator_profiles_test.item.title is E'@behavior +attribute:filterBy:search';
    `);
    await expect(
      buildSchema(
        client,
        makeFilterOperatorProfilesPlugin({ search: ["includes"] })
      )
    ).rejects.toThrow(
      'Operator profile "search" generates filter type name "StringSearchFilter" for "String" fields, which is already the connection filter type of the "StringSearch" object type'
    );
  }));

test("fails when two profiles generate the same filter type name", () =>
  withTransaction(async (client) => {
    await client.query(setup);
    await client.query(
      `comment on column operator_profiles_test.item.title is E'@behavior +attribute:filterBy:search';
       comment on column operator_profiles_test.item.note is E'@behavior +attribute:filterBy:Search';`
    );
    await expect(
      buildSchema(
        client,
        makeFilterOperatorProfilesPlugin({
          search: ["includes"],
          Search: ["startsWith"],
        })
      )
    ).rejects.toThrow(
      'Operator profiles "search" and "Search" both generate filter type name "StringSearchFilter"'
    );
  }));

test("names connectionFilterAllowedFieldTypes when it removes a profiled column's filter", () =>
  withTransaction(async (client) => {
    await client.query(setup);
    await client.query(
      `comment on column operator_profiles_test.item.title is E'@behavior +attribute:filterBy:search';`
    );
    await expect(
      buildSchema(
        client,
        makeFilterOperatorProfilesPlugin({ search: ["includes"] }),
        { graphileBuildOptions: { connectionFilterAllowedFieldTypes: ["Int"] } }
      )
    ).rejects.toThrow(
      'Column "operator_profiles_test.item.title" opts into operator profile "search" but "connectionFilterAllowedFieldTypes" does not include the GraphQL type "String"'
    );
  }));

test("names connectionFilterArrays when it removes a profiled column's filter", () =>
  withTransaction(async (client) => {
    await client.query(setup);
    await client.query(
      `comment on column operator_profiles_test.item.tags is E'@behavior +attribute:filterBy:arrayOps';`
    );
    await expect(
      buildSchema(
        client,
        makeFilterOperatorProfilesPlugin({ arrayOps: ["contains"] }),
        { graphileBuildOptions: { connectionFilterArrays: false } }
      )
    ).rejects.toThrow(
      'Column "operator_profiles_test.item.tags" opts into operator profile "arrayOps" but "connectionFilterArrays" is false for its list type'
    );
  }));

test("rejects a profile without operators", () => {
  expect(() => makeFilterOperatorProfilesPlugin({ search: [] })).toThrow(
    'Operator profile "search" in makeFilterOperatorProfilesPlugin lists no operators'
  );
});

test("rejects a profile with a non-string operator name", () => {
  expect(() =>
    makeFilterOperatorProfilesPlugin({ search: [42 as any] })
  ).toThrow("contains an invalid operator name");
});

test("rejects a profile name that is not a behavior string segment", () => {
  expect(() =>
    makeFilterOperatorProfilesPlugin({ "search-insensitive": ["includes"] })
  ).toThrow('Invalid operator profile name "search-insensitive"');
});
