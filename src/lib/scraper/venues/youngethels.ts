import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

export class YoungEthelsScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, 'ul, .event, article');
    const $ = cheerio.load(html);
    const events: Event[] = [];

    // Young Ethel's uses Next.js with semantic HTML
    $('li, article, .event-item, [class*="event"]').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .title').first().text().trim();
        if (!title || title.length < 3) return;

        // Look for time element with datetime attribute
        const timeEl = $el.find('time').first();
        const datetime = timeEl.attr('datetime') || '';
        const date = this.parseDate(datetime);
        if (!date) return;

        const timeText = timeEl.text().trim();
        const text = $el.text();
        const priceMatch = text.match(/\$(\d+)/);
        const img = $el.find('img').first().attr('src') || null;
        const link = $el.find('a').first().attr('href') || '';

        events.push(this.makeEvent({
          title,
          date,
          time: timeText ? this.parseTime(timeText) : null,
          price: priceMatch ? `$${priceMatch[1]}` : null,
          image_url: img,
          event_url: link ? new URL(link, this.venue.url).href : this.venue.url,
        }));
      } catch {}
    });

    return events;
  }
}
