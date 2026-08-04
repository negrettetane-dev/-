const shell = document.querySelector(".map-shell");
const poiTitle = document.querySelector("#poiTitle");
const poiDistance = document.querySelector("#poiDistance");
const routeHint = document.querySelector("#routeHint");
const routeTime = document.querySelector("#routeTime");
const searchPanel = document.querySelector("#searchPanel");
const profileDrawer = document.querySelector("#profileDrawer");
const searchInput = document.querySelector("#searchInput");
const suggestions = document.querySelector("#suggestions");
const toast = document.querySelector("#toast");
const districtName = document.querySelector("#districtName");
const trafficSummary = document.querySelector("#trafficSummary");
const gpsState = document.querySelector("#gpsState");
const featurePanel = document.querySelector("#featurePanel");
const featureTitle = document.querySelector("#featureTitle");
const featureSubtitle = document.querySelector("#featureSubtitle");
const featureBody = document.querySelector("#featureBody");
const featureActions = document.querySelector("#featureActions");
const phoneInput = document.querySelector("#phoneInput");
const codeInput = document.querySelector("#codeInput");
const sendCodeBtn = document.querySelector("#sendCodeBtn");
const pins = Array.from(document.querySelectorAll(".pin"));
const filterChips = Array.from(document.querySelectorAll(".filter-chip"));
const routeTabs = Array.from(document.querySelectorAll(".route-tab"));

const places = [
  {
    id: "home",
    name: "当前位置",
    meta: "你在杉湖商圈附近",
    category: "all",
    district: "杉湖商圈",
    traffic: "主路缓行，预计多 4 分钟",
    routes: { drive: ["18 分钟", "经青杉路，2.6 公里"], walk: ["24 分钟", "沿河岸步道，1.8 公里"], transit: ["16 分钟", "2 号线一站后步行"] }
  },
  {
    id: "cafe",
    name: "岚桥咖啡",
    meta: "青杉路 18 号 · 步行 320 米",
    category: "food",
    district: "青杉路",
    traffic: "门口可临停，支路畅通",
    routes: { drive: ["6 分钟", "经滨河支路，1.1 公里"], walk: ["5 分钟", "穿过口袋广场"], transit: ["12 分钟", "公交 18 路一站"] }
  },
  {
    id: "station",
    name: "青杉地铁站",
    meta: "2 号线 / 7 号线 · 步行 680 米",
    category: "transit",
    district: "青杉枢纽",
    traffic: "地铁口客流偏高",
    routes: { drive: ["9 分钟", "落客区在 B 口"], walk: ["8 分钟", "直行 680 米"], transit: ["3 分钟", "已在站区范围"] }
  },
  {
    id: "park",
    name: "北岸公园",
    meta: "开放中 · 骑行 4 分钟",
    category: "all",
    district: "北岸绿带",
    traffic: "园区周边慢行优先",
    routes: { drive: ["14 分钟", "停车场在东门"], walk: ["18 分钟", "沿水岸步道"], transit: ["20 分钟", "7 号线转社区巴士"] }
  },
  {
    id: "charge",
    name: "南门充电站",
    meta: "快充 12 枪 · 驾车 9 分钟",
    category: "charge",
    district: "南门停车区",
    traffic: "入口排队约 2 辆车",
    routes: { drive: ["9 分钟", "经南门辅路，2.2 公里"], walk: ["31 分钟", "不建议步行前往"], transit: ["28 分钟", "公交后需步行 900 米"] }
  }
];

let gpsMode = 0;
let activePlace = places[0];
let activeRouteMode = "drive";
let activeFilter = "all";
let toastTimer;
let isRecording = false;
let sportDistance = 0;
let sportTimer;
let codeCountdown = 0;
let codeTimer;

const routeHistory = [];

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1500);
}

function updateRoute() {
  const [time, hint] = activePlace.routes[activeRouteMode];
  routeTime.textContent = time;
  routeHint.textContent = hint;
  routeHistory.unshift(`${activePlace.name} · ${activeRouteModeLabel()} · ${time}`);
  routeHistory.splice(6);
}

function activeRouteModeLabel() {
  return { drive: "驾车", walk: "步行", transit: "公交" }[activeRouteMode];
}

