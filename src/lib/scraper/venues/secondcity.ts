import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

export class SecondCityScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, '.show, .event, article');
    const $ = cheerio.load(html);
    const events: Event[] = [];

    // Second City uses Next.js + Chakra UI
    $('[class*="card"], [class*="show"], article, a[href*="show"]').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .title').first().text().trim();
        if (!title || title.length < 3) return;

        const text = $el.text();
        const dateMatch = text.match(/(\w+),?\s+(\w+)\s+(\d{1,2}),?\s*(\d{4})?/);
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
        const link = $el.attr('href') || $el.find('a').first().attr('href') || '';
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
