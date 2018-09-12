module.exports = function PgConnectionArgFilterColumnsPlugin(builder) {
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      newWithHooks,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      pgGetGqlInputTypeByTypeId,
      graphql: { GraphQLString },
      pgColumnFilter,
      pgOmit: omit,
      inflection,
      extendFilterFields,
    } = build;
    const {
      fieldWithHooks,
      scope: { pgIntrospection: table, isPgConnectionFilter },
    } = context;

    if (!isPgConnectionFilter) return fields;

    const attrFields = introspectionResultsByKind.attribute
      .filter(attr => attr.classId === table.id)
      .filter(attr => pgColumnFilter(attr, build, context))
      .filter(attr => !omit(attr, "filter"))
      .reduce((memo, attr) => {
        const fieldName = inflection.column(attr);
        const fieldType =
          pgGetGqlInputTypeByTypeId(attr.typeId, attr.typeModifier) ||
          GraphQLString;
        return extendFilterFields(
          memo,
          fieldName,
          fieldType,
          fieldWithHooks,
          newWithHooks
        );
      }, {});

    return extend(fields, attrFields);
  });

  builder.hook("build", build => {
    const {
      inflection,
      pgOmit: omit,
      pgSql: sql,
      resolveWhereComparison,
      connectionFilterFieldResolvers,
    } = build;

    const resolve = ({
      sourceAlias,
      source,
      fieldName,
      fieldValue,
      introspectionResultsByKind,
    }) => {
      const attrByFieldName = introspectionResultsByKind.attribute
        .filter(
          attr =>
            source.kind === "class"
              ? attr.classId === source.id
              : attr.class.typeId === source.returnTypeId
        )
        //.filter(attr => pgColumnFilter(attr, build, context))
        .filter(attr => !omit(attr, "filter"))
        .reduce((memo, attr) => {
          const fieldName = inflection.column(attr);
          memo[fieldName] = attr;
          return memo;
        }, {});
      const attr = attrByFieldName[fieldName];

      if (attr == null) return null;

      return sql.query`(${sql.join(
        Object.entries(fieldValue).map(([operatorName, input]) => {
          const identifier = sql.query`${sourceAlias}.${sql.identifier(
            attr.name
          )}`;
          return resolveWhereComparison(
            identifier,
            operatorName,
            input,
            attr.type,
            attr.typeModifier
          );
        }),
        ") and ("
      )})`;
    };

    connectionFilterFieldResolvers.push(resolve);

    return build;
  });
};
