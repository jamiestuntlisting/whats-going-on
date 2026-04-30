import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

// Dice.fm venue page emits a single Place JSON-LD with an `event` array of
// MusicEvent items. Each carries name, startDate, url, image, description.
export class PublicRecordsScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, 'script[type="application/ld+json"]');
    const $ = cheerio.load(html);
    const events: Event[] = [];
    const seen = new Set<string>();

    const ingest = (item: Record<string, unknown>) => {
      const t = item['@type'];
      if (t !== 'MusicEvent' && t !== 'Event') return;
      const name = item.name as string | undefined;
      const startDate = item.startDate as string | undefined;
      if (!name || !startDate) return;
      const date = this.parseDate(startDate);
      if (!date) return;
      const timeMatch = startDate.match(/T(\d{2}:\d{2})/);
      const key = `${name}|${date}|${timeMatch?.[1] ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      events.push(this.makeEvent({
        title: name,
        date,
        time: timeMatch ? this.parseTime(timeMatch[1]) : null,
        image_url: typeof item.image === 'string' ? item.image
                 : Array.isArray(item.image) ? (item.image[0] as string) ?? null
                 : null,
        event_url: (item.url as string) || this.venue.url,
        description: typeof item.description === 'string' ? item.description.slice(0, 200) : null,
      }));
    };

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html();
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const candidates: Record<string, unknown>[] = Array.isArray(parsed)
          ? parsed
          : parsed['@graph']
            ? parsed['@graph']
            : [parsed];
        for (const item of candidates) {
          // Direct event
          ingest(item);
          // Place with .event array
          if (Array.isArray(item.event)) {
            for (const e of item.event as Record<string, unknown>[]) ingest(e);
          }
        }
      } catch {}
    });

    return events;
  }
}
