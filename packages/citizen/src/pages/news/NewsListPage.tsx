import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DataSourceBadge from '../../components/DataSourceBadge';
import styles from './News.module.css';
import { apiGet } from '../../services/apiClient';

interface News { id:string; category:string; title:string; summary:string; coverImage?:string; source:string; publishTime:number; tags:string[] }

/** 分类元数据：中文名 + 图标。后端新增分类时在这里补一行即可，tab 会自动生成。 */
const CAT_META: Record<string, { label: string; icon: string }> = {
  all:          { label: '全部',     icon: '📰' },
  construction: { label: '道路施工', icon: '🚧' },
  control:      { label: '交通管制', icon: '🚫' },
  policy:       { label: '政策法规', icon: '📜' },
  safety:       { label: '安全科普', icon: '⚠️' },
  holiday:      { label: '出行提示', icon: '🎉' },
  metro:        { label: '地铁通知', icon: '🚇' },
  bus:          { label: '公交调整', icon: '🚌' },
};

const formatTime = (ts:number) => new Date(ts).toLocaleDateString('zh-CN',{month:'short',day:'numeric'});

const NewsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [cat, setCat] = useState(sp.get('cat')||'all');
  const [news, setNews] = useState<News[]>([]);

  useEffect(() => {
    apiGet<News[]>('/news/list').then(setNews).catch(() => setNews([]));
  }, []);

  // 动态生成 tab：已知分类按 CAT_META 顺序，未知分类追加在后（后端新增分类自动出 tab）
  const availableCats = useMemo(() => {
    const dataCats = new Set(news.map(n => n.category));
    const known = Object.keys(CAT_META).filter(c => c === 'all' || dataCats.has(c));
    const unknown = [...dataCats].filter(c => !(c in CAT_META));
    return [...known, ...unknown];
  }, [news]);

  const filtered = cat==='all' ? news : news.filter(n=>n.category===cat);

  return (
    <div className={styles.page}>
      <div className={styles.pageTitle}>📰 交通资讯 <DataSourceBadge source="unknown" /></div>

      <div className={styles.catScroll}>
        {availableCats.map(c=>(
          <div key={c} className={`${styles.cat} ${cat===c?styles.catActive:''}`} onClick={()=>setCat(c)}>
            {CAT_META[c]?.label ?? c}
          </div>
        ))}
      </div>

      <div className={styles.newsList}>
        {filtered.map(n=>(
          <div key={n.id} className={styles.newsCard} onClick={()=>navigate(`/news/${n.id}`)}>
            <div className={styles.newsCover}>{CAT_META[n.category]?.icon ?? '📄'}</div>
            <div className={styles.newsBody}>
              <div className={styles.newsTitle}>{n.title}</div>
              <div className={styles.newsSummary}>{n.summary}</div>
              <div className={styles.newsMeta}>
                <span>{n.source}</span>
                <span>{formatTime(n.publishTime)}</span>
              </div>
              {n.tags && <div className={styles.tags}>{n.tags.map(t=><span key={t} className={styles.tag}>{t}</span>)}</div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{height:24}}/>
    </div>
  );
};

export default NewsListPage;
