import { BaseScraper } from '../base';
import { Event } from '../../types';

export class HalyardsScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const events: Event[] = [];
    const today = new Date();

    // Halyards doesn't have a website with events listed
    // Generate upcoming Tuesday variety nights for the next 4 weeks
    for (let i = 0; i < 28; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      if (d.getDay() === 2) { // Tuesday
        events.push(this.makeEvent({
          title: 'Tuesday Variety Night',
          date: d.toISOString().split('T')[0],
          time: '8:00 PM',
          price: 'Free',
          event_url: 'https://www.instagram.com/halyardsbar/',
          description: 'Weekly variety show at Halyards. Check Instagram for lineup details.',
          category: 'variety',
        }));
      }
    }

    return events;
  }
}
