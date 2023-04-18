import { PgConditionStep, TYPES } from "@dataplan/pg";
import { getComputedAttributeResources } from "./utils";

const { version } = require("../package.json");

export const PgConnectionArgFilterComputedAttributesPlugin: GraphileConfig.Plugin =
  {
    name: "PgConnectionArgFilterComputedAttributesPlugin",
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
            !codec.attributes ||
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

          const computedAttributeResources = getComputedAttributeResources(
            build,
            source
          );

          for (const computedAttributeResource of computedAttributeResources) {
            // Must return a scalar or an array
            if (!computedAttributeResource.isUnique) {
              continue;
            }
            if (computedAttributeResource.codec.attributes) {
              continue;
            }
            if (computedAttributeResource.codec === TYPES.void) {
              continue;
            }

            const digest = connectionFilterOperatorsDigest(
              computedAttributeResource.codec
            );
            if (!digest) {
              continue;
            }
            const OperatorsType = build.getTypeByName(digest.operatorsTypeName);
            if (!OperatorsType) {
              continue;
            }

            const behavior = build.pgGetBehavior([
              computedAttributeResource.extensions,
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
                computedAttributeResource,
                computedAttributeResource.parameters!.slice(1)
              );

            // Must have only one required argument
            if (argDetails.some((a) => a.required)) {
              continue;
            }

            // Looks good

            const fieldName = inflection.computedAttributeField({
              resource: computedAttributeResource,
            });

            const functionResultCodec = computedAttributeResource.codec;

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
                      if (
                        typeof computedAttributeResource.from !== "function"
                      ) {
                        throw new Error(`Unexpected...`);
                      }
                      const expression = computedAttributeResource.from({
                        placeholder: $where.alias,
                      });
                      const $col = new PgConditionStep($where);
                      $col.extensions.pgFilterAttribute = {
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
