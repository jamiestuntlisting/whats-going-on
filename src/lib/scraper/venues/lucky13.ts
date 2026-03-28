import { BaseScraper } from '../base';
import { Event } from '../../types';

export class Lucky13Scraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const $ = await this.fetchHtml(this.venue.url);
    const events: Event[] = [];
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();

    const addEvent = (event: Event) => {
      // Deduplicate by URL and normalized title
      const url = event.event_url || '';
      const normalTitle = event.title.toLowerCase().trim();
      if (url && seenUrls.has(url)) return;
      if (seenTitles.has(normalTitle)) return;
      if (url) seenUrls.add(url);
      seenTitles.add(normalTitle);
      events.push(event);
    };

    // Extract Eventbrite links
    $('a[href*="eventbrite.com/e/"]').each((_, el) => {
      try {
        const $el = $(el);
        const href = $el.attr('href') || '';
        const slugMatch = href.match(/eventbrite\.com\/e\/([\w-]+?)(?:-tickets-\d+)?$/);
        if (!slugMatch) return;

        const title = slugMatch[1]
          .replace(/-tickets-\d+$/, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
          .substring(0, 100);
        if (!title || title.length < 3) return;

        const $container = $el.closest('div, li, figure').length
          ? $el.closest('div, li, figure')
          : $el.parent();
        const img = $container.find('img').first().attr('src') ||
                    $container.find('img').first().attr('data-src') || null;

        const today = new Date().toISOString().split('T')[0];

        addEvent(this.makeEvent({
          title,
          date: today,
          image_url: img ? new URL(img, this.venue.url).href : null,
          event_url: href,
          description: 'Live at Lucky 13 Saloon',
        }));
      } catch {}
    });

    // Also try BigCartel links
    $('a[href*="bigcartel.com"]').each((_, el) => {
      try {
        const $el = $(el);
        const href = $el.attr('href') || '';
        const slugMatch = href.match(/product\/([\w-]+)/);
        if (!slugMatch) return;

        const title = slugMatch[1]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
          .substring(0, 100);

        const today = new Date().toISOString().split('T')[0];

        addEvent(this.makeEvent({
          title,
          date: today,
          event_url: href,
          description: 'Live at Lucky 13 Saloon',
        }));
      } catch {}
    });

    // Fallback: try Squarespace event patterns
    if (events.length === 0) {
      $('.summary-item, .eventlist-event, .gallery-item, article').each((_, el) => {
        try {
          const $el = $(el);
          const title = $el.find('h2, h3, .summary-title').first().text().trim() ||
                        $el.find('img').attr('alt')?.trim() || '';
          if (!title || title.length < 3) return;

          const timeEl = $el.find('time').first();
          const datetime = timeEl.attr('datetime') || '';
          const date = this.parseDate(datetime);
          if (!date) return;

          const img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || null;
          const link = $el.find('a').first().attr('href') || '';

          addEvent(this.makeEvent({
            title,
            date,
            image_url: img ? new URL(img, this.venue.url).href : null,
            event_url: link ? new URL(link, this.venue.url).href : this.venue.url,
          }));
        } catch {}
      });
    }

    return events;
  }
}
