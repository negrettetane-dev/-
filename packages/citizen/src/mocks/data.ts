// ===== 北京交通 Mock 数据 =====
// 城市中心: [116.40, 39.90]

export const MOCK_ROADS = [
  { id:'r1', name:'二环路', direction:'内环', startCoord:[116.36,39.88] as [number,number], endCoord:[116.44,39.94] as [number,number], speed:25, freeFlowSpeed:60, congestionLevel:'congested' as const, travelTimeIndex:2.4, timestamp:Date.now() },
  { id:'r2', name:'二环路', direction:'外环', startCoord:[116.44,39.94] as [number,number], endCoord:[116.36,39.88] as [number,number], speed:30, freeFlowSpeed:60, congestionLevel:'slow' as const, travelTimeIndex:2.0, timestamp:Date.now() },
  { id:'r3', name:'三环路', direction:'内环', startCoord:[116.33,39.85] as [number,number], endCoord:[116.47,39.97] as [number,number], speed:45, freeFlowSpeed:80, congestionLevel:'slow' as const, travelTimeIndex:1.78, timestamp:Date.now() },
  { id:'r4', name:'长安街', direction:'东向', startCoord:[116.36,39.91] as [number,number], endCoord:[116.44,39.91] as [number,number], speed:15, freeFlowSpeed:50, congestionLevel:'blocked' as const, travelTimeIndex:3.3, timestamp:Date.now() },
  { id:'r5', name:'长安街', direction:'西向', startCoord:[116.44,39.91] as [number,number], endCoord:[116.36,39.91] as [number,number], speed:20, freeFlowSpeed:50, congestionLevel:'congested' as const, travelTimeIndex:2.5, timestamp:Date.now() },
  { id:'r6', name:'平安大街', direction:'东向', startCoord:[116.38,39.93] as [number,number], endCoord:[116.43,39.93] as [number,number], speed:35, freeFlowSpeed:50, congestionLevel:'slow' as const, travelTimeIndex:1.43, timestamp:Date.now() },
  { id:'r7', name:'中关村大街', direction:'南向', startCoord:[116.32,40.00] as [number,number], endCoord:[116.32,39.94] as [number,number], speed:18, freeFlowSpeed:50, congestionLevel:'congested' as const, travelTimeIndex:2.8, timestamp:Date.now() },
  { id:'r8', name:'建国路', direction:'东向', startCoord:[116.43,39.91] as [number,number], endCoord:[116.50,39.91] as [number,number], speed:55, freeFlowSpeed:60, congestionLevel:'free' as const, travelTimeIndex:1.09, timestamp:Date.now() },
  { id:'r9', name:'学院路', direction:'北向', startCoord:[116.35,39.96] as [number,number], endCoord:[116.35,40.00] as [number,number], speed:22, freeFlowSpeed:50, congestionLevel:'congested' as const, travelTimeIndex:2.27, timestamp:Date.now() },
  { id:'r10', name:'两广路', direction:'西向', startCoord:[116.43,39.89] as [number,number], endCoord:[116.36,39.89] as [number,number], speed:40, freeFlowSpeed:50, congestionLevel:'slow' as const, travelTimeIndex:1.25, timestamp:Date.now() },
  { id:'r11', name:'望京街', direction:'东向', startCoord:[116.45,39.99] as [number,number], endCoord:[116.50,39.99] as [number,number], speed:50, freeFlowSpeed:60, congestionLevel:'free' as const, travelTimeIndex:1.2, timestamp:Date.now() },
  { id:'r12', name:'复兴路', direction:'西向', startCoord:[116.36,39.90] as [number,number], endCoord:[116.28,39.90] as [number,number], speed:28, freeFlowSpeed:50, congestionLevel:'slow' as const, travelTimeIndex:1.79, timestamp:Date.now() },
];

