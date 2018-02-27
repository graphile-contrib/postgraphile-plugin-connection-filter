module.exports = function PgConnectionArgFilterPlugin(
  builder,
  { pgInflection: inflection }
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

              return Object.assign({}, attrFields, logicalOperatorFields);
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
        scope: { isPgFieldConnection, pgFieldIntrospection: table },
        addArgDataGenerator,
      } = context;
      if (!isPgFieldConnection || !table || table.kind !== "class") {
        return args;
      }

      // Generate SQL where clause from filter argument
      addArgDataGenerator(function connectionFilter({ filter }) {
        return {
          pgQuery: queryBuilder => {
            const attrByFieldName = introspectionResultsByKind.attribute
              .filter(attr => attr.classId === table.id)
              .filter(attr => pgColumnFilter(attr, build, context))
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
              const operator = connectionFilterOperators[operatorName];
              const inputResolver = operator.options.inputResolver;

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
