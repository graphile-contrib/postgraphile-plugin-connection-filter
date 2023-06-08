import { PgCodecAttributes, PgCodecWithAttributes } from "@dataplan/pg";

const { version } = require("../package.json");

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
            options: { connectionFilterAllowedFieldTypes },
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
                [codec, attribute],
                "filter"
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
            const CompositeFilterType = build.getTypeByName(filterTypeName);
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
                    // TODO: applyPlan
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
