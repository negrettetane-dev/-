import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Services.module.css';

const SERVICES = [
  { icon:'🚗', title:'违章查询', desc:'机动车违法信息查询，跳转交管官方渠道', action:'立即查询' },
  { icon:'📋', title:'车驾管指南', desc:'驾驶证、机动车业务办事指南', action:'查看指南' },
  { icon:'🛣️', title:'高速路况', desc:'实时高速路况、收费站拥堵情况查询', action:'查看路况' },
  { icon:'🚌', title:'长途客运', desc:'长途客运班次查询与购票入口', action:'查询班次' },
  { icon:'📞', title:'移车求助', desc:'一键发起挪车通知，保护双方手机号隐私', action:'发起挪车' },
  { icon:'ℹ️', title:'更多服务', desc:'更多便民服务持续接入中...', action:'敬请期待' },
];

const ServicesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className="page-title">🧰 便民服务</div>
      <div className={styles.grid}>
        {SERVICES.map(s=>(
          <div key={s.title} className={styles.card}>
            <div className={styles.cardIcon}>{s.icon}</div>
            <div className={styles.cardTitle}>{s.title}</div>
            <div className={styles.cardDesc}>{s.desc}</div>
            <button className={styles.cardBtn}>{s.action}</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServicesPage;
