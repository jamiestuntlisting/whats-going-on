import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

// HERE Arts Center publishes its season at /shows/ as a list of links to
// individual show pages (/shows/<slug>/). The list page has thumbnails but
// no inline dates, so we follow each show URL once and parse the run date
// range from its body text — they put it on its own line right under the
// title, e.g. "April 30th - May 3rd, 2026".
//
// For our daily-event app we emit one event per show, dated on the run's
// start, with the description noting how long it runs.
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

interface DateRange { start: string; end: string | null; raw: string; }

function parseRange(text: string): DateRange | null {
  // Strip ordinal suffixes ("April 30th" → "April 30")
  const cleaned = text.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
  // "April 30 - May 3, 2026"
  const m = cleaned.match(/(\w{3,9})\s+(\d{1,2})\s*[-–—]\s*(?:(\w{3,9})\s+)?(\d{1,2}),\s*(\d{4})/);
  if (m) {
    const [, m1, d1, m2raw, d2, year] = m;
    const month1 = MONTHS[m1.toLowerCase()];
    const month2 = MONTHS[(m2raw || m1).toLowerCase()];
    if (!month1 || !month2) return null;
    return {
      start: `${year}-${String(month1).padStart(2, '0')}-${d1.padStart(2, '0')}`,
      end:   `${year}-${String(month2).padStart(2, '0')}-${d2.padStart(2, '0')}`,
      raw: text.trim(),
    };
  }
  // Single date "May 5, 2026"
  const single = cleaned.match(/(\w{3,9})\s+(\d{1,2}),\s*(\d{4})/);
  if (single) {
    const month = MONTHS[single[1].toLowerCase()];
    if (!month) return null;
    return {
      start: `${single[3]}-${String(month).padStart(2, '0')}-${single[2].padStart(2, '0')}`,
      end: null,
      raw: text.trim(),
    };
  }
  return null;
}

export class HereScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    // 1. Pull the listing page and collect distinct show URLs.
    const listHtml = await scrapeWithPuppeteer(this.venue.url, 'a[href*="/shows/"]');
    const $list = cheerio.load(listHtml);
    const showUrls = new Set<string>();
    $list('a[href*="/shows/"]').each((_, el) => {
      const href = ($list(el).attr('href') || '').split('?')[0].split('#')[0];
      if (!href) return;
      const abs = href.startsWith('http') ? href : new URL(href, this.venue.url).href;
      // Real show pages live at /shows/<slug>/ — skip the listing itself and category links
      const m = abs.match(/^https?:\/\/here\.org\/shows\/([^/]+)\/?$/);
      if (m && m[1] && m[1] !== '') showUrls.add(`https://here.org/shows/${m[1]}/`);
    });

    const events: Event[] = [];
    const seen = new Set<string>();

    // 2. Fetch each show page and pull title + run dates from body text.
    for (const url of showUrls) {
      try {
        const html = await scrapeWithPuppeteer(url, 'h1');
        const $ = cheerio.load(html);
        const title = $('h1').first().text().trim() || $('title').text().split(' - ')[0].trim();
        if (!title) continue;
        const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
        const range = parseRange(bodyText.slice(0, 600));
        if (!range) continue;

        const key = `${title}|${range.start}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const description = range.end && range.end !== range.start
          ? `Runs ${range.raw}`
          : null;
        const img = $('meta[property="og:image"]').attr('content') || null;

        events.push(this.makeEvent({
          title,
          date: range.start,
          time: null,
          image_url: img,
          event_url: url,
          description,
        }));
      } catch {
        // Skip failures on individual show pages
      }
    }

    return events;
  }
}
