'use client';

import { useState, useEffect, useCallback } from 'react';
import EventCard from './EventCard';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEvent = any;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Calendar() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [eventDates, setEventDates] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayEvents, setDayEvents] = useState<AnyEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch event dates for the month
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const res = await fetch(`/api/events?month=${year}-${String(month).padStart(2, '0')}`);
        const data = await res.json();
        setEventDates(new Set(data.dates || []));
      } catch {}
    };
    fetchDates();
  }, [year, month]);

  // Fetch events for selected date
  const fetchDayEvents = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events?date=${date}`);
      const data = await res.json();
      setDayEvents(data.events || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) fetchDayEvents(selectedDate);
  }, [selectedDate, fetchDayEvents]);

  const goMonth = (offset: number) => {
    let m = month + offset;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
    setSelectedDate(null);
    setDayEvents([]);
  };

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="flex flex-col gap-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => goMonth(-1)}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold">{MONTHS[month - 1]} {year}</h2>
        <button
          onClick={() => goMonth(1)}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map((day) => (
          <div key={day} className="text-xs font-medium text-zinc-400 py-1">
            {day}
          </div>
        ))}

        {/* Day cells */}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const hasEvents = eventDates.has(dateStr);
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={`relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors ${
                isSelected
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : isToday
                    ? 'bg-zinc-100 dark:bg-zinc-800 font-bold'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`}
            >
              {day}
              {hasEvents && (
                <span className={`absolute bottom-1 w-1 h-1 rounded-full ${
                  isSelected ? 'bg-white dark:bg-zinc-900' : 'bg-purple-500'
                }`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date events */}
      {selectedDate && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <h3 className="font-semibold text-sm mb-3">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </h3>
          {loading ? (
            <div className="text-center py-8 text-zinc-400">Loading...</div>
          ) : dayEvents.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 text-sm">No events this day</div>
          ) : (
            <div className="flex flex-col gap-2">
              {dayEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
