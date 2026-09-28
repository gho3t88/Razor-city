import { useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface TipProduct { id: string; price: string }
interface TipBilling {
  list(): Promise<{ products: TipProduct[] }>;
  purchase(options: { productId: string }): Promise<{ status: 'purchased' | 'pending' | 'cancelled' }>;
}
const billing = registerPlugin<TipBilling>('TipBilling');
const labels: Record<string, string> = { tip_small: 'Small tip', tip_medium: 'Medium tip', tip_large: 'Large tip' };

export function TipSupport() {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<TipProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    if (!Capacitor.isNativePlatform()) {
      setMessage('Tips are available in the Google Play version.');
      return;
    }
    setMessage('Loading Google Play options…');
    billing.list().then(({ products }) => {
      setProducts(products);
      setMessage(products.length ? '' : 'Tips will be available after the Play Store products are activated.');
    }).catch(() => setMessage('Tips are available once this game is installed through Google Play.'));
  }, [open]);

  async function tip(id: string) {
    setBusy(true);
    setMessage('Opening Google Play…');
    try {
      const result = await billing.purchase({ productId: id });
      setMessage(result.status === 'purchased' ? 'Thank you for supporting Razor City!' : result.status === 'pending' ? 'Your payment is pending in Google Play.' : 'Purchase cancelled.');
    } catch {
      setMessage('Purchase could not be completed. Please try again later.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-md border border-gold/70 bg-ink/80 px-3 py-2 text-sm font-medium text-gold">Tip the Developer</button>
    {open && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Tip the Developer" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-xl border border-gold/50 bg-panel p-5 text-paper shadow-2xl">
        <h2 className="font-display text-2xl text-gold">SUPPORT RAZOR CITY</h2>
        <p className="mt-2 text-sm text-mute">Enjoying the game? An optional tip supports future development. It gives no game items or advantages.</p>
        <div className="mt-4 grid gap-2">{products.map((product) => <button key={product.id} type="button" disabled={busy} onClick={() => tip(product.id)} className="min-h-12 rounded-md border border-line bg-ink px-3 text-left disabled:opacity-50">{labels[product.id] ?? 'Tip'} · {product.price}</button>)}</div>
        {message && <p role="status" className="mt-3 text-sm text-gold">{message}</p>}
        <button type="button" onClick={() => setOpen(false)} className="mt-4 min-h-11 w-full rounded-md border border-line text-mute">Close</button>
      </section>
    </div>}
  </>;
}
