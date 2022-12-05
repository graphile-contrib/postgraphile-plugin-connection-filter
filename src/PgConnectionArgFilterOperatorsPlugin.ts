import { isEnumCodec, listOfType, PgConditionStep } from "@dataplan/pg";
import { PgConditionLikeStep } from "@dataplan/pg";
import { PgTypeCodec, TYPES } from "@dataplan/pg";
import {
  ExecutableStep,
  GraphileInputFieldConfigMap,
  InputObjectFieldApplyPlanResolver,
  InputStep,
  lambda,
  list,
} from "grafast";
import {
  GraphQLFieldConfigMap,
  GraphQLInputType,
  GraphQLNamedType,
  GraphQLString,
  GraphQLType,
} from "graphql";
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

        /** Make CITEXT case sensitive */
        const resolveSqlIdentifierCaseSensitive = (
          i: SQL,
          c: PgTypeCodec<any, any, any, any>
        ) => {
          if (c === TYPES.citext) {
            return [i, TYPES.text] as const;
          } else {
            return [i, c] as const;
          }
        };

        const patternMatchingOperators: { [fieldName: string]: OperatorSpec } =
          {
            includes: {
              description: "Contains the specified string (case-sensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}%`,
              resolveSqlIdentifier: resolveSqlIdentifierCaseSensitive,
              resolve: (i, v) => sql`${i} LIKE ${v}`,
            },
            notIncludes: {
              description:
                "Does not contain the specified string (case-sensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}%`,
              resolveSqlIdentifier: resolveSqlIdentifierCaseSensitive,
              resolve: (i, v) => sql`${i} NOT LIKE ${v}`,
            },
            includesInsensitive: {
              description: "Contains the specified string (case-insensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}%`,
              resolve: (i, v) => sql`${i} ILIKE ${v}`,
            },
            notIncludesInsensitive: {
              description:
                "Does not contain the specified string (case-insensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}%`,
              resolve: (i, v) => sql`${i} NOT ILIKE ${v}`,
            },
            startsWith: {
              description: "Starts with the specified string (case-sensitive).",
              resolveInput: (input) => `${escapeLikeWildcards(input)}%`,
              resolveSqlIdentifier: resolveSqlIdentifierCaseSensitive,
              resolve: (i, v) => sql`${i} LIKE ${v}`,
            },
            notStartsWith: {
              description:
                "Does not start with the specified string (case-sensitive).",
              resolveInput: (input) => `${escapeLikeWildcards(input)}%`,
              resolveSqlIdentifier: resolveSqlIdentifierCaseSensitive,
              resolve: (i, v) => sql`${i} NOT LIKE ${v}`,
            },
            startsWithInsensitive: {
              description:
                "Starts with the specified string (case-insensitive).",
              resolveInput: (input) => `${escapeLikeWildcards(input)}%`,
              resolve: (i, v) => sql`${i} ILIKE ${v}`,
            },
            notStartsWithInsensitive: {
              description:
                "Does not start with the specified string (case-insensitive).",
              resolveInput: (input) => `${escapeLikeWildcards(input)}%`,
              resolve: (i, v) => sql`${i} NOT ILIKE ${v}`,
            },
            endsWith: {
              description: "Ends with the specified string (case-sensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}`,
              resolveSqlIdentifier: resolveSqlIdentifierCaseSensitive,
              resolve: (i, v) => sql`${i} LIKE ${v}`,
            },
            notEndsWith: {
              description:
                "Does not end with the specified string (case-sensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}`,
              resolveSqlIdentifier: resolveSqlIdentifierCaseSensitive,
              resolve: (i, v) => sql`${i} NOT LIKE ${v}`,
            },
            endsWithInsensitive: {
              description: "Ends with the specified string (case-insensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}`,
              resolve: (i, v) => sql`${i} ILIKE ${v}`,
            },
            notEndsWithInsensitive: {
              description:
                "Does not end with the specified string (case-insensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}`,
              resolve: (i, v) => sql`${i} NOT ILIKE ${v}`,
            },
            like: {
              description:
                "Matches the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
              resolve: (i, v) => sql`${i} LIKE ${v}`,
              resolveSqlIdentifier: resolveSqlIdentifierCaseSensitive,
            },
            notLike: {
              description:
                "Does not match the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
              resolve: (i, v) => sql`${i} NOT LIKE ${v}`,
              resolveSqlIdentifier: resolveSqlIdentifierCaseSensitive,
            },
            likeInsensitive: {
              description:
                "Matches the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
              resolve: (i, v) => sql`${i} ILIKE ${v}`,
            },
            notLikeInsensitive: {
              description:
                "Does not match the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
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
              ? ([sourceAlias, codec] as const) // already case-insensitive, so no need to call `lower()`
              : ([sql`lower(${sourceAlias})`, codec] as const);

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

        const {
          inputTypeName,
          rangeElementInputTypeName,
          //domainBaseTypeName,
          pgCodecs,
        } = pgConnectionFilterOperators;

        const rangeElementInputType = rangeElementInputTypeName
          ? (build.getTypeByName(rangeElementInputTypeName) as
              | GraphQLInputType
              | undefined)
          : null;
        const fieldInputType = build.getTypeByName(inputTypeName) as
          | GraphQLInputType
          | undefined;

        let textLike = true;
        let sortable = true;
        let inetLike = true;
        let jsonLike = true;
        let hstoreLike = true;
        let arrayLike = true;
        let rangeLike = true;
        let enumLike = true;
        for (const codec of pgCodecs) {
          let underlyingType = codec.domainOfCodec ?? codec;
          if (!underlyingType.arrayOfCodec) {
            arrayLike = false;
          }
          if (!underlyingType.rangeOfCodec) {
            rangeLike = false;
          }
          if (!isEnumCodec(underlyingType)) {
            enumLike = false;
          }
          switch (underlyingType) {
            case TYPES.numeric:
            case TYPES.float:
            case TYPES.float4:
            case TYPES.bigint:
            case TYPES.int:
            case TYPES.int2:

            case TYPES.boolean:

            case TYPES.date:
            case TYPES.timestamp:
            case TYPES.timestamptz:
            case TYPES.time:
            case TYPES.timetz:
            case TYPES.interval:

            case TYPES.json:
            case TYPES.jsonb:

            case TYPES.cidr:
            case TYPES.inet:
            case TYPES.macaddr:
            case TYPES.macaddr8:

            case TYPES.text:
            case TYPES.varchar:
            case TYPES.char:
            case TYPES.bpchar:

            case TYPES.uuid: {
              // Sort is fine
              break;
            }
            default: {
              // NOT SORTABLE!
              sortable = false;
            }
          }

          switch (underlyingType) {
            case TYPES.cidr:
            case TYPES.inet:
            case TYPES.macaddr:
            case TYPES.macaddr8: {
              // Inet is fine
              break;
            }
            default: {
              // NOT INET!
              inetLike = false;
            }
          }

          switch (underlyingType) {
            case TYPES.text:
            case TYPES.varchar:
            case TYPES.char:
            case TYPES.bpchar: {
              // Text
              break;
            }
            default: {
              // NOT TEXT!
              textLike = false;
            }
          }

          switch (underlyingType) {
            case TYPES.json:
            case TYPES.jsonb: {
              // JSON
              break;
            }
            default: {
              // NOT JSON!
              jsonLike = false;
            }
          }

          switch (underlyingType) {
            case TYPES.hstore: {
              // HSTORE
              break;
            }
            default: {
              // NOT HSTORE!
              hstoreLike = false;
            }
          }

          /*
          switch (underlyingType) {
            case TYPES.numeric:
            case TYPES.float:
            case TYPES.float4:
            case TYPES.bigint:
            case TYPES.int:
            case TYPES.int2:

            case TYPES.boolean:

            case TYPES.varbit:
            case TYPES.bit:

            case TYPES.date:
            case TYPES.timestamp:
            case TYPES.timestamptz:
            case TYPES.time:
            case TYPES.timetz:
            case TYPES.interval:

            case TYPES.json:
            case TYPES.jsonb:

            case TYPES.hstore:

            case TYPES.cidr:
            case TYPES.inet:
            case TYPES.macaddr:
            case TYPES.macaddr8:

            case TYPES.text:
            case TYPES.varchar:
            case TYPES.char:
            case TYPES.bpchar:

            case TYPES.uuid:
          }*/
        }

        const operatorSpecs: {
          [fieldName: string]: OperatorSpec;
        } = arrayLike
          ? connectionFilterArrayOperators
          : rangeLike
          ? connectionFilterRangeOperators
          : enumLike
          ? connectionFilterEnumOperators
          : {
              ...standardOperators,
              ...(sortable ? sortOperators : null),
              ...(inetLike ? inetOperators : null),
              ...(jsonLike ? jsonbOperators : null),
              ...(hstoreLike ? hstoreOperators : null),
              ...(textLike ? patternMatchingOperators : null),
              ...(textLike ? insensitiveOperators : null),
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
                applyPlan: makeApplyPlanFromOperatorSpec(build, spec, type),
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
  ) => GraphQLInputType;
  resolveSqlIdentifier?: (
    sqlIdentifier: SQL,
    codec: PgTypeCodec<any, any, any, any>
  ) => readonly [SQL, PgTypeCodec<any, any, any, any>];
  resolveInput?: (input: unknown) => unknown;
  resolveInputCodec?: (
    expressionCodec: PgTypeCodec<any, any, any, any>
  ) => PgTypeCodec<any, any, any, any>;
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

export function makeApplyPlanFromOperatorSpec(
  build: GraphileBuild.Build,
  spec: OperatorSpec,
  type: GraphQLInputType
): InputObjectFieldApplyPlanResolver<PgConditionStep<any>> {
  const {
    sql,
    graphql: { isNamedType, isListType },
  } = build;
  const {
    description,
    resolveType,
    resolve,
    resolveInput,
    resolveSql,
    resolveSqlIdentifier,
    resolveSqlValue,
  } = spec;

  // Figure out the input codec
  const guessCodecFromNamedType = (
    type: GraphQLNamedType & GraphQLInputType
  ) => {
    const scope = build.scopeByType.get(type) as
      | GraphileBuild.ScopeInputObject
      | GraphileBuild.ScopeScalar
      | GraphileBuild.ScopeEnum
      | undefined;
    if (scope?.pgCodec) {
      return scope.pgCodec;
    }
    if (type === GraphQLString) {
      return TYPES.text;
    }
  };
  const resolveInputCodec = (
    expressionCodec: PgTypeCodec<any, any, any, any>
  ) => {
    if (spec.resolveInputCodec) {
      return spec.resolveInputCodec(expressionCodec);
    }
    if (isNamedType(type)) {
      return guessCodecFromNamedType(type) ?? expressionCodec;
    } else if (isListType(type)) {
      const innerType = type.ofType;
      if (isNamedType(innerType)) {
        const innerCodec =
          guessCodecFromNamedType(innerType) ?? expressionCodec;
        if (innerCodec && !innerCodec.arrayOfCodec) {
          return listOfType(innerCodec);
        }
      }
    }
    return expressionCodec;
  };

  return ($where, fieldArgs) => {
    if (!$where.extensions?.pgFilterColumn) {
      throw new Error(`Planning error`);
    }
    const { columnName, column } = $where.extensions.pgFilterColumn;

    const sourceAlias = column.expression
      ? column.expression($where.alias)
      : sql`${$where.alias}.${sql.identifier(columnName)}`;
    const sourceCodec = column.codec;

    const [sqlIdentifier, identifierCodec] = resolveSqlIdentifier
      ? resolveSqlIdentifier(sourceAlias, sourceCodec)
      : /*
      : column.codec === TYPES.citext
      ? sql.query`${sourceAlias}::text` // cast column to text for case-sensitive matching
      : column.codec.arrayOfCodec === TYPES.citext
      ? sql.query`${sourceAlias}::text[]` // cast column to text[] for case-sensitive matching
      */
        [sourceAlias, sourceCodec];

    const $input = fieldArgs.getRaw();
    const $resolvedInput = resolveInput ? lambda($input, resolveInput) : $input;
    const inputCodec = resolveInputCodec(identifierCodec);
    if (!inputCodec) {
      throw new Error(
        // TODO: improve this error message with more details about where this originated
        `We don't know what type the input is, please provide 'resolveInputCodec' to the filter spec`
      );
    }

    const sqlValue = resolveSqlValue
      ? resolveSqlValue($where, $input, inputCodec)
      : /*
      : column.codec === TYPES.citext
      ? $where.placeholder($resolvedInput, TYPES.text) // cast input to text
      : column.codec.arrayOfCodec === TYPES.citext
      ? $where.placeholder($resolvedInput, listOfType(TYPES.citext as any)) // cast input to text[]
      */
        $where.placeholder($resolvedInput, inputCodec);

    const fragment = resolve(sqlIdentifier, sqlValue, $input, $where);
    $where.where(fragment);
  };
}
