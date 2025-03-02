/// <reference path="./.sst/platform/config.d.ts" />

import * as fs from "node:fs";
import * as path from "node:path";

function createDNS(domain: string) {
  const stage = $app.stage;

  return {
    domain: { production: domain }[stage] || `${stage}.${domain}`,
    dns: sst.cloudflare.dns(),
  };
}

function createAPI({
  auth,
  bucket,
  database,
  email,
  dns,
}: {
  auth: sst.aws.Auth;
  bucket: sst.aws.Bucket;
  database: sst.aws.Postgres;
  email: sst.aws.Email;
  dns: ReturnType<typeof createDNS>;
}) {
  const api = new sst.aws.Function("Api", {
    handler: "apps/api/src/index.handler",
    link: [auth, bucket, database, email],
    nodejs: { install: ["source-map"] },
    timeout: "2 minutes",
    url: true,
    environment: {
      ...($dev
        ? {
            /*
             * @see https://discord.com/channels/983865673656705025/1230452755005702206/1230452755005702206
             */
            NODE_TLS_REJECT_UNAUTHORIZED: "0",
          }
        : {}),
    },
  });

  const router = new sst.aws.Router("ApiRouter", {
    routes: {
      "/*": api.url,
    },
    domain: { name: `api.${dns.domain}`, dns: dns.dns },
  });

  return router;
}

/**
 * Serverless deployment, pretty much free
 */
function createAuth({
  database,
  dns,
  email,
}: {
  database: sst.aws.Postgres;
  dns: ReturnType<typeof createDNS>;
  email: sst.aws.Email;
}) {
  const auth = new sst.aws.Auth("openauth", {
    domain: {
      name: `auth.${dns.domain}`,
      dns: dns.dns,
    },
    issuer: {
      link: [database, email],
      handler: "apps/auth/src/index.handler",
      environment: {
        ...($dev
          ? {
              /*
               * @see https://discord.com/channels/983865673656705025/1230452755005702206/1230452755005702206
               */
              NODE_TLS_REJECT_UNAUTHORIZED: "0",
            }
          : {}),
      },
    },
  });
  return auth;
}

function createZero({
  cluster,
  database,
  bucket,
  auth,
  dns,
}: {
  cluster: sst.aws.Cluster;
  database: sst.aws.Postgres;
  bucket: sst.aws.Bucket;
  auth: sst.aws.Auth;
  dns: ReturnType<typeof createDNS>;
}) {
  const conn = $interpolate`postgresql://${database.username}:${database.password}@${database.host}/${database.database}`;

  const env = {
    NO_COLOR: "1",
    ZERO_CVR_MAX_CONNS: "10",
    ZERO_UPSTREAM_MAX_CONNS: "10",
    ZERO_UPSTREAM_DB: conn,
    ZERO_CVR_DB: conn,
    ZERO_CHANGE_DB: conn,
    ZERO_REPLICA_FILE: "/tmp/sync-replica.db",
    ZERO_SHARD_ID: $app.stage,
    ZERO_AUTH_JWKS_URL: $interpolate`${auth.url}/.well-known/jwks.json`,
    ZERO_SCHEMA_JSON: JSON.parse(
      fs.readFileSync(
        path.join("packages", "zero", "zero-schema.json"),
        "utf8",
      ),
    ),
    ZERO_IMAGE_URL: "rocicorp/zero:canary",
    ...($dev
      ? {}
      : {
          ZERO_LITESTREAM_BACKUP_URL: $interpolate`s3://${bucket.name}/zero/backup`,
        }),
  };

  const replicationManager = $dev
    ? undefined
    : cluster.addService("zero-replication-manager", {
        ...($dev ? { capacity: "spot" } : {}),
        architecture: "arm64",
        cpu: "0.25 vCPU",
        memory: "0.5 GB",
        image: env.ZERO_IMAGE_URL,
        link: [database, bucket],
        environment: {
          ...env,
          ZERO_CHANGE_MAX_CONNS: "3",
          ZERO_NUM_SYNC_WORKERS: "0",
        },
        logging: {
          retention: "1 month",
        },
        loadBalancer: {
          public: false,
          ports: [{ listen: "80/http", forward: "4849/http" }],
        },
        transform: {
          loadBalancer: {
            idleTimeout: 3600,
          },
          target: {
            healthCheck: {
              enabled: true,
              path: "/keepalive",
              protocol: "HTTP",
              interval: 5,
              healthyThreshold: 2,
              timeout: 3,
            },
          },
        },
        // health: {
        //   command: ["CMD-SHELL", "curl -f http://localhost:4849/ || exit 1"],
        //   interval: "5 seconds",
        //   retries: 3,
        //   startPeriod: "300 seconds",
        // },
      });

  /**
   * @see https://sst.dev/docs/component/aws/cluster#cost
   * 1 month = ~720hr
   * IPV4 address       = $0.005/hr -> times 720 -> $3.6
   * arm64: vCPU        = $0.03238/hr -> times 720 -> times vCPU (0.25) -> $5,8284
   * arm64: memory (GB) = $0.00356/hr -> times 720 -> times memory (0.5) -> $1,2816
   * Spot is ~70% cheaper so cheapest option is ~$6/mo
   *
   * Free for dev
   */
  const zero = cluster.addService("zero-view-syncer", {
    dev: {
      command: "pnpm dev",
      directory: "packages/zero",
      url: "http://localhost:4848",
    },
    // ...($dev ? { capacity: "spot" } : {}),
    capacity: "spot", // 70% cheaper but less performant
    architecture: "arm64",
    cpu: "0.25 vCPU",
    memory: "0.5 GB",
    image: env.ZERO_IMAGE_URL,
    link: [database, bucket],
    environment: {
      ...env,
      ...($dev
        ? { ZERO_NUM_SYNC_WORKERS: "1" }
        : {
            // biome-ignore lint/style/noNonNullAssertion: <explanation>
            ZERO_CHANGE_STREAMER_URI: replicationManager!.url,
          }),
    },
    logging: { retention: "1 month" },
    loadBalancer: {
      public: true,
      domain: {
        name: `zero.${dns.domain}`,
        dns: dns.dns,
      },
      ports: [
        { listen: "80/http", forward: "4848/http" },
        { listen: "443/https", forward: "4848/http" },
      ],
    },
    transform: {
      target: {
        healthCheck: {
          enabled: true,
          path: "/keepalive",
          protocol: "HTTP",
          interval: 5,
          healthyThreshold: 2,
          timeout: 3,
        },
        stickiness: {
          enabled: true,
          type: "lb_cookie",
          cookieDuration: 120,
        },
        loadBalancingAlgorithmType: "least_outstanding_requests",
      },
    },
    health: {
      command: ["CMD-SHELL", "curl -f http://localhost:4848/ || exit 1"],
      interval: "5 seconds",
      retries: 3,
      startPeriod: "300 seconds",
    },
  });

  return zero;
}

