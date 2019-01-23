module.exports = function PgConnectionArgFilterRecordFunctionsPlugin(builder) {
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      newWithHooks,
      pgSql: sql,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      inflection,
      describePgEntity,
      connectionFilterOperatorsType,
      connectionFilterRegisterResolver,
      connectionFilterResolvePredicates,
      connectionFilterTypesByTypeName,
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
        const OperatorsType = connectionFilterOperatorsType(
          newWithHooks,
          outputArg.type.id,
          null
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

      const sqlIdentifier = sql.query`${sourceAlias}.${sql.identifier(
        outputArg.name
      )}`;
      const pgType = outputArg.type;
      const pgTypeModifier = outputArg.typeModifier;

      return connectionFilterResolvePredicates({
        sourceAlias,
        fieldName,
        fieldValue,
        queryBuilder,
        sqlIdentifier,
        pgType,
        pgTypeModifier,
      });
    };

    for (const fieldName of Object.keys(outputArgFields)) {
      connectionFilterRegisterResolver(Self.name, fieldName, resolve);
    }

    return extend(fields, outputArgFields);
  });
};
