import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CustomBus.module.css';

const ROUTES = [
  { id: 'cb-001', from: '回龙观', to: '中关村', departTime: '07:30', arriveTime: '08:30', price: 8, seats: 12, type: '早高峰通勤' },
  { id: 'cb-002', from: '天通苑', to: '国贸CBD', departTime: '07:00', arriveTime: '08:15', price: 12, seats: 5, type: '早高峰通勤' },
  { id: 'cb-003', from: '通州北苑', to: '建国门', departTime: '07:15', arriveTime: '08:10', price: 10, seats: 18, type: '早高峰通勤' },
  { id: 'cb-004', from: '中关村', to: '回龙观', departTime: '18:00', arriveTime: '18:55', price: 8, seats: 20, type: '晚高峰通勤' },
  { id: 'cb-005', from: '国贸CBD', to: '天通苑', departTime: '18:30', arriveTime: '19:40', price: 12, seats: 3, type: '晚高峰通勤' },
  { id: 'cb-006', from: '亦庄', to: '西二旗', departTime: '07:45', arriveTime: '09:00', price: 15, seats: 8, type: '跨区通勤' },
];

const CustomBusPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [passengers, setPassengers] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const route = ROUTES.find(r => r.id === selectedRoute);

  const handleBook = () => {
    if (!route) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>🎫</div>
          <div className={styles.successTitle}>预约成功！</div>
          <div className={styles.successInfo}>
            <div>{route?.from} → {route?.to}</div>
            <div>发车时间：{route?.departTime} · {passengers}人</div>
            <div>预计费用：¥{(route?.price || 0) * passengers}</div>
          </div>
          <div className={styles.successNote}>
            📱 预约信息已发送至您的手机，请提前5分钟到达上车点。<br />
            🚌 一人一座，保证有座，无需换乘。
          </div>
          <button className={styles.backBtn} onClick={() => navigate('/travel')}>
            返回出行规划
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.back} onClick={() => navigate(-1)}>← 返回</span>
        <span className={styles.title}>🚌 定制公交预约</span>
      </div>

      <div className={styles.intro}>
        <div className={styles.introIcon}>💡</div>
        <div className={styles.introText}>
          <b>一人一座 · 直达通勤 · 准时发车</b><br />
          通勤距离超过15km？告别换乘拥挤，预约你的专属通勤班车。
        </div>
      </div>

      {/* Route Cards */}
      <div className={styles.routeList}>
        {ROUTES.map(r => (
          <div
            key={r.id}
            className={`${styles.routeCard} ${selectedRoute === r.id ? styles.routeActive : ''}`}
            onClick={() => setSelectedRoute(r.id)}
          >
            <div className={styles.routeHeader}>
              <span className={styles.routeTag}>{r.type}</span>
              <span className={styles.routeSeats}>🪑 余{r.seats}座</span>
            </div>
            <div className={styles.routeStations}>
              <span className={styles.routeFrom}>{r.from}</span>
              <span className={styles.routeArrow}>→</span>
              <span className={styles.routeTo}>{r.to}</span>
            </div>
            <div className={styles.routeMeta}>
              <span>🕐 {r.departTime} - {r.arriveTime}</span>
              <span>💰 ¥{r.price}/人</span>
            </div>
            {r.seats <= 5 && <div className={styles.seatsLow}>⚠️ 仅剩{r.seats}座，请尽快预约</div>}
          </div>
        ))}
      </div>

      {/* Booking Form */}
      {route && (
        <div className={styles.bookForm}>
          <div className={styles.bookTitle}>📋 确认预约信息</div>
          <div className={styles.bookRow}>
            <span className={styles.bookLabel}>线路</span>
            <span className={styles.bookVal}>{route.from} → {route.to}</span>
          </div>
          <div className={styles.bookRow}>
            <span className={styles.bookLabel}>发车</span>
            <span className={styles.bookVal}>工作日 {route.departTime}</span>
          </div>
          <div className={styles.bookRow}>
            <span className={styles.bookLabel}>人数</span>
            <div className={styles.paxPicker}>
              <button className={styles.paxBtn} onClick={() => setPassengers(Math.max(1, passengers - 1))}>−</button>
              <span className={styles.paxNum}>{passengers}</span>
              <button className={styles.paxBtn} onClick={() => setPassengers(Math.min(5, passengers + 1))}>+</button>
            </div>
          </div>
          <div className={styles.bookRow}>
            <span className={styles.bookLabel}>费用</span>
            <span className={styles.bookPrice}>¥{route.price * passengers}</span>
          </div>
          <button className={styles.bookBtn} onClick={handleBook}>
            ✅ 确认预约 · ¥{route.price * passengers}
          </button>
        </div>
      )}

      <div style={{ height: 32 }} />
    </div>
  );
};

export default CustomBusPage;
