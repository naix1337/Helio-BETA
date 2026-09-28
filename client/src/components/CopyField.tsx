import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable (plain http) — the input is selectable instead
    }
  };
  return (
    <div className="flex gap-2">
      <input readOnly value={value} className="input mono" onFocus={(e) => e.target.select()} />
      <button type="button" onClick={copy} className="btn btn-icon flex-none" style={{ width: 42, height: 42 }} title="Kopieren">
        {copied ? <Check className="w-[15px] h-[15px]" style={{ color: 'var(--color-ok)' }} /> : <Copy className="w-[15px] h-[15px]" />}
      </button>
    </div>
  );
}
