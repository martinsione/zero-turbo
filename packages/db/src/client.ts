import { drizzle } from "drizzle-orm/postgres-js";
import { Resource } from "sst";
import * as schema from "./schema";

const { username, password, host, port, database } = Resource.database;

export const db = drizzle(
  `postgresql://${username}:${password}@${host}:${port}/${database}?sslmode=no-verify`,
  { schema },
);

export { schema };
export * from "drizzle-orm";
