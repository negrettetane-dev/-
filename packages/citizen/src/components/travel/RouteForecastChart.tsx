import React from 'react';
import type { RouteForecastPoint } from '../../types/routeForecast';
import { FORECAST_LEVEL_COLOR } from '../../types/routeForecast';

interface Props {
  forecast: RouteForecastPoint[];
}

/** 未来拥堵趋势图：纯 SVG，不依赖图表库，切换数据即时重绘 */
const RouteForecastChart: React.FC<Props> = ({ forecast }) => {
  if (!forecast || forecast.length === 0) return null;

  const offsets: number[] = forecast.map(f => f.offsetMinutes);
  const idxValues: number[] = forecast.map(f => f.index);
  const max = Math.max(8, Math.ceil(Math.max(...idxValues) + 0.5));
  const min = Math.max(0, Math.floor(Math.min(...idxValues) - 0.5));
  const W = 640;
  const H = 150;
  const PAD = { top: 22, right: 18, bottom: 28, left: 18 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (offset: number) => PAD.left + ((offset - 15) / 45) * innerW;
  const y = (value: number) => PAD.top + innerH - ((value - min) / Math.max(1, max - min)) * innerH;

  const line = offsets.map((o, i) => `${x(o)},${y(idxValues[i])}`).join(' ');
  const area = `${x(offsets[0])},${PAD.top + innerH} ${line} ${x(offsets[offsets.length - 1])},${PAD.top + innerH}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }} aria-label="未来拥堵指数趋势图">
      {[min, Math.round((min + max) / 2), max].map(value => (
        <g key={value}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} stroke="#edf1f7" strokeWidth="1" />
          <text x={2} y={y(value) + 4} fontSize="11" fill="#a0a8b5">{value}</text>
        </g>
      ))}
      <polygon points={area} fill="rgba(22,119,255,0.15)" />
      <polyline points={line} fill="none" stroke="#1677ff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {offsets.map((o, i) => (
        <g key={o}>
          <circle cx={x(o)} cy={y(idxValues[i])} r="5" fill="#fff" stroke={FORECAST_LEVEL_COLOR[forecast[i].level]} strokeWidth="3" />
          <text x={x(o)} y={y(idxValues[i]) - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill={FORECAST_LEVEL_COLOR[forecast[i].level]}>{idxValues[i].toFixed(1)}</text>
          <text x={x(o)} y={H - 7} textAnchor="middle" fontSize="12" fill="#7f8998">{o}分钟</text>
        </g>
      ))}
    </svg>
  );
};

export default RouteForecastChart;
