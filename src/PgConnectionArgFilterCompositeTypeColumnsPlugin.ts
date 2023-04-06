import { PgCodecAttributes, PgCodecWithColumns } from "@dataplan/pg";

const { version } = require("../package.json");

export const PgConnectionArgFilterCompositeTypeColumnsPlugin: GraphileConfig.Plugin =
  {
    name: "PgConnectionArgFilterCompositeTypeColumnsPlugin",
    version,

    schema: {
      hooks: {
        GraphQLInputObjectType_fields(inFields, build, context) {
          let fields = inFields;
          const {
            extend,
            sql,
            inflection,
            graphql: { isNamedType },
            options: { connectionFilterAllowedFieldTypes },
          } = build;
          const {
            fieldWithHooks,
            scope: { pgCodec: rawCodec, isPgConnectionFilter },
            Self,
          } = context;

          if (
            !isPgConnectionFilter ||
            !rawCodec ||
            !rawCodec.columns ||
            rawCodec.isAnonymous
          ) {
            return fields;
          }
          const codec = rawCodec as PgCodecWithColumns;

          for (const [columnName, column] of Object.entries(
            codec.columns as PgCodecAttributes
          )) {
            const behavior = build.pgGetBehavior([
              column.codec.extensions,
              column.extensions,
            ]);
            if (!build.behavior.matches(behavior, "filter", "filter")) {
              continue;
            }

            // keep only the composite type columns
            if (!column.codec.columns) {
              continue;
            }

            const fieldName: string = inflection.column({ codec, columnName });

            const NodeType = build.getGraphQLTypeByPgCodec(
              column.codec,
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
