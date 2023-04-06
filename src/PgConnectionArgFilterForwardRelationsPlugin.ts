import {
  PgConditionStep,
  PgCodecRelation,
  PgCodecAttribute,
  PgCodecWithColumns,
  PgResource,
} from "@dataplan/pg";
import { makeAssertAllowed } from "./utils";

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

          const assertAllowed = makeAssertAllowed(build.options);

          const source =
            pgCodec &&
            (Object.values(build.input.pgRegistry.pgResources).find(
              (s) => s.codec === pgCodec && !s.parameters
            ) as PgResource<any, PgCodecWithColumns, any, any, any>);

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
              [relationName: string]: PgCodecRelation;
            }
          ).filter(([relationName, relation]) => {
            return !relation.isReferencee;
          });

          for (const [relationName, relation] of forwardRelations) {
            const behavior = build.pgGetBehavior([
              relation.remoteResource.extensions,
              relation.extensions,
            ]);
            const foreignTable = relation.remoteResource; // Deliberate shadowing

            // Used to use 'read' behavior too
            if (!build.behavior.matches(behavior, "filter", "filter")) {
              continue;
            }

            const fieldName = inflection.singleRelation({
              registry: source.registry,
              codec: source.codec,
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

            if (typeof foreignTable.source === "function") {
              continue;
            }
            const foreignTableExpression = foreignTable.source;
            const localColumns = relation.localColumns as string[];
            const remoteColumns = relation.remoteColumns as string[];

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
                    applyPlan($where: PgConditionStep<any>, fieldArgs) {
                      assertAllowed(fieldArgs, "object");
                      const $subQuery = $where.existsPlan({
                        tableExpression: foreignTableExpression,
                        alias: foreignTable.name,
                      });
                      localColumns.forEach((localColumn, i) => {
                        const remoteColumn = remoteColumns[i];
                        $subQuery.where(
                          sql`${$where.alias}.${sql.identifier(
                            localColumn as string
                          )} = ${$subQuery.alias}.${sql.identifier(
                            remoteColumn as string
                          )}`
                        );
                      });
                      fieldArgs.apply($subQuery);
                    },
                  })
                ),
              },
              `Adding connection filter forward relation field from ${source.name} to ${foreignTable.name}`
            );

            const keyIsNullable = relation.localColumns.some(
              (col) => !(source.codec.columns[col] as PgCodecAttribute).notNull
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
                      applyPlan($where: PgConditionStep<any>, fieldArgs) {
                        assertAllowed(fieldArgs, "scalar");
                        const $subQuery = $where.existsPlan({
                          tableExpression: foreignTableExpression,
                          alias: foreignTable.name,
                          $equals: fieldArgs.get(),
                        });
                        localColumns.forEach((localColumn, i) => {
                          const remoteColumn = remoteColumns[i];
                          $subQuery.where(
                            sql`${$where.alias}.${sql.identifier(
                              localColumn as string
                            )} = ${$subQuery.alias}.${sql.identifier(
                              remoteColumn as string
                            )}`
                          );
                        });
                      },
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
