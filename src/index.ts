import type {} from "graphile-build-pg";
import { ConnectionArgFilterPlugin } from "./ConnectionArgFilterPlugin";
import { PgConnectionArgFilterPlugin } from "./PgConnectionArgFilterPlugin";
import { PgConnectionArgFilterAttributesPlugin } from "./PgConnectionArgFilterAttributesPlugin";
import { PgConnectionArgFilterComputedAttributesPlugin } from "./PgConnectionArgFilterComputedAttributesPlugin";
import { PgConnectionArgFilterCompositeTypeAttributesPlugin } from "./PgConnectionArgFilterCompositeTypeAttributesPlugin";
import { PgConnectionArgFilterRecordFunctionsPlugin } from "./PgConnectionArgFilterRecordFunctionsPlugin";
import { PgConnectionArgFilterBackwardRelationsPlugin } from "./PgConnectionArgFilterBackwardRelationsPlugin";
import { PgConnectionArgFilterForwardRelationsPlugin } from "./PgConnectionArgFilterForwardRelationsPlugin";
import { PgConnectionArgFilterLogicalOperatorsPlugin } from "./PgConnectionArgFilterLogicalOperatorsPlugin";
import {
  OperatorSpec,
  PgConnectionArgFilterOperatorsPlugin,
  makeApplyFromOperatorSpec,
} from "./PgConnectionArgFilterOperatorsPlugin";
import { PgConnectionArgFilterInflectionPlugin } from "./PgConnectionArgFilterInflectionPlugin";
import { $$filters, OperatorsCategory } from "./interfaces";
import type { GraphQLInputType, GraphQLOutputType } from "graphql";
import type { PgResource, PgCodec, PgCodecAttribute } from "@dataplan/pg";

import type {} from "postgraphile/presets/v4";
import { AddConnectionFilterOperatorPlugin } from "./AddConnectionFilterOperatorPlugin";
import type { SQL } from "pg-sql2";
import { makeFilterOperatorProfilesPlugin } from "./PgConnectionArgFilterOperatorProfilesPlugin";

export { makeApplyFromOperatorSpec };
export { makeFilterOperatorProfilesPlugin };

declare global {
  namespace DataplanPg {
    interface PgConditionExtensions {
      pgFilterAttribute?: /** Filtering a column */
        | {
            fieldName: string;
            attributeName: string;
            attribute: PgCodecAttribute;
            codec?: never;
            expression?: never;
          }
        | /** The incoming alias _is_ the column */ {
            fieldName?: string;
            attributeName?: never;
            attribute?: never;
            codec: PgCodec<any, any, any, any, any, any, any>;
            expression?: SQL;
          };
      pgFilterRelation?: {
        tableExpression: SQL;
        alias?: string;
        localAttributes: string[];
        remoteAttributes: string[];
      };
    }
  }
}

