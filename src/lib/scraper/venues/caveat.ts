import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

// Caveat events page lists shows as cards. Reliable info: a link to
// /events/<slug>-M-D-YYYY whose URL slug encodes the show date, and a
// .show-title element with the human title.
export class CaveatScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, 'a[href*="/events/"]');
    const $ = cheerio.load(html);
    const events: Event[] = [];
    const seen = new Set<string>();

    $('a[href*="/events/"]').each((_, el) => {
      try {
        const $a = $(el);
        const href = $a.attr('href') || '';
        // Match trailing -M-D-YYYY in the slug
        const m = href.match(/-(\d{1,2})-(\d{1,2})-(\d{4})(?:[/?#]|$)/);
        if (!m) return;
        const date = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;

        // Title: prefer .show-title within the card
        let title = $a.find('.show-title').first().text().trim();
        if (!title) title = ($a.find('h1, h2, h3').first().text() || '').trim();
        if (!title) {
          // Fallback: derive from slug
          const slug = href.split('/events/')[1]?.split('-' + m[1] + '-')[0] || '';
          title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
        if (!title) return;

        const key = `${title}|${date}|${href}`;
        if (seen.has(key)) return;
        seen.add(key);

        events.push(this.makeEvent({
          title,
          date,
          time: null,
          event_url: href.startsWith('http') ? href : new URL(href, this.venue.url).href,
        }));
      } catch {}
    });

    return events;
  }
}
