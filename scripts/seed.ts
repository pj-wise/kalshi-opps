// Seed script: pulls one round of mock markets into the DB so the UI is
// immediately usable after `npm run db:migrate && npm run db:seed`.

import { syncMarkets } from "../lib/sync";

async function main() {
  const result = await syncMarkets(undefined, { mode: "full" });
  console.log("[seed] sync result:", result);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
