import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

// Murmrr embeds SeeTickets list cards on its homepage. Each card:
//   .seetickets-list-event-container
//     .title > a (title + url)
//     .date              ("Sat May 2")
//     .doortime-showtime ("Show at <span>10:30PM</span>")
//     .price             ("$50.00-$75.00")
export class MurmrrScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, '.seetickets-list-event-container');
    const $ = cheerio.load(html);
    const events: Event[] = [];
    const seen = new Set<string>();

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    $('.seetickets-list-event-container').each((_, el) => {
      try {
        const $el = $(el);
        const $titleA = $el.find('.title a').first();
        const title = $titleA.text().replace(/\s+/g, ' ').trim();
        if (!title) return;

        // Date "Sat May 2" — no year. Assume current, advance to next year if month already passed.
        const dateText = $el.find('.date').first().text().trim();
        const dm = dateText.match(/(\w{3,9})\s+(\d{1,2})/i);
        if (!dm) return;
        const parsed = this.parseDate(`${dm[1]} ${dm[2]}, ${currentYear}`);
        if (!parsed) return;
        const month = Number(parsed.split('-')[1]);
        const finalYear = month < currentMonth ? currentYear + 1 : currentYear;
        const date = `${finalYear}-${parsed.split('-').slice(1).join('-')}`;

        const showtime = $el.find('.see-showtime, .doortime-showtime').first().text();
        const stMatch = showtime.match(/(\d{1,2}:?\d{0,2}\s*(?:AM|PM|am|pm))/);
        const time = stMatch ? this.parseTime(stMatch[1]) : null;

        const priceMatch = $el.find('.price').first().text().match(/\$\d+(?:\.\d+)?(?:-\$\d+(?:\.\d+)?)?/);
        const img = $el.find('img').first().attr('src') || null;
        const href = $titleA.attr('href') || '';

        const key = `${title}|${date}`;
        if (seen.has(key)) return;
        seen.add(key);

        events.push(this.makeEvent({
          title,
          date,
          time,
          price: priceMatch ? priceMatch[0] : null,
          image_url: img,
          event_url: href || this.venue.url,
        }));
      } catch {}
    });

    return events;
  }
}
