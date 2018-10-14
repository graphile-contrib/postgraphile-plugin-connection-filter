module.exports = function PgConnectionArgFilterPlugin(
  builder,
  { connectionFilterLists = true, connectionFilterSetofFunctions = true }
) {
  builder.hook("init", (_, build) => {
    const {
      newWithHooks,
      getTypeByName,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      graphql: { GraphQLInputObjectType, GraphQLList, GraphQLNonNull },
      pgOmit: omit,
      inflection,
    } = build;

    // Add *Filter type for each Connection type
    introspectionResultsByKind.class
      .filter(table => table.isSelectable && !omit(table, "filter"))
      .filter(table => !!table.namespace)
      .forEach(table => {
        const tableTypeName = inflection.tableType(table);
        newWithHooks(
          GraphQLInputObjectType,
          {
            description: `A filter to be used against \`${tableTypeName}\` object types. All fields are combined with a logical ‘and.’`,
            name: inflection.filterType(tableTypeName),
            fields: context => {
              const { fieldWithHooks } = context;

              // Logical operator fields
              const logicalOperatorFields = {
                and: fieldWithHooks(
                  "and",
                  {
                    description: `Checks for all expressions in this list.`,
                    type: new GraphQLList(
                      new GraphQLNonNull(
                        getTypeByName(inflection.filterType(tableTypeName))
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
                        getTypeByName(inflection.filterType(tableTypeName))
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
                    type: getTypeByName(inflection.filterType(tableTypeName)),
                  },
                  {
                    isPgConnectionFilterOperatorLogical: true,
                  }
                ),
              };

              return logicalOperatorFields;
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
        extend,
        getTypeByName,
        inflection,
        pgGetGqlTypeByTypeIdAndModifier,
        pgIntrospectionResultsByKind: introspectionResultsByKind,
        pgOmit: omit,
        connectionFilterFieldResolvers,
      } = build;
      const {
        scope: {
          isPgFieldConnection,
          isPgFieldSimpleCollection,
          pgFieldIntrospection: source,
        },
        addArgDataGenerator,
        field,
        Self,
      } = context;
      const shouldAddFilter = isPgFieldConnection || isPgFieldSimpleCollection;
      if (
        !shouldAddFilter ||
        !source ||
        (source.kind !== "class" &&
          (source.kind !== "procedure" || !connectionFilterSetofFunctions)) ||
        omit(source, "filter")
      ) {
        return args;
      }

      // Generate SQL where clause from filter argument
      addArgDataGenerator(function connectionFilter({ filter }) {
        return {
          pgQuery: queryBuilder => {
            function resolveWhereLogic(obj) {
              // Ignore fields where the expression is {}
              const entries = Object.entries(obj).filter(
                ([, value]) => Object.keys(value).length > 0
              );
              // If no fields remain, return TRUE
              if (entries.length === 0) {
                return sql.query`TRUE`;
              }
              const whereLogic = entries.map(([key, value]) => {
                if (key === "or") {
                  return sql.query`(${sql.join(
                    value.map(o => {
                      return resolveWhereLogic(o);
                    }),
                    ") or ("
                  )})`;
                } else if (key === "and") {
                  return sql.query`(${sql.join(
                    value.map(o => {
                      return resolveWhereLogic(o);
                    }),
                    ") and ("
                  )})`;
                } else if (key === "not") {
                  return sql.query`NOT (${resolveWhereLogic(value)})`;
                } else {
                  // Ignore filter expressions where the value is null
                  const e = Object.entries(value).filter(([, v]) => v != null);
                  // If no filter expressions remain, return TRUE
                  if (e.length === 0) {
                    return sql.query`TRUE`;
                  }
                  // Try to resolve field
                  for (const resolve of connectionFilterFieldResolvers) {
                    const resolved = resolve({
                      sourceAlias: queryBuilder.getTableAlias(),
                      source: source,
                      fieldName: key,
                      fieldValue: value,
                      introspectionResultsByKind,
                      connectionFilterFieldResolvers,
                    });
                    if (resolved != null) return resolved;
                  }
                  throw new Error(
                    `Unable to resolve where comparison for filter field '${key}'`
                  );
                }
              });
              return sql.query`(${sql.join(whereLogic, ") and (")})`;
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
      const tableTypeName = pgGetGqlTypeByTypeIdAndModifier(returnTypeId, null)
        .name;
      const TableFilterType = getTypeByName(
        inflection.filterType(tableTypeName)
      );
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
    const {
      extend,
      getTypeByName,
      gql2pg,
      graphql: {
        getNamedType,
        GraphQLInputObjectType,
        GraphQLList,
        GraphQLScalarType,
        GraphQLEnumType,
        GraphQLString,
      },
      inflection,
      pgGetGqlInputTypeByTypeIdAndModifier,
      pgSql: sql,
      connectionFilterAllowedFieldTypes,
      connectionFilterOperatorsByFieldType,
      connectionFilterOperatorsGlobal,
    } = build;

    const getOrCreateFieldFilterTypeFromFieldType = (
      fieldType,
      newWithHooks
    ) => {
      const isListType = fieldType instanceof GraphQLList;
      if (isListType && !connectionFilterLists) {
        return null;
      }
      const namedType = getNamedType(fieldType);
      const namedTypeName = namedType.name;
      const fieldFilterTypeName = isListType
        ? inflection.filterFieldListType(namedTypeName)
        : inflection.filterFieldType(namedTypeName);
      if (!getTypeByName(fieldFilterTypeName)) {
        newWithHooks(
          GraphQLInputObjectType,
          {
            name: fieldFilterTypeName,
            description: `A filter to be used against ${namedTypeName}${
              isListType ? " List" : ""
            } fields. All fields are combined with a logical ‘and.’`,
            fields: context => {
              const { fieldWithHooks } = context;
              const operators = Object.assign(
                {},
                connectionFilterOperatorsGlobal,
                connectionFilterOperatorsByFieldType[namedTypeName]
              );
              return Object.entries(operators).reduce(
                (memo, [operatorName, operator]) => {
                  const allowedListTypes = operator.options
                    .allowedListTypes || ["NonList"];
                  const listTypeIsAllowed = isListType
                    ? allowedListTypes.includes("List")
                    : allowedListTypes.includes("NonList");
                  if (listTypeIsAllowed) {
                    memo[operatorName] = fieldWithHooks(operatorName, {
                      description: operator.description,
                      type: operator.resolveType(fieldType),
                    });
                  }
                  return memo;
                },
                {}
              );
            },
          },
          {
            isPgConnectionFilterFilter: true,
          }
        );
      }
      return getTypeByName(fieldFilterTypeName);
    };

    const extendFilterFields = (
      memo,
      fieldName,
      fieldType,
      fieldWithHooks,
      newWithHooks
    ) => {
      const namedType = getNamedType(fieldType);
      const isScalarType = namedType instanceof GraphQLScalarType;
      const isEnumType = namedType instanceof GraphQLEnumType;
      if (!(isScalarType || isEnumType)) {
        return memo;
      }
      // Check whether this field type is filterable
      if (
        connectionFilterAllowedFieldTypes &&
        !connectionFilterAllowedFieldTypes.includes(namedType.name)
      ) {
        return memo;
      }
      const fieldFilterType = getOrCreateFieldFilterTypeFromFieldType(
        fieldType,
        newWithHooks
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

    const sqlValueFromInput = (input, inputResolver, pgType, pgTypeModifier) =>
      Array.isArray(input)
        ? pgType.isPgArray
          ? sql.query`${gql2pg(
              (inputResolver && inputResolver(input)) || input,
              pgType,
              pgTypeModifier
            )}`
          : sql.query`(${sql.join(
              input.map(
                i =>
                  sql.query`${gql2pg(
                    (inputResolver && inputResolver(i)) || i,
                    pgType,
                    pgTypeModifier
                  )}`
              ),
              ","
            )})`
        : pgType.isPgArray
          ? sql.query`${gql2pg(
              (inputResolver && inputResolver(input)) || input,
              pgType.arrayItemType,
              pgTypeModifier
            )}`
          : sql.query`${gql2pg(
              (inputResolver && inputResolver(input)) || input,
              pgType,
              pgTypeModifier
            )}`;

    const resolveWhereComparison = (
      identifier,
      operatorName,
      input,
      pgType,
      pgTypeModifier
    ) => {
      const fieldType = getNamedType(
        pgGetGqlInputTypeByTypeIdAndModifier(pgType.id, pgTypeModifier) ||
          GraphQLString
      );
      const operator =
        connectionFilterOperatorsGlobal[operatorName] ||
        (connectionFilterOperatorsByFieldType[fieldType.name] &&
          connectionFilterOperatorsByFieldType[fieldType.name][operatorName]);
      if (!operator) {
        throw new Error(`Unable to resolve operator '${operatorName}'`);
      }
      const inputResolver = operator.options.inputResolver;
      const value = operator.options.resolveWithRawInput
        ? input
        : sqlValueFromInput(input, inputResolver, pgType, pgTypeModifier);
      return operator.resolveWhereClause(identifier, value);
    };

    const escapeLikeWildcards = input => {
      if ("string" !== typeof input) {
        throw new Error("Non-string input was provided to escapeLikeWildcards");
      } else {
        return input
          .split("%")
          .join("\\%")
          .split("_")
          .join("\\_");
      }
    };

    return extend(build, {
      connectionFilterFieldResolvers: [],
      extendFilterFields,
      resolveWhereComparison,
      escapeLikeWildcards,
    });
  });
};
