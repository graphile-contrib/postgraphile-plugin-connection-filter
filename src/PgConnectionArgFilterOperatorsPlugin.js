module.exports = function PgConnectionArgFilterOperatorsPlugin(
  builder,
  { connectionFilterAllowedOperators, connectionFilterOperatorNames }
) {
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      graphql: { getNamedType, GraphQLBoolean, GraphQLNonNull, GraphQLList },
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      pgSql: sql,
      gql2pg,
      connectionFilterOperatorSpecsAdded,
      connectionFilterRegisterResolver,
      connectionFilterTypesByTypeName,
      escapeLikeWildcards,
    } = build;
    const {
      scope: {
        isPgConnectionFilterOperators,
        pgConnectionFilterFieldCategory: category,
        pgConnectionFilterInputType: inputType,
        pgConnectionFilterElementInputType: elementInputType,
      },
      fieldWithHooks,
      Self,
    } = context;
    if (!isPgConnectionFilterOperators || !category || !inputType) {
      return fields;
    }

    connectionFilterTypesByTypeName[Self.name] = Self;

    const operatorSpecs = [
      // Null
      {
        name: "isNull",
        description:
          "Is null (if `true` is specified) or is not null (if `false` is specified).",
        resolveType: () => GraphQLBoolean,
        resolve: (i, _v, input) =>
          sql.query`${i} ${
            input ? sql.query`IS NULL` : sql.query`IS NOT NULL`
          }`,
      },
      // Equality
      {
        name: "equalTo",
        description: "Equal to the specified value.",
        resolve: (i, v) => sql.query`${i} = ${v}`,
      },
      {
        name: "notEqualTo",
        description: "Not equal to the specified value.",
        resolve: (i, v) => sql.query`${i} <> ${v}`,
      },
      {
        name: "distinctFrom",
        description:
          "Not equal to the specified value, treating null like an ordinary value.",
        resolve: (i, v) => sql.query`${i} IS DISTINCT FROM ${v}`,
      },
      {
        name: "notDistinctFrom",
        description:
          "Equal to the specified value, treating null like an ordinary value.",
        resolve: (i, v) => sql.query`${i} IS NOT DISTINCT FROM ${v}`,
      },
      // Inclusion
      {
        name: "in",
        description: "Included in the specified list.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        resolveType: fieldInputType =>
          new GraphQLList(new GraphQLNonNull(fieldInputType)),
        resolve: (i, v) => sql.query`${i} IN ${v}`,
      },
      {
        name: "notIn",
        description: "Not included in the specified list.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        resolveType: fieldInputType =>
          new GraphQLList(new GraphQLNonNull(fieldInputType)),
        resolve: (i, v) => sql.query`${i} NOT IN ${v}`,
      },
      // Comparison
      {
        name: "lessThan",
        description: "Less than the specified value.",
        resolve: (i, v) => sql.query`${i} < ${v}`,
      },
      {
        name: "lessThanOrEqualTo",
        description: "Less than or equal to the specified value.",
        resolve: (i, v) => sql.query`${i} <= ${v}`,
      },
      {
        name: "greaterThan",
        description: "Greater than the specified value.",
        resolve: (i, v) => sql.query`${i} > ${v}`,
      },
      {
        name: "greaterThanOrEqualTo",
        description: "Greater than or equal to the specified value.",
        resolve: (i, v) => sql.query`${i} >= ${v}`,
      },
      // Pattern matching
      {
        name: "includes",
        description: "Contains the specified string (case-sensitive).",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolveInput: input => `%${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} LIKE ${v}`,
      },
      {
        name: "notIncludes",
        description: "Does not contain the specified string (case-sensitive).",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolveInput: input => `%${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} NOT LIKE ${v}`,
      },
      {
        name: "includesInsensitive",
        description: "Contains the specified string (case-insensitive).",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolveInput: input => `%${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} ILIKE ${v}`,
      },
      {
        name: "notIncludesInsensitive",
        description:
          "Does not contain the specified string (case-insensitive).",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolveInput: input => `%${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} NOT ILIKE ${v}`,
      },
      {
        name: "startsWith",
        description: "Starts with the specified string (case-sensitive).",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolveInput: input => `${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} LIKE ${v}`,
      },
      {
        name: "notStartsWith",
        description:
          "Does not start with the specified string (case-sensitive).",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolveInput: input => `${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} NOT LIKE ${v}`,
      },
      {
        name: "startsWithInsensitive",
        description: "Starts with the specified string (case-insensitive).",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolveInput: input => `${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} ILIKE ${v}`,
      },
      {
        name: "notStartsWithInsensitive",
        description:
          "Does not start with the specified string (case-insensitive).",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolveInput: input => `${escapeLikeWildcards(input)}%`,
        resolve: (i, v) => sql.query`${i} NOT ILIKE ${v}`,
      },
      {
        name: "endsWith",
        description: "Ends with the specified string (case-sensitive).",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolveInput: input => `%${escapeLikeWildcards(input)}`,
        resolve: (i, v) => sql.query`${i} LIKE ${v}`,
      },
      {
        name: "notEndsWith",
        description: "Does not end with the specified string (case-sensitive).",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolveInput: input => `%${escapeLikeWildcards(input)}`,
        resolve: (i, v) => sql.query`${i} NOT LIKE ${v}`,
      },
      {
        name: "endsWithInsensitive",
        description: "Ends with the specified string (case-insensitive).",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolveInput: input => `%${escapeLikeWildcards(input)}`,
        resolve: (i, v) => sql.query`${i} ILIKE ${v}`,
      },
      {
        name: "notEndsWithInsensitive",
        description:
          "Does not end with the specified string (case-insensitive).",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolveInput: input => `%${escapeLikeWildcards(input)}`,
        resolve: (i, v) => sql.query`${i} NOT ILIKE ${v}`,
      },
      {
        name: "like",
        description:
          "Matches the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolve: (i, v) => sql.query`${i} LIKE ${v}`,
      },
      {
        name: "notLike",
        description:
          "Does not match the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolve: (i, v) => sql.query`${i} NOT LIKE ${v}`,
      },
      {
        name: "likeInsensitive",
        description:
          "Matches the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolve: (i, v) => sql.query`${i} ILIKE ${v}`,
      },
      {
        name: "notLikeInsensitive",
        description:
          "Does not match the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolve: (i, v) => sql.query`${i} NOT ILIKE ${v}`,
      },
      {
        name: "similarTo",
        description:
          "Matches the specified pattern using the SQL standard's definition of a regular expression.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolve: (i, v) => sql.query`${i} SIMILAR TO ${v}`,
      },
      {
        name: "notSimilarTo",
        description:
          "Does not match the specified pattern using the SQL standard's definition of a regular expression.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["String"],
        resolve: (i, v) => sql.query`${i} NOT SIMILAR TO ${v}`,
      },
      // TODO: add regexp operators
      // JSON
      {
        name: "contains",
        description: "Contains the specified JSON.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["JSON"],
        resolve: (i, v) => sql.query`${i} @> ${v}`,
      },
      {
        name: "containedBy",
        description: "Contained by the specified JSON.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["JSON"],
        resolve: (i, v) => sql.query`${i} <@ ${v}`,
      },
      /*{
        name: "keyExists",
        description: "Specified top-level key exists.",
        allowedFieldTypes: ["JSON"],
        resolveType: () => GraphQLString,
        resolve: (i, v) => sql.query`${i} ? ${v}`,
      },*/
      // InternetAddress
      {
        name: "contains",
        description: "Contains the specified internet address.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["InternetAddress"],
        resolve: (i, v) => sql.query`${i} >> ${v}`,
      },
      {
        name: "containsOrEqualTo",
        description: "Contains or equal to the specified internet address.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["InternetAddress"],
        resolve: (i, v) => sql.query`${i} >>= ${v}`,
      },
      {
        name: "containedBy",
        description: "Contained by the specified internet address.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["InternetAddress"],
        resolve: (i, v) => sql.query`${i} << ${v}`,
      },
      {
        name: "containedByOrEqualTo",
        description: "Contained by or equal to the specified internet address.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["InternetAddress"],
        resolve: (i, v) => sql.query`${i} <<= ${v}`,
      },
      {
        name: "containsOrContainedBy",
        description: "Contains or contained by the specified internet address.",
        allowedCategories: ["Scalar", "Enum", "Range"],
        allowedFieldTypes: ["InternetAddress"],
        resolve: (i, v) => sql.query`${i} && ${v}`,
      },
      // Array Types
      {
        name: "contains",
        description: "Contains the specified list of values.",
        allowedCategories: ["Array"],
        resolve: (i, v) => sql.query`${i} @> ${v}`,
      },
      {
        name: "containedBy",
        description: "Contained by the specified list of values.",
        allowedCategories: ["Array"],
        resolve: (i, v) => sql.query`${i} <@ ${v}`,
      },
      {
        name: "overlaps",
        description: "Overlaps the specified list of values.",
        allowedCategories: ["Array"],
        resolve: (i, v) => sql.query`${i} && ${v}`,
      },
      {
        name: "anyEqualTo",
        description: "Any array item is equal to the specified value.",
        allowedCategories: ["Array"],
        resolveType: fieldInputType => getNamedType(fieldInputType),
        resolve: (i, v) => sql.query`${v} = ANY (${i})`,
      },
      {
        name: "anyNotEqualTo",
        description: "Any array item is not equal to the specified value.",
        allowedCategories: ["Array"],
        resolveType: fieldInputType => getNamedType(fieldInputType),
        resolve: (i, v) => sql.query`${v} <> ANY (${i})`,
      },
      {
        name: "anyLessThan",
        description: "Any array item is less than the specified value.",
        allowedCategories: ["Array"],
        resolveType: fieldInputType => getNamedType(fieldInputType),
        resolve: (i, v) => sql.query`${v} > ANY (${i})`,
      },
      {
        name: "anyLessThanOrEqualTo",
        description:
          "Any array item is less than or equal to the specified value.",
        allowedCategories: ["Array"],
        resolveType: fieldInputType => getNamedType(fieldInputType),
        resolve: (i, v) => sql.query`${v} >= ANY (${i})`,
      },
      {
        name: "anyGreaterThan",
        description: "Any array item is greater than the specified value.",
        allowedCategories: ["Array"],
        resolveType: fieldInputType => getNamedType(fieldInputType),
        resolve: (i, v) => sql.query`${v} < ANY (${i})`,
      },
      {
        name: "anyGreaterThanOrEqualTo",
        description:
          "Any array item is greater than or equal to the specified value.",
        allowedCategories: ["Array"],
        resolveType: fieldInputType => getNamedType(fieldInputType),
        resolve: (i, v) => sql.query`${v} <= ANY (${i})`,
      },
      // Range Types
      {
        name: "contains",
        description: "Contains the specified range.",
        allowedCategories: ["Range"],
        resolve: (i, v) => sql.query`${i} @> ${v}`,
      },
      {
        name: "containsElement",
        description: "Contains the specified value.",
        allowedCategories: ["Range"],
        resolveType: (_fieldInputType, elementInputType) => elementInputType,
        resolveSqlValue: (input, pgType, pgTypeModifier) => {
          const rangeSubType =
            introspectionResultsByKind.typeById[pgType.rangeSubTypeId];
          return sql.query`${gql2pg(
            input,
            pgType.rangeSubTypeId,
            pgTypeModifier
          )}::${sql.identifier(rangeSubType.namespaceName, rangeSubType.name)}`;
        },
        resolve: (i, v) => sql.query`${i} @> ${v}`,
      },
      {
        name: "containedBy",
        description: "Contained by the specified range.",
        allowedCategories: ["Range"],
        resolve: (i, v) => sql.query`${i} <@ ${v}`,
      },
      {
        name: "overlaps",
        description: "Overlaps the specified range.",
        allowedCategories: ["Range"],
        resolve: (i, v) => sql.query`${i} && ${v}`,
      },
      {
        name: "strictlyLeftOf",
        description: "Strictly left of the specified range.",
        allowedCategories: ["Range"],
        resolve: (i, v) => sql.query`${i} << ${v}`,
      },
      {
        name: "strictlyRightOf",
        description: "Strictly right of the specified range.",
        allowedCategories: ["Range"],
        resolve: (i, v) => sql.query`${i} >> ${v}`,
      },
      {
        name: "notExtendsRightOf",
        description: "Does not extend right of the specified range.",
        allowedCategories: ["Range"],
        resolve: (i, v) => sql.query`${i} &< ${v}`,
      },
      {
        name: "notExtendsLeftOf",
        description: "Does not extend left of the specified range.",
        allowedCategories: ["Range"],
        resolve: (i, v) => sql.query`${i} &> ${v}`,
      },
      {
        name: "adjacentTo",
        description: "Adjacent to the specified range.",
        allowedCategories: ["Range"],
        resolve: (i, v) => sql.query`${i} -|- ${v}`,
      },
    ];

    for (const operatorSpec of connectionFilterOperatorSpecsAdded) {
      operatorSpecs.push(operatorSpec);
    }

    const operatorSpecByFieldName = {};

    const operatorFields = operatorSpecs.reduce((memo, spec) => {
      const {
        name,
        description,
        allowedFieldTypes,
        allowedCategories,
        resolveType,
      } = spec;

      if (
        connectionFilterAllowedOperators &&
        !connectionFilterAllowedOperators.includes(name)
      ) {
        return memo;
      }
      if (
        allowedFieldTypes &&
        !allowedFieldTypes.includes(getNamedType(inputType).name)
      ) {
        return memo;
      }
      if (allowedCategories && !allowedCategories.includes(category)) {
        return memo;
      }
      const type = resolveType
        ? resolveType(inputType, elementInputType)
        : inputType;

      const operatorName =
        (connectionFilterOperatorNames &&
          connectionFilterOperatorNames[name]) ||
        name;

      operatorSpecByFieldName[operatorName] = spec;

      memo[operatorName] = fieldWithHooks(
        operatorName,
        {
          description,
          type,
        },
        {
          isPgConnectionFilterOperator: true,
        }
      );
      return memo;
    }, {});

    const resolve = ({
      sourceAlias,
      fieldName,
      fieldValue,
      queryBuilder,
      pgType,
      pgTypeModifier,
      parentFieldName,
    }) => {
      if (fieldValue == null) return null;

      const sqlIdentifier = sourceAlias;

      const operatorSpec = operatorSpecByFieldName[fieldName];
      const { resolveInput, resolveSqlValue } = operatorSpec;

      const input = fieldValue;

      const sqlValueFromInput = (input, pgType, pgTypeModifier) => {
        return gql2pg(
          resolveInput ? resolveInput(input) : input,
          pgType,
          pgTypeModifier
        );
      };

      const sqlValue = resolveSqlValue
        ? resolveSqlValue(input, pgType, pgTypeModifier)
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

      return operatorSpec.resolve(
        sqlIdentifier,
        sqlValue,
        input,
        parentFieldName,
        queryBuilder
      );
    };

    for (const fieldName of Object.keys(operatorFields)) {
      connectionFilterRegisterResolver(Self.name, fieldName, resolve);
    }

    return extend(fields, operatorFields);
  });
};
