import type { Plugin } from "graphile-build";
import type { PgClass, PgProc, PgType } from "graphile-build-pg";
import { ConnectionFilterResolver } from "./PgConnectionArgFilterPlugin";
import camelCase from "camelcase";

const PgConnectionArgFilterComputedColumnsPlugin: Plugin = (
  builder,
  { connectionFilterComputedColumns }
) => {
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
      scope: { isPgConnectionFilter, pgIntrospection: table },
      fieldWithHooks,
      Self,
    } = context;

    if (!isPgConnectionFilter || !table || table.kind !== "class") {
      return fields;
    }

    connectionFilterTypesByTypeName[Self.name] = Self;

    let computedColumnNames: string[] = [];
    let argumentLists: { name: string; type: PgType }[][] = [];

    const procByFieldName = (
      introspectionResultsByKind.procedure as PgProc[]
    ).reduce((memo: { [fieldName: string]: PgProc }, proc) => {
      // Must be marked @filterable OR enabled via plugin option
      if (!(proc.tags.filterable || connectionFilterComputedColumns))
        return memo;

      // Must not be omitted
      if (omit(proc, "execute")) return memo;
      if (omit(proc, "filter")) return memo;

      // Must be a computed column
      const computedColumnDetails = getComputedColumnDetails(
        build,
        table,
        proc
      );
      if (!computedColumnDetails) return memo;

      // Must return a scalar or an array
      if (proc.returnsSet) return memo;
      const returnType = introspectionResultsByKind.typeById[proc.returnTypeId];
      const returnTypeTable =
        introspectionResultsByKind.classById[returnType.classId];
      if (returnTypeTable) return memo;
      const isRecordLike = returnType.id === "2249";
      if (isRecordLike) return memo;
      const isVoid = String(returnType.id) === "2278";
      if (isVoid) return memo;

      // Looks good
      const { argNames, argTypes, pseudoColumnName } = computedColumnDetails;
      const fieldName = inflection.computedColumn(
        pseudoColumnName,
        proc,
        table
      );

      const args: { name: string; type: PgType }[] = [];
      // The first argument is of table type. It is not exposed to the schema.
      for (let i = 1; i < argNames.length; i++) {
        args.push({
          name: camelCase(argNames[i]),
          type: argTypes[i],
        });
      }

      computedColumnNames.push(pseudoColumnName);
      argumentLists.push(args);

      memo = build.extend(memo, { [fieldName]: proc });
      return memo;
    }, {});

    const operatorsTypeNameByFieldName: { [fieldName: string]: string } = {};

    const procFields = Object.entries(procByFieldName).reduce(
      (memo, [fieldName, proc], index) => {
        const hasArgsField: boolean = argumentLists[index].length >= 1;

        const computedColumnWithArgsDetails = hasArgsField
          ? {
              name: computedColumnNames[index],
              arguments: argumentLists[index],
            }
          : undefined;

        const OperatorsType = connectionFilterOperatorsType(
          newWithHooks,
          proc.returnTypeId,
          null,
          computedColumnWithArgsDetails
        );
        if (!OperatorsType) {
          return memo;
        }
        operatorsTypeNameByFieldName[fieldName] = OperatorsType.name;

        const createdField = fieldWithHooks(
          fieldName,
          {
            description: `Filter by the object’s \`${fieldName}\` field.`,
            type: OperatorsType,
          },
          {
            isPgConnectionFilterField: true,
          }
        );

        if (hasArgsField) {
          // The args field resolver doesn't do anything. The args are
          // handled in the resolver of the computed column (below).
          connectionFilterRegisterResolver(
            createdField.type.name,
            "args",
            () => null
          );
        }

        return extend(memo, {
          [fieldName]: createdField,
        });
      },
      {}
    );

    const resolve: ConnectionFilterResolver = ({
      sourceAlias,
      fieldName,
      fieldValue,
      queryBuilder,
    }) => {
      if (fieldValue == null) return null;

      const queryParameters: { [key: string]: any } = fieldValue;
      const providedArgs = queryParameters["args"];

      const proc = procByFieldName[fieldName];

      // Collect arguments of the computed column and add it
      // to the sql function arguments.
      let sqlFunctionArguments = [sql.fragment`${sourceAlias}`];
      // The first function argument (table type) is already set above.
      for (let i = 1; i < proc.argNames.length; i++) {
        const nameOfArgument = camelCase(proc.argNames[i]);
        const providedArgValue = providedArgs?.[nameOfArgument];
        if (providedArgValue === undefined)
          throw new Error(
            `The value for argument ${nameOfArgument} is missing.`
          );

        sqlFunctionArguments.push(sql.fragment`${sql.value(providedArgValue)}`);
      }

      const sqlIdentifier = sql.query`${sql.identifier(
        proc.namespace.name
      )}.${sql.identifier(proc.name)}(${sql.join(sqlFunctionArguments, ",")})`;
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

  function getComputedColumnDetails(build: any, table: PgClass, proc: PgProc) {
    if (!proc.isStable) return null;
    if (proc.namespaceId !== table.namespaceId) return null;
    if (!proc.name.startsWith(`${table.name}_`)) return null;
    if (proc.argTypeIds.length < 1) return null;
    if (proc.argTypeIds[0] !== table.type.id) return null;

    const argTypes = proc.argTypeIds.reduce((prev: PgType[], typeId, idx) => {
      if (
        proc.argModes.length === 0 || // all args are `in`
        proc.argModes[idx] === "i" || // this arg is `in`
        proc.argModes[idx] === "b" // this arg is `inout`
      ) {
        prev.push(build.pgIntrospectionResultsByKind.typeById[typeId]);
      }
      return prev;
    }, []);
    if (
      argTypes
        .slice(1)
        .some(
          (type) => type.type === "c" && type.class && type.class.isSelectable
        )
    ) {
      // Accepts two input tables? Skip.
      return null;
    }

    const argNames = proc.argNames;
    const pseudoColumnName = proc.name.substr(table.name.length + 1);
    return { argNames, argTypes, pseudoColumnName };
  }
};

export default PgConnectionArgFilterComputedColumnsPlugin;
