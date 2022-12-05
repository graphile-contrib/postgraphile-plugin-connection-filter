import { GraphQLInputType } from "graphql";
import { $$filters } from "./interfaces";
import { makeApplyPlanFromOperatorSpec } from "./PgConnectionArgFilterOperatorsPlugin";

const { version } = require("../package.json");

export const AddConnectionFilterOperatorPlugin: GraphileConfig.Plugin = {
  name: "AddConnectionFilterOperatorPlugin",
  version,

  schema: {
    hooks: {
      build(build) {
        const { inflection } = build;
        build[$$filters] = new Map();
        build.addConnectionFilterOperator = (typeName, filterName, spec) => {
          if (
            !build.status.isBuildPhaseComplete ||
            build.status.isInitPhaseComplete
          ) {
            throw new Error(
              `addConnectionFilterOperator may only be called during the 'init' phase`
            );
          }
          const filterTypeName = inflection.filterType(typeName);
          let operatorSpecByFilterName = build[$$filters]!.get(filterTypeName);
          if (!operatorSpecByFilterName) {
            operatorSpecByFilterName = new Map();
            build[$$filters]!.set(filterTypeName, operatorSpecByFilterName);
          }
          if (operatorSpecByFilterName.has(filterName)) {
            throw new Error(
              `Filter '${filterName}' already registered on '${filterTypeName}'`
            );
          }
          operatorSpecByFilterName.set(filterName, spec);
        };
        return build;
      },
      GraphQLInputObjectType_fields(inFields, build, context) {
        let fields = inFields;
        const {
          scope: { pgConnectionFilterOperators },
          Self,
          fieldWithHooks,
        } = context;
        if (!pgConnectionFilterOperators) {
          return fields;
        }
        const operatorSpecByFilterName = build[$$filters].get(Self.name);
        if (!operatorSpecByFilterName) {
          return fields;
        }
        const { inputTypeName, rangeElementInputTypeName } =
          pgConnectionFilterOperators;
        const rangeElementInputType = rangeElementInputTypeName
          ? (build.getTypeByName(rangeElementInputTypeName) as
              | GraphQLInputType
              | undefined)
          : null;
        const fieldInputType = build.getTypeByName(inputTypeName) as
          | GraphQLInputType
          | undefined;
        if (!fieldInputType) {
          return fields;
        }

        for (const [filterName, spec] of operatorSpecByFilterName.entries()) {
          const { description, resolveType } = spec;
          const type = resolveType
            ? resolveType(fieldInputType, rangeElementInputType)
            : fieldInputType;
          fields = build.extend(
            fields,
            {
              [filterName]: fieldWithHooks(
                {
                  fieldName: filterName,
                  isPgConnectionFilterOperator: true,
                },
                {
                  description,
                  type,
                  applyPlan: makeApplyPlanFromOperatorSpec(build, spec),
                }
              ),
            },
            ""
          );
        }

        return fields;
      },
    },
  },
};
