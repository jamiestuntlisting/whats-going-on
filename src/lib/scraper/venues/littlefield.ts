import { BaseScraper } from '../base';
import { Event } from '../../types';

interface JsonLdItem {
  '@type'?: string;
  name?: string;
  startDate?: string;
  url?: string;
  image?: string;
  description?: string;
}

interface JsonLdListEntry {
  item?: JsonLdItem;
}

interface JsonLdList {
  itemListElement?: JsonLdListEntry[];
}

export class LittlefieldScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const $ = await this.fetchHtml(this.venue.url);
    const events: Event[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).contents().text();
      if (!raw.includes('itemListElement')) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      const lists: JsonLdList[] = Array.isArray(parsed)
        ? (parsed as JsonLdList[])
        : [parsed as JsonLdList];

      for (const list of lists) {
        for (const entry of list.itemListElement ?? []) {
          const item = entry.item;
          if (!item || item['@type'] !== 'Event') continue;
          const title = item.name?.trim();
          // Take date portion verbatim; avoids local-tz roundtrip on naive datetimes.
          const date = item.startDate ? item.startDate.split('T')[0] : null;
          if (!title || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

          events.push(this.makeEvent({
            title,
            date,
            image_url: item.image ?? null,
            event_url: item.url ?? null,
            description: item.description ?? null,
          }));
        }
      }
    });

    return events;
  }
}
