'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, actor as actorStore, passcode as passcodeStore } from '@/lib/api';
import Image from 'next/image';
import { Mascot } from '@/components/Mascot';
import { asset } from '@/lib/asset';
import { trip } from '@/lib/trips';
import type { Member } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<'passcode' | 'who'>('passcode');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (passcodeStore.get() && actorStore.get()) {
      router.replace('/');
    }
  }, [router]);

  async function submitPasscode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    try {
      passcodeStore.set(code.trim());
      await api.verify(code.trim());
      const boot = await api.bootstrap();
      setMembers(boot.members);
      setStep('who');
    } catch (e: unknown) {
      passcodeStore.clear();
      setError(e instanceof Error ? e.message : 'Wrong passcode');
    } finally {
      setVerifying(false);
    }
  }

  function chooseMember() {
    if (!selected) return;
    actorStore.set(selected);
    router.replace('/');
  }

  if (step === 'passcode') {
    return (
      <div className="min-h-[80vh] flex flex-col justify-center space-y-8">
        <div className="text-center space-y-2">
          <Image
            src={asset(trip.loginImage)}
            alt={trip.subtitle}
            width={640}
            height={640}
            priority
            className="mx-auto h-72 w-auto object-contain"
          />
          <h1 className="text-2xl font-bold">{trip.name}</h1>
          <p className="opacity-70 text-sm">{trip.subtitle}</p>
        </div>

        <form onSubmit={submitPasscode} className="card-plush p-5 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold">Trip passcode</span>
            <input
              type="password"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-2 w-full rounded-[var(--radius-pillow)] px-4 py-3 border-0 outline-none ring-2 ring-transparent focus:ring-peach text-base"
              style={{ background: 'var(--color-cream)' }}
              placeholder="enter passcode"
            />
          </label>
          {error && <p className="text-sm" style={{ color: 'var(--color-blush-deep)' }}>{error}</p>}
          <button
            type="submit"
            disabled={!code || verifying}
            className="w-full py-3 rounded-[var(--radius-pillow)] font-semibold disabled:opacity-50"
            style={{ background: 'var(--color-peach-deep)', color: 'var(--color-cocoa)' }}
          >
            {verifying ? 'Checking…' : 'Continue'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col justify-center space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Who are you?</h1>
        <p className="opacity-70 text-sm">Tap your mascot</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelected(m.id)}
            className={cn(
              'card-plush p-3 flex flex-col items-center gap-2 transition-transform',
              selected === m.id && 'scale-[1.03]',
            )}
            style={selected === m.id ? { boxShadow: '0 0 0 3px var(--color-peach), 0 6px 18px -8px rgba(107,79,63,0.18)' } : undefined}
          >
            <Mascot name={m.mascot} size="lg" selected={selected === m.id} />
            <span className="text-sm font-semibold">{m.name}</span>
          </button>
        ))}
      </div>

      <button
        onClick={chooseMember}
        disabled={!selected}
        className="w-full py-3 rounded-[var(--radius-pillow)] font-semibold disabled:opacity-50"
        style={{ background: 'var(--color-peach-deep)', color: 'var(--color-cocoa)' }}
      >
        Enter trip
      </button>
    </div>
  );
}
