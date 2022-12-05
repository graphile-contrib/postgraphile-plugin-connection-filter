import {
  PgConditionLikeStep,
  PgSelectStep,
  PgTypeColumn,
  PgTypeColumns,
} from "@dataplan/pg";
import { ConnectionStep } from "grafast";

const { version } = require("../package.json");

export const PgConnectionArgFilterColumnsPlugin: GraphileConfig.Plugin = {
  name: "PgConnectionArgFilterColumnsPlugin",
  version,

  schema: {
    hooks: {
      GraphQLInputObjectType_fields(inFields, build, context) {
        let fields = inFields;
        const { extend, sql, inflection, connectionFilterOperatorsDigest } =
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
          const colSpec = { columnName, column };
          const fieldName = inflection.column({ codec, columnName });
          const digest = connectionFilterOperatorsDigest(column.codec);
          if (!digest) {
            continue;
          }
          const OperatorsType = build.getTypeByName(digest.operatorsTypeName);
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
                  applyPlan(
                    $connection: ConnectionStep<
                      any,
                      any,
                      PgSelectStep<any, any, any, any>,
                      any
                    >
                  ) {
                    const $select = $connection.getSubplan();
                    const $where = $select.wherePlan();
                    $where.extensions.pgFilterColumn = colSpec;
                    return $where;
                  },
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
