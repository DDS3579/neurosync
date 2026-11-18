import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".mjs") && context.parentURL) {
      const base = dirname(fileURLToPath(context.parentURL));
      const candidate = resolve(base, `${specifier}.ts`);
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/run-ts.mjs <script.ts>");
  process.exit(1);
}

await import(pathToFileURL(resolve(process.cwd(), target)).href);
