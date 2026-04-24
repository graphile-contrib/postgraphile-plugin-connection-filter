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
          EXPORTABLE,
        } = build;

        // simple
        addConnectionFilterOperator("InternetAddress", "familyEqualTo", {
          description: "Address family equal to specified value.",
          resolveInputCodec: EXPORTABLE(
            (TYPES) =>
              function () {
                return TYPES.int;
              },
            [TYPES]
          ),
          resolve: EXPORTABLE(
            (sql) =>
              function (i, v) {
                return sql.fragment`family(${i}) = ${v}`;
              },
            [sql]
          ),
        });

        // using resolveSqlIdentifier
        addConnectionFilterOperator("InternetAddress", "familyNotEqualTo", {
          description: "Address family equal to specified value.",
          resolveInputCodec: EXPORTABLE(
            (TYPES) =>
              function () {
                return TYPES.int;
              },
            [TYPES]
          ),
          resolve: EXPORTABLE(
            (sql) =>
              function (i, v) {
                return sql.fragment`${i} <> ${v}`;
              },
            [sql]
          ),
          resolveSqlIdentifier: EXPORTABLE(
            (TYPES, sql) =>
              function (i) {
                return [sql.fragment`family(${i})`, TYPES.int];
              },
            [TYPES, sql]
          ),
        });

        // using resolveInput // typeNames: string | string[]
        addConnectionFilterOperator(["InternetAddress"], "isV4", {
          description: "Address family equal to specified value.",
          resolve: EXPORTABLE(
            (sql) =>
              function (i, v) {
                return sql.fragment`family(${i}) = ${v}`;
              },
            [sql]
          ),
          resolveInput: (input) => (input === true ? 4 : 6),
          resolveInputCodec: EXPORTABLE(
            (TYPES) =>
              function () {
                return TYPES.int;
              },
            [TYPES]
          ),
          resolveType: () => GraphQLBoolean,
        });

        return _;
      },
    },
  },
};

export default CustomOperatorsPlugin;
