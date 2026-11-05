import { PgConditionArgumentPlugin } from "graphile-build-pg";
import { makeFilterOperatorProfilesPlugin } from "../../../src/index";
import CustomOperatorsPlugin from "../../customOperatorsPlugin";
import { printSchemaOrdered, withTransaction } from "../../helpers";
import { createPostGraphileSchema } from "./core";

test("an operator added by addConnectionFilterOperator survives a column opting into a profile", () =>
  withTransaction(async (client) => {
    await client.query(`
      create schema reviewer_profiles_test;
      create table reviewer_profiles_test.item (
        id serial primary key,
        ip inet,
        ip2 inet
      );
      comment on column reviewer_profiles_test.item.ip is E'@behavior +attribute:filterBy:net';
    `);
    const schema = await createPostGraphileSchema(
      client,
      ["reviewer_profiles_test"],
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
      create schema reviewer_profiles_test;
      create table reviewer_profiles_test.item (
        id serial primary key,
        ip inet
      );
      comment on column reviewer_profiles_test.item.ip is E'@behavior +attribute:filterBy:net';
    `);
    const schema = await createPostGraphileSchema(
      client,
      ["reviewer_profiles_test"],
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
