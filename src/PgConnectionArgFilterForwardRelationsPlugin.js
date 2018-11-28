module.exports = function PgConnectionArgFilterForwardRelationsPlugin(builder) {
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      newWithHooks,
      inflection,
      pgOmit: omit,
      pgSql: sql,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      connectionFilterResolve,
      connectionFilterFieldResolversByTypeNameAndFieldName,
      connectionFilterTypesByTypeName,
      connectionFilterType,
    } = build;
    const {
      fieldWithHooks,
      scope: { pgIntrospection: table, isPgConnectionFilter },
      Self,
    } = context;

    if (!isPgConnectionFilter) return fields;

    connectionFilterTypesByTypeName[Self.name] = Self;

    const foreignKeyConstraints = introspectionResultsByKind.constraint
      .filter(con => con.type === "f")
      .filter(con => con.classId === table.id);
    const attributes = introspectionResultsByKind.attribute
      .filter(attr => attr.classId === table.id)
      .sort((a, b) => a.num - b.num);

    const forwardRelationInfoByFieldName = foreignKeyConstraints.reduce(
      (memo, constraint) => {
        if (omit(constraint, "read")) {
          return memo;
        }
        const foreignTable =
          introspectionResultsByKind.classById[constraint.foreignClassId];
        if (!foreignTable) {
          throw new Error(
            `Could not find the foreign table (constraint: ${constraint.name})`
          );
        }
        if (omit(foreignTable, "read")) {
          return memo;
        }
        const foreignAttributes = introspectionResultsByKind.attribute
          .filter(attr => attr.classId === constraint.foreignClassId)
          .sort((a, b) => a.num - b.num);

        const keys = constraint.keyAttributeNums.map(
          num => attributes.filter(attr => attr.num === num)[0]
        );
        const foreignKeys = constraint.foreignKeyAttributeNums.map(
          num => foreignAttributes.filter(attr => attr.num === num)[0]
        );
        if (!keys.every(_ => _) || !foreignKeys.every(_ => _)) {
          throw new Error("Could not find key columns!");
        }
        if (keys.some(key => omit(key, "read"))) {
          return memo;
        }
        if (foreignKeys.some(key => omit(key, "read"))) {
          return memo;
        }

        const fieldName = inflection.singleRelationByKeys(
          keys,
          foreignTable,
          table,
          constraint
        );

        memo = extend(memo, {
          [fieldName]: {
            foreignTable,
            foreignKeys,
            keys,
          },
        });

        return memo;
      },
      {}
    );

    const forwardRelationFields = Object.entries(
      forwardRelationInfoByFieldName
    ).reduce((memo, curr) => {
      const [fieldName, { foreignTable }] = curr;
      const foreignTableTypeName = inflection.tableType(foreignTable);
      const foreignTableFilterTypeName = inflection.filterType(
        foreignTableTypeName
      );
      const FilterType = connectionFilterType(
        newWithHooks,
        foreignTableFilterTypeName,
        foreignTable,
        foreignTableTypeName
      );
      if (FilterType != null) {
        memo[fieldName] = fieldWithHooks(
          fieldName,
          {
            description: `Filter by the object’s \`${fieldName}\` field.`,
            type: FilterType,
          },
          {
            isPgConnectionFilterField: true,
          }
        );
      }
      return memo;
    }, {});

    const resolve = ({ sourceAlias, fieldName, fieldValue }) => {
      if (fieldValue == null) return null;

      const {
        foreignTable,
        foreignKeys,
        keys,
      } = forwardRelationInfoByFieldName[fieldName];

      const foreignTableAlias = sql.identifier(Symbol());
      if (foreignTable == null) return null;

      const sqlIdentifier = sql.identifier(
        foreignTable.namespace.name,
        foreignTable.name
      );

      const sqlKeysMatch = sql.query`(${sql.join(
        keys.map((key, i) => {
          return sql.fragment`${sourceAlias}.${sql.identifier(
            key.name
          )} = ${foreignTableAlias}.${sql.identifier(foreignKeys[i].name)}`;
        }),
        ") and ("
      )})`;

      const foreignTableTypeName = inflection.tableType(foreignTable);
      const foreignTableFilterTypeName = inflection.filterType(
        foreignTableTypeName
      );

      const sqlFragment = connectionFilterResolve(
        fieldValue,
        foreignTableAlias,
        foreignTableFilterTypeName
      );

      return sqlFragment == null
        ? null
        : sql.query`\
      exists(
        select 1 from ${sqlIdentifier} as ${foreignTableAlias}
        where ${sqlKeysMatch} and
          (${sqlFragment})
      )`;
    };

    for (const fieldName of Object.keys(forwardRelationInfoByFieldName)) {
      connectionFilterFieldResolversByTypeNameAndFieldName[Self.name][
        fieldName
      ] = resolve;
    }

    return extend(fields, forwardRelationFields);
  });
};
