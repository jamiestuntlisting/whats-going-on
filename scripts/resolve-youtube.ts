// Resolve artist names → top YouTube video IDs by driving a real browser
// session at https://www.youtube.com/results?search_query=… and pulling the
// first videoId out of the rendered page. Plain Node fetch gets rate-limited
// hard within a handful of requests; puppeteer (already a devDep) keeps
// cookies + a JS engine and behaves like a real visitor, so it sustains the
// whole batch.
//
// Cache lives at public/youtube-ids.json:
//   { "<lowercased artist>": { "videoId": "abc11chars" | null, "resolvedAt": ISO } }
// Pass --force to refresh existing entries; --limit N to cap a run.

import fs from 'fs';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';
import { extractArtistsFromTitle } from '../src/lib/playlist';

const CACHE_PATH = path.join(process.cwd(), 'public', 'youtube-ids.json');
const EVENTS_PATH = path.join(process.cwd(), 'public', 'events.json');
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PER_QUERY_DELAY_MS = 700;

interface CacheEntry {
  videoId: string | null;
  resolvedAt: string;
}
type Cache = Record<string, CacheEntry>;

function readCache(): Cache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeCache(cache: Cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf-8');
}

function key(name: string): string {
  return name.toLowerCase().trim();
}

interface EventsFile {
  events: Array<{ title: string; category: string; date: string }>;
}

async function dismissConsent(page: Page) {
  // First page load may show the consent / cookies dialog. Click any obvious
  // "Reject all" / "Accept all" button so we can read results. Failures are
  // harmless — the search still runs.
  try {
    await page.waitForSelector('button[aria-label*="ept" i], button[aria-label*="eject" i]', {
      timeout: 3000,
    });
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
      const target = btns.find(b => /reject all|accept all|i agree/i.test(b.textContent || ''));
      target?.click();
    });
  } catch {
    // No consent gate — fine.
  }
}

async function resolveOne(page: Page, artist: string): Promise<string | null> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(artist)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  // We must scope to "videoRenderer" — that's the JSON wrapper for an
  // organic result. The naked "videoId" pattern also matches the promoted
  // ad slot at the top of the page, which on most queries was YouTube's
  // currently-promoted video (NKOTB Vegas residency etc.) and therefore
  // collapsed dozens of unrelated artists onto the same cached ID.
  const videoId = await page.evaluate(() => {
    const html = document.documentElement.outerHTML;
    const renderer = html.match(/"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (renderer) return renderer[1];
    const compact = html.match(/"compactVideoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (compact) return compact[1];
    // Last-resort fallback: the first /watch?v= anchor on the rendered
    // page. We accept this only if it isn't the promoted card —
    // ytd-promoted-* and ad-slot-renderer wrap promoted anchors.
    const anchors = Array.from(document.querySelectorAll('a[href^="/watch?v="]')) as HTMLAnchorElement[];
    for (const a of anchors) {
      if (a.closest('ytd-promoted-sparkles-web-renderer, ytd-ad-slot-renderer, [class*="promoted"], [class*="-ad-"]')) continue;
      const m = a.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (m) return m[1];
    }
    return null;
  });
  return videoId;
}

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes('--force');
  const limit = (() => {
    const i = argv.indexOf('--limit');
    return i >= 0 ? Number(argv[i + 1]) : Infinity;
  })();

  const eventsRaw = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8')) as EventsFile;
  const today = new Date().toISOString().split('T')[0];

  const artists = new Set<string>();
  for (const e of eventsRaw.events) {
    if (e.category !== 'music') continue;
    if (e.date < today) continue;
    for (const a of extractArtistsFromTitle(e.title)) {
      artists.add(a);
    }
  }

  const cache = readCache();
  const allArtists = Array.from(artists);
  console.log(`${allArtists.length} unique upcoming music artists`);

  const todo = allArtists.filter(a => force || !cache[key(a)]).slice(0, limit);
  if (todo.length === 0) {
    console.log('Cache already covers every artist. Use --force to refresh.');
    return;
  }
  console.log(`Resolving ${todo.length} new artists...`);

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await dismissConsent(page);

    let resolved = 0;
    let i = 0;
    for (const artist of todo) {
      i++;
      try {
        const videoId = await resolveOne(page, artist);
        cache[key(artist)] = { videoId, resolvedAt: new Date().toISOString() };
        if (videoId) resolved++;
        console.log(`  [${i}/${todo.length}] ${artist} → ${videoId ?? 'none'}`);
      } catch (err) {
        console.warn(`  [${i}/${todo.length}] ${artist} — error: ${String(err).slice(0, 100)}`);
        cache[key(artist)] = { videoId: null, resolvedAt: new Date().toISOString() };
      }
      if (i % 10 === 0) writeCache(cache);
      if (i < todo.length) await new Promise(r => setTimeout(r, PER_QUERY_DELAY_MS));
    }

    writeCache(cache);
    const total = Object.keys(cache).length;
    const withId = Object.values(cache).filter(c => c.videoId).length;
    console.log(`\nDone. Cache size ${total}, with video ID ${withId}.`);
    console.log(`This run: resolved ${resolved}/${todo.length}.`);
  } finally {
    if (browser) await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
