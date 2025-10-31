import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  publicDir: 'public',
  base: './', // Use relative paths for ingress compatibility
  build: {
    outDir: process.env.BUILD_OUT_DIR || '../rootfs/opt/logviewer/public',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 5173
  }
});
