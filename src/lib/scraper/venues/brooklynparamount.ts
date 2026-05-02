import { BaseScraper } from '../base';
import { Event } from '../../types';

interface LdEvent {
  '@type'?: string;
  name?: string;
  startDate?: string;
  url?: string;
  image?: string;
  description?: string;
  offers?: { lowPrice?: number | string; price?: number | string };
}

export class BrooklynParamountScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const $ = await this.fetchHtml(this.venue.url);
    const events: Event[] = [];
    const seen = new Set<string>();

    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).contents().text();
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { return; }
      const list = Array.isArray(parsed) ? (parsed as LdEvent[]) : [parsed as LdEvent];
      for (const item of list) {
        if (item['@type'] !== 'MusicEvent' && item['@type'] !== 'Event') continue;
        const title = item.name?.trim();
        const date = item.startDate ? item.startDate.split('T')[0] : null;
        if (!title || !date) continue;
        const key = `${title}|${date}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const time = item.startDate?.includes('T') ? this.parseTime(item.startDate.split('T')[1]) : null;
        const offer = item.offers;
        const priceVal = offer?.lowPrice ?? offer?.price;
        const price = priceVal != null ? `From $${priceVal}` : null;

        events.push(this.makeEvent({
          title,
          date,
          time,
          price,
          image_url: item.image ?? null,
          event_url: item.url ?? null,
          description: item.description ?? null,
        }));
      }
    });

    return events;
  }
}
