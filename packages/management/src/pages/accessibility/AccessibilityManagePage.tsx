import React, { useCallback, useEffect, useState } from 'react';
import {
  Table, Tag, Button, Input, Space, Modal, Form, Switch, Select, InputNumber,
  message, Popconfirm, Tabs, Empty,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, EditOutlined, DeploymentUnitOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { accessibilityService } from '../../services/accessibilityService';
import type { StationFacility, FacilityEntrance, FacilityStatus } from '@zhitu/shared';

const STATUS_META: Record<FacilityStatus, { label: string; color: string }> = {
  verified: { label: '🟢 已确认', color: 'success' },
  unknown: { label: '🟡 待确认', color: 'warning' },
  obstacle: { label: '🔴 存在障碍', color: 'error' },
};

const AccessibilityManagePage: React.FC = () => {
  const [stations, setStations] = useState<StationFacility[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<StationFacility | null>(null);
  const [entranceModalOpen, setEntranceModalOpen] = useState(false);
  const [editingEntrance, setEditingEntrance] = useState<FacilityEntrance & { id?: string } | null>(null);
  const [entranceStationId, setEntranceStationId] = useState('');
  const [form] = Form.useForm();
  const [entranceForm] = Form.useForm();

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await accessibilityService.getList({
        page, page_size: pageSize,
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      setStations(data.list || []);
      setTotal(data.total || 0);
    } catch (e) {
      message.error('无障碍设施加载失败：' + (e instanceof Error ? e.message : '请稍后重试'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => { void fetchList(); }, [fetchList]);

  const openCreateStation = () => {
    setEditingStation(null);
    form.resetFields();
    setStationModalOpen(true);
  };

  const openEditStation = (record: StationFacility) => {
    setEditingStation(record);
    form.setFieldsValue({
      stationName: record.stationName,
      lng: record.lng,
      lat: record.lat,
      accessibleRestroom: record.accessibleRestroom,
    });
    setStationModalOpen(true);
  };

  const submitStation = async () => {
    const values = await form.validateFields();
    const input = {
      stationName: values.stationName,
      lng: Number(values.lng),
      lat: Number(values.lat),
      accessibleRestroom: Boolean(values.accessibleRestroom),
      entrances: editingStation?.entrances || [],
    };
    try {
      if (editingStation) {
        await accessibilityService.update(editingStation.stationId, input);
        message.success('站点已更新');
      } else {
        await accessibilityService.create(input);
        message.success('站点已创建');
      }
      setStationModalOpen(false);
      void fetchList();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  const removeStation = async (record: StationFacility) => {
    try {
      await accessibilityService.remove(record.stationId);
      message.success('站点已删除');
      void fetchList();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  // 入口管理
  const openCreateEntrance = (stationId: string) => {
    setEntranceStationId(stationId);
    setEditingEntrance(null);
    entranceForm.resetFields();
    entranceForm.setFieldsValue({ name: 'A口', elevator: false, ramp: false, stairsOnly: false, wheelchairAccessible: true, status: 'verified' });
    setEntranceModalOpen(true);
  };

  const openEditEntrance = (stationId: string, entrance: FacilityEntrance & { id?: string }) => {
    setEntranceStationId(stationId);
    setEditingEntrance(entrance);
    entranceForm.setFieldsValue(entrance);
    setEntranceModalOpen(true);
  };

  const submitEntrance = async () => {
    const values = await entranceForm.validateFields();
    const payload = {
      name: values.name,
      elevator: Boolean(values.elevator),
      ramp: Boolean(values.ramp),
      stairsOnly: Boolean(values.stairsOnly),
      wheelchairAccessible: Boolean(values.wheelchairAccessible),
      status: values.status,
    };
    try {
      if (editingEntrance?.id) {
        await accessibilityService.updateEntrance(editingEntrance.id, payload);
        message.success('入口已更新');
      } else {
        await accessibilityService.addEntrance(entranceStationId, payload);
        message.success('入口已新增');
      }
      setEntranceModalOpen(false);
      void fetchList();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  const removeEntrance = async (entrance: FacilityEntrance & { id?: string }) => {
    if (!entrance.id) { message.warning('该入口无 ID，无法删除'); return; }
    try {
      await accessibilityService.removeEntrance(entrance.id);
      message.success('入口已删除');
      void fetchList();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const columns: ColumnsType<StationFacility> = [
    {
      title: '站点ID',
      dataIndex: 'stationId',
      key: 'stationId',
      width: 150,
      render: (id: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id}</span>,
    },
    {
      title: '站点名称',
      dataIndex: 'stationName',
      key: 'stationName',
      width: 140,
      render: (name: string, record) => (
        <Space>
          <span>♿ {name}</span>
          {record.accessibleRestroom && <Tag color="cyan">无障碍卫生间</Tag>}
        </Space>
      ),
    },
    {
      title: '坐标',
      key: 'coord',
      width: 150,
      render: (_, record) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-hint)' }}>
          {record.lng.toFixed(5)}, {record.lat.toFixed(5)}
        </span>
      ),
    },
    {
      title: '入口',
      key: 'entrances',
      render: (_, record) => {
        const entrances = (record.entrances || []).map(e => ({ ...e, id: e.id }));
        if (entrances.length === 0) {
          return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无入口" />;
        }
        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {entrances.map((e, i) => {
              const meta = STATUS_META[e.status] || STATUS_META.unknown;
              return (
                <Space key={i} size={6} wrap>
                  <Tag>{e.name}</Tag>
                  {e.elevator && <Tag color="geekblue">🛗</Tag>}
                  {e.ramp && <Tag color="cyan">↗️</Tag>}
                  {e.stairsOnly && <Tag color="red">⚠️楼梯</Tag>}
                  {e.wheelchairAccessible && <Tag color="green">♿可达</Tag>}
                  <Tag color={meta.color}>{meta.label}</Tag>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={(ev) => { ev.stopPropagation(); openEditEntrance(record.stationId, e); }}>编辑</Button>
                  <Popconfirm title="确认删除该入口？" onConfirm={() => void removeEntrance(e)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={(ev) => ev.stopPropagation()}>删除</Button>
                  </Popconfirm>
                </Space>
              );
            })}
          </Space>
        );
      },
    },
    {
      title: '数据来源',
      dataIndex: 'source',
      key: 'source',
      width: 90,
      render: (source: string) => (
        <Tag color={source === 'backend' ? 'blue' : 'default'}>{source === 'backend' ? '后端' : '演示'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<PlusOutlined />} onClick={(e) => { e.stopPropagation(); openCreateEntrance(record.stationId); }}>加入口</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openEditStation(record); }}>编辑</Button>
          <Popconfirm title="确认删除该站点？（将级联删除入口）" onConfirm={() => void removeStation(record)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="content-page">
      <div className="page-header">
        <h2>
          <DeploymentUnitOutlined style={{ marginRight: 8 }} />
          无障碍设施管理
        </h2>
        <p className="page-desc">维护地铁/公交站点的无障碍入口、电梯、坡道与障碍状态；平民端无障碍路线据此计算</p>
      </div>

      <div className="filter-bar">
        <Input
          placeholder="搜索站点名称/ID"
          prefix={<span>🔍</span>}
          style={{ width: 240, marginRight: 8 }}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={() => void fetchList()}>刷新</Button>
        <Button type="primary" icon={<PlusOutlined />} style={{ marginLeft: 'auto' }} onClick={openCreateStation}>新增站点</Button>
      </div>

      <Table
        columns={columns}
        dataSource={stations}
        rowKey="stationId"
        loading={loading}
        pagination={{
          pageSize, current: page, total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 个站点`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        scroll={{ x: 1100 }}
        style={{ background: '#fff', borderRadius: 8 }}
      />

      {/* 站点新增/编辑弹窗 */}
      <Modal
        title={editingStation ? `编辑站点 ${editingStation.stationName}` : '新增无障碍站点'}
        open={stationModalOpen}
        onCancel={() => setStationModalOpen(false)}
        onOk={() => void submitStation()}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="stationName" label="站点名称" rules={[{ required: true, message: '请输入站点名称' }]}>
            <Input placeholder="如：天安门东" />
          </Form.Item>
          <Space>
            <Form.Item name="lng" label="经度" rules={[{ required: true, message: '必填' }]}>
              <InputNumber style={{ width: 140 }} placeholder="116.404" />
            </Form.Item>
            <Form.Item name="lat" label="纬度" rules={[{ required: true, message: '必填' }]}>
              <InputNumber style={{ width: 140 }} placeholder="39.909" />
            </Form.Item>
          </Space>
          <Form.Item name="accessibleRestroom" label="无障碍卫生间" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
        {editingStation && editingStation.entrances.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>
            入口在下方「入口」列管理（共 {editingStation.entrances.length} 个）
          </div>
        )}
      </Modal>

      {/* 入口新增/编辑弹窗 */}
      <Modal
        title={editingEntrance?.id ? `编辑入口 ${editingEntrance.name}` : '新增入口'}
        open={entranceModalOpen}
        onCancel={() => setEntranceModalOpen(false)}
        onOk={() => void submitEntrance()}
        destroyOnClose
      >
        <Form form={entranceForm} layout="vertical">
          <Form.Item name="name" label="入口名称" rules={[{ required: true, message: '请输入入口名称' }]}>
            <Input placeholder="如：A口 / B口 / C口" />
          </Form.Item>
          <Form.Item name="status" label="设施状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'verified', label: '🟢 已确认' },
                { value: 'unknown', label: '🟡 待确认' },
                { value: 'obstacle', label: '🔴 存在障碍' },
              ]}
            />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="elevator" label="电梯" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="ramp" label="坡道" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="stairsOnly" label="仅楼梯" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="wheelchairAccessible" label="轮椅可达" valuePropName="checked"><Switch /></Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default AccessibilityManagePage;
