module.exports = function PgConnectionArgFilterComputedColumnsPlugin(builder) {
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      getTypeByName,
      inflection,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      forwardRelationFieldInfoFromTable,
    } = build;
    const {
      fieldWithHooks,
      scope: { pgIntrospection: table, isPgConnectionFilter },
    } = context;

    if (!isPgConnectionFilter) return fields;

    const forwardRelationFields = Object.entries(
      forwardRelationFieldInfoFromTable(table, introspectionResultsByKind)
    ).reduce((memo, curr) => {
      const [fieldName, { foreignTable }] = curr;
      const foreignTableTypeName = inflection.tableType(foreignTable);
      const type = getTypeByName(`${foreignTableTypeName}Filter`);
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

    return extend(fields, forwardRelationFields);
  });

  builder.hook("build", build => {
    const {
      extend,
      inflection,
      pgOmit: omit,
      pgSql: sql,
      connectionFilterFieldResolvers,
    } = build;

    // *** This code was copied from PgForwardRelationPlugin.js ***
    const forwardRelationFieldInfoFromTable = (
      table,
      introspectionResultsByKind
    ) => {
      const foreignKeyConstraints = introspectionResultsByKind.constraint
        .filter(con => con.type === "f")
        .filter(con => con.classId === table.id);
      const attributes = introspectionResultsByKind.attribute
        .filter(attr => attr.classId === table.id)
        .sort((a, b) => a.num - b.num);
      return foreignKeyConstraints.reduce((memo, constraint) => {
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
        const foreignSchema = introspectionResultsByKind.namespace.filter(
          n => n.id === foreignTable.namespaceId
        )[0];
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
            foreignSchema,
            foreignTable,
            foreignKeys,
            keys,
          },
        });

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
      const {
        foreignSchema,
        foreignTable,
        foreignKeys,
        keys,
      } = forwardRelationFieldInfoFromTable(source, introspectionResultsByKind)[
        fieldName
      ];
      const foreignTableAlias = sql.identifier(Symbol());
      if (foreignTable == null) return null;

      return sql.query`exists(
        select 1 from ${sql.identifier(
          foreignSchema.name,
          foreignTable.name
        )} as ${foreignTableAlias}
        where (${sql.join(
          keys.map((key, i) => {
            return sql.fragment`${sourceAlias}.${sql.identifier(
              key.name
            )} = ${foreignTableAlias}.${sql.identifier(foreignKeys[i].name)}`;
          }),
          ") and ("
        )}) 
          and (${sql.query`(${sql.join(
            Object.entries(fieldValue).map(
              ([foreignFieldName, foreignFieldValue]) => {
                // Try to resolve field
                for (const resolve of connectionFilterFieldResolvers) {
                  const resolved = resolve({
                    sourceAlias: foreignTableAlias,
                    source: foreignTable,
                    fieldName: foreignFieldName,
                    fieldValue: foreignFieldValue,
                    introspectionResultsByKind,
                    connectionFilterFieldResolvers,
                  });
                  if (resolved != null) return resolved;
                }
              }
            ),
            ") and ("
          )})`})
      )`;
    };

    connectionFilterFieldResolvers.push(resolve);

    return extend(build, {
      forwardRelationFieldInfoFromTable,
    });
  });
};
