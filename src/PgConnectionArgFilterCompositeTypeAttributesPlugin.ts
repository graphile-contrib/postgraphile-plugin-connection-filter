import type {
  PgCodecAttribute,
  PgCodecAttributes,
  PgCodecWithAttributes,
  PgConditionCapableParent,
} from "@dataplan/pg";
import type { GraphQLInputObjectType } from "graphql";
import { EXPORTABLE } from "./EXPORTABLE";

import { version } from "./version";

const pgConnectionFilterApplyCompositeTypeAttribute = EXPORTABLE(
  () =>
    (
      PgCondition: GraphileBuild.Build["dataplanPg"]["PgCondition"],
      sql: GraphileBuild.Build["sql"],
      attributeName: string,
      attribute: PgCodecAttribute,
      queryBuilder: PgConditionCapableParent,
      value: object | null
    ) => {
      if (value == null) {
        return;
      }
      const expression = sql`(${attribute.expression ? attribute.expression(queryBuilder.alias) : sql`${queryBuilder.alias}.${sql.identifier(attributeName)}`})`;
      const $record = new PgCondition(queryBuilder);
      ($record as any).alias = expression;
      return $record;
    },
  [],
  "pgConnectionFilterApplyCompositeTypeAttribute"
);

export const PgConnectionArgFilterCompositeTypeAttributesPlugin: GraphileConfig.Plugin =
  {
    name: "PgConnectionArgFilterCompositeTypeAttributesPlugin",
    version,

    schema: {
      hooks: {
        GraphQLInputObjectType_fields(inFields, build, context) {
          let fields = inFields;
          const {
            extend,
            inflection,
            graphql: { isNamedType },
            dataplanPg: { PgCondition },
            options: { connectionFilterAllowedFieldTypes },
            sql,
            EXPORTABLE,
          } = build;
          const {
            fieldWithHooks,
            scope: { pgCodec: rawCodec, isPgConnectionFilter },
          } = context;

          if (
            !isPgConnectionFilter ||
            !rawCodec ||
            !rawCodec.attributes ||
            rawCodec.isAnonymous
          ) {
            return fields;
          }
          const codec = rawCodec as PgCodecWithAttributes;

          for (const [attributeName, attribute] of Object.entries(
            codec.attributes as PgCodecAttributes
          )) {
            if (
              !build.behavior.pgCodecAttributeMatches(
                [codec, attributeName],
                "attribute:filterBy"
              )
            ) {
              continue;
            }

            // keep only the composite type attributes
            if (!attribute.codec.attributes) {
              continue;
            }

            const fieldName: string = inflection.attribute({
              codec,
              attributeName,
            });

            const NodeType = build.getGraphQLTypeByPgCodec(
              attribute.codec,
              "output"
            );
            if (!NodeType || !isNamedType(NodeType)) {
              continue;
            }
            const nodeTypeName = NodeType.name;

            // Respect `connectionFilterAllowedFieldTypes` config option
            if (
              connectionFilterAllowedFieldTypes &&
              !connectionFilterAllowedFieldTypes.includes(nodeTypeName)
            ) {
              continue;
            }

            const filterTypeName = inflection.filterType(nodeTypeName);
            const CompositeFilterType = build.getTypeByName(
              filterTypeName
            ) as GraphQLInputObjectType;
            if (!CompositeFilterType) {
              continue;
            }
            fields = extend(
              fields,
              {
                [fieldName]: fieldWithHooks(
                  {
                    fieldName,
                    isPgConnectionFilterField: true,
                  },
                  () => ({
                    description: `Filter by the object’s \`${fieldName}\` field.`,
                    type: CompositeFilterType,
                    apply: EXPORTABLE(
                      (
                        PgCondition,
                        attribute,
                        attributeName,
                        pgConnectionFilterApplyCompositeTypeAttribute,
                        sql
                      ) =>
                        function (
                          queryBuilder: PgConditionCapableParent,
                          value: object | null
                        ) {
                          return pgConnectionFilterApplyCompositeTypeAttribute(
                            PgCondition,
                            sql,
                            attributeName,
                            attribute,
                            queryBuilder,
                            value
                          );
                        },
                      [
                        PgCondition,
                        attribute,
                        attributeName,
                        pgConnectionFilterApplyCompositeTypeAttribute,
                        sql,
                      ]
                    ),
                  })
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
