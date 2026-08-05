import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './News.module.css';

interface News { id:string; category:string; title:string; content:string; source:string; publishTime:number; tags:string[] }

const NewsDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [news, setNews] = useState<News | null>(null);

  useEffect(() => { fetch(`/api/news/detail/${id}`).then(r=>r.json()).then(d=>setNews(d.data)); }, [id]);

  if (!news) return <div className={styles.detailPage}><div style={{textAlign:'center',padding:40}}>加载中...</div></div>;

  return (
    <div className={styles.detailPage}>
      <div style={{cursor:'pointer',marginBottom:12,fontSize:18}} onClick={()=>navigate(-1)}>← 返回</div>
      <div className={styles.detailTitle}>{news.title}</div>
      <div className={styles.detailMeta}>
        <span>{news.source}</span>
        <span>{new Date(news.publishTime).toLocaleDateString('zh-CN')}</span>
      </div>
      {news.tags && <div style={{display:'flex',gap:4,marginBottom:14,flexWrap:'wrap'}}>
        {news.tags.map(t=><span key={t} style={{fontSize:11,padding:'3px 10px',background:'var(--primary-light)',color:'var(--primary)',borderRadius:10}}>{t}</span>)}
      </div>}
      <div className={styles.detailContent} dangerouslySetInnerHTML={{__html:news.content}}/>
      <div style={{height:32}}/>
    </div>
  );
};

export default NewsDetailPage;
