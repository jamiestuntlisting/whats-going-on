import fs from 'fs';
import path from 'path';
import { Event, getVenueConfig } from './types';
import { getAllEvents } from './events-data';

export interface ArtistAppearance {
  date: string;
  venueName: string;
  venueSlug: string;
  eventTitle: string;
  eventUrl: string | null;
}

export interface PlaylistArtist {
  name: string;
  appearances: ArtistAppearance[];
  effectiveMinutes: number; // closest appearance, used for ordering within section
  walkOnly: boolean;        // true if any appearance is at a walk-only venue
  videoId: string | null;   // top YouTube search result, populated by scripts/resolve-youtube.ts
}

// YouTube ID cache, written by scripts/resolve-youtube.ts. Loaded lazily.
type YoutubeCache = Record<string, { videoId: string | null; resolvedAt: string }>;
const YT_CACHE_PATH = path.join(process.cwd(), 'public', 'youtube-ids.json');
let youtubeCache: YoutubeCache | null = null;

function loadYoutubeCache(): YoutubeCache {
  if (youtubeCache) return youtubeCache;
  try {
    youtubeCache = JSON.parse(fs.readFileSync(YT_CACHE_PATH, 'utf-8'));
  } catch {
    youtubeCache = {};
  }
  return youtubeCache!;
}

function lookupVideoId(artist: string): string | null {
  const c = loadYoutubeCache();
  const entry = c[artist.toLowerCase().trim()];
  return entry?.videoId ?? null;
}

export interface PlaylistSection {
  label: string;
  description: string;
  artists: PlaylistArtist[];
}

// Comedy-ish keywords that prove a "music"-categorized title isn't actually
// a band — Eventbrite/JSON-LD pipelines often mis-tag standup as MusicEvent.
const COMEDY_HINTS = [
  /\bcomedy\b/i,
  /\bcomedian\b/i,
  /\bcomic\b/i,
  /\bstand\s*-?\s*up\b/i,
  /\bopen\s*mic\b/i,
  /\bkaraoke\b/i,
  /\btrivia\b/i,
  /\bbingo\b/i,
  /\bquiz\b/i,
  /\bvariety\b/i,
  /\bimprov\b/i,
  /\bsketch\b/i,
];

// Tokens we drop from artist candidates outright.
const TOKEN_BLOCKLIST = new Set([
  'tba', 'tbd', 'special guest', 'special guests', 'and friends', 'and more',
  'free', 'live', 'doors', 'show', 'tickets', 'presents', 'present',
  'and', 'with', 'feat', 'featuring', 'plus', 'guests',
]);

// Split candidates: order matters — try longest tokens first so e.g. " feat. "
// wins over " feat" alone.
const SPLIT_TOKENS: (string | RegExp)[] = [
  '//', ' / ',
  /\s+&\s+/,
  /,\s*/,
  /\s+\+\s+/,
  /\s+vs\.?\s+/i,
  /\s+w\/\s+/i,
  /\s+with\s+/i,
  /\s+feat(?:\.|uring)?\s+/i,
];

const PREFIX_PATTERNS: RegExp[] = [
  /^MUSIC:\s*/i,
  /^Long Play:\s*/i,
  /^.{1,80}\bpresents?\s*:\s*/i, // "Murmrr & Crown Hill Theatre Presents:"
];

