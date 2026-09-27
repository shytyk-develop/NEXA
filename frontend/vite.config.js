import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    publicDir: 'public',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
        // One React for every island, whichever chunk imports it.
        dedupe: ['react', 'react-dom'],
    },
    // The React islands load lazily (chat, spotlight, settings drawers…), so
    // the dev server's startup scan misses their deps and used to discover
    // them mid-session: it re-bundled, reloaded, and an island mounted against
    // a second copy of React ("Invalid hook call") — e.g. Spotlight rendered
    // nothing. Pre-bundle them up front instead.
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'react-dom/client',
            'react/jsx-runtime',
            'react/jsx-dev-runtime',
            'motion/react',
            'framer-motion',
            'vaul',
            'lucide-react',
            'clsx',
            'tailwind-merge',
        ],
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    server: {
        watch: {
            ignored: ['**/dist/**'],
        },
        // Same-origin /api in dev too (production: vercel.json rewrites), so the
        // HttpOnly refresh cookie behaves the same. VITE_API_PROXY=http://localhost:8000
        // points it at a local backend.
        proxy: {
            '/api': {
                target: process.env.VITE_API_PROXY || 'https://originhub.onrender.com',
                changeOrigin: true,
                secure: true,
            },
        },
    },
});