declare module "postgraphile/presets/v4" {
  interface V4GraphileBuildOptions {
    connectionFilterAllowedOperators?: string[];
    connectionFilterAllowedFieldTypes?: string[];
    connectionFilterArrays?: boolean;
    connectionFilterComputedColumns?: boolean;
    connectionFilterOperatorNames?: Record<string, string>;
    connectionFilterRelations?: boolean;
    connectionFilterSetofFunctions?: boolean;
    connectionFilterLogicalOperators?: boolean;
    connectionFilterAllowNullInput?: boolean;
    connectionFilterAllowEmptyObjectInput?: boolean;
    pgIgnoreReferentialIntegrity?: boolean;
  }
}
declare global {
  namespace GraphileBuild {
    interface SchemaOptions {
      connectionFilterAllowedOperators?: string[];
      connectionFilterAllowedFieldTypes?: string[];
      connectionFilterArrays?: boolean;
      connectionFilterComputedColumns?: boolean;
      connectionFilterOperatorNames?: Record<string, string>;
      connectionFilterRelations?: boolean;
      connectionFilterSetofFunctions?: boolean;
      connectionFilterLogicalOperators?: boolean;
      connectionFilterAllowNullInput?: boolean;
      connectionFilterAllowEmptyObjectInput?: boolean;
      pgIgnoreReferentialIntegrity?: boolean;
    }
    interface Inflection {
      filterType(this: Inflection, typeName: string): string;
      filterFieldType(this: Inflection, typeName: string): string;
      filterFieldListType(this: Inflection, typeName: string): string;
      filterOperatorProfileType(
        this: Inflection,
        typeName: string,
        profile: string
      ): string;
      filterOperatorProfileListType(
        this: Inflection,
        typeName: string,
        profile: string
      ): string;
      filterManyType(
        this: Inflection,
        table: PgCodec<any, any, any, any, any, any, any>,
        foreignTable: PgResource<any, any, any, any>
      ): string;
      filterBackwardSingleRelationExistsFieldName(
        this: Inflection,
        relationFieldName: string
      ): string;
      filterBackwardManyRelationExistsFieldName(
        this: Inflection,
        relationFieldName: string
      ): string;
      filterSingleRelationByKeysBackwardsFieldName(
        this: Inflection,
        fieldName: string
      ): string;
      filterManyRelationByKeysFieldName(
        this: Inflection,
        fieldName: string
      ): string;
      filterForwardRelationExistsFieldName(relationFieldName: string): string;
      filterSingleRelationFieldName(fieldName: string): string;
    }
    interface ScopeInputObject {
      isPgConnectionFilter?: boolean;
      pgConnectionFilterOperators?: {
        isList: boolean;
        pgCodecs: ReadonlyArray<PgCodec<any, any, any, any, any, any, any>>;
        inputTypeName: string;
        rangeElementInputTypeName: string | null;
        domainBaseTypeName: string | null;
        /** Set when this is a profile type rather than the base type. */
        profile?: string;
        /**
         * On a profile type, the type name of the base filter for the same
         * column type. Operators added to the base type through
         * `addConnectionFilterOperator` also appear on the profile type.
         */
        baseOperatorsTypeName?: string;
        /** A column that opted into the profile; used in build error messages. */
        profileColumn?: string;
      };
      pgConnectionFilterOperatorsCategory?: OperatorsCategory;
      // TODO: rename these so they are scoped to this plugin!
      fieldType?: GraphQLOutputType;
      fieldInputType?: GraphQLInputType;
      rangeElementInputType?: GraphQLInputType;
      domainBaseType?: GraphQLOutputType;
      foreignTable?: PgResource<any, any, any, any>;
      isPgConnectionFilterMany?: boolean;
    }
    interface Build {
      /**
       * The operator profiles registered for this schema build, keyed by
       * profile name. Set by `makeFilterOperatorProfilesPlugin`.
       */
      connectionFilterOperatorProfiles?: Map<string, string[]>;
      connectionFilterOperatorsDigest(
        codec: PgCodec<any, any, any, any, any, any, any>,
        profile?: string
      ): {
        operatorsTypeName: string;
        relatedTypeName: string;
        isList: boolean;
        inputTypeName: string;
        rangeElementInputTypeName: string | null;
        domainBaseTypeName: string | null;
        profile?: string;
      } | null;
      escapeLikeWildcards(input: unknown): string;
      [$$filters]: Map<string, Map<string, OperatorSpec>>;
      addConnectionFilterOperator(
        typeName: string | string[],
        operatorName: string,
        spec: OperatorSpec
      ): void;
    }
    interface ScopeInputObjectFieldsField {
      pgFieldAttributeName?: string;
      isPgConnectionFilterField?: boolean;
      isPgConnectionFilterManyField?: boolean;
      isPgConnectionFilterOperatorLogical?: boolean;
      isPgConnectionFilterOperator?: boolean;
      pgConnectionFilterOperatorName?: string;
    }
  }
}

export const PostGraphileConnectionFilterPreset: GraphileConfig.Preset = {
  plugins: [
    PgConnectionArgFilterInflectionPlugin,
    ConnectionArgFilterPlugin,
    PgConnectionArgFilterPlugin,
    PgConnectionArgFilterAttributesPlugin,
    PgConnectionArgFilterComputedAttributesPlugin,
    PgConnectionArgFilterCompositeTypeAttributesPlugin,
    PgConnectionArgFilterRecordFunctionsPlugin,
    //if (connectionFilterRelations)
    PgConnectionArgFilterBackwardRelationsPlugin,
    //if (connectionFilterRelations)
    PgConnectionArgFilterForwardRelationsPlugin,
    //if (connectionFilterLogicalOperators)
    PgConnectionArgFilterLogicalOperatorsPlugin,
    PgConnectionArgFilterOperatorsPlugin,
    AddConnectionFilterOperatorPlugin,
  ],
  schema: {
    //connectionFilterAllowedOperators,
    //connectionFilterAllowedFieldTypes,
    connectionFilterArrays: true,
    connectionFilterComputedColumns: true,
    //connectionFilterOperatorNames,
    connectionFilterRelations: false,
    connectionFilterSetofFunctions: true,
    connectionFilterLogicalOperators: true,
    connectionFilterAllowNullInput: false,
    connectionFilterAllowEmptyObjectInput: false,
  },
};
