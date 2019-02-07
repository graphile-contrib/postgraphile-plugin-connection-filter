module.exports = function PgConnectionArgFilterPlugin(
  builder,
  {
    connectionFilterAllowedFieldTypes,
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
      if (!shouldAddFilter) return args;

      if (!source) return args;
      if (omit(source, "filter")) return args;

      if (source.kind === "procedure") {
        if (!(source.tags.filterable || connectionFilterSetofFunctions)) {
          return args;
        }
      }

      const returnTypeId =
        source.kind === "class" ? source.type.id : source.returnTypeId;
      const returnType =
        source.kind === "class"
          ? source.type
          : build.pgIntrospectionResultsByKind.type.find(
              t => t.id === returnTypeId
            );
      if (!returnType) {
        return args;
      }
      const isRecordLike = returnTypeId === "2249";
      const nodeTypeName = isRecordLike
        ? inflection.recordFunctionReturnType(source)
        : pgGetGqlTypeByTypeIdAndModifier(returnTypeId, null).name;
      const filterTypeName = inflection.filterType(nodeTypeName);
      const nodeType = getTypeByName(nodeTypeName);
      if (!nodeType) {
        return args;
      }

      const FilterType = connectionFilterType(
        newWithHooks,
        filterTypeName,
        source,
        nodeTypeName
      );
      if (!FilterType) {
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
                queryBuilder,
                returnType,
                null
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
      graphql: { getNamedType, GraphQLInputObjectType, GraphQLList },
      inflection,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      pgGetGqlInputTypeByTypeIdAndModifier,
      pgGetGqlTypeByTypeIdAndModifier,
      pgSql: sql,
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
      queryBuilder,
      pgType,
      pgTypeModifier,
      parentFieldName
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
              pgType,
              pgTypeModifier,
              parentFieldName,
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
      if (pgSimpleType.name === "json") {
        // Skip type creation with `json` so the proper operators
        // will be created with `jsonb`, if present
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
      const fieldInputType = pgGetGqlInputTypeByTypeIdAndModifier(
        pgTypeId,
        pgTypeModifier
      );
      const namedInputType = getNamedType(fieldInputType);
      const actualStringPgTypeIds = [
        "1042", // bpchar
        "18", //   char
        "25", //   text
        "1043", // varchar
      ];
      if (
        namedInputType &&
        namedInputType.name === "String" &&
        !actualStringPgTypeIds.includes(pgSimpleType.id)
      ) {
        // Not a real string type? Skip.
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

      const pgConnectionFilterOperatorsCategory = pgType.isPgArray
        ? "Array"
        : pgType.rangeSubTypeId
        ? "Range"
        : pgType.type === "e"
        ? "Enum"
        : "Scalar";

      const elementInputType = pgGetGqlInputTypeByTypeIdAndModifier(
        pgSimpleType.id,
        pgTypeModifier
      );

      const existingType = connectionFilterTypesByTypeName[operatorsTypeName];
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
          name: operatorsTypeName,
          description: `A filter to be used against ${namedType.name}${
            isListType ? " List" : ""
          } fields. All fields are combined with a logical ‘and.’`,
        },
        {
          isPgConnectionFilterOperators: true,
          pgConnectionFilterOperatorsCategory,
          fieldType,
          fieldInputType,
          elementInputType,
        },
        true
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
      connectionFilterOperatorsType,
      connectionFilterType,
      escapeLikeWildcards,
    });
  });

  builder.hook("build", build => {
    const connectionFilterOperatorSpecsAdded = [];

    const addConnectionFilterOperator = (
      name,
      description,
      resolveType,
      resolve,
      options = {}
    ) => {
      if (!name) {
        throw new Error(
          `Missing argument 'name' in call to 'addConnectionFilterOperator'`
        );
      }
      if (!resolveType) {
        throw new Error(
          `Missing argument 'resolveType' in call to 'addConnectionFilterOperator' for operator '${name}'`
        );
      }
      if (!resolve) {
        throw new Error(
          `Missing argument 'resolve' in call to 'addConnectionFilterOperator' for operator '${name}'`
        );
      }

      /*
      const allowedCategories = isNonListOnly
        ? ["Scalar", "Enum", "Range"]
        : isListOnly
        ? ["Array"]
        : null;
      */

      const { allowedFieldTypes, allowedListTypes } = options;

      const spec = {
        name,
        description,
        ...(allowedFieldTypes ? { allowedFieldTypes } : null),
        ...(allowedListTypes ? { allowedListTypes } : ["NonList"]),
        resolveType,
        resolve,
      };

      connectionFilterOperatorSpecsAdded.push(spec);
    };

    return build.extend(build, {
      addConnectionFilterOperator,
      connectionFilterOperatorSpecsAdded,
    });
  });
};
