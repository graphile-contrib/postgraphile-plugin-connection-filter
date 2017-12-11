const defaultPgColumnFilter = (_attr, _build, _context) => true;

module.exports = function PgConnectionArgFilterPlugin(
  builder,
  { pgInflection: inflection, pgColumnFilter = defaultPgColumnFilter }
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
      connectionFilterAllowedFieldTypes,
      connectionFilterOperators,
    } = build;

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
              return introspectionResultsByKind.attribute
                .filter(attr => attr.classId === table.id)
                .filter(attr => pgColumnFilter(attr, build, context))
                .reduce(
                  (memo, attr) => {
                    const fieldName = inflection.column(
                      attr.name,
                      table.name,
                      table.namespace.name
                    );
                    const fieldType =
                      pgGetGqlInputTypeByTypeId(attr.typeId) || GraphQLString;
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
                    const fieldFilterTypeName = `${fieldTypeName}Filter`;
                    // If field filter type does not exist yet, create it
                    if (!getTypeByName(fieldFilterTypeName)) {
                      newWithHooks(
                        GraphQLInputObjectType,
                        {
                          name: fieldFilterTypeName,
                          description: `A filter to be used against ${fieldTypeName} fields. All fields are combined with a logical ‘and.’`,
                          fields: ({ fieldWithHooks }) =>
                            Object.keys(
                              connectionFilterOperators
                            ).reduce((memo, operatorName) => {
                              const operator =
                                connectionFilterOperators[operatorName];
                              const allowedFieldTypes =
                                operator.options.allowedFieldTypes;
                              if (
                                !allowedFieldTypes ||
                                allowedFieldTypes.includes(fieldTypeName)
                              ) {
                                memo[
                                  operatorName
                                ] = fieldWithHooks(operatorName, {
                                  description: operator.description,
                                  type: operator.resolveType(fieldTypeName),
                                });
                              }
                              return memo;
                            }, {}),
                        },
                        {
                          isPgConnectionFilterFilter: true,
                        }
                      );
                    }
                    const fieldFilterType = getTypeByName(fieldFilterTypeName);
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
                  },
                  {
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
                  }
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
    (
      args,
      {
        pgSql: sql,
        gql2pg,
        extend,
        getTypeByName,
        pgIntrospectionResultsByKind: introspectionResultsByKind,
        pgGetGqlTypeByTypeId,
        connectionFilterOperators,
      },
      {
        scope: { isPgFieldConnection, pgFieldIntrospection: table },
        addArgDataGenerator,
      }
    ) => {
      if (!isPgFieldConnection || !table || table.kind !== "class") {
        return args;
      }

      // Generate SQL where clause from filter argument
      addArgDataGenerator(function connectionFilter({ filter }) {
        return {
          pgQuery: queryBuilder => {
            const attrByFieldName = introspectionResultsByKind.attribute
              .filter(attr => attr.classId === table.id)
              .reduce((memo, attr) => {
                const fieldName = inflection.column(
                  attr.name,
                  table.name,
                  table.namespace && table.namespace.name
                );
                memo[fieldName] = attr;
                return memo;
              }, {});

            function resolveWhereComparison(fieldName, operatorName, input) {
              const attr = attrByFieldName[fieldName];
              const operator = connectionFilterOperators[operatorName];
              const inputResolver = operator.options.inputResolver;
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
      const tableTypeName = pgGetGqlTypeByTypeId(table.type.id).name;
      const TableFilterType = getTypeByName(`${tableTypeName}Filter`);
      return extend(args, {
        filter: {
          description:
            "A filter to be used in determining which values should be returned by the collection.",
          type: TableFilterType,
        },
      });
    }
  );
};
