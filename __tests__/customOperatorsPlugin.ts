const CustomOperatorsPlugin: GraphileConfig.Plugin = {
  name: "CustomOperatorsPlugin",
  version: "0.0.0",

  schema: {
    hooks: {
      init(_) {
        const {
          sql,
          graphql: { GraphQLInt, GraphQLBoolean },
          addConnectionFilterOperator,
        } = build;

        // simple
        addConnectionFilterOperator("InternetAddress", "familyEqualTo", {
          description: "Address family equal to specified value.",
          resolveType: () => GraphQLInt,
          resolve: (i, v) => sql.fragment`family(${i}) = ${v}`,
        });

        // using resolveSqlIdentifier
        addConnectionFilterOperator("InternetAddress", "familyNotEqualTo", {
          description: "Address family equal to specified value.",
          resolveType: () => GraphQLInt,
          resolve: (i, v) => sql.fragment`${i} <> ${v}`,
          resolveSqlIdentifier: (i) => sql.fragment`family(${i})`,
        });

        // using resolveInput // typeNames: string | string[]
        addConnectionFilterOperator(["InternetAddress"], "isV4", {
          description: "Address family equal to specified value.",
          resolveType: () => GraphQLBoolean,
          resolve: (i, v) => sql.fragment`family(${i}) = ${v}`,
          resolveInput: (input) => (input === true ? 4 : 6),
        });

        return _;
      },
    },
  },
};

export default CustomOperatorsPlugin;
