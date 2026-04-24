import "postgraphile";

export const FilterAllPlugin: GraphileConfig.Plugin = {
  name: "FilterAllPlugin",
  version: "0.0.0",

  schema: {
    entityBehavior: {
      pgCodecAttribute: {
        inferred: {
          before: ["PgIndexBehaviorsPlugin"],
          callback(behavior, entity, build) {
            return [behavior, "filterBy"];
          },
        },
      },
    },
  },
};
