const core = require("./core");

test(
  "prints a schema with the filter plugin",
  core.test(["p"], {
    appendPlugins: [require("../../../index.js")],
  })
);
