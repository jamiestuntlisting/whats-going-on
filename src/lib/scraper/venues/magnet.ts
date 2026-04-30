import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

// Magnet Theater /calendar/ renders one day at a time under a heading like
// "Tonight's Shows:" or a date heading. We look upward from each .show-desc
// for an h1/h2/h3 that contains a parseable date; if none is found we fall
// back to the current local date (the page was loaded today).
export class MagnetScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, '.show-desc');
    const $ = cheerio.load(html);
    const events: Event[] = [];
    const seen = new Set<string>();

    const today = new Date().toISOString().split('T')[0];

    // Find a date hint in any h1/h2/h3 — fall back to today
    let pageDate = today;
    $('h1, h2, h3').each((_, h) => {
      const txt = $(h).text();
      const m = txt.match(/(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?/i)
            || txt.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
      if (m) {
        const parsed = this.parseDate(m[0]);
        if (parsed) {
          pageDate = parsed;
          return false;
        }
      }
    });

    $('.show-desc').each((_, el) => {
      try {
        const $el = $(el);
        const $titleA = $el.find('.show-title a').first();
        const title = $titleA.text().trim();
        if (!title) return;
        const href = $titleA.attr('href') || '';
        const time = this.parseTime($el.find('.showtime').first().text().trim());
        const text = $el.text();
        const priceMatch = text.match(/\(\$(\d+(?:\.\d+)?)\)/);
        const img = $el.find('img').first().attr('src') || null;

        const key = `${title}|${pageDate}|${time ?? ''}`;
        if (seen.has(key)) return;
        seen.add(key);

        events.push(this.makeEvent({
          title,
          date: pageDate,
          time,
          price: priceMatch ? `$${priceMatch[1]}` : null,
          image_url: img,
          event_url: href || this.venue.url,
        }));
      } catch {}
    });

    return events;
  }
}
