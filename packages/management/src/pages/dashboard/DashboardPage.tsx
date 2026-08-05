import React, { useEffect, useRef, useMemo, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useDashboardStore } from '../../stores/dashboardStore';
import { CONGESTION_LABELS } from '@zhitu/shared';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, CanvasRenderer]);

const TEXT_SECONDARY = 'rgba(255,255,255,0.55)';
const TEXT_MUTED = 'rgba(255,255,255,0.40)';
const GRIDLINE = 'rgba(255,255,255,0.06)';
const CAT_SLOTS = ['#3987e5','#d95926','#199e70','#c98500','#d55181','#008300','#9085e9','#e66767'];

// AI 检测预警类型 → 图标
const AI_ALERT_ICONS: Record<string, string> = {
  '交通事故': '🚨', '异常停车': '🅿️', '逆行车辆': '↩️', '行人闯入': '🚸',
  '交通拥堵': '🚧', '路面异常': '🕳️', '抛洒物': '📦', '信号灯异常': '🚦',
};

export default function DashboardPage() {
  const { metrics, hourlyData, districtData, roadSegments, aiAlerts, loading, fetchAll, tick } = useDashboardStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const amapContainerRef = useRef<HTMLDivElement>(null);
  const amapRef = useRef<any>(null);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => tick(), 5000); return () => clearInterval(t); }, [tick]);

  // Real AMap
  useEffect(() => {
    if (!amapContainerRef.current || amapRef.current) return;
    import('@amap/amap-jsapi-loader').then(mod => {
      mod.default.load({
        key: import.meta.env.VITE_AMAP_KEY || '',
        version: '2.0',
        plugins: ['AMap.TileLayer.Traffic'],
      }).then((AMap: any) => {
        if (!amapContainerRef.current || amapRef.current) return;
        const map = new AMap.Map(amapContainerRef.current, {
          zoom: 13, center: [116.40, 39.90],
          viewMode: '2D',
          resizeEnable: true,
        });
        map.add(new AMap.TileLayer.Traffic({ zIndex: 10 }));
        amapRef.current = map;
      }).catch((e: unknown) => console.error('AMap load error:', e));
    });
    return () => {
      if (amapRef.current) { amapRef.current.destroy(); amapRef.current = null; }
    };
  }, []);

  const formatDate = (d: Date) => {
    const days = ['日','一','二','三','四','五','六'];
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 星期${days[d.getDay()]}`;
  };
  const formatTime = (d: Date) => d.toLocaleTimeString('zh-CN', { hour12: false });

  const districtChartOption = useMemo(() => {
    const sorted = [...districtData].sort((a,b) => b.index - a.index);
    return {
      backgroundColor: 'transparent',
      grid: { left:80, right:40, top:10, bottom:5, containLabel:false },
      tooltip: { trigger:'axis', backgroundColor:'rgba(16,30,60,0.95)', borderColor:'rgba(22,119,255,0.3)', textStyle:{color:'#fff',fontSize:12} },
      xAxis: { type:'value', axisLine:{lineStyle:{color:GRIDLINE}}, axisTick:{show:false}, splitLine:{lineStyle:{color:GRIDLINE}}, axisLabel:{color:TEXT_MUTED,fontSize:10}, max:Math.ceil(Math.max(...sorted.map(d=>d.index))+1) },
      yAxis: { type:'category', data:sorted.map(d=>d.district), axisLine:{show:false}, axisTick:{show:false}, axisLabel:{color:TEXT_SECONDARY,fontSize:11}, inverse:true },
      series:[{ type:'bar', barWidth:14, data:sorted.map(d=>({value:d.index,itemStyle:{color:new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#3987e5'},{offset:0.6,color:'#d95926'},{offset:1,color:'#e66767'}]),borderRadius:[0,3,3,0]}})), label:{show:true,position:'right',color:TEXT_SECONDARY,fontSize:10,formatter:(p:{value:number})=>p.value.toFixed(1)} }],
    };
  }, [districtData]);

  const hourlyChartOption = useMemo(() => ({
    backgroundColor:'transparent',
    legend:{data:['实时车辆数','拥堵指数'],textStyle:{color:TEXT_SECONDARY,fontSize:11},top:0},
    grid:{left:10,right:60,top:30,bottom:10,containLabel:true},
    tooltip:{trigger:'axis',backgroundColor:'rgba(16,30,60,0.95)',borderColor:'rgba(22,119,255,0.3)',textStyle:{color:'#fff',fontSize:12}},
    xAxis:{type:'category',data:hourlyData.map(d=>`${d.hour}:00`),axisLine:{lineStyle:{color:GRIDLINE}},axisTick:{show:false},axisLabel:{color:TEXT_MUTED,fontSize:10,interval:3}},
    yAxis:[{type:'value',name:'车辆数',nameTextStyle:{color:TEXT_MUTED,fontSize:10},axisLabel:{color:TEXT_MUTED,fontSize:10,formatter:(v:number)=>`${(v/1000).toFixed(0)}k`},splitLine:{lineStyle:{color:GRIDLINE}}},{type:'value',name:'拥堵指数',nameTextStyle:{color:TEXT_MUTED,fontSize:10},axisLabel:{color:TEXT_MUTED,fontSize:10},splitLine:{show:false}}],
    series:[{name:'实时车辆数',type:'line',data:hourlyData.map(d=>d.activeVehicles),smooth:true,symbol:'none',lineStyle:{width:2,color:CAT_SLOTS[0]},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(57,135,229,0.4)'},{offset:1,color:'rgba(57,135,229,0.02)'}])}},{name:'拥堵指数',type:'line',yAxisIndex:1,data:hourlyData.map(d=>d.congestionIndex),smooth:true,symbol:'none',lineStyle:{width:2,color:CAT_SLOTS[1],type:'dashed' as const}}],
  }), [hourlyData]);

  const sparklineOption = useMemo(() => {
    const d = hourlyData.filter((_,i) => i%3===0).map(dd=>dd.congestionIndex);
    return { backgroundColor:'transparent', grid:{left:0,right:0,top:3,bottom:3}, xAxis:{show:false,data:d.map((_,i)=>i)}, yAxis:{show:false,min:0,max:Math.max(...d)+1}, series:[{type:'line',data:d,smooth:true,symbol:'none',lineStyle:{width:1.5,color:'#3987e5'},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(57,135,229,0.35)'},{offset:1,color:'rgba(57,135,229,0.02)'}])}}] };
  }, [hourlyData]);

  const deviceStatus = useMemo(()=>({cameras:{online:28,total:30},radars:{online:8,total:10},geomagnetic:{online:45,total:50},rsu:{online:4,total:5}}),[]);
  const topCongested = useMemo(()=>[...roadSegments].sort((a,b)=>b.travelTimeIndex-a.travelTimeIndex).slice(0,5),[roadSegments]);

  if (loading && !metrics) return <div className="dashboard-page flex-center" style={{color:TEXT_SECONDARY}}>加载中...</div>;

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="title">智途云枢 · 城市交通智慧管理平台</div>
        <div className="clock">{formatTime(currentTime)}</div>
        <div className="date-info"><div>{formatDate(currentTime)}</div><div>北京 · 多云 28°C | 空气质量 良</div></div>
      </div>

      <div className="dashboard-row" style={{flex:'0 0 38%'}}>
        <div className="dashboard-panel" style={{width:'28%'}}>
          <div className="panel-title">📊 核心指标</div>
          <div className="stat-cards-grid">
            {[{icon:'🚗',label:'实时车辆数',value:metrics?(metrics.activeVehicles/10000).toFixed(1)+'万':'-',trend:'↑ +3.2%',color:'#fff'},
              {icon:'🚦',label:'拥堵路段',value:metrics?String(metrics.congestedRoadCount):'-',trend:'↓ -2条',color:'#f5222d'},
              {icon:'⚠️',label:'活跃事件',value:metrics?String(metrics.incidentCount):'-',trend:'↑ +1',color:'#f5222d'},
              {icon:'📡',label:'设备在线率',value:metrics?String(metrics.deviceOnlineRate)+'%':'-',trend:'↑ +0.3%',color:'#52c41a'}].map((s,i)=>(
              <div key={i} className="stat-card">
                <div className="stat-icon">{s.icon}</div>
                <div className="stat-value" style={{color:s.color}}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
                <div className={`stat-trend ${s.trend.startsWith('↑')?'up':'down'}`}><span>{s.trend.charAt(0)}</span> {s.trend.slice(2)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-panel" style={{width:'40%'}}>
          <div className="panel-title">🗺️ 城市交通态势地图</div>
          <div className="city-map-container" ref={amapContainerRef} />
        </div>

        <div className="dashboard-panel" style={{width:'32%',gap:10}}>
          <div style={{flex:'0 0 auto'}}>
            <div className="panel-title">🤖 AI实时检测预警</div>
            <div className="ai-alert-list">
              {aiAlerts.slice(0,6).map(a=>(
                <div key={a.id} className="ai-alert-item">
                  <div className="ai-alert-row">
                    <span className="alert-type">{AI_ALERT_ICONS[a.type] || '⚠️'} {a.type}</span>
                    <span className="alert-confidence">置信度 {Math.round(a.confidence*100)}%</span>
                    <span className="alert-time">{new Date(a.time).toLocaleTimeString('zh-CN',{hour12:false})}</span>
                  </div>
                  <div className="alert-location" title={`${a.location} · ${a.description}`}>{a.location} · {a.description}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{flex:1,minHeight:0}}>
            <div className="panel-title">🏅 拥堵路段排行 TOP5</div>
            <div style={{overflowY:'auto',flex:1}}>
              {topCongested.map((r,i)=>(
                <div key={r.id} className="congestion-rank-item">
                  <span className={`rank-num ${i<3?`top${i+1}`:''}`}>{i+1}</span>
                  <span className="road-name" title={r.name}>{r.name}</span>
                  <span style={{fontSize:12,color:TEXT_MUTED,width:50,textAlign:'right'}}>{CONGESTION_LABELS[r.congestionLevel]}</span>
                  <span className="congestion-index">{r.travelTimeIndex.toFixed(1)}x</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-row" style={{flex:'0 0 33%'}}>
        <div className="dashboard-panel" style={{width:'50%'}}>
          <div className="panel-title">📈 24小时交通流量趋势</div>
          <div className="dashboard-chart-container">
            {hourlyData.length>0 && <ReactEChartsCore echarts={echarts} option={hourlyChartOption} style={{height:'100%',width:'100%'}} notMerge lazyUpdate/>}
          </div>
        </div>
        <div className="dashboard-panel" style={{width:'50%'}}>
          <div className="panel-title">📊 各城区拥堵指数对比</div>
          <div className="dashboard-chart-container">
            {districtData.length>0 && <ReactEChartsCore echarts={echarts} option={districtChartOption} style={{height:'100%',width:'100%'}} notMerge lazyUpdate/>}
          </div>
        </div>
      </div>

      <div className="dashboard-row" style={{flex:'0 0 auto',height:72}}>
        <div className="device-status-bar" style={{width:'70%',display:'flex',alignItems:'center',justifyContent:'space-around'}}>
          {[{icon:'📷',label:'摄像头',o:deviceStatus.cameras.online,t:deviceStatus.cameras.total},{icon:'📡',label:'雷达',o:deviceStatus.radars.online,t:deviceStatus.radars.total},{icon:'🔄',label:'地磁传感器',o:deviceStatus.geomagnetic.online,t:deviceStatus.geomagnetic.total},{icon:'🛰️',label:'RSU路侧单元',o:deviceStatus.rsu.online,t:deviceStatus.rsu.total},{icon:'🚦',label:'信号机',o:11,t:12}].map((d,i)=>(
            <div key={i} className="device-status-item">
              <span>{d.icon}</span> {d.label}
              <span className="dot online"/><b style={{color:'#52c41a'}}>{d.o}</b>
              <span style={{color:TEXT_MUTED}}>/ {d.t}</span>
            </div>
          ))}
        </div>
        <div className="dashboard-panel" style={{width:'30%',flexDirection:'row',alignItems:'center',gap:12}}>
          <div style={{flexShrink:0}}>
            <div style={{fontSize:12,color:TEXT_MUTED}}>拥堵趋势</div>
            <div style={{fontSize:20,fontWeight:700,color:'#fff'}}>{metrics?.congestionIndex?.toFixed(1)??'-'}</div>
            <div style={{fontSize:11,color:'#52c41a'}}>↓ 0.3 较昨日</div>
          </div>
          <div style={{flex:1,height:48,minWidth:0}}>
            {hourlyData.length>0 && <ReactEChartsCore echarts={echarts} option={sparklineOption} style={{height:'100%',width:'100%'}} notMerge lazyUpdate/>}
          </div>
        </div>
      </div>
    </div>
  );
}
