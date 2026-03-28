import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { Event } from './types';

const DB_PATH = path.join(process.cwd(), 'events.db');

// Use global to persist across hot reloads in dev
const globalForDb = globalThis as unknown as { __db?: Database.Database };

function getDb(): Database.Database {
  if (!globalForDb.__db || !globalForDb.__db.open) {
    globalForDb.__db = new Database(DB_PATH);
    globalForDb.__db.pragma('journal_mode = WAL');
    globalForDb.__db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        venue TEXT NOT NULL,
        venue_slug TEXT NOT NULL,
        category TEXT,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT,
        price TEXT,
        sold_out INTEGER DEFAULT 0,
        image_url TEXT,
        event_url TEXT,
        description TEXT,
        scraped_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
      CREATE INDEX IF NOT EXISTS idx_events_venue ON events(venue_slug);
      CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
    `);
  }
  return globalForDb.__db;
}

export function generateEventId(venue: string, title: string, date: string): string {
  return crypto.createHash('md5').update(`${venue}|${title}|${date}`).digest('hex');
}

export function upsertEvents(events: Event[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO events (id, venue, venue_slug, category, title, date, time, price, sold_out, image_url, event_url, description, scraped_at)
    VALUES (@id, @venue, @venue_slug, @category, @title, @date, @time, @price, @sold_out, @image_url, @event_url, @description, @scraped_at)
  `);
  const insertMany = db.transaction((events: Event[]) => {
    for (const event of events) {
      stmt.run({
        ...event,
        sold_out: event.sold_out ? 1 : 0,
      });
    }
  });
  insertMany(events);
}

export function getEventsByDate(date: string, category?: string): Event[] {
  const db = getDb();
  let query = 'SELECT * FROM events WHERE date = ?';
  const params: string[] = [date];
  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }
  query += ' ORDER BY time ASC, venue ASC';
  const rows = db.prepare(query).all(...params) as Array<Record<string, unknown>>;
  return rows.map(row => ({
    ...row,
    sold_out: !!(row.sold_out as number),
  })) as Event[];
}

export function getEventsInRange(startDate: string, endDate: string): Event[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM events WHERE date >= ? AND date <= ? ORDER BY date ASC, time ASC'
  ).all(startDate, endDate) as Array<Record<string, unknown>>;
  return rows.map(row => ({
    ...row,
    sold_out: !!(row.sold_out as number),
  })) as Event[];
}

export function getEventDatesInMonth(year: number, month: number): string[] {
  const db = getDb();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
  const rows = db.prepare(
    'SELECT DISTINCT date FROM events WHERE date >= ? AND date < ? ORDER BY date'
  ).all(startDate, endDate) as Array<{ date: string }>;
  return rows.map(r => r.date);
}

export function clearVenueEvents(venueSlug: string): void {
  const db = getDb();
  db.prepare('DELETE FROM events WHERE venue_slug = ?').run(venueSlug);
}

export function getLastScrapeTime(): string | null {
  const db = getDb();
  const row = db.prepare('SELECT MAX(scraped_at) as last FROM events').get() as { last: string | null } | undefined;
  return row?.last ?? null;
}
