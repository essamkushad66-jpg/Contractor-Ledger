import { neon } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let dbInstance: NeonHttpDatabase<typeof schema> | null = null;

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(target, prop) {
    if (!dbInstance) {
      const getEnv = () => {
        if (typeof process !== "undefined" && process.env?.DATABASE_URL) {
          return process.env.DATABASE_URL;
        }
        return (globalThis as any).__DATABASE_URL;
      };
      
      const url = getEnv();
      if (!url) {
        throw new Error("DATABASE_URL must be set. Make sure it is defined in your environment.");
      }
      
      const sql = neon(url);
      dbInstance = drizzle(sql, { schema });
    }
    const value = (dbInstance as any)[prop];
    if (typeof value === "function") {
      return value.bind(dbInstance);
    }
    return value;
  }
});

export * from "./schema";
