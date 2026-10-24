import { defineConfig, type ViteUserConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()] as ViteUserConfig['plugins'],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
