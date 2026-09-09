declare global {
  namespace GraphileBuild {
    interface Inflection {
      pgConnectionFilterBuiltin(name: string): string;
    }
  }
}

export const PgConnectionArgFilterInflectionPlugin: GraphileConfig.Plugin = {
  name: "PgConnectionArgFilterInflectionPlugin",
  inflection: {
    add: {
      pgConnectionFilterBuiltin(options, name) {
        return name;
      },
    },
  },
};
