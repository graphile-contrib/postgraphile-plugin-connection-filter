module.exports = function PgConnectionArgFilterOperatorsPlugin(builder) {
  builder.hook("init", (_, build) => {
    const {
      addConnectionFilterOperator,
      escapeLikeWildcards,
      pgSql: sql,
      gql2pg,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      graphql: { getNamedType, GraphQLBoolean, GraphQLList, GraphQLNonNull },
    } = build;

    const simpleTypeNames = [
      "BigFloat",
      "BigInt",
      //"BitString",
      //"Boolean",
      "Date",
      "Datetime",
      "Float",
      "Int",
      //"InternetAddress",
      //"Interval",
      //"JSON",
      "String",
      "Time",
      //"UUID",
    ];
    const rangeTypeNames = [
      "BigFloatRange",
      "BigIntRange",
      "DateRange",
      "DatetimeRange",
      "IntRange",
    ];

    addConnectionFilterOperator(
      "isNull",
      "Is null (if `true` is specified) or is not null (if `false` is specified).",
      () => GraphQLBoolean,
      (identifier, _value, input) =>
        sql.query`${identifier} ${
          input ? sql.query`IS NULL` : sql.query`IS NOT NULL`
        }`,
      {
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "equalTo",
      "Equal to the specified value.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} = ${value}`,
      {
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "notEqualTo",
      "Not equal to the specified value.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} <> ${value}`,
      {
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "distinctFrom",
      "Not equal to the specified value, treating null like an ordinary value.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} IS DISTINCT FROM ${value}`,
      {
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "notDistinctFrom",
      "Equal to the specified value, treating null like an ordinary value.",
      fieldType => fieldType,
      (identifier, value) =>
        sql.query`${identifier} IS NOT DISTINCT FROM ${value}`,
      {
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "lessThan",
      "Less than the specified value.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} < ${value}`,
      {
        allowedFieldTypes: simpleTypeNames,
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "lessThanOrEqualTo",
      "Less than or equal to the specified value.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} <= ${value}`,
      {
        allowedFieldTypes: simpleTypeNames,
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "greaterThan",
      "Greater than the specified value.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} > ${value}`,
      {
        allowedFieldTypes: simpleTypeNames,
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "greaterThanOrEqualTo",
      "Greater than or equal to the specified value.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} >= ${value}`,
      {
        allowedFieldTypes: simpleTypeNames,
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "in",
      "Included in the specified list.",
      fieldType => new GraphQLList(new GraphQLNonNull(fieldType)),
      (identifier, value) => sql.query`${identifier} IN ${value}`
    );
    addConnectionFilterOperator(
      "notIn",
      "Not included in the specified list.",
      fieldType => new GraphQLList(new GraphQLNonNull(fieldType)),
      (identifier, value) => sql.query`${identifier} NOT IN ${value}`
    );
    addConnectionFilterOperator(
      "includes",
      "Contains the specified string (case-sensitive).",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "notIncludes",
      "Does not contain the specified string (case-sensitive).",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "includesInsensitive",
      "Contains the specified string (case-insensitive).",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "notIncludesInsensitive",
      "Does not contain the specified string (case-insensitive).",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "startsWith",
      "Starts with the specified string (case-sensitive).",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "notStartsWith",
      "Does not start with the specified string (case-sensitive).",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "startsWithInsensitive",
      "Starts with the specified string (case-insensitive).",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "notStartsWithInsensitive",
      "Does not start with the specified string (case-insensitive).",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "endsWith",
      "Ends with the specified string (case-sensitive).",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}`,
      }
    );
    addConnectionFilterOperator(
      "notEndsWith",
      "Does not end with the specified string (case-sensitive).",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}`,
      }
    );
    addConnectionFilterOperator(
      "endsWithInsensitive",
      "Ends with the specified string (case-insensitive).",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}`,
      }
    );
    addConnectionFilterOperator(
      "notEndsWithInsensitive",
      "Does not end with the specified string (case-insensitive).",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}`,
      }
    );
    addConnectionFilterOperator(
      "like",
      "Matches the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
      }
    );
    addConnectionFilterOperator(
      "notLike",
      "Does not match the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
      }
    );
    addConnectionFilterOperator(
      "likeInsensitive",
      "Matches the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
      }
    );
    addConnectionFilterOperator(
      "notLikeInsensitive",
      "Does not match the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
      }
    );
    addConnectionFilterOperator(
      "similarTo",
      "Matches the specified pattern using the SQL standard's definition of a regular expression.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} SIMILAR TO ${value}`,
      {
        allowedFieldTypes: ["String"],
      }
    );
    addConnectionFilterOperator(
      "notSimilarTo",
      "Does not match the specified pattern using the SQL standard's definition of a regular expression.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT SIMILAR TO ${value}`,
      {
        allowedFieldTypes: ["String"],
      }
    );
    addConnectionFilterOperator(
      "contains",
      "Contains the specified JSON.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} @> ${value}`,
      {
        allowedFieldTypes: ["JSON"],
      }
    );
    addConnectionFilterOperator(
      "containedBy",
      "Contained by the specified JSON.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} <@ ${value}`,
      {
        allowedFieldTypes: ["JSON"],
      }
    );
    addConnectionFilterOperator(
      "contains",
      "Contains the specified list of values.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} @> ${value}`,
      {
        allowedFieldTypes: simpleTypeNames,
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "containedBy",
      "Contained by the specified list of values.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} <@ ${value}`,
      {
        allowedFieldTypes: simpleTypeNames,
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "overlaps",
      "Overlaps the specified list of values.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} && ${value}`,
      {
        allowedFieldTypes: simpleTypeNames,
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "anyEqualTo",
      "Any array item is equal to the specified value.",
      fieldType => getNamedType(fieldType),
      (identifier, value) => sql.query`${value} = ANY(${identifier})`,
      {
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "anyNotEqualTo",
      "Any array item is not equal to the specified value.",
      fieldType => getNamedType(fieldType),
      (identifier, value) => sql.query`${value} <> ANY(${identifier})`,
      {
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "anyLessThan",
      "Any array item is less than the specified value.",
      fieldType => getNamedType(fieldType),
      (identifier, value) => sql.query`${value} > ANY(${identifier})`,
      {
        allowedFieldTypes: simpleTypeNames,
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "anyLessThanOrEqualTo",
      "Any array item is less than or equal to the specified value.",
      fieldType => getNamedType(fieldType),
      (identifier, value) => sql.query`${value} >= ANY(${identifier})`,
      {
        allowedFieldTypes: simpleTypeNames,
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "anyGreaterThan",
      "Any array item is greater than the specified value.",
      fieldType => getNamedType(fieldType),
      (identifier, value) => sql.query`${value} < ANY(${identifier})`,
      {
        allowedFieldTypes: simpleTypeNames,
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "anyGreaterThanOrEqualTo",
      "Any array item is greater than or equal to the specified value.",
      fieldType => getNamedType(fieldType),
      (identifier, value) => sql.query`${value} <= ANY(${identifier})`,
      {
        allowedFieldTypes: simpleTypeNames,
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "containedBy",
      "Contained by the specified internet address.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} << ${value}`,
      {
        allowedFieldTypes: ["InternetAddress"],
      }
    );
    addConnectionFilterOperator(
      "containedByOrEqualTo",
      "Contained by or equal to the specified internet address.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} <<= ${value}`,
      {
        allowedFieldTypes: ["InternetAddress"],
      }
    );
    addConnectionFilterOperator(
      "contains",
      "Contains the specified internet address.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} >> ${value}`,
      {
        allowedFieldTypes: ["InternetAddress"],
      }
    );
    addConnectionFilterOperator(
      "containsOrEqualTo",
      "Contains or equal to the specified internet address.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} >>= ${value}`,
      {
        allowedFieldTypes: ["InternetAddress"],
      }
    );
    addConnectionFilterOperator(
      "containsOrContainedBy",
      "Contains or contained by the specified internet address.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} && ${value}`,
      {
        allowedFieldTypes: ["InternetAddress"],
      }
    );
    addConnectionFilterOperator(
      "containsElement",
      "Contains the specified value.",
      (_fieldInputType, fieldBaseInputType) => fieldBaseInputType,
      (identifier, value) => sql.query`${identifier} @> ${value}`,
      {
        sqlValueResolver: (input, pgType, pgTypeModifier) => {
          const rangeSubType =
            introspectionResultsByKind.typeById[pgType.rangeSubTypeId];
          return sql.query`${gql2pg(
            input,
            pgType.rangeSubTypeId,
            pgTypeModifier
          )}::${sql.identifier(rangeSubType.namespaceName, rangeSubType.name)}`;
        },
        allowedFieldTypes: rangeTypeNames,
        allowedListTypes: ["NonList"],
      }
    );
    addConnectionFilterOperator(
      "contains",
      "Contains the specified range.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} @> ${value}`,
      {
        allowedFieldTypes: rangeTypeNames,
        allowedListTypes: ["NonList"],
      }
    );
    addConnectionFilterOperator(
      "containedBy",
      "Contained by the specified range.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} <@ ${value}`,
      {
        allowedFieldTypes: rangeTypeNames,
        allowedListTypes: ["NonList"],
      }
    );
    addConnectionFilterOperator(
      "overlaps",
      "Overlaps the specified range.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} && ${value}`,
      {
        allowedFieldTypes: rangeTypeNames,
        allowedListTypes: ["NonList"],
      }
    );
    addConnectionFilterOperator(
      "strictlyLeftOf",
      "Strictly left of the specified range.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} << ${value}`,
      {
        allowedFieldTypes: rangeTypeNames,
        allowedListTypes: ["NonList"],
      }
    );
    addConnectionFilterOperator(
      "strictlyRightOf",
      "Strictly right of the specified range.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} >> ${value}`,
      {
        allowedFieldTypes: rangeTypeNames,
        allowedListTypes: ["NonList"],
      }
    );
    addConnectionFilterOperator(
      "notExtendsRightOf",
      "Does not extend right of the specified range.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} &< ${value}`,
      {
        allowedFieldTypes: rangeTypeNames,
        allowedListTypes: ["NonList"],
      }
    );
    addConnectionFilterOperator(
      "notExtendsLeftOf",
      "Does not extend left of the specified range.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} &> ${value}`,
      {
        allowedFieldTypes: rangeTypeNames,
        allowedListTypes: ["NonList"],
      }
    );
    addConnectionFilterOperator(
      "adjacentTo",
      "Adjacent to the specified range.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} -|- ${value}`,
      {
        allowedFieldTypes: rangeTypeNames,
        allowedListTypes: ["NonList"],
      }
    );
    return _;
  });
};
