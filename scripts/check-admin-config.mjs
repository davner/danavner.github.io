#!/usr/bin/env node
/**
 * Validates public/admin/config.yml against the JSON schema Sveltia CMS ships.
 *
 *   node scripts/check-admin-config.mjs
 *
 * The config is the one file the build does not touch: it is served as-is from
 * public/, so a typo'd widget name or a misplaced key would deploy silently and
 * only surface as an error screen at /admin/ sign-in. This check fails CI
 * instead, using the schema from the @sveltia/cms package itself.
 *
 * That devDependency is pinned to the exact version the admin page loads -
 * public/admin/index.html fixes the CMS bundle by version and SRI hash - so the
 * schema checked here is the schema the running CMS actually enforces. Bump the
 * two together: the script tag and its hash in index.html, and the @sveltia/cms
 * version in package.json.
 */
import { readFileSync } from "node:fs";

import Ajv from "ajv";
import { load as parseYaml } from "js-yaml";

const CONFIG_PATH = "public/admin/config.yml";
const SCHEMA_PATH = "node_modules/@sveltia/cms/schema/sveltia-cms.json";

const config = parseYaml(readFileSync(CONFIG_PATH, "utf8"));

let schema;
try {
  schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
} catch {
  console.error(`${SCHEMA_PATH} is missing - run \`npm ci\` first.`);
  process.exit(1);
}

// The shipped schema declares draft-07, which is the default Ajv class. Strict
// mode is off because the schema carries editor-tooling keywords
// (`markdownDescription`) strict Ajv rejects, and the logger is off because
// Ajv otherwise warns once per `format: regex` it does not ship - the schema
// is Sveltia's to lint, not ours.
const ajv = new Ajv({ allErrors: true, strict: false, logger: false });
const validate = ajv.compile(schema);

if (!validate(config)) {
  console.error(`${CONFIG_PATH} does not match the Sveltia CMS schema:`);
  for (const error of validate.errors) {
    // "must NOT have additional properties" without the property is useless;
    // the offending key lives in params.
    const detail = error.params?.additionalProperty ? ` (${error.params.additionalProperty})` : "";
    console.error(`  ${error.instancePath || "/"}: ${error.message}${detail}`);
  }
  process.exit(1);
}

console.log(`${CONFIG_PATH} matches the @sveltia/cms schema.`);
