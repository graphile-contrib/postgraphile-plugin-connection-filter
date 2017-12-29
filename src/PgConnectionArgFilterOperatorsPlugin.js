module.exports = function PgConnectionArgFilterOperatorsPlugin(
  builder,
  { connectionFilterUsesShortNames = false } = {}
) {
  builder.hook(
    "init",
    (
      _,
      {
        getTypeByName,
        addConnectionFilterOperator,
        escapeLikeWildcards,
        pgSql: sql,
        graphql: { GraphQLBoolean, GraphQLList, GraphQLNonNull },
      }
    ) => {
      addConnectionFilterOperator(
        "null",
        "If set to true, checks for null values.  If set to false, checks for non-null values.",
        () => GraphQLBoolean,
        (identifier, val, input) =>
          sql.query`${identifier} ${
            input ? sql.query`IS NULL` : sql.query`IS NOT NULL`
          }`
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "eq" : "equalTo",
        "Checks for values equal to this value.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} = ${val}`;
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "ne" : "notEqualTo",
        "Checks for values not equal to this value.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} <> ${val}`;
        }
      );
      addConnectionFilterOperator(
        "distinctFrom",
        "Checks for values not equal to this value, treating null like an ordinary value.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} IS DISTINCT FROM ${val}`;
        }
      );
      addConnectionFilterOperator(
        "notDistinctFrom",
        "Checks for values equal to this value, treating null like an ordinary value.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} IS NOT DISTINCT FROM ${val}`;
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "lt" : "lessThan",
        "Checks for values less than this value.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} < ${val}`;
        },
        {
          allowedFieldTypes: [
            "String",
            "Int",
            "Float",
            "Datetime",
            "Date",
            "Time",
            "BigFloat",
          ],
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "lte" : "lessThanOrEqualTo",
        "Checks for values less than or equal to this value.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} <= ${val}`;
        },
        {
          allowedFieldTypes: [
            "String",
            "Int",
            "Float",
            "Datetime",
            "Date",
            "Time",
            "BigFloat",
          ],
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "gt" : "greaterThan",
        "Checks for values greater than this value.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} > ${val}`;
        },
        {
          allowedFieldTypes: [
            "String",
            "Int",
            "Float",
            "Datetime",
            "Date",
            "Time",
            "BigFloat",
          ],
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "gte" : "greaterThanOrEqualTo",
        "Checks for values greater than or equal to this value.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} >= ${val}`;
        },
        {
          allowedFieldTypes: [
            "String",
            "Int",
            "Float",
            "Datetime",
            "Date",
            "Time",
            "BigFloat",
          ],
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "in" : "in",
        "Checks for values in this list.",
        typeName =>
          new GraphQLList(new GraphQLNonNull(getTypeByName(typeName))),
        (identifier, val) => {
          return sql.query`${identifier} IN ${val}`;
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "nin" : "notIn",
        "Checks for values not in this list.",
        typeName =>
          new GraphQLList(new GraphQLNonNull(getTypeByName(typeName))),
        (identifier, val) => {
          return sql.query`${identifier} NOT IN ${val}`;
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "cont" : "contains",
        "Checks for strings containing this value.  Case sensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "ncont" : "notContains",
        "Checks for strings that do not contain this value.  Case sensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} NOT LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "conti" : "containsInsensitive",
        "Checks for strings containing this value.  Case insensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "nconti" : "notContainsInsensitive",
        "Checks for strings that do not not contain this value.  Case insensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} NOT ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "starts" : "startsWith",
        "Checks for strings starting with this value.  Case sensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "nstarts" : "notStartsWith",
        "Checks for strings that do not start with this value.  Case sensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} NOT LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "startsi" : "startsWithInsensitive",
        "Checks for strings starting with this value.  Case insensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames
          ? "nstartsi"
          : "notStartsWithInsensitive",
        "Checks for strings that do not start with this value.  Case insensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} NOT ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "ends" : "endsWith",
        "Checks for strings ending with this value.  Case sensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "nends" : "notEndsWith",
        "Checks for strings that do not end with this value.  Case sensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} NOT LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "endsi" : "endsWithInsensitive",
        "Checks for strings ending with this value.  Case insensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "nendsi" : "notEndsWithInsensitive",
        "Checks for strings that do not end with this value.  Case insensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} NOT ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "like" : "like",
        "Raw SQL 'like', wildcards must be present and are not escaped",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "nlike" : "notLike",
        "Raw SQL 'not like', wildcards must be present and are not escaped",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} NOT LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "ilike" : "likeInsensitive",
        "Raw SQL 'ilike', wildcards must be present and are not escaped",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "nilike" : "notLikeInsensitive",
        "Raw SQL 'not ilike', wildcards must be present and are not escaped",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} NOT ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
        }
      );
      return _;
    }
  );
};
