const { omit } = require("graphile-build-pg");

module.exports = function PgConnectionArgFilterPlugin(
  builder,
  {
    connectionFilterLists = true,
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
      inflection,
      connectionFilterAllowedFieldTypes,
      connectionFilterOperators,
    } = build;

    const getOrCreateFieldFilterTypeFromFieldType = fieldType => {
      const isListType = fieldType instanceof GraphQLList;
      if (isListType && !connectionFilterLists) {
        return null;
      }
      const fieldBaseTypeName = isListType
        ? fieldType.ofType.name
        : fieldType.name;
      const fieldFilterTypeName = isListType
        ? `${fieldBaseTypeName}ListFilter`
        : `${fieldBaseTypeName}Filter`;
      if (!getTypeByName(fieldFilterTypeName)) {
        newWithHooks(
          GraphQLInputObjectType,
          {
            name: fieldFilterTypeName,
            description: `A filter to be used against ${fieldBaseTypeName}${
              isListType ? " List" : ""
            } fields. All fields are combined with a logical ‘and.’`,
            fields: context => {
              const { fieldWithHooks } = context;
              return Object.keys(connectionFilterOperators).reduce(
                (memo, operatorName) => {
                  const operator = connectionFilterOperators[operatorName];
                  const allowedFieldTypes = operator.options.allowedFieldTypes;
                  const fieldTypeIsAllowed =
                    !allowedFieldTypes ||
                    allowedFieldTypes.includes(fieldBaseTypeName);
                  const allowedListTypes = operator.options
                    .allowedListTypes || ["NonList"];
                  const listTypeIsAllowed = isListType
                    ? allowedListTypes.includes("List")
                    : allowedListTypes.includes("NonList");
                  if (fieldTypeIsAllowed && listTypeIsAllowed) {
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

    const extendFilterFields = (memo, fieldName, fieldType, fieldWithHooks) => {
      const isListType = fieldType instanceof GraphQLList;
      const isScalarType = isListType
        ? fieldType.ofType instanceof GraphQLScalarType
        : fieldType instanceof GraphQLScalarType;
      const isEnumType = isListType
        ? fieldType.ofType instanceof GraphQLEnumType
        : fieldType instanceof GraphQLEnumType;
      if (!(isScalarType || isEnumType)) {
        return memo;
      }
      const fieldBaseTypeName = isListType
        ? fieldType.ofType.name
        : fieldType.name;
      // Check whether this field type is filterable
      if (
        connectionFilterAllowedFieldTypes &&
        !connectionFilterAllowedFieldTypes.includes(fieldBaseTypeName)
      ) {
        return memo;
      }
      const fieldFilterType = getOrCreateFieldFilterTypeFromFieldType(
        fieldType
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
      .filter(table => table.isSelectable && !omit(table, "filter"))
      .filter(table => !!table.namespace)
      .forEach(table => {
        const tableTypeName = inflection.tableType(table);
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
                .filter(attr => !omit(attr, "filter"))
                .reduce((memo, attr) => {
                  const fieldName = inflection.column(attr);
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
                    .filter(proc => !omit(proc, "filter"))
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
                      const fieldName = inflection.computedColumn(
                        pseudoColumnName,
                        proc,
                        table
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
        inflection,
        connectionFilterOperators,
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
            // Standard columns
            const attrByFieldName = introspectionResultsByKind.attribute
              .filter(
                attr =>
                  source.kind === "class"
                    ? attr.classId === source.id
                    : attr.class.typeId === source.returnTypeId
              )
              .filter(attr => pgColumnFilter(attr, build, context))
              .filter(attr => !omit(attr, "filter"))
              .reduce((memo, attr) => {
                const fieldName = inflection.column(attr);
                memo[fieldName] = attr;
                return memo;
              }, {});

            // Computed columns
            const table =
              source.kind === "class"
                ? source
                : introspectionResultsByKind.typeById[source.returnTypeId] &&
                  introspectionResultsByKind.typeById[source.returnTypeId]
                    .class;
            const procByFieldName = table
              ? introspectionResultsByKind.procedure
                  .filter(proc => proc.isStable)
                  .filter(proc => proc.namespaceId === table.namespaceId)
                  .filter(proc => proc.name.startsWith(`${table.name}_`))
                  .filter(proc => proc.argTypeIds.length > 0)
                  .filter(proc => proc.argTypeIds[0] === table.typeId)
                  .filter(proc => !omit(proc, "filter"))
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
                    const fieldName = inflection.computedColumn(
                      pseudoColumnName,
                      proc,
                      table
                    );
                    memo[fieldName] = proc;
                    return memo;
                  }, {})
              : {};

            const valFromInput = (input, inputResolver, pgType) =>
              Array.isArray(input)
                ? pgType.isPgArray
                  ? sql.query`${gql2pg(
                      (inputResolver && inputResolver(input)) || input,
                      pgType
                    )}`
                  : sql.query`(${sql.join(
                      input.map(
                        i =>
                          sql.query`${gql2pg(
                            (inputResolver && inputResolver(i)) || i,
                            pgType
                          )}`
                      ),
                      ","
                    )})`
                : pgType.isPgArray
                  ? sql.query`${gql2pg(
                      (inputResolver && inputResolver(input)) || input,
                      pgType.arrayItemType
                    )}`
                  : sql.query`${gql2pg(
                      (inputResolver && inputResolver(input)) || input,
                      pgType
                    )}`;

            function resolveWhereComparison(fieldName, operatorName, input) {
              const operator = connectionFilterOperators[operatorName];
              const inputResolver = operator.options.inputResolver;

              // Standard columns
              const attr = attrByFieldName[fieldName];
              if (attr != null) {
                const identifier = sql.query`${queryBuilder.getTableAlias()}.${sql.identifier(
                  attr.name
                )}`;
                const val = operator.options.resolveWithRawInput
                  ? input
                  : valFromInput(input, inputResolver, attr.type);
                return operator.resolveWhereClause(identifier, val);
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
                const val = operator.options.resolveWithRawInput
                  ? input
                  : valFromInput(input, inputResolver, procReturnType);
                return operator.resolveWhereClause(identifier, val);
              }

              throw new Error(
                `Unable to resolve where comparison for filter field '${fieldName}'`
              );
            }

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
                  return sql.query`(${sql.join(
                    Object.entries(value).map(([k, v]) =>
                      resolveWhereComparison(key, k, v)
                    ),
                    ") and ("
                  )})`;
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
