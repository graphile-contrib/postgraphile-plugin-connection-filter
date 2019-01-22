module.exports = function PgConnectionArgFilterRecordFunctionsPlugin(builder) {
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      newWithHooks,
      pgSql: sql,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      pgGetGqlTypeByTypeIdAndModifier,
      inflection,
      connectionFilterOperatorsType,
      resolveWhereComparison,
      connectionFilterTypesByTypeName,
      connectionFilterFieldResolversByTypeNameAndFieldName,
    } = build;
    const {
      fieldWithHooks,
      scope: { pgIntrospection: proc, isPgConnectionFilter },
      Self,
    } = context;

    if (!isPgConnectionFilter || proc.kind !== "procedure") return fields;

    connectionFilterTypesByTypeName[Self.name] = Self;

    if (proc.returnTypeId !== "2249") {
      // Does not return a `RECORD` type
      return fields;
    }

    const argModesWithOutput = [
      "o", // OUT,
      "b", // INOUT
      "t", // TABLE
    ];
    const outputArgNames = proc.argTypeIds.reduce((prev, _, idx) => {
      if (argModesWithOutput.includes(proc.argModes[idx])) {
        prev.push(proc.argNames[idx] || "");
      }
      return prev;
    }, []);
    const outputArgTypes = proc.argTypeIds.reduce((prev, typeId, idx) => {
      if (argModesWithOutput.includes(proc.argModes[idx])) {
        prev.push(introspectionResultsByKind.typeById[typeId]);
      }
      return prev;
    }, []);

    const outputArgByFieldName = outputArgNames.reduce(
      (memo, outputArgName, idx) => {
        const fieldName = inflection.functionOutputFieldName(
          proc,
          outputArgName,
          idx + 1
        );
        if (memo[fieldName]) {
          throw new Error(
            `Tried to register field name '${fieldName}' twice in '${describePgEntity(
              proc
            )}'; the argument names are too similar.`
          );
        }
        memo[fieldName] = {
          name: outputArgName,
          type: outputArgTypes[idx],
        };
        return memo;
      },
      {}
    );

    const outputArgFields = Object.entries(outputArgByFieldName).reduce(
      (memo, [fieldName, outputArg]) => {
        const fieldType = pgGetGqlTypeByTypeIdAndModifier(
          outputArg.type.id,
          null
        );
        if (!fieldType) {
          return memo;
        }
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

      const outputArg = outputArgByFieldName[fieldName];

      const sqlFragments = Object.entries(fieldValue)
        .map(([operatorName, input]) => {
          const sqlIdentifier = sql.query`${sourceAlias}.${sql.identifier(
            outputArg.name
          )}`;
          return resolveWhereComparison(
            sqlIdentifier,
            operatorName,
            input,
            outputArg.type,
            outputArg.typeModifier,
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

    for (const fieldName of Object.keys(outputArgByFieldName)) {
      connectionFilterFieldResolversByTypeNameAndFieldName[Self.name] = {
        ...connectionFilterFieldResolversByTypeNameAndFieldName[Self.name],
        [fieldName]: resolve,
      };
    }

    return extend(fields, outputArgFields);
  });
};
