import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Services.module.css';

interface ModalState { open: boolean; title: string; content: string; }

const SERVICES = [
  {
    icon: '🚗', title: '违章查询',
    desc: '机动车违法信息查询，跳转交管官方渠道',
    action: '立即查询',
    modal: '请访问「交管12123」APP或北京交警官方网站查询机动车违法信息。\n\n常用查询方式：\n• 交管12123 APP\n• 北京交警微信公众号\n• bjjtgl.gov.cn 官网\n\n温馨提示：非本人机动车需先备案。',
  },
  {
    icon: '📋', title: '车驾管指南',
    desc: '驾驶证、机动车业务办事指南',
    action: '查看指南',
    modal: '📌 驾驶证业务\n• 期满换证：到期前90天内，交管12123在线办理\n• 补证换证：身份证+1寸白底照片\n• 异地转入：无需回原籍\n\n📌 机动车业务\n• 年检：6年内新车免上线检测\n• 过户：双方到场+身份证+行驶证+登记证书\n• 报废：指定回收企业办理',
  },
  {
    icon: '🛣️', title: '高速路况',
    desc: '实时高速路况、收费站拥堵情况查询',
    action: '查看路况',
    modal: '🚧 当前北京市主要高速路况（演示数据，非实时）：\n\n• 京藏高速（G6）：进京方向昌平段车流量大\n• 京港澳高速（G4）：全线畅通\n• 京沪高速（G2）：出京方向五环至六环缓行\n• 京承高速（G45）：全线路况良好\n• 机场高速：T3方向轻微拥堵\n\n以上为演示路况，仅供功能展示。',
  },
  {
    icon: '🚌', title: '长途客运',
    desc: '查询汽车班次，支持在线购票',
    action: '查询班次',
    path: '/services/bus',
  },
  {
    icon: '🚇', title: '定制公交',
    desc: '一人一座 · 直达通勤 · 可预约',
    action: '预约班次',
    path: '/travel/custom-bus',
  },
  {
    icon: '📞', title: '移车求助',
    desc: '一键发起挪车通知，保护双方手机号隐私',
    action: '发起挪车',
    path: '/move-car',
  },
  {
    icon: 'ℹ️', title: '更多服务',
    desc: '更多便民服务持续接入中...',
    action: '敬请期待',
  },
];

const ServicesPage: React.FC = () => {
  const navigate = useNavigate();
  const [modal, setModal] = useState<ModalState>({ open: false, title: '', content: '' });

  const handleAction = (s: typeof SERVICES[0]) => {
    if (s.path) {
      navigate(s.path);
      return;
    }
    if (s.modal) {
      setModal({ open: true, title: s.title, content: s.modal });
      return;
    }
  };

  return (
    <div className={styles.page}>
      <div className="page-title">🧰 便民服务</div>
      <div className={styles.grid}>
        {SERVICES.map(s => (
          <div key={s.title} className={styles.card}>
            <div className={styles.cardIcon}>{s.icon}</div>
            <div className={styles.cardTitle}>{s.title}</div>
            <div className={styles.cardDesc}>{s.desc}</div>
            <button className={styles.cardBtn} onClick={() => handleAction(s)}>
              {s.action}
            </button>
          </div>
        ))}
      </div>

      {/* 服务说明对话框 */}
      {modal.open && (
        <div className={styles.overlay} onClick={() => setModal({ ...modal, open: false })}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{modal.title}</span>
              <span className={styles.modalClose} onClick={() => setModal({ ...modal, open: false })}>✕</span>
            </div>
            <div className={styles.modalContent}>
              {modal.content.split('\n').map((line, i) => (
                <p key={i} className={styles.modalLine}>{line}</p>
              ))}
            </div>
            <button className={styles.modalBtn} onClick={() => setModal({ ...modal, open: false })}>我知道了</button>
          </div>
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
};

export default ServicesPage;
