import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/test/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
  },
});
