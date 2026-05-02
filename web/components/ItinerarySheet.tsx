'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { api, type NewItineraryInput } from '@/lib/api';
import { cn } from '@/lib/utils';
import { categoryIcon } from '@/lib/categories';
import type { ItineraryItem, Settings } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (item: ItineraryItem) => void;
  item?: ItineraryItem;
  settings: Settings;
  initialDayNum?: number;
  // Returns the next position (max + 1) for new items in a given day. The page
  // computes this from current items state and passes a fresh function.
  getNextPosition?: (dayNum: number) => number;
}

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

export function ItinerarySheet({
  open,
  onClose,
  onSaved,
  getNextPosition,
  item,
  settings,
  initialDayNum,
}: Props) {
  const isEdit = !!item;
  const totalDays = useMemo(
    () => tripDayCount(settings.trip_start, settings.trip_end),
    [settings.trip_start, settings.trip_end],
  );
  const dayNums = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => i + 1),
    [totalDays],
  );

  const [dayNum, setDayNum] = useState<number>(1);
  const [time, setTime] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [mapUrl, setMapUrl] = useState<string>('');
  const [link, setLink] = useState<string>('');
  const [costNote, setCostNote] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false);
      setErrorMsg(null);
      return;
    }

    if (item) {
      setDayNum(item.day_num || 1);
      setTime(item.time ?? '');
      setTitle(item.title ?? '');
      setCategory(item.category || settings.categories[0] || '');
      setNotes(item.notes ?? '');
      setMapUrl(item.map_url ?? '');
      setLink(item.link ?? '');
      setCostNote(item.cost_note ?? '');
    } else {
      const startDay = Math.min(Math.max(initialDayNum ?? 1, 1), totalDays);
      setDayNum(startDay);
      setTime('');
      setTitle('');
      setCategory(settings.categories[0] ?? '');
      setNotes('');
      setMapUrl('');
      setLink('');
      setCostNote('');
    }
    setErrorMsg(null);
    setConfirmDelete(false);
  }, [open, item, settings, initialDayNum, totalDays]);

  function validate(): string | null {
    if (!title.trim()) return 'Add a title';
    if (!category) return 'Pick a category';
    if (!dayNum) return 'Pick a day';
    return null;
  }

  async function handleSave() {
    setErrorMsg(null);
    const err = validate();
    if (err) {
      setErrorMsg(err);
      return;
    }
    const date = dateFromDayNum(settings.trip_start, dayNum);
    const payload: NewItineraryInput = {
      day_num: dayNum,
      date,
      time: time.trim() || undefined,
      title: title.trim(),
      notes: notes.trim() || undefined,
      category,
      map_url: mapUrl.trim() || undefined,
      link: link.trim() || undefined,
      cost_note: costNote.trim() || undefined,
    };
    // For new items only: append to the end of the chosen day. Editing leaves
    // position untouched so list order doesn't shift on every save.
    if (!item && getNextPosition) {
      payload.position = getNextPosition(dayNum);
    }
    try {
      setSubmitting(true);
      const saved = item
        ? await api.updateItinerary(item.id, payload)
        : await api.addItinerary(payload);
      onSaved(saved);
      onClose();
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      setDeleting(true);
      await api.deleteItinerary(item.id);
      onSaved({ ...item, deleted_at: new Date().toISOString() });
      onClose();
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 transition-opacity',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => {
          if (!submitting && !deleting) onClose();
        }}
      />
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 mx-auto max-w-md transition-transform duration-300',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div
          className="rounded-t-[var(--radius-plush)] max-h-[92vh] overflow-y-auto"
          style={{ background: 'var(--color-cream-soft)' }}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-2 sticky top-0 z-10" style={{ background: 'var(--color-cream-soft)' }}>
            <div className="flex-1 flex justify-center">
              <span className="block w-12 h-1.5 rounded-full" style={{ background: 'var(--color-cocoa-soft)', opacity: 0.25 }} />
            </div>
          </div>
          <div className="px-5 pb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{isEdit ? 'Edit item' : 'Add item'}</h2>
            <button
              onClick={onClose}
              disabled={submitting || deleting}
              aria-label="Close"
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'white' }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-5 space-y-4 pb-8">
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wider opacity-60 px-1">Day</p>
              <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
                {dayNums.map((n) => {
                  const sel = dayNum === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setDayNum(n)}
                      className={cn(
                        'shrink-0 min-w-[64px] px-4 py-2 rounded-full text-sm font-semibold transition-colors',
                        sel ? 'shadow-sm' : 'opacity-70',
                      )}
                      style={{
                        background: sel ? 'var(--color-peach)' : 'white',
                        color: 'var(--color-cocoa)',
                      }}
                    >
                      Day {n}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="card-plush p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider opacity-60">Time</p>
              <input
                type="text"
                placeholder="10:00, EVENING, after lunch"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-transparent outline-none text-base"
              />
            </section>

            <section className="card-plush p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider opacity-60">Title</p>
              <input
                type="text"
                placeholder="Where are you going?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent outline-none text-base"
              />
            </section>

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wider opacity-60 px-1">Category</p>
              <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
                {settings.categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={cn(
                      'shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors',
                      category === c ? 'shadow-sm' : 'opacity-70',
                    )}
                    style={{
                      background: category === c ? 'var(--color-peach)' : 'white',
                      color: 'var(--color-cocoa)',
                    }}
                  >
                    <i className={cn(categoryIcon(c), 'text-base leading-none')} />
                    {c}
                  </button>
                ))}
              </div>
            </section>

            <section className="card-plush p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider opacity-60">Notes</p>
              <textarea
                placeholder="Anything to remember?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-transparent outline-none text-base resize-none"
              />
            </section>

            <section className="card-plush p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider opacity-60">Map URL</p>
              <input
                type="url"
                placeholder="https://maps.google.com/..."
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                className="w-full bg-transparent outline-none text-base"
              />
            </section>

            <section className="card-plush p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider opacity-60">Link</p>
              <input
                type="url"
                placeholder="https://..."
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="w-full bg-transparent outline-none text-base"
              />
            </section>

            <section className="card-plush p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider opacity-60">Cost note</p>
              <input
                type="text"
                placeholder="RM415/2"
                value={costNote}
                onChange={(e) => setCostNote(e.target.value)}
                className="w-full bg-transparent outline-none text-base"
              />
            </section>

            {errorMsg && (
              <p
                className="text-sm text-center font-semibold"
                style={{ color: 'var(--color-blush-deep)' }}
              >
                {errorMsg}
              </p>
            )}

            <div className="space-y-2 pt-2">
              <button
                onClick={handleSave}
                disabled={submitting || deleting}
                className="w-full py-3 rounded-[var(--radius-pillow)] font-bold text-base shadow-sm disabled:opacity-60"
                style={{ background: 'var(--color-peach-deep)', color: 'var(--color-cocoa)' }}
              >
                {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add item'}
              </button>

              {isEdit && (
                <button
                  onClick={handleDelete}
                  disabled={submitting || deleting}
                  className="w-full py-3 rounded-[var(--radius-pillow)] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{
                    background: confirmDelete ? 'var(--color-blush-deep)' : 'white',
                    color: confirmDelete ? 'white' : 'var(--color-blush-deep)',
                  }}
                >
                  <Trash2 size={16} />
                  {deleting
                    ? 'Deleting...'
                    : confirmDelete
                      ? 'Tap again to confirm delete'
                      : 'Delete item'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
