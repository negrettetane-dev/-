import React from 'react';
import type { RouteForecastPoint } from '../../types/routeForecast';
import { FORECAST_LEVEL_COLOR, FORECAST_LEVEL_LABEL } from '../../types/routeForecast';
import { labelForDepartureAt } from '../../utils/departureTime';
import RouteForecastChart from './RouteForecastChart';
import styles from './RouteForecast.module.css';

interface Props {
  forecast: RouteForecastPoint[];
  loading: boolean;
  error: string;
  isFallback?: boolean;
  /** 预测基准出发时间（ISO），非 now 时展示「以 X 出发为基准」 */
  baseAt?: string;
  onRetry: () => void;
}

const RouteForecastPanel: React.FC<Props> = ({ forecast, loading, error, isFallback, baseAt, onRetry }) => {
  const hasForecast = !loading && !error && forecast.length > 0;
  const peak = hasForecast ? forecast.reduce((best, point) => point.index > best.index ? point : best, forecast[0]) : null;
  const latest = hasForecast ? forecast[forecast.length - 1] : null;
  const baseLabel = baseAt && !Number.isNaN(new Date(baseAt).getTime()) ? labelForDepartureAt(baseAt) : '';
  return (
    <div className={styles.panel}>
      <div className={styles.titleRow}>
        <div className={styles.title}>🔮 未来拥堵预测</div>
        <span className={styles.sourceBadge}>模拟预测 · 非官方</span>
      </div>
      {baseLabel && <div className={styles.baseAt}>以「{baseLabel}」出发为基准</div>}

      {hasForecast && (
        <div className={styles.summary}>
          <span className={styles.summaryDot} />
          {peak && peak.index >= 6.5
            ? `预计${peak.offsetMinutes}分钟后拥堵风险最高`
            : latest
              ? '未来路况整体较稳定'
              : '暂无趋势结论'}
        </div>
      )}

      {loading && <div className={styles.hint}>正在分析未来交通趋势...</div>}

      {!loading && error && (
        <div className={styles.hint}>
          <span style={{ color: '#d4380d' }}>未来拥堵预测暂不可用，不影响当前路线规划</span>
          <button className={styles.retry} onClick={onRetry}>重新加载</button>
        </div>
      )}

      {!loading && !error && isFallback && (
        <div className={styles.hint} style={{ color: '#ad8b00' }}>
          预测服务暂不可用，当前展示备用模拟预测
        </div>
      )}

      {!loading && !error && (!forecast || forecast.length === 0) && (
        <div className={styles.hint}>暂无未来交通预测，当前路线仍可正常使用</div>
      )}

      {hasForecast && (
        <>
          <div className={styles.chartHeader}>
            <span>拥堵指数趋势</span>
            <span className={styles.chartUnit}>指数越高，拥堵越严重</span>
          </div>
          <div className={styles.chart}>
            <RouteForecastChart forecast={forecast} />
          </div>
          <div className={styles.grid}>
            {forecast.map((point) => (
              <div key={point.offsetMinutes} className={styles.cell}>
                <div className={styles.cellOffset}>{point.offsetMinutes === 15 ? '15分钟后' : `${point.offsetMinutes}分钟后`}</div>
                {
                  <>
                    <div className={styles.cellLevel} style={{ color: FORECAST_LEVEL_COLOR[point.level] }}>
                      <span className={styles.levelDot} style={{ background: FORECAST_LEVEL_COLOR[point.level] }} />
                      {FORECAST_LEVEL_LABEL[point.level]}
                    </div>
                    <div className={styles.cellIndex}>{point.index.toFixed(1)}</div>
                    <div className={styles.cellMeta}>{point.avgSpeed} km/h</div>
                  </>
                }
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default RouteForecastPanel;
