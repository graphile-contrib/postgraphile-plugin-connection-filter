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
      const nodeTypeName =
        returnTypeId === "2249" // returns `RECORD`
          ? inflection.recordFunctionReturnType(source)
          : pgGetGqlTypeByTypeIdAndModifier(returnTypeId, null).name;
      const filterTypeName = inflection.filterType(nodeTypeName);
      const FilterType = connectionFilterType(
        newWithHooks,
        filterTypeName,
        source,
        nodeTypeName
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
                filterTypeName,
                queryBuilder
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

    const connectionFilterResolve = (
      obj,
      sourceAlias,
      typeName,
      queryBuilder
    ) => {
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
              queryBuilder,
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

    const resolveWhereComparison = (
      sqlIdentifier,
      operatorName,
      input,
      pgType,
      pgTypeModifier,
      fieldName,
      queryBuilder
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

      const sqlValueFromInput = (input, pgType, pgTypeModifier) =>
        sql.query`${gql2pg(
          (operator.options.inputResolver &&
            operator.options.inputResolver(input)) ||
            input,
          pgType,
          pgTypeModifier
        )}`;

      // TODO: Remove `resolveWithRawInput` option before v1.0.0
      const sqlValue = operator.options.resolveWithRawInput
        ? input
        : Array.isArray(input)
        ? pgType.isPgArray
          ? sqlValueFromInput(input, pgType, pgTypeModifier)
          : input.length === 0
          ? sql.query`(select ${sqlIdentifier} limit 0)`
          : sql.query`(${sql.join(
              input.map(i => sqlValueFromInput(i, pgType, pgTypeModifier)),
              ","
            )})`
        : pgType.isPgArray
        ? sqlValueFromInput(input, pgType.arrayItemType, pgTypeModifier)
        : sqlValueFromInput(input, pgType, pgTypeModifier);

      return operator.resolveWhereClause(
        sqlIdentifier,
        sqlValue,
        input,
        fieldName,
        queryBuilder
      );
    };

    const connectionFilterType = (
      newWithHooks,
      filterTypeName,
      source,
      nodeTypeName
    ) => {
      const existingType = connectionFilterTypesByTypeName[filterTypeName];
      if (existingType) {
        if (
          typeof existingType._fields === "object" &&
          Object.keys(existingType._fields).length === 0
        ) {
          // Existing type is fully defined and
          // there are no fields, so don't return a type
          return null;
        }
        // Existing type isn't fully defined or is
        // fully defined with fields, so return it
        return existingType;
      }
      return newWithHooks(
        GraphQLInputObjectType,
        {
          description: `A filter to be used against \`${nodeTypeName}\` object types. All fields are combined with a logical ‘and.’`,
          name: filterTypeName,
        },
        {
          pgIntrospection: source,
          isPgConnectionFilter: true,
        },
        true
      );
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
