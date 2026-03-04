import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.vitest.{js,mjs}'],
    environment: 'node',
    globals: true,
  },
});
