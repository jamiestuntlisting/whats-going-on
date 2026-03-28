'use client';

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

const categoryColors: Record<string, string> = {
  music: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  comedy: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  theater: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  variety: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

function formatAllIn(cost: number): string {
  if (cost === 0) return 'Free night';
  return `~$${Math.round(cost)} all-in`;
}

export default function EventCard({ event }: { event: EnrichedEvent }) {
  const useTransit = event.transitMinutes !== null;
  const travelTime = useTransit ? event.transitMinutes! : event.walkMinutes;
  const travelIcon = useTransit ? '🚇' : '🚶';

  return (
    <a
      href={event.event_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            {event.category === 'music' ? '🎵' : event.category === 'comedy' ? '😂' : event.category === 'theater' ? '🎭' : '🎪'}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm leading-tight text-zinc-900 dark:text-zinc-100 line-clamp-2">
          {event.title}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          {event.venue}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {event.time && (
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {event.time}
            </span>
          )}
          <span className="text-[10px] text-zinc-400">
            {travelIcon} {travelTime} min
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryColors[event.category] || 'bg-zinc-100 text-zinc-600'}`}>
            {event.category}
          </span>
        </div>
      </div>

      {/* Price / All-in */}
      <div className="flex-shrink-0 text-right flex flex-col items-end gap-0.5">
        {event.sold_out ? (
          <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-full">
            SOLD OUT
          </span>
        ) : event.price ? (
          <>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {event.price}
            </span>
            {event.allInCost !== null && (
              <span className="text-[10px] text-zinc-400">
                {formatAllIn(event.allInCost)}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-zinc-400">-</span>
        )}
      </div>
    </a>
  );
}
