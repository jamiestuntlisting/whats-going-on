import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

export class HeightsPlayersScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(
      'https://www.heightsplayers.org/box-office',
      '.production, .show, iframe'
    );
    const $ = cheerio.load(html);
    const events: Event[] = [];

    // Look for production info in the rendered page
    $('article, .production, .show, section, [class*="production"]').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h1, h2, h3, .title').first().text().trim();
        if (!title || title.length < 3) return;

        const text = $el.text();
        const img = $el.find('img').first().attr('src') || null;
        const link = $el.find('a[href*="ticket"]').first().attr('href') ||
                     $el.find('a').first().attr('href') || '';

        // Parse date range
        const rangeMatch = text.match(/(\w+)\s+(\d{1,2})\s*[-–]\s*(\w+)?\s*(\d{1,2}),?\s*(\d{4})?/);
        let date = new Date().toISOString().split('T')[0];
        if (rangeMatch) {
          const year = rangeMatch[5] || new Date().getFullYear();
          const d = new Date(`${rangeMatch[1]} ${rangeMatch[2]}, ${year}`);
          if (!isNaN(d.getTime())) {
            date = d.toISOString().split('T')[0];
          }
        }

        const priceMatch = text.match(/\$(\d+)/);

        events.push(this.makeEvent({
          title,
          date,
          price: priceMatch ? `$${priceMatch[1]}` : null,
          image_url: img,
          event_url: link ? (link.startsWith('http') ? link : this.venue.url) : this.venue.url,
        }));
      } catch {}
    });

    const seen = new Set<string>();
    return events.filter(e => {
      if (seen.has(e.title)) return false;
      seen.add(e.title);
      return true;
    });
  }
}