const SUFFIX_PATTERNS: RegExp[] = [
  /\s*\(music\)\s*$/i,
  /\s*\(live\)\s*$/i,
  /\s*\[live\]\s*$/i,
  /\s*\[upstairs\]\s*$/i,
  /\s*\[downstairs\]\s*$/i,
  /\s+-\s+["“][^"”]+["”].*$/, // strip trailing - "Spatial, No Problem" Listening Event
];

function looksLikeComedy(title: string): boolean {
  return COMEDY_HINTS.some(rx => rx.test(title));
}

function stripDecorations(title: string): string {
  let t = title.trim();
  // Strip prefixes (try each, repeat to handle stacked)
  let changed = true;
  while (changed) {
    changed = false;
    for (const rx of PREFIX_PATTERNS) {
      const m = t.match(rx);
      if (m && m[0].length > 0 && m[0].length < t.length) {
        t = t.slice(m[0].length);
        changed = true;
      }
    }
  }
  // Strip suffixes
  for (const rx of SUFFIX_PATTERNS) {
    t = t.replace(rx, '');
  }
  return t.trim();
}

function splitArtists(title: string): string[] {
  let parts: string[] = [title];
  for (const tok of SPLIT_TOKENS) {
    const next: string[] = [];
    for (const p of parts) {
      if (typeof tok === 'string') {
        next.push(...p.split(tok));
      } else {
        next.push(...p.split(tok));
      }
    }
    parts = next;
  }
  return parts.map(p => p.trim()).filter(Boolean);
}

function isPlausibleArtist(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return false;
  if (TOKEN_BLOCKLIST.has(trimmed.toLowerCase())) return false;
  // Reject things that look like a sentence (lots of common stop words)
  const lower = trimmed.toLowerCase();
  const stopHits = (lower.match(/\b(the|of|for|to|on|in|at|by|and|with)\b/g) || []).length;
  if (stopHits >= 4) return false;
  return true;
}

export function extractArtistsFromTitle(title: string): string[] {
  if (!title) return [];
  if (looksLikeComedy(title)) return [];
  const stripped = stripDecorations(title);
  if (!stripped) return [];
  const parts = splitArtists(stripped);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const cleaned = p.replace(/^\s*[-–—]\s*/, '').replace(/\s*[-–—]\s*$/, '').trim();
    if (!cleaned) continue;
    if (!isPlausibleArtist(cleaned)) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

export function youtubeMusicSearchUrl(query: string): string {
  return `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
}

// Direct watch URL for one resolved artist.
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// Build a real ad-hoc playlist URL from a list of video IDs. YouTube redirects
// it to a temporary playlist (TLGG... id) that auto-advances through *only*
// these videos — no algorithmic drift. Cap at 50 IDs since longer URLs
// sometimes fail to materialize the playlist.
export function youtubeWatchVideosUrl(videoIds: string[]): string | null {
  const clean = videoIds.filter(Boolean).slice(0, 50);
  if (clean.length === 0) return null;
  return `https://www.youtube.com/watch_videos?video_ids=${clean.join(',')}`;
}

export function getPlaylistSections(daysAhead = 14): PlaylistSection[] {
  const today = new Date().toISOString().split('T')[0];
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + daysAhead);
  const horizonStr = horizon.toISOString().split('T')[0];

  const events: Event[] = getAllEvents()
    .filter(e => e.category === 'music')
    .filter(e => e.date >= today && e.date <= horizonStr);

  const byArtist = new Map<string, PlaylistArtist>();

  for (const e of events) {
    const venue = getVenueConfig(e.venue_slug);
    if (!venue) continue;
    const eff = venue.transitMinutes ?? venue.walkMinutes;
    const isWalkOnly = venue.transitMinutes == null;
    const artists = extractArtistsFromTitle(e.title);
    for (const artist of artists) {
      const key = artist.toLowerCase();
      const existing = byArtist.get(key);
      const appearance: ArtistAppearance = {
        date: e.date,
        venueName: venue.name,
        venueSlug: venue.slug,
        eventTitle: e.title,
        eventUrl: e.event_url,
      };
      if (existing) {
        existing.appearances.push(appearance);
        if (eff < existing.effectiveMinutes) existing.effectiveMinutes = eff;
        if (isWalkOnly) existing.walkOnly = true;
      } else {
        byArtist.set(key, {
          name: artist,
          appearances: [appearance],
          effectiveMinutes: eff,
          walkOnly: isWalkOnly,
          videoId: lookupVideoId(artist),
        });
      }
    }
  }

  // Sort artists by date of next appearance, then name.
  const allArtists = Array.from(byArtist.values()).map(a => ({
    ...a,
    appearances: a.appearances.sort((x, y) => x.date.localeCompare(y.date)),
  }));

  // Section by transport: walking-only venues vs anything that needs a subway.
  // The user's mental model lumps BCC, Caveat, Young Ethel's etc. together as
  // "distant" because they require leaving the neighborhood.
  const close = allArtists.filter(a => a.walkOnly);
  const distant = allArtists.filter(a => !a.walkOnly);
  const sortFn = (x: PlaylistArtist, y: PlaylistArtist) =>
    x.appearances[0].date.localeCompare(y.appearances[0].date) ||
    x.name.localeCompare(y.name);
  close.sort(sortFn);
  distant.sort(sortFn);

  return [
    {
      label: 'Walk to it',
      description: 'Venues within walking distance — Bell House, Public Records, Union Hall, etc.',
      artists: close,
    },
    {
      label: 'Subway away',
      description: 'Venues that need a subway ride — BCC, Caveat, Young Ethel’s, etc.',
      artists: distant,
    },
  ];
}
