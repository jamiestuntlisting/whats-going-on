import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithStealth } from '../base';
import { Event } from '../../types';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

// Barclays Center blocks plain HTTP (406) and plain Puppeteer. Use stealth.
// Each event is a <div class="entry"> with:
//   <span class="m-date__month">May</span>
//   <span class="m-date__day">14</span>
//   <a class="title-container" href="...detail/<slug>"><h3>...</h3><h4>...</h4></a>
//   <a href="https://www.ticketmaster.com/...">Buy Tickets</a>
export class BarclaysScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithStealth(this.venue.url);
    const $ = cheerio.load(html);
    const events: Event[] = [];
    const seen = new Set<string>();

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    $('.entry').each((_, el) => {
      try {
        const $el = $(el);
        const monthRaw = $el.find('.m-date__month').first().text().trim().toLowerCase().slice(0, 3);
        const dayRaw = $el.find('.m-date__day').first().text().trim();
        const month = MONTHS[monthRaw];
        const day = parseInt(dayRaw, 10);
        if (!month || !day) return;
        const year = month < currentMonth ? currentYear + 1 : currentYear;
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const $title = $el.find('.title-container').first();
        const title = $title.find('h3').first().text().replace(/\s+/g, ' ').trim();
        if (!title) return;

        const key = `${title}|${date}`;
        if (seen.has(key)) return;
        seen.add(key);

        const subtitle = $title.find('h4').first().text().replace(/\s+/g, ' ').trim();
        const detailHref = $title.attr('href') || '';
        const eventUrl = detailHref ? new URL(detailHref.trim(), this.venue.url).href : null;

        const img = $el.find('img').first().attr('src') || null;

        events.push(this.makeEvent({
          title,
          date,
          image_url: img,
          event_url: eventUrl,
          description: subtitle || null,
        }));
      } catch {}
    });

    return events;
  }
}
