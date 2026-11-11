import fs from "fs";
import path from "path";
import YAML from "yamljs";

let cachedSpec: Record<string, unknown> | null = null;

/**
 * Resolves the OpenAPI YAML specification file path across monorepo dev, compiled dist,
 * and Docker container layouts.
 */
export function resolveOpenApiSpecPath(): string {
  const candidates = [
    path.resolve(__dirname, "../../../../docs/openapi.yaml"),
    path.resolve(__dirname, "../../../docs/openapi.yaml"),
    path.resolve(__dirname, "../../docs/openapi.yaml"),
    path.resolve(process.cwd(), "docs/openapi.yaml"),
    path.resolve(process.cwd(), "../../docs/openapi.yaml"),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`OpenAPI specification not found. Searched: ${candidates.join(", ")}`);
  }
  return found;
}

/**
 * Loads and caches the parsed OpenAPI specification object from `docs/openapi.yaml`.
 */
export function loadOpenApiSpec(forceReload = false): Record<string, unknown> {
  if (!cachedSpec || forceReload) {
    const specPath = resolveOpenApiSpecPath();
    cachedSpec = YAML.load(specPath) as Record<string, unknown>;
  }
  return cachedSpec;
}
