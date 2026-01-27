import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: true,
      },
      // Vite automatically exposes all VITE_* environment variables via import.meta.env
      // No need to explicitly define them here unless overriding is required
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});