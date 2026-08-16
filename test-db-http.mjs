const dbUrl = process.env.DATABASE_URL_HTTP || "https://ep-blue-cherry-ai05ptbu.c-4.us-east-1.aws.neon.tech/sql";
const dbPassword = process.env.DATABASE_PASSWORD;

if (!dbPassword) {
  console.error("Please set the DATABASE_PASSWORD environment variable.");
  process.exit(1);
}

async function test() {
  try {
    const res = await fetch(dbUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dbPassword}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: 'SELECT * FROM projects LIMIT 1;' })
    });
    const data = await res.json();
    console.log("DB Projects Table Test:", data);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

test();
