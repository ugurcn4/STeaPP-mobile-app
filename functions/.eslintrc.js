module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  extends: [
    "eslint:recommended",
  ],
  rules: {
    "quotes": ["error", "double"],
    "indent": "off",
    "max-len": "off",
    "object-curly-spacing": "off",
    "comma-dangle": "off",
    "no-unused-vars": "off"
  },
  overrides: [
    {
      files: ["*.js"],
      excludedFiles: ["**/*.test.js"],
    }
  ],
};
