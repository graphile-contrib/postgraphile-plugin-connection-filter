import type { PgCondition } from "@dataplan/pg";
import { makeAssertAllowed } from "./utils";

import { version } from "./version";

type LogicalOperatorInput = {
  and?: null | ReadonlyArray<LogicalOperatorInput>;
  or?: null | ReadonlyArray<LogicalOperatorInput>;
  not?: null | LogicalOperatorInput;
};

export const PgConnectionArgFilterLogicalOperatorsPlugin: GraphileConfig.Plugin =
  {
    name: "PgConnectionArgFilterLogicalOperatorsPlugin",
    version,

    schema: {
      hooks: {
        GraphQLInputObjectType_fields(fields, build, context) {
          const {
            extend,
            graphql: { GraphQLList, GraphQLNonNull },
            sql,
            EXPORTABLE,
          } = build;
          const {
            fieldWithHooks,
            scope: { isPgConnectionFilter },
            Self,
          } = context;

          if (!isPgConnectionFilter) return fields;

          if (Object.keys(fields).length === 0) {
            // Skip adding these operators if they would be the only fields
            return fields;
          }

          const assertAllowed = makeAssertAllowed(build);

          const logicalOperatorFields = {
            and: fieldWithHooks(
              {
                fieldName: "and",
                isPgConnectionFilterOperatorLogical: true,
              },
              {
                description: `Checks for all expressions in this list.`,
                type: new GraphQLList(new GraphQLNonNull(Self)),
                apply: EXPORTABLE(
                  (assertAllowed, sql) =>
                    function (
                      $where: PgCondition,
                      value: ReadonlyArray<LogicalOperatorInput> | null
                    ) {
                      assertAllowed(value, "list");
                      if (value == null) return;
                      const $and = $where.andPlan();
                      $and.where(sql.true);
                      // No need for this more correct form, easier to read if it's flatter.
                      // fieldArgs.apply(() => $and.andPlan());
                      return $and;
                    },
                  [assertAllowed, sql]
                ),
              }
            ),
            or: fieldWithHooks(
              {
                fieldName: "or",
                isPgConnectionFilterOperatorLogical: true,
              },
              {
                description: `Checks for any expressions in this list.`,
                type: new GraphQLList(new GraphQLNonNull(Self)),
                apply: EXPORTABLE(
                  (assertAllowed, sql) =>
                    function (
                      $where: PgCondition<any>,
                      value: ReadonlyArray<LogicalOperatorInput> | null
                    ) {
                      assertAllowed(value, "list");
                      if (value == null) return;
                      const $or = $where.orPlan();
                      $or.where(sql.false);
                      // Every entry is added to the `$or`, but the entries themselves should use an `and`.
                      return () => $or.andPlan();
                    },
                  [assertAllowed, sql]
                ),
              }
            ),
            not: fieldWithHooks(
              {
                fieldName: "not",
                isPgConnectionFilterOperatorLogical: true,
              },
              {
                description: `Negates the expression.`,
                type: Self,
                apply: EXPORTABLE(
                  (assertAllowed) =>
                    function (
                      $where: PgCondition<any>,
                      value: LogicalOperatorInput | null
                    ) {
                      assertAllowed(value, "object");
                      if (value == null) return;
                      const $not = $where.notPlan();
                      const $and = $not.andPlan();
                      $not.ignoreUnlessAmended();
                      return $and;
                    },
                  [assertAllowed]
                ),
              }
            ),
          };

          return extend(fields, logicalOperatorFields, "");
        },
      },
    },
  };
