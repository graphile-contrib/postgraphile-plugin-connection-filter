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
      connectionFilterOperatorsType,
      connectionFilterRegisterResolver,
      connectionFilterResolvePredicates,
      connectionFilterTypesByTypeName,
    } = build;
    const {
      fieldWithHooks,
      scope: { pgIntrospection: table, isPgConnectionFilter },
      Self,
    } = context;

    if (!isPgConnectionFilter || table.kind !== "class") return fields;

    connectionFilterTypesByTypeName[Self.name] = Self;

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
        const OperatorsType = connectionFilterOperatorsType(
          fieldType,
          newWithHooks
        );
        if (!OperatorsType) {
          return memo;
        }
        return extend(memo, {
          [fieldName]: fieldWithHooks(
            fieldName,
            {
              description: `Filter by the object’s \`${fieldName}\` field.`,
              type: OperatorsType,
            },
            {
              isPgConnectionFilterField: true,
            }
          ),
        });
      },
      {}
    );

    const resolve = ({ sourceAlias, fieldName, fieldValue, queryBuilder }) => {
      if (fieldValue == null) return null;

      const attr = attrByFieldName[fieldName];
      const sqlIdentifier = sql.query`${sourceAlias}.${sql.identifier(
        attr.name
      )}`;
      const pgType = attr.type;
      const pgTypeModifier = attr.typeModifier;

      return connectionFilterResolvePredicates({
        sourceAlias,
        fieldName,
        fieldValue,
        queryBuilder,
        sqlIdentifier,
        pgType,
        pgTypeModifier,
      });
    };

    for (const fieldName of Object.keys(attrByFieldName)) {
      connectionFilterRegisterResolver(Self.name, fieldName, resolve);
    }

    return extend(fields, attrFields);
  });
};
