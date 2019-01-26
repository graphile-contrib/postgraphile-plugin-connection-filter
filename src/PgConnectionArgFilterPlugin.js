module.exports = function PgConnectionArgFilterPlugin(
  builder,
  {
    connectionFilterLists,
    connectionFilterSetofFunctions,
    connectionFilterAllowNullInput,
    connectionFilterAllowEmptyObjectInput,
  }
) {
  // Add `filter` input argument to connection and simple collection types
  builder.hook(
    "GraphQLObjectType:fields:field:args",
    (args, build, context) => {
      const {
        extend,
        newWithHooks,
        getTypeByName,
        inflection,
        graphql: { getNamedType, GraphQLScalarType, GraphQLEnumType },
        pgGetGqlTypeByTypeIdAndModifier,
        pgIntrospectionResultsByKind: introspectionResultsByKind,
        pgOmit: omit,
        connectionFilterRegisterResolver,
        connectionFilterOperatorsType,
        connectionFilterResolve,
        connectionFilterResolvePredicates,
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
      const nodeType = getTypeByName(nodeTypeName);
      if (!nodeType) {
        return args;
      }
      const isScalarType = nodeType instanceof GraphQLScalarType;
      const isEnumType = nodeType instanceof GraphQLEnumType;

      let FilterType;

      if (isScalarType || isEnumType) {
        FilterType = connectionFilterOperatorsType(
          newWithHooks,
          returnTypeId,
          null
        );
        if (FilterType == null) {
          return args;
        }

        const fieldTypeName = getNamedType(field.type).name;

        const resolve = ({
          sourceAlias,
          fieldName,
          fieldValue,
          queryBuilder,
        }) => {
          if (fieldValue == null) return null;

          const sqlIdentifier = sourceAlias;
          const pgType = introspectionResultsByKind.typeById[returnTypeId];
          const pgTypeModifier = null;

          return connectionFilterResolvePredicates({
            sourceAlias,
            fieldName,
            fieldValue,
            queryBuilder,
            sqlIdentifier,
            pgType,
            pgTypeModifier,
          });
        };
        connectionFilterRegisterResolver(fieldTypeName, "filter", resolve);

        // Generate SQL where clause from filter argument
        addArgDataGenerator(function connectionFilter(args) {
          return {
            pgQuery: queryBuilder => {
              if (args.hasOwnProperty("filter")) {
                const sqlFragment = connectionFilterResolve(
                  { filter: args.filter },
                  queryBuilder.getTableAlias(),
                  fieldTypeName,
                  queryBuilder
                );
                if (sqlFragment != null) {
                  queryBuilder.where(sqlFragment);
                }
              }
            },
          };
        });
      } else {
        FilterType = connectionFilterType(
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
      }

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
      pgGetGqlTypeByTypeIdAndModifier,
      pgGetGqlInputTypeByTypeIdAndModifier,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      connectionFilterOperatorsGlobal,
      connectionFilterOperatorsByFieldType,
      connectionFilterTypesByTypeName,
    } = build;
    const {
      scope: { isPgConnectionFilterOperators, pgTypeId, pgTypeModifier },
      fieldWithHooks,
      Self,
    } = context;
    if (!isPgConnectionFilterOperators || !pgTypeId) {
      return fields;
    }

    connectionFilterTypesByTypeName[Self.name] = Self;

    const fieldType = pgGetGqlTypeByTypeIdAndModifier(pgTypeId, pgTypeModifier);
    const fieldInputType = pgGetGqlInputTypeByTypeIdAndModifier(
      pgTypeId,
      pgTypeModifier
    );
    const pgType = introspectionResultsByKind.typeById[pgTypeId];
    const fieldBaseInputType = pgType.isPgArray
      ? pgGetGqlInputTypeByTypeIdAndModifier(
          pgType.arrayItemType.id,
          pgTypeModifier
        )
      : pgType.rangeSubTypeId
      ? pgGetGqlInputTypeByTypeIdAndModifier(
          pgType.rangeSubTypeId,
          pgTypeModifier
        )
      : fieldInputType;

    if (!fieldType || !fieldInputType || !fieldBaseInputType) {
      return fields;
    }

    const isListType = fieldType instanceof GraphQLList;
    const namedType = getNamedType(fieldType);

    const operators = {
      ...connectionFilterOperatorsGlobal,
      ...connectionFilterOperatorsByFieldType[namedType.name],
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
            type: operator.resolveType(fieldInputType, fieldBaseInputType),
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
      graphql: { getNamedType, GraphQLInputObjectType, GraphQLList },
      inflection,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      pgGetGqlTypeByTypeIdAndModifier,
      pgSql: sql,
      connectionFilterAllowedFieldTypes,
      connectionFilterOperatorsByFieldType,
      connectionFilterOperatorsGlobal,
    } = build;

    const connectionFilterResolvers = {};
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

    const connectionFilterRegisterResolver = (typeName, fieldName, resolve) => {
      connectionFilterResolvers[typeName] = extend(
        connectionFilterResolvers[typeName] || {},
        { [fieldName]: resolve }
      );
    };

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

          const resolversByFieldName = connectionFilterResolvers[typeName];
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

    const connectionFilterResolvePredicates = ({
      sourceAlias,
      fieldName,
      fieldValue,
      queryBuilder,
      sqlIdentifier,
      pgType,
      pgTypeModifier,
    }) => {
      const sqlFragments = Object.entries(fieldValue)
        .map(([operatorName, input]) =>
          resolvePredicate(
            sqlIdentifier,
            operatorName,
            input,
            pgType,
            pgTypeModifier,
            fieldName,
            queryBuilder,
            sourceAlias
          )
        )
        .filter(x => x != null);
      return sqlFragments.length === 0
        ? null
        : sql.query`(${sql.join(sqlFragments, ") and (")})`;
    };

    // Get or create types like IntFilter, StringFilter, etc.
    const connectionFilterOperatorsType = (
      newWithHooks,
      pgTypeId,
      pgTypeModifier
    ) => {
      const pgType = introspectionResultsByKind.typeById[pgTypeId];
      const allowedPgTypeTypes = ["b", "e", "r"];
      if (!allowedPgTypeTypes.includes(pgType.type)) {
        // Not a base, enum, or range type? Skip.
        return null;
      }
      const pgGetNonArrayType = pgType =>
        pgType.isPgArray ? pgType.arrayItemType : pgType;
      const pgGetNonRangeType = pgType =>
        pgType.rangeSubTypeId
          ? introspectionResultsByKind.typeById[pgType.rangeSubTypeId]
          : pgType;
      const pgGetSimpleType = pgType =>
        pgGetNonRangeType(pgGetNonArrayType(pgType));
      const pgSimpleType = pgGetSimpleType(pgType);
      const allowedPgSimpleTypeIds = [
        "1560", // bit
        "16", //   bool
        "1042", // bpchar
        "17", //   bytea
        "18", //   char
        "650", //  cidr
        "1082", // date
        "700", //  float4
        "701", //  float8
        "869", //  inet
        "21", //   int2
        "23", //   int4
        "20", //   int8
        "1186", // interval
        "3802", // jsonb
        "829", //  macaddr
        "774", //  macaddr8
        "790", //  money
        "1700", // numeric
        "25", //   text
        "1083", // time
        "1114", // timestamp
        "1184", // timestamptz
        "1266", // timetz
        "2950", // uuid
        "1562", // varbit
        "1043", // varchar
      ];
      if (
        !allowedPgSimpleTypeIds.includes(pgSimpleType.id) &&
        pgType.type !== "e" // enum
      ) {
        // Not whitelisted and not an enum? Skip.
        return null;
      }
      const fieldType = pgGetGqlTypeByTypeIdAndModifier(
        pgTypeId,
        pgTypeModifier
      );
      if (!fieldType) {
        return null;
      }
      const namedType = getNamedType(fieldType);

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
            pgTypeId,
            pgTypeModifier,
          },
          true
        )
      );
    };

    const resolvePredicate = (
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
        pgGetGqlTypeByTypeIdAndModifier(pgType.id, pgTypeModifier)
      );
      const operator =
        connectionFilterOperatorsGlobal[operatorName] ||
        (connectionFilterOperatorsByFieldType[fieldType.name] &&
          connectionFilterOperatorsByFieldType[fieldType.name][operatorName]);
      if (!operator) {
        throw new Error(`Unable to resolve operator '${operatorName}'`);
      }

      const { inputResolver, sqlValueResolver } = operator.options;

      const sqlValueFromInput = (input, pgType, pgTypeModifier) => {
        return gql2pg(
          inputResolver ? inputResolver(input) : input,
          pgType,
          pgTypeModifier
        );
      };

      const sqlValue = sqlValueResolver
        ? sqlValueResolver(input, pgType, pgTypeModifier)
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
      connectionFilterRegisterResolver,
      connectionFilterResolve,
      connectionFilterResolvePredicates,
      connectionFilterOperatorsType,
      connectionFilterType,
      escapeLikeWildcards,
    });
  });
};
