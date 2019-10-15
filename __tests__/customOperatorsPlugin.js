module.exports = function CustomOperatorsPlugin(builder) {
  builder.hook("build", (_, build) => {
    const {
      pgSql: sql,
      graphql: { GraphQLInt, GraphQLBoolean },
      addConnectionFilterOperator,
    } = build;

    // simple
    addConnectionFilterOperator(
      "InternetAddress",
      "familyEqualTo",
      "Address family equal to specified value.",
      () => GraphQLInt,
      (i, v) => sql.fragment`family(${i}) = ${v}`
    );

    // using resolveSqlIdentifier
    addConnectionFilterOperator(
      "InternetAddress",
      "familyNotEqualTo",
      "Address family equal to specified value.",
      () => GraphQLInt,
      (i, v) => sql.fragment`${i} <> ${v}`,
      {
        resolveSqlIdentifier: i => sql.fragment`family(${i})`,
      }
    );

    // using resolveInput
    addConnectionFilterOperator(
      ["InternetAddress"], // typeNames: string | string[]
      "isV4",
      "Address family equal to specified value.",
      () => GraphQLBoolean,
      (i, v) => sql.fragment`family(${i}) = ${v}`,
      {
        resolveInput: input => (input === true ? 4 : 6),
      }
    );

    return _;
  });
};
