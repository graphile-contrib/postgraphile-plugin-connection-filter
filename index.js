module.exports = function PostGraphileConnectionFilterPlugin(builder, options) {
  require("./src/ConnectionArgFilterPlugin.js")(builder, options);
  require("./src/PgConnectionArgFilterPlugin.js")(builder, options);
  require("./src/PgConnectionArgFilterOperatorsPlugin.js")(builder, options);
};
