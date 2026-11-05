import type {
  PgSelectStep,
  PgCodec,
  PgCodecWithAttributes,
  PgSelectQueryBuilder,
} from "@dataplan/pg";
import type { ConnectionStep, FieldArg } from "grafast";
import type {
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLNamedType,
} from "graphql";
import { OperatorsCategory } from "./interfaces";
import {
  describeColumn,
  getActiveOperatorProfiles,
  makeAssertAllowed,
} from "./utils";

import { version } from "./version";

type AnyCodec = PgCodec<any, any, any, any, any, any, any>;

type OperatorFilterDigest = NonNullable<
  ReturnType<GraphileBuild.Build["connectionFilterOperatorsDigest"]>
>;

/**
 * Whether the codec filters list values (a plain array, or an array wrapped in
 * a domain or range).
 */
const isListCodec = (codec: AnyCodec): boolean =>
  !!(
    codec.arrayOfCodec ||
    codec.domainOfCodec?.arrayOfCodec ||
    codec.rangeOfCodec?.arrayOfCodec
  );

/**
 * Why `connectionFilterOperatorsDigest` returned null for this codec, in the
 * words of the setting the reader should look at.
 */
const describeNoFilterReason = (
  build: GraphileBuild.Build,
  codec: AnyCodec
): string => {
  const { connectionFilterAllowedFieldTypes, connectionFilterArrays } =
    build.options;
  const itemCodec = codec.arrayOfCodec ?? codec;
  const namedTypeName = build.getGraphQLTypeNameByPgCodec(itemCodec, "output");
  if (
    connectionFilterAllowedFieldTypes &&
    namedTypeName &&
    !connectionFilterAllowedFieldTypes.includes(namedTypeName)
  ) {
    return `"connectionFilterAllowedFieldTypes" does not include the GraphQL type "${namedTypeName}"`;
  }
  if (isListCodec(codec) && connectionFilterArrays === false) {
    return `"connectionFilterArrays" is false for its list type`;
  }
  return `its type "${codec.name}" has no filter operators`;
};

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

declare global {
  namespace GraphileBuild {
    interface BehaviorStrings {
      filterProc: true;
    }
  }
}

