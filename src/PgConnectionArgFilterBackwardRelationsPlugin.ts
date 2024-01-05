import type {
  PgConditionStep,
  PgCodecRelation,
  PgCodecWithAttributes,
  PgRegistry,
  PgResource,
} from "@dataplan/pg";
import { makeAssertAllowed } from "./utils";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require("../package.json");

export const PgConnectionArgFilterBackwardRelationsPlugin: GraphileConfig.Plugin =
  {
    name: "PgConnectionArgFilterBackwardRelationsPlugin",
    version,

    /*
  { pgSimpleCollections, pgOmitListSuffix, connectionFilterUseListInflectors }
  const hasConnections = pgSimpleCollections !== "only";
  const simpleInflectorsAreShorter = pgOmitListSuffix === true;
  if (
    simpleInflectorsAreShorter &&
    connectionFilterUseListInflectors === undefined
  ) {
    // TODO: in V3 consider doing this for the user automatically (doing it in V2 would be a breaking change)
    console.warn(
      `We recommend you set the 'connectionFilterUseListInflectors' option to 'true' since you've set the 'pgOmitListSuffix' option`
    );
  }
  const useConnectionInflectors =
    connectionFilterUseListInflectors === undefined
      ? hasConnections
      : !connectionFilterUseListInflectors;
  */

    inflection: {
      add: {
        filterManyType(preset, table, foreignTable): string {
          return this.upperCamelCase(
            `${this.tableType(table)}-to-many-${this.tableType(
              foreignTable.codec
            )}-filter`
          );
        },
        filterBackwardSingleRelationExistsFieldName(preset, relationFieldName) {
          return `${relationFieldName}Exists`;
        },
        filterBackwardManyRelationExistsFieldName(preset, relationFieldName) {
          return `${relationFieldName}Exist`;
        },
        filterSingleRelationByKeysBackwardsFieldName(preset, fieldName) {
          return fieldName;
        },
        filterManyRelationByKeysFieldName(preset, fieldName) {
          return fieldName;
        },
      },
    },

    schema: {
      entityBehavior: {
        pgCodecRelation: "filter",
      },

      hooks: {
        init(_, build) {
          const { inflection } = build;
          for (const source of Object.values(
            build.input.pgRegistry.pgResources
          )) {
            if (
              source.parameters ||
              !source.codec.attributes ||
              source.isUnique
            ) {
              continue;
            }
            for (const [relationName, relation] of Object.entries(
              source.getRelations() as {
                [relationName: string]: PgCodecRelation<any, any>;
              }
            )) {
              const foreignTable = relation.remoteResource;
              const filterManyTypeName = inflection.filterManyType(
                source.codec,
                foreignTable
              );
              const foreignTableTypeName = inflection.tableType(
                foreignTable.codec
              );
              if (!build.getTypeMetaByName(filterManyTypeName)) {
                build.recoverable(null, () => {
                  build.registerInputObjectType(
                    filterManyTypeName,
                    {
                      foreignTable,
                      isPgConnectionFilterMany: true,
                    },
                    () => ({
                      name: filterManyTypeName,
                      description: `A filter to be used against many \`${foreignTableTypeName}\` object types. All fields are combined with a logical ‘and.’`,
                    }),
                    `PgConnectionArgFilterBackwardRelationsPlugin: Adding '${filterManyTypeName}' type for ${foreignTable.name}`
                  );
                });
              }
            }
          }
          return _;
        },

        GraphQLInputObjectType_fields(inFields, build, context) {
          let fields = inFields;
          const {
            extend,
            inflection,
            sql,
            graphql: { GraphQLBoolean },
            EXPORTABLE,
          } = build;
          const {
            fieldWithHooks,
            scope: {
              // fn1
              pgCodec,
              isPgConnectionFilter,

              // fn2
              foreignTable,
              isPgConnectionFilterMany,
            },
            Self,
          } = context;

          const assertAllowed = makeAssertAllowed(build);

          const source =
            pgCodec &&
            (Object.values(build.input.pgRegistry.pgResources).find(
              (s) => s.codec === pgCodec && !s.parameters
            ) as
              | PgResource<any, PgCodecWithAttributes, any, any, PgRegistry>
              | undefined);
          if (isPgConnectionFilter && pgCodec && pgCodec.attributes && source) {
            const backwardsRelations = Object.entries(
              source.getRelations() as {
                [relationName: string]: PgCodecRelation;
              }
            ).filter(([relationName, relation]) => {
              return relation.isReferencee;
            });

            for (const [relationName, relation] of backwardsRelations) {
              const foreignTable = relation.remoteResource; // Deliberate shadowing

              // Used to use 'read' behavior too
              if (!build.behavior.pgCodecRelationMatches(relation, "filter")) {
                continue;
              }

              const isForeignKeyUnique = relation.isUnique;
              const isOneToMany = !relation.isUnique;

              /*
            const addField = (
              fieldName: string,
              description: string,
              type: any,
              resolve: any,
              spec: BackwardRelationSpec,
              hint: string
            ) => {
              // Field
              fields = extend(
                fields,
                {
                  [fieldName]: fieldWithHooks(
                    fieldName,
                    {
                      description,
                      type,
                    },
                    {
                      isPgConnectionFilterField: true,
                    }
                  ),
                },
                hint
              );
              // Relation spec for use in resolver
              backwardRelationSpecByFieldName = extend(
                backwardRelationSpecByFieldName,
                {
                  [fieldName]: spec,
                }
              );
              // Resolver
              connectionFilterRegisterResolver(Self.name, fieldName, resolve);
            };

            const resolveSingle: ConnectionFilterResolver = ({
              sourceAlias,
              fieldName,
              fieldValue,
              queryBuilder,
            }) => {
              if (fieldValue == null) return null;

              const { foreignTable, foreignKeyAttributes, keyAttributes } =
                backwardRelationSpecByFieldName[fieldName];

              const foreignTableTypeName = inflection.tableType(foreignTable);

              const foreignTableAlias = sql.identifier(Symbol());
              const foreignTableFilterTypeName =
                inflection.filterType(foreignTableTypeName);
              const sqlIdentifier = sql.identifier(
                foreignTable.namespace.name,
                foreignTable.name
              );
              const sqlKeysMatch = sql.query`(${sql.join(
                foreignKeyAttributes.map((attr, i) => {
                  return sql.fragment`${foreignTableAlias}.${sql.identifier(
                    attr.name
                  )} = ${sourceAlias}.${sql.identifier(keyAttributes[i].name)}`;
                }),
                ") and ("
              )})`;
              const sqlSelectWhereKeysMatch = sql.query`select 1 from ${sqlIdentifier} as ${foreignTableAlias} where ${sqlKeysMatch}`;
              const sqlFragment = connectionFilterResolve(
                fieldValue,
                foreignTableAlias,
                foreignTableFilterTypeName,
                queryBuilder
              );
              return sqlFragment == null
                ? null
                : sql.query`exists(${sqlSelectWhereKeysMatch} and (${sqlFragment}))`;
            };

            const resolveExists: ConnectionFilterResolver = ({
              sourceAlias,
              fieldName,
              fieldValue,
            }) => {
              if (fieldValue == null) return null;

              const { foreignTable, foreignKeyAttributes, keyAttributes } =
                backwardRelationSpecByFieldName[fieldName];

              const foreignTableAlias = sql.identifier(Symbol());

              const sqlIdentifier = sql.identifier(
                foreignTable.namespace.name,
                foreignTable.name
              );

              const sqlKeysMatch = sql.query`(${sql.join(
                foreignKeyAttributes.map((attr, i) => {
                  return sql.fragment`${foreignTableAlias}.${sql.identifier(
                    attr.name
                  )} = ${sourceAlias}.${sql.identifier(keyAttributes[i].name)}`;
                }),
                ") and ("
              )})`;

              const sqlSelectWhereKeysMatch = sql.query`select 1 from ${sqlIdentifier} as ${foreignTableAlias} where ${sqlKeysMatch}`;

              return fieldValue === true
                ? sql.query`exists(${sqlSelectWhereKeysMatch})`
                : sql.query`not exists(${sqlSelectWhereKeysMatch})`;
            };

            const makeResolveMany = (
              backwardRelationSpec: BackwardRelationSpec
            ) => {
              const resolveMany: ConnectionFilterResolver = ({
                sourceAlias,
                fieldName,
                fieldValue,
                queryBuilder,
              }) => {
                if (fieldValue == null) return null;

                const { foreignTable } =
                  backwardRelationSpecByFieldName[fieldName];

                const foreignTableFilterManyTypeName =
                  inflection.filterManyType(table, foreignTable);
                const sqlFragment = connectionFilterResolve(
                  fieldValue,
                  sourceAlias,
                  foreignTableFilterManyTypeName,
                  queryBuilder,
                  null,
                  null,
                  null,
                  { backwardRelationSpec }
                );
                return sqlFragment == null ? null : sqlFragment;
              };
              return resolveMany;
            };

            for (const spec of backwardRelationSpecs) {
              const {
                foreignTable,
                foreignKeyAttributes,
                foreignConstraint,
                isOneToMany,
              } = spec;
              */
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

              if (isOneToMany) {
                if (
                  build.behavior.pgCodecRelationMatches(relation, "list") ||
                  build.behavior.pgCodecRelationMatches(relation, "connection")
                ) {
                  const filterManyTypeName = inflection.filterManyType(
                    source.codec,
                    foreignTable
                  );
                  const FilterManyType =
                    build.getTypeByName(filterManyTypeName);
                  // TODO: revisit using `_` prefixed inflector
                  const fieldName = inflection._manyRelation({
                    registry: source.registry,
                    codec: source.codec,
                    relationName,
                  });
                  const filterFieldName =
                    inflection.filterManyRelationByKeysFieldName(fieldName);

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
                          type: FilterManyType,
                          applyPlan: EXPORTABLE(
                            (
                              assertAllowed,
                              foreignTable,
                              foreignTableExpression,
                              localAttributes,
                              remoteAttributes
                            ) =>
                              function (
                                $where: PgConditionStep<any>,
                                fieldArgs
                              ) {
                                assertAllowed(fieldArgs, "object");
                                // $where.alias represents source; we need a condition that references the relational target
                                const $rel = $where.andPlan();
                                $rel.extensions.pgFilterRelation = {
                                  tableExpression: foreignTableExpression,
                                  alias: foreignTable.name,
                                  localAttributes,
                                  remoteAttributes,
                                };
                                fieldArgs.apply($rel);
                              },
                            [
                              assertAllowed,
                              foreignTable,
                              foreignTableExpression,
                              localAttributes,
                              remoteAttributes,
                            ]
                          ),
                        })
                      ),
                    },
                    `Adding connection filter backward relation field from ${source.name} to ${foreignTable.name}`
                  );

                  const existsFieldName =
                    inflection.filterBackwardManyRelationExistsFieldName(
                      fieldName
                    );

                  fields = extend(
                    fields,
                    {
                      [existsFieldName]: fieldWithHooks(
                        {
                          fieldName: existsFieldName,
                          isPgConnectionFilterField: true,
                        },
                        () => ({
                          description: `Some related \`${fieldName}\` exist.`,
                          type: GraphQLBoolean,
                          // TODO: many of the applyPlan functions in this file
                          // and in PgConnectionArgFilterForwardRelationsPlugin
                          // are very very similar. We should extract them to a
                          // helper function.
                          applyPlan: EXPORTABLE(
                            (
                              assertAllowed,
                              foreignTable,
                              foreignTableExpression,
                              localAttributes,
                              remoteAttributes,
                              sql
                            ) =>
                              function (
                                $where: PgConditionStep<any>,
                                fieldArgs
                              ) {
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
                            [
                              assertAllowed,
                              foreignTable,
                              foreignTableExpression,
                              localAttributes,
                              remoteAttributes,
                              sql,
                            ]
                          ),
                        })
                      ),
                    },
                    `Adding connection filter backward relation exists field from ${source.name} to ${foreignTable.name}`
                  );
                }
              } else {
                const fieldName = inflection.singleRelationBackwards({
                  registry: source.registry,
                  codec: source.codec,
                  relationName,
                });
                const filterFieldName =
                  inflection.filterSingleRelationByKeysBackwardsFieldName(
                    fieldName
                  );
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
                          (
                            assertAllowed,
                            foreignTable,
                            foreignTableExpression,
                            localAttributes,
                            remoteAttributes,
                            sql
                          ) =>
                            function ($where: PgConditionStep<any>, fieldArgs) {
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
                          [
                            assertAllowed,
                            foreignTable,
                            foreignTableExpression,
                            localAttributes,
                            remoteAttributes,
                            sql,
                          ]
                        ),
                      })
                    ),
                  },
                  `Adding connection filter backward relation field from ${source.name} to ${foreignTable.name}`
                );

                const existsFieldName =
                  inflection.filterBackwardSingleRelationExistsFieldName(
                    fieldName
                  );
                fields = build.recoverable(fields, () =>
                  extend(
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
                            (
                              assertAllowed,
                              foreignTable,
                              foreignTableExpression,
                              localAttributes,
                              remoteAttributes,
                              sql
                            ) =>
                              function (
                                $where: PgConditionStep<any>,
                                fieldArgs
                              ) {
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
                            [
                              assertAllowed,
                              foreignTable,
                              foreignTableExpression,
                              localAttributes,
                              remoteAttributes,
                              sql,
                            ]
                          ),
                        })
                      ),
                    },
                    `Adding connection filter backward relation exists field from ${source.name} to ${foreignTable.name}`
                  )
                );
              }
            }
          }

          if (isPgConnectionFilterMany && foreignTable) {
            const foreignTableTypeName = inflection.tableType(
              foreignTable.codec
            );
            const foreignTableFilterTypeName =
              inflection.filterType(foreignTableTypeName);
            const FilterType = build.getTypeByName(foreignTableFilterTypeName);

            const manyFields = {
              every: fieldWithHooks(
                {
                  fieldName: "every",
                  isPgConnectionFilterManyField: true,
                },
                () => ({
                  description: `Every related \`${foreignTableTypeName}\` matches the filter criteria. All fields are combined with a logical ‘and.’`,
                  type: FilterType,
                  applyPlan: EXPORTABLE(
                    (assertAllowed, sql) =>
                      function ($where: PgConditionStep<any>, fieldArgs) {
                        assertAllowed(fieldArgs, "object");
                        if (!$where.extensions.pgFilterRelation) {
                          throw new Error(
                            `Invalid use of filter, 'pgFilterRelation' expected`
                          );
                        }
                        const {
                          localAttributes,
                          remoteAttributes,
                          tableExpression,
                          alias,
                        } = $where.extensions.pgFilterRelation;
                        const $subQuery = $where.notPlan().existsPlan({
                          tableExpression,
                          alias,
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
                        fieldArgs.apply($subQuery.notPlan().andPlan());
                      },
                    [assertAllowed, sql]
                  ),
                })
              ),
              some: fieldWithHooks(
                {
                  fieldName: "some",
                  isPgConnectionFilterManyField: true,
                },
                () => ({
                  description: `Some related \`${foreignTableTypeName}\` matches the filter criteria. All fields are combined with a logical ‘and.’`,
                  type: FilterType,
                  applyPlan: EXPORTABLE(
                    (assertAllowed, sql) =>
                      function ($where: PgConditionStep<any>, fieldArgs) {
                        assertAllowed(fieldArgs, "object");
                        if (!$where.extensions.pgFilterRelation) {
                          throw new Error(
                            `Invalid use of filter, 'pgFilterRelation' expected`
                          );
                        }
                        const {
                          localAttributes,
                          remoteAttributes,
                          tableExpression,
                          alias,
                        } = $where.extensions.pgFilterRelation;
                        const $subQuery = $where.existsPlan({
                          tableExpression,
                          alias,
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
                    [assertAllowed, sql]
                  ),
                })
              ),
              none: fieldWithHooks(
                {
                  fieldName: "none",
                  isPgConnectionFilterManyField: true,
                },
                () => ({
                  description: `No related \`${foreignTableTypeName}\` matches the filter criteria. All fields are combined with a logical ‘and.’`,
                  type: FilterType,
                  applyPlan: EXPORTABLE(
                    (assertAllowed, sql) =>
                      function ($where: PgConditionStep<any>, fieldArgs) {
                        assertAllowed(fieldArgs, "object");
                        if (!$where.extensions.pgFilterRelation) {
                          throw new Error(
                            `Invalid use of filter, 'pgFilterRelation' expected`
                          );
                        }
                        const {
                          localAttributes,
                          remoteAttributes,
                          tableExpression,
                          alias,
                        } = $where.extensions.pgFilterRelation;
                        const $subQuery = $where.notPlan().existsPlan({
                          tableExpression,
                          alias,
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
                    [assertAllowed, sql]
                  ),
                })
              ),
            };

            fields = extend(fields, manyFields, "");
          }
          return fields;
        },
      },
    },
  };