function selectPlace(placeId) {
  const nextPlace = places.find((place) => place.id === placeId) || places[0];
  activePlace = nextPlace;
  pins.forEach((pin) => pin.classList.toggle("is-selected", pin.dataset.place === nextPlace.id));
  poiTitle.textContent = nextPlace.name;
  poiDistance.textContent = nextPlace.meta;
  districtName.textContent = nextPlace.district;
  trafficSummary.textContent = nextPlace.traffic;
  updateRoute();
  shell.classList.add("sheet-open");
}

function openFeature(title, subtitle, rows, actions = []) {
  featureTitle.textContent = title;
  featureSubtitle.textContent = subtitle;
  featureBody.innerHTML = rows.join("");
  featureActions.innerHTML = "";
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action.primary ? "primary" : "";
    button.textContent = action.label;
    button.addEventListener("click", action.onClick);
    featureActions.appendChild(button);
  });
  featurePanel.classList.add("is-open");
  featurePanel.setAttribute("aria-hidden", "false");
}

function closeFeaturePanel() {
  featurePanel.classList.remove("is-open");
  featurePanel.setAttribute("aria-hidden", "true");
}

function openWeather() {
  openFeature("天气情报", activePlace.district, [
    `<div class="metric-grid"><div><strong>26°C</strong><span>体感舒适</span></div><div><strong>东北风</strong><span>2 级</span></div><div><strong>良</strong><span>空气质量</span></div></div>`,
    `<div class="info-row"><strong>出行建议</strong><span>近两小时无明显降雨，骑行和步行路线可优先走水岸步道。</span></div>`,
    `<div class="info-row"><strong>路面提示</strong><span>北岸桥附近有短时湿滑路段，驾车路线会避开桥下辅路。</span></div>`
  ]);
}

function openShare() {
  const shareUrl = `https://citypulse.local/place/${activePlace.id}`;
  openFeature("分享位置", activePlace.name, [
    `<div class="info-row"><strong>${shareUrl}</strong><span>模拟生成的位置短链接，可继续接入微信或系统分享。</span></div>`
  ], [
    { label: "复制链接", primary: true, onClick: () => showToast("位置链接已复制到剪贴板") },
    { label: "发给好友", onClick: () => showToast("已准备好友分享卡片") }
  ]);
}

function openTaxi() {
  openFeature("打车估算", activePlace.name, [
    `<div class="metric-grid"><div><strong>3 分钟</strong><span>预计接驾</span></div><div><strong>18 元</strong><span>预估费用</span></div><div><strong>B2</strong><span>建议上车点</span></div></div>`,
    `<div class="info-row"><strong>上车点</strong><span>${activePlace.district} 临停区，避开主路掉头。</span></div>`
  ], [
    { label: "呼叫车辆", primary: true, onClick: () => showToast("已模拟发起叫车") },
    { label: "更换上车点", onClick: () => showToast("上车点选择器可继续接入") }
  ]);
}

function openTeam() {
  openFeature("组队出行", "轻量模拟队伍位置", [
    `<div class="info-row"><strong>队伍码 8421</strong><span>成员可通过队伍码加入，并共享实时位置。</span></div>`,
    `<div class="history-item"><strong>你</strong><span>当前位置 · 朝北移动</span></div>`,
    `<div class="history-item"><strong>好友 A</strong><span>青杉地铁站 · 距你 680 米</span></div>`
  ], [
    { label: "复制队伍码", primary: true, onClick: () => showToast("队伍码已复制") },
    { label: "结束组队", onClick: () => showToast("组队已结束") }
  ]);
}

function openVoice() {
  openFeature("语音搜索", "模拟语音识别", [
    `<div class="info-row"><strong>试着说：去青杉地铁站</strong><span>当前版本先用模拟识别结果，后续可接浏览器录音权限。</span></div>`
  ], [
    { label: "模拟识别", primary: true, onClick: () => { searchInput.value = "青杉地铁站"; searchPanel.classList.add("is-open"); renderSuggestions(searchInput.value); closeFeaturePanel(); } }
  ]);
}

function openScan() {
  openFeature("扫码入口", "模拟二维码结果", [
    `<div class="info-row"><strong>停车缴费</strong><span>扫码后可打开停车场缴费、地点海报或商家页面。</span></div>`
  ], [
    { label: "模拟扫码", primary: true, onClick: () => showToast("识别到：云谷停车场缴费") }
  ]);
}

