import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

export class PublicRecordsScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    // DICE is a React SPA - needs Puppeteer
    const html = await scrapeWithPuppeteer(this.venue.url, 'script[type="application/ld+json"]');
    const $ = cheerio.load(html);
    const events: Event[] = [];

    // Try JSON-LD first (MusicEvent schema)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'MusicEvent' || item['@type'] === 'Event') {
            const date = this.parseDate(item.startDate);
            if (!date) continue;
            const timeMatch = item.startDate?.match(/T(\d{2}:\d{2})/);
            events.push(this.makeEvent({
              title: item.name,
              date,
              time: timeMatch ? this.parseTime(timeMatch[1]) : null,
              price: item.offers?.price ? `$${item.offers.price}` : item.offers?.lowPrice ? `From $${item.offers.lowPrice}` : null,
              sold_out: item.offers?.availability === 'https://schema.org/SoldOut',
              image_url: item.image?.[0] || item.image || null,
              event_url: item.url || this.venue.url,
              description: item.description?.substring(0, 200) || null,
            }));
          }
        }
      } catch {}
    });

    // Fallback: parse rendered event cards
    if (events.length === 0) {
      $('a[href*="/event/"], a[href*="dice.fm/event"]').each((_, el) => {
        try {
          const $el = $(el);
          const title = $el.find('h3, h2, [class*="title"], p').first().text().trim();
          if (!title || title.length < 3) return;
          const text = $el.text();
          // DICE dates: "Fri 27 Mar", "Sat 28 Mar"
          const dateMatch = text.match(/(\w{3})\s+(\d{1,2})\s+(\w{3})/);
          let date: string | null = null;
          if (dateMatch) {
            const d = new Date(`${dateMatch[3]} ${dateMatch[2]}, ${new Date().getFullYear()}`);
            if (!isNaN(d.getTime())) {
              date = d.toISOString().split('T')[0];
            }
          }
          if (!date) return;

          const priceMatch = text.match(/(?:From\s+)?\$[\d.]+/);
          const img = $el.find('img').first().attr('src') || null;
          const link = $el.attr('href') || '';

          events.push(this.makeEvent({
            title,
            date,
            price: priceMatch ? priceMatch[0] : null,
            image_url: img,
            event_url: link ? (link.startsWith('http') ? link : `https://dice.fm${link}`) : this.venue.url,
          }));
        } catch {}
      });
    }

    return events;
  }
}
