import { useEffect, useId, useRef, useState } from 'react';
import { animate, motion, useInView } from 'framer-motion';
import { Zap } from 'lucide-react';
import { BRAND } from '../lib/api';

export function Logo({ size = 'md' }) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  return (
    <span className="flex items-center gap-2.5">
      <span className={`${box} grid place-items-center rounded-xl bg-green-500 text-ink-950 shadow-[0_0_24px_-4px_rgba(34,197,94,0.7)]`}>
        <Zap className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
      </span>
      <span className="text-lg font-bold tracking-tight text-white">{BRAND.name}</span>
      <span className="rounded-md border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-green-400">
        {BRAND.tag}
      </span>
    </span>
  );
}

/** Fades + lifts children into view on scroll. */
export function Reveal({ children, delay = 0, y = 24, className = '' }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.21, 0.6, 0.35, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({ eyebrow, title, subtitle }) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center">
      <span className="text-[11px] font-semibold tracking-[0.2em] text-green-400 uppercase">{eyebrow}</span>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-zinc-400">{subtitle}</p>}
    </Reveal>
  );
}

/** Counts up to `value` the first time it scrolls into view. */
export function Counter({ value, format = (v) => v.toFixed(0), duration = 1.6 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(format(0));
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, Number(value) || 0, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(format(v)),
    });
    return () => controls.stop();
  }, [inView, value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref}>{display}</span>;
}

/** Smooth SVG line with gradient fill; draws itself on first view. */
export function Sparkline({ points, height = 56, className = '', positive = true }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const id = `g${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (!points || points.length < 2) {
    return <div className={`grid place-items-center text-xs text-zinc-600 ${className}`} style={{ height }}>Performance history builds as NAVs are published</div>;
  }
  const w = 300;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, height - 4 - ((p - min) / span) * (height - 8)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const color = positive ? '#22c55e' : '#f43f5e';
  return (
    <svg ref={ref} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={`w-full ${className}`} style={{ height }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={`${line} L${w},${height} L0,${height} Z`}
        fill={`url(#${id})`}
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 1, delay: 0.6 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={inView ? { pathLength: 1 } : {}}
        transition={{ duration: 1.4, ease: 'easeInOut' }}
      />
    </svg>
  );
}
