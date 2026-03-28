import * as cheerio from 'cheerio';
import { Event, VenueConfig } from '../types';
import { generateEventId } from '../db';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export abstract class BaseScraper {
  protected venue: VenueConfig;

  constructor(venue: VenueConfig) {
    this.venue = venue;
  }

  abstract scrape(): Promise<Event[]>;

  protected async fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    const html = await response.text();
    return cheerio.load(html);
  }

  protected async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  protected makeEvent(partial: Partial<Event> & { title: string; date: string }): Event {
    return {
      id: generateEventId(this.venue.slug, partial.title, partial.date),
      venue: this.venue.name,
      venue_slug: this.venue.slug,
      category: partial.category ?? this.venue.category,
      title: partial.title,
      date: partial.date,
      time: partial.time ?? null,
      price: partial.price ?? null,
      sold_out: partial.sold_out ?? false,
      image_url: partial.image_url ?? null,
      event_url: partial.event_url ?? null,
      description: partial.description ?? null,
      scraped_at: new Date().toISOString(),
    };
  }

  protected parseDate(dateStr: string): string | null {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }

  protected parseTime(timeStr: string): string | null {
    if (!timeStr) return null;
    // Clean up and normalize time string
    const cleaned = timeStr.trim().replace(/\s+/g, ' ');
    // Match patterns like "8:00 PM", "8pm", "20:00"
    const match = cleaned.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?/);
    if (!match) return null;
    let hours = parseInt(match[1]);
    const minutes = match[2] || '00';
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    if (!period && hours < 12 && hours >= 1 && hours <= 6) {
      // Assume PM for venue events between 1-6 without period
      hours += 12;
    }
    const h = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${h}:${minutes} ${ampm}`;
  }
}

// Puppeteer helper for SPA sites
let _browser: import('puppeteer').Browser | null = null;

export async function getPuppeteerBrowser(): Promise<import('puppeteer').Browser> {
  if (_browser && _browser.connected) return _browser;
  const puppeteer = await import('puppeteer');
  _browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  return _browser;
}

export async function closePuppeteerBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

export async function scrapeWithPuppeteer(url: string, waitSelector?: string): Promise<string> {
  const browser = await getPuppeteerBrowser();
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    if (waitSelector) {
      await page.waitForSelector(waitSelector, { timeout: 10000 }).catch(() => {});
    }
    // Small delay for dynamic content
    await new Promise(r => setTimeout(r, 2000));
    return await page.content();
  } finally {
    await page.close();
  }
}
