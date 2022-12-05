import { listOfType, PgConditionStep } from "@dataplan/pg";
import { PgConditionLikeStep } from "@dataplan/pg";
import { PgTypeCodec, TYPES } from "@dataplan/pg";
import {
  ExecutableStep,
  GraphileInputFieldConfigMap,
  InputStep,
  lambda,
  list,
} from "grafast";
import { GraphQLFieldConfigMap, GraphQLInputType, GraphQLType } from "graphql";
import { PgType } from "pg-introspection";
import { SQL } from "pg-sql2";
import { OperatorsCategory } from "./interfaces";

const { version } = require("../package.json");

const textArrayCodec = listOfType(TYPES.text);

export const PgConnectionArgFilterOperatorsPlugin: GraphileConfig.Plugin = {
  name: "PgConnectionArgFilterOperatorsPlugin",
  version,

  schema: {
    hooks: {
      GraphQLInputObjectType_fields(fields, build, context) {
        const {
          extend,
          graphql: {
            getNamedType,
            GraphQLBoolean,
            GraphQLString,
            GraphQLNonNull,
            GraphQLList,
            isNamedType,
          },
          sql,
          escapeLikeWildcards,
          options: {
            connectionFilterAllowedOperators,
            connectionFilterOperatorNames,
          },
        } = build;

        const {
          scope: {
            pgConnectionFilterOperators,
            /*
            pgConnectionFilterOperatorsCategory,
            fieldType,
            fieldInputType,
            rangeElementInputType,
            domainBaseType,
            */
          },
          fieldWithHooks,
          Self,
        } = context;

        if (
          !pgConnectionFilterOperators
          /*
          ||
          !pgConnectionFilterOperatorsCategory ||
          !fieldType ||
          !isNamedType(fieldType) ||
          !fieldInputType
          */
        ) {
          return fields;
        }

        const resolveListType = (fieldInputType: GraphQLInputType) =>
          new GraphQLList(new GraphQLNonNull(fieldInputType));
        const resolveListSqlValue = (
          $placeholderable: PlaceholderableStep,
          $input: InputStep,
          codec: PgTypeCodec<any, any, any, any>
        ) => $placeholderable.placeholder($input, listOfType(codec));

        const standardOperators: { [fieldName: string]: OperatorSpec } = {
          isNull: {
            description:
              "Is null (if `true` is specified) or is not null (if `false` is specified).",
            resolveType: () => GraphQLBoolean,
            resolveSqlValue: () => sql.null, // do not parse
            resolve: (i, _v, $input) =>
              sql`${i} ${$input.eval() ? sql`IS NULL` : sql`IS NOT NULL`}`,
          },
          equalTo: {
            description: "Equal to the specified value.",
            resolve: (i, v) => sql`${i} = ${v}`,
          },
          notEqualTo: {
            description: "Not equal to the specified value.",
            resolve: (i, v) => sql`${i} <> ${v}`,
          },
          distinctFrom: {
            description:
              "Not equal to the specified value, treating null like an ordinary value.",
            resolve: (i, v) => sql`${i} IS DISTINCT FROM ${v}`,
          },
          notDistinctFrom: {
            description:
              "Equal to the specified value, treating null like an ordinary value.",
            resolve: (i, v) => sql`${i} IS NOT DISTINCT FROM ${v}`,
          },
          in: {
            description: "Included in the specified list.",
            resolveType: resolveListType,
            resolveSqlValue: resolveListSqlValue,
            resolve: (i, v) => sql`${i} = ANY(${v})`,
          },
          notIn: {
            description: "Not included in the specified list.",
            resolveType: resolveListType,
            resolveSqlValue: resolveListSqlValue,
            resolve: (i, v) => sql`${i} <> EVERY(${v})`,
          },
        };
        const sortOperators: { [fieldName: string]: OperatorSpec } = {
          lessThan: {
            description: "Less than the specified value.",
            resolve: (i, v) => sql`${i} < ${v}`,
          },
          lessThanOrEqualTo: {
            description: "Less than or equal to the specified value.",
            resolve: (i, v) => sql`${i} <= ${v}`,
          },
          greaterThan: {
            description: "Greater than the specified value.",
            resolve: (i, v) => sql`${i} > ${v}`,
          },
          greaterThanOrEqualTo: {
            description: "Greater than or equal to the specified value.",
            resolve: (i, v) => sql`${i} >= ${v}`,
          },
        };
        const patternMatchingOperators: { [fieldName: string]: OperatorSpec } =
          {
            includes: {
              description: "Contains the specified string (case-sensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}%`,
              resolve: (i, v) => sql`${i} LIKE ${v}`,
            },
            notIncludes: {
              description:
                "Does not contain the specified string (case-sensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}%`,
              resolve: (i, v) => sql`${i} NOT LIKE ${v}`,
            },
            includesInsensitive: {
              description: "Contains the specified string (case-insensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}%`,
              resolveSqlIdentifier: (i) => i, // avoid casting citext to text
              resolve: (i, v) => sql`${i} ILIKE ${v}`,
            },
            notIncludesInsensitive: {
              description:
                "Does not contain the specified string (case-insensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}%`,
              resolveSqlIdentifier: (i) => i, // avoid casting citext to text
              resolve: (i, v) => sql`${i} NOT ILIKE ${v}`,
            },
            startsWith: {
              description: "Starts with the specified string (case-sensitive).",
              resolveInput: (input) => `${escapeLikeWildcards(input)}%`,
              resolve: (i, v) => sql`${i} LIKE ${v}`,
            },
            notStartsWith: {
              description:
                "Does not start with the specified string (case-sensitive).",
              resolveInput: (input) => `${escapeLikeWildcards(input)}%`,
              resolve: (i, v) => sql`${i} NOT LIKE ${v}`,
            },
            startsWithInsensitive: {
              description:
                "Starts with the specified string (case-insensitive).",
              resolveInput: (input) => `${escapeLikeWildcards(input)}%`,
              resolveSqlIdentifier: (i) => i, // avoid casting citext to text
              resolve: (i, v) => sql`${i} ILIKE ${v}`,
            },
            notStartsWithInsensitive: {
              description:
                "Does not start with the specified string (case-insensitive).",
              resolveInput: (input) => `${escapeLikeWildcards(input)}%`,
              resolveSqlIdentifier: (i) => i, // avoid casting citext to text
              resolve: (i, v) => sql`${i} NOT ILIKE ${v}`,
            },
            endsWith: {
              description: "Ends with the specified string (case-sensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}`,
              resolve: (i, v) => sql`${i} LIKE ${v}`,
            },
            notEndsWith: {
              description:
                "Does not end with the specified string (case-sensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}`,
              resolve: (i, v) => sql`${i} NOT LIKE ${v}`,
            },
            endsWithInsensitive: {
              description: "Ends with the specified string (case-insensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}`,
              resolveSqlIdentifier: (i) => i, // avoid casting citext to text
              resolve: (i, v) => sql`${i} ILIKE ${v}`,
            },
            notEndsWithInsensitive: {
              description:
                "Does not end with the specified string (case-insensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}`,
              resolveSqlIdentifier: (i) => i, // avoid casting citext to text
              resolve: (i, v) => sql`${i} NOT ILIKE ${v}`,
            },
            like: {
              description:
                "Matches the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
              resolve: (i, v) => sql`${i} LIKE ${v}`,
            },
            notLike: {
              description:
                "Does not match the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
              resolve: (i, v) => sql`${i} NOT LIKE ${v}`,
            },
            likeInsensitive: {
              description:
                "Matches the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
              resolveSqlIdentifier: (i) => i, // avoid casting citext to text
              resolve: (i, v) => sql`${i} ILIKE ${v}`,
            },
            notLikeInsensitive: {
              description:
                "Does not match the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
              resolveSqlIdentifier: (i) => i, // avoid casting citext to text
              resolve: (i, v) => sql`${i} NOT ILIKE ${v}`,
            },
          };
        const hstoreOperators: { [fieldName: string]: OperatorSpec } = {
          contains: {
            description: "Contains the specified KeyValueHash.",
            resolve: (i, v) => sql`${i} @> ${v}`,
          },
          containsKey: {
            description: "Contains the specified key.",
            resolveType: () => GraphQLString,
            resolveSqlValue: ($placeholderable, $input, codec) =>
              sql`(${$placeholderable.placeholder($input, codec)})::text`,
            resolve: (i, v) => sql`${i} ? ${v}`,
          },
          containsAllKeys: {
            name: "containsAllKeys",
            description: "Contains all of the specified keys.",
            resolveType: () =>
              new GraphQLList(new GraphQLNonNull(GraphQLString)),
            resolveSqlValue: ($placeholderable, $input, codec) =>
              $placeholderable.placeholder($input, textArrayCodec),
            resolve: (i, v) => sql`${i} ?& ${v}`,
          },
          containsAnyKeys: {
            name: "containsAnyKeys",
            description: "Contains any of the specified keys.",
            resolveType: () =>
              new GraphQLList(new GraphQLNonNull(GraphQLString)),
            resolveSqlValue: ($placeholderable, $input, codec) =>
              $placeholderable.placeholder($input, textArrayCodec),
            resolve: (i, v) => sql`${i} ?| ${v}`,
          },
          containedBy: {
            description: "Contained by the specified KeyValueHash.",
            resolve: (i, v) => sql`${i} <@ ${v}`,
          },
        };
        const jsonbOperators: { [fieldName: string]: OperatorSpec } = {
          contains: {
            description: "Contains the specified JSON.",
            resolve: (i, v) => sql`${i} @> ${v}`,
          },
          containsKey: {
            description: "Contains the specified key.",
            resolveType: () => GraphQLString,
            resolveSqlValue: ($placeholderable, $input, codec) =>
              sql`(${$placeholderable.placeholder($input, codec)})::text`,
            resolve: (i, v) => sql`${i} ? ${v}`,
          },
          containsAllKeys: {
            name: "containsAllKeys",
            description: "Contains all of the specified keys.",
            resolveType: () =>
              new GraphQLList(new GraphQLNonNull(GraphQLString)),
            resolveSqlValue: ($placeholderable, $input, codec) =>
              $placeholderable.placeholder($input, textArrayCodec),
            resolve: (i, v) => sql`${i} ?& ${v}`,
          },
          containsAnyKeys: {
            name: "containsAnyKeys",
            description: "Contains any of the specified keys.",
            resolveType: () =>
              new GraphQLList(new GraphQLNonNull(GraphQLString)),
            resolveSqlValue: ($placeholderable, $input, codec) =>
              $placeholderable.placeholder($input, textArrayCodec),
            resolve: (i, v) => sql`${i} ?| ${v}`,
          },
          containedBy: {
            description: "Contained by the specified JSON.",
            resolve: (i, v) => sql`${i} <@ ${v}`,
          },
        };
        const inetOperators: { [fieldName: string]: OperatorSpec } = {
          contains: {
            description: "Contains the specified internet address.",
            resolve: (i, v) => sql`${i} >> ${v}`,
          },
          containsOrEqualTo: {
            description: "Contains or equal to the specified internet address.",
            resolve: (i, v) => sql`${i} >>= ${v}`,
          },
          containedBy: {
            description: "Contained by the specified internet address.",
            resolve: (i, v) => sql`${i} << ${v}`,
          },
          containedByOrEqualTo: {
            description:
              "Contained by or equal to the specified internet address.",
            resolve: (i, v) => sql`${i} <<= ${v}`,
          },
          containsOrContainedBy: {
            description:
              "Contains or contained by the specified internet address.",
            resolve: (i, v) => sql`${i} && ${v}`,
          },
        };

        const insensitiveOperators: { [fieldName: string]: OperatorSpec } = {};

        /**
         * This block adds the following operators:
         * - distinctFromInsensitive
         * - equalToInsensitive
         * - greaterThanInsensitive
         * - greaterThanOrEqualToInsensitive
         * - inInsensitive
         * - lessThanInsensitive
         * - lessThanOrEqualToInsensitive
         * - notDistinctFromInsensitive
         * - notEqualToInsensitive
         * - notInInsensitive
         *
         * The compiled SQL depends on the underlying PostgreSQL column type.
         * Using case-insensitive operators with `text`/`varchar`/`char` columns
         * will result in calling `lower()` on the operands. Using case-sensitive
         * operators with `citext` columns will result in casting the operands to `text`.
         *
         * For example, here is how the `equalTo`/`equalToInsensitive` operators compile to SQL:
         * | GraphQL operator   | PostgreSQL column type  | Compiled SQL               |
         * | ------------------ | ----------------------- | -------------------------- |
         * | equalTo            | `text`/`varchar`/`char` | `<col> = $1`               |
         * | equalTo            | `citext`                | `<col>::text = $1::text`   |
         * | equalToInsensitive | `text`/`varchar`/`char` | `lower(<col>) = lower($1)` |
         * | equalToInsensitive | `citext`                | `<col> = $1`               |
         */
        for (const [name, spec] of [
          ...Object.entries(standardOperators),
          ...Object.entries(sortOperators),
        ]) {
          if (name == "isNull") continue;

          const description = `${spec.description.substring(
            0,
            spec.description.length - 1
          )} (case-insensitive).`;

          const resolveSqlIdentifier = (
            sourceAlias: SQL,
            codec: PgTypeCodec<any, any, any, any>
          ) =>
            codec === TYPES.citext
              ? sourceAlias // already case-insensitive, so no need to call `lower()`
              : sql`lower(${sourceAlias})`;

          const resolveSqlValue = (
            $placeholderable: PlaceholderableStep,
            $input: InputStep,
            codec: PgTypeCodec<any, any, any, any>
          ) => {
            if (name === "in" || name === "notIn") {
              const sqlList = resolveListSqlValue(
                $placeholderable,
                $input,
                codec
              );
              if (codec === TYPES.citext) {
                // already case-insensitive, so no need to call `lower()`
                return sqlList;
              } else {
                return sql`(select array_agg(lower(t)) from unnest(${sqlList}) t)`;
              }
            } else {
              if (codec === TYPES.citext) {
                // already case-insensitive, so no need to call `lower()`
                return $placeholderable.placeholder($input, codec);
              } else {
                return sql`lower(${$placeholderable.placeholder(
                  $input,
                  codec
                )})`;
              }
            }
          };

          insensitiveOperators[`${name}Insensitive`] = {
            ...spec,
            description,
            resolveSqlIdentifier,
            resolveSqlValue,
          };
        }

        const connectionFilterEnumOperators = {
          ...standardOperators,
          ...sortOperators,
        };

        const connectionFilterRangeOperators: {
          [fieldName: string]: OperatorSpec;
        } = {
          ...standardOperators,
          ...sortOperators,
          contains: {
            description: "Contains the specified range.",
            resolve: (i, v) => sql`${i} @> ${v}`,
          },
          containsElement: {
            description: "Contains the specified value.",
            resolveType: (_fieldInputType, rangeElementInputType) => {
              if (!rangeElementInputType) {
                throw new Error(
                  `Couldn't determine the range element type to use`
                );
              }
              return rangeElementInputType;
            },
            resolveSqlValue: ($placeholderable, $input, codec) => {
              const innerCodec = codec.rangeOfCodec;
              return $placeholderable.placeholder($input, innerCodec!);
            },
            resolve: (i, v) => sql`${i} @> ${v}`,
          },
          containedBy: {
            description: "Contained by the specified range.",
            resolve: (i, v) => sql`${i} <@ ${v}`,
          },
          overlaps: {
            description: "Overlaps the specified range.",
            resolve: (i, v) => sql`${i} && ${v}`,
          },
          strictlyLeftOf: {
            description: "Strictly left of the specified range.",
            resolve: (i, v) => sql`${i} << ${v}`,
          },
          strictlyRightOf: {
            description: "Strictly right of the specified range.",
            resolve: (i, v) => sql`${i} >> ${v}`,
          },
          notExtendsRightOf: {
            description: "Does not extend right of the specified range.",
            resolve: (i, v) => sql`${i} &< ${v}`,
          },
          notExtendsLeftOf: {
            description: "Does not extend left of the specified range.",
            resolve: (i, v) => sql`${i} &> ${v}`,
          },
          adjacentTo: {
            description: "Adjacent to the specified range.",
            resolve: (i, v) => sql`${i} -|- ${v}`,
          },
        };

        const resolveArrayItemType = (fieldInputType: GraphQLInputType) =>
          getNamedType(fieldInputType);
        const resolveArrayItemSqlValue = (
          $placeholderable: PlaceholderableStep,
          $input: InputStep,
          codec: PgTypeCodec<any, any, any, any>
        ) => $placeholderable.placeholder($input, codec.arrayOfCodec);

        const connectionFilterArrayOperators: {
          [fieldName: string]: OperatorSpec;
        } = {
          isNull: standardOperators.isNull,
          equalTo: standardOperators.equalTo,
          notEqualTo: standardOperators.notEqualTo,
          distinctFrom: standardOperators.distinctFrom,
          notDistinctFrom: standardOperators.notDistinctFrom,
          ...sortOperators,
          contains: {
            description: "Contains the specified list of values.",
            resolve: (i, v) => sql`${i} @> ${v}`,
          },
          containedBy: {
            description: "Contained by the specified list of values.",
            resolve: (i, v) => sql`${i} <@ ${v}`,
          },
          overlaps: {
            description: "Overlaps the specified list of values.",
            resolve: (i, v) => sql`${i} && ${v}`,
          },
          anyEqualTo: {
            description: "Any array item is equal to the specified value.",
            resolveType: resolveArrayItemType,
            resolveSqlValue: resolveArrayItemSqlValue,
            resolve: (i, v) => sql`${v} = ANY (${i})`,
          },
          anyNotEqualTo: {
            description: "Any array item is not equal to the specified value.",
            resolveType: resolveArrayItemType,
            resolveSqlValue: resolveArrayItemSqlValue,
            resolve: (i, v) => sql`${v} <> ANY (${i})`,
          },
          anyLessThan: {
            description: "Any array item is less than the specified value.",
            resolveType: resolveArrayItemType,
            resolveSqlValue: resolveArrayItemSqlValue,
            resolve: (i, v) => sql`${v} > ANY (${i})`,
          },
          anyLessThanOrEqualTo: {
            description:
              "Any array item is less than or equal to the specified value.",
            resolveType: resolveArrayItemType,
            resolveSqlValue: resolveArrayItemSqlValue,
            resolve: (i, v) => sql`${v} >= ANY (${i})`,
          },
          anyGreaterThan: {
            description: "Any array item is greater than the specified value.",
            resolveType: resolveArrayItemType,
            resolveSqlValue: resolveArrayItemSqlValue,
            resolve: (i, v) => sql`${v} < ANY (${i})`,
          },
          anyGreaterThanOrEqualTo: {
            description:
              "Any array item is greater than or equal to the specified value.",
            resolveType: resolveArrayItemType,
            resolveSqlValue: resolveArrayItemSqlValue,
            resolve: (i, v) => sql`${v} <= ANY (${i})`,
          },
        };

        /*
        const gqlTypeNameFromPgCodec = (
          codec: PgTypeCodec<any, any, any, any>
        ) => build.getGraphQLTypeNameByPgCodec!(codec, "input");

        const _BigFloat = gqlTypeNameFromPgCodec(TYPES.numeric) || "BigFloat";
        const _BigInt = gqlTypeNameFromPgCodec(TYPES.bigint) || "BigInt";
        const _BitString = gqlTypeNameFromPgCodec(TYPES.varbit) || "BitString";
        const _Boolean = gqlTypeNameFromPgCodec(TYPES.boolean) || "Boolean";
        const _CidrAddress =
          gqlTypeNameFromPgCodec(TYPES.cidr) || "CidrAddress";
        const _Date = gqlTypeNameFromPgCodec(TYPES.date) || "Date";
        const _Datetime = gqlTypeNameFromPgCodec(TYPES.timestamp) || "Datetime";
        const _Float = gqlTypeNameFromPgCodec(TYPES.float4) || "Float";
        const _Int = gqlTypeNameFromPgCodec(TYPES.int2) || "Int";
        const _InternetAddress =
          gqlTypeNameFromPgCodec(TYPES.inet) || "InternetAddress";
        const _Interval = gqlTypeNameFromPgCodec(TYPES.interval) || "Interval";
        const _JSON = gqlTypeNameFromPgCodec(TYPES.jsonb) || "JSON";
        const _KeyValueHash =
          gqlTypeNameFromPgCodec(TYPES.hstore) || "KeyValueHash";
        const _MacAddress =
          gqlTypeNameFromPgCodec(TYPES.macaddr) || "MacAddress";
        const _MacAddress8 =
          gqlTypeNameFromPgCodec(TYPES.macaddr8) || "MacAddress8";
        const _String = gqlTypeNameFromPgCodec(TYPES.text) || "String";
        const _Time = gqlTypeNameFromPgCodec(TYPES.time) || "Time";
        const _UUID = gqlTypeNameFromPgCodec(TYPES.uuid) || "UUID";

        const connectionFilterScalarOperators = {
          [_BigFloat]: { ...standardOperators, ...sortOperators },
          [_BigInt]: { ...standardOperators, ...sortOperators },
          [_BitString]: { ...standardOperators, ...sortOperators },
          [_Boolean]: { ...standardOperators, ...sortOperators },
          [_CidrAddress]: {
            ...standardOperators,
            ...sortOperators,
            ...inetOperators,
          },
          [_Date]: { ...standardOperators, ...sortOperators },
          [_Datetime]: { ...standardOperators, ...sortOperators },
          [_Float]: { ...standardOperators, ...sortOperators },
          [_Int]: { ...standardOperators, ...sortOperators },
          [_InternetAddress]: {
            ...standardOperators,
            ...sortOperators,
            ...inetOperators,
          },
          [_Interval]: { ...standardOperators, ...sortOperators },
          [_JSON]: {
            ...standardOperators,
            ...sortOperators,
            ...jsonbOperators,
          },
          [_KeyValueHash]: {
            ...standardOperators,
            ...hstoreOperators,
          },
          [_MacAddress]: {
            ...standardOperators,
            ...sortOperators,
          },
          [_MacAddress8]: {
            ...standardOperators,
            ...sortOperators,
          },
          [_String]: {
            ...standardOperators,
            ...sortOperators,
            ...patternMatchingOperators,
            ...insensitiveOperators,
          },
          [_Time]: { ...standardOperators, ...sortOperators },
          [_UUID]: { ...standardOperators, ...sortOperators },
        };

        const operatorSpecsByCategory: {
          [category in OperatorsCategory]: {
            [fieldName: string]: OperatorSpec;
          };
        } = {
          Array: connectionFilterArrayOperators,
          Range: connectionFilterRangeOperators,
          Enum: connectionFilterEnumOperators,
          Domain: {},
            //domainBaseType && isNamedType(domainBaseType)
              //? connectionFilterScalarOperators[domainBaseType.name]
              //: {},
          Scalar: connectionFilterScalarOperators[fieldType.name],
        };
        const operatorSpecs =
          operatorSpecsByCategory[pgConnectionFilterOperatorsCategory];
        if (!operatorSpecs) {
          return fields;
        }

        const operatorSpecByFieldName: { [fieldName: string]: OperatorSpec } =
          {};
        */
        const {
          inputTypeName,
          rangeElementInputTypeName,
          //domainBaseTypeName,
          //pgCodecs
        } = pgConnectionFilterOperators;

        const rangeElementInputType = rangeElementInputTypeName
          ? (build.getTypeByName(rangeElementInputTypeName) as
              | GraphQLInputType
              | undefined)
          : null;
        const fieldInputType = build.getTypeByName(inputTypeName) as
          | GraphQLInputType
          | undefined;

        const operatorSpecs: {
          [fieldName: string]: OperatorSpec;
        } = {
          // TODO: Bring in the RIGHT OPERATORS here
          ...standardOperators,
        };

        const operatorFields = Object.entries(operatorSpecs).reduce(
          (memo: { [fieldName: string]: any }, [name, spec]) => {
            const {
              description,
              resolveType,
              resolve,
              resolveInput,
              resolveSql,
              resolveSqlIdentifier,
              resolveSqlValue,
            } = spec;

            if (
              connectionFilterAllowedOperators &&
              !connectionFilterAllowedOperators.includes(name)
            ) {
              return memo;
            }
            if (!fieldInputType) {
              return memo;
            }
            const type = resolveType
              ? resolveType(fieldInputType, rangeElementInputType)
              : fieldInputType;

            const operatorName =
              (connectionFilterOperatorNames &&
                connectionFilterOperatorNames[name]) ||
              name;

            memo[operatorName] = fieldWithHooks(
              {
                fieldName: operatorName,
                isPgConnectionFilterOperator: true,
              },
              {
                description,
                type,
                applyPlan($where: PgConditionStep<any>, fieldArgs) {
                  if (!$where.extensions?.pgFilterColumn) {
                    throw new Error(`Planning error`);
                  }
                  const { columnName, column } =
                    $where.extensions.pgFilterColumn;

                  const sourceAlias = column.expression
                    ? column.expression($where.alias)
                    : sql`${$where.alias}.${sql.identifier(columnName)}`;
                  const sqlIdentifier = resolveSqlIdentifier
                    ? resolveSqlIdentifier(sourceAlias, column.codec)
                    : column.codec === TYPES.citext
                    ? sql.query`${sourceAlias}::text` // cast column to text for case-sensitive matching
                    : column.codec.arrayOfCodec === TYPES.citext
                    ? sql.query`${sourceAlias}::text[]` // cast column to text[] for case-sensitive matching
                    : sourceAlias;

                  const $input = fieldArgs.getRaw();
                  const $resolvedInput = resolveInput
                    ? lambda($input, resolveInput)
                    : $input;

                  const sqlValue = resolveSqlValue
                    ? resolveSqlValue($where, $input, column.codec)
                    : column.codec === TYPES.citext
                    ? $where.placeholder($resolvedInput, TYPES.text) // cast input to text
                    : column.codec.arrayOfCodec === TYPES.citext
                    ? $where.placeholder(
                        $resolvedInput,
                        listOfType(TYPES.citext)
                      ) // cast input to text[]
                    : $where.placeholder($resolvedInput, column.codec);

                  const fragment = resolve(
                    sqlIdentifier,
                    sqlValue,
                    $input,
                    $where
                  );
                  $where.where(fragment);
                },
                // TODO: applyPlan
              }
            );
            return memo;
          },
          Object.create(null) as GraphileInputFieldConfigMap<any, any>
        );

        return extend(fields, operatorFields, "");
      },
    },
  },
};

type PlaceholderableStep = {
  placeholder(
    step: ExecutableStep,
    codec: PgTypeCodec<any, any, any, any>
  ): SQL;
};

export interface OperatorSpec {
  name?: string;
  description: string;
  resolveType?: (
    fieldInputType: GraphQLInputType,
    rangeElementInputType: GraphQLInputType | null | undefined
  ) => GraphQLType;
  resolveSqlIdentifier?: (
    sqlIdentifier: SQL,
    codec: PgTypeCodec<any, any, any, any>
  ) => SQL;
  resolveInput?: (input: unknown) => unknown;
  resolveSql?: any;
  resolveSqlValue?: (
    $placeholderable: PlaceholderableStep,
    $input: InputStep,
    codec: PgTypeCodec<any, any, any, any>
    // UNUSED? resolveListItemSqlValue?: any
  ) => SQL;
  resolve: (
    sqlIdentifier: SQL,
    sqlValue: SQL,
    $input: InputStep,
    $placeholderable: PlaceholderableStep
  ) => SQL;
}
