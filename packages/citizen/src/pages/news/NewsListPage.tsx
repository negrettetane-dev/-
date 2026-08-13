import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DataSourceBadge from '../../components/DataSourceBadge';
import styles from './News.module.css';
import { apiGet } from '../../services/apiClient';

interface News { id:string; category:string; title:string; summary:string; coverImage?:string; source:string; publishTime:number; tags:string[] }

const CATS = ['all','construction','control','policy','safety','holiday'];
const CAT_LABELS: Record<string,string> = { all:'全部', construction:'道路施工', control:'交通管制', policy:'政策法规', safety:'安全科普', holiday:'出行提示' };
const formatTime = (ts:number) => new Date(ts).toLocaleDateString('zh-CN',{month:'short',day:'numeric'});

const NewsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [cat, setCat] = useState(sp.get('cat')||'all');
  const [news, setNews] = useState<News[]>([]);

  useEffect(() => {
    apiGet<News[]>('/news/list').then(setNews).catch(() => setNews([]));
  }, []);

  const filtered = cat==='all' ? news : news.filter(n=>n.category===cat);

  return (
    <div className={styles.page}>
      <div className={styles.pageTitle}>📰 交通资讯 <DataSourceBadge source="unknown" /></div>

      <div className={styles.catScroll}>
        {CATS.map(c=>(
          <div key={c} className={`${styles.cat} ${cat===c?styles.catActive:''}`} onClick={()=>setCat(c)}>
            {CAT_LABELS[c]}
          </div>
        ))}
      </div>

      <div className={styles.newsList}>
        {filtered.map(n=>(
          <div key={n.id} className={styles.newsCard} onClick={()=>navigate(`/news/${n.id}`)}>
            <div className={styles.newsCover}>{n.category==='construction'?'🚧':n.category==='control'?'🚫':n.category==='policy'?'📜':n.category==='safety'?'⚠️':'🎉'}</div>
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
