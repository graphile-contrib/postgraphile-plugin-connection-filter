import { TYPES } from "@dataplan/pg";
import { getComputedColumnSources } from "./utils";

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
          const source = build.input.pgSources.find(
            (s) => s.codec === codec && !s.parameters && !s.isUnique
          );
          if (!source) {
            return fields;
          }

          const computedColumnSources = getComputedColumnSources(build, source);

          for (const computedColumnSource of computedColumnSources) {
            // Must return a scalar or an array
            if (!computedColumnSource.isUnique) {
              continue;
            }
            if (computedColumnSource.codec.columns) {
              continue;
            }
            if (computedColumnSource.codec === TYPES.void) {
              continue;
            }

            const digest = connectionFilterOperatorsDigest(
              computedColumnSource.codec
            );
            if (!digest) {
              continue;
            }
            const OperatorsType = build.getTypeByName(digest.operatorsTypeName);
            if (!OperatorsType) {
              continue;
            }

            const behavior = build.pgGetBehavior([
              computedColumnSource.extensions,
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
                computedColumnSource,
                computedColumnSource.parameters.slice(1)
              );

            // Must have only one required argument
            if (argDetails.some((a) => a.required)) {
              continue;
            }

            // Looks good

            const fieldName = inflection.computedColumnField({
              source: computedColumnSource,
            });

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
                    // TODO: applyPlan
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
