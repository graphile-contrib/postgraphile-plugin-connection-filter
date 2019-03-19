const ConnectionArgFilterPlugin = require("./src/ConnectionArgFilterPlugin.js");
const PgConnectionArgFilterPlugin = require("./src/PgConnectionArgFilterPlugin.js");
const PgConnectionArgFilterColumnsPlugin = require("./src/PgConnectionArgFilterColumnsPlugin.js");
const PgConnectionArgFilterComputedColumnsPlugin = require("./src/PgConnectionArgFilterComputedColumnsPlugin.js");
const PgConnectionArgFilterRecordFunctionsPlugin = require("./src/PgConnectionArgFilterRecordFunctionsPlugin.js");
const PgConnectionArgFilterBackwardRelationsPlugin = require("./src/PgConnectionArgFilterBackwardRelationsPlugin.js");
const PgConnectionArgFilterForwardRelationsPlugin = require("./src/PgConnectionArgFilterForwardRelationsPlugin.js");
const PgConnectionArgFilterLogicalOperatorsPlugin = require("./src/PgConnectionArgFilterLogicalOperatorsPlugin.js");
const PgConnectionArgFilterOperatorsPlugin = require("./src/PgConnectionArgFilterOperatorsPlugin.js");

module.exports = function PostGraphileConnectionFilterPlugin(
  builder,
  configOptions
) {
  builder.hook("build", build => {
    // Register plugin version on build
    const pkg = require("./package.json");
    if (!build.versions) {
      build.versions = {};
    }
    build.versions = build.extend(build.versions, { [pkg.name]: pkg.version });
    return build;
  });

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

  ConnectionArgFilterPlugin(builder, options);
  PgConnectionArgFilterPlugin(builder, options);
  PgConnectionArgFilterColumnsPlugin(builder, options);
  PgConnectionArgFilterComputedColumnsPlugin(builder, options);
  PgConnectionArgFilterRecordFunctionsPlugin(builder, options);

  if (connectionFilterRelations) {
    PgConnectionArgFilterBackwardRelationsPlugin(builder, options);
    PgConnectionArgFilterForwardRelationsPlugin(builder, options);
  }

  if (connectionFilterLogicalOperators) {
    PgConnectionArgFilterLogicalOperatorsPlugin(builder, options);
  }

  PgConnectionArgFilterOperatorsPlugin(builder, options);
};
