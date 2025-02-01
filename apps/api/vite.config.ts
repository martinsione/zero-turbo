import devServer from "@hono/vite-dev-server";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 8888,
  },
  plugins: [
    devServer({
      entry: "src/index.ts",
    }),
  ],
});
