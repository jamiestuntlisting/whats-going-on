import { BaseScraper } from '../base';
import { Event } from '../../types';

// Kings Theatre uses ATG Tickets (MUI components). Each event card is wrapped
// in <div data-testid="showCard">. The structure includes:
//   - <a href="/events/<slug>/kings-theatre-brooklyn/"> for the link
//   - title text in headings
//   - date text like "Sat, May 2, 2026"
//   - genre text like "Concert"
//   - <picture><source srcSet="...cloudinary..." /></picture>
// We extract by walking each card and reading texts.
export class KingsTheatreScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const $ = await this.fetchHtml(this.venue.url);
    const events: Event[] = [];
    const seen = new Set<string>();

    $('[data-testid="showCard"]').each((_, el) => {
      try {
        const $el = $(el);
        const link = $el.find('a[href*="/events/"]').first().attr('href') || '';
        if (!link) return;

        // Title: first non-empty text element. Cards repeat title in nav/aria,
        // so prefer <h3>/<h2> and de-dup against link slug.
        const heading = $el.find('h1, h2, h3, h4').map((_, h) => $(h).text().trim()).get()
          .find(t => t && t.length > 1 && !/^buy|^more$/i.test(t)) || '';
        const title = (heading || $el.find('a[href*="/events/"]').first().text().trim()).replace(/\s+/g, ' ');
        if (!title || title.length < 2) return;

        // Find date string anywhere in card. No \b at start because cheerio's
        // .text() concatenates adjacent elements with no whitespace, e.g.
        // "TheatreSat, May 2, 2026" — the comma+month is specific enough.
        const text = $el.text();
        const dateMatch = text.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}/);
        if (!dateMatch) return;
        const date = this.parseDate(dateMatch[0]);
        if (!date) return;

        const key = `${title}|${date}`;
        if (seen.has(key)) return;
        seen.add(key);

        const eventUrl = new URL(link, this.venue.url).href;
        // Image: from <source srcSet="...">
        const srcSet = $el.find('source').first().attr('srcSet') || $el.find('source').first().attr('srcset') || '';
        const imgMatch = srcSet.match(/(https:\/\/[^\s]+?)\s/);
        const image = imgMatch ? imgMatch[1] : ($el.find('img').first().attr('src') || null);

        // Genre / description
        const genreMatch = text.match(/\b(Concert|Comedy|Dance|Theater|Theatre|Family|Musical|Opera|Talks?|Tribute)\b/i);
        const genre = genreMatch ? genreMatch[0] : null;

        events.push(this.makeEvent({
          title,
          date,
          image_url: image,
          event_url: eventUrl,
          description: genre,
        }));
      } catch {}
    });

    return events;
  }
}
