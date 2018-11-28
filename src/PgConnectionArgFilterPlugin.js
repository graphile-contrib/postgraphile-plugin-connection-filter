module.exports = function PgConnectionArgFilterPlugin(
  builder,
  {
    connectionFilterLists = true,
    connectionFilterSetofFunctions = true,
    connectionFilterAllowNullInput = false,
    connectionFilterAllowEmptyObjectInput = false,
  }
) {
  // Add `filter` input argument to connection and simple collection types
  builder.hook(
    "GraphQLObjectType:fields:field:args",
    (args, build, context) => {
      const {
        extend,
        newWithHooks,
        inflection,
        pgGetGqlTypeByTypeIdAndModifier,
        pgOmit: omit,
        connectionFilterResolve,
        connectionFilterType,
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
      const FilterType = connectionFilterType(
        newWithHooks,
        filterTypeName,
        source,
        sourceTypeName
      );
      if (FilterType == null) {
        return args;
      }

      // Generate SQL where clause from filter argument
      addArgDataGenerator(function connectionFilter(args) {
        return {
          pgQuery: queryBuilder => {
            if (args.hasOwnProperty("filter")) {
              const sqlFragment = connectionFilterResolve(
                args.filter,
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

  // Add operator fields to IntFilter, StringFilter, etc.
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      graphql: { getNamedType, GraphQLList },
      connectionFilterOperatorsGlobal,
      connectionFilterOperatorsByFieldType,
      connectionFilterTypesByTypeName,
    } = build;
    const {
      scope: { isPgConnectionFilterOperators, parentFieldType },
      fieldWithHooks,
      Self,
    } = context;
    if (!isPgConnectionFilterOperators) {
      return fields;
    }

    connectionFilterTypesByTypeName[Self.name] = Self;

    const isListType = parentFieldType instanceof GraphQLList;
    const namedType = getNamedType(parentFieldType);
    const namedTypeName = namedType.name;

    const operators = {
      ...connectionFilterOperatorsGlobal,
      ...connectionFilterOperatorsByFieldType[namedTypeName],
    };
    const operatorFields = Object.entries(operators).reduce(
      (memo, [operatorName, operator]) => {
        const allowedListTypes = operator.options.allowedListTypes || [
          "NonList",
        ];
        const listTypeIsAllowed = isListType
          ? allowedListTypes.includes("List")
          : allowedListTypes.includes("NonList");
        if (listTypeIsAllowed) {
          memo[operatorName] = fieldWithHooks(operatorName, {
            description: operator.description,
            type: operator.resolveType(parentFieldType),
          });
        }
        return memo;
      },
      {}
    );

    return extend(fields, operatorFields);
  });

  builder.hook("build", build => {
    const {
      extend,
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

    const handleNullInput = () => {
      if (!connectionFilterAllowNullInput) {
        throw new Error(
          "Null literals are forbidden in filter argument input."
        );
      }
      return null;
    };

    const handleEmptyObjectInput = () => {
      if (!connectionFilterAllowEmptyObjectInput) {
        throw new Error(
          "Empty objects are forbidden in filter argument input."
        );
      }
      return null;
    };

    const isEmptyObject = obj =>
      typeof obj === "object" &&
      obj !== null &&
      !Array.isArray(obj) &&
      Object.keys(obj).length === 0;

    const connectionFilterResolve = (obj, sourceAlias, typeName) => {
      if (obj == null) return handleNullInput();
      if (isEmptyObject(obj)) return handleEmptyObjectInput();

      const sqlFragments = Object.entries(obj)
        .map(([key, value]) => {
          if (value == null) return handleNullInput();
          if (isEmptyObject(value)) return handleEmptyObjectInput();

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

    // Get or create types like IntFilter, StringFilter, etc.
    const connectionFilterOperatorsType = (fieldType, newWithHooks) => {
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

      const isListType = fieldType instanceof GraphQLList;
      if (isListType && !connectionFilterLists) {
        return null;
      }
      const operatorsTypeName = isListType
        ? inflection.filterFieldListType(namedType.name)
        : inflection.filterFieldType(namedType.name);

      return (
        connectionFilterTypesByTypeName[operatorsTypeName] ||
        newWithHooks(
          GraphQLInputObjectType,
          {
            name: operatorsTypeName,
            description: `A filter to be used against ${namedType.name}${
              isListType ? " List" : ""
            } fields. All fields are combined with a logical ‘and.’`,
          },
          {
            isPgConnectionFilterOperators: true,
            parentFieldType: fieldType,
          },
          true
        )
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
      if (input == null) return handleNullInput();
      if (isEmptyObject(input)) return handleEmptyObjectInput();

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

    const connectionFilterType = (
      newWithHooks,
      filterTypeName,
      source,
      sourceTypeName
    ) =>
      connectionFilterTypesByTypeName[filterTypeName] ||
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
      connectionFilterOperatorsType,
      connectionFilterType,
      resolveWhereComparison,
      escapeLikeWildcards,
    });
  });
};
