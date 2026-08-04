# 智途云枢后端

面向北京、厦门、福州的多城市智慧交通控制中心后端，提供交通态势汇总、拥堵预测、路径推荐、事件预警和 What-If 沙盘推演接口。

当前版本使用可复现的城市仿真数据，适合比赛演示，不代表交管部门实时数据。城市数据通过统一配置和接口契约管理，后续可以接入真实路况、天气和路网适配器。

## 启动

```powershell
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

接口文档：`http://localhost:8000/docs`

## 测试

```powershell
python -m pytest -q
```

支持城市：`beijing`、`xiamen`、`fuzhou`。
