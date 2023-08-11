import type { Plugin } from "graphile-build";

const ConnectionArgFilterPlugin: Plugin = (builder) => {
  builder.hook("inflection", (inflection) => {
    const {
      connectionFilterName = "filter"
    } = inflection;
    const camcelCasedFilterName = inflection.upperCamelCase(connectionFilterName);
    return Object.assign(inflection, {
      filterType(typeName: string) {
        return `${typeName}${camcelCasedFilterName}`;
      },
      filterFieldType(typeName: string) {
        return `${typeName}${camcelCasedFilterName}`;
      },
      filterFieldListType(typeName: string) {
        return `${typeName}List${camcelCasedFilterName}`;
      },
    });
  });
};

export default ConnectionArgFilterPlugin;
