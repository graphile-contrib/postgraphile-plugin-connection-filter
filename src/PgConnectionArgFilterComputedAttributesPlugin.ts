import type { PgCondition } from "@dataplan/pg";
import {
  getComputedAttributeResources,
  isComputedScalarAttributeResource,
} from "./utils";
import type { FieldArgs } from "grafast";
import { GraphQLInputObjectType } from "graphql";

const { version } = require("../package.json");

declare global {
  namespace GraphileBuild {
    interface BehaviorStrings {
      filterBy: true;
    }
  }
}

export const PgConnectionArgFilterComputedAttributesPlugin: GraphileConfig.Plugin =
  {
    name: "PgConnectionArgFilterComputedAttributesPlugin",
    version,

    schema: {
      behaviorRegistry: {
        add: {
          filterBy: {
            description: "",
            entities: ["pgResource"],
          },
        },
      },

      entityBehavior: {
        pgResource: {
          inferred(behavior, entity, build) {
            if (
              build.options.connectionFilterComputedColumns &&
              isComputedScalarAttributeResource(entity)
            ) {
              return [behavior, "filterBy"];
            } else {
              return behavior;
            }
          },
        },
      },

      hooks: {
        GraphQLInputObjectType_fields(inFields, build, context) {
          let fields = inFields;
          const {
            inflection,
            connectionFilterOperatorsDigest,
            dataplanPg: { TYPES, PgCondition },
            EXPORTABLE,
          } = build;
          const {
            fieldWithHooks,
            scope: { pgCodec: codec, isPgConnectionFilter },
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
            const OperatorsType = build.getTypeByName(
              digest.operatorsTypeName
            ) as GraphQLInputObjectType;
            if (!OperatorsType) {
              continue;
            }

            if (
              !build.behavior.pgResourceMatches(
                computedAttributeResource,
                "filterBy"
              )
            ) {
              continue;
            }

            const { argDetails } = build.pgGetArgDetailsFromParameters(
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
                    apply: EXPORTABLE(
                      (
                        PgCondition,
                        computedAttributeResource,
                        fieldName,
                        functionResultCodec
                      ) =>
                        function ($where: PgCondition, value: object | null) {
                          if (
                            typeof computedAttributeResource.from !== "function"
                          ) {
                            throw new Error(`Unexpected...`);
                          }
                          // TODO: assertAllowed?
                          if (value == null) return;
                          const expression = computedAttributeResource.from({
                            placeholder: $where.alias,
                          });
                          const $col = new PgCondition($where);
                          $col.extensions.pgFilterAttribute = {
                            fieldName,
                            codec: functionResultCodec,
                            expression,
                          };
                          return $col;
                        },
                      [
                        PgCondition,
                        computedAttributeResource,
                        fieldName,
                        functionResultCodec,
                      ]
                    ),
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
