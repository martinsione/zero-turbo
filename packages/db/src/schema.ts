import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  time_created: timestamp("time_created").notNull().defaultNow(),
  time_deleted: timestamp("time_deleted").notNull().defaultNow(),
};

const id = (name: string) => varchar(name, { length: 255 });

export const workspace = pgTable("workspace", {
  id: id("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  ...timestamps,
});

export const account = pgTable("account", {
  id: id("id").primaryKey(),
  email: text("email").notNull(),
  ...timestamps,
});

export const user = pgTable(
  "user",
  {
    id: id("id"),
    account_id: id("account_id").notNull(),
    workspace_id: id("workspace_id").notNull(),
    time_seen: timestamp("time_seen").notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.workspace_id, t.id] })],
);
