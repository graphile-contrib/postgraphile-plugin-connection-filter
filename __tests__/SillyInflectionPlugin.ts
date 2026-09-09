import "postgraphile";

/** Prefix connection-filter builtins so tests exercise the public inflector. */
export const SillyInflectionPlugin: GraphileConfig.Plugin = {
  name: "SillyInflectionPlugin",
  inflection: {
    replace: {
      pgConnectionFilterBuiltin(prev, options, name) {
        return "zzz_" + prev!(name);
      },
    },
  },
};
