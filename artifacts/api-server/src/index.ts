import app from "./app";

// Cloudflare Workers entry point
export default {
  fetch: app.fetch
};
