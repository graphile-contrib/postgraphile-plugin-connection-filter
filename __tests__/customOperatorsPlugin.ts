import { TYPES } from "@dataplan/pg";

const CustomOperatorsPlugin: GraphileConfig.Plugin = {
  name: "CustomOperatorsPlugin",
  version: "0.0.0",

  schema: {
    hooks: {
      init(_, build) {
        const {
          sql,
          graphql: { GraphQLInt, GraphQLBoolean },
          addConnectionFilterOperator,
        } = build;

        // simple
        addConnectionFilterOperator("InternetAddress", "familyEqualTo", {
          description: "Address family equal to specified value.",
          resolveInputCodec: () => TYPES.int,
          resolve: (i, v) => sql.fragment`family(${i}) = ${v}`,
        });

        // using resolveSqlIdentifier
        addConnectionFilterOperator("InternetAddress", "familyNotEqualTo", {
          description: "Address family equal to specified value.",
          resolveInputCodec: () => TYPES.int,
          resolve: (i, v) => sql.fragment`${i} <> ${v}`,
          resolveSqlIdentifier: (i) => [sql.fragment`family(${i})`, TYPES.int],
        });

        // using resolveInput // typeNames: string | string[]
        addConnectionFilterOperator(["InternetAddress"], "isV4", {
          description: "Address family equal to specified value.",
          resolve: (i, v) => sql.fragment`family(${i}) = ${v}`,
          resolveInput: (input) => (input === true ? 4 : 6),
          resolveInputCodec: () => TYPES.int,
          resolveType: () => GraphQLBoolean,
        });

        return _;
      },
    },
  },
};

export default CustomOperatorsPlugin;
