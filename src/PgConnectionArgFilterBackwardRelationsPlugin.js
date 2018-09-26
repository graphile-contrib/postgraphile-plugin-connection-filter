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
      getTypeByName,
      inflection,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      backwardRelationFieldInfoFromTable,
    } = build;
    const {
      fieldWithHooks,
      scope: { pgIntrospection: foreignTable, isPgConnectionFilter },
    } = context;

    if (!isPgConnectionFilter) return fields;

    const backwardRelationFields = Object.entries(
      backwardRelationFieldInfoFromTable(
        foreignTable,
        introspectionResultsByKind
      )
    ).reduce((memo, curr) => {
      const [fieldName, { table }] = curr;
      const tableTypeName = inflection.tableType(table);
      const type = getTypeByName(inflection.filterType(tableTypeName));
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

    return extend(fields, backwardRelationFields);
  });

  builder.hook("build", build => {
    const {
      extend,
      inflection,
      pgOmit: omit,
      pgSql: sql,
      connectionFilterFieldResolvers,
    } = build;

    // *** Much of this code was copied from PgBackwardRelationPlugin.js ***
    const backwardRelationFieldInfoFromTable = (
      foreignTable,
      introspectionResultsByKind
    ) => {
      // This is a relation in which WE are foreign
      const foreignKeyConstraints = introspectionResultsByKind.constraint
        .filter(con => con.type === "f")
        .filter(con => con.foreignClassId === foreignTable.id);
      const foreignAttributes = introspectionResultsByKind.attribute
        .filter(attr => attr.classId === foreignTable.id)
        .sort((a, b) => a.num - b.num);
      return foreignKeyConstraints.reduce((memo, constraint) => {
        if (omit(constraint, "read")) {
          return memo;
        }
        const table = introspectionResultsByKind.classById[constraint.classId];
        const foreignTable =
          introspectionResultsByKind.classById[constraint.foreignClassId];
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
      }, {});
    };

    const resolve = ({
      sourceAlias,
      source,
      fieldName,
      fieldValue,
      introspectionResultsByKind,
      connectionFilterFieldResolvers,
    }) => {
      const backwardRelationFieldInfo = backwardRelationFieldInfoFromTable(
        source,
        introspectionResultsByKind
      )[fieldName];

      if (backwardRelationFieldInfo == null) return null;

      const { table, foreignKeys, keys } = backwardRelationFieldInfo;

      const tableAlias = sql.identifier(Symbol());
      if (table == null) return null;

      return sql.query`exists(
        select 1 from ${sql.identifier(
          table.namespace.name,
          table.name
        )} as ${tableAlias}
        where (${sql.join(
          keys.map((key, i) => {
            return sql.fragment`${tableAlias}.${sql.identifier(
              key.name
            )} = ${sourceAlias}.${sql.identifier(foreignKeys[i].name)}`;
          }),
          ") and ("
        )}) 
          and (${sql.query`(${sql.join(
            Object.entries(fieldValue).map(([fieldName, fieldValue]) => {
              // Try to resolve field
              for (const resolve of connectionFilterFieldResolvers) {
                const resolved = resolve({
                  sourceAlias: tableAlias,
                  source: table,
                  fieldName,
                  fieldValue,
                  introspectionResultsByKind,
                  connectionFilterFieldResolvers,
                });
                if (resolved != null) return resolved;
              }
            }),
            ") and ("
          )})`})
      )`;
    };

    connectionFilterFieldResolvers.push(resolve);

    return extend(build, {
      backwardRelationFieldInfoFromTable,
    });
  });
};
