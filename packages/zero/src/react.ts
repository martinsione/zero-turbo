import { createUseZero } from "@rocicorp/zero/react";
import type { Schema } from "./schema";

export const useZero = createUseZero<Schema>();

export { ZeroProvider, useQuery } from "@rocicorp/zero/react";
