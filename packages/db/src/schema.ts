import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

const timestamps = {
  time_created: timestamp("time_created").notNull().defaultNow(),
  time_deleted: timestamp("time_deleted").notNull().defaultNow(),
};

const id = (name: string) => varchar(name, { length: 255 });

export const user = pgTable("user", {
  id: id("id").primaryKey(),
  workspace_id: id("workspace_id").references(() => workspace.id),
  email: text("email").notNull(),
  time_seen: timestamp("time_seen").notNull().defaultNow(),
  ...timestamps,
});

export const workspace = pgTable("workspace", {
  id: id("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  ...timestamps,
});
