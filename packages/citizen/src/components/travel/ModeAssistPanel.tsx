import React from 'react';
import { useNavigate } from 'react-router-dom';
import DataSourceBadge from '../DataSourceBadge';
import type { TravelModeOption } from './TravelModeSelector';
import styles from './ModeAssistPanel.module.css';

const AssistCard: React.FC<{ icon: string; title: string; detail: string; action?: string; onClick?: () => void; source?: 'demo' | 'simulated' }> = ({ icon, title, detail, action, onClick, source }) => (
  <div className={styles.card}>
    <div className={styles.cardIcon}>{icon}</div>
    <div className={styles.cardBody}><strong>{title}</strong><span>{detail}</span>{source && <DataSourceBadge source={source} />}</div>
    {action && <button type="button" className={styles.action} onClick={onClick}>{action}</button>}
  </div>
);

const ModeAssistPanel: React.FC<{ mode: TravelModeOption }> = ({ mode }) => {
  const navigate = useNavigate();
  if (mode === 'riding' || mode === 'walking') return null;
  if (mode === 'transit') return <section className={styles.panel}><h2>公交 / 地铁服务</h2><p className={styles.hint}>搜索线路、查看附近站点和实时换乘信息</p></section>;
  if (mode === 'driving') return <section className={styles.panel}><h2>驾车辅助服务</h2><AssistCard icon="🅿️" title="附近停车场" detail="查找目的地周边可用停车场" action="查看停车" onClick={() => navigate('/parking')} /><AssistCard icon="🚦" title="实时交通路况" detail="查看当前道路拥堵和交通事件" action="查看路况" onClick={() => navigate('/')} source="simulated" /></section>;
  if (mode === 'ev') return <section className={styles.panel}><h2>新能源辅助服务</h2><AssistCard icon="⚡" title="附近充电站" detail="充电枪状态为演示数据" action="查看充电" onClick={() => navigate('/charging/scan')} source="demo" /><AssistCard icon="🅿️" title="附近停车场" detail="停车后可继续充电" action="查看停车" onClick={() => navigate('/parking')} /></section>;
  // 项目尚未接入无障碍设施数据时保持简洁，不用演示内容冒充真实能力。
  return null;
};

export default ModeAssistPanel;
