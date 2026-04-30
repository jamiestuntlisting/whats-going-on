import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

// The Bell House publishes one application/ld+json per show on /shows,
// each typed as MusicEvent with name, startDate (ISO), url (Ticketmaster),
// and image. Scrape that directly — no fragile DOM walking needed.
export class BellHouseScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, 'script[type="application/ld+json"]');
    const $ = cheerio.load(html);
    const events: Event[] = [];
    const seen = new Set<string>();

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html();
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];
        for (const item of items) {
          if (item['@type'] !== 'MusicEvent' && item['@type'] !== 'Event') continue;
          if (!item.name || !item.startDate) continue;
          const date = this.parseDate(item.startDate);
          if (!date) continue;
          const timeMatch = String(item.startDate).match(/T(\d{2}:\d{2})/);
          const key = `${item.name}|${date}|${timeMatch?.[1] ?? ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          events.push(this.makeEvent({
            title: String(item.name),
            date,
            time: timeMatch ? this.parseTime(timeMatch[1]) : null,
            image_url: typeof item.image === 'string' ? item.image
                     : Array.isArray(item.image) ? item.image[0] ?? null
                     : null,
            event_url: item.url || this.venue.url,
          }));
        }
      } catch {}
    });

    return events;
  }
}
