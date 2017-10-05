module.exports = function ConnectionArgFilterPlugin(
  builder,
  {
    connectionFilterAllowedFieldTypes = [
      "String",
      "Int",
      "Float",
      "Boolean",
      "Datetime",
      "Date",
      "Time",
      "JSON",
    ],
  } = {}
) {
  builder.hook("build", build => {
    const connectionFilterOperators = {};
    return build.extend(build, {
      connectionFilterOperators,
      addConnectionFilterOperator(
        name,
        description,
        resolveType,
        resolveWhereClause,
        options = {}
      ) {
        if (!name) {
          throw new Error("No filter operator name specified");
        }
        if (connectionFilterOperators[name]) {
          throw new Error("There is already a filter operator with the name '" + name + "'");
        }
        if (!resolveType) {
          throw new Error("No filter operator type specified for '" + name + "'");
        }
        if (!resolveWhereClause) {
          throw new Error("No filter operator where clause resolver specified for '" + name + "'");
        }
        connectionFilterOperators[name] = {
          name,
          description,
          resolveType,
          resolveWhereClause,
          options,
        };
      },
      connectionFilterAllowedFieldTypes,
    });
  });

  builder.hook("build", build => {
    return build.extend(build, {
      escapeLikeWildcards(val) {
        if ("string" !== typeof val) {
          throw new Error("escapeLikeWildcards called on non-string value");
        } else {
          return val.split("%").join("\\%").split("_").join("\\_");
        }
      },
    });
  });
};
