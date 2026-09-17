import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), cloudflare()],
  resolve: {
    alias: {
      '@appdeploy/client': fileURLToPath(new URL('./src/api.ts', import.meta.url)),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      maxParallelFileOps: 128,
    },
  },
});