function openHistory() {
  const rows = routeHistory.length ? routeHistory.map((item) => `<div class="history-item"><strong>${item}</strong><span>本地路线历史</span></div>`) : [`<div class="info-row"><strong>暂无路线历史</strong><span>点击地图地点并切换路线后会出现在这里。</span></div>`];
  openFeature("路线历史", "本地记录", rows);
}

function openOffline() {
  openFeature("离线地图", "已缓存城市包", [
    `<div class="metric-grid"><div><strong>杉湖</strong><span>已下载</span></div><div><strong>126MB</strong><span>城市包</span></div><div><strong>今天</strong><span>已更新</span></div></div>`,
    `<div class="info-row"><strong>离线可用</strong><span>搜索、收藏和基础路线可在无网络时展示缓存结果。</span></div>`
  ], [
    { label: "更新城市包", primary: true, onClick: () => showToast("离线地图已是最新") }
  ]);
}

function openSport() {
  const actionLabel = isRecording ? "结束记录" : "开始记录";
  openFeature("运动记录", "步行 / 骑行轨迹", [
    `<div class="metric-grid"><div><strong>${sportDistance.toFixed(1)}km</strong><span>距离</span></div><div><strong>${isRecording ? "记录中" : "未开始"}</strong><span>状态</span></div><div><strong>水岸线</strong><span>推荐路线</span></div></div>`,
    `<div class="info-row"><strong>轨迹说明</strong><span>这里先模拟距离增长，后续可接入定位轨迹和速度统计。</span></div>`
  ], [
    { label: actionLabel, primary: true, onClick: toggleSportRecord },
    { label: "保存轨迹", onClick: () => showToast("运动轨迹已保存到本地") }
  ]);
}

function toggleSportRecord() {
  isRecording = !isRecording;
  clearInterval(sportTimer);
  if (isRecording) {
    sportTimer = setInterval(() => {
      sportDistance += 0.1;
    }, 1200);
    showToast("运动记录已开始");
  } else {
    showToast("运动记录已结束");
  }
  openSport();
}

function renderSuggestions(query = "") {
  const normalized = query.trim().toLowerCase();
  const filtered = places.filter((place) => {
    const categoryMatch = activeFilter === "all" || place.category === activeFilter;
    const queryMatch = !normalized || `${place.name} ${place.meta} ${place.district}`.toLowerCase().includes(normalized);
    return categoryMatch && queryMatch;
  });

  suggestions.innerHTML = "";
  filtered.forEach((place) => {
    const button = document.createElement("button");
    button.className = "suggestion";
    button.innerHTML = `<strong>${place.name}</strong><span>${place.meta}</span>`;
    button.addEventListener("click", () => {
      selectPlace(place.id);
      searchPanel.classList.remove("is-open");
      showToast("已在地图上标记地点");
    });
    suggestions.appendChild(button);
  });

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "没有匹配地点，换个关键词试试";
    suggestions.appendChild(empty);
  }
}

pins.forEach((pin) => {
  pin.addEventListener("click", () => selectPlace(pin.dataset.place));
});

document.querySelector("#toggleSheet").addEventListener("click", () => {
  shell.classList.toggle("sheet-expanded");
});

document.querySelector("#closeSheet").addEventListener("click", () => {
  shell.classList.remove("sheet-open", "sheet-expanded");
  pins.forEach((pin) => pin.classList.remove("is-selected"));
});

document.querySelector("#openSearch").addEventListener("click", () => {
  searchPanel.classList.add("is-open");
  renderSuggestions();
  setTimeout(() => searchInput.focus(), 20);
});

document.querySelector("#backSearch").addEventListener("click", () => {
  searchPanel.classList.remove("is-open");
  searchInput.value = "";
});

searchInput.addEventListener("input", () => renderSuggestions(searchInput.value));

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    activeFilter = chip.dataset.filter;
    filterChips.forEach((item) => item.classList.toggle("is-active", item === chip));
    renderSuggestions(searchInput.value);
  });
});

routeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeRouteMode = tab.dataset.mode;
    routeTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    updateRoute();
  });
});

document.querySelector("#profileBtn").addEventListener("click", () => profileDrawer.classList.add("is-open"));
document.querySelector("#closeProfile").addEventListener("click", () => profileDrawer.classList.remove("is-open"));
document.querySelector("#closeFeature").addEventListener("click", closeFeaturePanel);
document.querySelector("#weatherBtn").addEventListener("click", openWeather);

