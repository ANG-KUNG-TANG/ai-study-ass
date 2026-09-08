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

  {
    files: asyncEffectFiles,
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },

  {
    files: ["jest.config.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  {
    files: mongooseBoundaryFiles,
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
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