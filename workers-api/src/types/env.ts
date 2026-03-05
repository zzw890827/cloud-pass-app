import type { Database } from "../db/client";

export type Bindings = {
  CLOUD_PASS_DB: D1Database;
  DEV_MODE: string;
  CF_TEAM_DOMAIN: string;
};

export type Variables = {
  db: Database;
  user: {
    id: number;
    email: string;
    displayName: string;
    isActive: boolean;
    isAdmin: boolean;
  };
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
