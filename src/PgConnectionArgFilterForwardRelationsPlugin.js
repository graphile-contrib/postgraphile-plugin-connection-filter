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

    const forwardRelationSpecs = introspectionResultsByKind.constraint
      .filter(con => con.type === "f")
      .filter(con => con.classId === table.id)
      .reduce((memo, constraint) => {
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
        const attributes = introspectionResultsByKind.attribute
          .filter(attr => attr.classId === table.id)
          .sort((a, b) => a.num - b.num);
        const foreignAttributes = introspectionResultsByKind.attribute
          .filter(attr => attr.classId === foreignTable.id)
          .sort((a, b) => a.num - b.num);
        const keyAttributes = constraint.keyAttributeNums.map(
          num => attributes.filter(attr => attr.num === num)[0]
        );
        const foreignKeyAttributes = constraint.foreignKeyAttributeNums.map(
          num => foreignAttributes.filter(attr => attr.num === num)[0]
        );
        if (keyAttributes.some(attr => omit(attr, "read"))) {
          return memo;
        }
        if (foreignKeyAttributes.some(attr => omit(attr, "read"))) {
          return memo;
        }
        memo.push({
          table,
          keyAttributes,
          foreignTable,
          foreignKeyAttributes,
          constraint,
        });
        return memo;
      }, []);

    const forwardRelationSpecByFieldName = forwardRelationSpecs.reduce(
      (memo, spec) => {
        const { constraint, foreignTable, keyAttributes } = spec;
        const fieldName = inflection.singleRelationByKeys(
          keyAttributes,
          foreignTable,
          table,
          constraint
        );
        memo = extend(memo, {
          [fieldName]: spec,
        });
        return memo;
      },
      {}
    );

    const forwardRelationFields = Object.entries(
      forwardRelationSpecByFieldName
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
            description: `Filter by the object’s \`${fieldName}\` relation.`,
            type: FilterType,
          },
          {
            isPgConnectionFilterField: true,
          }
        );
      }
      return memo;
    }, {});

    const resolve = ({ sourceAlias, fieldName, fieldValue, queryBuilder }) => {
      if (fieldValue == null) return null;

      const {
        foreignTable,
        foreignKeyAttributes,
        keyAttributes,
      } = forwardRelationSpecByFieldName[fieldName];

      const foreignTableAlias = sql.identifier(Symbol());
      if (foreignTable == null) return null;

      const sqlIdentifier = sql.identifier(
        foreignTable.namespace.name,
        foreignTable.name
      );

      const sqlKeysMatch = sql.query`(${sql.join(
        keyAttributes.map((key, i) => {
          return sql.fragment`${sourceAlias}.${sql.identifier(
            key.name
          )} = ${foreignTableAlias}.${sql.identifier(
            foreignKeyAttributes[i].name
          )}`;
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
        foreignTableFilterTypeName,
        queryBuilder
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

    for (const fieldName of Object.keys(forwardRelationSpecByFieldName)) {
      connectionFilterFieldResolversByTypeNameAndFieldName[Self.name] = {
        ...connectionFilterFieldResolversByTypeNameAndFieldName[Self.name],
        [fieldName]: resolve,
      };
    }

    return extend(fields, forwardRelationFields);
  });
};
