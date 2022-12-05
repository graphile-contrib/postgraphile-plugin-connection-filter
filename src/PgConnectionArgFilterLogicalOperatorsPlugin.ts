import { PgConditionStep } from "@dataplan/pg";
import { FieldArgs } from "grafast";

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

          const assertAllowed = (fieldArgs: FieldArgs, checkObjToo = false) => {
            const $raw = fieldArgs.getRaw();
            if (
              checkObjToo &&
              !connectionFilterAllowEmptyObjectInput &&
              "evalIsEmpty" in $raw &&
              $raw.evalIsEmpty()
            ) {
              throw Object.assign(
                new Error(
                  "Empty objects are forbidden in filter argument input."
                ),
                {
                  //TODO: mark this error as safe
                }
              );
            }
            if (!connectionFilterAllowNullInput && $raw.evalIs(null)) {
              throw Object.assign(
                new Error(
                  "Null literals are forbidden in filter argument input."
                ),
                {
                  //TODO: mark this error as safe
                }
              );
            }
          };

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
                  assertAllowed(fieldArgs);
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
                  assertAllowed(fieldArgs);
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
                  assertAllowed(fieldArgs, true);
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
