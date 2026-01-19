import React, { useState } from 'react';

const PERCENTS = [5, 12, 18, 28];

type Props = {
  onCalculate?: (gst: number, total: number) => void;
  useCtc?: boolean;
  ctc?: number;
};

const GstCalculator: React.FC<Props> = ({ onCalculate, useCtc = false, ctc = 0 }) => {
  const [amount, setAmount] = useState<string>('');
  const [percent, setPercent] = useState<number>(18);
  const [gstAmount, setGstAmount] = useState<number | null>(null);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);

  const calculate = () => {
    let base = parseFloat(amount || '0');
    if (useCtc) base = Number(ctc || 0);
    if (isNaN(base)) {
      setGstAmount(0);
      setTotalAmount(0);
      if (onCalculate) onCalculate?.(0, 0);
      return;
    }
    const gst = parseFloat(((base * percent) / 100).toFixed(2));
    const total = parseFloat((base + gst).toFixed(2));
    setGstAmount(gst);
    setTotalAmount(total);
    if (onCalculate) onCalculate(gst, total);
  };

  return (
    <div className="mt-4 p-4 bg-white rounded border border-gray-200">
      <p className="text-sm font-medium text-gray-700 mb-2">GST Calculator</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={useCtc ? String(ctc || '') : amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            placeholder={useCtc ? 'Using CTC' : 'Enter amount'}
            disabled={useCtc}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">GST %</label>
          <select value={percent} onChange={e => setPercent(Number(e.target.value))} className="w-full px-3 py-2 border rounded-md">
            {PERCENTS.map(p => <option key={p} value={p}>{p}%</option>)}
          </select>
        </div>
        <div>
          <button type="button" onClick={calculate} className="w-full px-3 py-2 bg-blue-600 text-white rounded-md">Calculate GST</button>
        </div>
      </div>

      <div className="mt-3 text-sm text-gray-700">
        <p>GST: <span className="font-semibold">{gstAmount !== null ? `₹ ${gstAmount.toFixed(2)}` : '—'}</span></p>
        <p className="mt-1">Total Amount: <span className="font-semibold">{totalAmount !== null ? `₹ ${totalAmount.toFixed(2)}` : '—'}</span></p>
      </div>
    </div>
  );
};

export default GstCalculator;
