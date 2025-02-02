import { defineConfig } from "drizzle-kit";
import { Resource } from "sst";

const { username, password, host, port, database } = Resource.database;

export default defineConfig({
  schema: "./src/schema.ts",
  dbCredentials: {
    url: `postgresql://${username}:${password}@${host}:${port}/${database}?sslmode=no-verify`,
  },
  dialect: "postgresql",
  migrations: { prefix: "timestamp" },
  strict: true,
  verbose: true,
});
