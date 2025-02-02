import { createClient } from "@openauthjs/openauth/client";
import type { VerifyResult } from "@openauthjs/openauth/client";
import { db, eq, schema } from "@repo/db/client";
import { Hono, type MiddlewareHandler } from "hono";
import type { LambdaContext, LambdaEvent } from "hono/aws-lambda";
import { handle } from "hono/aws-lambda";
import { bearerAuth } from "hono/bearer-auth";
import { compress } from "hono/compress";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { Resource } from "sst";
import { subjects } from "../../auth/src/subjects";

type HonoEnv = {
  Bindings: { event: LambdaEvent; lambdaContext: LambdaContext };
  Variables: {
    db: typeof db;
    auth: { subject: VerifyResult<typeof subjects>["subject"] };
  };
};

function init(): MiddlewareHandler<HonoEnv> {
  return async (c, next) => {
    c.set("db", db);
    await next();
  };
}

function auth(): MiddlewareHandler<HonoEnv> {
  const client = createClient({
    issuer: Resource.openauth.url,
    clientID: "web",
  });

  return bearerAuth({
    verifyToken: async (token, c) => {
      const result = await client.verify(subjects, token);
      if (result.err) {
        throw new HTTPException(401, { message: "Unauthorized" });
      }
      c.set("auth", { subject: result.subject });
      return true;
    },
  });
}

const app = new Hono<HonoEnv>()
  .use("*", compress())
  .use("*", logger())
  .use("*", requestId())
  .use("*", init())
  .use("*", auth())
  .get("/", (c) => c.text("Hello Vite!"))
  .get("/account", async (c) => {
    const { subject } = c.get("auth");
    const db = c.get("db");

    const account = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, subject.properties.accountID))
      .limit(1)
      .then((rows) => rows[0] || null);

    return c.json(account);
  });

export const handler = handle(app);
