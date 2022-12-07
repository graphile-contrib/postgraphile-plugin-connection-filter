import { PgConditionStep } from "@dataplan/pg";
import { FieldArgs } from "grafast";
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
            sql,
            options: {
              connectionFilterAllowNullInput,
              connectionFilterAllowEmptyObjectInput,
            },
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
                applyPlan($where: PgConditionStep<any>, fieldArgs) {
                  assertAllowed(fieldArgs, "list");
                  const $and = $where.andPlan();
                  fieldArgs.apply($and);
                },
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
                applyPlan($where: PgConditionStep<any>, fieldArgs) {
                  assertAllowed(fieldArgs, "list");
                  const $or = $where.orPlan();
                  fieldArgs.apply($or);
                },
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
                applyPlan($where: PgConditionStep<any>, fieldArgs) {
                  assertAllowed(fieldArgs, "object");
                  const $not = $where.notPlan();
                  fieldArgs.apply($not);
                },
              }
            ),
          };

          return extend(fields, logicalOperatorFields, "");
        },
      },
    },
  };
