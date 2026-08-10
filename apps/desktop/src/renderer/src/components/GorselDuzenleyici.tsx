import { useEffect, useRef, useState } from 'react';

type Arac = 'kalem' | 'ok' | 'kutu' | 'yazi' | 'kirp';
type Nokta = { x: number; y: number };
type Sekil =
  | { tip: 'kalem'; renk: string; kalinlik: number; noktalar: Nokta[] }
  | { tip: 'ok'; renk: string; kalinlik: number; a: Nokta; b: Nokta }
  | { tip: 'kutu'; renk: string; kalinlik: number; a: Nokta; b: Nokta }
  | { tip: 'yazi'; renk: string; boyut: number; k: Nokta; metin: string };

const RENKLER = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#111827', '#ffffff'];

/**
 * Masaüstü görsel düzenleyici. `dataUrl` (ana süreçte indirilmiş, taint'siz) alır;
 * kalem/ok/kutu/yazı/kırp ile işaretleyip "Gönder" ile PNG blob döndürür.
 */
export function GorselDuzenleyici({
  dataUrl,
  onGonder,
  onKapat,
  gonderiliyor,
}: {
  dataUrl: string;
  onGonder: (blob: Blob) => void;
  onKapat: () => void;
  gonderiliyor: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [arac, setArac] = useState<Arac>('kalem');
  const [renk, setRenk] = useState<string>(RENKLER[0]!);
  const [kalinlik, setKalinlik] = useState(4);
  const [sekiller, setSekiller] = useState<Sekil[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const cizim = useRef<{ aktif: boolean; sekil: Sekil | null; kirp: { a: Nokta; b: Nokta } | null }>(
    { aktif: false, sekil: null, kirp: null },
  );

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const c = canvasRef.current;
      if (c) {
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
      }
      setYukleniyor(false);
      ciz();
    };
    img.src = dataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUrl]);

  useEffect(() => {
    ciz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sekiller]);

  function ciz(gecici?: Sekil | null, kirpKutu?: { a: Nokta; b: Nokta } | null): void {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    for (const s of sekiller) sekilCiz(ctx, s);
    if (gecici) sekilCiz(ctx, gecici);
    if (kirpKutu) {
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.strokeRect(kirpKutu.a.x, kirpKutu.a.y, kirpKutu.b.x - kirpKutu.a.x, kirpKutu.b.y - kirpKutu.a.y);
      ctx.fillStyle = 'rgba(59,130,246,0.12)';
      ctx.fillRect(kirpKutu.a.x, kirpKutu.a.y, kirpKutu.b.x - kirpKutu.a.x, kirpKutu.b.y - kirpKutu.a.y);
      ctx.restore();
    }
  }

  function sekilCiz(ctx: CanvasRenderingContext2D, s: Sekil | null | undefined): void {
    if (!s) return; // emniyet: bozuk/null şekil tüm çizimi çökertmesin
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (s.tip === 'kalem') {
      ctx.strokeStyle = s.renk;
      ctx.lineWidth = s.kalinlik;
      ctx.beginPath();
      s.noktalar.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    } else if (s.tip === 'kutu') {
      ctx.strokeStyle = s.renk;
      ctx.lineWidth = s.kalinlik;
      ctx.strokeRect(s.a.x, s.a.y, s.b.x - s.a.x, s.b.y - s.a.y);
    } else if (s.tip === 'ok') {
      const bas = Math.max(10, s.kalinlik * 3);
      const aci = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x);
      ctx.strokeStyle = s.renk;
      ctx.fillStyle = s.renk;
      ctx.lineWidth = s.kalinlik;
      ctx.beginPath();
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.b.x, s.b.y);
      ctx.lineTo(s.b.x - bas * Math.cos(aci - Math.PI / 6), s.b.y - bas * Math.sin(aci - Math.PI / 6));
      ctx.lineTo(s.b.x - bas * Math.cos(aci + Math.PI / 6), s.b.y - bas * Math.sin(aci + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else if (s.tip === 'yazi') {
      ctx.fillStyle = s.renk;
      ctx.font = `bold ${s.boyut}px sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(s.metin, s.k.x, s.k.y);
    }
    ctx.restore();
  }

  function konum(e: React.MouseEvent): Nokta {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }

  function bas(e: React.MouseEvent): void {
    if (yukleniyor) return;
    const p = konum(e);
    if (arac === 'yazi') {
      const metin = window.prompt('Metin:');
      if (metin) setSekiller((s) => [...s, { tip: 'yazi', renk, boyut: kalinlik * 6, k: p, metin }]);
      return;
    }
    if (arac === 'kirp') {
      cizim.current = { aktif: true, sekil: null, kirp: { a: p, b: p } };
      return;
    }
    const yeni: Sekil =
      arac === 'kalem'
        ? { tip: 'kalem', renk, kalinlik, noktalar: [p] }
        : arac === 'ok'
          ? { tip: 'ok', renk, kalinlik, a: p, b: p }
          : { tip: 'kutu', renk, kalinlik, a: p, b: p };
    cizim.current = { aktif: true, sekil: yeni, kirp: null };
  }

  function hareket(e: React.MouseEvent): void {
    if (!cizim.current.aktif) return;
    const p = konum(e);
    if (cizim.current.kirp) {
      cizim.current.kirp.b = p;
      ciz(null, cizim.current.kirp);
      return;
    }
    const s = cizim.current.sekil;
    if (!s) return;
    if (s.tip === 'kalem') s.noktalar.push(p);
    else if (s.tip === 'ok' || s.tip === 'kutu') s.b = p;
    ciz(s);
  }

  function birak(): void {
    if (!cizim.current.aktif) return;
    if (cizim.current.kirp) kirpUygula(cizim.current.kirp);
    else if (cizim.current.sekil) {
      // Şekli ŞİMDİ yakala: setSekiller güncelleyicisi sonraki render'da çalışıyor,
      // o an cizim.current aşağıda sıfırlanmış olur → aksi halde sekiller'e null
      // girer ve sekilCiz(null) "reading 'tip'" ile çöker.
      const eklenen = cizim.current.sekil;
      setSekiller((s) => [...s, eklenen]);
    }
    cizim.current = { aktif: false, sekil: null, kirp: null };
  }

  function kirpUygula(k: { a: Nokta; b: Nokta }): void {
    const c = canvasRef.current;
    if (!c) return;
    const x = Math.min(k.a.x, k.b.x);
    const y = Math.min(k.a.y, k.b.y);
    const w = Math.abs(k.b.x - k.a.x);
    const h = Math.abs(k.b.y - k.a.y);
    if (w < 8 || h < 8) return ciz();
    const gecici = document.createElement('canvas');
    gecici.width = w;
    gecici.height = h;
    gecici.getContext('2d')!.drawImage(c, x, y, w, h, 0, 0, w, h);
    const yeniImg = new Image();
    yeniImg.onload = () => {
      imgRef.current = yeniImg;
      c.width = w;
      c.height = h;
      setSekiller([]);
    };
    yeniImg.src = gecici.toDataURL('image/png');
  }

  function gonder(): void {
    canvasRef.current?.toBlob((blob) => blob && onGonder(blob), 'image/png');
  }

  const araclar: { id: Arac; ad: string }[] = [
    { id: 'kalem', ad: '✏️ Kalem' },
    { id: 'ok', ad: '↗ Ok' },
    { id: 'kutu', ad: '▢ Kutu' },
    { id: 'yazi', ad: 'T Yazı' },
    { id: 'kirp', ad: '⤢ Kırp' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900/90 p-4" onClick={onKapat}>
      <div
        className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col rounded-xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          {araclar.map((a) => (
            <button
              key={a.id}
              onClick={() => setArac(a.id)}
              className={`rounded-md px-2.5 py-1.5 text-sm ${
                arac === a.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {a.ad}
            </button>
          ))}
          <div className="mx-1 h-6 w-px bg-slate-200" />
          {RENKLER.map((r) => (
            <button
              key={r}
              onClick={() => setRenk(r)}
              className="size-6 rounded-full border border-slate-300"
              style={{ backgroundColor: r, outline: renk === r ? '2px solid #3b82f6' : 'none', outlineOffset: 1 }}
            />
          ))}
          <input
            type="range"
            min={2}
            max={12}
            value={kalinlik}
            onChange={(e) => setKalinlik(Number(e.target.value))}
            className="ml-1 w-24"
          />
          <button
            onClick={() => setSekiller((s) => s.slice(0, -1))}
            title="Geri al"
            className="ml-auto rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            ↶ Geri
          </button>
          <button onClick={onKapat} className="rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-4">
          <canvas
            ref={canvasRef}
            onMouseDown={bas}
            onMouseMove={hareket}
            onMouseUp={birak}
            onMouseLeave={birak}
            className="max-h-full max-w-full cursor-crosshair rounded shadow ring-1 ring-slate-300"
            style={{ touchAction: 'none' }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-3">
          <button onClick={onKapat} className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Vazgeç
          </button>
          <button
            onClick={gonder}
            disabled={gonderiliyor || yukleniyor}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {gonderiliyor ? 'Gönderiliyor…' : '✓ Yeni mesaj olarak gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}
