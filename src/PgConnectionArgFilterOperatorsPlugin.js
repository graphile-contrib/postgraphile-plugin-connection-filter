module.exports = function PgConnectionArgFilterOperatorsPlugin(builder) {
  builder.hook(
    "init",
    (
      _,
      {
        newWithHooks,
        getTypeByName,
        addConnectionFilterOperator,
        escapeLikeWildcards,
        pgSql: sql,
        graphql: {
          GraphQLBoolean,
          GraphQLList,
          GraphQLNonNull,
          GraphQLEnumType,
        },
      }
    ) => {
      addConnectionFilterOperator(
        "is",
        "Checks for null or non-null values.",
        () =>
          getTypeByName("NullOrNotNull") ||
          newWithHooks(
            GraphQLEnumType,
            {
              name: "NullOrNotNull",
              values: {
                NULL: { value: "NULL" },
                NOT_NULL: { value: "NOT NULL" },
              },
            },
            {}
          ),
        (identifier, val) => {
          console.warn("*** The `is` operator is deprecated and will be removed prior to v1.0.0 of this plugin. Please use the `isNull` operator instead. ***");
          return sql.query`${identifier} ${
            val === "NULL" ? sql.query`IS NULL` : sql.query`IS NOT NULL`
          }`;
        },
        {
          resolveWithRawInput: true,
          allowedListTypes: ["NonList", "List"],
        }
      );
      addConnectionFilterOperator(
        "null",
        "If set to true, checks for null values.  If set to false, checks for non-null values.",
        () => GraphQLBoolean,
        (identifier, val) => {
          console.warn("*** The `null` operator is deprecated and will be removed prior to v1.0.0 of this plugin. Please use the `isNull` operator instead. ***");
          return sql.query`${identifier} ${
            val ? sql.query`IS NULL` : sql.query`IS NOT NULL`
          }`;
        },
        {
          resolveWithRawInput: true,
          allowedListTypes: ["NonList", "List"],
        }
      );
      addConnectionFilterOperator(
        "isNull",
        "If set to true, checks for null values.  If set to false, checks for non-null values.",
        () => GraphQLBoolean,
        (identifier, val) =>
          sql.query`${identifier} ${
            val ? sql.query`IS NULL` : sql.query`IS NOT NULL`
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
        (identifier, val) => {
          return sql.query`${identifier} = ${val}`;
        },
        {
          allowedListTypes: ["NonList", "List"],
        }
      );
      addConnectionFilterOperator(
        "notEqualTo",
        "Checks for values not equal to this value.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} <> ${val}`;
        },
        {
          allowedListTypes: ["NonList", "List"],
        }
      );
      addConnectionFilterOperator(
        "distinctFrom",
        "Checks for values not equal to this value, treating null like an ordinary value.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} IS DISTINCT FROM ${val}`;
        },
        {
          allowedListTypes: ["NonList", "List"],
        }
      );
      addConnectionFilterOperator(
        "notDistinctFrom",
        "Checks for values equal to this value, treating null like an ordinary value.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} IS NOT DISTINCT FROM ${val}`;
        },
        {
          allowedListTypes: ["NonList", "List"],
        }
      );
      addConnectionFilterOperator(
        "lessThan",
        "Checks for values less than this value.",
        fieldType => fieldType,
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
        (identifier, val) => {
          return sql.query`${identifier} IN ${val}`;
        }
      );
      addConnectionFilterOperator(
        "notIn",
        "Checks for values not in this list.",
        fieldType => new GraphQLList(new GraphQLNonNull(fieldType)),
        (identifier, val) => {
          return sql.query`${identifier} NOT IN ${val}`;
        }
      );
      addConnectionFilterOperator(
        "includes",
        "Checks for strings that include this value.  Case sensitive.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        "notIncludes",
        "Checks for strings that do not include this value.  Case sensitive.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} NOT LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        "includesInsensitive",
        "Checks for strings that include this value.  Case insensitive.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        "notIncludesInsensitive",
        "Checks for strings that do not not include this value.  Case insensitive.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} NOT ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        "startsWith",
        "Checks for strings starting with this value.  Case sensitive.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        "notStartsWith",
        "Checks for strings that do not start with this value.  Case sensitive.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} NOT LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        "startsWithInsensitive",
        "Checks for strings starting with this value.  Case insensitive.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        "notStartsWithInsensitive",
        "Checks for strings that do not start with this value.  Case insensitive.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} NOT ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `${escapeLikeWildcards(input)}%`,
        }
      );
      addConnectionFilterOperator(
        "endsWith",
        "Checks for strings ending with this value.  Case sensitive.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}`,
        }
      );
      addConnectionFilterOperator(
        "notEndsWith",
        "Checks for strings that do not end with this value.  Case sensitive.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} NOT LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}`,
        }
      );
      addConnectionFilterOperator(
        "endsWithInsensitive",
        "Checks for strings ending with this value.  Case insensitive.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}`,
        }
      );
      addConnectionFilterOperator(
        "notEndsWithInsensitive",
        "Checks for strings that do not end with this value.  Case insensitive.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} NOT ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
          inputResolver: input => `%${escapeLikeWildcards(input)}`,
        }
      );
      addConnectionFilterOperator(
        "like",
        "Raw SQL 'like', wildcards must be present and are not escaped",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
        }
      );
      addConnectionFilterOperator(
        "notLike",
        "Raw SQL 'not like', wildcards must be present and are not escaped",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} NOT LIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
        }
      );
      addConnectionFilterOperator(
        "likeInsensitive",
        "Raw SQL 'ilike', wildcards must be present and are not escaped",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
        }
      );
      addConnectionFilterOperator(
        "notLikeInsensitive",
        "Raw SQL 'not ilike', wildcards must be present and are not escaped",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} NOT ILIKE ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
        }
      );
      addConnectionFilterOperator(
        "similarTo",
        "Raw SQL 'similar to', wildcards are not escaped",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} SIMILAR TO ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
        }
      );
      addConnectionFilterOperator(
        "notSimilarTo",
        "Raw SQL 'not similar to', wildcards are not escaped",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} NOT SIMILAR TO ${val}`;
        },
        {
          allowedFieldTypes: ["String"],
        }
      );
      addConnectionFilterOperator(
        "contains",
        "Checks for JSON containing this JSON.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} @> ${val}`;
        },
        {
          allowedFieldTypes: ["JSON"],
        }
      );
      addConnectionFilterOperator(
        "containedBy",
        "Checks for JSON contained by this JSON.",
        fieldType => fieldType,
        (identifier, val) => {
          return sql.query`${identifier} <@ ${val}`;
        },
        {
          allowedFieldTypes: ["JSON"],
        }
      );
      addConnectionFilterOperator(
        "anyEqualTo",
        "Checks for any values equal to this value.",
        fieldType => fieldType.ofType,
        (identifier, val) => {
          return sql.query`${val} = ANY(${identifier})`;
        },
        {
          allowedListTypes: ["List"],
        }
      );
      addConnectionFilterOperator(
        "anyNotEqualTo",
        "Checks for any values not equal to this value.",
        fieldType => fieldType.ofType,
        (identifier, val) => {
          return sql.query`${val} <> ANY(${identifier})`;
        },
        {
          allowedListTypes: ["List"],
        }
      );
      addConnectionFilterOperator(
        "anyLessThan",
        "Checks for any values less than this value.",
        fieldType => fieldType.ofType,
        (identifier, val) => {
          return sql.query`${val} > ANY(${identifier})`;
        },
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
        fieldType => fieldType.ofType,
        (identifier, val) => {
          return sql.query`${val} >= ANY(${identifier})`;
        },
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
        fieldType => fieldType.ofType,
        (identifier, val) => {
          return sql.query`${val} < ANY(${identifier})`;
        },
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
        fieldType => fieldType.ofType,
        (identifier, val) => {
          return sql.query`${val} <= ANY(${identifier})`;
        },
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
      return _;
    }
  );
};
