import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Porta 8080 (convenção do ecossistema). A Vercel ignora isto e usa o build.
export default defineConfig({
  plugins: [react()],
  server: { port: 8080, host: true },
});
