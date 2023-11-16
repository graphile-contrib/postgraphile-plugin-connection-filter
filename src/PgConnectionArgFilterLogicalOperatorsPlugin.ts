import type { PgConditionStep } from "@dataplan/pg";
import { makeAssertAllowed } from "./utils";

const { version } = require("../package.json");

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

          const assertAllowed = makeAssertAllowed(build.options);

          const logicalOperatorFields = {
            and: fieldWithHooks(
              {
                fieldName: "and",
                isPgConnectionFilterOperatorLogical: true,
              },
              {
                description: `Checks for all expressions in this list.`,
                type: new GraphQLList(new GraphQLNonNull(Self)),
                applyPlan: build.EXPORTABLE(
                  () =>
                    function ($where: PgConditionStep<any>, fieldArgs) {
                      assertAllowed(fieldArgs, "list");
                      const $and = $where.andPlan();
                      // No need for this more correct form, easier to read if it's flatter.
                      // fieldArgs.apply(() => $and.andPlan());
                      fieldArgs.apply($and);
                    },
                  []
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
                applyPlan: build.EXPORTABLE(
                  () =>
                    function ($where: PgConditionStep<any>, fieldArgs) {
                      assertAllowed(fieldArgs, "list");
                      const $or = $where.orPlan();
                      // Every entry is added to the `$or`, but the entries themselves should use an `and`.
                      fieldArgs.apply(() => $or.andPlan());
                    },
                  []
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
                applyPlan: build.EXPORTABLE(
                  () =>
                    function ($where: PgConditionStep<any>, fieldArgs) {
                      assertAllowed(fieldArgs, "object");
                      const $not = $where.notPlan();
                      const $and = $not.andPlan();
                      fieldArgs.apply($and);
                    },
                  []
                ),
              }
            ),
          };

          return extend(fields, logicalOperatorFields, "");
        },
      },
    },
  };
