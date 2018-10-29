module.exports = function PostGraphileConnectionFilterPlugin(builder, options) {
  const {
    connectionFilterComputedColumns = true,
    connectionFilterRelations = false,
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

  require("./src/PgConnectionArgFilterOperatorsPlugin.js")(builder, options);
  require("./src/PgConnectionArgFilterLogicalOperatorsPlugin.js")(
    builder,
    options
  );
};
