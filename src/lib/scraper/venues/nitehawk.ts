import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

// Nitehawk Cinema (both Williamsburg and Prospect Park).
// Each location's /showtimes page renders <article> elements whose heading has
// the format "Movie Title – M/D/YY @ H:MM am/pm". The url passed in venue.url
// determines which location is scraped.
export class NitehawkScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, 'article');
    const $ = cheerio.load(html);
    const events: Event[] = [];
    const seen = new Set<string>();

    $('article').each((_, el) => {
      try {
        const $el = $(el);
        const heading = $el.find('h1, h2, h3').first().text().trim();
        if (!heading) return;

        // Format: "Title – M/D/YY @ H:MM am/pm" (the dash is en/em dash or hyphen)
        const m = heading.match(/^(.+?)\s+[–—\-]\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*@\s*(\d{1,2}:\d{2}\s*[ap]m)/i);
        if (!m) return;
        const [, rawTitle, mm, dd, yyRaw, timeRaw] = m;
        const title = rawTitle.trim();
        const yy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
        const date = `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        const time = this.parseTime(timeRaw);

        const link = $el.find('a[href*="/showtimes/"]').first().attr('href') ||
                     $el.find('a').first().attr('href') || '';
        const event_url = link ? new URL(link, this.venue.url).href : this.venue.url;

        // De-dupe across multiple link occurrences in same article
        const key = `${title}|${date}|${time}`;
        if (seen.has(key)) return;
        seen.add(key);

        const img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || null;
        events.push(this.makeEvent({
          title,
          date,
          time,
          image_url: img ? new URL(img, this.venue.url).href : null,
          event_url,
        }));
      } catch {}
    });

    return events;
  }
}
