import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { clerkMiddleware } from "@hono/clerk-auth";
import router from "./routes/index";

const app = new Hono();

// Global middlewares
app.use("*", logger());
app.use("*", cors({ origin: "*", credentials: true }));

// Setup Clerk Authentication Middleware
// @hono/clerk-auth automatically pulls CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY from c.env
app.use("*", clerkMiddleware());

// Mount API routes
app.route("/api", router);

export default app;
