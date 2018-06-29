const core = require("./core");

test(
  "prints a schema with the filter plugin and the connectionFilterOperatorNames option",
  core.test(["p"], {
    appendPlugins: [require("../../../index.js")],
    graphileBuildOptions: {
      connectionFilterOperatorNames: {
        equalTo: "eq",
        notEqualTo: "ne",
      },
    },
  })
);
