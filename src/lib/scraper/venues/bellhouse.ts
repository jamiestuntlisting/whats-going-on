import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

export class BellHouseScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, 'a[href*="event"]');
    const $ = cheerio.load(html);
    const events: Event[] = [];

    // Bell House Next.js - try to extract from __next_f script tags first
    $('script').each((_, el) => {
      try {
        const scriptContent = $(el).html() || '';
        if (!scriptContent.includes('start_date_local') && !scriptContent.includes('startDate')) return;

        // Extract JSON-like data from RSC payloads
        const eventMatches = scriptContent.matchAll(/"name"\s*:\s*"([^"]+)".*?"start_date_local"\s*:\s*"([^"]+)"/g);
        for (const match of eventMatches) {
          const title = match[1];
          const startDate = match[2];
          const date = this.parseDate(startDate);
          if (!date || !title) continue;

          const timeMatch = startDate.match(/T(\d{2}:\d{2})/);
          events.push(this.makeEvent({
            title,
            date,
            time: timeMatch ? this.parseTime(timeMatch[1]) : null,
            event_url: this.venue.url,
          }));
        }
      } catch {}
    });

    // Fallback to HTML parsing
    if (events.length === 0) {
      $('a[href*="event"], .event-card, .show-card, article, [class*="event"]').each((_, el) => {
        try {
          const $el = $(el);
          const title = $el.find('h2, h3, h4, .title').first().text().trim() ||
                        $el.text().trim().split('\n')[0]?.trim() || '';
          if (!title || title.length < 3 || title.length > 150) return;

          const text = $el.text();
          const dateMatch = text.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})?/) ||
                            text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
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

          events.push(this.makeEvent({
            title: title.substring(0, 100),
            date,
            time: timeMatch ? this.parseTime(timeMatch[1]) : null,
            price: priceMatch ? `$${priceMatch[1]}` : null,
            image_url: img,
            event_url: link ? (link.startsWith('http') ? link : new URL(link, this.venue.url).href) : this.venue.url,
          }));
        } catch {}
      });
    }

    return events;
  }
}
