module.exports = function PgConnectionArgFilterColumnsPlugin(builder) {
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      newWithHooks,
      pgSql: sql,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      pgGetGqlInputTypeByTypeIdAndModifier,
      graphql: { GraphQLString },
      pgColumnFilter,
      pgOmit: omit,
      inflection,
      connectionFilterField,
      resolveWhereComparison,
      connectionFilterFieldResolversByTypeNameAndFieldName,
    } = build;
    const {
      fieldWithHooks,
      scope: { pgIntrospection: table, isPgConnectionFilter },
      Self,
    } = context;

    if (!isPgConnectionFilter) return fields;

    connectionFilterFieldResolversByTypeNameAndFieldName[Self.name] = {};

    const attrByFieldName = introspectionResultsByKind.attribute
      .filter(attr => attr.classId === table.id)
      .filter(attr => pgColumnFilter(attr, build, context))
      .filter(attr => !omit(attr, "filter"))
      .reduce((memo, attr) => {
        const fieldName = inflection.column(attr);
        memo[fieldName] = attr;
        return memo;
      }, {});

    const attrFields = Object.entries(attrByFieldName).reduce(
      (memo, [fieldName, attr]) => {
        const fieldType =
          pgGetGqlInputTypeByTypeIdAndModifier(
            attr.typeId,
            attr.typeModifier
          ) || GraphQLString; // TODO: Remove `|| GraphQLString` before v1.0.0
        const fieldSpec = connectionFilterField(
          fieldName,
          fieldType,
          fieldWithHooks,
          newWithHooks
        );
        if (!fieldSpec) {
          return memo;
        }
        return extend(memo, { [fieldName]: fieldSpec });
      },
      {}
    );

    const resolve = ({ sourceAlias, fieldName, fieldValue }) => {
      if (fieldValue == null) return null;

      const attr = attrByFieldName[fieldName];

      const sqlFragments = Object.entries(fieldValue)
        .map(([operatorName, input]) => {
          const sqlIdentifier = sql.query`${sourceAlias}.${sql.identifier(
            attr.name
          )}`;
          return resolveWhereComparison(
            sqlIdentifier,
            operatorName,
            input,
            attr.type,
            attr.typeModifier
          );
        })
        .filter(x => x != null);

      return sqlFragments.length === 0
        ? null
        : sql.query`(${sql.join(sqlFragments, ") and (")})`;
    };

    for (const fieldName of Object.keys(attrByFieldName)) {
      connectionFilterFieldResolversByTypeNameAndFieldName[Self.name][
        fieldName
      ] = resolve;
    }

    return extend(fields, attrFields);
  });
};
