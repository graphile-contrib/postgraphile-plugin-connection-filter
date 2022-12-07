import {
  PgConditionStep,
  PgSourceBuilder,
  PgSourceRelation,
} from "@dataplan/pg";
import { filter } from "grafast";

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
      hooks: {
        init(_, build) {
          const { inflection } = build;
          for (const source of build.input.pgSources) {
            if (source.parameters || !source.codec.columns || source.isUnique) {
              continue;
            }
            for (const [relationName, relation] of Object.entries(
              source.getRelations() as {
                [relationName: string]: PgSourceRelation<any, any>;
              }
            )) {
              const foreignTable =
                relation.source instanceof PgSourceBuilder
                  ? relation.source.get()
                  : relation.source;
              const filterManyTypeName = inflection.filterManyType(
                source.codec,
                foreignTable
              );
              const foreignTableTypeName = inflection.tableType(
                foreignTable.codec
              );
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
          return _;
        },

        GraphQLInputObjectType_fields(inFields, build, context) {
          let fields = inFields;
          const {
            extend,
            inflection,
            sql,
            graphql: { GraphQLInputObjectType, GraphQLBoolean },
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

          const source =
            pgCodec &&
            build.input.pgSources.find(
              (s) => s.codec === pgCodec && !s.parameters
            );
          if (isPgConnectionFilter && pgCodec && pgCodec.columns && source) {
            const backwardsRelations = Object.entries(
              source.getRelations() as {
                [relationName: string]: PgSourceRelation<any, any>;
              }
            ).filter(([relationName, relation]) => {
              return relation.isReferencee;
            });

            for (const [relationName, relation] of backwardsRelations) {
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
              if (typeof foreignTable.source === "function") {
                continue;
              }

              const foreignTableExpression = foreignTable.source;

              const localColumns = relation.localColumns as string[];
              const remoteColumns = relation.remoteColumns as string[];

              if (isOneToMany) {
                if (
                  build.behavior.matches(behavior, "list", "") ||
                  build.behavior.matches(behavior, "connection", "connection")
                ) {
                  const filterManyTypeName = inflection.filterManyType(
                    source.codec,
                    foreignTable
                  );
                  const FilterManyType =
                    build.getTypeByName(filterManyTypeName);
                  // TODO: revisit using `_` prefixed inflector
                  const fieldName = inflection._manyRelation({
                    source,
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
                          applyPlan($where: PgConditionStep<any>) {
                            // $where.alias represents source; we need a condition that references the relational target
                            const $rel = $where.andPlan();
                            $rel.extensions.pgFilterRelation = {
                              tableExpression: foreignTableExpression,
                              alias: foreignTable.name,
                              localColumns,
                              remoteColumns,
                            };
                            return $rel;
                          },
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
                          applyPlan($where: PgConditionStep<any>, fieldArgs) {
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
                    `Adding connection filter backward relation exists field from ${source.name} to ${foreignTable.name}`
                  );
                }
              } else {
                const fieldName = inflection.singleRelationBackwards({
                  source,
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
                        applyPlan($where: PgConditionStep<any>, fieldArgs) {
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
                          applyPlan($where: PgConditionStep<any>, fieldArgs) {
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
                  applyPlan($where: PgConditionStep<any>, fieldArgs) {
                    if (!$where.extensions.pgFilterRelation) {
                      throw new Error(
                        `Invalid use of filter, 'pgFilterRelation' expected`
                      );
                    }
                    const {
                      localColumns,
                      remoteColumns,
                      tableExpression,
                      alias,
                    } = $where.extensions.pgFilterRelation;
                    const $subQuery = $where.notPlan().existsPlan({
                      tableExpression,
                      alias,
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
                    fieldArgs.apply($subQuery.notPlan().andPlan());
                  },
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
                  applyPlan($where: PgConditionStep<any>, fieldArgs) {
                    if (!$where.extensions.pgFilterRelation) {
                      throw new Error(
                        `Invalid use of filter, 'pgFilterRelation' expected`
                      );
                    }
                    const {
                      localColumns,
                      remoteColumns,
                      tableExpression,
                      alias,
                    } = $where.extensions.pgFilterRelation;
                    const $subQuery = $where.existsPlan({
                      tableExpression,
                      alias,
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
              none: fieldWithHooks(
                {
                  fieldName: "none",
                  isPgConnectionFilterManyField: true,
                },
                () => ({
                  description: `No related \`${foreignTableTypeName}\` matches the filter criteria. All fields are combined with a logical ‘and.’`,
                  type: FilterType,
                  applyPlan($where: PgConditionStep<any>, fieldArgs) {
                    if (!$where.extensions.pgFilterRelation) {
                      throw new Error(
                        `Invalid use of filter, 'pgFilterRelation' expected`
                      );
                    }
                    const {
                      localColumns,
                      remoteColumns,
                      tableExpression,
                      alias,
                    } = $where.extensions.pgFilterRelation;
                    const $subQuery = $where.notPlan().existsPlan({
                      tableExpression,
                      alias,
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
            };

            fields = extend(fields, manyFields, "");
          }
          return fields;
        },
      },
    },
  };
