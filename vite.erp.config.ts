import { defineConfig, loadEnv, mergeConfig, type Plugin, type UserConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import anaConfig from './vite.config';

const erpHtml = (env: Record<string, string>): Plugin => ({
  name: 'likya-erp-html',
  buildStart() {
    // public/images altındaki logo ve varlıkları public-erp'ye otomatik senkronize et
    const srcImages = path.resolve(__dirname, 'public', 'images');
    const destImages = path.resolve(__dirname, 'public-erp', 'images');
    if (!fs.existsSync(destImages) && fs.existsSync(srcImages)) {
      try {
        fs.cpSync(srcImages, destImages, { recursive: true });
      } catch {}
    }
  },
  // Geliştirmede tüm sayfa istekleri erp.html'e düşsün, /images/ istekleri public/images'den sunulsun
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url || '';
      if (url.startsWith('/images/')) {
        const cleanPath = url.split('?')[0];
        const publicFilePath = path.join(__dirname, 'public', cleanPath);
        if (fs.existsSync(publicFilePath) && fs.statSync(publicFilePath).isFile()) {
          const ext = path.extname(cleanPath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.ico': 'image/x-icon',
          };
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          fs.createReadStream(publicFilePath).pipe(res);
          return;
        }
      }
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

    // dist-erp içine images kopyalandığından emin ol
    const distImages = path.join(cikti, 'images');
    const srcImages = path.resolve(__dirname, 'public', 'images');
    if (!fs.existsSync(distImages) && fs.existsSync(srcImages)) {
      try {
        fs.cpSync(srcImages, distImages, { recursive: true });
      } catch {}
    }
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
          '/api': {
            target: backendOrigin,
            changeOrigin: true,
            secure: false,
          },
          '/uploads': {
            target: backendOrigin,
            changeOrigin: true,
            secure: false,
          }
        }
      }
    } satisfies UserConfig
  );
});
