module.exports = function PgConnectionArgFilterPlugin(
  builder,
  {
    pgInflection: inflection,
    connectionFilterComputedColumns = true,
    connectionFilterSetofFunctions = true,
  }
) {
  builder.hook("init", (_, build) => {
    const {
      newWithHooks,
      getTypeByName,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      pgGetGqlInputTypeByTypeId,
      graphql: {
        GraphQLInputObjectType,
        GraphQLString,
        GraphQLList,
        GraphQLNonNull,
        GraphQLScalarType,
        GraphQLEnumType,
      },
      pgColumnFilter,
      connectionFilterAllowedFieldTypes,
      connectionFilterOperators,
    } = build;

    const getOrCreateFieldFilterTypeByFieldTypeName = fieldTypeName => {
      const fieldFilterTypeName = `${fieldTypeName}Filter`;
      if (!getTypeByName(fieldFilterTypeName)) {
        newWithHooks(
          GraphQLInputObjectType,
          {
            name: fieldFilterTypeName,
            description: `A filter to be used against ${fieldTypeName} fields. All fields are combined with a logical ‘and.’`,
            fields: ({ fieldWithHooks }) =>
              Object.keys(connectionFilterOperators).reduce(
                (memo, operatorName) => {
                  const operator = connectionFilterOperators[operatorName];
                  const allowedFieldTypes = operator.options.allowedFieldTypes;
                  if (
                    !allowedFieldTypes ||
                    allowedFieldTypes.includes(fieldTypeName)
                  ) {
                    memo[operatorName] = fieldWithHooks(operatorName, {
                      description: operator.description,
                      type: operator.resolveType(fieldTypeName),
                    });
                  }
                  return memo;
                },
                {}
              ),
          },
          {
            isPgConnectionFilterFilter: true,
          }
        );
      }
      return getTypeByName(fieldFilterTypeName);
    };

    const extendFilterFields = (memo, fieldName, fieldType, fieldWithHooks) => {
      if (
        !(
          fieldType instanceof GraphQLScalarType ||
          fieldType instanceof GraphQLEnumType
        ) ||
        !fieldType.name
      ) {
        return memo;
      }
      const fieldTypeName = fieldType.name;
      // Check whether this field type is filterable
      if (
        connectionFilterAllowedFieldTypes &&
        !connectionFilterAllowedFieldTypes.includes(fieldTypeName)
      ) {
        return memo;
      }
      const fieldFilterType = getOrCreateFieldFilterTypeByFieldTypeName(
        fieldTypeName
      );
      if (fieldFilterType != null) {
        memo[fieldName] = fieldWithHooks(
          fieldName,
          {
            description: `Filter by the object’s \`${fieldName}\` field.`,
            type: fieldFilterType,
          },
          {
            isPgConnectionFilterField: true,
          }
        );
      }
      return memo;
    };

    // Add *Filter type for each Connection type
    introspectionResultsByKind.class
      .filter(table => table.isSelectable)
      .filter(table => !!table.namespace)
      .forEach(table => {
        const tableTypeName = inflection.tableType(
          table.name,
          table.namespace.name
        );
        newWithHooks(
          GraphQLInputObjectType,
          {
            description: `A filter to be used against \`${tableTypeName}\` object types. All fields are combined with a logical ‘and.’`,
            name: `${tableTypeName}Filter`,
            fields: context => {
              const { fieldWithHooks } = context;

              // Attr fields
              const attrFields = introspectionResultsByKind.attribute
                .filter(attr => attr.classId === table.id)
                .filter(attr => pgColumnFilter(attr, build, context))
                .reduce((memo, attr) => {
                  const fieldName = inflection.column(
                    attr.name,
                    table.name,
                    table.namespace.name
                  );
                  const fieldType =
                    pgGetGqlInputTypeByTypeId(attr.typeId) || GraphQLString;
                  return extendFilterFields(
                    memo,
                    fieldName,
                    fieldType,
                    fieldWithHooks
                  );
                }, {});

              // Proc fields (computed columns)
              const tableType = introspectionResultsByKind.type.filter(
                type =>
                  type.type === "c" &&
                  type.namespaceId === table.namespaceId &&
                  type.classId === table.id
              )[0];
              if (!tableType) {
                throw new Error("Could not determine the type for this table");
              }
              const procFields = connectionFilterComputedColumns
                ? introspectionResultsByKind.procedure
                    .filter(proc => proc.isStable)
                    .filter(proc => proc.namespaceId === table.namespaceId)
                    .filter(proc => proc.name.startsWith(`${table.name}_`))
                    .filter(proc => proc.argTypeIds.length > 0)
                    .filter(proc => proc.argTypeIds[0] === tableType.id)
                    .reduce((memo, proc) => {
                      const argTypes = proc.argTypeIds.map(
                        typeId => introspectionResultsByKind.typeById[typeId]
                      );
                      if (
                        argTypes
                          .slice(1)
                          .some(
                            type =>
                              type.type === "c" &&
                              type.class &&
                              type.class.isSelectable
                          )
                      ) {
                        // Accepts two input tables? Skip.
                        return memo;
                      }
                      if (argTypes.length > 1) {
                        // Accepts arguments? Skip.
                        return memo;
                      }
                      const pseudoColumnName = proc.name.substr(
                        table.name.length + 1
                      );
                      const fieldName = inflection.column(
                        pseudoColumnName,
                        table.name,
                        table.namespace.name
                      );
                      const fieldType = pgGetGqlInputTypeByTypeId(
                        proc.returnTypeId
                      );
                      return extendFilterFields(
                        memo,
                        fieldName,
                        fieldType,
                        fieldWithHooks
                      );
                    }, {})
                : {};

              // Logical operator fields
              const logicalOperatorFields = {
                and: fieldWithHooks(
                  "and",
                  {
                    description: `Checks for all expressions in this list.`,
                    type: new GraphQLList(
                      new GraphQLNonNull(
                        getTypeByName(`${tableTypeName}Filter`)
                      )
                    ),
                  },
                  {
                    isPgConnectionFilterOperatorLogical: true,
                  }
                ),
                or: fieldWithHooks(
                  "or",
                  {
                    description: `Checks for any expressions in this list.`,
                    type: new GraphQLList(
                      new GraphQLNonNull(
                        getTypeByName(`${tableTypeName}Filter`)
                      )
                    ),
                  },
                  {
                    isPgConnectionFilterOperatorLogical: true,
                  }
                ),
                not: fieldWithHooks(
                  "not",
                  {
                    description: `Negates the expression.`,
                    type: getTypeByName(`${tableTypeName}Filter`),
                  },
                  {
                    isPgConnectionFilterOperatorLogical: true,
                  }
                ),
              };

              return Object.assign(
                {},
                attrFields,
                procFields,
                logicalOperatorFields
              );
            },
          },
          {
            pgIntrospection: table,
            isPgConnectionFilter: true,
          }
        );
      });
    return _;
  });

  builder.hook(
    "GraphQLObjectType:fields:field:args",
    (args, build, context) => {
      const {
        pgSql: sql,
        gql2pg,
        extend,
        getTypeByName,
        pgGetGqlTypeByTypeId,
        pgIntrospectionResultsByKind: introspectionResultsByKind,
        pgColumnFilter,
        connectionFilterOperators,
      } = build;
      const {
        scope: { isPgFieldConnection, pgFieldIntrospection: source },
        addArgDataGenerator,
        field,
        Self,
      } = context;
      if (
        !isPgFieldConnection ||
        !source ||
        (source.kind !== "class" &&
          (source.kind !== "procedure" || !connectionFilterSetofFunctions))
      ) {
        return args;
      }

      // Generate SQL where clause from filter argument
      addArgDataGenerator(function connectionFilter({ filter }) {
        return {
          pgQuery: queryBuilder => {
            // Standard columns
            const attrByFieldName = introspectionResultsByKind.attribute
              .filter(
                attr =>
                  source.kind === "class"
                    ? attr.classId === source.id
                    : attr.class.typeId === source.returnTypeId
              )
              .filter(attr => pgColumnFilter(attr, build, context))
              .reduce((memo, attr) => {
                const fieldName = inflection.column(
                  attr.name,
                  source.name,
                  source.namespace && source.namespace.name
                );
                memo[fieldName] = attr;
                return memo;
              }, {});

            // Computed columns
            const procByFieldName = introspectionResultsByKind.procedure
              .filter(proc => proc.isStable)
              .filter(proc => proc.namespaceId === source.namespaceId)
              .filter(proc => proc.name.startsWith(`${source.name}_`))
              .reduce((memo, proc) => {
                const pseudoColumnName = proc.name.substr(
                  source.name.length + 1
                );
                const fieldName = inflection.column(
                  pseudoColumnName,
                  source.name,
                  source.namespace.name
                );
                memo[fieldName] = proc;
                return memo;
              }, {});

            function resolveWhereComparison(fieldName, operatorName, input) {
              const operator = connectionFilterOperators[operatorName];
              const inputResolver = operator.options.inputResolver;

              // Standard columns
              const attr = attrByFieldName[fieldName];
              if (attr != null) {
                const identifier = sql.query`${queryBuilder.getTableAlias()}.${sql.identifier(
                  attr.name
                )}`;
                const val = Array.isArray(input)
                  ? sql.query`(${sql.join(
                      input.map(
                        i =>
                          sql.query`${gql2pg(
                            (inputResolver && inputResolver(i)) || i,
                            attr.type
                          )}`
                      ),
                      ","
                    )})`
                  : sql.query`${gql2pg(
                      (inputResolver && inputResolver(input)) || input,
                      attr.type
                    )}`;
                return operator.resolveWhereClause(identifier, val, input);
              }

              // Computed columns
              const proc = procByFieldName[fieldName];
              if (proc != null) {
                const procReturnType =
                  introspectionResultsByKind.typeById[proc.returnTypeId];
                const identifier = sql.query`${sql.identifier(
                  proc.namespace.name
                )}.${sql.identifier(
                  proc.name
                )}(${queryBuilder.getTableAlias()})`;
                const val = sql.query`${gql2pg(
                  (inputResolver && inputResolver(input)) || input,
                  procReturnType
                )}`;
                return operator.resolveWhereClause(identifier, val, input);
              }

              throw new Error(
                `Unable to resolve where comparison for filter field '${fieldName}'`
              );
            }

            function resolveWhereLogic(obj) {
              return sql.query`(${sql.join(
                Object.keys(obj).map(key => {
                  if (key === "or") {
                    return sql.query`(${sql.join(
                      obj[key].map(o => {
                        return resolveWhereLogic(o);
                      }),
                      ") or ("
                    )})`;
                  } else if (key === "and") {
                    return sql.query`(${sql.join(
                      obj[key].map(o => {
                        return resolveWhereLogic(o);
                      }),
                      ") and ("
                    )})`;
                  } else if (key === "not") {
                    return sql.query`NOT (${resolveWhereLogic(obj[key])})`;
                  } else {
                    return sql.query`(${sql.join(
                      Object.keys(obj[key]).map(k => {
                        return resolveWhereComparison(key, k, obj[key][k]);
                      }),
                      ") and ("
                    )})`;
                  }
                }),
                ") and ("
              )})`;
            }

            if (filter != null) {
              queryBuilder.where(resolveWhereLogic(filter));
            }
          },
        };
      });

      // Add filter argument for each Connection
      const returnTypeId =
        source.kind === "class" ? source.type.id : source.returnTypeId;
      const tableTypeName = pgGetGqlTypeByTypeId(returnTypeId).name;
      const TableFilterType = getTypeByName(`${tableTypeName}Filter`);
      if (TableFilterType == null) {
        return args;
      }
      return extend(
        args,
        {
          filter: {
            description:
              "A filter to be used in determining which values should be returned by the collection.",
            type: TableFilterType,
          },
        },
        `Adding connection filter arg to field '${field.name}' of '${
          Self.name
        }'`
      );
    }
  );

  builder.hook("build", build => {
    return build.extend(build, {
      escapeLikeWildcards(val) {
        if ("string" !== typeof val) {
          throw new Error("escapeLikeWildcards called on non-string value");
        } else {
          return val
            .split("%")
            .join("\\%")
            .split("_")
            .join("\\_");
        }
      },
    });
  });
};
