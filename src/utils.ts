import type {
  PgCodec,
  PgRegistry,
  PgResource,
  PgResourceParameter,
} from "@dataplan/pg";
import type { FieldArgs } from "grafast";
import type { GraphileBuild } from "graphile-build";
import type {} from "graphile-build-pg";
import { EXPORTABLE } from "graphile-export";

export function isComputedScalarAttributeResource(
  s: PgResource<any, any, any, any, any>
): s is PgResource<
  string,
  PgCodec,
  never[],
  PgResourceParameter[],
  PgRegistry
> {
  if (!s.parameters || s.parameters.length < 1) {
    return false;
  }
  if (s.codec.attributes) {
    return false;
  }
  if (!s.isUnique) {
    return false;
  }
  const firstParameter = s.parameters[0] as PgResourceParameter;
  if (!firstParameter?.codec.attributes) {
    return false;
  }
  return true;
}

export function getComputedAttributeResources(
  build: GraphileBuild.Build,
  source: PgResource
) {
  const computedAttributeSources = (
    Object.values(build.input.pgRegistry.pgResources) as PgResource[]
  ).filter(
    (
      s
    ): s is PgResource<
      string,
      PgCodec,
      never[],
      PgResourceParameter[],
      PgRegistry
    > =>
      isComputedScalarAttributeResource(s) &&
      s.parameters[0].codec === source.codec
  );
  return computedAttributeSources;
}

// TODO: rename. (Checks that the arguments aren't null/empty.)
export function makeAssertAllowed(options: GraphileBuild.SchemaOptions) {
  const {
    connectionFilterAllowNullInput,
    connectionFilterAllowEmptyObjectInput,
  } = options;
  const assertAllowed = EXPORTABLE(
    (connectionFilterAllowEmptyObjectInput, connectionFilterAllowNullInput) =>
      function (fieldArgs: FieldArgs, mode: "list" | "object" | "scalar") {
        const $raw = fieldArgs.getRaw();
        if (
          mode === "object" &&
          !connectionFilterAllowEmptyObjectInput &&
          "evalIsEmpty" in $raw &&
          $raw.evalIsEmpty()
        ) {
          throw Object.assign(
            new Error("Empty objects are forbidden in filter argument input."),
            {
              //TODO: mark this error as safe
            }
          );
        }
        if (
          mode === "list" &&
          !connectionFilterAllowEmptyObjectInput &&
          "evalLength" in $raw
        ) {
          const l = $raw.evalLength();
          if (l != null) {
            for (let i = 0; i < l; i++) {
              const $entry = $raw.at(i);
              if ("evalIsEmpty" in $entry && $entry.evalIsEmpty()) {
                throw Object.assign(
                  new Error(
                    "Empty objects are forbidden in filter argument input."
                  ),
                  {
                    //TODO: mark this error as safe
                  }
                );
              }
            }
          }
        }
        // For all modes, check null
        if (!connectionFilterAllowNullInput && $raw.evalIs(null)) {
          throw Object.assign(
            new Error("Null literals are forbidden in filter argument input."),
            {
              //TODO: mark this error as safe
            }
          );
        }
      },
    [connectionFilterAllowEmptyObjectInput, connectionFilterAllowNullInput]
  );
  return assertAllowed;
}
