module.exports = function PgConnectionArgFilterComputedColumnsPlugin(builder) {
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      newWithHooks,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      pgOmit: omit,
      pgSql: sql,
      inflection,
      connectionFilterOperatorsType,
      connectionFilterRegisterResolver,
      connectionFilterResolve,
      connectionFilterTypesByTypeName,
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

    const operatorsTypeNameByFieldName = {};

    const procFields = Object.entries(procByFieldName).reduce(
      (memo, [fieldName, proc]) => {
        const OperatorsType = connectionFilterOperatorsType(
          newWithHooks,
          proc.returnTypeId,
          null
        );
        if (!OperatorsType) {
          return memo;
        }
        operatorsTypeNameByFieldName[fieldName] = OperatorsType.name;
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
      const sqlIdentifier = sql.query`${sql.identifier(
        proc.namespace.name
      )}.${sql.identifier(proc.name)}(${sourceAlias})`;
      const pgType = introspectionResultsByKind.typeById[proc.returnTypeId];
      const pgTypeModifier = null;
      const filterTypeName = operatorsTypeNameByFieldName[fieldName];

      return connectionFilterResolve(
        fieldValue,
        sqlIdentifier,
        filterTypeName,
        queryBuilder,
        pgType,
        pgTypeModifier,
        fieldName
      );
    };

    for (const fieldName of Object.keys(procFields)) {
      connectionFilterRegisterResolver(Self.name, fieldName, resolve);
    }

    return extend(fields, procFields);
  });
};
