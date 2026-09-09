import * as core from "./core";
import { GraphQLInputObjectType } from "graphql";
import { PgConditionArgumentPlugin } from "graphile-build-pg";
import { SillyInflectionPlugin } from "../../SillyInflectionPlugin";

test(
  "inflects connection-filter builtins",
  core.test(
    ["p"],
    {
      skipPlugins: [PgConditionArgumentPlugin],
      disableDefaultMutations: true,
      legacyRelations: "omit",
      preset: {
        plugins: [SillyInflectionPlugin],
      },
    },
    () => {},
    ({ schema }) => {
      const allFilterables = schema.getQueryType()!.getFields().allFilterables;
      expect(allFilterables.args.map((arg) => arg.name)).toContain(
        "zzz_filter"
      );
      expect(allFilterables.args.map((arg) => arg.name)).not.toContain(
        "filter"
      );

      const filterableFilter = schema.getType(
        "FilterableFilter"
      ) as GraphQLInputObjectType;
      expect(Object.keys(filterableFilter.getFields())).toEqual(
        expect.arrayContaining(["zzz_and", "zzz_or", "zzz_not"])
      );
      expect(Object.keys(filterableFilter.getFields())).not.toEqual(
        expect.arrayContaining(["and", "or", "not"])
      );

      const intFilter = schema.getType("IntFilter") as GraphQLInputObjectType;
      expect(Object.keys(intFilter.getFields())).toEqual(
        expect.arrayContaining(["zzz_equalTo", "zzz_notEqualTo", "zzz_isNull"])
      );
      expect(Object.keys(intFilter.getFields())).not.toEqual(
        expect.arrayContaining(["equalTo", "notEqualTo", "isNull"])
      );
    }
  )
);
