'use client'

import { useState } from 'react'
import { formatDateShort, formatNumber, formatWeight } from '@/lib/format'
import type { ExerciseStatPoint } from '@/lib/types'
import { Segmented } from '@/components/ui/segmented'

type Metric = 'weight' | 'volume' | 'reps'

const METRICS: Record<Metric, { label: string; unit: string; caption: string; pick: (p: ExerciseStatPoint) => number }> = {
  weight: { label: 'Вес', unit: 'кг', caption: 'Максимальный вес в тренировке', pick: (p) => p.topWeight },
  volume: { label: 'Объём', unit: 'кг', caption: 'Объём за тренировку: вес × повторения', pick: (p) => p.volume },
  reps: { label: 'Повторения', unit: '', caption: 'Всего повторений за тренировку', pick: (p) => p.totalReps },
}

const W = 320
const H = 150
const PAD = { top: 14, right: 10, bottom: 8, left: 10 }

/** Динамика упражнения: одна точка — одна сохранённая тренировка. */
export function ExerciseChart({ points, weighted, tz }: { points: ExerciseStatPoint[]; weighted: boolean; tz: string }) {
  const available: Metric[] = weighted ? ['weight', 'volume', 'reps'] : ['reps']
  const [metric, setMetric] = useState<Metric>(available[0])
  const config = METRICS[metric]

  const values = points.map(config.pick)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const coords = values.map((value, i) => ({
    x: PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW),
    y: PAD.top + (max === min ? innerH / 2 : (1 - (value - min) / span) * innerH),
  }))
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const area = `${line} L${coords.at(-1)!.x.toFixed(1)} ${H} L${coords[0].x.toFixed(1)} ${H} Z`

  const format = (value: number) =>
    `${metric === 'weight' ? formatWeight(value) : formatNumber(value)}${config.unit ? ` ${config.unit}` : ''}`
  const first = values[0]
  const last = values.at(-1)!
  const diff = last - first

  return (
    <div className="rounded-3xl border border-border bg-surface p-4">
      {available.length > 1 ? (
        <Segmented
          label="Показатель"
          className="mb-4"
          options={available.map((value) => ({ value, label: METRICS[value].label }))}
          value={metric}
          onChange={setMetric}
        />
      ) : null}

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="tabular text-[32px] font-semibold leading-none tracking-tighter">{format(last)}</p>
          <p className="mt-1.5 text-xs leading-snug text-muted">{config.caption} · последняя запись</p>
        </div>
        {points.length > 1 && diff !== 0 ? (
          <p className={`tabular shrink-0 text-sm font-semibold ${diff > 0 ? 'text-accent-text' : 'text-muted'}`}>
            {diff > 0 ? '+' : '−'}
            {format(Math.abs(diff))}
          </p>
        ) : null}
      </div>

      {points.length > 1 ? (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${config.caption}: от ${format(first)} до ${format(last)} за ${points.length} тренировок`}
            className="mt-4 block w-full overflow-visible"
          >
            <defs>
              <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-text)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--accent-text)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#chart-fill)" />
            <path
              d={line}
              fill="none"
              stroke="var(--accent-text)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {coords.map((c, i) =>
              points.length <= 24 || i === coords.length - 1 ? (
                <circle
                  key={i}
                  cx={c.x}
                  cy={c.y}
                  r={i === coords.length - 1 ? 4.5 : 2.5}
                  fill={i === coords.length - 1 ? 'var(--accent-text)' : 'var(--surface)'}
                  stroke="var(--accent-text)"
                  strokeWidth="1.5"
                />
              ) : null,
            )}
          </svg>
          <div className="tabular mt-2 flex justify-between text-xs text-muted">
            <span>{formatDateShort(points[0].startedAt, tz)}</span>
            <span>
              мин {format(min)} · макс {format(max)}
            </span>
            <span>{formatDateShort(points.at(-1)!.startedAt, tz)}</span>
          </div>
        </>
      ) : (
        <p className="mt-4 border-t border-border pt-3 text-sm leading-relaxed text-muted">
          График появится после второй тренировки с этим упражнением.
        </p>
      )}
    </div>
  )
}
