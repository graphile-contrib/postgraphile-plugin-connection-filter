module.exports = function PostGraphileConnectionFilterPlugin(
  builder,
  configOptions
) {
  const defaultOptions = {
    //connectionFilterAllowedOperators,
    //connectionFilterAllowedFieldTypes,
    connectionFilterComputedColumns: true,
    connectionFilterLists: true,
    //connectionFilterOperatorNames,
    connectionFilterRelations: false,
    connectionFilterSetofFunctions: true,
    connectionFilterLogicalOperators: true,
    connectionFilterAllowNullInput: false,
    connectionFilterAllowEmptyObjectInput: false,
  };
  const options = {
    ...defaultOptions,
    ...configOptions,
  };
  const {
    connectionFilterComputedColumns,
    connectionFilterSetofFunctions,
    connectionFilterRelations,
    connectionFilterLogicalOperators,
  } = options;

  require("./src/ConnectionArgFilterPlugin.js")(builder, options);
  require("./src/PgConnectionArgFilterPlugin.js")(builder, options);
  require("./src/PgConnectionArgFilterColumnsPlugin.js")(builder, options);

  if (connectionFilterComputedColumns) {
    require("./src/PgConnectionArgFilterComputedColumnsPlugin.js")(
      builder,
      options
    );
  }

  if (connectionFilterSetofFunctions) {
    require("./src/PgConnectionArgFilterRecordFunctionsPlugin.js")(
      builder,
      options
    );
  }

  if (connectionFilterRelations) {
    require("./src/PgConnectionArgFilterBackwardRelationsPlugin.js")(
      builder,
      options
    );
    require("./src/PgConnectionArgFilterForwardRelationsPlugin.js")(
      builder,
      options
    );
  }

  if (connectionFilterLogicalOperators) {
    require("./src/PgConnectionArgFilterLogicalOperatorsPlugin.js")(
      builder,
      options
    );
  }

  require("./src/PgConnectionArgFilterOperatorsPlugin.js")(builder, options);
};
