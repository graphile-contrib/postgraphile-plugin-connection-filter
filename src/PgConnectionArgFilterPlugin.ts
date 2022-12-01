import { isEnumCodec, PgSelectStep, PgTypeCodec, TYPES } from "@dataplan/pg";
import { ConnectionStep, ExecutableStep } from "grafast";
import type {
  GraphQLInputFieldConfigMap,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLType,
} from "graphql";
import { GraphQLNamedType } from "graphql";
import { PgType } from "pg-introspection";
import { SQL } from "pg-sql2";
import { OperatorsCategory } from "./interfaces";
import { BackwardRelationSpec } from "./PgConnectionArgFilterBackwardRelationsPlugin";

const { version } = require("../package.json");

type AnyCodec = PgTypeCodec<any, any, any, any>;

export const PgConnectionArgFilterPlugin: GraphileConfig.Plugin = {
  name: "PgConnectionArgFilterPlugin",
  version,

  schema: {
    hooks: {
      build(build) {
        const {
          inflection,
          graphql: { isListType, getNamedType },
        } = build;
        build.connectionFilterOperatorsType = (codec) => {
          const fieldType = build.getGraphQLTypeByPgCodec!(codec, "output") as
            | GraphQLOutputType
            | undefined;
          const fieldInputType = build.getGraphQLTypeByPgCodec!(
            codec,
            "input"
          ) as GraphQLInputType | undefined;
          if (!fieldType || !fieldInputType) {
            return undefined;
          }
          const namedType = getNamedType(fieldType);
          const namedInputType = getNamedType(fieldInputType);
          const listType = isListType(fieldType);
          const operatorsTypeName = listType
            ? inflection.filterFieldListType(namedType.name)
            : inflection.filterFieldType(namedType.name);
          return build.getTypeByName(operatorsTypeName);
        };

        return build;
      },

      init(_, build) {
        const {
          inflection,
          graphql: { getNamedType, GraphQLString, isListType },
          options: {
            connectionFilterAllowedFieldTypes,
            connectionFilterArrays,
          },
        } = build;

        const codecs = new Set<AnyCodec>();

        // Create filter type for all column-having codecs
        for (const pgCodec of build.allPgCodecs) {
          if (!pgCodec.columns || pgCodec.isAnonymous) {
            continue;
          }
          const nodeTypeName = build.getGraphQLTypeNameByPgCodec(
            pgCodec,
            "output"
          );
          if (!nodeTypeName) continue;

          const filterTypeName = inflection.filterType(nodeTypeName);
          build.registerInputObjectType(
            filterTypeName,
            {
              pgCodec,
              isPgConnectionFilter: true,
            },
            () => ({
              description: `A filter to be used against \`${nodeTypeName}\` object types. All fields are combined with a logical ‘and.’`,
            }),
            "PgConnectionArgFilterPlugin"
          );
        }

        const isSuitableForFiltering = (codec: AnyCodec): boolean =>
          !codec.columns &&
          !codec.isAnonymous &&
          !codec.arrayOfCodec &&
          !codec.polymorphism &&
          (!codec.domainOfCodec || isSuitableForFiltering(codec.domainOfCodec));

        const getInnerCodec = (codec: AnyCodec): AnyCodec => {
          if (codec.domainOfCodec) {
            return getInnerCodec(codec.domainOfCodec);
          }
          if (codec.arrayOfCodec) {
            return getInnerCodec(codec.arrayOfCodec);
          }
          if (codec.rangeOfCodec) {
            return getInnerCodec(codec.rangeOfCodec);
          }
          return codec;
        };

        // Get or create types like IntFilter, StringFilter, etc.
        for (const codec of build.allPgCodecs) {
          if (!isSuitableForFiltering(codec)) {
            // Not a base, domain, enum, or range type? Skip.
            continue;
          }

          // Perform some checks on the simple type (after removing array/range/domain wrappers)
          const pgSimpleCodec = getInnerCodec(codec);
          if (!pgSimpleCodec) continue;
          if (
            pgSimpleCodec.polymorphism ||
            pgSimpleCodec.columns ||
            pgSimpleCodec.isAnonymous
          ) {
            // Haven't found an enum type or a non-array base type? Skip.
            continue;
          }
          if (pgSimpleCodec === TYPES.json) {
            // The PG `json` type has no valid operators.
            // Skip filter type creation to allow the proper
            // operators to be exposed for PG `jsonb` types.
            continue;
          }

          // TODO:v5: I'm unsure if this will work as before, e.g. it might not wrap with GraphQLList/GraphQLNonNull/etc
          // Establish field type and field input type
          const fieldType = build.getGraphQLTypeByPgCodec(codec, "output") as
            | GraphQLOutputType
            | undefined;
          if (!fieldType) continue;
          const fieldInputType = build.getGraphQLTypeByPgCodec(
            codec,
            "input"
          ) as GraphQLInputType | undefined;
          if (!fieldInputType) continue;

          // Avoid exposing filter operators on unrecognized types that PostGraphile handles as Strings
          const namedType = getNamedType(fieldType);
          const namedInputType = getNamedType(fieldInputType);
          const actualStringCodecs = [
            TYPES.bpchar,
            TYPES.char,
            TYPES.name,
            TYPES.text,
            TYPES.varchar,
            TYPES.citext,
          ];
          if (
            namedInputType === GraphQLString &&
            !actualStringCodecs.includes(pgSimpleCodec)
          ) {
            // Not a real string type? Skip.
            continue;
          }

          // Respect `connectionFilterAllowedFieldTypes` config option
          if (
            connectionFilterAllowedFieldTypes &&
            !connectionFilterAllowedFieldTypes.includes(namedType.name)
          ) {
            continue;
          }

          const pgConnectionFilterOperatorsCategory: OperatorsCategory =
            codec.arrayOfCodec
              ? "Array"
              : codec.rangeOfCodec
              ? "Range"
              : isEnumCodec(codec)
              ? "Enum"
              : codec.domainOfCodec
              ? "Domain"
              : "Scalar";

          // Respect `connectionFilterArrays` config option
          if (
            pgConnectionFilterOperatorsCategory === "Array" &&
            !connectionFilterArrays
          ) {
            continue;
          }

          const rangeElementInputType = codec.rangeOfCodec
            ? (build.getGraphQLTypeByPgCodec(codec.rangeOfCodec, "input") as
                | GraphQLInputType
                | undefined)
            : undefined;

          const domainBaseType = codec.domainOfCodec
            ? (build.getGraphQLTypeByPgCodec(codec.domainOfCodec, "output") as
                | GraphQLOutputType
                | undefined)
            : undefined;

          const listType = isListType(fieldType);

          // TODO: see if we can share code with build.connectionFilterOperatorsType
          const operatorsTypeName = listType
            ? inflection.filterFieldListType(namedType.name)
            : inflection.filterFieldType(namedType.name);

          build.registerInputObjectType(
            operatorsTypeName,
            {
              isPgConnectionFilterOperators: true,
              pgConnectionFilterOperatorsCategory,
              fieldType,
              fieldInputType,
              rangeElementInputType,
              domainBaseType,
            },
            () => ({
              name: operatorsTypeName,
              description: `A filter to be used against ${namedType.name}${
                listType ? " List" : ""
              } fields. All fields are combined with a logical ‘and.’`,
            }),
            "PgConnectionArgFilterPlugin"
          );
        }

        return _;
      },

      // Add `filter` input argument to connection and simple collection types
      GraphQLObjectType_fields_field_args(args, build, context) {
        const {
          extend,
          getTypeByName,
          inflection,
          options: {
            connectionFilterAllowedFieldTypes,
            connectionFilterArrays,
            connectionFilterSetofFunctions,
            connectionFilterAllowNullInput,
            connectionFilterAllowEmptyObjectInput,
          },
        } = build;
        const {
          scope: {
            isPgFieldConnection,
            isPgFieldSimpleCollection,
            pgSource: source,
            fieldName,
          },
          Self,
        } = context;

        const shouldAddFilter =
          isPgFieldConnection || isPgFieldSimpleCollection;
        if (!shouldAddFilter) return args;

        if (!source) return args;
        const behavior = build.pgGetBehavior([
          source.codec.extensions,
          source.extensions,
        ]);

        // procedure sources aren't filterable by default (unless
        // connectionFilterSetofFunctions is set), but can be made filterable
        // by adding the `+filter` behavior.
        const defaultBehavior =
          source.parameters && !connectionFilterSetofFunctions
            ? "-filter"
            : "filter";

        if (!build.behavior.matches(behavior, "filter", defaultBehavior)) {
          return args;
        }

        const returnCodec = source.codec;
        const nodeType = build.getGraphQLTypeByPgCodec(
          returnCodec,
          "output"
        ) as GraphQLOutputType & GraphQLNamedType;
        if (!nodeType) {
          return args;
        }
        const nodeTypeName = nodeType.name;
        const filterTypeName = inflection.filterType(nodeTypeName);
        const nodeCodec = source.codec;

        const FilterType = build.getTypeByName(filterTypeName) as
          | GraphQLInputType
          | undefined;
        if (!FilterType) {
          return args;
        }

        return extend(
          args,
          {
            filter: {
              description:
                "A filter to be used in determining which values should be returned by the collection.",
              type: FilterType,
              ...(isPgFieldConnection
                ? {
                    plan(
                      _: any,
                      $connection: ConnectionStep<
                        any,
                        any,
                        any,
                        PgSelectStep<any, any, any, any>
                      >
                    ) {
                      const $pgSelect = $connection.getSubplan();
                      return $pgSelect.wherePlan();
                    },
                  }
                : {
                    plan(_: any, $pgSelect: PgSelectStep<any, any, any, any>) {
                      return $pgSelect.wherePlan();
                    },
                  }),
            },
          },
          `Adding connection filter arg to field '${fieldName}' of '${Self.name}'`
        );
      },

      /*
      build(build) {
        const {
          extend,
          graphql: { getNamedType, GraphQLInputObjectType, GraphQLList },
          inflection,
          sql,
          options: {
            connectionFilterAllowedFieldTypes,
            connectionFilterArrays,
            connectionFilterSetofFunctions,
            connectionFilterAllowNullInput,
            connectionFilterAllowEmptyObjectInput,
          },
        } = build;

        /*
        const handleNullInput = () => {
          if (!connectionFilterAllowNullInput) {
            throw new Error(
              "Null literals are forbidden in filter argument input."
            );
          }
          return null;
        };

        const handleEmptyObjectInput = () => {
          if (!connectionFilterAllowEmptyObjectInput) {
            throw new Error(
              "Empty objects are forbidden in filter argument input."
            );
          }
          return null;
        };

        const isEmptyObject = (obj: any) =>
          typeof obj === "object" &&
          obj !== null &&
          !Array.isArray(obj) &&
          Object.keys(obj).length === 0;
        * /

        const escapeLikeWildcards = (input: string) => {
          if ("string" !== typeof input) {
            throw new Error(
              "Non-string input was provided to escapeLikeWildcards"
            );
          } else {
            return input.split("%").join("\\%").split("_").join("\\_");
          }
        };

        const addConnectionFilterOperator: AddConnectionFilterOperator = (
          typeNames,
          operatorName,
          description,
          resolveType,
          resolve,
          options = {}
        ) => {
          if (!typeNames) {
            const msg = `Missing first argument 'typeNames' in call to 'addConnectionFilterOperator' for operator '${operatorName}'`;
            throw new Error(msg);
          }
          if (!operatorName) {
            const msg = `Missing second argument 'operatorName' in call to 'addConnectionFilterOperator' for operator '${operatorName}'`;
            throw new Error(msg);
          }
          if (!resolveType) {
            const msg = `Missing fourth argument 'resolveType' in call to 'addConnectionFilterOperator' for operator '${operatorName}'`;
            throw new Error(msg);
          }
          if (!resolve) {
            const msg = `Missing fifth argument 'resolve' in call to 'addConnectionFilterOperator' for operator '${operatorName}'`;
            throw new Error(msg);
          }

          const { connectionFilterScalarOperators } = build;

          const gqlTypeNames = Array.isArray(typeNames)
            ? typeNames
            : [typeNames];
          for (const gqlTypeName of gqlTypeNames) {
            if (!connectionFilterScalarOperators[gqlTypeName]) {
              connectionFilterScalarOperators[gqlTypeName] = {};
            }
            if (connectionFilterScalarOperators[gqlTypeName][operatorName]) {
              const msg = `Operator '${operatorName}' already exists for type '${gqlTypeName}'.`;
              throw new Error(msg);
            }
            connectionFilterScalarOperators[gqlTypeName][operatorName] = {
              description,
              resolveType,
              resolve,
              // These functions may exist on `options`: resolveSqlIdentifier, resolveSqlValue, resolveInput
              ...options,
            };
          }
        };

        return extend(build, {
          connectionFilterTypesByTypeName,
          connectionFilterRegisterResolver,
          connectionFilterResolve,
          connectionFilterOperatorsType,
          connectionFilterType,
          escapeLikeWildcards,
          addConnectionFilterOperator,
        });
      },
      */
    },
  },
};

/*
export interface AddConnectionFilterOperator {
  (
    typeNames: string | string[],
    operatorName: string,
    description: string | null,
    resolveType: (
      fieldInputType: GraphQLInputType,
      rangeElementInputType: GraphQLInputType
    ) => GraphQLType,
    resolve: (
      sqlIdentifier: SQL,
      sqlValue: SQL,
      input: unknown,
      parentFieldName: string,
      queryBuilder: QueryBuilder
    ) => SQL | null,
    options?: {
      resolveInput?: (input: unknown) => unknown;
      resolveSqlIdentifier?: (
        sqlIdentifier: SQL,
        pgType: PgType,
        pgTypeModifier: number | null
      ) => SQL;
      resolveSqlValue?: (
        input: unknown,
        pgType: PgType,
        pgTypeModifier: number | null,
        resolveListItemSqlValue?: any
      ) => SQL | null;
    }
  ): void;
}

export default PgConnectionArgFilterPlugin;
*/
