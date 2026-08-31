import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // <-- هاد السطر مهم بزاف باش Electron يلقا الملفات فـ local
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: { port: 3000 }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          charts: ["recharts"],
          icons: ["lucide-react"],
        },
      },
    },
  },
});