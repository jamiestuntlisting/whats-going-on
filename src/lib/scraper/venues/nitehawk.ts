import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

// Nitehawk Cinema (both Williamsburg and Prospect Park).
//
// /showtimes/ on its own only has *special* programming (~10 articles with
// titles like "Movie – M/D/YY @ H:MM pm"). For regular daily films we hit
// per-day URLs: /<location>/<YYYY-MM-DD>/<offset>/ which list a
// <ul id="buy-tickets-listview"> with one <li class="show-container"> per
// movie, each containing <ul class="showtime-button-row"> with showtimes.
//
// We collect both: special programming from /showtimes/, plus 7 days of
// regular shows starting today.
const DAYS_AHEAD = 7;

export class NitehawkScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const events: Event[] = [];
    const seen = new Set<string>();

    // Special programming page
    try {
      const html = await scrapeWithPuppeteer(this.venue.url, 'article');
      const $ = cheerio.load(html);
      $('article').each((_, el) => {
        try {
          const $el = $(el);
          const heading = $el.find('h1, h2, h3').first().text().trim();
          const m = heading.match(/^(.+?)\s+[–—\-]\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*@\s*(\d{1,2}:\d{2}\s*[ap]m)/i);
          if (!m) return;
          const [, rawTitle, mm, dd, yyRaw, timeRaw] = m;
          const title = rawTitle.trim();
          const yy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
          const date = `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
          const time = this.parseTime(timeRaw);
          const key = `${title}|${date}|${time}`;
          if (seen.has(key)) return;
          seen.add(key);

          const link = $el.find('a[href*="/showtimes/"]').first().attr('href') ||
                       $el.find('a').first().attr('href') || '';
          const event_url = link ? new URL(link, this.venue.url).href : this.venue.url;
          const img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || null;

          events.push(this.makeEvent({
            title, date, time,
            image_url: img ? new URL(img, this.venue.url).href : null,
            event_url,
          }));
        } catch {}
      });
    } catch {
      // soft-fail: don't lose the daily-shows pass if /showtimes/ breaks
    }

    // Daily shows for the next N days
    const baseUrl = this.venue.url.replace(/\/showtimes\/?$/, '/');
    const today = new Date();
    for (let offset = 0; offset < DAYS_AHEAD; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      const dateStr = d.toISOString().split('T')[0];
      const dayUrl = `${baseUrl}${dateStr}/${offset}/`;
      try {
        const $ = await this.fetchHtml(dayUrl);
        $('#buy-tickets-listview .show-container').each((_, el) => {
          try {
            const $el = $(el);
            const title = $el.find('.show-title').first().text().trim();
            if (!title) return;

            const description = $el.find('.short-description').first().text().replace(/\s+/g, ' ').trim() || null;
            const detailHref = $el.find('.overlay-link').first().attr('href') || '';
            const event_url = detailHref ? new URL(detailHref, this.venue.url).href : this.venue.url;

            const styleAttr = $el.find('.show-thumbnail').first().attr('style') || '';
            const imgMatch = styleAttr.match(/url\(['"]?([^'")]+)['"]?\)/);
            const image_url = imgMatch ? imgMatch[1] : null;

            const showtimes: string[] = [];
            $el.find('.showtime-button-row .showtime').each((_, sa) => {
              const t = $(sa).text().replace(/\s+/g, ' ').trim();
              if (t) showtimes.push(t);
            });
            if (!showtimes.length) return;

            // Use the earliest showtime as the event's `time`; list all in
            // description so the user sees all options without 4x event spam.
            const earliest = showtimes[0];
            const time = this.parseTime(earliest);
            const allTimes = showtimes.length > 1 ? `Showtimes: ${showtimes.join(', ')}` : null;
            const fullDescription = [description, allTimes].filter(Boolean).join(' · ') || null;

            const key = `${title}|${dateStr}|${time}`;
            if (seen.has(key)) return;
            seen.add(key);

            events.push(this.makeEvent({
              title,
              date: dateStr,
              time,
              image_url,
              event_url,
              description: fullDescription,
            }));
          } catch {}
        });
      } catch {
        // skip days that 404 / fail
      }
    }

    return events;
  }
}
