module.exports = function PgConnectionArgFilterPlugin(
  builder,
  { connectionFilterLists = true, connectionFilterSetofFunctions = true }
) {
  builder.hook(
    "GraphQLObjectType:fields:field:args",
    (args, build, context) => {
      const {
        extend,
        getTypeByName,
        newWithHooks,
        inflection,
        pgGetGqlTypeByTypeIdAndModifier,
        pgOmit: omit,
        connectionFilterResolve,
        newFilterType,
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

      const returnTypeId =
        source.kind === "class" ? source.type.id : source.returnTypeId;
      const sourceTypeName = pgGetGqlTypeByTypeIdAndModifier(returnTypeId, null)
        .name;
      const filterTypeName = inflection.filterType(sourceTypeName);
      const FilterType =
        getTypeByName(filterTypeName) ||
        newFilterType(newWithHooks, filterTypeName, source, sourceTypeName);
      if (FilterType == null) {
        return args;
      }

      // Generate SQL where clause from filter argument
      addArgDataGenerator(function connectionFilter({ filter }) {
        return {
          pgQuery: queryBuilder => {
            if (filter != null) {
              const sqlFragment = connectionFilterResolve(
                filter,
                queryBuilder.getTableAlias(),
                filterTypeName
              );
              if (sqlFragment != null) {
                queryBuilder.where(sqlFragment);
            }
            }
          },
        };
      });

      return extend(
        args,
        {
          filter: {
            description:
              "A filter to be used in determining which values should be returned by the collection.",
            type: FilterType,
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

    const connectionFilterFieldResolversByTypeNameAndFieldName = {};
    const connectionFilterTypesByTypeName = {};

    const connectionFilterResolve = (obj, sourceAlias, typeName) => {
      if (obj == null) return null;

      const sqlFragments = Object.entries(obj)
        .map(([key, value]) => {
          const resolversByFieldName =
            connectionFilterFieldResolversByTypeNameAndFieldName[typeName];
          if (resolversByFieldName && resolversByFieldName[key]) {
            return resolversByFieldName[key]({
              sourceAlias,
              fieldName: key,
              fieldValue: value,
            });
          }
          throw new Error(`Unable to resolve filter field '${key}'`);
        })
        .filter(x => x != null);

      return sqlFragments.length === 0
        ? null
        : sql.query`(${sql.join(sqlFragments, ") and (")})`;
    };

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

    const connectionFilterField = (
      fieldName,
      fieldType,
      fieldWithHooks,
      newWithHooks
    ) => {
      const namedType = getNamedType(fieldType);
      const isScalarType = namedType instanceof GraphQLScalarType;
      const isEnumType = namedType instanceof GraphQLEnumType;
      if (!(isScalarType || isEnumType)) {
        return null;
      }
      // Check whether this field type is filterable
      if (
        connectionFilterAllowedFieldTypes &&
        !connectionFilterAllowedFieldTypes.includes(namedType.name)
      ) {
        return null;
      }
      const fieldFilterType = getOrCreateFieldFilterTypeFromFieldType(
        fieldType,
        newWithHooks
      );
      if (!fieldFilterType) return null;
      return fieldWithHooks(
          fieldName,
          {
            description: `Filter by the object’s \`${fieldName}\` field.`,
            type: fieldFilterType,
          },
          {
            isPgConnectionFilterField: true,
          }
        );
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
      sqlIdentifier,
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
      if (input == null && !operator.options.processNull) {
        return null;
      }
      const inputResolver = operator.options.inputResolver;
      const sqlValue = operator.options.resolveWithRawInput
        ? input
        : sqlValueFromInput(input, inputResolver, pgType, pgTypeModifier);
      return operator.resolveWhereClause(sqlIdentifier, sqlValue, input);
    };

    const newFilterType = (
      newWithHooks,
      filterTypeName,
      source,
      sourceTypeName
    ) =>
      newWithHooks(
        GraphQLInputObjectType,
        {
          description: `A filter to be used against \`${sourceTypeName}\` object types. All fields are combined with a logical ‘and.’`,
          name: filterTypeName,
        },
        {
          pgIntrospection: source,
          isPgConnectionFilter: true,
        },
        true
      );

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
      connectionFilterTypesByTypeName,
      connectionFilterFieldResolversByTypeNameAndFieldName,
      connectionFilterResolve,
      connectionFilterField,
      resolveWhereComparison,
      newFilterType,
      escapeLikeWildcards,
    });
  });
};
