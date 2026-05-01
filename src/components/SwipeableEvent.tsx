'use client';

import { useRef, useState, useCallback } from 'react';
import EventCard from './EventCard';

// Pixels of left-drag required to commit a dismiss. ~40% of a typical phone.
const COMMIT_THRESHOLD = 110;
// Below this we treat the drag as a tap and don't preventDefault on touchmove,
// so vertical scrolling still works.
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
  onDismiss: (id: string) => void;
}

export default function SwipeableEvent({ event, onDismiss }: Props) {
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

    // Decide once whether this gesture is horizontal (swipe) or vertical (scroll).
    if (horizontalLocked.current === null) {
      if (Math.abs(dx) < HORIZONTAL_LOCK && Math.abs(dy) < HORIZONTAL_LOCK) return;
      horizontalLocked.current = Math.abs(dx) > Math.abs(dy);
      if (!horizontalLocked.current) return;
    }
    if (!horizontalLocked.current) return;

    // Only react to leftward drag (negative dx).
    if (dx < 0) {
      e.preventDefault();
      setOffset(dx);
    } else {
      setOffset(0);
    }
  }, [committing]);

  const onTouchEnd = useCallback(() => {
    if (committing) return;
    if (offset <= -COMMIT_THRESHOLD) {
      // Animate off-screen then notify parent. Parent removes the row.
      setCommitting(true);
      setOffset(-window.innerWidth);
      setTimeout(() => onDismiss(event.id), 180);
    } else {
      reset();
    }
  }, [offset, committing, event.id, onDismiss, reset]);

  const dismissOpacity = Math.min(1, Math.abs(offset) / COMMIT_THRESHOLD);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Red dismiss background revealed as the card slides left. */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-5 bg-red-500 dark:bg-red-600 rounded-xl pointer-events-none"
        style={{ opacity: dismissOpacity }}
        aria-hidden
      >
        <span className="text-white text-sm font-semibold flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22" />
          </svg>
          Dismiss
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
