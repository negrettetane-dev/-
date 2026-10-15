import React, { useState } from 'react';
import styles from './DepartureTime.module.css';
import {
  computeDepartureState,
  parseCustomDateTime,
  type DepartureMode,
  type DepartureState,
} from '../../utils/departureTime';
import DepartureTimeModal from './DepartureTimeModal';

interface Props {
  value: DepartureState;
  onChange: (state: DepartureState) => void;
}

/**
 * 出发时间下拉：中文选项只负责交互显示。
 * 选「自定义时间」时打开 Modal，确认前不污染正式出发时间；取消则保持原值。
 */
const DepartureTimeSelect: React.FC<Props> = ({ value, onChange }) => {
  const [customOpen, setCustomOpen] = useState(false);
  const [error, setError] = useState('');

  const handleSelect = (mode: DepartureMode) => {
    if (mode === 'custom') {
      // 仅打开 Modal，value 不变；确认后才写入 custom + departureAt
      setError('');
      setCustomOpen(true);
      return;
    }
    // now / plus30 / plus60：选择时实时计算（不在页面初始化时固定）
    onChange(computeDepartureState(mode, new Date()));
  };

  const handleConfirm = (date: string, time: string) => {
    const selected = parseCustomDateTime(date, time);
    if (!selected) {
      setError('请选择有效的日期和时间');
      return;
    }
    if (selected.getTime() <= Date.now()) {
      setError('出发时间不能早于当前时间');
      return;
    }
    onChange(computeDepartureState('custom', undefined, selected));
    setCustomOpen(false);
    setError('');
  };

  return (
    <>
      <select
        className={styles.select}
        value={value.departureMode}
        onChange={e => handleSelect(e.target.value as DepartureMode)}
        aria-label="出发时间"
      >
        <option value="now">现在出发</option>
        <option value="plus30">30分钟后</option>
        <option value="plus60">1小时后</option>
        {/* 自定义时显示真实时间文本，不再显示「自定义时间」占位 */}
        <option value="custom">
  {value.departureMode === 'custom' ? value.departureTimeLabel : '自定义时间'}
</option>
      </select>
      <DepartureTimeModal
        open={customOpen}
        initialAt={value.departureMode === 'custom' ? value.departureAt : undefined}
        error={error}
        onConfirm={handleConfirm}
        onCancel={() => { setCustomOpen(false); setError(''); }}
      />
    </>
  );
};

export default DepartureTimeSelect;
