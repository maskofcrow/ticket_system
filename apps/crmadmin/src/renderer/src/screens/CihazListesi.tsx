import { useState } from 'react';
import type { Cihaz } from '../../../shared/sozlesme';

/** AnyDesk benzeri sade cihaz listesi: çevrimiçi üstte, tıkla → bağlan. */
export function CihazListesi({
  cihazlar,
  hata,
  onSec,
}: {
  cihazlar: Cihaz[];
  hata: string | null;
  onSec: (c: Cihaz) => void;
}): React.ReactElement {
  const [ara, setAra] = useState('');
  const q = ara.trim().toLocaleLowerCase('tr');
  const suzulmus = cihazlar.filter(
    (c) => !q || c.ad.toLocaleLowerCase('tr').includes(q) || (c.grup ?? '').toLocaleLowerCase('tr').includes(q),
  );
  const sirali = [...suzulmus].sort(
    (a, b) => Number(b.cevrimici) - Number(a.cevrimici) || a.ad.localeCompare(b.ad, 'tr'),
  );

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-5">
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={ara}
          onChange={(e) => setAra(e.target.value)}
          placeholder="Cihaz veya müşteri ara…"
          className="w-full bg-transparent py-2.5 text-sm outline-none"
        />
        <span className="text-xs text-slate-400">{sirali.length} cihaz</span>
      </div>

      {hata && <p className="mb-3 text-sm text-red-600">{hata}</p>}

      {sirali.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          Cihaz yok. Müşteri “Uzak desteği kur” dediğinde burada görünür.
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {sirali.map((c) => (
            <button
              key={c.id}
              onClick={() => c.cevrimici && onSec(c)}
              disabled={!c.cevrimici}
              className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                c.cevrimici
                  ? 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                  : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-70'
              }`}
            >
              <span
                className={`size-2.5 shrink-0 rounded-full ${
                  c.cevrimici ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                title={c.cevrimici ? 'Çevrimiçi' : 'Çevrimdışı'}
              />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-800">{c.ad}</div>
                <div className="truncate text-xs text-slate-400">
                  {[c.grup, c.isletimSistemi].filter(Boolean).join(' · ') || 'Esta Destek'}
                </div>
              </div>
              {c.cevrimici && <span className="text-xs font-medium text-blue-700">Bağlan →</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
