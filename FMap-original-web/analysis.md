# FMap 结构与体验分析

参考仓库：`C:\Users\white\Documents\计算机\FMap`

## 项目结构

- Android 原生应用，根目录是 Gradle 工程，主要模块在 `app`。
- 技术栈是 Java + Android Support 28 + ConstraintLayout + Design BottomSheet + OkHttp + FastJson + Glide。
- 地图能力来自本地集成的高德地图、定位、搜索和导航 SDK：`app/libs` 与 `app/src/main/jniLibs`。
- 主入口是 `SplashActivity`，地图主体验在 `MapActivity`。
- UI 主要通过 XML layout 和自定义 View 组合：`MapHeaderView`、`GPSView`、`TrafficView`、`SupendPartitionView`、`PoiDetailBottomView`、`NearbySearchView`。
- 用户相关页面采用 MVP 风格命名：`IUser*View`、`IUser*Model`、`*Presenter`。

## 体验 DNA

- 首屏不是首页，而是全屏地图工作台。
- 地图之上叠加三层操作：顶部搜索条、右侧工具条、底部快捷操作。
- POI 点击后出现底部抽屉，抽屉折叠时保留地图上下文，展开时弱化地图并转入详情。
- 搜索是独立模式：进入后隐藏地图控件，展示输入框和联想结果，选择结果再回到地图。
- 定位按钮有三态：自由浏览、锁定位置、朝向跟随。
- 右侧工具强调地图状态切换，比如实时路况、图层、组队。
- 底部是高频出行任务：路线、常去、周边搜索、POI 详情。

## 原创实现原则

- 不复用原项目 Java、XML、图片、SDK key 或高德资源。
- 保留“地图工作台 + 浮层控件 + 搜索模式 + 底部详情抽屉”的交互模型。
- 用原创 SVG 城市底图和本地状态模拟 POI、路线、路况和图层。
- 把实现做成可直接打开的静态 Web 原型，方便继续改主题和功能。
