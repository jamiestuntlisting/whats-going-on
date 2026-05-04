export interface Event {
  id: string;
  venue: string;
  venue_slug: string;
  category: 'music' | 'comedy' | 'theater' | 'variety';
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null;
  price: string | null;
  sold_out: boolean;
  image_url: string | null;
  event_url: string | null;
  description: string | null;
  scraped_at: string;
}

export interface VenueConfig {
  name: string;
  slug: string;
  url: string;
  category: Event['category'];
  neighborhood: string;
  group: string;
  groupOrder: number;
  venueOrder: number; // within group, by walking distance from home
  walkMinutes: number;
  transitMinutes: number | null; // subway time if far; null = just walk
  drinkPrice: number; // average drink price in dollars
  // Personal preference tier for sort order across the app. Lower wins.
  // 1–10  = top picks (Gowanus club night)
  // 11–20 = cinemas
  // 21–30 = big-stage concert halls
  // 99    = everything else (default), tie-broken by travel time
  // 100+  = explicitly demoted (Public Records is 150 — user wants it later)
  priority: number;
}

// Subway fare
export const SUBWAY_FARE = 2.90;

// Groups in the user's original order
export const VENUE_GROUPS = [
  "What's Happening in Gowanus",
  'Bars with Bands',
  'Long Shots',
  'Comedy Elsewhere',
  'Theater',
  'Cinema',
  'Big Stages',
] as const;

