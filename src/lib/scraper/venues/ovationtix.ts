import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

export class OvationTixScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, '.production, .event, .show');
    const $ = cheerio.load(html);
    const events: Event[] = [];

    // OvationTix ticketing platform
    $('.production, .event, .show, .performance, tr, .list-item').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .title, .production-title, a').first().text().trim();
        if (!title || title.length < 3) return;

        const text = $el.text();
        const dateMatch = text.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})?/) ||
                          text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
        let date: string | null = null;
        if (dateMatch) {
          const d = new Date(dateMatch[0]);
          if (!isNaN(d.getTime())) {
            date = d.toISOString().split('T')[0];
          }
        }
        if (!date) {
          date = new Date().toISOString().split('T')[0];
        }

        const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))/);
        const priceMatch = text.match(/\$(\d+)/);
        const img = $el.find('img').first().attr('src') || null;
        const link = $el.find('a').first().attr('href') || '';
        const soldOut = /sold\s*out|unavailable/i.test(text);

        events.push(this.makeEvent({
          title: title.substring(0, 100),
          date,
          time: timeMatch ? this.parseTime(timeMatch[1]) : null,
          price: priceMatch ? `$${priceMatch[1]}` : null,
          sold_out: soldOut,
          image_url: img ? (img.startsWith('http') ? img : new URL(img, this.venue.url).href) : null,
          event_url: link ? (link.startsWith('http') ? link : new URL(link, this.venue.url).href) : this.venue.url,
          category: 'theater',
        }));
      } catch {}
    });

    const seen = new Set<string>();
    return events.filter(e => {
      if (seen.has(e.title)) return false;
      seen.add(e.title);
      return true;
    });
  }
}
