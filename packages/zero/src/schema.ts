import {
  createSchema,
  definePermissions,
  number,
  relationships,
  string,
  table,
} from "@rocicorp/zero";

const timestamps = {
  time_created: number(),
  time_deleted: number().optional(),
} as const;

const workspace = table("workspace")
  .columns({
    id: string(),
    slug: string(),
    name: string(),
    ...timestamps,
  })
  .primaryKey("id");

const user = table("user")
  .columns({
    id: string(),
    workspace_id: string(),
    email: string(),
    time_seen: number().optional(),
    ...timestamps,
  })
  .primaryKey("workspace_id", "id");

export const schema = createSchema(1, {
  tables: [workspace, user],
  relationships: [
    relationships(workspace, (r) => ({
      users: r.many({
        sourceField: ["id"],
        destSchema: user,
        destField: ["workspace_id"],
      }),
    })),
    relationships(user, (r) => ({
      workspace: r.one({
        sourceField: ["workspace_id"],
        destSchema: workspace,
        destField: ["id"],
      }),
    })),
  ],
});

export type Schema = typeof schema;

type Auth = {
  sub: string;
  properties: {
    accountID: string;
    email: string;
  };
};

export const permissions = definePermissions<Auth, Schema>(schema, () => {
  return {
    user: {},
    workspace: {},
  };
});
