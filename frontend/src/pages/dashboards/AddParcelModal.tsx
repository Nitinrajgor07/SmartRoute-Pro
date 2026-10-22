import React, { useEffect, useState } from 'react';
import { X, Package, Loader2, AlertCircle } from 'lucide-react';
import { myService } from '../../services/api';
import { formatINR } from '../../utils/formatINR';
import type { BookingHub, BookParcelPayload } from '../../services/api';

interface AddParcelModalProps {
  open: boolean;
  defaultRecipient?: string;
  onClose: () => void;
  onBooked: (trackingNumber: string, message: string) => void;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500';

export const AddParcelModal: React.FC<AddParcelModalProps> = ({ open, defaultRecipient = '', onClose, onBooked }) => {
  const [hubs, setHubs] = useState<BookingHub[]>([]);
  const [loadingHubs, setLoadingHubs] = useState(false);
  const [pickupId, setPickupId] = useState<number | ''>('');
  const [destinationId, setDestinationId] = useState<number | ''>('');
  const [weight, setWeight] = useState<string>('1');
  const [priority, setPriority] = useState<BookParcelPayload['priority']>('Standard');
  const [recipient, setRecipient] = useState<string>(defaultRecipient);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsedWeight = Number(weight);
  const rate = priority === 'Urgent' ? 100 : priority === 'Express' ? 75 : priority === 'Standard' ? 50 : null;
  const estimatedPrice = Number.isFinite(parsedWeight) && parsedWeight > 0 && rate !== null
    ? parsedWeight * rate
    : null;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRecipient(defaultRecipient);
    if (hubs.length > 0) return;
    setLoadingHubs(true);
    myService
      .getBookingHubs()
      .then((res) => setHubs(res.hubs || []))
      .catch(() => setError('Could not load pickup and drop-off places.'))
      .finally(() => setLoadingHubs(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pickupId || !destinationId) {
      setError('Please choose both a pickup and a drop-off place.');
      return;
    }
    if (pickupId === destinationId) {
      setError('Pickup and drop-off must be different places.');
      return;
    }
    const kg = Number(weight);
    if (!Number.isFinite(kg) || kg <= 0 || kg > 50) {
      setError('Weight must be between 0.1 and 50 kg.');
      return;
    }
    if (priority !== 'Standard' && priority !== 'Express' && priority !== 'Urgent') {
      setError('Please choose a valid parcel speed.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await myService.bookParcel({
        pickup_location_id: Number(pickupId),
        destination_location_id: Number(destinationId),
        package_weight_kg: kg,
        priority,
        recipient_name: recipient.trim() || undefined
      });
      setPickupId('');
      setDestinationId('');
      setWeight('1');
      setPriority('Standard');
      onBooked(res.parcel.tracking_number, res.message);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not book the parcel. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-parcel-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="glass-float w-full max-w-md rounded-2xl p-6 space-y-4"
        data-testid="add-parcel-form"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <h3 id="add-parcel-title" className="text-sm font-bold text-slate-900 dark:text-white">
              Add a parcel
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add parcel form"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Pickup from</span>
            <select
              value={pickupId}
              onChange={(e) => setPickupId(e.target.value ? Number(e.target.value) : '')}
              className={inputClass}
              disabled={loadingHubs}
              data-testid="parcel-pickup"
            >
              <option value="">{loadingHubs ? 'Loading places...' : 'Choose a place'}</option>
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Deliver to</span>
            <select
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value ? Number(e.target.value) : '')}
              className={inputClass}
              disabled={loadingHubs}
              data-testid="parcel-destination"
            >
              <option value="">{loadingHubs ? 'Loading places...' : 'Choose a place'}</option>
              {hubs
                .filter((h) => h.id !== pickupId)
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Recipient name</span>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              maxLength={150}
              placeholder="Who will receive it?"
              className={inputClass}
              data-testid="parcel-recipient"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Weight (kg)</span>
              <input
                type="number"
                min={0.1}
                max={50}
                step={0.1}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={inputClass}
                data-testid="parcel-weight"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Speed</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as BookParcelPayload['priority'])}
                className={inputClass}
                data-testid="parcel-priority"
              >
                <option value="Standard">Standard</option>
                <option value="Express">Express</option>
                <option value="Urgent">Urgent</option>
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-brand-200 bg-brand-50/70 px-3 py-2.5 dark:border-brand-900/60 dark:bg-brand-950/30">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Estimated price</span>
            <span className="text-base font-bold text-brand-700 dark:text-brand-300" data-testid="parcel-estimated-price">
              {estimatedPrice === null ? 'Enter a valid weight' : formatINR(estimatedPrice)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {priority} rate: {formatINR(rate)} per kg. Final price is verified when booked.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Your parcel starts as Pending. A dispatcher assigns a driver and you can track it here.
        </p>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || loadingHubs}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            data-testid="parcel-submit"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? 'Booking...' : 'Book parcel'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddParcelModal;
