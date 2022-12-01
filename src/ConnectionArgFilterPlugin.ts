import type {} from "graphile-build";

const { version } = require("../package.json");

export const ConnectionArgFilterPlugin: GraphileConfig.Plugin = {
  name: "PostGraphileConnectionFilter_ConnectionArgFilterPlugin",
  version,

  inflection: {
    add: {
      filterType(preset, typeName) {
        return `${typeName}Filter`;
      },
      filterFieldType(preset, typeName) {
        return `${typeName}Filter`;
      },
      filterFieldListType(preset, typeName) {
        return `${typeName}ListFilter`;
      },
    },
  },
};
