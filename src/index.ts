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
  makeApplyPlanFromOperatorSpec,
} from "./PgConnectionArgFilterOperatorsPlugin";
import { $$filters, OperatorsCategory } from "./interfaces";
import type { GraphQLInputType, GraphQLOutputType } from "graphql";
import type { PgResource, PgCodec, PgCodecAttribute } from "@dataplan/pg";

import type {} from "postgraphile/presets/v4";
import { AddConnectionFilterOperatorPlugin } from "./AddConnectionFilterOperatorPlugin";
import type { SQL } from "pg-sql2";

export { makeApplyPlanFromOperatorSpec };

declare module "@dataplan/pg" {
  interface PgConditionStepExtensions {
    pgFilterAttribute?: /** Filtering a column */
    | {
          attributeName: string;
          attribute: PgCodecAttribute;
          codec?: never;
          expression?: never;
        }
      | /** The incoming alias _is_ the column */ {
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
      connectionFilterOperatorsDigest(
        codec: PgCodec<any, any, any, any, any, any, any>
      ): {
        operatorsTypeName: string;
        relatedTypeName: string;
        isList: boolean;
        inputTypeName: string;
        rangeElementInputTypeName: string | null;
        domainBaseTypeName: string | null;
      } | null;
      escapeLikeWildcards(input: unknown): string;
      [$$filters]: Map<string, Map<string, OperatorSpec>>;
      addConnectionFilterOperator(
        typeName: string | string[],
        filterName: string,
        spec: OperatorSpec
      ): void;
    }
    interface ScopeInputObjectFieldsField {
      isPgConnectionFilterField?: boolean;
      isPgConnectionFilterManyField?: boolean;
      isPgConnectionFilterOperatorLogical?: boolean;
      isPgConnectionFilterOperator?: boolean;
    }
  }
}

export const PostGraphileConnectionFilterPreset: GraphileConfig.Preset = {
  plugins: [
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
