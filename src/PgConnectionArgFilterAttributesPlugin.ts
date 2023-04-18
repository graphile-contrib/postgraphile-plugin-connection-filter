import { PgConditionStep, PgCodecWithAttributes } from "@dataplan/pg";

const { version } = require("../package.json");

export const PgConnectionArgFilterAttributesPlugin: GraphileConfig.Plugin = {
  name: "PgConnectionArgFilterAttributesPlugin",
  version,

  schema: {
    hooks: {
      GraphQLInputObjectType_fields(inFields, build, context) {
        let fields = inFields;
        const { extend, sql, inflection, connectionFilterOperatorsDigest } =
          build;
        const {
          fieldWithHooks,
          scope: { pgCodec: rawCodec, isPgConnectionFilter },
          Self,
        } = context;

        if (!isPgConnectionFilter || !rawCodec || !rawCodec.attributes) {
          return fields;
        }
        const codec = rawCodec as PgCodecWithAttributes;

        for (const [attributeName, attribute] of Object.entries(
          codec.attributes
        )) {
          const behavior = build.pgGetBehavior([
            attribute.codec.extensions,
            attribute.extensions,
          ]);
          if (!build.behavior.matches(behavior, "filter", "filter")) {
            continue;
          }
          const colSpec = { attributeName, attribute };
          const fieldName = inflection.attribute({ codec, attributeName });
          const digest = connectionFilterOperatorsDigest(attribute.codec);
          if (!digest) {
            continue;
          }
          const OperatorsType = build.getTypeByName(digest.operatorsTypeName);
          if (!OperatorsType) {
            continue;
          }
          const {
            connectionFilterAllowEmptyObjectInput,
            connectionFilterAllowNullInput,
          } = build.options;
          fields = build.extend(
            fields,
            {
              [fieldName]: fieldWithHooks(
                {
                  fieldName,
                  isPgConnectionFilterField: true,
                },
                () => ({
                  description: `Filter by the object’s \`${fieldName}\` field.`,
                  type: OperatorsType,
                  applyPlan($where: PgConditionStep<any>, fieldArgs) {
                    const $raw = fieldArgs.getRaw();
                    if ($raw.evalIs(undefined)) {
                      return;
                    }
                    if (
                      !connectionFilterAllowEmptyObjectInput &&
                      "evalIsEmpty" in $raw &&
                      $raw.evalIsEmpty()
                    ) {
                      throw Object.assign(
                        new Error(
                          "Empty objects are forbidden in filter argument input."
                        ),
                        {
                          //TODO: mark this error as safe
                        }
                      );
                    }
                    if (!connectionFilterAllowNullInput && $raw.evalIs(null)) {
                      throw Object.assign(
                        new Error(
                          "Null literals are forbidden in filter argument input."
                        ),
                        {
                          //TODO: mark this error as safe
                        }
                      );
                    }
                    const $col = new PgConditionStep($where);
                    $col.extensions.pgFilterAttribute = colSpec;
                    fieldArgs.apply($col);
                  },
                })
              ),
            },
            "Adding attribute-based filtering"
          );
        }

        return fields;
      },
    },
  },
};
