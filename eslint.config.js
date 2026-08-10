import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Flat config, in three parts: the browser half (`src/`), the Node half (the
 * scripts, the Vite plugins, the config files and the Playwright suite), and
 * `eslint-config-prettier` last to switch off every stylistic rule.
 *
 * That last one matters. Formatting is Prettier's job and correctness is
 * ESLint's, and the two arguing over a line break is how a repo ends up with a
 * hook that reformats a file and then fails it.
 */
export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "playwright-report", "test-results"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2024,
      globals: {
        ...globals.browser,
        /** Injected by `define` in vite.config.ts - see src/vite-env.d.ts. */
        __LAST_UPDATED__: "readonly",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  {
    files: [
      "scripts/**/*.mjs",
      "tests/**/*.ts",
      "*.config.ts",
      "vite-plugin-*.ts",
      "eslint.config.js",
    ],
    languageOptions: {
      ecmaVersion: 2024,
      globals: { ...globals.node },
    },
  },

  /*
   * Scripts that drive a real browser. The callback passed to `page.evaluate`
   * is serialised and run in the page, so `document` and friends are defined
   * there and nowhere else in the file - which `no-undef` cannot see, since it
   * reads the file as the Node module it also is.
   *
   * The Playwright suite does the same thing and needs no equivalent, because
   * `no-undef` is off for TypeScript: the compiler already answers that
   * question, and better.
   */
  {
    files: ["scripts/make-site-card.mjs", "scripts/make-share-fallback.mjs"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },

  /*
   * The vendored shadcn components. They are ours to edit, but they are also
   * upstream's code, and holding them to rules the upstream does not follow
   * turns every `npx shadcn add` into a lint cleanup.
   */
  {
    files: ["src/components/ui/**"],
    rules: {
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      // Upstream's carousel syncs Embla into state on mount. Worth knowing
      // about in our own code; not worth diverging from upstream over.
      "react-hooks/set-state-in-effect": "off",
    },
  },

  prettier,
);
