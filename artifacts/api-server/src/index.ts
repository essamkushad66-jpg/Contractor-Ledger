import app from "./app";

// Cloudflare Workers entry point
export default {
  fetch(request: Request, env: any, ctx: any) {
    // Inject environment variables into global scope so the lazy DB proxy can find them
    if (env.DATABASE_URL) {
      (globalThis as any).__DATABASE_URL = env.DATABASE_URL;
    }
    return app.fetch(request, env, ctx);
  }
};
