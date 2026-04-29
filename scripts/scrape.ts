import fs from 'fs';
import path from 'path';
import { scrapeAllVenues } from '../src/lib/scraper';
import { Event } from '../src/lib/types';

const OUT_PATH = path.join(process.cwd(), 'public', 'events.json');

async function main() {
  console.log('Scraping all venues...');
  const start = Date.now();

  const results = await scrapeAllVenues((r) => {
    const status = r.error ? `ERR (${r.error.slice(0, 80)})` : `${r.events.length} events`;
    console.log(`  [${r.venue}] ${status}`);
  });

  const events: Event[] = results.flatMap((r) => r.events);
  const errorCount = results.filter((r) => r.error).length;
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const payload = {
    events,
    scrapedAt: new Date().toISOString(),
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf-8');

  console.log(`\nDone in ${elapsed}s — ${events.length} events from ${results.length - errorCount}/${results.length} venues.`);
  console.log(`Wrote ${OUT_PATH}`);
  console.log('Commit the updated public/events.json to publish on Vercel.');
}

main().catch((err) => {
  console.error('Scrape failed:', err);
  process.exit(1);
});
