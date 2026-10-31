import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // the link preview needs a full address: Render gives the site's own at build time
  plugins: [{ name: 'site-url', transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', process.env.RENDER_EXTERNAL_URL ?? '') }],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500, rollupOptions: { input: { main: 'index.html' } } },
});
