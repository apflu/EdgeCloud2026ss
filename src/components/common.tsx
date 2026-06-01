import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';

export function Panel({ title, subtitle, children }: { title: string; subtitle?: string } & PropsWithChildren) {
  return (
    <section className='panel'>
      <div className='panel-header'>
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function StatusBadge({ label, tone }: { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

export function TrendSnippet({ label, values, suffix = '', onClick }: { label: string; values: number[]; suffix?: string; onClick?: () => void }) {
  const max = Math.max(...values, 1);
  return (
    <button type='button' className='trend-card trend-card-button' onClick={onClick} aria-label={`Open detailed ${label} chart`}>
      <div className='trend-header'>
        <strong>{label}</strong>
        <span>{values[values.length - 1]}{suffix}</span>
      </div>
      <div className='bars' aria-label={`${label} trend snippet`}>
        {values.map((v, i) => (
          <div key={`${label}-${i}`} className='bar' style={{ height: `${Math.max(10, (v / max) * 100)}%` }} title={`${v}${suffix}`} />
        ))}
      </div>
      <div className='trend-footer'><small>Click to inspect over time</small></div>
    </button>
  );
}

export function TrendZoomModal({ open, title, values, suffix = '', onClose }: { open: boolean; title: string; values: number[]; suffix?: string; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const latest = values[values.length - 1];
  const avg = values.reduce((sum, current) => sum + current, 0) / values.length;

  return (
    <div className='modal-backdrop' onClick={onClose} role='dialog' aria-modal='true' aria-label={`${title} detailed graph`}>
      <div className='modal-card' onClick={(e) => e.stopPropagation()}>
        <div className='modal-header'>
          <div>
            <h2>{title}</h2>
            <p>Expanded temporal analysis view</p>
          </div>
          <button type='button' onClick={onClose}>Close</button>
        </div>
        <div className='modal-stats'>
          <div><span>Current</span><strong>{latest}{suffix}</strong></div>
          <div><span>Minimum</span><strong>{min}{suffix}</strong></div>
          <div><span>Maximum</span><strong>{max}{suffix}</strong></div>
          <div><span>Average</span><strong>{avg.toFixed(1)}{suffix}</strong></div>
        </div>
        <div className='line-chart-wrapper'>
          <svg viewBox='0 0 100 40' className='line-chart' preserveAspectRatio='none'>
            <polyline
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              points={values.map((value, index) => {
                const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
                const y = 40 - (value / max) * 36;
                return `${x},${Math.max(2, y)}`;
              }).join(' ')}
            />
          </svg>
          <div className='chart-axis-labels'>
            {values.map((value, index) => (
              <div key={`${title}-${index}`} className='chart-point'>
                <span className='chart-point-index'>T-{values.length - 1 - index}</span>
                <strong>{value}{suffix}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className='modal-note'>This expanded chart remains privacy-preserving: it shows only time-series metadata and no raw video or direct biometric identity.</div>
      </div>
    </div>
  );
}
