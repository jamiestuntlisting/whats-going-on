import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

export class UnionHallScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    // Union Hall is JS-rendered, needs Puppeteer
    const html = await scrapeWithPuppeteer(this.venue.url, 'a[href*="eventbrite"]');
    const $ = cheerio.load(html);
    const events: Event[] = [];
    const currentYear = new Date().getFullYear();

    // Find Eventbrite links and work outward to find associated event data
    $('a[href*="eventbrite.com"]').each((_, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';

        // Walk up to find event container
        const $container = $link.closest('li, article, div, section').length
          ? $link.closest('li, article, div, section')
          : $link.parent().parent();

        const text = $container.text();
        const title = $container.find('h2, h3, h4').first().text().trim() ||
                      $link.find('img').attr('alt')?.trim() ||
                      text.split('\n').find(l => l.trim().length > 5)?.trim() || '';
        if (!title || title.length < 3) return;

        // Parse date: "Mar 27", "March 27", etc.
        const dateMatch = text.match(/(\w{3,9})\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/);
        let date: string | null = null;
        if (dateMatch) {
          const monthStr = dateMatch[1];
          const day = dateMatch[2];
          const year = dateMatch[3] || currentYear;
          const d = new Date(`${monthStr} ${day}, ${year}`);
          if (!isNaN(d.getTime())) {
            date = d.toISOString().split('T')[0];
          }
        }
        if (!date) return;

        const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))/);
        const priceMatch = text.match(/\$(\d+)/);
        const soldOut = /sold\s*out/i.test(text);
        const img = $container.find('img').first().attr('src') || null;

        events.push(this.makeEvent({
          title: title.substring(0, 100),
          date,
          time: timeMatch ? this.parseTime(timeMatch[1]) : null,
          price: priceMatch ? `$${priceMatch[1]}` : null,
          sold_out: soldOut,
          image_url: img,
          event_url: href || this.venue.url,
        }));
      } catch {}
    });

    return events;
  }
}
