'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  api,
  actor as actorStore,
  passcode as passcodeStore,
  applyItineraryChange,
  readItineraryCache,
} from '@/lib/api';
import type { Bootstrap, ItineraryItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { categoryIcon } from '@/lib/categories';
import { ItinerarySheet } from '@/components/ItinerarySheet';

type DayGroup = { dayNum: number; date: string; items: ItineraryItem[] };

function pad(n: number): string {
  return `${n}`.padStart(2, '0');
}

function dateFromDayNum(tripStart: string, dayNum: number): string {
  if (!tripStart) return '';
  const start = new Date(tripStart);
  if (isNaN(start.getTime())) return '';
  const d = new Date(start);
  d.setDate(start.getDate() + (dayNum - 1));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function tripDayCount(tripStart: string, tripEnd: string): number {
  if (!tripStart || !tripEnd) return 1;
  const a = new Date(tripStart);
  const b = new Date(tripEnd);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 1;
  const ms = b.getTime() - a.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayDayNum(tripStart: string, tripEnd: string): number {
  const total = tripDayCount(tripStart, tripEnd);
  if (!tripStart) return 1;
  const today = todayISO();
  if (today < tripStart) return 1;
  if (today > tripEnd) return total;
  const start = new Date(tripStart);
  const now = new Date(today);
  const diff = Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(Math.max(diff + 1, 1), total);
}

function fmtDayHeader(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' });
}

export default function ItineraryPage() {
  const router = useRouter();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [items, setItems] = useState<ItineraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ItineraryItem | undefined>(undefined);
  const [addDayNum, setAddDayNum] = useState<number | undefined>(undefined);

  const dayRefs = useRef<Record<number, HTMLElement | null>>({});
  const didJump = useRef(false);

  useEffect(() => {
    if (!passcodeStore.get() || !actorStore.get()) {
      router.replace('/login');
      return;
    }

    const cachedBoot = api.bootstrapCache();
    const cachedItin = readItineraryCache();
    if (cachedBoot) setBoot(cachedBoot);
    if (cachedItin) setItems(cachedItin);
    if (cachedBoot && cachedItin) setLoading(false);

    (async () => {
      try {
        const [b, list] = await Promise.all([api.bootstrap(), api.itinerary()]);
        setBoot(b);
        setItems(list);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cachedBoot || !cachedItin) setError(msg);
        if (msg.toLowerCase().includes('passcode')) {
          passcodeStore.clear();
          actorStore.clear();
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo<DayGroup[]>(() => {
    if (!boot || !items) return [];
    const total = tripDayCount(boot.settings.trip_start, boot.settings.trip_end);
    const live = items.filter((i) => !i.deleted_at);
    const byDay = new Map<number, ItineraryItem[]>();
    for (const it of live) {
      const arr = byDay.get(it.day_num) ?? [];
      arr.push(it);
      byDay.set(it.day_num, arr);
    }
    const result: DayGroup[] = [];
    for (let n = 1; n <= total; n++) {
      const list = (byDay.get(n) ?? []).slice().sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return (a.time ?? '').localeCompare(b.time ?? '');
      });
      result.push({
        dayNum: n,
        date: dateFromDayNum(boot.settings.trip_start, n),
        items: list,
      });
    }
    return result;
  }, [boot, items]);

  // Auto-jump to today's day section once data is loaded.
  useEffect(() => {
    if (didJump.current) return;
    if (!boot || !items) return;
    const target = todayDayNum(boot.settings.trip_start, boot.settings.trip_end);
    const el = dayRefs.current[target];
    if (!el) return;
    didJump.current = true;
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'start', behavior: 'auto' });
      // Offset for the page header.
      window.scrollBy({ top: -72, behavior: 'auto' });
    });
  }, [boot, items]);

  function openAdd(dayNum?: number) {
    setEditing(undefined);
    setAddDayNum(dayNum);
    setSheetOpen(true);
  }

  function openEdit(it: ItineraryItem) {
    setEditing(it);
    setAddDayNum(undefined);
    setSheetOpen(true);
  }

  function onSheetClose() {
    setSheetOpen(false);
    setEditing(undefined);
    setAddDayNum(undefined);
  }

  if (loading && (!boot || !items)) return <SkeletonItinerary />;
  if (error && !boot) return <ErrorState message={error} />;
  if (!boot) return null;

  const hasAny = (items ?? []).some((i) => !i.deleted_at);

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider opacity-60">Plan</p>
          <h1 className="text-lg font-bold">Itinerary</h1>
        </div>
        <button
          onClick={() => openAdd()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-pillow)] text-sm font-semibold shadow-sm"
          style={{ background: 'var(--color-peach-deep)', color: 'var(--color-cocoa)' }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Add
        </button>
      </header>

      {!hasAny ? (
        <EmptyState onAdd={() => openAdd()} />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <DaySection
              key={g.dayNum}
              group={g}
              onTap={openEdit}
              onAdd={() => openAdd(g.dayNum)}
              registerRef={(el) => {
                dayRefs.current[g.dayNum] = el;
              }}
            />
          ))}
        </div>
      )}

      <ItinerarySheet
        open={sheetOpen}
        onClose={onSheetClose}
        onSaved={(saved) => setItems((cur) => applyItineraryChange(cur ?? [], saved))}
        item={editing}
        settings={boot.settings}
        initialDayNum={addDayNum}
      />
    </div>
  );
}

