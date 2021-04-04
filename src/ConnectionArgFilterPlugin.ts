import type { Plugin } from "graphile-build";

const ConnectionArgFilterPlugin: Plugin = (builder) => {
  builder.hook("inflection", (inflection) => {
    return Object.assign(inflection, {
      filterType(typeName: string) {
        return `${typeName}Filter`;
      },
      filterFieldType(typeName: string) {
        return `${typeName}Filter`;
      },
      filterFieldListType(typeName: string) {
        return `${typeName}ListFilter`;
      },
    });
  });
};

export default ConnectionArgFilterPlugin;
