import * as cheerio from 'cheerio';
import { BaseScraper } from '../base';
import { Event } from '../../types';

export class EastvilleScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const $ = await this.fetchHtml(this.venue.url);
    const events: Event[] = [];

    // Try JSON-LD first
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] || [data];
        for (const item of items) {
          if (item['@type'] === 'ComedyEvent' || item['@type'] === 'Event') {
            const date = this.parseDate(item.startDate);
            if (!date) continue;
            const timeMatch = item.startDate?.match(/T(\d{2}:\d{2})/);
            events.push(this.makeEvent({
              title: item.name,
              date,
              time: timeMatch ? this.parseTime(timeMatch[1]) : null,
              price: item.offers?.price ? `$${item.offers.price}` : item.offers?.lowPrice ? `$${item.offers.lowPrice}` : null,
              sold_out: item.offers?.availability === 'https://schema.org/SoldOut',
              image_url: item.image?.[0] || item.image || null,
              event_url: item.url || this.venue.url,
              description: item.description?.substring(0, 200) || null,
            }));
          }
        }
      } catch {}
    });

    // Fallback to HTML parsing if no JSON-LD events
    if (events.length === 0) {
      $('.event, .show, [class*="event"]').each((_, el) => {
        try {
          const $el = $(el);
          const title = $el.find('h2, h3, .title').first().text().trim();
          if (!title) return;
          const dateText = $el.find('time, .date, [class*="date"]').first().text().trim() ||
                           $el.find('time').attr('datetime') || '';
          const date = this.parseDate(dateText);
          if (!date) return;
          const timeText = $el.find('.time, [class*="time"]').first().text().trim();
          const priceText = $el.text().match(/\$\d+/)?.[0] || null;
          const img = $el.find('img').first().attr('src') || null;
          const link = $el.find('a').first().attr('href') || '';

          events.push(this.makeEvent({
            title,
            date,
            time: this.parseTime(timeText),
            price: priceText,
            image_url: img ? new URL(img, this.venue.url).href : null,
            event_url: link ? new URL(link, this.venue.url).href : this.venue.url,
          }));
        } catch {}
      });
    }

    return events;
  }
}
