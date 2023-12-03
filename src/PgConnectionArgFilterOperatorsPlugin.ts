import type { PgConditionStep, PgCodec } from "@dataplan/pg";
import type {
  ExecutableStep,
  GrafastInputFieldConfigMap,
  InputObjectFieldApplyPlanResolver,
  InputStep,
} from "grafast";
import type { GraphQLInputType, GraphQLNamedType } from "graphql";
import type { SQL } from "pg-sql2";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require("../package.json");

// const textArrayCodec = listOfCodec(TYPES.text);

export const PgConnectionArgFilterOperatorsPlugin: GraphileConfig.Plugin = {
  name: "PgConnectionArgFilterOperatorsPlugin",
  version,

  schema: {
    hooks: {
      GraphQLInputObjectType_fields(fields, build, context) {
        const {
          extend,
          graphql: { GraphQLNonNull, GraphQLList, isListType, isNonNullType },
          dataplanPg: { isEnumCodec, listOfCodec, TYPES },
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

        /** Turn `[Foo]` into `[Foo!]` */
        const resolveTypeToListOfNonNullable = (type: GraphQLInputType) => {
          if (isListType(type) && !isNonNullType(type.ofType)) {
            return new GraphQLList(new GraphQLNonNull(type.ofType));
          } else {
            return type;
          }
        };

        const forceTextTypesSensitive = [
          TYPES.citext,
          TYPES.char,
          TYPES.bpchar,
        ];
        const forceTextTypesInsensitive = [TYPES.char, TYPES.bpchar];
        const resolveDomains = (
          c: PgCodec<any, any, any, any, any, any, any>
        ): PgCodec<any, any, any, any, any, any, any> => {
          return c.domainOfCodec ? resolveDomains(c.domainOfCodec) : c;
        };

        const resolveArrayInputCodecSensitive = (
          c: PgCodec<any, any, any, any, any, any, any>
        ) => {
          if (forceTextTypesSensitive.includes(resolveDomains(c))) {
            return listOfCodec(TYPES.text, {
              extensions: { listItemNonNull: true },
            });
          } else {
            return listOfCodec(c, { extensions: { listItemNonNull: true } });
          }
        };

        const resolveArrayItemInputCodecSensitive = (
          c: PgCodec<any, any, any, any, any, any, any>
        ) => {
          if (c.arrayOfCodec) {
            if (
              forceTextTypesSensitive.includes(resolveDomains(c.arrayOfCodec))
            ) {
              return TYPES.text;
            }
            return c.arrayOfCodec;
          } else {
            throw new Error(`Expected array codec`);
          }
        };
        const resolveInputCodecSensitive = (
          c: PgCodec<any, any, any, any, any, any, any>
        ) => {
          if (c.arrayOfCodec) {
            if (
              forceTextTypesSensitive.includes(resolveDomains(c.arrayOfCodec))
            ) {
              return listOfCodec(TYPES.text, {
                extensions: { listItemNonNull: c.extensions?.listItemNonNull },
              });
            }
            return c;
          } else {
            if (forceTextTypesSensitive.includes(resolveDomains(c))) {
              return TYPES.text;
            }
            return c;
          }
        };
        const resolveSqlIdentifierSensitive = (
          identifier: SQL,
          c: PgCodec<any, any, any, any, any, any, any>
        ) => {
          if (
            c.arrayOfCodec &&
            forceTextTypesSensitive.includes(resolveDomains(c.arrayOfCodec))
          ) {
            return [
              sql`(${identifier})::text[]`,
              listOfCodec(TYPES.text, {
                extensions: { listItemNonNull: c.extensions?.listItemNonNull },
              }),
            ] as const;
          } else if (forceTextTypesSensitive.includes(resolveDomains(c))) {
            return [sql`(${identifier})::text`, TYPES.text] as const;
          } else {
            return [identifier, c] as const;
          }
        };
        const resolveInputCodecInsensitive = (
          c: PgCodec<any, any, any, any, any, any, any>
        ) => {
          if (c.arrayOfCodec) {
            if (
              forceTextTypesInsensitive.includes(resolveDomains(c.arrayOfCodec))
            ) {
              return listOfCodec(TYPES.text, {
                extensions: { listItemNonNull: c.extensions?.listItemNonNull },
              });
            }
            return c;
          } else {
            if (forceTextTypesInsensitive.includes(resolveDomains(c))) {
              return TYPES.text;
            }
            return c;
          }
        };
        const resolveSqlIdentifierInsensitive = (
          identifier: SQL,
          c: PgCodec<any, any, any, any, any, any, any>
        ) => {
          if (
            c.arrayOfCodec &&
            forceTextTypesInsensitive.includes(resolveDomains(c.arrayOfCodec))
          ) {
            return [
              sql`(${identifier})::text[]`,
              listOfCodec(TYPES.text, {
                extensions: { listItemNonNull: c.extensions?.listItemNonNull },
              }),
            ] as const;
          } else if (forceTextTypesInsensitive.includes(resolveDomains(c))) {
            return [sql`(${identifier})::text`, TYPES.text] as const;
          } else {
            return [identifier, c] as const;
          }
        };

        const standardOperators: { [fieldName: string]: OperatorSpec } = {
          isNull: {
            description:
              "Is null (if `true` is specified) or is not null (if `false` is specified).",
            resolveInputCodec: () => TYPES.boolean,
            resolveSqlValue: () => sql.null, // do not parse
            resolve: (i, _v, $input) =>
              sql`${i} ${$input.eval() ? sql`IS NULL` : sql`IS NOT NULL`}`,
          },
          equalTo: {
            description: "Equal to the specified value.",
            resolve: (i, v) => sql`${i} = ${v}`,
            resolveInputCodec: resolveInputCodecSensitive,
            resolveSqlIdentifier: resolveSqlIdentifierSensitive,
          },
          notEqualTo: {
            description: "Not equal to the specified value.",
            resolve: (i, v) => sql`${i} <> ${v}`,
            resolveInputCodec: resolveInputCodecSensitive,
            resolveSqlIdentifier: resolveSqlIdentifierSensitive,
          },
          distinctFrom: {
            description:
              "Not equal to the specified value, treating null like an ordinary value.",
            resolve: (i, v) => sql`${i} IS DISTINCT FROM ${v}`,
            resolveInputCodec: resolveInputCodecSensitive,
            resolveSqlIdentifier: resolveSqlIdentifierSensitive,
          },
          notDistinctFrom: {
            description:
              "Equal to the specified value, treating null like an ordinary value.",
            resolve: (i, v) => sql`${i} IS NOT DISTINCT FROM ${v}`,
            resolveInputCodec: resolveInputCodecSensitive,
            resolveSqlIdentifier: resolveSqlIdentifierSensitive,
          },
          in: {
            description: "Included in the specified list.",
            resolve: (i, v) => sql`${i} = ANY(${v})`,
            resolveInputCodec: resolveArrayInputCodecSensitive,
            resolveSqlIdentifier: resolveSqlIdentifierSensitive,
            resolveType: resolveTypeToListOfNonNullable,
          },
          notIn: {
            description: "Not included in the specified list.",
            resolve: (i, v) => sql`${i} <> ALL(${v})`,
            resolveInputCodec: resolveArrayInputCodecSensitive,
            resolveSqlIdentifier: resolveSqlIdentifierSensitive,
            resolveType: resolveTypeToListOfNonNullable,
          },
        };
        const sortOperators: { [fieldName: string]: OperatorSpec } = {
          lessThan: {
            description: "Less than the specified value.",
            resolve: (i, v) => sql`${i} < ${v}`,
            resolveInputCodec: resolveInputCodecSensitive,
            resolveSqlIdentifier: resolveSqlIdentifierSensitive,
          },
          lessThanOrEqualTo: {
            description: "Less than or equal to the specified value.",
            resolve: (i, v) => sql`${i} <= ${v}`,
            resolveInputCodec: resolveInputCodecSensitive,
            resolveSqlIdentifier: resolveSqlIdentifierSensitive,
          },
          greaterThan: {
            description: "Greater than the specified value.",
            resolve: (i, v) => sql`${i} > ${v}`,
            resolveInputCodec: resolveInputCodecSensitive,
            resolveSqlIdentifier: resolveSqlIdentifierSensitive,
          },
          greaterThanOrEqualTo: {
            description: "Greater than or equal to the specified value.",
            resolve: (i, v) => sql`${i} >= ${v}`,
            resolveInputCodec: resolveInputCodecSensitive,
            resolveSqlIdentifier: resolveSqlIdentifierSensitive,
          },
        };

        const patternMatchingOperators: { [fieldName: string]: OperatorSpec } =
          {
            includes: {
              description: "Contains the specified string (case-sensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}%`,
              resolveInputCodec: resolveInputCodecSensitive,
              resolveSqlIdentifier: resolveSqlIdentifierSensitive,
              resolve: (i, v) => sql`${i} LIKE ${v}`,
            },
            notIncludes: {
              description:
                "Does not contain the specified string (case-sensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}%`,
              resolveInputCodec: resolveInputCodecSensitive,
              resolveSqlIdentifier: resolveSqlIdentifierSensitive,
              resolve: (i, v) => sql`${i} NOT LIKE ${v}`,
            },
            includesInsensitive: {
              description: "Contains the specified string (case-insensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}%`,
              resolve: (i, v) => sql`${i} ILIKE ${v}`,
              resolveInputCodec: resolveInputCodecInsensitive,
              resolveSqlIdentifier: resolveSqlIdentifierInsensitive,
            },
            notIncludesInsensitive: {
              description:
                "Does not contain the specified string (case-insensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}%`,
              resolve: (i, v) => sql`${i} NOT ILIKE ${v}`,
              resolveInputCodec: resolveInputCodecInsensitive,
              resolveSqlIdentifier: resolveSqlIdentifierInsensitive,
            },
            startsWith: {
              description: "Starts with the specified string (case-sensitive).",
              resolveInput: (input) => `${escapeLikeWildcards(input)}%`,
              resolveInputCodec: resolveInputCodecSensitive,
              resolveSqlIdentifier: resolveSqlIdentifierSensitive,
              resolve: (i, v) => sql`${i} LIKE ${v}`,
            },
            notStartsWith: {
              description:
                "Does not start with the specified string (case-sensitive).",
              resolveInput: (input) => `${escapeLikeWildcards(input)}%`,
              resolveInputCodec: resolveInputCodecSensitive,
              resolveSqlIdentifier: resolveSqlIdentifierSensitive,
              resolve: (i, v) => sql`${i} NOT LIKE ${v}`,
            },
            startsWithInsensitive: {
              description:
                "Starts with the specified string (case-insensitive).",
              resolveInput: (input) => `${escapeLikeWildcards(input)}%`,
              resolve: (i, v) => sql`${i} ILIKE ${v}`,
              resolveInputCodec: resolveInputCodecInsensitive,
              resolveSqlIdentifier: resolveSqlIdentifierInsensitive,
            },
            notStartsWithInsensitive: {
              description:
                "Does not start with the specified string (case-insensitive).",
              resolveInput: (input) => `${escapeLikeWildcards(input)}%`,
              resolve: (i, v) => sql`${i} NOT ILIKE ${v}`,
              resolveInputCodec: resolveInputCodecInsensitive,
              resolveSqlIdentifier: resolveSqlIdentifierInsensitive,
            },
            endsWith: {
              description: "Ends with the specified string (case-sensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}`,
              resolveInputCodec: resolveInputCodecSensitive,
              resolveSqlIdentifier: resolveSqlIdentifierSensitive,
              resolve: (i, v) => sql`${i} LIKE ${v}`,
            },
            notEndsWith: {
              description:
                "Does not end with the specified string (case-sensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}`,
              resolveInputCodec: resolveInputCodecSensitive,
              resolveSqlIdentifier: resolveSqlIdentifierSensitive,
              resolve: (i, v) => sql`${i} NOT LIKE ${v}`,
            },
            endsWithInsensitive: {
              description: "Ends with the specified string (case-insensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}`,
              resolve: (i, v) => sql`${i} ILIKE ${v}`,
              resolveInputCodec: resolveInputCodecInsensitive,
              resolveSqlIdentifier: resolveSqlIdentifierInsensitive,
            },
            notEndsWithInsensitive: {
              description:
                "Does not end with the specified string (case-insensitive).",
              resolveInput: (input) => `%${escapeLikeWildcards(input)}`,
              resolve: (i, v) => sql`${i} NOT ILIKE ${v}`,
              resolveInputCodec: resolveInputCodecInsensitive,
              resolveSqlIdentifier: resolveSqlIdentifierInsensitive,
            },
            like: {
              description:
                "Matches the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
              resolve: (i, v) => sql`${i} LIKE ${v}`,
              resolveInputCodec: resolveInputCodecSensitive,
              resolveSqlIdentifier: resolveSqlIdentifierSensitive,
            },
            notLike: {
              description:
                "Does not match the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
              resolve: (i, v) => sql`${i} NOT LIKE ${v}`,
              resolveInputCodec: resolveInputCodecSensitive,
              resolveSqlIdentifier: resolveSqlIdentifierSensitive,
            },
            likeInsensitive: {
              description:
                "Matches the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
              resolve: (i, v) => sql`${i} ILIKE ${v}`,
              resolveInputCodec: resolveInputCodecInsensitive,
              resolveSqlIdentifier: resolveSqlIdentifierInsensitive,
            },
            notLikeInsensitive: {
              description:
                "Does not match the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.",
              resolve: (i, v) => sql`${i} NOT ILIKE ${v}`,
              resolveInputCodec: resolveInputCodecInsensitive,
              resolveSqlIdentifier: resolveSqlIdentifierInsensitive,
            },
          };
        const resolveTextArrayInputCodec = () =>
          listOfCodec(TYPES.text, { extensions: { listItemNonNull: true } });
        const hstoreOperators: { [fieldName: string]: OperatorSpec } = {
          contains: {
            description: "Contains the specified KeyValueHash.",
            resolve: (i, v) => sql`${i} @> ${v}`,
          },
          containsKey: {
            description: "Contains the specified key.",
            resolveInputCodec: () => TYPES.text,
            resolve: (i, v) => sql`${i} ? ${v}`,
          },
          containsAllKeys: {
            name: "containsAllKeys",
            description: "Contains all of the specified keys.",
            resolveInputCodec: resolveTextArrayInputCodec,
            resolve: (i, v) => sql`${i} ?& ${v}`,
            resolveType: resolveTypeToListOfNonNullable,
          },
          containsAnyKeys: {
            name: "containsAnyKeys",
            description: "Contains any of the specified keys.",
            resolveInputCodec: resolveTextArrayInputCodec,
            resolve: (i, v) => sql`${i} ?| ${v}`,
            resolveType: resolveTypeToListOfNonNullable,
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
            resolveInputCodec: () => TYPES.text,
            resolve: (i, v) => sql`${i} ? ${v}`,
          },
          containsAllKeys: {
            name: "containsAllKeys",
            description: "Contains all of the specified keys.",
            resolveInputCodec: resolveTextArrayInputCodec,
            resolve: (i, v) => sql`${i} ?& ${v}`,
          },
          containsAnyKeys: {
            name: "containsAnyKeys",
            description: "Contains any of the specified keys.",
            resolveInputCodec: resolveTextArrayInputCodec,
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
            codec: PgCodec<any, any, any, any, any, any, any>
          ) =>
            resolveDomains(codec) === TYPES.citext
              ? ([sourceAlias, codec] as const) // already case-insensitive, so no need to call `lower()`
              : ([sql`lower(${sourceAlias}::text)`, TYPES.text] as const);
          const resolveSqlValue = (
            $placeholderable: PlaceholderableStep,
            $input: InputStep,
            inputCodec: PgCodec<any, any, any, any, any, any, any>
          ) => {
            if (name === "in" || name === "notIn") {
              const sqlList = $placeholderable.placeholder($input, inputCodec);
              if (inputCodec.arrayOfCodec === TYPES.citext) {
                // already case-insensitive, so no need to call `lower()`
                return sqlList;
              } else {
                // This is being used in an `= ANY(subquery)` syntax, so no
                // need to array_agg it. See
                // https://www.postgresql.org/docs/current/functions-subquery.html#FUNCTIONS-SUBQUERY-ANY-SOME
                return sql`(select lower(t) from unnest(${sqlList}) t)`;
              }
            } else {
              const sqlValue = $placeholderable.placeholder($input, inputCodec);
              if (inputCodec === TYPES.citext) {
                // already case-insensitive, so no need to call `lower()`
                return sqlValue;
              } else {
                return sql`lower(${sqlValue})`;
              }
            }
          };

          const resolveInputCodec = (
            inputCodec: PgCodec<any, any, any, any, any, any, any>
          ) => {
            if (name === "in" || name === "notIn") {
              const t =
                resolveDomains(inputCodec) === TYPES.citext
                  ? inputCodec
                  : TYPES.text;
              return listOfCodec(t, { extensions: { listItemNonNull: true } });
            } else {
              const t =
                resolveDomains(inputCodec) === TYPES.citext
                  ? inputCodec
                  : TYPES.text;
              return t;
            }
          };

          insensitiveOperators[`${name}Insensitive`] = {
            ...spec,
            description,
            resolveInputCodec,
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
            resolveInputCodec(c) {
              if (c.rangeOfCodec) {
                return c.rangeOfCodec;
              } else {
                throw new Error(
                  `Couldn't determine the range element type to use`
                );
              }
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
            resolveSqlIdentifier: resolveSqlIdentifierSensitive,
            resolveInputCodec: resolveInputCodecSensitive,
            resolve: (i, v) => sql`${i} @> ${v}`,
          },
          containedBy: {
            description: "Contained by the specified list of values.",
            resolveSqlIdentifier: resolveSqlIdentifierSensitive,
            resolveInputCodec: resolveInputCodecSensitive,
            resolve: (i, v) => sql`${i} <@ ${v}`,
          },
          overlaps: {
            description: "Overlaps the specified list of values.",
            resolveSqlIdentifier: resolveSqlIdentifierSensitive,
            resolveInputCodec: resolveInputCodecSensitive,
            resolve: (i, v) => sql`${i} && ${v}`,
          },
          anyEqualTo: {
            description: "Any array item is equal to the specified value.",
            resolveInputCodec: resolveArrayItemInputCodecSensitive,
            resolve: (i, v) => sql`${v} = ANY (${i})`,
          },
          anyNotEqualTo: {
            description: "Any array item is not equal to the specified value.",
            resolveInputCodec: resolveArrayItemInputCodecSensitive,
            resolve: (i, v) => sql`${v} <> ANY (${i})`,
          },
          anyLessThan: {
            description: "Any array item is less than the specified value.",
            resolveInputCodec: resolveArrayItemInputCodecSensitive,
            resolve: (i, v) => sql`${v} > ANY (${i})`,
          },
          anyLessThanOrEqualTo: {
            description:
              "Any array item is less than or equal to the specified value.",
            resolveInputCodec: resolveArrayItemInputCodecSensitive,
            resolve: (i, v) => sql`${v} >= ANY (${i})`,
          },
          anyGreaterThan: {
            description: "Any array item is greater than the specified value.",
            resolveInputCodec: resolveArrayItemInputCodecSensitive,
            resolve: (i, v) => sql`${v} < ANY (${i})`,
          },
          anyGreaterThanOrEqualTo: {
            description:
              "Any array item is greater than or equal to the specified value.",
            resolveInputCodec: resolveArrayItemInputCodecSensitive,
            resolve: (i, v) => sql`${v} <= ANY (${i})`,
          },
        };

        const {
          //inputTypeName,
          //rangeElementInputTypeName,
          //domainBaseTypeName,
          pgCodecs,
        } = pgConnectionFilterOperators;

        // We know all these pgCodecs will produce the same GraphQL input type,
        // so we only need to grab the type of one of them
        const someCodec = pgCodecs[0];
        const fieldInputType = build.getGraphQLTypeByPgCodec(
          someCodec,
          "input"
        ) as GraphQLInputType;

        const rangeElementInputType = someCodec.rangeOfCodec
          ? (build.getGraphQLTypeByPgCodec(
              someCodec.rangeOfCodec,
              "input"
            ) as GraphQLInputType)
          : null;

        let textLike = true;
        let sortable = true;
        let inetLike = true;
        let jsonLike = true;
        let hstoreLike = true;
        let arrayLike = true;
        let rangeLike = true;
        let enumLike = true;
        for (const codec of pgCodecs) {
          const underlyingType = codec.domainOfCodec ?? codec;
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
            case TYPES.money:
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
            case TYPES.cidr:
            case TYPES.inet:
            case TYPES.macaddr:
            case TYPES.macaddr8:
            case TYPES.text:
            case TYPES.name:
            case TYPES.citext:
            case TYPES.varchar:
            case TYPES.char:
            case TYPES.bpchar:
            case TYPES.uuid: {
              // Sort is fine
              break;
            }
            default: {
              // NOT SORTABLE!
              if (Self.name === "FloatFilter" /* TODO: || ... */) {
                // TODO: solve this!
                console.log(
                  `The postgraphile-plugin-connection-filter unsupported codec ${underlyingType.name} is preventing ${Self.name} being detected as sortable!`
                );
              }
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
              if (Self.name === "InternetAddressFilter") {
                // TODO: solve this!
                console.log(
                  `The postgraphile-plugin-connection-filter unsupported codec ${underlyingType.name} is preventing ${Self.name} being detected as inet-like!`
                );
              }
              inetLike = false;
            }
          }

          switch (underlyingType) {
            case TYPES.text:
            case TYPES.name:
            case TYPES.citext:
            case TYPES.varchar:
            case TYPES.char:
            case TYPES.bpchar: {
              // Text
              break;
            }
            default: {
              // NOT TEXT!
              if (Self.name === "StringFilter") {
                // TODO: solve this!
                console.log(
                  `The postgraphile-plugin-connection-filter unsupported codec ${underlyingType.name} is preventing ${Self.name} being detected as text-like!`
                );
              }
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
            case TYPES.money:
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
            case TYPES.name:
            case TYPES.citext:
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
            const { description, resolveInputCodec, resolveType } = spec;

            if (
              connectionFilterAllowedOperators &&
              !connectionFilterAllowedOperators.includes(name)
            ) {
              return memo;
            }
            if (!fieldInputType) {
              return memo;
            }
            const firstCodec = pgCodecs[0];
            const inputCodec = resolveInputCodec
              ? resolveInputCodec(firstCodec)
              : firstCodec;
            const codecGraphQLType = build.getGraphQLTypeByPgCodec(
              inputCodec,
              "input"
            ) as GraphQLInputType | undefined;
            if (!codecGraphQLType) {
              return memo;
            }
            const type = resolveType
              ? resolveType(codecGraphQLType)
              : codecGraphQLType;

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
                applyPlan: makeApplyPlanFromOperatorSpec(
                  build,
                  Self.name,
                  operatorName,
                  spec,
                  type
                ),
              }
            );
            return memo;
          },
          Object.create(null) as GrafastInputFieldConfigMap<any, any>
        );

        return extend(fields, operatorFields, "");
      },
    },
  },
};