export const PgConnectionArgFilterPlugin: GraphileConfig.Plugin = {
  name: "PgConnectionArgFilterPlugin",
  version,

  // Sometimes we want to order by things we filter by (e.g. if we're doing
  // fulltext search), so we should ensure that the filters are applied before
  // ordering.
  before: ["PgConnectionArgOrderByPlugin"],
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
    behaviorRegistry: {
      add: {
        filterProc: {
          description: "Can this function be filtered?",
          entities: ["pgResource"],
        },
        filter: {
          description: "Can this table be filtered?",
          entities: ["pgResource"],
        },
      },
    },

    entityBehavior: {
      pgCodec: "filter",
      pgResource: {
        inferred(behavior, entity, build) {
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

        build.connectionFilterOperatorsDigest = (codec, profile) => {
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

          const listType = isListCodec(codec);

          const operatorsTypeName = profile
            ? listType
              ? inflection.filterOperatorProfileListType(namedTypeName, profile)
              : inflection.filterOperatorProfileType(namedTypeName, profile)
            : listType
              ? inflection.filterFieldListType(namedTypeName)
              : inflection.filterFieldType(namedTypeName);

          return {
            isList: listType,
            operatorsTypeName,
            relatedTypeName: namedTypeName,
            inputTypeName: fieldInputTypeName,
            rangeElementInputTypeName,
            domainBaseTypeName,
            profile,
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

          // Filter type names already taken by object types, so a profile type
          // can report a name collision instead of graphile-build's generic
          // "two entities ... same type" message.
          const reservedFilterTypeNames = new Map<string, string>();

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
            reservedFilterTypeNames.set(
              filterTypeName,
              `the connection filter type of the "${nodeTypeName}" object type`
            );
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

          // Collect every per-scalar filter type (base and profile) keyed by
          // its input type name, then register them in one pass.
          const filterTypeByTypeName: {
            [typeName: string]: {
              isList: boolean;
              relatedTypeName: string;
              pgCodecs: PgCodec[];
              inputTypeName: string;
              rangeElementInputTypeName: string | null;
              domainBaseTypeName: string | null;
              profile: string | undefined;
              baseOperatorsTypeName: string | undefined;
              exampleColumn: string | undefined;
            };
          } = {};

          const addFilterType = (
            codec: PgCodec,
            digest: OperatorFilterDigest,
            exampleColumn?: string
          ) => {
            const {
              isList,
              operatorsTypeName,
              relatedTypeName,
              inputTypeName,
              rangeElementInputTypeName,
              domainBaseTypeName,
              profile,
            } = digest;
            const existing = filterTypeByTypeName[operatorsTypeName];
            const baseOperatorsTypeName =
              profile === undefined
                ? undefined
                : isList
                  ? inflection.filterFieldListType(relatedTypeName)
                  : inflection.filterFieldType(relatedTypeName);

            if (profile !== undefined) {
              const reservedBy = reservedFilterTypeNames.get(operatorsTypeName);
              if (reservedBy !== undefined) {
                throw new Error(
                  `Operator profile "${profile}" generates filter type name "${operatorsTypeName}" for "${relatedTypeName}" fields, which is already ${reservedBy}; choose another profile name or override filterOperatorProfileType/filterOperatorProfileListType.`
                );
              }
              if (existing && existing.profile !== profile) {
                throw new Error(
                  existing.profile === undefined
                    ? `Operator profile "${profile}" generates filter type name "${operatorsTypeName}" for "${relatedTypeName}" fields, which is already the base filter type for "${existing.relatedTypeName}${
                        existing.isList ? " List" : ""
                      }" fields; choose another profile name or override filterOperatorProfileType/filterOperatorProfileListType.`
                    : `Operator profiles "${existing.profile}" and "${profile}" both generate filter type name "${operatorsTypeName}"; choose profile names whose upper-camel forms are distinct or override filterOperatorProfileType/filterOperatorProfileListType.`
                );
              }
            }

            const entry = {
              isList,
              relatedTypeName,
              inputTypeName,
              rangeElementInputTypeName,
              domainBaseTypeName,
              profile,
              baseOperatorsTypeName,
            };

            if (!existing) {
              filterTypeByTypeName[operatorsTypeName] = {
                ...entry,
                pgCodecs: [codec],
                exampleColumn,
              };
              return;
            }

            for (const key of [
              "isList",
              "relatedTypeName",
              "inputTypeName",
              "rangeElementInputTypeName",
              "profile",
              "baseOperatorsTypeName",
            ] as const) {
              if (entry[key] !== existing[key]) {
                throw new Error(
                  `${key} mismatch for filter type "${operatorsTypeName}": existing codecs (${existing.pgCodecs
                    .map((c) => c.name)
                    .join(", ")}) had ${key} = ${existing[key]}, but ${
                    codec.name
                  } instead has ${key} = ${entry[key]}`
                );
              }
            }
            existing.pgCodecs.push(codec);
          };

          for (const codec of build.allPgCodecs) {
            const digest = build.connectionFilterOperatorsDigest(codec);
            if (digest) {
              addFilterType(codec, digest);
            }
          }

          // Create a filter type for each operator profile that a column opts
          // into. A profile type exists only when used, so a schema that opts
          // no column in keeps the base schema.
          for (const rawCodec of build.allPgCodecs) {
            if (!rawCodec.attributes) {
              continue;
            }
            const codec = rawCodec as PgCodecWithAttributes;
            for (const [attributeName, attribute] of Object.entries(
              codec.attributes
            )) {
              const activeProfiles = getActiveOperatorProfiles(
                build,
                codec,
                attributeName
              );
              if (activeProfiles.length === 0) {
                continue;
              }
              const column = describeColumn(codec, attributeName);
              if (activeProfiles.length > 1) {
                throw new Error(
                  `Column ${column} opts into more than one operator profile (${activeProfiles.join(
                    ", "
                  )}); a filter field carries one input type, so remove all but one "attribute:filterBy:<profile>" behavior.`
                );
              }
              const profile = activeProfiles[0];
              if (
                !build.behavior.pgCodecAttributeMatches(
                  [codec, attributeName],
                  "attribute:filterBy"
                )
              ) {
                throw new Error(
                  `Column ${column} opts into operator profile "${profile}" but its filter is not published ("attribute:filterBy" is off); an operator profile adds operators to a filter field, so publish the filter as well.`
                );
              }
              const digest = build.connectionFilterOperatorsDigest(
                attribute.codec,
                profile
              );
              if (!digest) {
                throw new Error(
                  `Column ${column} opts into operator profile "${profile}" but ${describeNoFilterReason(
                    build,
                    attribute.codec
                  )}.`
                );
              }
              addFilterType(attribute.codec, digest, column);
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
              profile,
              baseOperatorsTypeName,
              exampleColumn,
            },
          ] of Object.entries(filterTypeByTypeName)) {
            build.registerInputObjectType(
              operatorsTypeName,
              {
                pgConnectionFilterOperators: {
                  isList,
                  pgCodecs,
                  inputTypeName,
                  rangeElementInputTypeName,
                  domainBaseTypeName,
                  profile,
                  baseOperatorsTypeName,
                  profileColumn: exampleColumn,
                },
              },
              () => ({
                name: operatorsTypeName,
                description:
                  profile === undefined
                    ? `A filter to be used against ${relatedTypeName}${
                        isList ? " List" : ""
                      } fields. All fields are combined with a logical ‘and.’`
                    : `A filter to be used against ${relatedTypeName}${
                        isList ? " List" : ""
                      } fields offering the "${profile}" operator profile in addition to the base operators. All fields are combined with a logical ‘and.’`,
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
          EXPORTABLE,
          dataplanPg: { PgCondition },
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
            [inflection.pgConnectionFilterBuiltin("filter")]: {
              description:
                "A filter to be used in determining which values should be returned by the collection.",
              type: FilterType,
              ...(isPgFieldConnection
                ? {
                    applyPlan: EXPORTABLE(
                      (PgCondition, assertAllowed, attributeCodec) =>
                        function (
                          _: any,
                          $connection: ConnectionStep<
                            any,
                            any,
                            any,
                            any,
                            any,
                            PgSelectStep
                          >,
                          fieldArg: FieldArg
                        ) {
                          const $pgSelect = $connection.getSubplan();
                          fieldArg.apply(
                            $pgSelect,
                            (
                              queryBuilder: PgSelectQueryBuilder,
                              value: object | null
                            ) => {
                              assertAllowed(value, "object");
                              if (value == null) return;
                              const condition = new PgCondition(queryBuilder);
                              if (attributeCodec) {
                                condition.extensions.pgFilterAttribute = {
                                  codec: attributeCodec,
                                };
                              }
                              return condition;
                            }
                          );
                        },
                      [PgCondition, assertAllowed, attributeCodec]
                    ),
                  }
                : {
                    applyPlan: EXPORTABLE(
                      (PgCondition, assertAllowed, attributeCodec) =>
                        function (
                          _: any,
                          $pgSelect: PgSelectStep,
                          fieldArg: FieldArg
                        ) {
                          fieldArg.apply(
                            $pgSelect,
                            (
                              queryBuilder: PgSelectQueryBuilder,
                              value: object | null
                            ) => {
                              assertAllowed(value, "object");
                              if (value == null) return;
                              const condition = new PgCondition(queryBuilder);
                              if (attributeCodec) {
                                condition.extensions.pgFilterAttribute = {
                                  codec: attributeCodec,
                                };
                              }
                              return condition;
                            }
                          );
                        },
                      [PgCondition, assertAllowed, attributeCodec]
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
