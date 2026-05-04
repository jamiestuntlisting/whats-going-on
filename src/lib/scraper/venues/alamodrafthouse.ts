import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

// Alamo Drafthouse Brooklyn (downtown). The showtimes page is a heavy Ionic SPA
// where per-day showtimes only appear after picking a specific show + theater
// in the UI. The mother-server JSON endpoints
// (/s/mother/v2/schedule/national, /v2/schedule/coming-soon/brooklyn-downtown,
// /v2/schedule/presentation/<slug>) all return `sessions: []` — sessions live
// inside the Vista booking flow which we don't want to mock.
//
// Pragmatic compromise: capture each "Now Playing" movie as a separate event
// for each of the next DAYS_AHEAD days. Each event has no `time` — the user
// clicks through to drafthouse.com for the actual showtimes. Spreading across
// days means the movie stays visible in the Today/Calendar views between
// scrapes; the scheduled scraper refreshes the rotation.
const DAYS_AHEAD = 7;

export class AlamoDrafthouseBrooklynScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, '.adc-show-card, ion-card');
    const $ = cheerio.load(html);
    const events: Event[] = [];
    const today = new Date();
    const movies: { title: string; event_url: string; image_url: string | null }[] = [];
    const seenTitles = new Set<string>();

    $('.adc-show-card, ion-card').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('ion-card-title, .adc-show-card__title-link').first().text().trim();
        if (!title || seenTitles.has(title)) return;
        seenTitles.add(title);

        const link = $el.find('a[href*="/show/"]').first().attr('href') || '';
        const event_url = link ? new URL(link, 'https://drafthouse.com').href : this.venue.url;
        const img = $el.find('img').first().attr('src') || null;
        movies.push({ title, event_url, image_url: img });
      } catch {}
    });

    for (let offset = 0; offset < DAYS_AHEAD; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      const dateStr = d.toISOString().split('T')[0];
      for (const m of movies) {
        events.push(this.makeEvent({
          title: m.title,
          date: dateStr,
          time: null,
          image_url: m.image_url,
          event_url: m.event_url,
          description: 'Currently in rotation — see drafthouse.com for showtimes',
        }));
      }
    }

    return events;
  }
}
