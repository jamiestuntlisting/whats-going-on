import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

export class BrooklynCCScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    // Squarespace loads events via AJAX - needs Puppeteer
    const html = await scrapeWithPuppeteer(this.venue.url, '.eventlist-event, time[datetime]');
    const $ = cheerio.load(html);
    const events: Event[] = [];

    // Squarespace event cards
    $('.eventlist-event, .summary-item, .event-item').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h1, h2, h3, .eventlist-title, .summary-title, a.eventlist-title-link').first().text().trim();
        if (!title) return;

        // Get datetime from time element
        const timeEl = $el.find('time').first();
        const datetime = timeEl.attr('datetime') || '';
        const date = this.parseDate(datetime);
        if (!date) return;

        // Time display
        const timeText = $el.find('.event-time-12hr, .eventlist-meta-time').first().text().trim();
        const text = $el.text();

        // Price
        const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)/);

        // Venue/room info in brackets
        const roomMatch = text.match(/\[([^\]]+)\]/);

        const img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || null;
        const link = $el.find('a').first().attr('href') || '';
        const soldOut = /sold\s*out/i.test(text);

        events.push(this.makeEvent({
          title,
          date,
          time: timeText ? this.parseTime(timeText) : null,
          price: priceMatch ? `$${priceMatch[1]}` : null,
          sold_out: soldOut,
          image_url: img ? new URL(img, this.venue.url).href : null,
          event_url: link ? new URL(link, this.venue.url).href : this.venue.url,
          description: roomMatch ? roomMatch[1] : null,
        }));
      } catch {}
    });

    return events;
  }
}
