module.exports = function ConnectionArgFilterPlugin(
  builder,
  {
    connectionFilterAllowedFieldTypes,
    connectionFilterAllowedOperators,
    connectionFilterOperatorNames = {},
    connectionFilterComputedColumns = true,
  } = {}
) {
  builder.hook("build", build => {
    const connectionFilterOperators = {};
    return build.extend(build, {
      connectionFilterOperators,
      addConnectionFilterOperator(
        defaultName,
        description,
        resolveType,
        resolveWhereClause,
        options = {}
      ) {
        if (!defaultName) {
          throw new Error("No filter operator defaultName specified");
        }
        const name = connectionFilterOperatorNames[defaultName] || defaultName;
        if (connectionFilterOperators[name]) {
          throw new Error(
            "There is already a filter operator with the name '" + name + "'"
          );
        }
        if (!resolveType) {
          throw new Error(
            "No filter operator type specified for '" + name + "'"
          );
        }
        if (!resolveWhereClause) {
          throw new Error(
            "No filter operator where clause resolver specified for '" +
              name +
              "'"
          );
        }
        if (
          !connectionFilterAllowedOperators ||
          connectionFilterAllowedOperators.includes(defaultName)
        ) {
          connectionFilterOperators[name] = {
            name,
            description,
            resolveType,
            resolveWhereClause,
            options,
          };
        }
      },
      connectionFilterAllowedFieldTypes,
      connectionFilterComputedColumns,
    });
  });

  builder.hook("build", build => {
    return build.extend(build, {
      escapeLikeWildcards(val) {
        if ("string" !== typeof val) {
          throw new Error("escapeLikeWildcards called on non-string value");
        } else {
          return val
            .split("%")
            .join("\\%")
            .split("_")
            .join("\\_");
        }
      },
    });
  });
};
