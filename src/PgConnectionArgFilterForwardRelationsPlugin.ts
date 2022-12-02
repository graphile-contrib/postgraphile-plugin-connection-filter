import { PgSourceBuilder, PgSourceRelation, PgTypeColumn } from "@dataplan/pg";

const { version } = require("../package.json");

export const PgConnectionArgFilterForwardRelationsPlugin: GraphileConfig.Plugin =
  {
    name: "PgConnectionArgFilterForwardRelationsPlugin",
    version,

    inflection: {
      add: {
        filterForwardRelationExistsFieldName(preset, relationFieldName) {
          return `${relationFieldName}Exists`;
        },
        filterSingleRelationFieldName(preset, fieldName) {
          return fieldName;
        },
      },
    },

    schema: {
      hooks: {
        GraphQLInputObjectType_fields(fields, build, context) {
          const {
            extend,
            inflection,
            graphql: { GraphQLBoolean },
            sql,
          } = build;
          const {
            fieldWithHooks,
            scope: { pgCodec, isPgConnectionFilter },
            Self,
          } = context;

          const source =
            pgCodec &&
            build.input.pgSources.find(
              (s) => s.codec === pgCodec && !s.parameters
            );

          if (
            !isPgConnectionFilter ||
            !pgCodec ||
            !pgCodec.columns ||
            !source
          ) {
            return fields;
          }

          const forwardRelations = Object.entries(
            source.getRelations() as {
              [relationName: string]: PgSourceRelation<any, any>;
            }
          ).filter(([relationName, relation]) => {
            return !relation.isReferencee;
          });

          for (const [relationName, relation] of forwardRelations) {
            const behavior = build.pgGetBehavior([
              relation.source.extensions,
              relation.extensions,
            ]);
            const foreignTable =
              relation.source instanceof PgSourceBuilder
                ? relation.source.get()
                : relation.source; // Deliberate shadowing

            // Used to use 'read' behavior too
            if (!build.behavior.matches(behavior, "filter", "filter")) {
              continue;
            }

            const fieldName = inflection.singleRelation({
              source,
              relationName,
            });
            const filterFieldName =
              inflection.filterSingleRelationFieldName(fieldName);
            const foreignTableTypeName = inflection.tableType(
              foreignTable.codec
            );
            const foreignTableFilterTypeName =
              inflection.filterType(foreignTableTypeName);
            const ForeignTableFilterType = build.getTypeByName(
              foreignTableFilterTypeName
            );
            if (!ForeignTableFilterType) continue;

            fields = extend(
              fields,
              {
                [filterFieldName]: fieldWithHooks(
                  {
                    fieldName: filterFieldName,
                    isPgConnectionFilterField: true,
                  },
                  () => ({
                    description: `Filter by the object’s \`${fieldName}\` relation.`,
                    type: ForeignTableFilterType,
                  })
                ),
              },
              `Adding connection filter forward relation field from ${source.name} to ${foreignTable.name}`
            );

            const keyIsNullable = relation.localColumns.some(
              (col) => !(source.codec.columns[col] as PgTypeColumn).notNull
            );
            if (keyIsNullable) {
              const existsFieldName =
                inflection.filterForwardRelationExistsFieldName(fieldName);
              fields = extend(
                fields,
                {
                  [existsFieldName]: fieldWithHooks(
                    {
                      fieldName: existsFieldName,
                      isPgConnectionFilterField: true,
                    },
                    () => ({
                      description: `A related \`${fieldName}\` exists.`,
                      type: GraphQLBoolean,
                    })
                  ),
                },
                `Adding connection filter forward relation exists field from ${source.name} to ${foreignTable.name}`
              );
            }
          }

          return fields;
        },
      },
    },
  };
