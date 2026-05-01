'use client';

import { useRef, useState, useCallback } from 'react';
import EventCard from './EventCard';
import type { Decision } from '@/lib/decisions';

const COMMIT_THRESHOLD = 110;
const HORIZONTAL_LOCK = 8;

interface EnrichedEvent {
  id: string;
  venue: string;
  venue_slug: string;
  category: string;
  title: string;
  date: string;
  time: string | null;
  price: string | null;
  sold_out: boolean;
  image_url: string | null;
  event_url: string | null;
  description: string | null;
  scraped_at: string;
  walkMinutes: number;
  transitMinutes: number | null;
  drinkPrice: number;
  allInCost: number | null;
  group: string;
}

interface Props {
  event: EnrichedEvent;
  onDecide: (id: string, decision: Decision) => void;
}

export default function SwipeableEvent({ event, onDecide }: Props) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const horizontalLocked = useRef<boolean | null>(null);
  const [offset, setOffset] = useState(0);
  const [committing, setCommitting] = useState(false);

  const reset = useCallback(() => {
    startX.current = null;
    startY.current = null;
    horizontalLocked.current = null;
    setOffset(0);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (committing) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    horizontalLocked.current = null;
  }, [committing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (committing || startX.current == null || startY.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (horizontalLocked.current === null) {
      if (Math.abs(dx) < HORIZONTAL_LOCK && Math.abs(dy) < HORIZONTAL_LOCK) return;
      horizontalLocked.current = Math.abs(dx) > Math.abs(dy);
      if (!horizontalLocked.current) return;
    }
    if (!horizontalLocked.current) return;

    e.preventDefault();
    setOffset(dx);
  }, [committing]);

  const onTouchEnd = useCallback(() => {
    if (committing) return;
    if (offset <= -COMMIT_THRESHOLD) {
      setCommitting(true);
      setOffset(-window.innerWidth);
      setTimeout(() => onDecide(event.id, 'no'), 180);
    } else if (offset >= COMMIT_THRESHOLD) {
      setCommitting(true);
      setOffset(window.innerWidth);
      setTimeout(() => onDecide(event.id, 'yes'), 180);
    } else {
      reset();
    }
  }, [offset, committing, event.id, onDecide, reset]);

  const dismissOpacity = offset < 0 ? Math.min(1, Math.abs(offset) / COMMIT_THRESHOLD) : 0;
  const saveOpacity = offset > 0 ? Math.min(1, offset / COMMIT_THRESHOLD) : 0;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Right-swipe → Save: green panel on the left edge */}
      <div
        className="absolute inset-0 flex items-center justify-start pl-5 bg-green-500 dark:bg-green-600 rounded-xl pointer-events-none"
        style={{ opacity: saveOpacity }}
        aria-hidden
      >
        <span className="text-white text-sm font-semibold flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Save
        </span>
      </div>
      {/* Left-swipe → Skip: red panel on the right edge */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-5 bg-red-500 dark:bg-red-600 rounded-xl pointer-events-none"
        style={{ opacity: dismissOpacity }}
        aria-hidden
      >
        <span className="text-white text-sm font-semibold flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Skip
        </span>
      </div>

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={reset}
        style={{
          transform: `translateX(${offset}px)`,
          transition: offset === 0 || committing ? 'transform 0.18s ease-out' : 'none',
        }}
      >
        <EventCard event={event} />
      </div>
    </div>
  );
}
