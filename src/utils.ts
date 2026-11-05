import type {
  PgCodec,
  PgCodecWithAttributes,
  PgRegistry,
  PgResource,
  PgResourceParameter,
} from "@dataplan/pg";
import type { GraphileBuild } from "graphile-build";
import type {} from "graphile-build-pg";

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

/**
 * A schema-qualified column label for configuration error messages.
 */
export function describeColumn(
  codec: PgCodec<any, any, any, any, any, any, any>,
  attributeName: string
): string {
  const pg = codec.extensions?.pg;
  const tableName =
    pg?.schemaName != null ? `${pg.schemaName}.${pg.name}` : codec.name;
  return `"${tableName}.${attributeName}"`;
}

/**
 * Returns the operator profiles the column's behavior opts into, in the order
 * the profiles were registered.
 */
export function getActiveOperatorProfiles(
  build: GraphileBuild.Build,
  codec: PgCodecWithAttributes,
  attributeName: string
): string[] {
  const profiles = build.connectionFilterOperatorProfiles;
  if (!profiles) {
    return [];
  }
  const activeProfiles: string[] = [];
  for (const profile of profiles.keys()) {
    if (
      build.behavior.pgCodecAttributeMatches(
        [codec, attributeName],
        `attribute:filterBy:${profile}`
      )
    ) {
      activeProfiles.push(profile);
    }
  }
  return activeProfiles;
}

// TODO: rename. (Checks that the arguments aren't null/empty.)
export function makeAssertAllowed(build: GraphileBuild.Build) {
  const { options, EXPORTABLE } = build;
  const {
    connectionFilterAllowNullInput,
    connectionFilterAllowEmptyObjectInput,
  } = options;
  const assertAllowed = EXPORTABLE(
    (
      connectionFilterAllowEmptyObjectInput,
      connectionFilterAllowNullInput,
      isEmpty
    ) =>
      function (value: unknown, mode: "list" | "object" | "scalar") {
        if (
          mode === "object" &&
          !connectionFilterAllowEmptyObjectInput &&
          isEmpty(value)
        ) {
          throw Object.assign(
            new Error("Empty objects are forbidden in filter argument input."),
            {
              //TODO: mark this error as safe
            }
          );
        }
        if (mode === "list" && !connectionFilterAllowEmptyObjectInput) {
          const arr = value as any[] | null | undefined;
          if (arr) {
            const l = arr.length;
            for (let i = 0; i < l; i++) {
              if (isEmpty(arr[i])) {
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
        if (!connectionFilterAllowNullInput && value === null) {
          throw Object.assign(
            new Error("Null literals are forbidden in filter argument input."),
            {
              //TODO: mark this error as safe
            }
          );
        }
      },
    [
      connectionFilterAllowEmptyObjectInput,
      connectionFilterAllowNullInput,
      isEmpty,
    ]
  );
  return assertAllowed;
}

export function isEmpty(o: unknown): o is Record<string, never> {
  return typeof o === "object" && o !== null && Object.keys(o).length === 0;
}