export const MOCK_ALERTS = [
  { id:'a1', category:'accident' as const, title:'二环路东直门桥追尾事故', summary:'二环内环东直门桥路段2车追尾，占用左侧车道，请减速慢行', roadName:'二环内环', severity:'critical' as const, publishTime:Date.now()-600000 },
  { id:'a2', category:'construction' as const, title:'三环十里河桥路面维修', summary:'三环外环十里河桥路面维护，封闭2条车道，预计22:00恢复', roadName:'三环外环', severity:'warning' as const, publishTime:Date.now()-3600000 },
  { id:'a3', category:'weather' as const, title:'暴雨蓝色预警', summary:'预计未来3小时有强降雨，能见度低于500米，请减速慢行', severity:'warning' as const, publishTime:Date.now()-1800000 },
  { id:'a4', category:'control' as const, title:'长安街临时交通管制', summary:'长安街东段因会议保障临时交通管制，请绕行平安大街', roadName:'长安街', severity:'info' as const, publishTime:Date.now()-7200000 },
  { id:'a5', category:'congestion' as const, title:'早高峰拥堵预判', summary:'预计明日7:30-9:00二环、三环、长安街拥堵指数将超过8.0，建议错峰出行', severity:'info' as const, publishTime:Date.now()-86400000 },
];

export const MOCK_BUS_LINES = [
  { id:'b1', name:'1路', from:'老山公交场站', to:'四惠枢纽站', stops:['老山公交场站','公主坟','西单','天安门东','王府井','国贸','四惠枢纽站'], price:2 },
  { id:'b2', name:'52路', from:'平乐园', to:'北京西站', stops:['平乐园','劲松','崇文门','王府井','西单','复兴门','北京西站'], price:2 },
  { id:'b3', name:'300快', from:'大钟寺', to:'大钟寺', stops:['大钟寺','蓟门桥','三元桥','国贸','玉泉营','六里桥','大钟寺'], price:2 },
  { id:'b4', name:'103路', from:'动物园公交枢纽', to:'北京站', stops:['动物园','西直门','北海公园','王府井','北京站'], price:2 },
  { id:'b5', name:'814路', from:'朝阳门', to:'中关村', stops:['朝阳门','东单','西单','西直门','中关村'], price:2 },
  { id:'b6', name:'快速公交1线', from:'前门', to:'德茂庄', stops:['前门','永定门','木樨园','大红门','德茂庄'], price:2 },
  { id:'b7', name:'特8路', from:'北土城', to:'大北窑', stops:['北土城','安贞门','三元桥','燕莎','大北窑'], price:2 },
  { id:'b8', name:'夜班车20路', from:'北京站东', to:'中关村', stops:['北京站','东单','王府井','西单','中关村'], price:2 },
];

// ====== 公交站点坐标（北京近似坐标，用于演示地图绘制） ======
export const MOCK_BUS_STATION_COORDS: Record<string, [number, number]> = {
  '老山公交场站': [116.228, 39.908], '公主坟': [116.312, 39.905],
  '西单': [116.380, 39.913], '天安门东': [116.404, 39.909],
  '王府井': [116.410, 39.914], '国贸': [116.461, 39.909],
  '四惠枢纽站': [116.502, 39.907], '平乐园': [116.468, 39.879],
  '劲松': [116.456, 39.886], '崇文门': [116.423, 39.899],
  '复兴门': [116.360, 39.908], '北京西站': [116.322, 39.895],
  '大钟寺': [116.350, 39.971], '蓟门桥': [116.353, 39.972],
  '三元桥': [116.458, 39.960], '玉泉营': [116.350, 39.858],
  '六里桥': [116.314, 39.877], '动物园': [116.339, 39.934],
  '西直门': [116.350, 39.940], '北海公园': [116.390, 39.929],
  '北京站': [116.433, 39.903], '朝阳门': [116.437, 39.924],
  '东单': [116.418, 39.909], '中关村': [116.316, 39.983],
  '前门': [116.395, 39.899], '永定门': [116.392, 39.876],
  '木樨园': [116.395, 39.862], '大红门': [116.389, 39.843],
  '德茂庄': [116.393, 39.801], '北土城': [116.388, 39.976],
  '安贞门': [116.405, 39.974], '燕莎': [116.453, 39.958],
  '大北窑': [116.463, 39.910], '动物园公交枢纽': [116.338, 39.935],
  '北京站东': [116.435, 39.902], '朝阳门南': [116.437, 39.921],
};

