import { PgSource, PgSourceParameter } from "@dataplan/pg";
import { GraphileBuild } from "graphile-build";
import type {} from "graphile-build-pg";

export function getComputedColumnSources(
  build: GraphileBuild.Build,
  source: PgSource<any, any, any, any>
) {
  const computedColumnSources = build.input.pgSources.filter((s) => {
    if (!s.parameters || s.parameters.length < 1) {
      return false;
    }
    if (s.codec.columns) {
      return false;
    }
    if (!s.isUnique) {
      return false;
    }
    if (s.codec.arrayOfCodec) {
      return false;
    }
    const firstParameter = s.parameters[0] as PgSourceParameter;
    if (firstParameter.codec !== source.codec) {
      return false;
    }
    return true;
  });
  return computedColumnSources;
}
