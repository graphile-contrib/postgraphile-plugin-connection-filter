const core = require("./core");

test(
  "prints a schema with the filter plugin and the connectionFilterLists option",
  core.test(["p"], {
    appendPlugins: [require("../../../index.js")],
    graphileBuildOptions: {
      connectionFilterLists: false,
    },
  })
);
