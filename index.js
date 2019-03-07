const connectionArgFilterPlugin = require("./src/ConnectionArgFilterPlugin.js");
const pgConnectionArgFilterPlugin = require("./src/PgConnectionArgFilterPlugin.js");
const pgConnectionArgFilterColumnsPlugin = require("./src/PgConnectionArgFilterColumnsPlugin.js");
const pgConnectionArgFilterComputedColumnsPlugin = require("./src/PgConnectionArgFilterComputedColumnsPlugin.js");
const pgConnectionArgFilterRecordFunctionsPlugin = require("./src/PgConnectionArgFilterRecordFunctionsPlugin.js");
const pgConnectionArgFilterBackwardRelationsPlugin = require("./src/PgConnectionArgFilterBackwardRelationsPlugin.js");
const pgConnectionArgFilterForwardRelationsPlugin = require("./src/PgConnectionArgFilterForwardRelationsPlugin.js");
const pgConnectionArgFilterLogicalOperatorsPlugin = require("./src/PgConnectionArgFilterLogicalOperatorsPlugin.js");
const pgConnectionArgFilterOperatorsPlugin = require("./src/PgConnectionArgFilterOperatorsPlugin.js");

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
    connectionFilterRelations,
    connectionFilterLogicalOperators,
  } = options;

  connectionArgFilterPlugin(builder, options);
  pgConnectionArgFilterPlugin(builder, options);
  pgConnectionArgFilterColumnsPlugin(builder, options);
  pgConnectionArgFilterComputedColumnsPlugin(builder, options);
  pgConnectionArgFilterRecordFunctionsPlugin(builder, options);

  if (connectionFilterRelations) {
    pgConnectionArgFilterBackwardRelationsPlugin(builder, options);
    pgConnectionArgFilterForwardRelationsPlugin(builder, options);
  }

  if (connectionFilterLogicalOperators) {
    pgConnectionArgFilterLogicalOperatorsPlugin(builder, options);
  }

  pgConnectionArgFilterOperatorsPlugin(builder, options);
};
