import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const asyncEffectFiles = [
  "src/app/admin/overview/page.tsx",
  "src/app/student/notes/**/flashcard/page.tsx",
  "src/components/layout/Sidebar.tsx",
  "src/context/SidebarContext.tsx",
  "src/hooks/useFlashcards.ts",
  "src/hooks/useQuiz.ts",
];

const mongooseBoundaryFiles = [
  "src/server/models/Intelligence.ts",
  "src/server/models/User.ts",
  "src/server/repositories/auditLog.repo.ts",
  "src/server/repositories/intelligence.repo.ts",
  "src/server/repositories/user.repo.ts",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // These components intentionally hydrate persisted UI state or start
  // asynchronous API reads from effects. The rule treats the called helper's
  // initial loading-state update as synchronous even though the actual data
  // updates occur in promise callbacks. Keep the exception narrow.
  {
    files: asyncEffectFiles,
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },

  // Mongoose Mixed fields and lean-document adapters are runtime boundaries.
  // They remain isolated here instead of weakening strict typing application-wide.
  {
    files: mongooseBoundaryFiles,
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  {
    files: ["jest.config.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  globalIgnores([
    ".knowledge-ui-backup/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    ".intelligence-upgrade-backup/**",
    ".route-slug-backup/**",
    ".deployment-fix-backup/**",
  ]),
]);

export default eslintConfig;
