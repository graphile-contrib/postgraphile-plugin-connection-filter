import type { PgSelectStep, PgCodec } from "@dataplan/pg";
import type { ConnectionStep, FieldArgs } from "grafast";
import type {
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLNamedType,
} from "graphql";
import { OperatorsCategory } from "./interfaces";
import { makeAssertAllowed } from "./utils";

const { version } = require("../package.json"); // eslint-disable-line

type AnyCodec = PgCodec<any, any, any, any, any, any, any>;

const isSuitableForFiltering = (
  build: GraphileBuild.Build,
  codec: AnyCodec
): boolean =>
  codec !== build.dataplanPg.TYPES.void &&
  !codec.attributes &&
  !codec.isAnonymous &&
  !codec.polymorphism &&
  (!codec.arrayOfCodec || isSuitableForFiltering(build, codec.arrayOfCodec)) &&
  (!codec.domainOfCodec || isSuitableForFiltering(build, codec.domainOfCodec));

export const PgConnectionArgFilterPlugin: GraphileConfig.Plugin = {
  name: "PgConnectionArgFilterPlugin",
  version,

  // after: ["PgTypesPlugin", "PgCodecsPlugin", "PgCodecs"],
  /*
  gather: {
    hooks: {
      pgProcedures_functionSource_options(info, event) {
        if (info.resolvedPreset.schema) {
          const {
            connectionFilterComputedColumns,
            connectionFilterSetofFunctions,
          } = info.resolvedPreset.schema;
          if (
            event.pgProc.provolatile === "i" ||
            event.pgProc.provolatile === "s"
          ) {
            const args = event.pgProc.getArguments();
            if (args[0]?.type.getClass()) {
              if (connectionFilterComputedColumns) {
                if (!event.options.extensions) {
                  event.options.extensions = { tags: Object.create(null) };
                }
                // TODO: only do this if they've not added `-advanced:filter`?
                addBehaviorToTags(
                  event.options.extensions.tags,
                  "advanced:filter"
                );
              }
            } else {
              if (connectionFilterSetofFunctions) {
                ...
              }
            }
          }
        }
      },
    },
  },
  */

  schema: {
    entityBehavior: {
      pgCodec: "filter",
      pgResource: {
        provides: ["inferred"],
        before: ["override"],
        after: ["default"],
        callback(behavior, entity, build) {
          if (entity.parameters) {
            return [
              behavior,
              // procedure sources aren't filterable by default (unless
              // connectionFilterSetofFunctions is set), but can be made filterable
              // by adding the `+filterProc` behavior.
              build.options.connectionFilterSetofFunctions
                ? "filterProc"
                : "-filterProc",
            ];
          } else {
            return ["filter", behavior];
          }
        },
      },
    },

    hooks: {
      build(build) {
        const {
          inflection,
          options: {
            connectionFilterAllowedFieldTypes,
            connectionFilterArrays,
          },
          EXPORTABLE,
        } = build;

        build.connectionFilterOperatorsDigest = (codec) => {
          const finalBuild = build as GraphileBuild.Build;
          const {
            dataplanPg: { getInnerCodec, TYPES, isEnumCodec },
          } = finalBuild;
          if (!isSuitableForFiltering(finalBuild, codec)) {
            // Not a base, domain, enum, or range type? Skip.
            return null;
          }

          // Perform some checks on the simple type (after removing array/range/domain wrappers)
          const pgSimpleCodec = getInnerCodec(codec);
          if (!pgSimpleCodec) return null;
          if (
            pgSimpleCodec.polymorphism ||
            pgSimpleCodec.attributes ||
            pgSimpleCodec.isAnonymous
          ) {
            // Haven't found an enum type or a non-array base type? Skip.
            return null;
          }
          if (pgSimpleCodec === TYPES.json) {
            // The PG `json` type has no valid operators.
            // Skip filter type creation to allow the proper
            // operators to be exposed for PG `jsonb` types.
            return null;
          }

          // TODO:v5: I'm unsure if this will work as before, e.g. it might not wrap with GraphQLList/GraphQLNonNull/etc
          // Establish field type and field input type
          const itemCodec = codec.arrayOfCodec ?? codec;
          const fieldTypeName = build.getGraphQLTypeNameByPgCodec!(
            itemCodec,
            "output"
          );
          if (!fieldTypeName) {
            return null;
          }
          const fieldTypeMeta = build.getTypeMetaByName(fieldTypeName);
          if (!fieldTypeMeta) {
            return null;
          }
          const fieldInputTypeName = build.getGraphQLTypeNameByPgCodec!(
            itemCodec,
            "input"
          );
          if (!fieldInputTypeName) return null;
          const fieldInputTypeMeta =
            build.getTypeMetaByName(fieldInputTypeName);
          if (!fieldInputTypeMeta) return null;

          // Avoid exposing filter operators on unrecognized types that PostGraphile handles as Strings
          const namedTypeName = fieldTypeName;
          const namedInputTypeName = fieldInputTypeName;
          const actualStringCodecs = [
            TYPES.bpchar,
            TYPES.char,
            TYPES.name,
            TYPES.text,
            TYPES.varchar,
            TYPES.citext,
          ];
          if (
            namedInputTypeName === "String" &&
            !actualStringCodecs.includes(pgSimpleCodec)
          ) {
            // Not a real string type? Skip.
            return null;
          }

          // Respect `connectionFilterAllowedFieldTypes` config option
          if (
            connectionFilterAllowedFieldTypes &&
            !connectionFilterAllowedFieldTypes.includes(namedTypeName)
          ) {
            return null;
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
            return null;
          }

          const rangeElementInputTypeName =
            codec.rangeOfCodec && !codec.rangeOfCodec.arrayOfCodec
              ? build.getGraphQLTypeNameByPgCodec!(codec.rangeOfCodec, "input")
              : null;

          const domainBaseTypeName =
            codec.domainOfCodec && !codec.domainOfCodec.arrayOfCodec
              ? build.getGraphQLTypeNameByPgCodec!(
                  codec.domainOfCodec,
                  "output"
                )
              : null;

          const listType = !!(
            codec.arrayOfCodec ||
            codec.domainOfCodec?.arrayOfCodec ||
            codec.rangeOfCodec?.arrayOfCodec
          );

          const operatorsTypeName = listType
            ? inflection.filterFieldListType(namedTypeName)
            : inflection.filterFieldType(namedTypeName);

          return {
            isList: listType,
            operatorsTypeName,
            relatedTypeName: namedTypeName,
            inputTypeName: fieldInputTypeName,
            rangeElementInputTypeName,
            domainBaseTypeName,
          };
        };

        build.escapeLikeWildcards = EXPORTABLE(
          () =>
            function (input) {
              if ("string" !== typeof input) {
                throw new Error(
                  "Non-string input was provided to escapeLikeWildcards"
                );
              } else {
                return input.split("%").join("\\%").split("_").join("\\_");
              }
            },
          []
        );

        return build;
      },

      init: {
        after: ["PgCodecs"],
        callback(_, build) {
          const { inflection } = build;

          // Create filter type for all column-having codecs
          for (const pgCodec of build.allPgCodecs) {
            if (!pgCodec.attributes) {
              continue;
            }
            const nodeTypeName = build.getGraphQLTypeNameByPgCodec(
              pgCodec,
              "output"
            );
            if (!nodeTypeName) {
              //console.log(`No node type name ${pgCodec.name}`);
              continue;
            }

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

          // Get or create types like IntFilter, StringFilter, etc.
          const codecsByFilterTypeName: {
            [typeName: string]: {
              isList: boolean;
              relatedTypeName: string;
              pgCodecs: PgCodec[];
              inputTypeName: string;
              rangeElementInputTypeName: string | null;
              domainBaseTypeName: string | null;
            };
          } = {};
          for (const codec of build.allPgCodecs) {
            const digest = build.connectionFilterOperatorsDigest(codec);
            if (!digest) {
              continue;
            }
            const {
              isList,
              operatorsTypeName,
              relatedTypeName,
              inputTypeName,
              rangeElementInputTypeName,
              domainBaseTypeName,
            } = digest;

            if (!codecsByFilterTypeName[operatorsTypeName]) {
              codecsByFilterTypeName[operatorsTypeName] = {
                isList,
                relatedTypeName,
                pgCodecs: [codec],
                inputTypeName,
                rangeElementInputTypeName,
                domainBaseTypeName,
              };
            } else {
              for (const key of [
                "isList",
                "relatedTypeName",
                "inputTypeName",
                "rangeElementInputTypeName",
              ] as const) {
                if (
                  digest[key] !== codecsByFilterTypeName[operatorsTypeName][key]
                ) {
                  throw new Error(
                    `${key} mismatch: existing codecs (${codecsByFilterTypeName[
                      operatorsTypeName
                    ].pgCodecs
                      .map((c) => c.name)
                      .join(", ")}) had ${key} = ${
                      codecsByFilterTypeName[operatorsTypeName][key]
                    }, but ${codec.name} instead has ${key} = ${digest[key]}`
                  );
                }
              }
              codecsByFilterTypeName[operatorsTypeName].pgCodecs.push(codec);
            }
          }

          for (const [
            operatorsTypeName,
            {
              isList,
              relatedTypeName,
              pgCodecs,
              inputTypeName,
              rangeElementInputTypeName,
              domainBaseTypeName,
            },
          ] of Object.entries(codecsByFilterTypeName)) {
            build.registerInputObjectType(
              operatorsTypeName,
              {
                pgConnectionFilterOperators: {
                  isList,
                  pgCodecs,
                  inputTypeName,
                  rangeElementInputTypeName,
                  domainBaseTypeName,
                },
                /*
              pgConnectionFilterOperatorsCategory,
              fieldType,
              fieldInputType,
              rangeElementInputType,
              domainBaseType,
              */
              },
              () => ({
                name: operatorsTypeName,
                description: `A filter to be used against ${relatedTypeName}${
                  isList ? " List" : ""
                } fields. All fields are combined with a logical ‘and.’`,
              }),
              "PgConnectionArgFilterPlugin"
            );
          }

          return _;
        },
      },

      // Add `filter` input argument to connection and simple collection types
      GraphQLObjectType_fields_field_args(args, build, context) {
        const {
          extend,
          inflection,
          options: {
            connectionFilterAllowNullInput,
            connectionFilterAllowEmptyObjectInput,
          },
          EXPORTABLE,
        } = build;
        const {
          scope: {
            isPgFieldConnection,
            isPgFieldSimpleCollection,
            pgFieldResource: resource,
            pgFieldCodec,
            fieldName,
          },
          Self,
        } = context;

        const shouldAddFilter =
          isPgFieldConnection || isPgFieldSimpleCollection;
        if (!shouldAddFilter) return args;

        const codec = (pgFieldCodec ?? resource?.codec) as PgCodec;
        if (!codec) return args;

        // Procedures get their own special behavior
        const desiredBehavior = resource?.parameters ? "filterProc" : "filter";

        // TODO: should factor in connectionFilterComputedColumns different.
        // 'queryField:list' and 'queryField:connection' behaviours are for setof functions.
        // 'typeField:list' and 'typeField:connection' behaviours are for computed attributes functions.

        if (
          resource
            ? !build.behavior.pgResourceMatches(resource, desiredBehavior)
            : !build.behavior.pgCodecMatches(codec, desiredBehavior)
        ) {
          /*
          console.log(`NO FILTER: ${source.name}`, {
            behavior,
            defaultBehavior,
          });
          */
          return args;
        }

        const returnCodec = codec;
        const nodeType = build.getGraphQLTypeByPgCodec(
          returnCodec,
          "output"
        ) as GraphQLOutputType & GraphQLNamedType;
        if (!nodeType) {
          return args;
        }
        const nodeTypeName = nodeType.name;
        const filterTypeName = inflection.filterType(nodeTypeName);

        const FilterType = build.getTypeByName(filterTypeName) as
          | GraphQLInputType
          | undefined;
        if (!FilterType) {
          return args;
        }

        const assertAllowed = makeAssertAllowed(build);

        const attributeCodec =
          resource?.parameters && !resource?.codec.attributes
            ? resource.codec
            : null;

        return extend(
          args,
          {
            filter: {
              description:
                "A filter to be used in determining which values should be returned by the collection.",
              type: FilterType,
              autoApplyAfterParentPlan: true,
              ...(isPgFieldConnection
                ? {
                    applyPlan: EXPORTABLE(
                      (assertAllowed, attributeCodec) =>
                        function (
                          _: any,
                          $connection: ConnectionStep<
                            any,
                            any,
                            any,
                            PgSelectStep
                          >,
                          fieldArgs: FieldArgs
                        ) {
                          assertAllowed(fieldArgs, "object");
                          const $pgSelect = $connection.getSubplan();
                          const $where = $pgSelect.wherePlan();
                          if (attributeCodec) {
                            $where.extensions.pgFilterAttribute = {
                              codec: attributeCodec,
                            };
                          }
                          const value = fieldArgs.getRaw().eval();
                          for (const key in value) {
                            if (value[key] !== undefined) {
                              fieldArgs.apply($where, [key]);
                            }
                          }
                        },
                      [assertAllowed, attributeCodec]
                    ),
                  }
                : {
                    applyPlan: EXPORTABLE(
                      (assertAllowed, attributeCodec) =>
                        function (
                          _: any,
                          $pgSelect: PgSelectStep,
                          fieldArgs: any
                        ) {
                          assertAllowed(fieldArgs, "object");
                          const $where = $pgSelect.wherePlan();
                          if (attributeCodec) {
                            $where.extensions.pgFilterAttribute = {
                              codec: attributeCodec,
                            };
                          }
                          const value = fieldArgs.getRaw().eval();
                          for (const key in value) {
                            if (value[key] !== undefined) {
                              fieldArgs.apply($where, [key]);
                            }
                          }
                        },
                      [assertAllowed, attributeCodec]
                    ),
                  }),
            },
          },
          `Adding connection filter arg to field '${fieldName}' of '${Self.name}'`
        );
      },
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
