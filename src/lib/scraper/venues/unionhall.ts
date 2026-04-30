import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

// Union Hall homepage renders an Eventbrite-driven list:
//  <li class="eventColl-item" data-event-status="onsale">
//    <span class="eventColl-month">May</span>
//    <span class="eventColl-date">01</span>
//    <h2 class="eventColl-eventInfo"><a href="https://www.eventbrite.com/...">TITLE</a></h2>
//
// Slideshow clones inflate the count, so we de-dupe on (title, date).
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

export class UnionHallScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, '.eventColl-item');
    const $ = cheerio.load(html);
    const events: Event[] = [];
    const seen = new Set<string>();

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    $('.eventColl-item').each((_, el) => {
      try {
        const $el = $(el);
        const monthRaw = $el.find('.eventColl-month').first().text().trim().toLowerCase();
        const dayRaw = $el.find('.eventColl-date').first().text().trim();
        const month = MONTHS[monthRaw.slice(0, 3)];
        const day = parseInt(dayRaw, 10);
        if (!month || !day) return;

        // Year is not on the card. Assume current year, but if month is earlier
        // than current month it must be next year.
        const year = month < currentMonth ? currentYear + 1 : currentYear;
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const $titleA = $el.find('.eventColl-eventInfo a, h2 a').first();
        const title = $titleA.text().replace(/\s+/g, ' ').trim();
        if (!title) return;

        const key = `${title}|${date}`;
        if (seen.has(key)) return;
        seen.add(key);

        const href = $titleA.attr('href') || '';
        const status = $el.attr('data-event-status') || '';

        // Image is on the wrapper as a background-image
        const style = $el.attr('style') || '';
        const bg = style.match(/url\(["']?([^"')]+)["']?\)/);
        const img = bg ? bg[1] : ($el.find('img').first().attr('src') || null);

        events.push(this.makeEvent({
          title,
          date,
          time: null,
          sold_out: /sold[- ]?out/i.test(status),
          image_url: img,
          event_url: href || this.venue.url,
        }));
      } catch {}
    });

    return events;
  }
}
