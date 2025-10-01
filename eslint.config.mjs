import config from "@feathers-community/eslint-config";

export default config(
  {
    tsconfig: { path: "./tsconfig.eslint.json" },
  },
  // additional rules for source files
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          // "node:" protocol imports are not supported in some environments
          patterns: [{ regex: "^node:" }],
        },
      ],
    },
  },
);
