import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAMap } from '../../lib/amap';
import { useNavigationStore } from '../../stores/navigationStore';
import { useTripStore } from '../../stores/tripStore';
import { useAuthStore } from '../../stores/authStore';

const MODE_LABEL: Record<string, string> = { transit: '公交', driving: '驾车', walking: '步行' };

/** 长辈导航页：使用已规划好的真实 route.path 沿路移动，不做二次规划、不生成模拟路线 */
const ElderlyNavigationPage: React.FC = () => {
  const navigate = useNavigate();
  const context = useNavigationStore(s => s.context);
  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const carMarkerRef = useRef<any>(null);
  const moveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pathIdxRef = useRef(0);
  const [navDistance, setNavDistance] = useState(0);
  const [arrived, setArrived] = useState(false);
  const tripCompletedRef = useRef(false);

  useEffect(() => {
    // 最终一道防线：route.mode 必须与请求模式匹配（transit 绝不能用 driving path 冒充）
    if (!context || context.route.mode !== context.routeMode) return;
    const { route } = context;
    const path = route.path || [];
    setNavDistance(route.distance || 0);
    let disposed = false;

    loadAMap()
      .then(AMap => {
        if (disposed || !mapContainerRef.current || path.length < 2) return;
        const map = new AMap.Map(mapContainerRef.current, { zoom: 15, viewMode: '3D', pitch: 0, rotation: 0, resizeEnable: true });
        mapRef.current = map;

        const start = path[0];
        const end = path[path.length - 1];
        // 起点（绿）/ 终点（红）
        map.add(new AMap.Marker({ position: start, anchor: 'center', icon: new AMap.Icon({ size: new AMap.Size(18, 18), image: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="#52c41a" stroke="#fff" stroke-width="2"/></svg>') }) }));
        map.add(new AMap.Marker({ position: end, anchor: 'center', icon: new AMap.Icon({ size: new AMap.Size(18, 18), image: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="#f5222d" stroke="#fff" stroke-width="2"/></svg>') }) }));

        // 路线
        const polyline = new AMap.Polyline({ path, strokeColor: '#1677ff', strokeWeight: 8, lineJoin: 'round', lineCap: 'round' });
        map.add(polyline);
        map.setFitView([polyline], false, [70, 70, 70, 70]);

        // 车辆
        const carMarker = new AMap.Marker({
          position: start, anchor: 'center',
          icon: new AMap.Icon({ size: new AMap.Size(36, 36), image: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="16" fill="#1677ff" stroke="#fff" stroke-width="3"/><text x="18" y="25" text-anchor="middle" fill="#fff" font-size="18">${MODE_LABEL[context.displayMode] === '公交' ? '🚌' : MODE_LABEL[context.displayMode] === '驾车' ? '🚗' : '🚶'}</text></svg>`) }),
        });
        map.add(carMarker);
        carMarkerRef.current = carMarker;

        // 车辆沿真实 path 移动
        pathIdxRef.current = 0;
        const timer = setInterval(() => {
          const idx = pathIdxRef.current;
          if (!carMarkerRef.current) return;
          if (idx >= path.length - 1) {
            clearInterval(timer);
            moveTimerRef.current = null;
            setNavDistance(0);
            if (!tripCompletedRef.current) {
              tripCompletedRef.current = true;
              setArrived(true);
              if (isLoggedIn) void useTripStore.getState().completeActiveTrip().catch(() => undefined);
            }
            return;
          }
          pathIdxRef.current += 1;
          const next = path[pathIdxRef.current];
          carMarkerRef.current.setPosition(next);
          map.setCenter(next);
          setNavDistance(d => Math.max(0, d - ((route.distance || 0) / path.length)));
        }, 150);
        moveTimerRef.current = timer;

        // 登录用户：创建出行记录（真实 path）
        if (isLoggedIn) {
          const { origin, destination, routeMode } = context;
          const clientSessionId = typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `elderly_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          void useTripStore.getState().startTrip({
            clientSessionId,
            mode: routeMode,
            profile: 'standard',
            origin: { name: origin.name, address: origin.address, lng: origin.lng!, lat: origin.lat! },
            destination: { name: destination.name, address: destination.address, lng: destination.lng!, lat: destination.lat! },
            routeSnapshot: { estimatedDistance: route.distance || 0, estimatedDuration: route.duration || 0, routeProvider: 'amap', path },
            dataSource: 'real',
          }).catch(() => undefined);
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (moveTimerRef.current) clearInterval(moveTimerRef.current);
      moveTimerRef.current = null;
      if (mapRef.current) mapRef.current.destroy();
      mapRef.current = null;
      carMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  const endNavigation = () => {
    if (moveTimerRef.current) clearInterval(moveTimerRef.current);
    moveTimerRef.current = null;
    // 未到达即结束 → 出行记录标取消；已到达由 complete 处理
    if (!arrived && useTripStore.getState().activeTrip) {
      void useTripStore.getState().cancelActiveTrip().catch(() => undefined);
    }
    useNavigationStore.getState().clearContext();
    navigate('/elderly');
  };

  if (!context) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, minHeight: '100vh', padding: 24, background: '#f7f8fa' }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>未找到导航信息</div>
        <button onClick={() => navigate('/elderly')} style={{ padding: '14px 28px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 12, fontSize: 18 }}>返回长辈首页</button>
      </div>
    );
  }
  // 最终一道防线：路线类型与请求模式不匹配时拒绝进入导航
  if (context.route.mode !== context.routeMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, minHeight: '100vh', padding: 24, background: '#f7f8fa' }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>当前公交路线数据无效，请重新规划。</div>
        <button onClick={() => navigate('/elderly')} style={{ padding: '14px 28px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 12, fontSize: 18 }}>返回长辈首页</button>
      </div>
    );
  }

  const { origin, destination, displayMode, route } = context;
  const modeLabel = MODE_LABEL[displayMode] || '出行';
  const etaMin = Math.max(1, Math.round((route.duration || 0) / 60));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#0a1628' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* 顶部：模式 + 结束导航 */}
      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{modeLabel}导航 · 长辈模式</span>
        <button onClick={endNavigation} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '10px 18px', borderRadius: 20, fontSize: 16 }}>✕ 结束</button>
      </div>

      {/* 底部信息卡 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 24px 30px', zIndex: 10 }}>
        {arrived ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52 }}>✅</div>
            <div style={{ fontSize: 28, fontWeight: 700, margin: '8px 0' }}>已到达目的地</div>
            <div style={{ fontSize: 20, marginBottom: 14 }}>您已到达：{destination.name}</div>
            <button onClick={endNavigation} style={{ width: '100%', padding: 18, background: '#52c41a', color: '#fff', border: 'none', borderRadius: 14, fontSize: 22, fontWeight: 700 }}>✅ 完成导航</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 36 }}>📍</span>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>前往 {destination.name}</div>
                <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{origin.name} → {destination.name}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', margin: '18px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 34, fontWeight: 700 }}>{(navDistance / 1000).toFixed(1)}</div>
                <div style={{ fontSize: 15, color: 'var(--text-hint)' }}>剩余 km</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 34, fontWeight: 700 }}>{etaMin}</div>
                <div style={{ fontSize: 15, color: 'var(--text-hint)' }}>预计分钟</div>
              </div>
            </div>
            <button onClick={endNavigation} style={{ width: '100%', padding: 18, background: '#f5222d', color: '#fff', border: 'none', borderRadius: 14, fontSize: 22, fontWeight: 700 }}>🛑 结束导航</button>
          </>
        )}
      </div>
    </div>
  );
};

export default ElderlyNavigationPage;
