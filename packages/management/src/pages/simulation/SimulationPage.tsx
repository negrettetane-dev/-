import React, { useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Select,
  Button,
  Slider,
  Radio,
  Space,
  Progress,
  Row,
  Col,
  Statistic,
  Tag,
  Descriptions,
  Typography,
  Empty,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { useSimulationStore } from '../../stores/simulationStore';

const { Title, Text } = Typography;

// ===== Animated road network for simulation =====
function SimulationCanvas({ running }: { running: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    interface Dot {
      x: number;
      y: number;
      speed: number;
      color: string;
      roadIdx: number;
      progress: number;
    }

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const w = rect.width;
    const h = rect.height;

    // Roads (6 horizontal, 5 vertical)
    const roads = [
      { x1: 40, y1: 40, x2: w - 40, y2: 40 },
      { x1: 40, y1: 90, x2: w - 40, y2: 90 },
      { x1: 40, y1: 140, x2: w - 40, y2: 140 },
      { x1: 40, y1: 190, x2: w - 40, y2: 190 },
      { x1: 40, y1: 240, x2: w - 40, y2: 240 },
      { x1: 40, y1: 290, x2: w - 40, y2: 290 },
      { x1: 40, y1: 40, x2: 40, y2: h - 40 },
      { x1: w * 0.3, y1: 40, x2: w * 0.3, y2: h - 40 },
      { x1: w * 0.5, y1: 40, x2: w * 0.5, y2: h - 40 },
      { x1: w * 0.7, y1: 40, x2: w * 0.7, y2: h - 40 },
      { x1: w - 40, y1: 40, x2: w - 40, y2: h - 40 },
    ];

    let dots: Dot[] = roads.map((road, idx) => ({
      x: road.x1,
      y: road.y1,
      speed: 0.5 + Math.random() * 2.5,
      color: ['#52c41a', '#52c41a', '#fadb14', '#fadb14', '#ff7a00', '#ff7a00', '#f5222d', '#52c41a', '#fadb14', '#ff7a00', '#52c41a'][idx],
      roadIdx: idx,
      progress: Math.random(),
    }));

    // Add more dots
    for (let i = 0; i < 40; i++) {
      const ri = i % roads.length;
      const road = roads[ri];
      dots.push({
        x: road.x1,
        y: road.y1,
        speed: 0.5 + Math.random() * 2.5,
        color: ['#52c41a', '#fadb14', '#ff7a00', '#f5222d'][i % 4],
        roadIdx: ri,
        progress: Math.random(),
      });
    }

    let stopped = false;
    let frameId: number;

    const draw = () => {
      if (stopped) return;

      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = 'rgba(10,22,40,0.8)';
      ctx.fillRect(0, 0, w, h);

      // Draw roads
      roads.forEach((road, idx) => {
        const colors = ['#52c41a', '#52c41a', '#fadb14', '#ff7a00', '#52c41a', '#f5222d', '#52c41a', '#fadb14', '#52c41a', '#ff7a00', '#52c41a'];
        ctx.strokeStyle = colors[idx];
        ctx.lineWidth = 3;
        ctx.shadowBlur = 4;
        ctx.shadowColor = colors[idx];
        ctx.beginPath();
        ctx.moveTo(road.x1, road.y1);
        ctx.lineTo(road.x2, road.y2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // Draw intersections (where h/v roads cross)
      const hRoads = roads.slice(0, 6);
      const vRoads = roads.slice(6);
      hRoads.forEach((hr) => {
        vRoads.forEach((vr) => {
          const ix = vr.x1;
          const iy = hr.y1;
          // Check if intersection exists
          if (ix >= hr.x1 && ix <= hr.x2 && iy >= vr.y1 && iy <= vr.y2) {
            ctx.beginPath();
            ctx.arc(ix, iy, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(22,119,255,0.6)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(22,119,255,0.8)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      // Draw dots
      if (running) {
        dots.forEach((dot) => {
          dot.progress += dot.speed * 0.003;
          if (dot.progress > 1) dot.progress -= 1;
          const road = roads[dot.roadIdx];
          dot.x = road.x1 + (road.x2 - road.x1) * dot.progress;
          dot.y = road.y1 + (road.y2 - road.y1) * dot.progress;

          ctx.beginPath();
          ctx.arc(dot.x, dot.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = dot.color;
          ctx.fill();
          ctx.shadowBlur = 3;
          ctx.shadowColor = dot.color;
        });
        ctx.shadowBlur = 0;
      } else {
        // Static snapshot
        dots.slice(0, 30).forEach((dot) => {
          const road = roads[dot.roadIdx];
          dot.x = road.x1 + (road.x2 - road.x1) * dot.progress;
          dot.y = road.y1 + (road.y2 - road.y1) * dot.progress;
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = dot.color;
          ctx.fill();
        });
      }

      // Legend
      const ly = h - 20;
      [
        { color: '#52c41a', label: '畅通' },
        { color: '#fadb14', label: '缓行' },
        { color: '#ff7a00', label: '拥堵' },
        { color: '#f5222d', label: '严重' },
      ].forEach((item, i) => {
        ctx.fillStyle = item.color;
        ctx.fillRect(15 + i * 80, ly, 12, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px sans-serif';
        ctx.fillText(item.label, 31 + i * 80, ly + 6);
      });

      frameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
    };
  }, [running]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', borderRadius: 6 }}
    />
  );
}

export default function SimulationPage() {
  const {
    scenarios,
    selectedScenario,
    status,
    results,
    progress,
    fetchScenarios,
    selectScenario,
    start,
    pause,
    resume,
    stop,
    resetResults,
  } = useSimulationStore();

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isDone = status === 'completed';

  return (
    <div className="content-page">
      <div className="page-header">
        <h2>
          <ExperimentOutlined style={{ marginRight: 8 }} />
          仿真推演
        </h2>
        <p className="page-desc">通过交通仿真推演，评估不同信号配时和管理方案对交通运行效率的影响</p>
      </div>

      <Row gutter={16}>
        {/* Left: Controls */}
        <Col span={8}>
          {/* Scenario Selection */}
          <Card title="选择仿真场景" size="small" style={{ marginBottom: 16 }}>
            <Select
              style={{ width: '100%' }}
              placeholder="选择场景..."
              value={selectedScenario?.id}
              onChange={selectScenario}
              options={scenarios.map((s) => ({
                value: s.id,
                label: s.name,
              }))}
            />
            {selectedScenario && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {selectedScenario.description}
                </Text>
                <Descriptions size="small" column={1} style={{ marginTop: 8 }}>
                  <Descriptions.Item label="仿真区域">
                    {selectedScenario.area.radius / 1000}km 半径
                  </Descriptions.Item>
                  <Descriptions.Item label="仿真时长">
                    {Math.floor(selectedScenario.duration / 60)} 分钟
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}
          </Card>

          {/* Parameters */}
          <Card title="参数配置" size="small" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12 }}>车流量倍率</Text>
              <Slider min={0.5} max={2.5} step={0.1} defaultValue={1.0} marks={{ 0.5: '0.5x', 1: '1x', 1.5: '1.5x', 2: '2x', 2.5: '2.5x' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12 }}>信号控制模式</Text>
              <Radio.Group defaultValue="adaptive" style={{ display: 'block', marginTop: 4 }}>
                <Space direction="vertical">
                  <Radio value="fixed">固定配时</Radio>
                  <Radio value="adaptive">自适应</Radio>
                  <Radio value="green_wave">绿波带</Radio>
                </Space>
              </Radio.Group>
            </div>

            <div>
              <Text style={{ fontSize: 12 }}>事故率</Text>
              <Slider min={0} max={0.2} step={0.01} defaultValue={0.02} marks={{ 0: '0%', 0.05: '5%', 0.1: '10%', 0.2: '20%' }}
                tooltip={{ formatter: (v?: number) => `${((v ?? 0) * 100).toFixed(0)}%` }}
              />
            </div>
          </Card>

          {/* Controls */}
          <Card
            title="仿真控制"
            size="small"
            style={{ marginBottom: 16 }}
          >
            <Space style={{ marginBottom: 16 }}>
              {!isRunning && !isPaused ? (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={start}
                  disabled={!selectedScenario}
                >
                  开始仿真
                </Button>
              ) : isPaused ? (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={resume}
                >
                  继续
                </Button>
              ) : (
                <Button
                  icon={<PauseCircleOutlined />}
                  onClick={pause}
                >
                  暂停
                </Button>
              )}
              {(isRunning || isPaused) && (
                <Button
                  danger
                  icon={<StopOutlined />}
                  onClick={stop}
                >
                  停止
                </Button>
              )}
              <Button
                icon={<ReloadOutlined />}
                onClick={resetResults}
                disabled={!isDone}
              >
                重置
              </Button>
            </Space>

            {(isRunning || isPaused || isDone) && (
              <div>
                <Progress
                  percent={Math.round(progress)}
                  status={isRunning ? 'active' : isDone ? 'success' : 'normal'}
                  strokeColor={isDone ? '#52c41a' : '#1677ff'}
                />
                {isRunning && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    仿真进行中... {Math.round(progress)}%
                  </Text>
                )}
              </div>
            )}
          </Card>
        </Col>

        {/* Right: Visualization + Results */}
        <Col span={16}>
          {/* Simulation Canvas */}
          <Card
            title="交通流可视化"
            size="small"
            style={{ marginBottom: 16 }}
            styles={{ body: { padding: 0 } }}
          >
            <div style={{ height: 320 }}>
              <SimulationCanvas running={isRunning} />
            </div>
          </Card>

          {/* Results */}
          {isDone && results ? (
            <Card title="仿真结果分析" size="small">
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="平均车速提升"
                    value={results.avgSpeedImprovement}
                    suffix="%"
                    valueStyle={{ color: '#52c41a', fontSize: 24 }}
                    prefix="↑"
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="通行时间减少"
                    value={results.travelTimeReduction}
                    suffix="%"
                    valueStyle={{ color: '#52c41a', fontSize: 24 }}
                    prefix="↓"
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="排队长度缩短"
                    value={results.queueLengthReduction}
                    suffix="%"
                    valueStyle={{ color: '#52c41a', fontSize: 24 }}
                    prefix="↓"
                  />
                </Col>
              </Row>

              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={12}>
                  <Statistic
                    title="拥堵指数变化"
                    value={results.congestionIndexChange}
                    suffix="点"
                    valueStyle={{
                      color: results.congestionIndexChange < 0 ? '#52c41a' : '#f5222d',
                      fontSize: 20,
                    }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="预计月度节油"
                    value={results.fuelSaving}
                    valueStyle={{ color: '#1677ff', fontSize: 20 }}
                  />
                </Col>
              </Row>
            </Card>
          ) : isDone && !results ? (
            <Empty description="仿真已完成，但无结果数据" />
          ) : !isRunning && !isDone ? (
            <Card size="small">
              <Empty description="请选择场景并开始仿真">
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={start}
                  disabled={!selectedScenario}
                >
                  开始仿真
                </Button>
              </Empty>
            </Card>
          ) : (
            <Card size="small">
              <div style={{ textAlign: 'center', padding: 20, color: 'rgba(0,0,0,0.45)' }}>
                仿真运行中，完成后将显示结果...
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
