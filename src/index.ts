import type {} from "graphile-build-pg";
import { ConnectionArgFilterPlugin } from "./ConnectionArgFilterPlugin";
import { PgConnectionArgFilterPlugin } from "./PgConnectionArgFilterPlugin";
import { PgConnectionArgFilterColumnsPlugin } from "./PgConnectionArgFilterColumnsPlugin";
import { PgConnectionArgFilterComputedColumnsPlugin } from "./PgConnectionArgFilterComputedColumnsPlugin";
import { PgConnectionArgFilterCompositeTypeColumnsPlugin } from "./PgConnectionArgFilterCompositeTypeColumnsPlugin";
import { PgConnectionArgFilterRecordFunctionsPlugin } from "./PgConnectionArgFilterRecordFunctionsPlugin";
import { PgConnectionArgFilterBackwardRelationsPlugin } from "./PgConnectionArgFilterBackwardRelationsPlugin";
import { PgConnectionArgFilterForwardRelationsPlugin } from "./PgConnectionArgFilterForwardRelationsPlugin";
import { PgConnectionArgFilterLogicalOperatorsPlugin } from "./PgConnectionArgFilterLogicalOperatorsPlugin";
import { PgConnectionArgFilterOperatorsPlugin } from "./PgConnectionArgFilterOperatorsPlugin";
import { OperatorsCategory } from "./interfaces";
import { GraphQLInputType, GraphQLNamedType, GraphQLOutputType } from "graphql";
import { PgSource, PgTypeCodec } from "@dataplan/pg";

declare global {
  namespace GraphileBuild {
    interface GraphileBuildSchemaOptions {
      connectionFilterAllowedOperators?: string[];
      connectionFilterAllowedFieldTypes?: string[];
      connectionFilterArrays?: boolean;
      connectionFilterComputedColumns?: boolean;
      connectionFilterOperatorNames?: boolean;
      connectionFilterRelations?: boolean;
      connectionFilterSetofFunctions?: boolean;
      connectionFilterLogicalOperators?: boolean;
      connectionFilterAllowNullInput?: boolean;
      connectionFilterAllowEmptyObjectInput?: boolean;
    }
    interface Inflection {
      filterType(this: Inflection, typeName: string): string;
      filterFieldType(this: Inflection, typeName: string): string;
      filterFieldListType(this: Inflection, typeName: string): string;
      filterManyType(
        this: Inflection,
        table: PgTypeCodec<any, any, any, any>,
        foreignTable: PgSource<any, any, any, any>
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
    }
    interface ScopeInputObject {
      isPgConnectionFilter?: boolean;
      isPgConnectionFilterOperators?: boolean;
      pgConnectionFilterOperatorsCategory?: OperatorsCategory;
      // TODO: rename these so they are scoped to this plugin!
      fieldType?: GraphQLOutputType;
      fieldInputType?: GraphQLInputType;
      rangeElementInputType?: GraphQLInputType;
      domainBaseType?: GraphQLOutputType;
      foreignTable?: PgSource<any, any, any, any>;
      isPgConnectionFilterMany?: boolean;
    }
    interface Build {
      connectionFilterOperatorsType(
        codec: PgTypeCodec<any, any, any, any>
      ): GraphQLInputType & GraphQLNamedType;
    }
    interface ScopeInputObjectFieldsField {
      isPgConnectionFilterField?: boolean;
    }
  }
}

export const PostGraphileConnectionFilterPreset: GraphileConfig.Preset = {
  plugins: [
    ConnectionArgFilterPlugin,
    PgConnectionArgFilterPlugin,
    PgConnectionArgFilterColumnsPlugin,
    PgConnectionArgFilterComputedColumnsPlugin,
    PgConnectionArgFilterCompositeTypeColumnsPlugin,
    PgConnectionArgFilterRecordFunctionsPlugin,
    //if (connectionFilterRelations)
    PgConnectionArgFilterBackwardRelationsPlugin,
    //if (connectionFilterRelations)
    PgConnectionArgFilterForwardRelationsPlugin,
    //if (connectionFilterLogicalOperators)
    PgConnectionArgFilterLogicalOperatorsPlugin,
    PgConnectionArgFilterOperatorsPlugin,
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
