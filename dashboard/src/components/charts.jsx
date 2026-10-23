import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const axis = { stroke: '#52525b', fontSize: 11, tickLine: false, axisLine: false };

/** Area chart for a time series: data = [{ date, value }]. */
export function TimeChart({ data, height = 260, format = (v) => v, valueLabel = 'Value' }) {
  const id = `fill${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const first = data[0]?.value ?? 0;
  const last = data[data.length - 1]?.value ?? 0;
  const color = last >= first ? '#22c55e' : '#f43f5e';

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date"
            {...axis}
            minTickGap={40}
            tickFormatter={(d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <YAxis {...axis} width={70} domain={['auto', 'auto']} tickFormatter={format} />
          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
            contentStyle={{ background: '#0e1210', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: '#a1a1aa' }}
            labelFormatter={(d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            formatter={(v) => [format(v), valueLabel]}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${id})`} animationDuration={1200} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