function createWeb({
  api,
  auth,
  dns,
  zero,
}: {
  api: ReturnType<typeof createAPI>;
  auth: sst.aws.Auth;
  dns: ReturnType<typeof createDNS>;
  zero: ReturnType<typeof createZero>;
}) {
  const site = new sst.aws.StaticSite("web", {
    path: "./apps/web",
    build: {
      output: "./dist",
      command: "pnpm run build",
    },
    domain: {
      name: dns.domain,
      dns: dns.dns,
    },
    environment: {
      VITE_API_URL: api.url,
      VITE_AUTH_URL: auth.url,
      VITE_STAGE: $app.stage,
      VITE_ZERO_URL: zero.url,
    },
  });

  return site;
}

export default $config({
  app(input) {
    return {
      name: "zero-turbo",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          profile: "martin-personal",
        },
        cloudflare: {
          version: "5.49.0",
          apiToken: process.env.CLOUDFLARE_API_TOKEN,
        },
      },
    };
  },
  async run() {
    const dns = createDNS("zeroturbo.martinsione.com");

    const bucket = new sst.aws.Bucket("bucket", { public: false });

    const vpc = $dev
      ? new sst.aws.Vpc("vpc", {
          az: 2,
          bastion: true,
          nat: "ec2" /** $6/mo - @see https://sst.dev/docs/component/aws/vpc#nat */,
        })
      : new sst.aws.Vpc("vpc", { az: 2 });

    /**
     * Default `db.t4g.micro`, free tier or $14/mo ($22/mo if proxy is enabled)
     * @see https://sst.dev/docs/component/aws/postgres#cost
     */
    const database = new sst.aws.Postgres("database", {
      vpc,
      transform: {
        parameterGroup: {
          parameters: [
            {
              name: "rds.logical_replication",
              value: "1",
              applyMethod: "pending-reboot",
            },
          ],
        },
      },
    });

    const cluster = new sst.aws.Cluster("cluster", { vpc });

    const email = new sst.aws.Email("email", {
      sender: dns.domain,
      dns: dns.dns,
    });

    const auth = createAuth({ database, dns, email });
    const api = createAPI({ auth, bucket, database, email, dns });
    const zero = createZero({ auth, bucket, cluster, database, dns });
    const web = createWeb({ api, auth, dns, zero });

    return {
      api: api.url,
      auth: auth.url,
      web: web.url,
      zero: zero.url,
    };
  },
});
