import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, DatePicker, Empty, message, Row, Spin, Statistic } from 'antd';
import { BarChartOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { analyticsService, type AnalyticsDistributionItem, type AnalyticsSummary, type AnalyticsTrendPoint } from '../../services/analyticsService';
import { dashboardService, type DistrictCongestionData } from '../../services/dashboardService';

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const { RangePicker } = DatePicker;

function downloadCsv(rows: AnalyticsTrendPoint[]) {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const content = ['日期,事件总数,已解决', ...rows.map(row => [row.date, row.total, row.resolved].map(escape).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `交通事件趋势-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [trend, setTrend] = useState<AnalyticsTrendPoint[]>([]);
  const [categories, setCategories] = useState<AnalyticsDistributionItem[]>([]);
  const [districts, setDistricts] = useState<DistrictCongestionData[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    const params = dateRange ? { startDate: dateRange[0], endDate: dateRange[1] } : undefined;
    try {
      const [nextTrend, nextCategories, nextSummary, nextDistricts] = await Promise.all([
        analyticsService.getTrend(params), analyticsService.getCategoryDistribution(params), analyticsService.getSummary(params), dashboardService.getDistrictCongestion(),
      ]);
      setTrend(Array.isArray(nextTrend) ? nextTrend : []);
      setCategories(Array.isArray(nextCategories) ? nextCategories : []);
      setSummary(nextSummary || null);
      setDistricts(Array.isArray(nextDistricts) ? nextDistricts : []);
    } catch (error) {
      setTrend([]); setCategories([]); setDistricts([]); setSummary(null);
      message.error(error instanceof Error ? error.message : '统计数据加载失败');
    } finally { setLoading(false); }
  }, [dateRange]);

  useEffect(() => { void loadAnalytics(); }, [loadAnalytics]);

  const trendChartOption = useMemo(() => ({
    backgroundColor: 'transparent', legend: { data: ['事件总数', '已解决'], textStyle: { color: 'rgba(0,0,0,0.65)', fontSize: 12 } },
    grid: { left: 10, right: 10, top: 30, bottom: 10, containLabel: true }, tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: trend.map(item => item.date), axisLabel: { fontSize: 10, interval: 4 } }, yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
    series: [
      { name: '事件总数', type: 'bar', data: trend.map(item => item.total), itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] }, barWidth: 12 },
      { name: '已解决', type: 'line', data: trend.map(item => item.resolved), smooth: true, symbol: 'circle', symbolSize: 4, lineStyle: { width: 2, color: '#52c41a' }, itemStyle: { color: '#52c41a' } },
    ],
  }), [trend]);

  const pieChartOption = useMemo(() => ({
    backgroundColor: 'transparent', tooltip: { trigger: 'item', formatter: '{b}: {c} 件 ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    series: [{ type: 'pie', radius: ['45%', '75%'], center: ['35%', '50%'], avoidLabelOverlap: false, itemStyle: { borderRadius: 3, borderColor: '#fff', borderWidth: 2 }, label: { show: false }, emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } }, data: categories, color: ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#bfbfbf'] }],
  }), [categories]);

  const districtChartOption = useMemo(() => {
    const sorted = [...districts].sort((a, b) => b.index - a.index);
    return {
      backgroundColor: 'transparent', grid: { left: 70, right: 30, top: 5, bottom: 5, containLabel: false }, tooltip: { trigger: 'axis' },
      xAxis: { type: 'value', axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: '#f0f0f0' } } }, yAxis: { type: 'category', data: sorted.map(item => item.district), axisLabel: { fontSize: 11 }, inverse: true },
      series: [{ type: 'bar', data: sorted.map(item => ({ value: item.index, itemStyle: { color: '#1677ff', borderRadius: [0, 4, 4, 0] } })), barWidth: 16, label: { show: true, position: 'right', fontSize: 11, color: 'rgba(0,0,0,0.65)' } }],
    };
  }, [districts]);

  return <div className="content-page">
    <div className="page-header"><h2><BarChartOutlined style={{ marginRight: 8 }} />数据分析</h2><p className="page-desc">统计结果由管理端 API 返回，可按时间范围筛选并导出趋势明细。</p></div>
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col span={6}><Card><Statistic title="事件总数" value={summary?.totalIncidents ?? '-'} suffix="件" valueStyle={{ color: '#1677ff' }} prefix="📊" /></Card></Col>
      <Col span={6}><Card><Statistic title="平均响应时间" value={summary?.avgResponseTime ?? '-'} suffix="分钟" precision={1} valueStyle={{ color: '#52c41a' }} prefix="⏱" /></Card></Col>
      <Col span={6}><Card><Statistic title="事件解决率" value={summary?.resolutionRate ?? '-'} suffix="%" precision={1} valueStyle={{ color: '#52c41a' }} prefix="✓" /></Card></Col>
      <Col span={6}><Card><Statistic title="市民满意度" value={summary?.citizenSatisfaction ?? '-'} suffix="/5" precision={1} valueStyle={{ color: '#faad14' }} prefix="★" /></Card></Col>
    </Row>
    <div className="filter-bar"><RangePicker onChange={dates => setDateRange(dates ? [dates[0]!.format('YYYY-MM-DD'), dates[1]!.format('YYYY-MM-DD')] : null)} /><Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadAnalytics()}>刷新</Button><Button type="primary" icon={<DownloadOutlined />} style={{ marginLeft: 'auto' }} disabled={!trend.length} onClick={() => downloadCsv(trend)}>导出 CSV</Button></div>
    <Spin spinning={loading}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={14}><Card title="事件趋势"><ReactEChartsCore echarts={echarts} option={trendChartOption} style={{ height: 320 }} notMerge lazyUpdate /></Card></Col>
        <Col span={10}><Card title="事件分类分布">{categories.length ? <ReactEChartsCore echarts={echarts} option={pieChartOption} style={{ height: 320 }} notMerge lazyUpdate /> : <Empty style={{ height: 320, display: 'grid', placeItems: 'center' }} description="暂无分类数据" />}</Card></Col>
      </Row>
      <Row gutter={16}><Col span={14}><Card title="各城区拥堵指数">{districts.length ? <ReactEChartsCore echarts={echarts} option={districtChartOption} style={{ height: 300 }} notMerge lazyUpdate /> : <Empty style={{ height: 300, display: 'grid', placeItems: 'center' }} description="暂无城区数据" />}</Card></Col></Row>
    </Spin>
  </div>;
}
