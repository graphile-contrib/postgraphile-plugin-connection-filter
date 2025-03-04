import type {
  PgCodecWithAttributes,
  PgConditionCapableParent,
} from "@dataplan/pg";
import type { GraphQLInputObjectType } from "graphql";
import { isEmpty } from "./utils";

const { version } = require("../package.json");

export const PgConnectionArgFilterAttributesPlugin: GraphileConfig.Plugin = {
  name: "PgConnectionArgFilterAttributesPlugin",
  version,

  schema: {
    entityBehavior: {
      pgCodecAttribute: "attribute:filterBy",
    },

    hooks: {
      GraphQLInputObjectType_fields(inFields, build, context) {
        let fields = inFields;
        const {
          inflection,
          connectionFilterOperatorsDigest,
          dataplanPg: { PgCondition },
          EXPORTABLE,
        } = build;
        const {
          fieldWithHooks,
          scope: { pgCodec: rawCodec, isPgConnectionFilter },
        } = context;

        if (!isPgConnectionFilter || !rawCodec || !rawCodec.attributes) {
          return fields;
        }
        const codec = rawCodec as PgCodecWithAttributes;

        for (const [attributeName, attribute] of Object.entries(
          codec.attributes
        )) {
          if (
            !build.behavior.pgCodecAttributeMatches(
              [codec, attributeName],
              "attribute:filterBy"
            )
          ) {
            continue;
          }
          const fieldName = inflection.attribute({ codec, attributeName });
          const colSpec = { fieldName, attributeName, attribute };
          const digest = connectionFilterOperatorsDigest(attribute.codec);
          if (!digest) {
            continue;
          }
          const OperatorsType = build.getTypeByName(
            digest.operatorsTypeName
          ) as GraphQLInputObjectType;
          if (!OperatorsType) {
            continue;
          }
          const {
            connectionFilterAllowEmptyObjectInput,
            connectionFilterAllowNullInput,
          } = build.options;
          fields = build.extend(
            fields,
            {
              [fieldName]: fieldWithHooks(
                {
                  fieldName,
                  isPgConnectionFilterField: true,
                },
                () => ({
                  description: `Filter by the object’s \`${fieldName}\` field.`,
                  type: OperatorsType,
                  apply: EXPORTABLE(
                    (PgCondition, colSpec, connectionFilterAllowEmptyObjectInput, connectionFilterAllowNullInput, isEmpty) => function (
                        queryBuilder: PgConditionCapableParent,
                        value: unknown
                      ) {
                        if (value === undefined) {
                          return;
                        }
                        if (!connectionFilterAllowNullInput && value === null) {
                          throw Object.assign(
                            new Error(
                              "Null literals are forbidden in filter argument input."
                            ),
                            {
                              //TODO: mark this error as safe
                            }
                          );
                        }
                        if (
                          !connectionFilterAllowEmptyObjectInput &&
                          isEmpty(value)
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
                        const condition = new PgCondition(queryBuilder);
                        condition.extensions.pgFilterAttribute = colSpec;
                        return condition;
                      },
                    [PgCondition, colSpec, connectionFilterAllowEmptyObjectInput, connectionFilterAllowNullInput, isEmpty]
                  ),
                })
              ),
            },
            "Adding attribute-based filtering"
          );
        }

        return fields;
      },
    },
  },
};
