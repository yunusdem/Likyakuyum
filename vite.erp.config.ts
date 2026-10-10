import { defineConfig, loadEnv, mergeConfig, type Plugin, type UserConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import anaConfig from './vite.config';

// www.likyaerp.com ürün ailesi tanıtım sitesi için ayrı build: giriş erp.html, çıktı dist-erp/
// (docs/LIKYAERP_TANITIM_SITESI.md). Kullanıcı uygulamasının build'ine (dist/) bu sitenin kodu hiç girmez.
//   npm run dev:erp   → http://localhost:3002
//   npm run build:erp → dist-erp/ (IIS'te likya-erp sitesinin kök klasörü)
//
// Analitik (K11): .env.local ya da .env.production.local içine yazılınca devreye girer, kod değişmez.
//   VITE_ERP_GA_ID=G-XXXXXXX              → Google Analytics 4
//   VITE_ERP_GSC_DOGRULAMA=abc123...      → Search Console "HTML etiketi" doğrulama kodu

const erpHtml = (env: Record<string, string>): Plugin => ({
  name: 'likya-erp-html',
  // Geliştirmede tüm sayfa istekleri erp.html'e düşsün (SPA yönlendirmesi)
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url || '';
      if (req.method === 'GET' && req.headers.accept?.includes('text/html') && !url.startsWith('/api')) {
        req.url = '/erp.html';
      }
      next();
    });
  },
  // Search Console doğrulama etiketi statik HTML'de olmalı (Google JS çalıştırmadan okur)
  transformIndexHtml(html) {
    const kod = (env.VITE_ERP_GSC_DOGRULAMA || '').trim();
    const etiket = kod ? `<meta name="google-site-verification" content="${kod.replace(/"/g, '')}" />` : '';
    return html.replace('<!--GSC_DOGRULAMA-->', etiket);
  },
  // IIS varsayılan belgesi ve SPA yönlendirmesi index.html beklediği için çıktıyı yeniden adlandır
  closeBundle() {
    const cikti = path.resolve(__dirname, 'dist-erp');
    const kaynak = path.join(cikti, 'erp.html');
    if (fs.existsSync(kaynak)) fs.renameSync(kaynak, path.join(cikti, 'index.html'));
  }
});

export default defineConfig((ortam) => {
  const env = loadEnv(ortam.mode, process.cwd(), '');
  const backendOrigin = env.VITE_BACKEND_ORIGIN || 'http://localhost:5000';
  const ana = (anaConfig as (o: typeof ortam) => UserConfig)(ortam);

  return mergeConfig(
    { ...ana, server: undefined, build: undefined, optimizeDeps: undefined },
    {
      plugins: [erpHtml(env)],
      publicDir: 'public-erp',
      // Ön derleme önbelleği ana uygulamanınkinden ayrı: biri açılınca diğerininki silinmesin
      cacheDir: 'node_modules/.vite-erp',
      optimizeDeps: { entries: ['erp.html'] },
      build: {
        outDir: 'dist-erp',
        emptyOutDir: true,
        chunkSizeWarningLimit: 1000,
        rollupOptions: { input: path.resolve(__dirname, 'erp.html') }
      },
      server: {
        port: 3002,
        strictPort: true,
        open: false,
        proxy: {
          // Bu siteden yalnız iletişim formu backend'e gider
          '/api/v1/iletisim': { target: backendOrigin, changeOrigin: true, secure: false }
        }
      }
    } satisfies UserConfig
  );
});
