import { BaseScraper } from '../base';
import { Event } from '../../types';

const NOISE = new Set(['login', 'buy tickets', 'stream now', 'donate', 'sign up', 'subscribe', 'menu', 'contact', 'about', 'home', 'search', 'box office', 'lortel theatre']);
const NOISE_PATTERNS = [/^\d+\s*carousel/i, /^slide\s*\d/i, /^image\s*\d/i];

export class LortelScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const $ = await this.fetchHtml(this.venue.url);
    const events: Event[] = [];
    const today = new Date().toISOString().split('T')[0];

    // Smart Slider slides contain the main shows
    $('.n2-ss-slide').each((_, el) => {
      try {
        const $el = $(el);
        const text = $el.text().trim();
        const img = $el.find('img').first().attr('src') || null;
        const link = $el.find('a[href*="boxoffice.lortel"]').first().attr('href') ||
                     $el.find('a').first().attr('href') || '';

        // Remove button/link text before extracting title
        $el.find('a, button, .n2-ss-button-container').remove();
        const cleanText = $el.text().trim();
        const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
        let title = '';
        for (const line of lines) {
          if (NOISE.has(line.toLowerCase())) continue;
          if (NOISE_PATTERNS.some(p => p.test(line))) continue;
          if (line.length > title.length && line.length < 80) {
            title = line;
          }
        }
        if (!title) return;

        events.push(this.makeEvent({
          title: title.substring(0, 100),
          date: today,
          image_url: img ? new URL(img, this.venue.url).href : null,
          event_url: link ? (link.startsWith('http') ? link : new URL(link, this.venue.url).href) : this.venue.url,
          description: 'Now showing at Lucille Lortel Theatre',
        }));
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
