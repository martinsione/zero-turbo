import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { issuer } from "@openauthjs/openauth";
import { CodeProvider } from "@openauthjs/openauth/provider/code";
import { createSubjects } from "@openauthjs/openauth/subject";
import { handle } from "hono/aws-lambda";
import postgres from "postgres";
import { Resource } from "sst";
import { z } from "zod";

const pg = postgres({
  idle_timeout: 30000,
  connect_timeout: 30000,
  host: Resource.database.host,
  database: Resource.database.database,
  user: Resource.database.username,
  password: Resource.database.password,
  port: Resource.database.port,
  max: Number.parseInt(process.env.POSTGRES_POOL_MAX || "1"),
});

const Account = {
  fromEmail: async ({ email }: { email: string }) => {
    const result = await pg`SELECT id FROM accounts WHERE email = ${email}`;
    return result[0]?.id as string | undefined;
  },
  create: async ({ email }: { email: string }) => {
    const result =
      await pg`INSERT INTO accounts (email) VALUES (${email}) RETURNING id`;
    return result[0]?.id as string | undefined;
  },
};

const FRONTEND_URL = process.env.AUTH_FRONTEND_URL;

export const subjects = createSubjects({
  account: z.object({
    accountID: z.string(),
    email: z.string(),
  }),
});

export const handler = handle(
  issuer({
    subjects,
    providers: {
      email: CodeProvider({
        async request(req, state, form, error) {
          console.log(state);
          const params = new URLSearchParams();
          if (error) {
            params.set("error", error.type);
          }
          if (state.type === "start") {
            return Response.redirect(
              `${FRONTEND_URL}/auth/email?${params.toString()}`,
              302,
            );
          }

          if (state.type === "code") {
            return Response.redirect(
              `${FRONTEND_URL}/auth/code?${params.toString()}`,
              302,
            );
          }

          return new Response("ok");
        },
        async sendCode(claims, code) {
          const ses = new SESv2Client({});
          const email = z.string().email().parse(claims.email);
          const cmd = new SendEmailCommand({
            Destination: {
              ToAddresses: [email],
            },
            FromEmailAddress: `SST <auth@${Resource.Email.sender}>`,
            Content: {
              Simple: {
                Body: {
                  Html: {
                    Data: `Your pin code is <strong>${code}</strong>`,
                  },
                  Text: {
                    Data: `Your pin code is ${code}`,
                  },
                },
                Subject: {
                  Data: `SST Console Pin Code: ${code}`,
                },
              },
            },
          });
          await ses.send(cmd);
        },
      }),
    },
    async success(ctx, response) {
      let email: string | undefined;
      console.log(response);
      if (response.provider === "email") {
        email = response.claims.email;

        // if (response.claims.impersonate) {
        //   if (response.claims.email?.split("@")[1] !== "sst.dev") {
        //     return new Response("Unauthorized", { status: 401 });
        //   }
        //   email = await db
        //     .select({
        //       email: user.email,
        //     })
        //     .from(user)
        //     .innerJoin(workspace, eq(user.workspaceID, workspace.id))
        //     .where(
        //       and(
        //         eq(workspace.slug, response.claims.impersonate),
        //         isNull(workspace.timeDeleted),
        //         isNull(user.timeDeleted),
        //       ),
        //     )
        //     .then((rows) => rows.at(0)?.email);
        // }
      }

      if (!email) throw new Error("No email found");
      let accountID = await Account.fromEmail({ email });
      if (!accountID) {
        console.log("creating account for", email);
        accountID = await Account.create({ email });
      }

      return ctx.subject(
        "account",
        { accountID: accountID, email },
        { subject: email },
      );
    },
  }),
);
