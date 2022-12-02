import { PgTypeColumn, PgTypeColumns } from "@dataplan/pg";

const { version } = require("../package.json");

export const PgConnectionArgFilterColumnsPlugin: GraphileConfig.Plugin = {
  name: "PgConnectionArgFilterColumnsPlugin",
  version,

  schema: {
    hooks: {
      GraphQLInputObjectType_fields(inFields, build, context) {
        let fields = inFields;
        const { extend, sql, inflection, connectionFilterOperatorsType } =
          build;
        const {
          fieldWithHooks,
          scope: { pgCodec: codec, isPgConnectionFilter },
          Self,
        } = context;

        if (!isPgConnectionFilter || !codec || !codec.columns) {
          return fields;
        }

        for (const [columnName, column] of Object.entries(
          codec.columns as PgTypeColumns
        )) {
          const behavior = build.pgGetBehavior([
            column.codec.extensions,
            column.extensions,
          ]);
          if (!build.behavior.matches(behavior, "filter", "filter")) {
            continue;
          }
          const fieldName = inflection.column({ codec, columnName });
          const OperatorsType = connectionFilterOperatorsType(column.codec);
          if (!OperatorsType) {
            continue;
          }
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
                  // TODO: applyPlan
                })
              ),
            },
            "Adding column-based filtering"
          );
        }

        return fields;
      },
    },
  },
};
