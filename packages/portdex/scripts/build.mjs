#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageRoot = path.join(__dirname, "..");
const distRoot = path.join(packageRoot, "dist");

const cliEntry = path.join(packageRoot, "bin", "portdex.js");
const indexEntry = path.join(packageRoot, "src", "index.js");

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(distRoot, { recursive: true });

build().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function build() {
  await Promise.all([
    esbuild.build({
      entryPoints: [cliEntry],
      bundle: true,
      format: "cjs",
      platform: "node",
      target: "node18",
      outfile: path.join(distRoot, "cli.cjs"),
      sourcemap: false,
      legalComments: "none",
      minify: true,
      packages: "external",
    }),

    esbuild.build({
      entryPoints: [indexEntry],
      bundle: true,
      format: "cjs",
      platform: "node",
      target: "node18",
      outfile: path.join(distRoot, "index.cjs"),
      sourcemap: false,
      legalComments: "none",
      minify: true,
      packages: "external",
    }),
  ]);

  fs.writeFileSync(
    path.join(distRoot, "cli.mjs"),
    [
      "#!/usr/bin/env node",
      "import { createRequire } from 'node:module';",
      "const require = createRequire(import.meta.url);",
      "require('./cli.cjs');",
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o755 },
  );

  fs.writeFileSync(
    path.join(distRoot, "index.mjs"),
    [
      "#!/usr/bin/env node",
      "import { createRequire } from 'node:module';",
      "const require = createRequire(import.meta.url);",
      "require('./index.cjs');",
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o755 },
  );

  console.log("✓ Build complete");
}
