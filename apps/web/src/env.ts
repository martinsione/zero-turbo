import { z } from "zod";

export const env = z
  .object({
    BASE_URL: z.string(),
    DEV: z.boolean(),
    MODE: z.string(),
    PROD: z.boolean(),
    SSR: z.boolean(),
    VITE_API_URL: z.string(),
    VITE_AUTH_URL: z.string(),
    VITE_STAGE: z.string(),
    VITE_ZERO_URL: z.string(),
  })
  .parse(import.meta.env);
