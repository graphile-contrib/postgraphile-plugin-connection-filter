import type { Plugin } from "graphile-build";

const ConnectionArgFilterPlugin: Plugin = (builder, options) => {
  builder.hook("inflection", (inflection) => {
    return Object.assign(inflection, {
      filterType(typeName: string) {
        return `${options.connectionFilterTypePrefix}${typeName}Filter`;
      },
      filterFieldType(typeName: string) {
        return `${options.connectionFilterTypePrefix}${typeName}Filter`;
      },
      filterFieldListType(typeName: string) {
        return `${options.connectionFilterTypePrefix}${typeName}ListFilter`;
      },
    });
  });
};

export default ConnectionArgFilterPlugin;
