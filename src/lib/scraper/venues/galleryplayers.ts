import { BaseScraper } from '../base';
import { Event } from '../../types';

export class GalleryPlayersScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const $ = await this.fetchHtml(this.venue.url);
    const events: Event[] = [];

    // Gallery Players uses simple WordPress with h3 titles and h4 date ranges
    // Parse h3 elements followed by h4 "On stage" patterns
    $('h3, h4').each((_, el) => {
      try {
        const $el = $(el);
        const tagName = (el as unknown as { name: string }).name || '';

        if (tagName === 'h3') {
          const title = $el.text().trim();
          if (!title || title.length < 3) return;

          // Look at the next sibling h4 for "On stage" date info
          const nextText = $el.next('h4').text().trim() || $el.next().next('h4').text().trim() || '';
          const rangeMatch = nextText.match(/(?:On stage\s+)?(\w+)\s+(\d{1,2})\s*[-–]\s*(\w+)?\s*(\d{1,2}),?\s*(\d{4})?/i);

          let date: string | null = null;
          if (rangeMatch) {
            const year = rangeMatch[5] || new Date().getFullYear();
            const d = new Date(`${rangeMatch[1]} ${rangeMatch[2]}, ${year}`);
            if (!isNaN(d.getTime())) {
              date = d.toISOString().split('T')[0];
            }
          }

          // Also try single date patterns
          if (!date) {
            const singleMatch = nextText.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})?/);
            if (singleMatch) {
              const year = singleMatch[3] || new Date().getFullYear();
              const d = new Date(`${singleMatch[1]} ${singleMatch[2]}, ${year}`);
              if (!isNaN(d.getTime())) {
                date = d.toISOString().split('T')[0];
              }
            }
          }

          if (!date) {
            date = new Date().toISOString().split('T')[0];
          }

          // Find nearby image and ticket link
          const $parent = $el.parent();
          const img = $parent.find('img').first().attr('src') || null;
          const link = $parent.find('a[href*="ticket"], a[href*="square.site"]').first().attr('href') ||
                       $parent.find('a').first().attr('href') || '';

          events.push(this.makeEvent({
            title,
            date,
            image_url: img ? (img.startsWith('http') ? img : new URL(img, this.venue.url).href) : null,
            event_url: link ? (link.startsWith('http') ? link : new URL(link, this.venue.url).href) : this.venue.url,
            description: nextText || 'Gallery Players production',
          }));
        }
      } catch {}
    });

    const seen = new Set<string>();
    return events.filter(e => {
      const key = e.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
