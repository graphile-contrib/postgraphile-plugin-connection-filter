const core = require("./core");

test(
  "prints a schema with the filter plugin and the connectionFilterRelations option",
  core.test(["p"], {
    appendPlugins: [require("../../../index.js")],
    graphileBuildOptions: {
      connectionFilterRelations: true,
    },
  })
);
