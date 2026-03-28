import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

export class MurmrrScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    // Seetickets widget loads via AJAX - needs Puppeteer
    const html = await scrapeWithPuppeteer(this.venue.url, '.seetickets-list-event-container');
    const $ = cheerio.load(html);
    const events: Event[] = [];

    $('.seetickets-list-event-container').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('.seetickets-list-event-title, h2, h3').first().text().trim();
        if (!title) return;

        const dateText = $el.find('.seetickets-list-event-date, .date, time').first().text().trim();
        // Seetickets dates: "Fri Apr 3"
        const currentYear = new Date().getFullYear();
        let date: string | null = null;
        if (dateText) {
          // Try direct parse first
          date = this.parseDate(dateText);
          // If that fails, try appending year
          if (!date) {
            const d = new Date(`${dateText}, ${currentYear}`);
            if (!isNaN(d.getTime())) {
              date = d.toISOString().split('T')[0];
            }
          }
        }
        if (!date) return;

        const timeText = $el.find('.seetickets-list-event-time, .time').first().text().trim();
        // "Doors at 8:00PM / Show at 9:00PM" -> extract show time
        const showTimeMatch = timeText.match(/show\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))/i) ||
                              timeText.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))/i);

        const priceText = $el.find('.seetickets-list-event-price, .price').first().text().trim();
        const price = priceText.match(/\$[\d.]+(?:\s*[-–]\s*\$[\d.]+)?/)?.[0] || null;

        // Check src, data-src, AND data-lazy-src for images
        const imgEl = $el.find('img').first();
        const img = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || null;

        const link = $el.find('a.seetickets-buy-btn, a[href*="seetickets"]').first().attr('href') ||
                     $el.find('a').first().attr('href') || '';
        const soldOut = /sold\s*out/i.test($el.text());

        events.push(this.makeEvent({
          title,
          date,
          time: showTimeMatch ? this.parseTime(showTimeMatch[1]) : null,
          price,
          sold_out: soldOut,
          image_url: img ? (img.startsWith('http') ? img : new URL(img, this.venue.url).href) : null,
          event_url: link ? (link.startsWith('http') ? link : new URL(link, this.venue.url).href) : this.venue.url,
        }));
      } catch {}
    });

    return events;
  }
}
