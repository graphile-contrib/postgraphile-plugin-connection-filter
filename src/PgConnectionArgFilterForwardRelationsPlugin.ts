import type {
  PgConditionStep,
  PgCodecRelation,
  PgCodecAttribute,
  PgCodecWithAttributes,
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
        filterForwardRelationExistsFieldName(_preset, relationFieldName) {
          return `${relationFieldName}Exists`;
        },
        filterSingleRelationFieldName(_preset, fieldName) {
          return fieldName;
        },
      },
    },

    schema: {
      entityBehavior: {
        pgCodecRelation: "filter",
      },

      hooks: {
        GraphQLInputObjectType_fields(fields, build, context) {
          const {
            extend,
            inflection,
            graphql: { GraphQLBoolean },
            sql,
            options: { pgIgnoreReferentialIntegrity },
            EXPORTABLE,
          } = build;
          const {
            fieldWithHooks,
            scope: { pgCodec, isPgConnectionFilter },
          } = context;

          const assertAllowed = makeAssertAllowed(build.options);

          const source =
            pgCodec &&
            (Object.values(build.input.pgRegistry.pgResources).find(
              (s) => s.codec === pgCodec && !s.parameters
            ) as PgResource<any, PgCodecWithAttributes, any, any, any>);

          if (
            !isPgConnectionFilter ||
            !pgCodec ||
            !pgCodec.attributes ||
            !source
          ) {
            return fields;
          }

          const forwardRelations = Object.entries(
            source.getRelations() as {
              [relationName: string]: PgCodecRelation;
            }
          ).filter(([_relationName, relation]) => {
            return !relation.isReferencee;
          });

          for (const [relationName, relation] of forwardRelations) {
            const foreignTable = relation.remoteResource; // Deliberate shadowing

            // Used to use 'read' behavior too
            if (!build.behavior.pgCodecRelationMatches(relation, "filter")) {
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

            if (typeof foreignTable.from === "function") {
              continue;
            }
            const foreignTableExpression = foreignTable.from;
            const localAttributes = relation.localAttributes as string[];
            const remoteAttributes = relation.remoteAttributes as string[];

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
                    applyPlan: EXPORTABLE(
                      (assertAllowed, foreignTable, foreignTableExpression, localAttributes, remoteAttributes, sql) => function ($where: PgConditionStep<any>, fieldArgs) {
                          assertAllowed(fieldArgs, "object");
                          const $subQuery = $where.existsPlan({
                            tableExpression: foreignTableExpression,
                            alias: foreignTable.name,
                          });
                          localAttributes.forEach((localAttribute, i) => {
                            const remoteAttribute = remoteAttributes[i];
                            $subQuery.where(
                              sql`${$where.alias}.${sql.identifier(
                                localAttribute as string
                              )} = ${$subQuery.alias}.${sql.identifier(
                                remoteAttribute as string
                              )}`
                            );
                          });
                          fieldArgs.apply($subQuery);
                        },
                      [assertAllowed, foreignTable, foreignTableExpression, localAttributes, remoteAttributes, sql]
                    ),
                  })
                ),
              },
              `Adding connection filter forward relation field from ${source.name} to ${foreignTable.name}`
            );

            const keyIsNullable = relation.localAttributes.some(
              (col) =>
                !(source.codec.attributes[col] as PgCodecAttribute).notNull
            );
            if (keyIsNullable || pgIgnoreReferentialIntegrity) {
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
                      applyPlan: EXPORTABLE(
                        (assertAllowed, foreignTable, foreignTableExpression, localAttributes, remoteAttributes, sql) => function ($where: PgConditionStep<any>, fieldArgs) {
                            assertAllowed(fieldArgs, "scalar");
                            const $subQuery = $where.existsPlan({
                              tableExpression: foreignTableExpression,
                              alias: foreignTable.name,
                              $equals: fieldArgs.get(),
                            });
                            localAttributes.forEach((localAttribute, i) => {
                              const remoteAttribute = remoteAttributes[i];
                              $subQuery.where(
                                sql`${$where.alias}.${sql.identifier(
                                  localAttribute as string
                                )} = ${$subQuery.alias}.${sql.identifier(
                                  remoteAttribute as string
                                )}`
                              );
                            });
                          },
                        [assertAllowed, foreignTable, foreignTableExpression, localAttributes, remoteAttributes, sql]
                      ),
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
