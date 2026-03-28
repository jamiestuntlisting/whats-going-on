import { Event, VENUES, VenueConfig } from '../types';
import { upsertEvents, clearVenueEvents } from '../db';
import { closePuppeteerBrowser } from './base';

// Import all scrapers
import { LittlefieldScraper } from './venues/littlefield';
import { BellHouseScraper } from './venues/bellhouse';
import { UnionHallScraper } from './venues/unionhall';
import { EastvilleScraper } from './venues/eastville';
import { MurmrrScraper } from './venues/murmrr';
import { HeightsPlayersScraper } from './venues/heightsplayers';
import { HalyardsScraper } from './venues/halyards';
import { BarbesScraper } from './venues/barbes';
import { Lucky13Scraper } from './venues/lucky13';
import { PublicRecordsScraper } from './venues/publicrecords';
import { YoungEthelsScraper } from './venues/youngethels';
import { JalopyScraper } from './venues/jalopy';
import { OvationTixScraper } from './venues/ovationtix';
import { UCBScraper } from './venues/ucb';
import { BrooklynCCScraper } from './venues/brooklyncc';
import { SecondCityScraper } from './venues/secondcity';
import { MagnetScraper } from './venues/magnet';
import { CaveatScraper } from './venues/caveat';
import { LortelScraper } from './venues/lortel';
import { GalleryPlayersScraper } from './venues/galleryplayers';
import { BaseScraper } from './base';

function getScraperForVenue(venue: VenueConfig): BaseScraper | null {
  switch (venue.slug) {
    case 'littlefield': return new LittlefieldScraper(venue);
    case 'bellhouse': return new BellHouseScraper(venue);
    case 'unionhall': return new UnionHallScraper(venue);
    case 'eastville': return new EastvilleScraper(venue);
    case 'murmrr': return new MurmrrScraper(venue);
    case 'heightsplayers': return new HeightsPlayersScraper(venue);
    case 'halyards': return new HalyardsScraper(venue);
    case 'barbes': return new BarbesScraper(venue);
    case 'lucky13': return new Lucky13Scraper(venue);
    case 'publicrecords': return new PublicRecordsScraper(venue);
    case 'youngethels': return new YoungEthelsScraper(venue);
    case 'jalopy': return new JalopyScraper(venue);
    case 'here': return new OvationTixScraper(venue);
    case 'ucb': return new UCBScraper(venue);
    case 'brooklyncc': return new BrooklynCCScraper(venue);
    case 'secondcity': return new SecondCityScraper(venue);
    case 'magnet': return new MagnetScraper(venue);
    case 'caveat': return new CaveatScraper(venue);
    case 'lortel': return new LortelScraper(venue);
    case 'galleryplayers': return new GalleryPlayersScraper(venue);
    default: return null;
  }
}

export interface ScrapeResult {
  venue: string;
  eventsFound: number;
  error?: string;
}

export async function scrapeAllVenues(): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  // Scrape server-rendered sites first (faster, no Puppeteer needed)
  const serverRendered = ['eastville', 'lortel', 'galleryplayers', 'lucky13', 'halyards'];
  const puppeteerBased = ['littlefield', 'bellhouse', 'unionhall', 'murmrr', 'heightsplayers', 'barbes', 'publicrecords', 'youngethels', 'jalopy', 'here', 'ucb', 'brooklyncc', 'secondcity', 'magnet', 'caveat'];

  // Run server-rendered scrapers in parallel (they're just HTTP fetches)
  const serverVenues = VENUES.filter(v => serverRendered.includes(v.slug));
  const serverResults = await Promise.allSettled(
    serverVenues.map(async (venue) => {
      const scraper = getScraperForVenue(venue);
      if (!scraper) return { venue: venue.name, eventsFound: 0, error: 'No scraper' };
      try {
        const events = await scraper.scrape();
        if (events.length > 0) {
          clearVenueEvents(venue.slug);
          upsertEvents(events);
        }
        return { venue: venue.name, eventsFound: events.length };
      } catch (err) {
        return { venue: venue.name, eventsFound: 0, error: String(err) };
      }
    })
  );

  for (const result of serverResults) {
    results.push(result.status === 'fulfilled' ? result.value : { venue: 'unknown', eventsFound: 0, error: String(result.reason) });
  }

  // Run Puppeteer scrapers sequentially (shared browser)
  for (const venue of VENUES.filter(v => puppeteerBased.includes(v.slug))) {
    const scraper = getScraperForVenue(venue);
    if (!scraper) {
      results.push({ venue: venue.name, eventsFound: 0, error: 'No scraper' });
      continue;
    }
    try {
      const events = await scraper.scrape();
      if (events.length > 0) {
        clearVenueEvents(venue.slug);
        upsertEvents(events);
      }
      results.push({ venue: venue.name, eventsFound: events.length });
    } catch (err) {
      results.push({ venue: venue.name, eventsFound: 0, error: String(err) });
    }
  }

  // Close browser when done
  await closePuppeteerBrowser();

  return results;
}

export async function scrapeVenue(slug: string): Promise<ScrapeResult> {
  const venue = VENUES.find(v => v.slug === slug);
  if (!venue) return { venue: slug, eventsFound: 0, error: 'Venue not found' };

  const scraper = getScraperForVenue(venue);
  if (!scraper) return { venue: venue.name, eventsFound: 0, error: 'No scraper' };

  try {
    const events = await scraper.scrape();
    if (events.length > 0) {
      clearVenueEvents(venue.slug);
      upsertEvents(events);
    }
    await closePuppeteerBrowser();
    return { venue: venue.name, eventsFound: events.length };
  } catch (err) {
    await closePuppeteerBrowser();
    return { venue: venue.name, eventsFound: 0, error: String(err) };
  }
}
