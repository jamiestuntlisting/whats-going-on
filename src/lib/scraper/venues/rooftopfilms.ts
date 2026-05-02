import { BaseScraper } from '../base';
import { Event } from '../../types';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

// Rooftop Films card structure on /calendar/:
//   <div class="card plum">
//     <div class="card-image-wrap"><img ...></div>
//     <div class="card-date-wrap">
//       <span class="event-day">Sat</span>
//       <span class="event-month">May</span>
//       <span class="event-date">2</span>
//       <span class="event-time">2:00 PM</span>
//     </div>
//     <div class="card-body">
//       <h4 class="card-title">...</h4>
//       <p class="card-category">Partner Event</p>
//       <p class="card-location">...</p>
//     </div>
//     <a class="card-detail" href="https://rooftopfilms.com/event/.../">Details</a>
//   </div>
export class RooftopFilmsScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const $ = await this.fetchHtml(this.venue.url);
    const events: Event[] = [];
    const seen = new Set<string>();
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    $('.card').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('.card-title').first().text().replace(/\s+/g, ' ').trim();
        if (!title) return;

        const monthRaw = $el.find('.event-month').first().text().trim().toLowerCase().slice(0, 3);
        const dayRaw = $el.find('.event-date').first().text().trim();
        const month = MONTHS[monthRaw];
        const day = parseInt(dayRaw, 10);
        if (!month || !day) return;
        const year = month < currentMonth ? currentYear + 1 : currentYear;
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const key = `${title}|${date}`;
        if (seen.has(key)) return;
        seen.add(key);

        const timeRaw = $el.find('.event-time').first().text().trim();
        const time = timeRaw ? this.parseTime(timeRaw) : null;
        const description = $el.find('.card-location').first().text().replace(/\s+/g, ' ').trim() || null;

        const detailHref = $el.find('a.card-detail').first().attr('href') || '';
        const eventUrl = detailHref || null;

        // Image lives in .card-image background-image OR <img>
        let img: string | null = $el.find('img').first().attr('src') || null;
        if (!img) {
          const styleAttr = $el.find('.card-image').first().attr('style') || '';
          const m = styleAttr.match(/url\(['"]?([^'")]+)['"]?\)/);
          img = m ? m[1] : null;
        }

        events.push(this.makeEvent({
          title,
          date,
          time,
          image_url: img,
          event_url: eventUrl,
          description,
        }));
      } catch {}
    });

    return events;
  }
}
