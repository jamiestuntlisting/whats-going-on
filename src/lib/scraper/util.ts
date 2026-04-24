import crypto from 'crypto';

export function generateEventId(venue: string, title: string, date: string): string {
  return crypto.createHash('md5').update(`${venue}|${title}|${date}`).digest('hex');
}
