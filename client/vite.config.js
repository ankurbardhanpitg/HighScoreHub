import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ngrok-keep-alive',
      configureServer(server) {
        const apply = (httpServer) => {
          // Node's default 5s keep-alive is shorter than ngrok's, which
          // causes ERR_NGROK_3004 (incomplete HTTP response) on reused sockets.
          httpServer.keepAliveTimeout = 65_000;
          httpServer.headersTimeout = 66_000;
        };
        if (server.httpServer) {
          apply(server.httpServer);
        }
        server.httpServer?.once('listening', () => {
          if (server.httpServer) {
            apply(server.httpServer);
          }
        });
      },
    },
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.ngrok.app'],
    cors: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://127.0.0.1:3001',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReqWs', (proxyReq) => {
            proxyReq.setHeader('Origin', 'http://localhost:5173');
          });
        },
      },
    },
  },
});
