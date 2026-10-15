import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchTransitUnified } from '../../services/transitService';
import { toDetailPath, type TransitSearchState, type UnifiedTransitResult } from '../../types/transitSearch';
import type { UnifiedLocation } from '../../stores/travelLocationStore';
import styles from './TransitSearch.module.css';

interface Props {
  /** 是否处于公交/地铁模式。false 时隐藏但保留输入，并取消未完成请求 */
  active: boolean;
  /** 可选：提供「设为起点/终点」按钮；不传则隐藏（如公交查询页无起终点） */
  onSetOrigin?: (loc: UnifiedLocation) => void;
  onSetDestination?: (loc: UnifiedLocation) => void;
}

const IDLE: TransitSearchState = { status: 'idle', query: '', results: [] };
const TYPE_ICON: Record<UnifiedTransitResult['type'], string> = {
  bus_line: '🚌', bus_stop: '🚏', metro_line: '🚇', metro_stop: '📍',
};

const TransitSearchPanel: React.FC<Props> = ({ active, onSetOrigin, onSetDestination }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [state, setState] = useState<TransitSearchState>(IDLE);
  const [suggestions, setSuggestions] = useState<UnifiedTransitResult[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  // 竞态保护：请求序号，只接受最后一次请求的结果
  const searchSeq = useRef(0);
  const suggestSeq = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // 切换到非公交模式：取消未完成请求，防止切模式后结果写入
  useEffect(() => {
    if (!active) {
      searchSeq.current++;
      suggestSeq.current++;
    }
  }, [active]);

  const runSuggest = (value: string) => {
    if (!active) return;
    const q = value.trim();
    if (q.length < 2) { setSuggestions([]); setSuggestOpen(false); setHighlight(-1); return; }
    const seq = ++suggestSeq.current;
    searchTransitUnified(q)
      .then(list => {
        if (seq !== suggestSeq.current || !mountedRef.current || !active) return;
        setSuggestions(list.slice(0, 5));
        setSuggestOpen(list.length > 0);
        setHighlight(-1);
      })
      .catch(() => {
        if (seq === suggestSeq.current) { setSuggestions([]); setSuggestOpen(false); }
      });
  };

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // 联想：防抖、长度≥2 才请求；正式结果在新 query 下重置
    setState(prev => (prev.query === value.trim() && prev.status !== 'idle' ? prev : IDLE));
    debounceRef.current = setTimeout(() => runSuggest(value), 300);
  };

  // 正式搜索：按钮 / Enter 共用；绕过 debounce 立即请求
  const handleSearch = (value: string) => {
    const q = value.trim();
    if (!q) return;
    setQuery(q);
    setSuggestOpen(false);
    setHighlight(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++searchSeq.current;
    setState({ status: 'loading', query: q, results: [] });
    searchTransitUnified(q)
      .then(list => {
        if (seq !== searchSeq.current || !mountedRef.current) return;
        setState(list.length ? { status: 'success', query: q, results: list } : { status: 'empty', query: q, results: [] });
      })
      .catch(() => {
        if (seq !== searchSeq.current || !mountedRef.current) return;
        // 接口异常 ≠ 空结果：显示「搜索服务暂时不可用」
        setState({ status: 'error', query: q, results: [] });
      });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestOpen && suggestions.length) setHighlight(h => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestOpen && suggestions.length) setHighlight(h => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // 有高亮 → 选高亮项；无高亮 → 完整搜索当前输入（不默认选第一条）
      if (suggestOpen && highlight >= 0 && suggestions[highlight]) handleSearch(suggestions[highlight].name);
      else handleSearch(query);
    } else if (e.key === 'Escape') {
      setSuggestOpen(false);
      setHighlight(-1);
    }
  };

  // 设为起点/终点：坐标完整才允许，缺坐标置灰；回调未提供则不显示
  const setAsOrigin = (r: UnifiedTransitResult) => {
    if (!onSetOrigin || r.lng == null || r.lat == null) return;
    onSetOrigin({ name: r.name, address: r.address || r.name, lng: r.lng, lat: r.lat, source: 'poi-search', timestamp: Date.now() });
  };
  const setAsDest = (r: UnifiedTransitResult) => {
    if (!onSetDestination || r.lng == null || r.lat == null) return;
    onSetDestination({ name: r.name, address: r.address || r.name, lng: r.lng, lat: r.lat, source: 'poi-search' });
  };

  const openDetail = (r: UnifiedTransitResult) => {
    const path = toDetailPath(r.type, r.id);
    if (path) navigate(path);
  };

  return (
    <div className={`${styles.panel} ${active ? '' : styles.panelHidden}`} aria-hidden={!active}>
      {/* 搜索输入 + 按钮 */}
      <div className={styles.searchRow}>
        <div className={styles.inputWrap}>
          <input
            className={styles.input}
            role="combobox"
            aria-expanded={suggestOpen}
            aria-controls="transit-suggestions"
            aria-label="搜索公交地铁线路或站点"
            placeholder="输入线路或站点，如 300 / 西直门"
            value={query}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (query.trim().length >= 2) runSuggest(query); }}
            onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
          />
          {/* 联想列表 */}
          {suggestOpen && suggestions.length > 0 && (
            <div className={styles.suggestList} id="transit-suggestions" role="listbox" aria-label="搜索联想">
              {suggestions.map((s, i) => (
                <div
                  key={s.type + s.id}
                  role="option"
                  aria-selected={i === highlight}
                  className={`${styles.suggestItem} ${i === highlight ? styles.suggestItemActive : ''}`}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleSearch(s.name)}
                  onMouseEnter={() => setHighlight(i)}
                >
                  <span className={styles.suggestIcon}>{TYPE_ICON[s.type]}</span>
                  <span>{s.name}</span>
                  {s.subtitle && <span className={styles.suggestSub}>{s.subtitle}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <button className={styles.searchBtn} onClick={() => handleSearch(query)} disabled={!query.trim()}>
          🔍 搜索
        </button>
      </div>

      {/* 状态提示：loading / empty / error 相互独立 */}
      {state.status === 'loading' && <div className={styles.statusNote}>正在搜索「{state.query}」…</div>}
      {state.status === 'empty' && <div className={styles.statusNote}>未找到「{state.query}」相关线路或站点</div>}
      {state.status === 'error' && (
        <div className={styles.statusNote}>
          <span style={{ color: '#d4380d' }}>搜索服务暂时不可用</span>
          <button className={styles.retryBtn} onClick={() => handleSearch(state.query)}>重试</button>
        </div>
      )}

      {/* 正式搜索结果 */}
      {state.status === 'success' && state.results.length > 0 && (
        <div className={styles.resultList}>
          {state.results.map(r => {
            const canLocate = r.lng != null && r.lat != null;
            const hasDetail = toDetailPath(r.type, r.id) !== null;
            return (
              <div key={r.type + r.id} className={styles.resultItem}>
                <span className={styles.resultIcon}>{TYPE_ICON[r.type]}</span>
                <div className={styles.resultBody}>
                  <div className={styles.resultName}>
                    {r.name}
                    {r.type === 'bus_line' || r.type === 'metro_line'
                      ? <span className={styles.detailLink} onClick={() => openDetail(r)}>查看详情 ›</span>
                      : <span className={styles.noDetail}>站点无详情页</span>}
                  </div>
                  {r.subtitle && <div className={styles.resultSub}>{r.subtitle}</div>}
                </div>
                {/* 站点：设为起点/终点（仅在提供回调时显示）；线路：详情跳转（detailLink） */}
                {(r.type === 'bus_stop' || r.type === 'metro_stop') && (onSetOrigin || onSetDestination) && (
                  <div className={styles.resultActions}>
                    {onSetOrigin && (
                      <button
                        className={`${styles.actionBtn} ${!canLocate ? styles.actionBtnDisabled : ''}`}
                        disabled={!canLocate}
                        title={canLocate ? '设为起点' : '该站点缺少定位信息'}
                        onClick={() => setAsOrigin(r)}
                      >
                        起点
                      </button>
                    )}
                    {onSetDestination && (
                      <button
                        className={`${styles.actionBtn} ${!canLocate ? styles.actionBtnDisabled : ''}`}
                        disabled={!canLocate}
                        title={canLocate ? '设为终点' : '该站点缺少定位信息'}
                        onClick={() => setAsDest(r)}
                      >
                        终点
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TransitSearchPanel;