export const MOCK_METRO_LINES = [
  { id:'m1', name:'1号线', from:'苹果园', to:'四惠东', stations:['苹果园','公主坟','军事博物馆','西单','天安门东','王府井','国贸','大望路','四惠东'] },
  { id:'m2', name:'2号线(环线)', from:'西直门', to:'西直门', stations:['西直门','鼓楼大街','雍和宫','东直门','朝阳门','建国门','北京站','前门','和平门','复兴门','西直门'] },
  { id:'m3', name:'4号线', from:'安河桥北', to:'天宫院', stations:['安河桥北','中关村','北京大学东门','西直门','西单','菜市口','北京南站'] },
  { id:'m4', name:'10号线(环线)', from:'巴沟', to:'巴沟', stations:['巴沟','苏州街','国贸','双井','呼家楼','三元桥','北土城','牡丹园','巴沟'] },
];

// ====== 地铁线路元信息（首末班 / 颜色 / 方向） ======
export const MOCK_METRO_META: Record<string, { first: string; last: string; color: string; direction: string }> = {
  m1: { first: '05:10', last: '23:15', color: '#c23a30', direction: '苹果园 → 四惠东' },
  m2: { first: '05:03', last: '23:10', color: '#2563eb', direction: '西直门 → 西直门(环线)' },
  m3: { first: '05:00', last: '23:20', color: '#8a2be2', direction: '安河桥北 → 天宫院' },
  m4: { first: '05:15', last: '23:25', color: '#0095d9', direction: '巴沟 → 巴沟(环线)' },
};

// ====== 地铁换乘站映射 ======
export const MOCK_METRO_TRANSFERS: Record<string, string[]> = {
  '西直门': ['2号线', '4号线', '13号线'],
  '东直门': ['2号线', '13号线'],
  '建国门': ['2号线', '1号线'],
  '西单': ['1号线', '4号线'],
  '国贸': ['1号线', '10号线'],
  '公主坟': ['1号线', '10号线'],
  '雍和宫': ['2号线', '5号线'],
  '鼓楼大街': ['2号线', '8号线'],
  '前门': ['2号线', '8号线'],
  '呼家楼': ['10号线', '6号线'],
  '三元桥': ['10号线', '首都机场线'],
  '北土城': ['10号线', '8号线'],
  '牡丹园': ['10号线', '19号线'],
  '苏州街': ['10号线', '16号线'],
  '双井': ['10号线', '7号线'],
  '中关村': ['4号线', '10号线'],
};

// ====== 附近公交/地铁站点（模拟定位） ======
export const MOCK_NEARBY_STATIONS = [
  { id: 'n1', name: '西单路口东', mode: 'bus' as const, lines: ['1路', '52路', '103路'], distance: 120, lat: 39.913, lng: 116.381 },
  { id: 'n2', name: '西单站', mode: 'metro' as const, lines: ['1号线', '4号线'], distance: 180, lat: 39.908, lng: 116.374 },
  { id: 'n3', name: '王府井站', mode: 'metro' as const, lines: ['1号线'], distance: 350, lat: 39.909, lng: 116.410 },
  { id: 'n4', name: '王府井北', mode: 'bus' as const, lines: ['1路', '103路'], distance: 420, lat: 39.914, lng: 116.413 },
  { id: 'n5', name: '天安门东', mode: 'bus' as const, lines: ['1路', '52路'], distance: 560, lat: 39.909, lng: 116.397 },
  { id: 'n6', name: '天安门东站', mode: 'metro' as const, lines: ['1号线'], distance: 610, lat: 39.907, lng: 116.398 },
  { id: 'n7', name: '前门站', mode: 'metro' as const, lines: ['2号线', '8号线'], distance: 780, lat: 39.899, lng: 116.395 },
  { id: 'n8', name: '崇文门路口', mode: 'bus' as const, lines: ['52路'], distance: 950, lat: 39.899, lng: 116.417 },
];

