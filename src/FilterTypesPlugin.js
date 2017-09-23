module.exports = function FilterTypesPlugin(
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
    const filterOperators = {};
    return build.extend(build, {
      filterOperators,
      addFilterOperator(
        name,
        description,
        resolveType,
        resolveWhereClause,
        options
      ) {
        if (!name) {
          throw new Error("No filter operator name specified");
        }
        if (filterOperators[name]) {
          throw new Error("There is already a filter operator with this name");
        }
        if (!resolveType) {
          throw new Error("No filter operator type specified");
        }
        if (!resolveWhereClause) {
          throw new Error("No filter operator where clause resolver specified");
        }
        filterOperators[name] = {
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
};
