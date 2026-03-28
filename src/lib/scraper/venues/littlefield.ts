import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

export class LittlefieldScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, '.event, .show, article');
    const $ = cheerio.load(html);
    const events: Event[] = [];

    // Littlefield uses WordPress Divi theme
    $('article, .et_pb_post, .event-item, .show-item, a[href*="event"]').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, .entry-title, .event-title').first().text().trim() ||
                      $el.find('img').attr('alt')?.trim() || '';
        if (!title || title.length < 3) return;

        const text = $el.text();
        const link = $el.attr('href') || $el.find('a').first().attr('href') || '';
        const img = $el.find('img').first().attr('src') || null;

        // Parse date from text
        const dateMatch = text.match(/(\w+),?\s+(\w+)\s+(\d{1,2}),?\s*(\d{4})?/) ||
                          text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
        let date: string | null = null;
        if (dateMatch) {
          const fullText = dateMatch[0];
          const d = new Date(fullText);
          if (!isNaN(d.getTime())) {
            date = d.toISOString().split('T')[0];
          }
        }
        if (!date) return;

        const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))/);
        const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
        const soldOut = /sold\s*out/i.test(text);

        events.push(this.makeEvent({
          title,
          date,
          time: timeMatch ? this.parseTime(timeMatch[1]) : null,
          price: priceMatch ? `$${priceMatch[1]}` : null,
          sold_out: soldOut,
          image_url: img,
          event_url: link ? (link.startsWith('http') ? link : new URL(link, this.venue.url).href) : this.venue.url,
        }));
      } catch {}
    });

    return events;
  }
}