// Walking distances computed from 433 Warren St Brooklyn, NY 11217
// Venues within each group are ordered by distance from home
export const VENUES: VenueConfig[] = [
  // ── What's Happening in Gowanus (group 1) ──
  // All very close to 433 Warren St
  { name: 'Halyards', slug: 'halyards', url: '', category: 'variety', neighborhood: 'Gowanus',
    group: "What's Happening in Gowanus", groupOrder: 1, venueOrder: 1,
    walkMinutes: 5, transitMinutes: null, drinkPrice: 7, priority: 99 },
  { name: 'The Bell House', slug: 'bellhouse', url: 'https://www.thebellhouseny.com/shows', category: 'comedy', neighborhood: 'Gowanus',
    group: "What's Happening in Gowanus", groupOrder: 1, venueOrder: 2,
    walkMinutes: 8, transitMinutes: null, drinkPrice: 9, priority: 2 },
  { name: 'Littlefield', slug: 'littlefield', url: 'https://www.eventbrite.com/d/ny--brooklyn/littlefield/', category: 'variety', neighborhood: 'Gowanus',
    group: "What's Happening in Gowanus", groupOrder: 1, venueOrder: 3,
    walkMinutes: 9, transitMinutes: null, drinkPrice: 9, priority: 1 },
  { name: 'Union Hall', slug: 'unionhall', url: 'https://unionhallny.com/', category: 'comedy', neighborhood: 'Gowanus',
    group: "What's Happening in Gowanus", groupOrder: 1, venueOrder: 4,
    walkMinutes: 10, transitMinutes: null, drinkPrice: 9, priority: 3 },
  { name: 'Eastville Comedy Club', slug: 'eastville', url: 'https://www.eastvillecomedy.com', category: 'comedy', neighborhood: 'Gowanus',
    group: "What's Happening in Gowanus", groupOrder: 1, venueOrder: 5,
    walkMinutes: 12, transitMinutes: null, drinkPrice: 10, priority: 4 },
  { name: 'Murmrr', slug: 'murmrr', url: 'https://murmrr.com/', category: 'music', neighborhood: 'Gowanus',
    group: "What's Happening in Gowanus", groupOrder: 1, venueOrder: 6,
    walkMinutes: 14, transitMinutes: null, drinkPrice: 12, priority: 99 },
  { name: 'Heights Players', slug: 'heightsplayers', url: 'https://www.onthestage.tickets/the-heights-players', category: 'theater', neighborhood: 'Brooklyn Heights',
    group: "What's Happening in Gowanus", groupOrder: 1, venueOrder: 7,
    walkMinutes: 18, transitMinutes: null, drinkPrice: 0, priority: 99 },

  // ── Bars with Bands (group 2) ──
  { name: 'Lucky 13 Saloon', slug: 'lucky13', url: 'https://www.lucky13saloon.com/events', category: 'music', neighborhood: 'Park Slope',
    group: 'Bars with Bands', groupOrder: 2, venueOrder: 1,
    walkMinutes: 12, transitMinutes: null, drinkPrice: 7, priority: 99 },
  { name: 'Barbès', slug: 'barbes', url: 'https://www.viewcy.com/barbes', category: 'music', neighborhood: 'Park Slope',
    group: 'Bars with Bands', groupOrder: 2, venueOrder: 2,
    walkMinutes: 15, transitMinutes: null, drinkPrice: 8, priority: 99 },

  // ── Long Shots (group 3) ──
  { name: 'Public Records', slug: 'publicrecords', url: 'https://dice.fm/venue/public-records-w2qg', category: 'music', neighborhood: 'Gowanus',
    group: 'Long Shots', groupOrder: 3, venueOrder: 1,
    walkMinutes: 10, transitMinutes: null, drinkPrice: 15, priority: 150 },
  { name: 'Jalopy Theatre', slug: 'jalopy', url: 'https://www.viewcy.com/jalopytheatre', category: 'music', neighborhood: 'Red Hook',
    group: 'Long Shots', groupOrder: 3, venueOrder: 2,
    walkMinutes: 25, transitMinutes: null, drinkPrice: 8, priority: 99 },
  { name: "Young Ethel's", slug: 'youngethels', url: 'https://www.youngethels.com/events', category: 'music', neighborhood: 'Williamsburg',
    group: 'Long Shots', groupOrder: 3, venueOrder: 3,
    walkMinutes: 50, transitMinutes: 22, drinkPrice: 10, priority: 99 },
  { name: 'HERE Arts Center', slug: 'here', url: 'https://here.org/shows/', category: 'theater', neighborhood: 'SoHo',
    group: 'Long Shots', groupOrder: 3, venueOrder: 4,
    walkMinutes: 55, transitMinutes: 30, drinkPrice: 14, priority: 99 },

  // ── Comedy Elsewhere (group 4) ──
  { name: 'Brooklyn Comedy Collective', slug: 'brooklyncc', url: 'https://www.brooklyncc.com/show-schedule', category: 'comedy', neighborhood: 'Williamsburg',
    group: 'Comedy Elsewhere', groupOrder: 4, venueOrder: 1,
    walkMinutes: 45, transitMinutes: 20, drinkPrice: 10, priority: 99 },
  { name: 'Second City', slug: 'secondcity', url: 'https://www.secondcity.com/shows/', category: 'comedy', neighborhood: 'Williamsburg',
    group: 'Comedy Elsewhere', groupOrder: 4, venueOrder: 2,
    walkMinutes: 45, transitMinutes: 20, drinkPrice: 12, priority: 99 },
  { name: 'Caveat', slug: 'caveat', url: 'https://caveat.nyc/events', category: 'comedy', neighborhood: 'Lower East Side',
    group: 'Comedy Elsewhere', groupOrder: 4, venueOrder: 3,
    walkMinutes: 55, transitMinutes: 28, drinkPrice: 14, priority: 99 },
  { name: 'UCB', slug: 'ucb', url: 'https://ucbcomedy.com/nyc/', category: 'comedy', neighborhood: "Hell's Kitchen",
    group: 'Comedy Elsewhere', groupOrder: 4, venueOrder: 4,
    walkMinutes: 70, transitMinutes: 35, drinkPrice: 10, priority: 99 },
  { name: 'Magnet Theater', slug: 'magnet', url: 'https://magnettheater.com/calendar/', category: 'comedy', neighborhood: 'Midtown',
    group: 'Comedy Elsewhere', groupOrder: 4, venueOrder: 5,
    walkMinutes: 75, transitMinutes: 35, drinkPrice: 10, priority: 99 },

  // ── Theater (group 5) ──
  { name: 'Gallery Players', slug: 'galleryplayers', url: 'https://www.galleryplayers.com', category: 'theater', neighborhood: 'Park Slope',
    group: 'Theater', groupOrder: 5, venueOrder: 1,
    walkMinutes: 15, transitMinutes: null, drinkPrice: 0, priority: 99 },
  { name: 'Lucille Lortel Theatre', slug: 'lortel', url: 'https://lortel.org/', category: 'theater', neighborhood: 'West Village',
    group: 'Theater', groupOrder: 5, venueOrder: 2,
    walkMinutes: 55, transitMinutes: 25, drinkPrice: 14, priority: 99 },

  // ── Cinema (group 6) ──
  { name: 'Nitehawk Prospect Park', slug: 'nitehawkprospectpark',
    url: 'https://nitehawkcinema.com/prospectpark/showtimes/',
    category: 'variety', neighborhood: 'Park Slope',
    group: 'Cinema', groupOrder: 6, venueOrder: 1,
    walkMinutes: 20, transitMinutes: null, drinkPrice: 10, priority: 11 },
  { name: 'Alamo Drafthouse Brooklyn', slug: 'alamobrooklyn',
    url: 'https://drafthouse.com/brooklyn-downtown',
    category: 'variety', neighborhood: 'Downtown Brooklyn',
    group: 'Cinema', groupOrder: 6, venueOrder: 2,
    walkMinutes: 25, transitMinutes: 12, drinkPrice: 10, priority: 12 },
  { name: 'Nitehawk Williamsburg', slug: 'nitehawkwilliamsburg',
    url: 'https://nitehawkcinema.com/williamsburg/showtimes/',
    category: 'variety', neighborhood: 'Williamsburg',
    group: 'Cinema', groupOrder: 6, venueOrder: 3,
    walkMinutes: 50, transitMinutes: 25, drinkPrice: 10, priority: 13 },
  { name: 'BAM', slug: 'bam',
    url: 'https://www.bam.org/calendar',
    category: 'variety', neighborhood: 'Fort Greene',
    group: 'Cinema', groupOrder: 6, venueOrder: 4,
    walkMinutes: 35, transitMinutes: 18, drinkPrice: 14, priority: 14 },
  { name: 'Rooftop Films', slug: 'rooftopfilms',
    url: 'https://rooftopfilms.com/calendar/',
    category: 'variety', neighborhood: 'Various',
    group: 'Cinema', groupOrder: 6, venueOrder: 5,
    walkMinutes: 20, transitMinutes: null, drinkPrice: 10, priority: 15 },

  // ── Big Stages (group 7) — concert halls, lower priority by distance ──
  { name: 'Brooklyn Paramount', slug: 'brooklynparamount',
    url: 'https://www.brooklynparamount.com/shows',
    category: 'music', neighborhood: 'Downtown Brooklyn',
    group: 'Big Stages', groupOrder: 7, venueOrder: 1,
    walkMinutes: 30, transitMinutes: 15, drinkPrice: 14, priority: 21 },
  { name: 'Kings Theatre', slug: 'kingstheatre',
    url: 'https://www.kingstheatre.com/events',
    category: 'music', neighborhood: 'Flatbush',
    group: 'Big Stages', groupOrder: 7, venueOrder: 2,
    walkMinutes: 60, transitMinutes: 25, drinkPrice: 14, priority: 22 },
  { name: 'Barclays Center', slug: 'barclays',
    url: 'https://www.barclayscenter.com/events/category/concerts',
    category: 'music', neighborhood: 'Prospect Heights',
    group: 'Big Stages', groupOrder: 7, venueOrder: 3,
    walkMinutes: 25, transitMinutes: 12, drinkPrice: 16, priority: 23 },

  // ── Known broken / blocked ──
  // UCB (https://ucbcomedy.com/nyc/) — Cloudflare blocks both plain HTTP and
  //   stealth Puppeteer from datacenter IPs. Existing scraper returns 0 until
  //   we route through a residential-proxy service.
];

// Lookup venue config by slug
export function getVenueConfig(slug: string): VenueConfig | undefined {
  return VENUES.find(v => v.slug === slug);
}

// Transport tiers, derived from walkMinutes:
//   walk:    ≤ 15 min walk
//   bike:    16–40 min walk (~5–13 min Citi Bike)
//   transit: > 40 min walk (subway / drive)
export type TransportTier = 'walk' | 'bike' | 'transit';

export const TRANSPORT_LABELS: Record<TransportTier, string> = {
  walk: 'Walk to it',
  bike: 'Bike to it',
  transit: 'Subway away',
};

export const TRANSPORT_DESCRIPTIONS: Record<TransportTier, string> = {
  walk: 'Within a 15-minute walk',
  bike: 'A short Citi Bike ride away (15–40 min walk)',
  transit: 'Need a subway or a car',
};

export function getTransportTier(venue: VenueConfig): TransportTier {
  if (venue.walkMinutes <= 15) return 'walk';
  if (venue.walkMinutes <= 40) return 'bike';
  return 'transit';
}

export function getTransportTierBySlug(slug: string): TransportTier {
  const v = getVenueConfig(slug);
  return v ? getTransportTier(v) : 'transit';
}
