module.exports = function PgConnectionArgFilterComputedColumnsPlugin(builder) {
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      newWithHooks,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      pgGetGqlInputTypeByTypeIdAndModifier,
      pgOmit: omit,
      pgSql: sql,
      resolveWhereComparison,
      inflection,
      connectionFilterTypesByTypeName,
      connectionFilterOperatorsType,
      connectionFilterFieldResolversByTypeNameAndFieldName,
    } = build;
    const {
      fieldWithHooks,
      scope: { pgIntrospection: table, isPgConnectionFilter },
      Self,
    } = context;

    if (!isPgConnectionFilter || table.kind !== "class") return fields;

    connectionFilterTypesByTypeName[Self.name] = Self;

    const procByFieldName = introspectionResultsByKind.procedure
      .filter(proc => proc.isStable)
      .filter(proc => proc.namespaceId === table.namespaceId)
      .filter(proc => proc.name.startsWith(`${table.name}_`))
      .filter(proc => proc.argTypeIds.length > 0)
      .filter(proc => proc.argTypeIds[0] === table.typeId)
      .filter(proc => !omit(proc, "filter"))
      .reduce((memo, proc) => {
        const argTypes = proc.argTypeIds.map(
          typeId => introspectionResultsByKind.typeById[typeId]
        );
        if (
          argTypes
            .slice(1)
            .some(
              type => type.type === "c" && type.class && type.class.isSelectable
            )
        ) {
          // Accepts two input tables? Skip.
          return memo;
        }
        if (argTypes.length > 1) {
          // Accepts arguments? Skip.
          return memo;
        }
        if (proc.returnsSet) {
          // Returns setof? Skip.
          return memo;
        }
        const pseudoColumnName = proc.name.substr(table.name.length + 1);
        const fieldName = inflection.computedColumn(
          pseudoColumnName,
          proc,
          table
        );
        memo[fieldName] = proc;
        return memo;
      }, {});

    const procFields = Object.entries(procByFieldName).reduce(
      (memo, [fieldName, proc]) => {
        const fieldType = pgGetGqlInputTypeByTypeIdAndModifier(
          proc.returnTypeId,
          null
        );
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

      const proc = procByFieldName[fieldName];

      const sqlFragments = Object.entries(fieldValue)
        .map(([operatorName, input]) => {
          const procReturnType =
            introspectionResultsByKind.typeById[proc.returnTypeId];
          const sqlIdentifier = sql.query`${sql.identifier(
            proc.namespace.name
          )}.${sql.identifier(proc.name)}(${sourceAlias})`;
          return resolveWhereComparison(
            sqlIdentifier,
            operatorName,
            input,
            procReturnType,
            null,
            fieldName,
            queryBuilder,
            sourceAlias
          );
        })
        .filter(x => x != null);

      return sqlFragments.length === 0
        ? null
        : sql.query`(${sql.join(sqlFragments, ") and (")})`;
    };

    for (const fieldName of Object.keys(procByFieldName)) {
      connectionFilterFieldResolversByTypeNameAndFieldName[Self.name] = {
        ...connectionFilterFieldResolversByTypeNameAndFieldName[Self.name],
        [fieldName]: resolve,
      };
    }

    return extend(fields, procFields);
  });
};
