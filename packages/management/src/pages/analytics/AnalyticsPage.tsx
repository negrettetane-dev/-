import React, { useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  Button,
  Space,
  Table,
} from 'antd';
import {
  DownloadOutlined,
  BarChartOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const { RangePicker } = DatePicker;

// Mock data
const generateDailyTrend = () =>
  Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(5, 10),
    total: Math.floor(Math.random() * 30 + 10),
    resolved: Math.floor(Math.random() * 25 + 5),
  }));

const categoryData = [
  { name: '交通事故', value: 85 },
  { name: '道路施工', value: 42 },
  { name: '信号灯故障', value: 38 },
  { name: '交通拥堵', value: 65 },
  { name: '车辆故障', value: 30 },
  { name: '临时管制', value: 25 },
  { name: '路面塌陷', value: 12 },
  { name: '其他', value: 45 },
];

const districtHeatData = [
  { name: '朝阳区', value: 95 },
  { name: '海淀区', value: 83 },
  { name: '东城区', value: 78 },
  { name: '西城区', value: 72 },
  { name: '丰台区', value: 70 },
  { name: '石景山区', value: 62 },
  { name: '通州区', value: 55 },
  { name: '大兴区', value: 48 },
  { name: '昌平区', value: 38 },
  { name: '顺义区', value: 32 },
];

export default function AnalyticsPage() {
  const dailyTrend = useMemo(() => generateDailyTrend(), []);

  // Incident trend chart (line + bar combo)
  const trendChartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    legend: {
      data: ['事件总数', '已解决'],
      textStyle: { color: 'rgba(0,0,0,0.65)', fontSize: 12 },
    },
    grid: { left: 10, right: 10, top: 30, bottom: 10, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: dailyTrend.map((d) => d.date),
      axisLabel: { fontSize: 10, interval: 4 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10 },
    },
    series: [
      {
        name: '事件总数',
        type: 'bar',
        data: dailyTrend.map((d) => d.total),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#69b1ff' },
            { offset: 1, color: '#1677ff' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: 12,
      },
      {
        name: '已解决',
        type: 'line',
        data: dailyTrend.map((d) => d.resolved),
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2, color: '#52c41a' },
        itemStyle: { color: '#52c41a' },
      },
    ],
  }), [dailyTrend]);

  // Category pie chart
  const pieChartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} 件 ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 3,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold' },
        },
        data: categoryData,
        color: ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#bfbfbf'],
      },
    ],
  }), []);

  // District ranking horizontal bar
  const districtChartOption = useMemo(() => {
    const sorted = [...districtHeatData].sort((a, b) => b.value - a.value);
    return {
      backgroundColor: 'transparent',
      grid: { left: 70, right: 30, top: 5, bottom: 5, containLabel: false },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'value',
        axisLabel: { fontSize: 10 },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((d) => d.name),
        axisLabel: { fontSize: 11 },
        inverse: true,
      },
      series: [
        {
          type: 'bar',
          data: sorted.map((d) => ({
            value: d.value,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#69b1ff' },
                { offset: 1, color: '#0958d9' },
              ]),
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barWidth: 16,
          label: {
            show: true,
            position: 'right',
            fontSize: 11,
            color: 'rgba(0,0,0,0.65)',
          },
        },
      ],
    };
  }, []);

  return (
    <div className="content-page">
      <div className="page-header">
        <h2>
          <BarChartOutlined style={{ marginRight: 8 }} />
          数据分析
        </h2>
        <p className="page-desc">城市交通运行数据分析，支持趋势查看、分类统计和报表导出</p>
      </div>

      {/* Metric cards */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月事件总数"
              value={342}
              suffix="件"
              valueStyle={{ color: '#1677ff' }}
              prefix="📊"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均响应时间"
              value={12.5}
              suffix="分钟"
              precision={1}
              valueStyle={{ color: '#52c41a' }}
              prefix="⏱️"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="事件解决率"
              value={87.3}
              suffix="%"
              precision={1}
              valueStyle={{ color: '#52c41a' }}
              prefix="✅"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="市民满意度"
              value={4.2}
              suffix="/5"
              precision={1}
              valueStyle={{ color: '#faad14' }}
              prefix="⭐"
            />
          </Card>
        </Col>
      </Row>

      {/* Filter bar */}
      <div className="filter-bar">
        <RangePicker />
        <Button icon={<ReloadOutlined />}>刷新</Button>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          style={{ marginLeft: 'auto' }}
          onClick={() => alert('导出CSV（演示功能）')}
        >
          导出报表
        </Button>
      </div>

      {/* Charts row 1 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={14}>
          <Card title="事件趋势 (近30天)">
            <ReactEChartsCore
              echarts={echarts}
              option={trendChartOption}
              style={{ height: 320 }}
              notMerge
              lazyUpdate
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="事件分类分布">
            <ReactEChartsCore
              echarts={echarts}
              option={pieChartOption}
              style={{ height: 320 }}
              notMerge
              lazyUpdate
            />
          </Card>
        </Col>
      </Row>

      {/* Charts row 2 */}
      <Row gutter={16}>
        <Col span={14}>
          <Card title="各城区事件分布">
            <ReactEChartsCore
              echarts={echarts}
              option={districtChartOption}
              style={{ height: 300 }}
              notMerge
              lazyUpdate
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="响应时间分布">
            <Table
              dataSource={[
                { range: '≤5分钟', count: 45, pct: '13.2%', color: '#52c41a' },
                { range: '5-15分钟', count: 128, pct: '37.4%', color: '#1677ff' },
                { range: '15-30分钟', count: 98, pct: '28.7%', color: '#faad14' },
                { range: '30-60分钟', count: 45, pct: '13.2%', color: '#ff7a00' },
                { range: '>60分钟', count: 26, pct: '7.6%', color: '#f5222d' },
              ]}
              columns={[
                { title: '响应区间', dataIndex: 'range', key: 'range' },
                { title: '事件数', dataIndex: 'count', key: 'count' },
                {
                  title: '占比',
                  dataIndex: 'pct',
                  key: 'pct',
                  render: (pct: string, record: { color: string }) => (
                    <span style={{ color: record.color, fontWeight: 600 }}>{pct}</span>
                  ),
                },
              ]}
              pagination={false}
              size="small"
              rowKey="range"
            />
            <div style={{ marginTop: 16, textAlign: 'center', color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
              平均响应时间: <b style={{ color: '#1677ff' }}>12.5 分钟</b>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
