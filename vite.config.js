import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  build: {
    outDir: '../public',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        banker: resolve('client/banker.html'),
        player: resolve('client/player.html'),
        join: resolve('client/join.html'),
      },
    },
  },
});
