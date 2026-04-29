import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

// Alamo Drafthouse Brooklyn (downtown). The showtimes page is a heavy Ionic SPA
// where per-day showtimes only appear after picking a specific show + theater
// in the UI. Scraping every showtime would require N round-trips.
//
// Pragmatic compromise: capture each "Now Playing" movie as a single event
// dated today with no time. Users see what's currently in rotation; they click
// through to drafthouse.com for actual times.
export class AlamoDrafthouseBrooklynScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, '.adc-show-card, ion-card');
    const $ = cheerio.load(html);
    const events: Event[] = [];
    const today = new Date().toISOString().split('T')[0];
    const seen = new Set<string>();

    $('.adc-show-card, ion-card').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('ion-card-title, .adc-show-card__title-link').first().text().trim();
        if (!title || seen.has(title)) return;
        seen.add(title);

        const link = $el.find('a[href*="/show/"]').first().attr('href') || '';
        const event_url = link ? new URL(link, 'https://drafthouse.com').href : this.venue.url;
        const img = $el.find('img').first().attr('src') || null;

        events.push(this.makeEvent({
          title,
          date: today,
          time: null,
          image_url: img,
          event_url,
        }));
      } catch {}
    });

    return events;
  }
}
