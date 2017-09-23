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
        addFilterOperator,
        pgSql: sql,
        graphql: { GraphQLBoolean, GraphQLList, GraphQLNonNull },
      }
    ) => {
      addFilterOperator(
        "null",
        "If set to true, checks for null values.  If set to false, checks for non-null values.",
        null,
        () => GraphQLBoolean,
        (identifier, val) =>
          sql.query`${identifier} ${val
            ? sql.query`IS NULL`
            : sql.query`IS NOT NULL`}`
      );
      addFilterOperator(
        connectionFilterUsesShortNames ? "eq" : "equalTo",
        "Checks for values equal to this value.",
        null,
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} = ${val}`;
        }
      );
      addFilterOperator(
        connectionFilterUsesShortNames ? "ne" : "notEqualTo",
        "Checks for values not equal to this value.",
        null,
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} <> ${val}`;
        }
      );
      addFilterOperator(
        "distinctFrom",
        "Checks for values not equal to this value, treating null like an ordinary value.",
        null,
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} IS DISTINCT FROM ${val}`;
        }
      );
      addFilterOperator(
        "notDistinctFrom",
        "Checks for values equal to this value, treating null like an ordinary value.",
        null,
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} IS NOT DISTINCT FROM ${val}`;
        }
      );
      addFilterOperator(
        connectionFilterUsesShortNames ? "lt" : "lessThan",
        "Checks for values less than this value.",
        ["String", "Int", "Float", "Datetime", "Date", "Time"],
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} < ${val}`;
        }
      );
      addFilterOperator(
        connectionFilterUsesShortNames ? "lte" : "lessThanOrEqualTo",
        "Checks for values less than or equal to this value.",
        ["String", "Int", "Float", "Datetime", "Date", "Time"],
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} <= ${val}`;
        }
      );
      addFilterOperator(
        connectionFilterUsesShortNames ? "gt" : "greaterThan",
        "Checks for values greater than this value.",
        ["String", "Int", "Float", "Datetime", "Date", "Time"],
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} > ${val}`;
        }
      );
      addFilterOperator(
        connectionFilterUsesShortNames ? "gte" : "greaterThanOrEqualTo",
        "Checks for values greater than or equal to this value.",
        ["String", "Int", "Float", "Datetime", "Date", "Time"],
        typeName => getTypeByName(typeName),
        (identifier, val) => {
          return sql.query`${identifier} >= ${val}`;
        }
      );
      addFilterOperator(
        connectionFilterUsesShortNames ? "in" : "in",
        "Checks for values in this list.",
        ["String", "Int", "Float", "Datetime", "Date", "Time"],
        typeName =>
          new GraphQLList(new GraphQLNonNull(getTypeByName(typeName))),
        (identifier, val) => {
          return sql.query`${identifier} IN ${val}`;
        }
      );
      addFilterOperator(
        connectionFilterUsesShortNames ? "nin" : "notIn",
        "Checks for values not in this list.",
        ["String", "Int", "Float", "Datetime", "Date", "Time"],
        typeName =>
          new GraphQLList(new GraphQLNonNull(getTypeByName(typeName))),
        (identifier, val) => {
          return sql.query`${identifier} NOT IN ${val}`;
        }
      );
      return _;
    }
  );
};
