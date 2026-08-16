import { neon } from "@neondatabase/serverless";

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("Please set the DATABASE_URL environment variable.");
  process.exit(1);
}
async function test() {
  try {
    console.log("Connecting to database...");
    const sql = neon(dbUrl);
    const result = await sql`SELECT 1 as count`;
    console.log("DB Test Success:", result);
  } catch (err) {
    console.error("DB Test Failed:", err);
  }
}

test();