document.querySelector("#trafficBtn").addEventListener("click", (event) => {
  const next = event.currentTarget.getAttribute("aria-pressed") !== "true";
  event.currentTarget.setAttribute("aria-pressed", String(next));
  shell.classList.toggle("traffic-off", !next);
  trafficSummary.textContent = next ? activePlace.traffic : "实时路况已隐藏";
});

document.querySelector("#layerBtn").addEventListener("click", (event) => {
  const next = event.currentTarget.getAttribute("aria-pressed") !== "true";
  event.currentTarget.setAttribute("aria-pressed", String(next));
  shell.classList.toggle("layer-on", next);
});

document.querySelector("#teamBtn").addEventListener("click", (event) => {
  const next = event.currentTarget.getAttribute("aria-pressed") !== "true";
  event.currentTarget.setAttribute("aria-pressed", String(next));
  if (next) openTeam();
  else showToast("组队入口已收起");
});

document.querySelector("#gpsBtn").addEventListener("click", () => {
  gpsMode = (gpsMode + 1) % 3;
  const labels = ["定", "锁", "航"];
  const messages = ["定位自由浏览", "已锁定当前位置", "已进入朝向跟随"];
  gpsState.textContent = labels[gpsMode];
  showToast(messages[gpsMode]);
});

document.querySelector("#routeBtn").addEventListener("click", () => {
  shell.classList.add("sheet-open", "sheet-expanded");
  updateRoute();
});

document.querySelector("#nearbyBtn").addEventListener("click", () => {
  searchPanel.classList.add("is-open");
  searchInput.value = "";
  activeFilter = "all";
  filterChips.forEach((item) => item.classList.toggle("is-active", item.dataset.filter === "all"));
  renderSuggestions();
});

document.querySelector("#favoriteBtn").addEventListener("click", () => {
  openFeature("常去地点", "本地收藏夹", [
    `<div class="history-item"><strong>家</strong><span>杉湖西门 · 18:30 常用</span></div>`,
    `<div class="history-item"><strong>公司</strong><span>青杉路 18 号 · 工作日常用</span></div>`,
    `<div class="history-item"><strong>${activePlace.name}</strong><span>${activePlace.meta}</span></div>`
  ]);
});
document.querySelector("#voiceBtn").addEventListener("click", openVoice);
document.querySelector("#scanBtn").addEventListener("click", openScan);
document.querySelector("#zoomIn").addEventListener("click", () => shell.classList.add("zoomed"));
document.querySelector("#zoomOut").addEventListener("click", () => shell.classList.remove("zoomed"));

document.querySelectorAll(".sheet-actions button").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "nearby") {
      searchPanel.classList.add("is-open");
      renderSuggestions("");
    }
    if (action === "save") showToast(`${activePlace.name} 已加入收藏`);
    if (action === "share") openShare();
    if (action === "taxi") openTaxi();
  });
});

document.querySelectorAll("[data-profile]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.profile;
    if (target === "history") openHistory();
    if (target === "offline") openOffline();
    if (target === "sport") openSport();
    if (target === "home") {
      openFeature("家和公司", "通勤位置", [
        `<div class="history-item"><strong>家</strong><span>杉湖西门 · 默认回家点</span></div>`,
        `<div class="history-item"><strong>公司</strong><span>青杉路 18 号 · 默认上班点</span></div>`
      ]);
    }
  });
});

sendCodeBtn.addEventListener("click", () => {
  if (!/^1\d{10}$/.test(phoneInput.value.trim())) {
    showToast("请输入 11 位手机号");
    return;
  }
  codeCountdown = 30;
  sendCodeBtn.disabled = true;
  sendCodeBtn.textContent = `${codeCountdown}s`;
  clearInterval(codeTimer);
  codeTimer = setInterval(() => {
    codeCountdown -= 1;
    sendCodeBtn.textContent = `${codeCountdown}s`;
    if (codeCountdown <= 0) {
      clearInterval(codeTimer);
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = "获取验证码";
    }
  }, 1000);
  showToast("验证码已发送：123456");
});

document.querySelector("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (codeInput.value.trim() !== "123456") {
    showToast("验证码为 123456");
    return;
  }
  showToast("已登录，收藏与路线开始同步");
});

selectPlace("home");
shell.classList.remove("sheet-open");
renderSuggestions();
