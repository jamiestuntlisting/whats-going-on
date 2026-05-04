import { BaseScraper } from '../base';
import { Event } from '../../types';

// BAM publishes its calendar server-side. Each event card looks like:
//   <a href="/<category>/<year>/<slug>">
//     <div class="eventInfo">
//       <div class="genre">Live Broadcast | Opera | Film</div>
//       <h3 class="title">Eugene Onegin</h3>
//       <div class="mobileModuleDate">Sat, May 2, 2026</div>
//       <div class="description">...</div>
//     </div>
//   </a>
// We use the mobileModuleDate which is a normalized full date string.
export class BAMScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const $ = await this.fetchHtml(this.venue.url);
    const events: Event[] = [];
    const seen = new Set<string>();

    $('.eventInfo').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h3.title, .title').first().text().replace(/\s+/g, ' ').trim();
        if (!title || title.length < 3) return;

        const dateStr = $el.find('.mobileModuleDate').first().text().trim() ||
                        $el.parent().find('.mobileModuleDate').first().text().trim();
        const date = this.parseDate(dateStr);
        if (!date) return;

        const key = `${title}|${date}`;
        if (seen.has(key)) return;
        seen.add(key);

        // Walk up to find the enclosing <a href>
        const $link = $el.closest('a[href]').length ? $el.closest('a[href]') : $el.parent().closest('a[href]');
        const href = $link.attr('href') || '';
        const eventUrl = href ? new URL(href, this.venue.url).href : null;

        const description = $el.find('.description').first().text().replace(/\s+/g, ' ').trim() || null;
        const genre = $el.find('.genre').first().text().replace(/\s+/g, ' ').trim();

        // Find image — look in the parent <a> or sibling <picture>/<img>
        const $imgRoot = $link.length ? $link : $el.parent();
        const img = $imgRoot.find('img').first().attr('src') || null;
        const imageUrl = img ? new URL(img.split('?')[0], this.venue.url).href : null;

        events.push(this.makeEvent({
          title,
          date,
          image_url: imageUrl,
          event_url: eventUrl,
          description: description || (genre || null),
        }));
      } catch {}
    });

    return events;
  }
}
