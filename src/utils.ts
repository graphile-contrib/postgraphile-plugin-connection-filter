import {
  PgCodec,
  PgRegistry,
  PgResource,
  PgResourceParameter,
} from "@dataplan/pg";
import { FieldArgs } from "grafast";
import { GraphileBuild } from "graphile-build";
import type {} from "graphile-build-pg";

export function getComputedAttributeResources(
  build: GraphileBuild.Build,
  source: PgResource
) {
  const computedAttributeSources = Object.values(
    build.input.pgRegistry.pgResources
  ).filter(
    (
      s
    ): s is PgResource<
      string,
      PgCodec,
      never[],
      PgResourceParameter[],
      PgRegistry
    > => {
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
      if (firstParameter.codec !== source.codec) {
        return false;
      }
      return true;
    }
  );
  return computedAttributeSources;
}

// TODO: rename. (Checks that the arguments aren't null/empty.)
export function makeAssertAllowed(options: GraphileBuild.SchemaOptions) {
  const {
    connectionFilterAllowNullInput,
    connectionFilterAllowEmptyObjectInput,
  } = options;
  const assertAllowed = (
    fieldArgs: FieldArgs,
    mode: "list" | "object" | "scalar"
  ) => {
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
  };
  return assertAllowed;
}
