import { closeDb, getDbMode, initDb, seedDatabase } from "./db.js";

try {
  await initDb({ autoSeed: false });
  const force = process.argv.includes("--force");
  const result = await seedDatabase({ force });
  console.log(JSON.stringify({ ...result, mode: getDbMode() }, null, 2));
} finally {
  await closeDb();
}
