import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

export class MagnetScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    // Magnet Theater may be JS-rendered
    const html = await scrapeWithPuppeteer(this.venue.url, 'a[href*="/show/"]');
    const $ = cheerio.load(html);
    const events: Event[] = [];

    // Find show links - the primary navigation pattern
    $('a[href*="/show/"]').each((_, el) => {
      try {
        const $el = $(el);
        const href = $el.attr('href') || '';
        if (href.includes('/show/tickets/')) return; // Skip ticket-only links, get main show links

        const $container = $el.closest('div, li, article').length
          ? $el.closest('div, li, article')
          : $el.parent();

        const title = $el.text().trim() || $container.find('h3, h2, h4').first().text().trim();
        if (!title || title.length < 3) return;

        // Filter out noise: navigation text, status badges, etc.
        const lowerTitle = title.toLowerCase();
        if (['no shows', 'tickets available', 'sold out', 'more', 'view all', 'calendar', 'home'].includes(lowerTitle)) return;
        if (lowerTitle.startsWith('tickets')) return;

        const text = $container.text();

        // Time patterns: "6:00pm", "8:00 PM"
        const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))/);

        // Price in parentheses: "($10)", "($17)"
        const priceMatch = text.match(/\(\$(\d+(?:\.\d{2})?)\)/) || text.match(/\$(\d+(?:\.\d{2})?)/);

        // Status
        const available = /tickets?\s+available/i.test(text);
        const soldOut = /sold\s*out|unavailable/i.test(text) && !available;

        // Date: use today since the calendar page shows today's events
        const today = new Date().toISOString().split('T')[0];

        // Check for explicit dates in the text
        const dateMatch = text.match(/(\w+),?\s+(\w+)\s+(\d{1,2}),?\s*(\d{4})?/);
        let date = today;
        if (dateMatch) {
          const d = new Date(`${dateMatch[2]} ${dateMatch[3]}, ${dateMatch[4] || new Date().getFullYear()}`);
          if (!isNaN(d.getTime())) {
            date = d.toISOString().split('T')[0];
          }
        }

        const img = $container.find('img').first().attr('src') || null;

        events.push(this.makeEvent({
          title: title.substring(0, 100),
          date,
          time: timeMatch ? this.parseTime(timeMatch[1]) : null,
          price: priceMatch ? `$${priceMatch[1]}` : null,
          sold_out: soldOut,
          image_url: img ? new URL(img, this.venue.url).href : null,
          event_url: href ? new URL(href, this.venue.url).href : this.venue.url,
        }));
      } catch {}
    });

    // Deduplicate by title
    const seen = new Set<string>();
    return events.filter(e => {
      if (seen.has(e.title)) return false;
      seen.add(e.title);
      return true;
    });
  }
}
