import React from 'react';
import styles from './DataSourceBadge.module.css';

export type DataSource =
  | 'backend_verified'
  | 'third_party'
  | 'unknown'
  | 'demo'
  | 'simulated'
  | 'test'
  | 'fallback'
  | 'hardcoded'
  | 'random';

interface DataSourceBadgeProps {
  source: DataSource;
  label?: string;
}

const LABELS: Record<DataSource, string> = {
  backend_verified: '',
  third_party: '高德数据',
  unknown: '数据来源待确认',
  demo: '演示数据',
  simulated: '模拟数据 · 非官方实时',
  test: '测试数据',
  fallback: '备用演示数据',
  hardcoded: '硬编码数据 · 待替换',
  random: '模拟生成数据',
};

/** 数据来源标识：仅负责显示，不判断来源 */
const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({ source, label }) => {
  if (source === 'backend_verified') return null;
  return (
    <span className={`${styles.badge} ${styles[source] || ''}`} title={label || LABELS[source]}>
      {label || LABELS[source]}
    </span>
  );
};

export default DataSourceBadge;