export const MOCK_PARKING_LOTS = [
  { id:'p1', name:'王府井东方广场停车场', address:'东城区东长安街1号', position:[116.414,39.912] as [number,number], totalSpots:600, availableSpots:180, price:'8元/小时', priceValue:8, type:'underground' as const, distance:300, hasCharging:true, images:[] },
  { id:'p2', name:'西单大悦城停车场', address:'西城区西单北大街131号', position:[116.374,39.907] as [number,number], totalSpots:400, availableSpots:65, price:'6元/小时', priceValue:6, type:'underground' as const, distance:1500, hasCharging:true, images:[] },
  { id:'p3', name:'国贸CBD停车场', address:'朝阳区建国门外大街1号', position:[116.458,39.910] as [number,number], totalSpots:800, availableSpots:320, price:'10元/小时', priceValue:10, type:'underground' as const, distance:5000, hasCharging:true, images:[] },
  { id:'p4', name:'北京南站停车场', address:'丰台区永外大街2号', position:[116.379,39.865] as [number,number], totalSpots:500, availableSpots:150, price:'5元/小时', priceValue:5, type:'underground' as const, distance:6000, hasCharging:false, images:[] },
  { id:'p5', name:'北京西站P+R停车场', address:'丰台区莲花池东路', position:[116.322,39.895] as [number,number], totalSpots:700, availableSpots:480, price:'4元/小时', priceValue:4, type:'ground' as const, distance:8000, hasCharging:true, images:[] },
  { id:'p6', name:'三里屯太古里停车场', address:'朝阳区三里屯路19号', position:[116.452,39.937] as [number,number], totalSpots:300, availableSpots:28, price:'12元/小时', priceValue:12, type:'underground' as const, distance:5500, hasCharging:false, images:[] },
  { id:'p7', name:'中关村e世界停车场', address:'海淀区中关村大街11号', position:[116.316,39.984] as [number,number], totalSpots:350, availableSpots:45, price:'8元/小时', priceValue:8, type:'underground' as const, distance:8000, hasCharging:false, images:[] },
  { id:'p8', name:'望京SOHO停车场', address:'朝阳区望京街10号', position:[116.481,39.996] as [number,number], totalSpots:900, availableSpots:620, price:'6元/小时', priceValue:6, type:'underground' as const, distance:10000, hasCharging:true, images:[] },
  { id:'p9', name:'东单停车场', address:'东城区东单北大街', position:[116.419,39.914] as [number,number], totalSpots:150, availableSpots:8, price:'8元/小时', priceValue:8, type:'roadside' as const, distance:1200, hasCharging:false, images:[] },
  { id:'p10', name:'首都机场T3停车场', address:'顺义区首都机场路', position:[116.610,40.080] as [number,number], totalSpots:2000, availableSpots:1450, price:'6元/小时', priceValue:6, type:'ground' as const, distance:22000, hasCharging:true, images:[] },
];

