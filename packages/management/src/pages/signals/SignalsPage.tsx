import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tag, Space, Spin, Button, Input } from 'antd';
import { SearchOutlined, ReloadOutlined, ControlOutlined } from '@ant-design/icons';
import { useSignalStore } from '../../stores/signalStore';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  manual: { color: 'blue', label: '手动控制' },
  auto: { color: 'green', label: '自适应' },
  optimizing: { color: 'orange', label: '优化中' },
};

export default function SignalsPage() {
  const navigate = useNavigate();
  const { intersections, loading, fetchList } = useSignalStore();

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Generate phase blocks
  const renderPhaseDiagram = (currentPhase: number, totalPhases: number) => {
    return Array.from({ length: totalPhases }, (_, i) => {
      let className = 'phase-block red';
      if (i === currentPhase - 1) className = 'phase-block green';
      return <div key={i} className={className} />;
    });
  };

  return (
    <div className="content-page">
      <div className="page-header">
        <h2>
          <ControlOutlined style={{ marginRight: 8 }} />
          信号控制
        </h2>
        <p className="page-desc">管理城市交通信号灯路口，查看和编辑信号配时方案</p>
      </div>

      <div className="filter-bar">
        <Input
          placeholder="搜索路口名称"
          prefix={<SearchOutlined />}
          style={{ width: 260 }}
        />
        <Button icon={<ReloadOutlined />} onClick={fetchList}>
          刷新
        </Button>
        <Space style={{ marginLeft: 'auto' }}>
          <Tag color="blue">手动控制</Tag>
          <Tag color="green">自适应</Tag>
          <Tag color="orange">优化中</Tag>
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : (
        <div className="intersection-grid">
          {intersections.map((inter) => {
            const statusInfo = STATUS_MAP[inter.optimizationStatus];
            return (
              <Card
                key={inter.id}
                className="intersection-card"
                onClick={() => navigate(`/admin/signals/${inter.id}`)}
                hoverable
              >
                <div className="card-header">
                  <div>
                    <div className="card-name">{inter.name}</div>
                    <div className="card-location">
                      📍 [{inter.position[0].toFixed(3)}, {inter.position[1].toFixed(3)}]
                    </div>
                  </div>
                  <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                  <span>
                    相位：<b>{inter.currentPhase}</b> / {inter.phaseCount}
                  </span>
                  <span>
                    周期：<b>{inter.cycleTime}</b>秒
                  </span>
                </div>

                <div className="phase-diagram">
                  {renderPhaseDiagram(inter.currentPhase, inter.phaseCount)}
                </div>

                {inter.greenWaveGroup && (
                  <div style={{ marginTop: 10 }}>
                    <Tag color="cyan" style={{ fontSize: 11 }}>
                      🌊 {inter.greenWaveGroup}
                    </Tag>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