type PlaceholderableStep = {
  placeholder(
    step: ExecutableStep,
    codec: PgCodec<any, any, any, any, any, any, any>
  ): SQL;
};

export interface OperatorSpec {
  name?: string;
  description: string;
  // TODO: replace with codecs?
  resolveSqlIdentifier?: (
    sqlIdentifier: SQL,
    codec: PgCodec<any, any, any, any, any, any, any>
  ) => readonly [SQL, PgCodec<any, any, any, any, any, any, any>];
  resolveInput?: (input: unknown) => unknown;
  resolveInputCodec?: (
    expressionCodec: PgCodec<any, any, any, any, any, any, any>
  ) => PgCodec<any, any, any, any, any, any, any>;
  resolveSql?: any;
  resolveSqlValue?: (
    $placeholderable: PlaceholderableStep,
    $input: InputStep,
    codec: PgCodec<any, any, any, any, any, any, any>
    // UNUSED? resolveListItemSqlValue?: any
  ) => SQL;
  resolve: (
    sqlIdentifier: SQL,
    sqlValue: SQL,
    $input: InputStep,
    $placeholderable: PlaceholderableStep
  ) => SQL;
  resolveType?: (type: GraphQLInputType) => GraphQLInputType;
}

export function makeApplyPlanFromOperatorSpec(
  build: GraphileBuild.Build,
  typeName: string,
  fieldName: string,
  spec: OperatorSpec,
  type: GraphQLInputType
): InputObjectFieldApplyPlanResolver<PgConditionStep<any>> {
  const {
    sql,
    grafast: { lambda },
    dataplanPg: { TYPES },
  } = build;
  const {
    description,
    resolveInputCodec,
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
    if (type === build.graphql.GraphQLString) {
      return TYPES.text;
    }
  };

  const {
    options: { connectionFilterAllowNullInput },
  } = build;

  return ($where, fieldArgs) => {
    if (!$where.extensions?.pgFilterAttribute) {
      throw new Error(
        `Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to \`postgraphile-plugin-connection-filter\` does not implement the required interfaces.`
      );
    }
    const $input = fieldArgs.getRaw();
    if ($input.evalIs(undefined)) {
      return;
    }
    const { attributeName, attribute, codec, expression } =
      $where.extensions.pgFilterAttribute;

    const sourceAlias = attribute
      ? attribute.expression
        ? attribute.expression($where.alias)
        : sql`${$where.alias}.${sql.identifier(attributeName)}`
      : expression
      ? expression
      : $where.alias;
    const sourceCodec = codec ?? attribute.codec;

    const [sqlIdentifier, identifierCodec] = resolveSqlIdentifier
      ? resolveSqlIdentifier(sourceAlias, sourceCodec)
      : /*
      : attribute.codec === TYPES.citext
      ? sql.query`${sourceAlias}::text` // cast attribute to text for case-sensitive matching
      : attribute.codec.arrayOfCodec === TYPES.citext
      ? sql.query`${sourceAlias}::text[]` // cast attribute to text[] for case-sensitive matching
      */
        [sourceAlias, sourceCodec];

    if (connectionFilterAllowNullInput && $input.evalIs(null)) {
      // Don't add a filter
      return;
    }
    if (!connectionFilterAllowNullInput && $input.evalIs(null)) {
      // Forbidden
      throw Object.assign(
        new Error("Null literals are forbidden in filter argument input."),
        {
          //TODO: mark this error as safe
        }
      );
    }
    const $resolvedInput = resolveInput ? lambda($input, resolveInput) : $input;
    const inputCodec = resolveInputCodec
      ? resolveInputCodec(codec ?? attribute.codec)
      : codec ?? attribute.codec;

    const sqlValue = resolveSqlValue
      ? resolveSqlValue($where, $input, inputCodec)
      : /*
      : attribute.codec === TYPES.citext
      ? $where.placeholder($resolvedInput, TYPES.text) // cast input to text
      : attribute.codec.arrayOfCodec === TYPES.citext
      ? $where.placeholder($resolvedInput, listOfCodec(TYPES.citext as any)) // cast input to text[]
      */
        $where.placeholder($resolvedInput, inputCodec);

    const fragment = resolve(sqlIdentifier, sqlValue, $input, $where);
    $where.where(fragment);
  };
}
