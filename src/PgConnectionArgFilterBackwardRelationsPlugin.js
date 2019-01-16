module.exports = function PgConnectionArgFilterBackwardRelationsPlugin(
  builder,
  { pgSimpleCollections }
) {
  const hasConnections = pgSimpleCollections !== "only";
  const hasSimpleCollections =
    pgSimpleCollections === "only" || pgSimpleCollections === "both";

  builder.hook("inflection", inflection => {
    return Object.assign(inflection, {
      filterManyType(typeName) {
        return `${typeName}FilterMany`;
      },
    });
  });

  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      newWithHooks,
      inflection,
      pgOmit: omit,
      pgSql: sql,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      graphql: { GraphQLInputObjectType, GraphQLBoolean },
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

    const backwardRelationSpecs = introspectionResultsByKind.constraint
      .filter(con => con.type === "f")
      .filter(con => con.foreignClassId === table.id)
      .reduce((memo, foreignConstraint) => {
        if (omit(foreignConstraint, "read")) {
          return memo;
        }
        const foreignTable =
          introspectionResultsByKind.classById[foreignConstraint.classId];
        if (!foreignTable) {
          throw new Error(
            `Could not find the foreign table (constraint: ${
              foreignConstraint.name
            })`
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
        const keyAttributes = foreignConstraint.foreignKeyAttributeNums.map(
          num => attributes.filter(attr => attr.num === num)[0]
        );
        const foreignKeyAttributes = foreignConstraint.keyAttributeNums.map(
          num => foreignAttributes.filter(attr => attr.num === num)[0]
        );
        if (keyAttributes.some(attr => omit(attr, "read"))) {
          return memo;
        }
        if (foreignKeyAttributes.some(attr => omit(attr, "read"))) {
          return memo;
        }
        const isForeignKeyUnique = !!introspectionResultsByKind.constraint.find(
          c =>
            c.classId === foreignTable.id &&
            (c.type === "p" || c.type === "u") &&
            c.keyAttributeNums.length === foreignKeyAttributes.length &&
            c.keyAttributeNums.every(
              (n, i) => foreignKeyAttributes[i].num === n
            )
        );
        memo.push({
          table,
          keyAttributes,
          foreignTable,
          foreignKeyAttributes,
          foreignConstraint,
          isOneToMany: !isForeignKeyUnique,
        });
        return memo;
      }, []);

    const backwardRelationSpecByFieldName = backwardRelationSpecs.reduce(
      (memo, spec) => {
        const {
          foreignTable,
          foreignKeyAttributes,
          foreignConstraint,
          isOneToMany,
        } = spec;
        if (isOneToMany) {
          function makeFields(isConnection) {
            if (!omit(foreignTable, "many")) {
              const fieldName = isConnection
                ? inflection.manyRelationByKeys(
                    foreignKeyAttributes,
                    foreignTable,
                    table,
                    foreignConstraint
                  )
                : inflection.manyRelationByKeysSimple(
                    foreignKeyAttributes,
                    foreignTable,
                    table,
                    foreignConstraint
                  );
              memo = extend(memo, {
                [fieldName]: spec,
              });
            }
          }
          if (hasConnections) {
            makeFields(true);
          }
          if (hasSimpleCollections) {
            makeFields(false);
          }
        } else {
          const fieldName = inflection.singleRelationByKeysBackwards(
            foreignKeyAttributes,
            foreignTable,
            table,
            foreignConstraint
          );
          memo = extend(memo, {
            [fieldName]: spec,
          });
        }
        return memo;
      },
      {}
    );

    const backwardRelationFields = Object.entries(
      backwardRelationSpecByFieldName
    ).reduce((memo, curr) => {
      const [fieldName, { foreignTable, isOneToMany }] = curr;
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
        if (isOneToMany) {
          const filterManyTypeName = inflection.filterManyType(
            foreignTableTypeName
          );
          if (!connectionFilterTypesByTypeName[filterManyTypeName]) {
            connectionFilterTypesByTypeName[filterManyTypeName] = newWithHooks(
              GraphQLInputObjectType,
              {
                name: filterManyTypeName,
                description: `A filter to be used against many \`${foreignTableTypeName}\` object types. All fields are combined with a logical ‘and.’`,
                fields: {
                  exist: {
                    description: `A related \`${foreignTableTypeName}\` exists.`,
                    type: GraphQLBoolean,
                  },
                  every: {
                    description: `Every related \`${foreignTableTypeName}\` matches the filter criteria. All fields are combined with a logical ‘and.’`,
                    type: FilterType,
                  },
                  some: {
                    description: `Some related \`${foreignTableTypeName}\` matches the filter criteria. All fields are combined with a logical ‘and.’`,
                    type: FilterType,
                  },
                  none: {
                    description: `No related \`${foreignTableTypeName}\` matches the filter criteria. All fields are combined with a logical ‘and.’`,
                    type: FilterType,
                  },
                },
              },
              {
                isPgConnectionFilterField: true,
              }
            );
          }
          const FilterManyType =
            connectionFilterTypesByTypeName[filterManyTypeName];
          memo[fieldName] = fieldWithHooks(
            fieldName,
            {
              description: `Filter by the object’s \`${fieldName}\` relation.`,
              type: FilterManyType,
            },
            {
              isPgConnectionFilterField: true,
            }
          );
        } else {
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
      }
      return memo;
    }, {});

    const resolve = ({ sourceAlias, fieldName, fieldValue, queryBuilder }) => {
      if (fieldValue == null) return null;

      const {
        foreignTable,
        foreignKeyAttributes,
        keyAttributes,
        isOneToMany,
      } = backwardRelationSpecByFieldName[fieldName];

      const foreignTableAlias = sql.identifier(Symbol());
      if (foreignTable == null) return null;

      const sqlIdentifier = sql.identifier(
        foreignTable.namespace.name,
        foreignTable.name
      );

      const sqlKeysMatch = sql.query`(${sql.join(
        foreignKeyAttributes.map((attr, i) => {
          return sql.fragment`${foreignTableAlias}.${sql.identifier(
            attr.name
          )} = ${sourceAlias}.${sql.identifier(keyAttributes[i].name)}`;
        }),
        ") and ("
      )})`;

      const foreignTableTypeName = inflection.tableType(foreignTable);
      const foreignTableFilterTypeName = inflection.filterType(
        foreignTableTypeName
      );

      if (isOneToMany) {
        return sql.join(
          Object.entries(fieldValue).map(([manyFieldName, manyFieldValue]) => {
            const sqlSelectWhereKeysMatch = sql.query`select 1 from ${sqlIdentifier} as ${foreignTableAlias} where ${sqlKeysMatch}`;

            if (manyFieldName === "exist") {
              return sql.query`${
                manyFieldValue === true ? "" : sql.query`not `
              }exists(${sqlSelectWhereKeysMatch})`;
            }

            const sqlFragment = connectionFilterResolve(
              manyFieldValue,
              foreignTableAlias,
              foreignTableFilterTypeName,
              queryBuilder
            );

            return sqlFragment == null
              ? null
              : manyFieldName === "every"
              ? sql.query`not exists(${sqlSelectWhereKeysMatch} and not (${sqlFragment}))`
              : manyFieldName === "some"
              ? sql.query`exists(${sqlSelectWhereKeysMatch} and (${sqlFragment}))`
              : manyFieldName === "none"
              ? sql.query`not exists(${sqlSelectWhereKeysMatch} and (${sqlFragment}))`
              : new Error("Unexpected field name");
          }),
          " and "
        );
      } else {
        const sqlFragment = connectionFilterResolve(
          fieldValue,
          foreignTableAlias,
          foreignTableFilterTypeName,
          queryBuilder
        );

        const sqlSelectWhereKeysMatch = sql.query`select 1 from ${sqlIdentifier} as ${foreignTableAlias} where ${sqlKeysMatch}`;

        return sqlFragment == null
          ? null
          : sql.query`exists(${sqlSelectWhereKeysMatch} and (${sqlFragment}))`;
      }
    };

    for (const fieldName of Object.keys(backwardRelationSpecByFieldName)) {
      connectionFilterFieldResolversByTypeNameAndFieldName[Self.name][
        fieldName
      ] = resolve;
    }

    return extend(fields, backwardRelationFields);
  });
};
