import type { Plugin } from "graphile-build";
import type { PgAttribute } from "graphile-build-pg";
import { ConnectionFilterResolver } from "./PgConnectionArgFilterPlugin";

const PgConnectionArgFilterColumnsPlugin: Plugin = (builder) => {
  builder.hook("GraphQLInputObjectType:fields", (fields, build, context) => {
    const {
      extend,
      newWithHooks,
      pgSql: sql,
      pgIntrospectionResultsByKind: introspectionResultsByKind,
      pgColumnFilter,
      pgOmit: omit,
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

    const attrByFieldName = (introspectionResultsByKind.attribute as PgAttribute[])
      .filter((attr) => attr.classId === table.id)
      .filter((attr) => pgColumnFilter(attr, build, context))
      .filter((attr) => !omit(attr, "filter"))
      .reduce((memo: { [fieldName: string]: PgAttribute }, attr) => {
        const fieldName: string = inflection.column(attr);
        memo[fieldName] = attr;
        return memo;
      }, {});

    const operatorsTypeNameByFieldName: { [fieldName: string]: string } = {};

    const attrFields = Object.entries(attrByFieldName).reduce(
      (memo, [fieldName, attr]) => {
        const OperatorsType = connectionFilterOperatorsType(
          newWithHooks,
          attr.typeId,
          attr.typeModifier
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

    const resolve: ConnectionFilterResolver = ({
      sourceAlias,
      fieldName,
      fieldValue,
      queryBuilder,
    }) => {
      if (fieldValue == null) return null;

      const attr = attrByFieldName[fieldName];
      const sqlIdentifier = sql.query`${sourceAlias}.${sql.identifier(
        attr.name
      )}`;
      const pgType = attr.type;
      const pgTypeModifier = attr.typeModifier;
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

    for (const fieldName of Object.keys(attrFields)) {
      connectionFilterRegisterResolver(Self.name, fieldName, resolve);
    }

    return extend(fields, attrFields);
  });
};

export default PgConnectionArgFilterColumnsPlugin;
