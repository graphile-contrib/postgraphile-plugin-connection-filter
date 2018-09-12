module.exports = function PgConnectionArgFilterComputedColumnsPlugin(
  builder,
  { connectionFilterComputedColumns = true }
) {
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      newWithHooks,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      pgGetGqlInputTypeByTypeId,
      pgOmit: omit,
      inflection,
      extendFilterFields,
    } = build;
    const {
      fieldWithHooks,
      scope: { pgIntrospection: table, isPgConnectionFilter },
    } = context;

    if (!isPgConnectionFilter) return fields;

    const tableType = introspectionResultsByKind.type.filter(
      type =>
        type.type === "c" &&
        type.namespaceId === table.namespaceId &&
        type.classId === table.id
    )[0];
    if (!tableType) {
      throw new Error("Could not determine the type for this table");
    }
    const procFields = connectionFilterComputedColumns
      ? introspectionResultsByKind.procedure
          .filter(proc => proc.isStable)
          .filter(proc => proc.namespaceId === table.namespaceId)
          .filter(proc => proc.name.startsWith(`${table.name}_`))
          .filter(proc => proc.argTypeIds.length > 0)
          .filter(proc => proc.argTypeIds[0] === tableType.id)
          .filter(proc => !omit(proc, "filter"))
          .reduce((memo, proc) => {
            const argTypes = proc.argTypeIds.map(
              typeId => introspectionResultsByKind.typeById[typeId]
            );
            if (
              argTypes
                .slice(1)
                .some(
                  type =>
                    type.type === "c" && type.class && type.class.isSelectable
                )
            ) {
              // Accepts two input tables? Skip.
              return memo;
            }
            if (argTypes.length > 1) {
              // Accepts arguments? Skip.
              return memo;
            }
            const pseudoColumnName = proc.name.substr(table.name.length + 1);
            const fieldName = inflection.computedColumn(
              pseudoColumnName,
              proc,
              table
            );
            const fieldType = pgGetGqlInputTypeByTypeId(
              proc.returnTypeId,
              null
            );
            return extendFilterFields(
              memo,
              fieldName,
              fieldType,
              fieldWithHooks,
              newWithHooks
            );
          }, {})
      : {};

    return extend(fields, procFields);
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
      const table =
        source.kind === "class"
          ? source
          : introspectionResultsByKind.typeById[source.returnTypeId] &&
            introspectionResultsByKind.typeById[source.returnTypeId].class;
      const procByFieldName = table
        ? introspectionResultsByKind.procedure
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
                    type =>
                      type.type === "c" && type.class && type.class.isSelectable
                  )
              ) {
                // Accepts two input tables? Skip.
                return memo;
              }
              if (argTypes.length > 1) {
                // Accepts arguments? Skip.
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
            }, {})
        : {};
      const proc = procByFieldName[fieldName];
      if (proc == null) return null;

      return sql.query`(${sql.join(
        Object.entries(fieldValue).map(([operatorName, input]) => {
          const procReturnType =
            introspectionResultsByKind.typeById[proc.returnTypeId];
          const identifier = sql.query`${sql.identifier(
            proc.namespace.name
          )}.${sql.identifier(proc.name)}(${sourceAlias})`;
          return resolveWhereComparison(
            identifier,
            operatorName,
            input,
            procReturnType,
            null
          );
        }),
        ") and ("
      )})`;
    };

    connectionFilterFieldResolvers.push(resolve);

    return build;
  });
};
