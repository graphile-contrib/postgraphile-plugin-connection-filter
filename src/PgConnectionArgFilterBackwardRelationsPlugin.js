module.exports = function PgConnectionArgFilterBackwardRelationsPlugin(
  builder,
  { pgSimpleCollections }
) {
  const hasConnections = pgSimpleCollections !== "only";
  const hasSimpleCollections =
    pgSimpleCollections === "only" || pgSimpleCollections === "both";

  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      inflection,
      pgOmit: omit,
      getTypeByName,
      pgSql: sql,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      connectionFilterResolve,
      connectionFilterFieldResolversByTypeNameAndFieldName,
    } = build;
    const {
      fieldWithHooks,
      scope: { pgIntrospection: foreignTable, isPgConnectionFilter },
      Self,
    } = context;

    if (!isPgConnectionFilter) return fields;

    const foreignKeyConstraints = introspectionResultsByKind.constraint
      .filter(con => con.type === "f")
      .filter(con => con.foreignClassId === foreignTable.id);
    const foreignAttributes = introspectionResultsByKind.attribute
      .filter(attr => attr.classId === foreignTable.id)
      .sort((a, b) => a.num - b.num);

    const backwardRelationInfoByFieldName = foreignKeyConstraints.reduce(
      (memo, constraint) => {
        if (omit(constraint, "read")) {
          return memo;
        }

        const table = introspectionResultsByKind.classById[constraint.classId];
        if (!table) {
          throw new Error(
            `Could not find the table that referenced us (constraint: ${
              constraint.name
            })`
          );
        }

        const attributes = introspectionResultsByKind.attribute.filter(
          attr => attr.classId === table.id
        );

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
        const isUnique = !!introspectionResultsByKind.constraint.find(
          c =>
            c.classId === table.id &&
            (c.type === "p" || c.type === "u") &&
            c.keyAttributeNums.length === keys.length &&
            c.keyAttributeNums.every((n, i) => keys[i].num === n)
        );

        const singleRelationFieldName = isUnique
          ? inflection.singleRelationByKeysBackwards(
              keys,
              table,
              foreignTable,
              constraint
            )
          : null;

        const shouldAddSingleRelation = isUnique;

        // Intentionally disabled for now.
        // Need to expose `any` and `all` options instead of simply checking for `any`.
        const shouldAddManyRelation = false; // !isUnique;

        if (
          shouldAddSingleRelation &&
          !omit(table, "read") &&
          singleRelationFieldName
        ) {
          memo = extend(memo, {
            [singleRelationFieldName]: {
              table,
              foreignKeys,
              keys,
            },
          });
        }
        function makeFields(isConnection) {
          if (isUnique && !isConnection) {
            // Don't need this, use the singular instead
            return;
          }
          if (shouldAddManyRelation && !omit(table, "many")) {
            const manyRelationFieldName = isConnection
              ? inflection.manyRelationByKeys(
                  keys,
                  table,
                  foreignTable,
                  constraint
                )
              : inflection.manyRelationByKeysSimple(
                  keys,
                  table,
                  foreignTable,
                  constraint
                );

            memo = extend(memo, {
              [manyRelationFieldName]: {
                table,
                foreignKeys,
                keys,
              },
            });
          }
        }
        if (hasConnections) {
          makeFields(true);
        }
        if (hasSimpleCollections) {
          makeFields(false);
        }

        return memo;
      },
      {}
    );

    const backwardRelationFields = Object.entries(
      backwardRelationInfoByFieldName
    ).reduce((memo, curr) => {
      const [fieldName, { table }] = curr;
      const tableTypeName = inflection.tableType(table);
      const tableFilterTypeName = inflection.filterType(tableTypeName);
      const type = getTypeByName(tableFilterTypeName);
      if (type != null) {
        memo[fieldName] = fieldWithHooks(
          fieldName,
          {
            description: `Filter by the object’s \`${fieldName}\` field.`,
            type,
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

      const { table, foreignKeys, keys } = backwardRelationInfoByFieldName[
        fieldName
      ];

      const tableAlias = sql.identifier(Symbol());
      if (table == null) return null;

      const sqlIdentifier = sql.identifier(table.namespace.name, table.name);

      const sqlKeysMatch = sql.join(
        keys.map((key, i) => {
          return sql.fragment`${tableAlias}.${sql.identifier(
            key.name
          )} = ${sourceAlias}.${sql.identifier(foreignKeys[i].name)}`;
        }),
        ") and ("
      );

      const tableTypeName = inflection.tableType(table);
      const tableFilterTypeName = inflection.filterType(tableTypeName);

      const sqlFragment = connectionFilterResolve(
        fieldValue,
        tableAlias,
        tableFilterTypeName
      );

      return sqlFragment == null
        ? null
        : sql.query`exists(
        select 1 from ${sqlIdentifier} as ${tableAlias}
        where ${sqlKeysMatch} and
          (${sqlFragment})
      )`;
    };

    for (const fieldName of Object.keys(backwardRelationInfoByFieldName)) {
      connectionFilterFieldResolversByTypeNameAndFieldName[Self.name][
        fieldName
      ] = resolve;
    }

    return extend(fields, backwardRelationFields);
  });
};
