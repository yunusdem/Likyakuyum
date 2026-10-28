import { defineConfig, loadEnv, mergeConfig, type Plugin, type UserConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import anaConfig from './vite.config';

// Destek ekibi paneli (destek.likyakuyum.com; docs/DESTEK_PANELI_YOL_HARITASI.md) için ayrı build: giriş destek.html, çıktı dist-destek/.
//   npm run dev:destek   → http://localhost:3005
//   npm run build:destek → dist-destek/ (IIS'te ayrı sitenin kök klasörü)

const destekHtml = (): Plugin => {
  let cikti = path.resolve(__dirname, 'dist-destek');
  return {
  name: 'likya-destek-html',
  // --outDir ile başka klasöre derlenince (yerel deneme) yeniden adlandırma oraya yapılsın
  configResolved(c) {
    cikti = path.resolve(c.root, c.build.outDir);
  },
  // Geliştirmede tüm sayfa istekleri destek.html'e düşsün (SPA yönlendirmesi)
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url || '';
      if (req.method === 'GET' && req.headers.accept?.includes('text/html') && !url.startsWith('/api')) {
        req.url = '/destek.html';
      }
      next();
    });
  },
  // IIS varsayılan belgesi ve SPA yönlendirmesi index.html beklediği için çıktıyı yeniden adlandır
  closeBundle() {
    const kaynak = path.join(cikti, 'destek.html');
    if (fs.existsSync(kaynak)) fs.renameSync(kaynak, path.join(cikti, 'index.html'));
  }
  };
};

export default defineConfig((ortam) => {
  const env = loadEnv(ortam.mode, process.cwd(), '');
  const backendOrigin = env.VITE_BACKEND_ORIGIN || 'http://localhost:5000';
  const ana = (anaConfig as (o: typeof ortam) => UserConfig)(ortam);

  return mergeConfig(
    { ...ana, server: undefined, build: undefined },
    {
      plugins: [destekHtml()],
      publicDir: 'public-destek',
      build: {
        outDir: 'dist-destek',
        emptyOutDir: true,
        chunkSizeWarningLimit: 2000,
        rollupOptions: { input: path.resolve(__dirname, 'destek.html') }
      },
      server: {
        port: 3005,
        strictPort: true,
        open: false,
        proxy: {
          '/api/v1/destek-panel': { target: backendOrigin, changeOrigin: false, secure: false }
        }
      }
    } satisfies UserConfig
  );
});
