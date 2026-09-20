import { defineConfig, loadEnv, mergeConfig, type Plugin, type UserConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import anaConfig from './vite.config';

// Ana admin paneli (admin.likyakuyum.com) için ayrı build: giriş admin.html, çıktı dist-admin/.
// Kullanıcı uygulamasının build'ine (vite.config.ts → dist/) admin kodu hiç girmez.
//   npm run dev:admin   → http://localhost:3001
//   npm run build:admin → dist-admin/ (IIS'te ayrı sitenin kök klasörü)

const adminHtml = (): Plugin => ({
  name: 'likya-admin-html',
  // Geliştirmede tüm sayfa istekleri admin.html'e düşsün (SPA yönlendirmesi)
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url || '';
      if (req.method === 'GET' && req.headers.accept?.includes('text/html') && !url.startsWith('/api')) {
        req.url = '/admin.html';
      }
      next();
    });
  },
  // IIS varsayılan belgesi ve SPA yönlendirmesi index.html beklediği için çıktıyı yeniden adlandır
  closeBundle() {
    const cikti = path.resolve(__dirname, 'dist-admin');
    const kaynak = path.join(cikti, 'admin.html');
    if (fs.existsSync(kaynak)) fs.renameSync(kaynak, path.join(cikti, 'index.html'));
  }
});

export default defineConfig((ortam) => {
  const env = loadEnv(ortam.mode, process.cwd(), '');
  const backendOrigin = env.VITE_BACKEND_ORIGIN || 'http://localhost:5000';
  const ana = (anaConfig as (o: typeof ortam) => UserConfig)(ortam);

  return mergeConfig(
    { ...ana, server: undefined, build: undefined },
    {
      plugins: [adminHtml()],
      publicDir: 'public-admin',
      build: {
        outDir: 'dist-admin',
        emptyOutDir: true,
        chunkSizeWarningLimit: 2000,
        rollupOptions: { input: path.resolve(__dirname, 'admin.html') }
      },
      server: {
        port: 3001,
        strictPort: true,
        open: false,
        proxy: {
          '/api/v1/admin': { target: backendOrigin, changeOrigin: false, secure: false }
        }
      }
    } satisfies UserConfig
  );
});
