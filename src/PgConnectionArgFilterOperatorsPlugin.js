module.exports = function PgConnectionArgFilterOperatorsPlugin(builder) {
  builder.hook("init", (_, build) => {
    const {
      addConnectionFilterOperator,
      escapeLikeWildcards,
      pgSql: sql,
      graphql: { getNamedType, GraphQLBoolean, GraphQLList, GraphQLNonNull },
    } = build;
    addConnectionFilterOperator(
      "isNull",
      "If set to true, checks for null values.  If set to false, checks for non-null values.",
      () => GraphQLBoolean,
      (identifier, value) =>
        sql.query`${identifier} ${
          value ? sql.query`IS NULL` : sql.query`IS NOT NULL`
        }`,
      {
        resolveWithRawInput: true,
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "equalTo",
      "Checks for values equal to this value.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} = ${value}`,
      {
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "notEqualTo",
      "Checks for values not equal to this value.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} <> ${value}`,
      {
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "distinctFrom",
      "Checks for values not equal to this value, treating null like an ordinary value.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} IS DISTINCT FROM ${value}`,
      {
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "notDistinctFrom",
      "Checks for values equal to this value, treating null like an ordinary value.",
      fieldType => fieldType,
      (identifier, value) =>
        sql.query`${identifier} IS NOT DISTINCT FROM ${value}`,
      {
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "lessThan",
      "Checks for values less than this value.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} < ${value}`,
      {
        allowedFieldTypes: [
          "String",
          "Int",
          "Float",
          "Datetime",
          "Date",
          "Time",
          "BigInt",
          "BigFloat",
        ],
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "lessThanOrEqualTo",
      "Checks for values less than or equal to this value.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} <= ${value}`,
      {
        allowedFieldTypes: [
          "String",
          "Int",
          "Float",
          "Datetime",
          "Date",
          "Time",
          "BigInt",
          "BigFloat",
        ],
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "greaterThan",
      "Checks for values greater than this value.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} > ${value}`,
      {
        allowedFieldTypes: [
          "String",
          "Int",
          "Float",
          "Datetime",
          "Date",
          "Time",
          "BigInt",
          "BigFloat",
        ],
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "greaterThanOrEqualTo",
      "Checks for values greater than or equal to this value.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} >= ${value}`,
      {
        allowedFieldTypes: [
          "String",
          "Int",
          "Float",
          "Datetime",
          "Date",
          "Time",
          "BigInt",
          "BigFloat",
        ],
        allowedListTypes: ["NonList", "List"],
      }
    );
    addConnectionFilterOperator(
      "in",
      "Checks for values in this list.",
      fieldType => new GraphQLList(new GraphQLNonNull(fieldType)),
      (identifier, value) => sql.query`${identifier} IN ${value}`
    );
    addConnectionFilterOperator(
      "notIn",
      "Checks for values not in this list.",
      fieldType => new GraphQLList(new GraphQLNonNull(fieldType)),
      (identifier, value) => sql.query`${identifier} NOT IN ${value}`
    );
    addConnectionFilterOperator(
      "includes",
      "Checks for strings that include this value.  Case sensitive.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "notIncludes",
      "Checks for strings that do not include this value.  Case sensitive.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "includesInsensitive",
      "Checks for strings that include this value.  Case insensitive.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "notIncludesInsensitive",
      "Checks for strings that do not not include this value.  Case insensitive.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "startsWith",
      "Checks for strings starting with this value.  Case sensitive.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "notStartsWith",
      "Checks for strings that do not start with this value.  Case sensitive.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "startsWithInsensitive",
      "Checks for strings starting with this value.  Case insensitive.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "notStartsWithInsensitive",
      "Checks for strings that do not start with this value.  Case insensitive.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `${escapeLikeWildcards(input)}%`,
      }
    );
    addConnectionFilterOperator(
      "endsWith",
      "Checks for strings ending with this value.  Case sensitive.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}`,
      }
    );
    addConnectionFilterOperator(
      "notEndsWith",
      "Checks for strings that do not end with this value.  Case sensitive.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}`,
      }
    );
    addConnectionFilterOperator(
      "endsWithInsensitive",
      "Checks for strings ending with this value.  Case insensitive.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}`,
      }
    );
    addConnectionFilterOperator(
      "notEndsWithInsensitive",
      "Checks for strings that do not end with this value.  Case insensitive.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
        inputResolver: input => `%${escapeLikeWildcards(input)}`,
      }
    );
    addConnectionFilterOperator(
      "like",
      "Raw SQL 'like', wildcards must be present and are not escaped",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
      }
    );
    addConnectionFilterOperator(
      "notLike",
      "Raw SQL 'not like', wildcards must be present and are not escaped",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT LIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
      }
    );
    addConnectionFilterOperator(
      "likeInsensitive",
      "Raw SQL 'ilike', wildcards must be present and are not escaped",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
      }
    );
    addConnectionFilterOperator(
      "notLikeInsensitive",
      "Raw SQL 'not ilike', wildcards must be present and are not escaped",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT ILIKE ${value}`,
      {
        allowedFieldTypes: ["String"],
      }
    );
    addConnectionFilterOperator(
      "similarTo",
      "Raw SQL 'similar to', wildcards are not escaped",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} SIMILAR TO ${value}`,
      {
        allowedFieldTypes: ["String"],
      }
    );
    addConnectionFilterOperator(
      "notSimilarTo",
      "Raw SQL 'not similar to', wildcards are not escaped",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} NOT SIMILAR TO ${value}`,
      {
        allowedFieldTypes: ["String"],
      }
    );
    addConnectionFilterOperator(
      "contains",
      "Checks for JSON containing this JSON.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} @> ${value}`,
      {
        allowedFieldTypes: ["JSON"],
      }
    );
    addConnectionFilterOperator(
      "containedBy",
      "Checks for JSON contained by this JSON.",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} <@ ${value}`,
      {
        allowedFieldTypes: ["JSON"],
      }
    );
    addConnectionFilterOperator(
      "anyEqualTo",
      "Checks for any values equal to this value.",
      fieldType => getNamedType(fieldType),
      (identifier, value) => sql.query`${value} = ANY(${identifier})`,
      {
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "anyNotEqualTo",
      "Checks for any values not equal to this value.",
      fieldType => getNamedType(fieldType),
      (identifier, value) => sql.query`${value} <> ANY(${identifier})`,
      {
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "anyLessThan",
      "Checks for any values less than this value.",
      fieldType => getNamedType(fieldType),
      (identifier, value) => sql.query`${value} > ANY(${identifier})`,
      {
        allowedFieldTypes: [
          "String",
          "Int",
          "Float",
          "Datetime",
          "Date",
          "Time",
          "BigInt",
          "BigFloat",
        ],
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "anyLessThanOrEqualTo",
      "Checks for any values less than or equal to this value.",
      fieldType => getNamedType(fieldType),
      (identifier, value) => sql.query`${value} >= ANY(${identifier})`,
      {
        allowedFieldTypes: [
          "String",
          "Int",
          "Float",
          "Datetime",
          "Date",
          "Time",
          "BigInt",
          "BigFloat",
        ],
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "anyGreaterThan",
      "Checks for any values greater than this value.",
      fieldType => getNamedType(fieldType),
      (identifier, value) => sql.query`${value} < ANY(${identifier})`,
      {
        allowedFieldTypes: [
          "String",
          "Int",
          "Float",
          "Datetime",
          "Date",
          "Time",
          "BigInt",
          "BigFloat",
        ],
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "anyGreaterThanOrEqualTo",
      "Checks for any values greater than or equal to this value.",
      fieldType => getNamedType(fieldType),
      (identifier, value) => sql.query`${value} <= ANY(${identifier})`,
      {
        allowedFieldTypes: [
          "String",
          "Int",
          "Float",
          "Datetime",
          "Date",
          "Time",
          "BigInt",
          "BigFloat",
        ],
        allowedListTypes: ["List"],
      }
    );
    addConnectionFilterOperator(
      "inetContainedBy",
      "Checks if an inet is contained by another inet",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} << ${value}`,
      {
        allowedFieldTypes: ["InternetAddress"],
      }
    );
    addConnectionFilterOperator(
      "inetContainedByOrEquals",
      "Checks if an inet is contained by or equals another inet",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} <<= ${value}`,
      {
        allowedFieldTypes: ["InternetAddress"],
      }
    );
    addConnectionFilterOperator(
      "inetContains",
      "Checks if an inet contains another inet",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} >> ${value}`,
      {
        allowedFieldTypes: ["InternetAddress"],
      }
    );
    addConnectionFilterOperator(
      "inetContainsOrEquals",
      "Checks if an inet contains or equals another inet",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} >>= ${value}`,
      {
        allowedFieldTypes: ["InternetAddress"],
      }
    );
    addConnectionFilterOperator(
      "inetContainsOrIsContainedBy",
      "Checks if an inet contains or is contained by another inet",
      fieldType => fieldType,
      (identifier, value) => sql.query`${identifier} && ${value}`,
      {
        allowedFieldTypes: ["InternetAddress"],
      }
    );
    return _;
  });
};
