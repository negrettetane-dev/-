import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLineDetail } from '../../services/transitService';
import type { TransitLine } from '../../types/transit';
import styles from './Elderly.module.css';

/** 长辈模式公交线路详情（轻量，大字，无地图）：展示线路号/方向/首末班/站点列表 */
const ElderlyBusDetailPage: React.FC = () => {
  const { lineId = '' } = useParams<{ lineId: string }>();
  const navigate = useNavigate();
  const [line, setLine] = useState<TransitLine | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!lineId) { setNotFound(true); setLoading(false); return; }
    setLoading(true);
    getLineDetail('bus', lineId)
      .then((d) => {
        if (d) { setLine(d); setNotFound(false); }
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [lineId]);

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.exitBtn} onClick={() => navigate('/elderly')} style={{ marginRight: 'auto' }}>← 返回长辈首页</button>
        <span className={styles.logo}>线路详情 · 长辈模式</span>
        <span style={{ width: 88 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, fontSize: 22, color: 'var(--text-secondary)' }}>正在加载线路信息…</div>
      ) : notFound || !line ? (
        <div className={styles.card}>
          <div style={{ textAlign: 'center', padding: 20, fontSize: 22, color: 'var(--text-hint)' }}>该线路信息暂未接入</div>
          <button type="button" className={styles.btn} onClick={() => navigate('/elderly')}>返回长辈首页</button>
        </div>
      ) : (
        <div className={styles.card}>
          <div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.2 }}>🚌 {line.name}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary)' }}>开往：{line.to || '方向未接入'}</div>
          <div style={{ fontSize: 18, color: 'var(--text-secondary)' }}>
            首班 {line.first || '—'} · 末班 {line.last || '—'}
          </div>
          <div className={styles.busDemoBanner}>到站信息为演示数据 · 尚未接入官方实时公交</div>

          <div style={{ marginTop: 8 }}>
            {line.stations.length === 0 ? (
              <div style={{ fontSize: 20, color: 'var(--text-hint)' }}>暂无站点信息</div>
            ) : (
              line.stations.map((s, i) => (
                <div key={s.id || `${line.id}_${i}`} className={styles.busStopRow}>
                  <span className={styles.busStopSeq}>{i + 1}</span>
                  <span className={styles.busStopName}>{s.name}</span>
                </div>
              ))
            )}
          </div>

          <button type="button" className={styles.btn} onClick={() => navigate('/elderly')}>返回长辈首页</button>
        </div>
      )}

      <div style={{ height: 32 }} />
    </div>
  );
};

export default ElderlyBusDetailPage;
