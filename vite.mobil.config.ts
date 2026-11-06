import { defineConfig, loadEnv, mergeConfig, type Plugin, type UserConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import anaConfig from './vite.config';

// Mobil cari sitesi (mobil.likyaerp.com; docs/MOBIL_CARI_YOL_HARITASI.md) için ayrı build: giriş mobil.html, çıktı dist-mobil/.
//   npm run dev:mobil   → http://localhost:3006
//   npm run build:mobil → dist-mobil/ (IIS'te ayrı sitenin kök klasörü)

const mobilHtml = (): Plugin => {
  let cikti = path.resolve(__dirname, 'dist-mobil');
  return {
  name: 'likya-mobil-html',
  // --outDir ile başka klasöre derlenince (yerel deneme) yeniden adlandırma oraya yapılsın
  configResolved(c) {
    cikti = path.resolve(c.root, c.build.outDir);
  },
  // Geliştirmede tüm sayfa istekleri mobil.html'e düşsün (SPA yönlendirmesi)
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url || '';
      if (req.method === 'GET' && req.headers.accept?.includes('text/html') && !url.startsWith('/api')) {
        req.url = '/mobil.html';
      }
      next();
    });
  },
  // IIS varsayılan belgesi ve SPA yönlendirmesi index.html beklediği için çıktıyı yeniden adlandır
  closeBundle() {
    const kaynak = path.join(cikti, 'mobil.html');
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
      plugins: [mobilHtml()],
      publicDir: 'public-mobil',
      build: {
        outDir: 'dist-mobil',
        emptyOutDir: true,
        chunkSizeWarningLimit: 2000,
        rollupOptions: { input: path.resolve(__dirname, 'mobil.html') }
      },
      server: {
        port: 3006,
        strictPort: true,
        open: false,
        proxy: {
          '/api/v1/mobil': { target: backendOrigin, changeOrigin: false, secure: false }
        }
      }
    } satisfies UserConfig
  );
});
