// Prune old history now and compact the database file. Stop `npm run dev`
// first: VACUUM rewrites the whole file and needs the database to itself.

import { prisma } from "../lib/prisma";
import { pruneHistory } from "../lib/retention";
import { readSettings } from "../lib/settings";

async function main() {
  const settings = await readSettings();
  console.log(`[prune] keeping ${settings.historyRetentionDays} day(s) of history…`);
  const result = await pruneHistory(settings.historyRetentionDays);
  console.log("[prune] deleted:", result);
  console.log("[prune] compacting database (VACUUM)…");
  await prisma.$executeRawUnsafe("VACUUM");
  // In WAL mode VACUUM writes the rebuilt file into the -wal; fold it back in.
  await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
  console.log("[prune] done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
