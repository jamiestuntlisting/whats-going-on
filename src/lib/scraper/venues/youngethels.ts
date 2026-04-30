import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

// Young Ethel's events page renders a two-level <ul>: outer <li> per day with
// a <time aria-label="Thursday, April 30th"> and an inner <ul> of show items,
// each show being an inner <li> with <time aria-label="7pm"> and a span title.
export class YoungEthelsScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, 'time[datetime]');
    const $ = cheerio.load(html);
    const events: Event[] = [];

    // Find day-level <li>s — they have a direct <time> child plus a nested <ul>.
    $('li').each((_, dayEl) => {
      const $day = $(dayEl);
      const $dayTime = $day.children('time[datetime]').first();
      if (!$dayTime.length) return;
      const dayIso = $dayTime.attr('datetime') || '';
      const date = this.parseDate(dayIso);
      if (!date) return;

      $day.find('ul li').each((_, showEl) => {
        const $show = $(showEl);
        const $showTime = $show.children('time').first();
        const timeLabel = $showTime.attr('aria-label') || $showTime.text().trim();
        const title = $show.find('span').first().text().replace(/\s+/g, ' ').trim();
        if (!title) return;
        events.push(this.makeEvent({
          title,
          date,
          time: this.parseTime(timeLabel),
          event_url: this.venue.url,
        }));
      });
    });

    return events;
  }
}
