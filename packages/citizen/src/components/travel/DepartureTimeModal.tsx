import React, { useEffect, useState } from 'react';
import styles from './DepartureTime.module.css';

interface Props {
  open: boolean;
  /** 若当前已是自定义时间，回填上次选择 */
  initialAt?: string;
  /** 校验错误（由父组件传入，父组件负责最终校验） */
  error: string;
  onConfirm: (date: string, time: string) => void;
  onCancel: () => void;
}

interface Draft { date: string; time: string }

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInput(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 默认草稿：当前时间 +30 分钟（保证默认合法） */
function initialDraft(): Draft {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  return { date: toDateInput(d), time: toTimeInput(d) };
}

const DepartureTimeModal: React.FC<Props> = ({ open, initialAt, error, onConfirm, onCancel }) => {
  const [draft, setDraft] = useState<Draft>(initialDraft);

  // 打开时：回填已有自定义时间，否则给默认草稿。修改只写 draft，不污染正式出发时间。
  useEffect(() => {
    if (!open) return;
    if (initialAt && !Number.isNaN(new Date(initialAt).getTime())) {
      const d = new Date(initialAt);
      setDraft({ date: toDateInput(d), time: toTimeInput(d) });
    } else {
      setDraft(initialDraft());
    }
  }, [open, initialAt]);

  if (!open) return null;

  const todayStr = toDateInput(new Date());

  return (
    <div className={styles.modalMask} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="dt-modal-title">
        <div className={styles.modalHead}>
          <span id="dt-modal-title" className={styles.modalTitle}>选择出发时间</span>
          <button type="button" className={styles.modalClose} onClick={onCancel} aria-label="关闭">✕</button>
        </div>
        <div className={styles.modalBody}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>日期</span>
            <input
              type="date"
              min={todayStr}
              value={draft.date}
              onChange={e => setDraft(s => ({ ...s, date: e.target.value }))}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>时间</span>
            <input
              type="time"
              value={draft.time}
              onChange={e => setDraft(s => ({ ...s, time: e.target.value }))}
            />
          </label>
          {error && <div className={styles.modalError} role="alert">⚠️ {error}</div>}
          <div className={styles.modalHint}>支持选择跨天日期；若时间已过，将无法确认。</div>
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.modalCancel} onClick={onCancel}>取消</button>
          <button type="button" className={styles.modalConfirm} onClick={() => onConfirm(draft.date, draft.time)}>确定</button>
        </div>
      </div>
    </div>
  );
};

export default DepartureTimeModal;
