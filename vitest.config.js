import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  test: {
    environment: 'jsdom',
    include: ['tests/client/**/*.test.{js,jsx}'],
    setupFiles: ['tests/client/setup.js'],
    retry: 0,
  },
});
