import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithStealth } from '../base';
import { Event } from '../../types';

const BANDSINTOWN_VENUE_URL = 'https://www.bandsintown.com/v/10008032-lucky-13-saloon';

interface LdJsonEvent {
  '@type'?: string;
  name?: string;
  startDate?: string;
  url?: string;
  image?: string | string[];
  description?: string;
  performer?: { name?: string } | { name?: string }[];
  offers?: { price?: string | number; lowPrice?: string | number };
}

export class Lucky13Scraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const events: Event[] = [];
    const seenTitles = new Set<string>();

    const addEvent = (event: Event) => {
      const key = event.title.toLowerCase().trim();
      if (seenTitles.has(key)) return;
      seenTitles.add(key);
      events.push(event);
    };

    // Source 1: Bandsintown venue page (most events live here)
    try {
      const html = await scrapeWithStealth(BANDSINTOWN_VENUE_URL);
      const $ = cheerio.load(html);
      $('script[type="application/ld+json"]').each((_, el) => {
        const raw = $(el).contents().text();
        let parsed: unknown;
        try { parsed = JSON.parse(raw); } catch { return; }
        const list: LdJsonEvent[] = Array.isArray(parsed) ? (parsed as LdJsonEvent[]) : [parsed as LdJsonEvent];
        for (const item of list) {
          if (item['@type'] !== 'MusicEvent' && item['@type'] !== 'Event') continue;
          const title = item.name?.replace(/\s*@\s*Lucky 13 Saloon\s*$/i, '').trim();
          // Bandsintown gives venue-local datetime without TZ; take the date portion verbatim.
          const date = item.startDate ? item.startDate.split('T')[0] : null;
          if (!title || !date) continue;
          const time = item.startDate?.includes('T') ? this.parseTime(item.startDate.split('T')[1]) : null;
          const image = Array.isArray(item.image) ? item.image[0] : item.image;
          const offer = item.offers;
          const priceVal = offer?.price ?? offer?.lowPrice;
          const price = priceVal != null ? `$${priceVal}` : null;

          addEvent(this.makeEvent({
            title,
            date,
            time,
            price,
            image_url: image ?? null,
            event_url: item.url ?? null,
            description: item.description ?? null,
          }));
        }
      });
    } catch (err) {
      console.error('[lucky13] Bandsintown scrape failed:', String(err).slice(0, 200));
    }

    // Source 2: venue's own Squarespace page (catches non-music events Bandsintown misses)
    try {
      const $ = await this.fetchHtml(this.venue.url);
      $('a[href*="eventbrite.com/e/"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href') || '';
        const slugMatch = href.match(/eventbrite\.com\/e\/([\w-]+?)(?:-tickets-\d+)?(?:[?#].*)?$/);
        if (!slugMatch) return;
        const title = slugMatch[1]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
          .substring(0, 100);
        if (!title || title.length < 3) return;

        const $container = $el.closest('div, li, figure, article');
        const img = $container.find('img').first().attr('src') ||
                    $container.find('img').first().attr('data-src') || null;

        const today = new Date().toISOString().split('T')[0];
        addEvent(this.makeEvent({
          title,
          date: today,
          image_url: img ? new URL(img, this.venue.url).href : null,
          event_url: href,
          description: 'Live at Lucky 13 Saloon',
        }));
      });
    } catch (err) {
      console.error('[lucky13] venue site scrape failed:', String(err).slice(0, 200));
    }

    return events;
  }
}
