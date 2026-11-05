import { PgConditionArgumentPlugin } from "graphile-build-pg";
import { makeFilterOperatorProfilesPlugin } from "../../../src/index";
import CustomOperatorsPlugin from "../../customOperatorsPlugin";
import { printSchemaOrdered, withTransaction } from "../../helpers";
import { createPostGraphileSchema } from "./core";

const ProfileOwnOperatorPlugin: GraphileConfig.Plugin = {
  name: "OperatorProfilesOwnOperatorTestPlugin",
  version: "0.0.0",

  schema: {
    hooks: {
      init(_, build) {
        const { sql, addConnectionFilterOperator, EXPORTABLE } = build;
        // addConnectionFilterOperator registers against the filter type of the
        // given object type name; "StringSearch" is the name whose filter type
        // is the "search" profile type for String (StringSearchFilter).
        addConnectionFilterOperator("StringSearch", "shapeEqual", {
          description: "Shape equal to the specified value.",
          resolve: EXPORTABLE((sql) => (i, v) => sql`${i} = ${v}`, [sql]),
        });
        return _;
      },
    },
  },
};

test("an operator added by addConnectionFilterOperator survives a column opting into a profile", () =>
  withTransaction(async (client) => {
    await client.query(`
      create schema operator_profiles_addons_test;
      create table operator_profiles_addons_test.item (
        id serial primary key,
        ip inet,
        ip2 inet
      );
      comment on column operator_profiles_addons_test.item.ip is E'@behavior +attribute:filterBy:net';
    `);
    const schema = await createPostGraphileSchema(
      client,
      ["operator_profiles_addons_test"],
      {
        skipPlugins: [PgConditionArgumentPlugin],
        disableDefaultMutations: true,
        legacyRelations: "omit",
        graphileBuildOptions: {
          connectionFilterAllowedOperators: ["equalTo"],
        },
      } as any,
      {
        plugins: [
          CustomOperatorsPlugin,
          makeFilterOperatorProfilesPlugin({ net: ["contains"] }),
        ],
      }
    );
    const printed = printSchemaOrdered(schema);
    // The neighbour without the profile keeps the custom operator:
    expect(printed).toMatch(/input InternetAddressFilter \{[^}]*familyEqualTo/);
    // The opted-in column must not silently lose it:
    expect(printed).toMatch(
      /input InternetAddressNetFilter \{[^}]*familyEqualTo/
    );
  }));

test("a profile may name an operator added by addConnectionFilterOperator", () =>
  withTransaction(async (client) => {
    await client.query(`
      create schema operator_profiles_addons_test;
      create table operator_profiles_addons_test.item (
        id serial primary key,
        ip inet
      );
      comment on column operator_profiles_addons_test.item.ip is E'@behavior +attribute:filterBy:net';
    `);
    const schema = await createPostGraphileSchema(
      client,
      ["operator_profiles_addons_test"],
      {
        skipPlugins: [PgConditionArgumentPlugin],
        disableDefaultMutations: true,
        legacyRelations: "omit",
      } as any,
      {
        plugins: [
          CustomOperatorsPlugin,
          makeFilterOperatorProfilesPlugin({ net: ["familyEqualTo"] }),
        ],
      }
    );
    expect(printSchemaOrdered(schema)).toMatch(
      /input InternetAddressNetFilter \{[^}]*familyEqualTo/
    );
  }));

test("a profile may consist of an operator added for the profile type itself", () =>
  withTransaction(async (client) => {
    await client.query(`
      create schema operator_profiles_addons_test;
      create table operator_profiles_addons_test.item (
        id serial primary key,
        title text
      );
      comment on column operator_profiles_addons_test.item.title is E'@behavior +attribute:filterBy:search';
    `);
    const schema = await createPostGraphileSchema(
      client,
      ["operator_profiles_addons_test"],
      {
        skipPlugins: [PgConditionArgumentPlugin],
        disableDefaultMutations: true,
        legacyRelations: "omit",
      } as any,
      {
        plugins: [
          ProfileOwnOperatorPlugin,
          makeFilterOperatorProfilesPlugin({ search: ["shapeEqual"] }),
        ],
      }
    );
    expect(printSchemaOrdered(schema)).toMatch(
      /input StringSearchFilter \{[^}]*shapeEqual/
    );
  }));
