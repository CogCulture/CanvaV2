import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tauriMocks = path.resolve(__dirname, 'src/utils/tauri-mocks.ts');

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [tailwindcss(), react()],

  resolve: {
    alias: {
      // Map all tauri-mocks relative imports to the single source of truth
      // This catches any path variant: ./tauri-mocks, ../utils/tauri-mocks, ../../utils/tauri-mocks, etc.
      '@tauri-apps/api/tauri': tauriMocks,
      '@tauri-apps/api/window': tauriMocks,
      '@tauri-apps/api/app': tauriMocks,
      '@tauri-apps/api/dialog': tauriMocks,
      '@tauri-apps/api/os': tauriMocks,
      '@tauri-apps/api/process': tauriMocks,
      '@tauri-apps/api/event': tauriMocks,
      '@tauri-apps/api/path': tauriMocks,
      '@tauri-apps/plugin-dialog': tauriMocks,
      '@tauri-apps/plugin-os': tauriMocks,
      '@tauri-apps/plugin-process': tauriMocks,
      '@tauri-apps/plugin-shell': tauriMocks,
      // Absolute src alias
      '@': path.resolve(__dirname, 'src'),
    },
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    hmr: true,
    watch: {
      ignored: ['**/src-tauri/**', '**/pixlr-pro/**'],
    },
    // Proxy API requests to the Axum backend during development
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  
  optimizeDeps: {
    entries: ['index.html', 'src/**/*.{js,jsx,ts,tsx}'],
  },

  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: false,
  },
}));
