const core = require("./core");

test(
  "prints a schema with the filter plugin and the connectionFilterAllowedOperators option",
  core.test(["p"], {
    appendPlugins: [require("../../../index.js")],
    graphileBuildOptions: {
      connectionFilterAllowedOperators: ["equalTo", "notEqualTo"],
    },
  })
);
