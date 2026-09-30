// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // `ignores` is only global when it is the sole key in its object, so this
    // stays separate from the `files`-scoped block below.
    // `.expo/` holds generated types (e.g. `types/router.d.ts`) that are
    // rewritten on every dev-server start, so they are not app source.
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // The asset generator is a plain Node script, not app code.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly' },
    },
  },
  {
    rules: {
      /**
       * Reanimated's `useSharedValue` returns a box whose `.value` is meant to
       * be assigned. The React Compiler's ESLint rules treat a value returned
       * from a hook as immutable, so every `sharedValue.value = withSpring(...)`
       * — the documented API — is reported. Type-aware linting does not help
       * here: the compiler's inference is what objects, not the type checker.
       */
      'react-hooks/immutability': 'off',
    },
  },
]);