export const MOCK_CHARGING_STATIONS = [
  { id:'c1', name:'特来电·王府井站', address:'东城区东方广场B2', position:[116.414,39.912] as [number,number], operator:'特来电', totalPiles:15, availablePiles:6, power:'120kW', powerValue:120, price:'1.5元/度', connectorTypes:['GB/T' as const], openTime:'24小时', distance:300, status:'online' as const },
  { id:'c2', name:'国家电网·北京南站充电站', address:'丰台区北京南站东广场', position:[116.382,39.864] as [number,number], operator:'国家电网', totalPiles:24, availablePiles:9, power:'60kW', powerValue:60, price:'1.2元/度', connectorTypes:['GB/T' as const,'CCS2' as const], openTime:'24小时', distance:5900, status:'online' as const },
  { id:'c3', name:'星星充电·中关村站', address:'海淀区中关村大街', position:[116.316,39.984] as [number,number], operator:'星星充电', totalPiles:18, availablePiles:15, power:'120kW', powerValue:120, price:'1.4元/度', connectorTypes:['GB/T' as const], openTime:'24小时', distance:8000, status:'online' as const },
  { id:'c4', name:'特来电·三里屯站', address:'朝阳区三里屯B2', position:[116.452,39.937] as [number,number], operator:'特来电', totalPiles:10, availablePiles:3, power:'60kW', powerValue:60, price:'1.6元/度', connectorTypes:['GB/T' as const], openTime:'10:00-22:00', distance:5500, status:'online' as const },
  { id:'c5', name:'蔚来超充·国贸站', address:'朝阳区国贸CBD B2层', position:[116.458,39.910] as [number,number], operator:'蔚来', totalPiles:12, availablePiles:11, power:'240kW', powerValue:240, price:'1.8元/度', connectorTypes:['GB/T' as const,'CCS2' as const], openTime:'24小时', distance:5000, status:'online' as const },
  { id:'c6', name:'小桔充电·望京站', address:'朝阳区望京SOHO', position:[116.481,39.996] as [number,number], operator:'小桔充电', totalPiles:28, availablePiles:19, power:'60kW', powerValue:60, price:'1.1元/度', connectorTypes:['GB/T' as const], openTime:'24小时', distance:10000, status:'online' as const },
];

export const MOCK_WORK_ORDERS = [
  { id:'w1', workOrderNo:'BJ20260805001', category:'pothole' as const, description:'平安大街与地安门交叉口路面有直径约30cm的坑洼，车辆通过颠簸明显', images:[], position:[116.392,39.933] as [number,number], address:'西城区平安大街与地安门交叉口', status:'processing' as const, createTime:Date.now()-259200000, updateTime:Date.now()-86400000, processLogs:[
    { time:Date.now()-259200000, action:'市民提交上报', operator:'系统', detail:'工单已生成'},
    { time:Date.now()-172800000, action:'交管中心受理', operator:'管理员王工', detail:'已指派至西城区市政维修队'},
    { time:Date.now()-86400000, action:'开始处置', operator:'维修队刘师傅', detail:'维修队伍已抵达现场，预计24h内完成'},
  ]},
  { id:'w2', workOrderNo:'BJ20260805002', category:'streetlight' as const, description:'中关村大街北段路灯连续3盏不亮，夜间照明不足', images:[], position:[116.320,39.985] as [number,number], address:'海淀区中关村大街北段188号附近', status:'completed' as const, createTime:Date.now()-604800000, updateTime:Date.now()-172800000, processLogs:[
    { time:Date.now()-604800000, action:'市民提交上报', operator:'系统', detail:'工单已生成'},
    { time:Date.now()-518400000, action:'交管中心受理', operator:'管理员李工', detail:'已指派至海淀区路灯管理所'},
    { time:Date.now()-345600000, action:'维修完成', operator:'路灯所赵工', detail:'已更换3盏LED路灯'},
    { time:Date.now()-172800000, action:'市民确认评价', operator:'系统', detail:'市民评价5星'},
  ], rating:5, afterImage:'' },
  { id:'w3', workOrderNo:'BJ20260805003', category:'illegal_park' as const, description:'王府井步行街入口有车辆违停占用消防通道', images:[], position:[116.414,39.910] as [number,number], address:'东城区王府井步行街口', status:'pending' as const, createTime:Date.now()-3600000, updateTime:Date.now()-3600000, processLogs:[
    { time:Date.now()-3600000, action:'市民提交上报', operator:'系统', detail:'工单已生成，等待交管受理'},
  ]},
];

// 今日资讯演示：n1/n2/n5 为当天发布（供首页「今日交通资讯」筛选展示），其余为历史（验证当天 0 条时不补历史）
const todayAt = (hour: number, minute = 0) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
};

