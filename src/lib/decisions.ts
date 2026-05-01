'use client';

// Unified yes/no/undecided storage for events and artists. Once the user
// makes a decision the item disappears from discovery views (Today,
// Playlist) by default, and shows up in the "Saved" or "Dismissed" filters
// instead.

import { useCallback, useEffect, useState } from 'react';

export type Decision = 'yes' | 'no' | null;
export type EntityType = 'event' | 'artist';

interface DecisionState {
  events: { yes: string[]; no: string[] };
  artists: { yes: string[]; no: string[] };
}

const KEY_V2 = 'wgo:decisions:v2';
const KEY_V1_DISMISSED = 'wgo:dismissed-events';

const EMPTY: DecisionState = {
  events: { yes: [], no: [] },
  artists: { yes: [], no: [] },
};

function readRaw(): DecisionState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY_V2);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DecisionState>;
      return {
        events: {
          yes: parsed.events?.yes ?? [],
          no: parsed.events?.no ?? [],
        },
        artists: {
          yes: parsed.artists?.yes ?? [],
          no: parsed.artists?.no ?? [],
        },
      };
    }
    // Migrate: old key just held dismissed event IDs.
    const oldRaw = window.localStorage.getItem(KEY_V1_DISMISSED);
    if (oldRaw) {
      const ids = JSON.parse(oldRaw);
      const noEvents = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
      const migrated: DecisionState = {
        events: { yes: [], no: noEvents },
        artists: { yes: [], no: [] },
      };
      window.localStorage.setItem(KEY_V2, JSON.stringify(migrated));
      // Leave the old key in place; harmless and reverts gracefully if a user
      // downgrades.
      return migrated;
    }
  } catch {
    // fall through
  }
  return EMPTY;
}

function writeRaw(state: DecisionState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY_V2, JSON.stringify(state));
  } catch {
    // Private mode etc.
  }
}

// Normalize artist names for storage so "Dirty Projectors Trio" and
// "dirty projectors trio" map to the same record.
function normalizeKey(type: EntityType, id: string): string {
  return type === 'artist' ? id.toLowerCase().trim() : id;
}

export interface DecisionMaps {
  eventYes: Set<string>;
  eventNo: Set<string>;
  artistYes: Set<string>;
  artistNo: Set<string>;
}

function toMaps(state: DecisionState): DecisionMaps {
  return {
    eventYes: new Set(state.events.yes),
    eventNo: new Set(state.events.no),
    artistYes: new Set(state.artists.yes),
    artistNo: new Set(state.artists.no),
  };
}

export function getDecision(
  maps: DecisionMaps,
  type: EntityType,
  id: string,
): Decision {
  const key = normalizeKey(type, id);
  if (type === 'event') {
    if (maps.eventYes.has(key)) return 'yes';
    if (maps.eventNo.has(key)) return 'no';
    return null;
  }
  if (maps.artistYes.has(key)) return 'yes';
  if (maps.artistNo.has(key)) return 'no';
  return null;
}

/** React hook providing decision maps and a setter. */
export function useDecisions(): {
  maps: DecisionMaps;
  hydrated: boolean;
  set: (type: EntityType, id: string, decision: Decision) => void;
  clearAll: () => void;
  counts: { eventYes: number; eventNo: number; artistYes: number; artistNo: number };
} {
  const [maps, setMaps] = useState<DecisionMaps>(() => toMaps(EMPTY));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMaps(toMaps(readRaw()));
    setHydrated(true);
  }, []);

  const set = useCallback((type: EntityType, id: string, decision: Decision) => {
    const key = normalizeKey(type, id);
    setMaps(prev => {
      const next: DecisionMaps = {
        eventYes: new Set(prev.eventYes),
        eventNo: new Set(prev.eventNo),
        artistYes: new Set(prev.artistYes),
        artistNo: new Set(prev.artistNo),
      };
      const yesSet = type === 'event' ? next.eventYes : next.artistYes;
      const noSet = type === 'event' ? next.eventNo : next.artistNo;
      yesSet.delete(key);
      noSet.delete(key);
      if (decision === 'yes') yesSet.add(key);
      else if (decision === 'no') noSet.add(key);

      writeRaw({
        events: { yes: Array.from(next.eventYes), no: Array.from(next.eventNo) },
        artists: { yes: Array.from(next.artistYes), no: Array.from(next.artistNo) },
      });
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    writeRaw(EMPTY);
    setMaps(toMaps(EMPTY));
  }, []);

  return {
    maps,
    hydrated,
    set,
    clearAll,
    counts: {
      eventYes: maps.eventYes.size,
      eventNo: maps.eventNo.size,
      artistYes: maps.artistYes.size,
      artistNo: maps.artistNo.size,
    },
  };
}
