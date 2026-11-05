import { profileBehaviorString } from "./utils";
import { version } from "./version";

/**
 * A valid behavior string segment: starts with a letter and continues with
 * letters, digits and single underscores.
 */
const PROFILE_NAME_REGEX = /^[a-zA-Z](_?[a-zA-Z0-9]+)*$/;

/**
 * Rules out values that would produce an invalid behavior string, and profiles
 * that could never add an operator.
 */
function assertProfiles(profiles: Record<string, string[]>): void {
  for (const [profile, operators] of Object.entries(profiles)) {
    if (!PROFILE_NAME_REGEX.test(profile)) {
      throw new Error(
        `Invalid operator profile name "${profile}" in makeFilterOperatorProfilesPlugin: a profile name becomes the behavior string "attribute:filterBy:<profile>", so it must be an alphanumeric segment starting with a letter.`
      );
    }
    if (!Array.isArray(operators) || operators.length === 0) {
      throw new Error(
        `Operator profile "${profile}" in makeFilterOperatorProfilesPlugin lists no operators; a profile exists to add operators to the base set.`
      );
    }
    for (const operatorName of operators) {
      if (typeof operatorName !== "string" || operatorName.length === 0) {
        throw new Error(
          `Operator profile "${profile}" in makeFilterOperatorProfilesPlugin contains an invalid operator name (${JSON.stringify(
            operatorName
          )}).`
        );
      }
    }
  }
}

/**
 * Registers the named operator profiles with the connection filter plugin.
 *
 * A profile maps to the canonical names of the operators its filter input type
 * adds to the base set (the set limited by `connectionFilterAllowedOperators`,
 * or all operators if that option is not set). A column opts into a profile
 * with the behavior `attribute:filterBy:<profile>`; profiles are off by
 * default. Columns without a profile keep the shared per-scalar filter type.
 *
 * Call this factory once with every profile: the returned plugin registers a
 * behavior string per profile, and graphile-config does not allow two plugins
 * with the same name.
 *
 * The plugin does not check indexes: the behavior is the configuration's
 * promise that an access path exists.
 */
export function makeFilterOperatorProfilesPlugin(
  profiles: Record<string, string[]>
): GraphileConfig.Plugin {
  assertProfiles(profiles);
  const profileNames = Object.keys(profiles);

  const behaviorRegistryAdd: Partial<
    Record<
      keyof GraphileBuild.BehaviorStrings,
      {
        description: string;
        entities: ReadonlyArray<keyof GraphileBuild.BehaviorEntities>;
      }
    >
  > = {};
  for (const profile of profileNames) {
    behaviorRegistryAdd[profileBehaviorString(profile)] = {
      description: `Does this column's filter field offer the "${profile}" operator profile in addition to the base operators?`,
      entities: ["pgCodecAttribute"],
    };
  }

  return {
    name: "PgConnectionArgFilterOperatorProfilesPlugin",
    version,

    schema: {
      behaviorRegistry: {
        add: behaviorRegistryAdd,
      },

      entityBehavior: {
        pgCodecAttribute: {
          inferred: {
            // Registered behaviors are enabled by default; a profile is a
            // promise about an access path, so it stays off until the column's
            // behavior turns it on. This runs after the other inferred
            // behaviors so that its negatives win.
            after: ["inferred"],
            provides: ["postInferred"],
            callback(behavior) {
              return [
                behavior,
                ...profileNames.map(
                  (profile) =>
                    `-${profileBehaviorString(profile)}` as GraphileBuild.BehaviorString
                ),
              ];
            },
          },
        },
      },

      hooks: {
        build(build) {
          if (build.connectionFilterOperatorProfiles) {
            throw new Error(
              "makeFilterOperatorProfilesPlugin was added to the preset more than once; profiles are one schema-wide map, so merge the maps into a single factory call."
            );
          }
          build.connectionFilterOperatorProfiles = new Map(
            Object.entries(profiles).map(([profile, operators]) => [
              profile,
              [...operators],
            ])
          );
          return build;
        },
      },
    },
  };
}