function DaySection({
  group,
  onTap,
  onAdd,
  registerRef,
}: {
  group: DayGroup;
  onTap: (it: ItineraryItem) => void;
  onAdd: () => void;
  registerRef: (el: HTMLElement | null) => void;
}) {
  return (
    <section ref={registerRef} className="space-y-2 scroll-mt-20">
      <h2 className="text-xs font-semibold uppercase tracking-wider opacity-60 px-1">
        Day {group.dayNum} · {fmtDayHeader(group.date)}
      </h2>
      {group.items.length === 0 ? (
        <button
          onClick={onAdd}
          className="card-plush w-full p-3 text-sm opacity-60 text-left"
        >
          + Add something to do
        </button>
      ) : (
        <ul className="space-y-2">
          {group.items.map((it) => (
            <li key={it.id}>
              <ItineraryRow item={it} onTap={onTap} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ItineraryRow({
  item,
  onTap,
}: {
  item: ItineraryItem;
  onTap: (it: ItineraryItem) => void;
}) {
  const hasMap = !!item.map_url;
  const hasLink = !!item.link;
  const hasCost = !!item.cost_note;
  const hasActions = hasMap || hasLink || hasCost;
  const directionsHref = hasMap
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.map_url)}`
    : '';

  function stop(e: React.MouseEvent) {
    e.stopPropagation();
  }

  return (
    <button
      onClick={() => onTap(item)}
      className="card-plush p-3 w-full text-left flex flex-col gap-2 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-2 min-w-0">
        {item.time && (
          <span
            className="shrink-0 text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full"
            style={{ background: 'var(--color-cream)', color: 'var(--color-cocoa)' }}
          >
            {item.time}
          </span>
        )}
        <i
          className={cn(categoryIcon(item.category), 'text-base leading-none shrink-0 opacity-80')}
          aria-hidden
        />
        <p className="font-semibold truncate flex-1">{item.title || 'Untitled'}</p>
      </div>

      {item.notes && (
        <p className="text-xs opacity-70 line-clamp-2">{item.notes}</p>
      )}

      {hasActions && (
        <div className="flex items-center gap-2 flex-wrap">
          {hasMap && (
            <a
              href={item.map_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stop}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'var(--color-mint)', color: 'var(--color-cocoa)' }}
            >
              <i className="fi-sr-map text-[12px] leading-none" />
              Map
            </a>
          )}
          {hasMap && (
            <a
              href={directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stop}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'var(--color-sky)', color: 'var(--color-cocoa)' }}
            >
              <i className="fi-sr-route text-[12px] leading-none" />
              Directions
            </a>
          )}
          {hasLink && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stop}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'var(--color-lavender)', color: 'var(--color-cocoa)' }}
            >
              <i className="fi-sr-link text-[12px] leading-none" />
              Link
            </a>
          )}
          {hasCost && (
            <span
              className="ml-auto inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'var(--color-sunny)', color: 'var(--color-cocoa)' }}
            >
              {item.cost_note}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="card-plush p-6 text-center space-y-3 flex flex-col items-center">
      <span
        className="inline-flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: 'var(--color-cream)', color: 'var(--color-cocoa)' }}
      >
        <i className="fi-sr-calendar text-3xl leading-none" />
      </span>
      <div className="space-y-1">
        <p className="font-semibold">No itinerary items yet</p>
        <p className="text-sm opacity-70">Plan the first stop of the trip.</p>
      </div>
      <button
        onClick={onAdd}
        className="px-4 py-2 rounded-[var(--radius-pillow)] font-semibold text-sm shadow-sm"
        style={{ background: 'var(--color-peach-deep)', color: 'var(--color-cocoa)' }}
      >
        Add item
      </button>
    </section>
  );
}

function SkeletonItinerary() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-10 bg-white/60 rounded-[var(--radius-pillow)]" />
      <div className="h-20 bg-white/60 rounded-[var(--radius-plush)]" />
      <div className="h-20 bg-white/60 rounded-[var(--radius-plush)]" />
      <div className="h-20 bg-white/60 rounded-[var(--radius-plush)]" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="card-plush p-6 text-center space-y-2">
      <p className="font-semibold">Something went wrong</p>
      <p className="text-sm opacity-70">{message}</p>
    </div>
  );
}
