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
        pgSql: sql,
        graphql: { GraphQLBoolean, GraphQLList, GraphQLNonNull },
      }
    ) => {
      addConnectionFilterOperator(
        "null",
        "If set to true, checks for null values.  If set to false, checks for non-null values.",
        () => GraphQLBoolean,
        (identifier, val) =>
          sql.query`${identifier} ${val
            ? sql.query`IS NULL`
            : sql.query`IS NOT NULL`}`
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
        },
        {
          allowedFieldTypes: [
            "String",
            "Int",
            "Float",
            "Datetime",
            "Date",
            "Time",
          ],
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "nin" : "notIn",
        "Checks for values not in this list.",
        typeName =>
          new GraphQLList(new GraphQLNonNull(getTypeByName(typeName))),
        (identifier, val) => {
          return sql.query`${identifier} NOT IN ${val}`;
        },
        {
          allowedFieldTypes: [
            "String",
            "Int",
            "Float",
            "Datetime",
            "Date",
            "Time",
          ],
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "cont" : "contains",
        "Checks for strings containing this string.  Case sensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} like ${val}`;
        },
        {
          allowedFieldTypes: [
            "String",
          ],
          inputResolver: input => `%${input}%`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "conti" : "containsInsensitive",
        "Checks for strings containing this value.  Case insensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} ilike ${val}`;
        },
        {
          allowedFieldTypes: [
            "String",
          ],
          inputResolver: input => `%${input}%`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "starts" : "startsWith",
        "Checks for strings starting with this string.  Case sensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} like ${val}`;
        },
        {
          allowedFieldTypes: [
            "String",
          ],
          inputResolver: input => `${input}%`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "startsi" : "startsWithInsensitive",
        "Checks for strings starting with this string.  Case sensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} ilike ${val}`;
        },
        {
          allowedFieldTypes: [
            "String",
          ],
          inputResolver: input => `${input}%`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "ends" : "endsWith",
        "Checks for strings ending with this string.  Case sensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} like ${val}`;
        },
        {
          allowedFieldTypes: [
            "String",
          ],
          inputResolver: input => `${input}%`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "endsi" : "endsWithInsensitive",
        "Checks for strings ending with this string.  Case insensitive.",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} ilike ${val}`;
        },
        {
          allowedFieldTypes: [
            "String",
          ],
          inputResolver: input => `%${input}`,
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "like" : "like",
        "Raw SQL 'like', wildcards must be present and are not escaped",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} like ${val}`;
        },
        {
          allowedFieldTypes: [
            "String",
          ],
        }
      );
      addConnectionFilterOperator(
        connectionFilterUsesShortNames ? "ilike" : "ilike",
        "Raw SQL 'ilike', wildcards must be present and are not escaped",
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} ilike ${val}`;
        },
        {
          allowedFieldTypes: [
            "String",
          ],
        }
      );
      return _;
    }
  );
};
