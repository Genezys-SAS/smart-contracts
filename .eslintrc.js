// eslint-disable-next-line no-undef
module.exports = {
  env: {
    browser: false,
  },
  ignorePatterns: ["dist/**/*", "openapi/*", "coverage/lcov-report/*"],
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
      plugins: ["jest", "prettier"],
      parserOptions: {
        // eslint-disable-next-line no-undef
        tsconfigRootDir: __dirname,
        project: ["tsconfig.json"],
      },
      rules: {
        "jest/no-disabled-tests": "warn",
        "jest/no-focused-tests": "error",
        "jest/no-identical-title": "error",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-empty-interface": "off",
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/explicit-function-return-type": ["error"],
        "@typescript-eslint/semi": ["error"],
        "no-warning-comments": ["error"],
        "@typescript-eslint/no-unused-vars": "error",
        "@typescript-eslint/no-explicit-any": "error",
      },
    },
  ],
};