export const MOCK_NEWS = [
  { id:'n1', category:'construction' as const, title:'三环路外环路面提升改造施工公告', summary:'2026年8月10日至9月20日，三环外环（十里河至分钟寺桥）夜间22:00-次日6:00半幅施工', content:'<p>为提升城市快速路通行条件，市交通委计划对三环路外环进行路面提升改造...</p>', source:'北京市交通委员会', publishTime:todayAt(9, 30), tags:['施工','三环路','交通管制'] },
  { id:'n2', category:'control' as const, title:'2026北京马拉松期间交通管制通告', summary:'9月20日6:00-14:00，长安街、二环路部分路段实施临时交通管制', content:'<p>为保障2026北京马拉松顺利进行...</p>', source:'北京市公安局交管局', publishTime:todayAt(10, 15), tags:['马拉松','交通管制','赛事'] },
  { id:'n3', category:'policy' as const, title:'北京市智慧交通建设行动计划发布', summary:'到2028年，全市信号灯联网率达到95%，智慧停车覆盖8000个停车场', content:'<p>北京市人民政府印发《北京市智慧交通建设行动计划(2025-2028)》...</p>', source:'北京市人民政府', publishTime:Date.now()-604800000, tags:['智慧交通','政策','规划'] },
  { id:'n4', category:'safety' as const, title:'夏季高温天气行车安全注意事项', summary:'高温天气轮胎爆胎风险增加，请注意检查胎压，避免疲劳驾驶', content:'<p>夏季高温天气对行车安全带来挑战...</p>', source:'北京交警', publishTime:Date.now()-1209600000, tags:['安全','夏季','驾驶提示'] },
  { id:'n5', category:'holiday' as const, title:'2026中秋国庆假期出行提示', summary:'预计9月30日-10月2日为出城高峰，京藏、京承、京港澳高速易拥堵', content:'<p>2026年中秋国庆假期将至...</p>', source:'北京高速交警', publishTime:todayAt(11, 0), tags:['中秋','国庆','高速','出行'] },
];

export const MOCK_CARBON_RECORDS = [
  { id:'cr1', type:'bus' as const, date:'2026-08-05', distance:8500, duration:1800, carbonSaved:510, points:85, route:'1路: 西单→国贸' },
  { id:'cr2', type:'metro' as const, date:'2026-08-04', distance:12000, duration:1500, carbonSaved:1080, points:180, route:'1号线: 西单→大望路' },
  { id:'cr3', type:'bike' as const, date:'2026-08-04', distance:3200, duration:900, carbonSaved:640, points:107, route:'王府井→天安门' },
  { id:'cr4', type:'walk' as const, date:'2026-08-03', distance:1800, duration:1200, carbonSaved:360, points:60, route:'家→地铁站' },
  { id:'cr5', type:'bus' as const, date:'2026-08-02', distance:5200, duration:1200, carbonSaved:312, points:52, route:'52路: 西单→王府井' },
  { id:'cr6', type:'metro' as const, date:'2026-08-02', distance:8500, duration:1000, carbonSaved:765, points:128, route:'4号线: 西直门→北京南站' },
  { id:'cr7', type:'bike' as const, date:'2026-08-01', distance:5500, duration:1500, carbonSaved:1100, points:183, route:'家→公司' },
  { id:'cr8', type:'walk' as const, date:'2026-08-01', distance:2500, duration:1800, carbonSaved:500, points:83, route:'午间散步' },
];

export const MOCK_CARBON_REWARDS = [
  { id:'rw1', name:'公交9折优惠券', description:'乘坐公交享9折优惠，有效期30天', cost:200, type:'coupon' as const, image:'', stock:999 },
  { id:'rw2', name:'地铁5次免费卡', description:'地铁免费乘坐5次', cost:500, type:'ticket' as const, image:'', stock:500 },
  { id:'rw3', name:'共享单车月卡', description:'美团单车月卡，30天无限次', cost:800, type:'discount' as const, image:'', stock:200 },
  { id:'rw4', name:'停车费抵扣券', description:'合作停车场5元抵扣券', cost:150, type:'coupon' as const, image:'', stock:1000 },
];
