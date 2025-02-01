import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("Hello Vite!"));

export default {
  fetch: app.fetch,
};
