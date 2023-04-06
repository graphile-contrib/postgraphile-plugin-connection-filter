import { PgConditionStep, TYPES } from "@dataplan/pg";
import { getComputedColumnResources } from "./utils";

const { version } = require("../package.json");

export const PgConnectionArgFilterComputedColumnsPlugin: GraphileConfig.Plugin =
  {
    name: "PgConnectionArgFilterComputedColumnsPlugin",
    version,

    schema: {
      hooks: {
        GraphQLInputObjectType_fields(inFields, build, context) {
          let fields = inFields;
          const {
            extend,
            sql,
            inflection,
            connectionFilterOperatorsDigest,
            options: { connectionFilterComputedColumns },
          } = build;
          const {
            fieldWithHooks,
            scope: { pgCodec: codec, isPgConnectionFilter },
            Self,
          } = context;

          if (
            !isPgConnectionFilter ||
            !codec ||
            !codec.columns ||
            codec.isAnonymous
          ) {
            return fields;
          }

          // TODO: This may need to change once V5 fixes the need for it
          const source = Object.values(build.input.pgRegistry.pgResources).find(
            (s) => s.codec === codec && !s.parameters && !s.isUnique
          );
          if (!source) {
            return fields;
          }

          const computedColumnResources = getComputedColumnResources(
            build,
            source
          );

          for (const computedColumnResource of computedColumnResources) {
            // Must return a scalar or an array
            if (!computedColumnResource.isUnique) {
              continue;
            }
            if (computedColumnResource.codec.columns) {
              continue;
            }
            if (computedColumnResource.codec === TYPES.void) {
              continue;
            }

            const digest = connectionFilterOperatorsDigest(
              computedColumnResource.codec
            );
            if (!digest) {
              continue;
            }
            const OperatorsType = build.getTypeByName(digest.operatorsTypeName);
            if (!OperatorsType) {
              continue;
            }

            const behavior = build.pgGetBehavior([
              computedColumnResource.extensions,
            ]);

            const defaultBehavior = connectionFilterComputedColumns
              ? "filterBy"
              : "";
            if (
              !build.behavior.matches(behavior, "filterBy", defaultBehavior)
            ) {
              continue;
            }

            const { argDetails, makeFieldArgs, makeArgs, makeExpression } =
              build.pgGetArgDetailsFromParameters(
                computedColumnResource,
                computedColumnResource.parameters!.slice(1)
              );

            // Must have only one required argument
            if (argDetails.some((a) => a.required)) {
              continue;
            }

            // Looks good

            const fieldName = inflection.computedColumnField({
              resource: computedColumnResource,
            });

            const functionResultCodec = computedColumnResource.codec;

            fields = build.extend(
              fields,
              {
                [fieldName]: fieldWithHooks(
                  {
                    fieldName,
                    isPgConnectionFilterField: true,
                  },
                  {
                    description: `Filter by the object’s \`${fieldName}\` field.`,
                    type: OperatorsType,
                    applyPlan($where: PgConditionStep<any>, fieldArgs) {
                      if (typeof computedColumnResource.source !== "function") {
                        throw new Error(`Unexpected...`);
                      }
                      const expression = computedColumnResource.source({
                        placeholder: $where.alias,
                      });
                      const $col = new PgConditionStep($where);
                      $col.extensions.pgFilterColumn = {
                        codec: functionResultCodec,
                        expression,
                      };
                      fieldArgs.apply($col);
                    },
                  }
                ),
              },
              ""
            );
          }
          return fields;
        },
      },
    },
  };
