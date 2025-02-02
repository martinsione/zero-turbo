import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { issuer } from "@openauthjs/openauth";
import { CodeProvider } from "@openauthjs/openauth/provider/code";
import { CodeUI } from "@openauthjs/openauth/ui/code";
import { db, eq, schema } from "@repo/db/client";
import { handle } from "hono/aws-lambda";
import { nanoid } from "nanoid";
import { Resource } from "sst";
import { z } from "zod";
import { subjects } from "./subjects";

const Account = {
  fromEmail: ({ email }: { email: string }) =>
    db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1)
      .then((rows) => rows.at(0)?.id),
  create: ({ email }: { email: string }) =>
    db
      .insert(schema.user)
      .values({ id: nanoid(), email })
      .returning({ id: schema.user.id })
      .then((rows) => rows.at(0)?.id),
};

export const handler = handle(
  issuer({
    subjects,
    providers: {
      code: CodeProvider(
        CodeUI({
          sendCode: async (claims, code) => {
            const email = z.string().email().parse(claims.email);

            const ses = new SESv2Client({});
            const cmd = new SendEmailCommand({
              Destination: { ToAddresses: [email] },
              FromEmailAddress: `ZeroTurbo <auth@${Resource.email.sender}>`,
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
                    Data: `ZeroTurbo Pin Code: ${code}`,
                  },
                },
              },
            });

            await ses.send(cmd);
          },
        }),
      ),
    },
    async success(ctx, res) {
      console.log(res);

      let email: string | undefined;
      if (res.provider === "code") {
        email = res.claims.email;
      }

      if (!email) throw new Error("No email found");

      let accountID = await Account.fromEmail({ email });
      if (!accountID) {
        accountID = await Account.create({ email });
      }

      return ctx.subject(
        "account",
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        { accountID: accountID!, email },
        { subject: email },
      );
    },
  }),
);
