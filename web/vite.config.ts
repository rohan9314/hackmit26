import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8765",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("error", (_err, _req, res) => {
            const socket = res as { writeHead?: Function; end?: Function; headersSent?: boolean };
            if (socket.writeHead && !socket.headersSent) {
              socket.writeHead(503, { "Content-Type": "application/json" });
              socket.end?.(JSON.stringify({ error: { message: "Demo API unavailable" } }));
            }
          });
        },
      },
      "/health": "http://127.0.0.1:8765",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
