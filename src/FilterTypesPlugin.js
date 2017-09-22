module.exports = function FilterTypesPlugin(builder) {
  builder.hook("build", build => {
    const filterOperators = {};
    const filterableTypeNames = [
      "String",
      "Int",
      "Float",
      "Boolean",
      "Datetime",
      "Date",
      "Time",
      "JSON",
    ];
    return build.extend(build, {
      filterOperators,
      addFilterOperator(
        name,
        description,
        allowedFieldTypes,
        resolveType,
        resolveWhereClause
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
          allowedFieldTypes,
          resolveType,
          resolveWhereClause,
        };
      },
      filterableTypeNames,
    });
  });
};
