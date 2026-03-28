import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

export class BarbesScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, '.event, article');
    const $ = cheerio.load(html);
    const events: Event[] = [];

    // Barbes is Wix-based, look for event listings after render
    $('[data-hook*="event"], .event-item, article, [class*="event"]').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .title, [data-hook*="title"]').first().text().trim();
        if (!title || title.length < 3) return;

        const text = $el.text();
        const dateMatch = text.match(/(\w+),?\s+(\w+)\s+(\d{1,2}),?\s*(\d{4})?/) ||
                          text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
        let date: string | null = null;
        if (dateMatch) {
          const d = new Date(dateMatch[0]);
          if (!isNaN(d.getTime())) {
            date = d.toISOString().split('T')[0];
          }
        }
        if (!date) return;

        const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))/);
        const priceMatch = text.match(/\$(\d+)/);
        const img = $el.find('img').first().attr('src') || null;

        events.push(this.makeEvent({
          title,
          date,
          time: timeMatch ? this.parseTime(timeMatch[1]) : null,
          price: priceMatch ? `$${priceMatch[1]}` : null,
          image_url: img,
          event_url: this.venue.url,
        }));
      } catch {}
    });

    return events;
  }
}
