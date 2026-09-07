import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendOrigin = env.VITE_BACKEND_ORIGIN || 'http://localhost:5000';

  return {
    plugins: [react(), tsconfigPaths()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'components': path.resolve(__dirname, './src/components'),
        'layouts': path.resolve(__dirname, './src/layouts'),
        'routes': path.resolve(__dirname, './src/routes'),
        'styles': path.resolve(__dirname, './src/styles'),
        'store': path.resolve(__dirname, './src/store'),
        'hooks': path.resolve(__dirname, './src/hooks'),
        'types': path.resolve(__dirname, './src/types'),
        'helper': path.resolve(__dirname, './src/helper'),
        'data': path.resolve(__dirname, './src/data'),
        'app.config': path.resolve(__dirname, './src/app.config.ts')
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          silenceDeprecations: [
            'import',
            'global-builtin',
            'color-functions',
            'mixed-decls',
            'legacy-js-api',
            'slash-div'
          ],
          quietDeps: true,
          loadPaths: [path.resolve(__dirname, 'node_modules')]
        }
      }
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom', 'react-bootstrap', '@reduxjs/toolkit', 'react-redux']
          }
        }
      }
    },
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api': {
          target: backendOrigin,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  };
});
