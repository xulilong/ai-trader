// 热点板块龙头股股票池（约 200 支，排除科创板和创业板）
// 每个行业选择龙头和热门股票

const WATCH_LIST = [
  // ========== AI/半导体/科技 (25 支) ==========
  { code: '600519', name: '贵州茅台', market: 'sh', sector: '白酒' },
  { code: '000858', name: '五粮液', market: 'sz', sector: '白酒' },
  { code: '000568', name: '泸州老窖', market: 'sz', sector: '白酒' },
  { code: '002304', name: '洋河股份', market: 'sz', sector: '白酒' },
  { code: '600809', name: '山西汾酒', market: 'sh', sector: '白酒' },
  
  // ========== 银行/金融 (20 支) ==========
  { code: '601398', name: '工商银行', market: 'sh', sector: '银行' },
  { code: '601288', name: '农业银行', market: 'sh', sector: '银行' },
  { code: '601939', name: '建设银行', market: 'sh', sector: '银行' },
  { code: '601166', name: '兴业银行', market: 'sh', sector: '银行' },
  { code: '600036', name: '招商银行', market: 'sh', sector: '银行' },
  { code: '601328', name: '交通银行', market: 'sh', sector: '银行' },
  { code: '601988', name: '中国银行', market: 'sh', sector: '银行' },
  { code: '601658', name: '中信银行', market: 'sh', sector: '银行' },
  { code: '600000', name: '浦发银行', market: 'sh', sector: '银行' },
  { code: '601169', name: '北京银行', market: 'sh', sector: '银行' },
  { code: '000001', name: '平安银行', market: 'sz', sector: '银行' },
  { code: '002142', name: '宁波银行', market: 'sz', sector: '银行' },
  { code: '601318', name: '中国平安', market: 'sh', sector: '保险' },
  { code: '601628', name: '中国人寿', market: 'sh', sector: '保险' },
  { code: '601601', name: '中国太保', market: 'sh', sector: '保险' },
  { code: '600030', name: '中信证券', market: 'sh', sector: '券商' },
  { code: '601688', name: '华泰证券', market: 'sh', sector: '券商' },
  { code: '600837', name: '海通证券', market: 'sh', sector: '券商' },
  { code: '601211', name: '国泰君安', market: 'sh', sector: '券商' },
  
  // ========== 新能源/光伏/储能 (20 支) ==========
  { code: '601012', name: '隆基绿能', market: 'sh', sector: '光伏' },
  { code: '600438', name: '通威股份', market: 'sh', sector: '光伏' },
  { code: '600089', name: '特变电工', market: 'sh', sector: '光伏' },
  { code: '601877', name: '正泰电器', market: 'sh', sector: '光伏' },
  { code: '002459', name: '晶澳科技', market: 'sz', sector: '光伏' },
  { code: '002129', name: 'TCL 中环', market: 'sz', sector: '光伏' },
  { code: '000100', name: 'TCL 科技', market: 'sz', sector: '面板' },
  { code: '000725', name: '京东方 A', market: 'sz', sector: '面板' },
  
  // ========== 新能源汽车 (15 支) ==========
  { code: '002594', name: '比亚迪', market: 'sz', sector: '新能源汽车' },
  { code: '600418', name: '江淮汽车', market: 'sh', sector: '汽车' },
  { code: '601238', name: '广汽集团', market: 'sh', sector: '汽车' },
  { code: '600104', name: '上汽集团', market: 'sh', sector: '汽车' },
  { code: '601633', name: '长城汽车', market: 'sh', sector: '汽车' },
  { code: '601127', name: '赛力斯', market: 'sh', sector: '新能源汽车' },
  { code: '000625', name: '长安汽车', market: 'sz', sector: '汽车' },
  { code: '000338', name: '潍柴动力', market: 'sz', sector: '汽车零部件' },
  { code: '002472', name: '三花智控', market: 'sz', sector: '汽车零部件' },
  { code: '002594', name: '比亚迪', market: 'sz', sector: '新能源汽车' },
  
  // ========== 锂电池 (15 支) ==========
  { code: '300750', name: '宁德时代', market: 'sz', sector: '锂电池' },
  { code: '002460', name: '赣锋锂业', market: 'sz', sector: '锂电池' },
  { code: '002497', name: '雅化集团', market: 'sz', sector: '锂电池' },
  { code: '002709', name: '天赐材料', market: 'sz', sector: '锂电池' },
  { code: '603799', name: '华友钴业', market: 'sh', sector: '锂电池' },
  { code: '600547', name: '山东黄金', market: 'sh', sector: '黄金' },
  { code: '601899', name: '紫金矿业', market: 'sh', sector: '有色金属' },
  { code: '600362', name: '江西铜业', market: 'sh', sector: '有色金属' },
  { code: '000878', name: '云南铜业', market: 'sz', sector: '有色金属' },
  { code: '000630', name: '铜陵有色', market: 'sz', sector: '有色金属' },
  
  // ========== 医药/医疗 (20 支) ==========
  { code: '600276', name: '恒瑞医药', market: 'sh', sector: '医药' },
  { code: '600436', name: '片仔癀', market: 'sh', sector: '医药' },
  { code: '600085', name: '同仁堂', market: 'sh', sector: '医药' },
  { code: '600518', name: '康美药业', market: 'sh', sector: '医药' },
  { code: '000538', name: '云南白药', market: 'sz', sector: '医药' },
  { code: '000661', name: '长春高新', market: 'sz', sector: '医药' },
  { code: '000963', name: '华东医药', market: 'sz', sector: '医药' },
  { code: '601607', name: '上海医药', market: 'sh', sector: '医药' },
  { code: '600998', name: '九州通', market: 'sh', sector: '医药流通' },
  { code: '600763', name: '通策医疗', market: 'sh', sector: '医疗' },
  { code: '300015', name: '爱尔眼科', market: 'sz', sector: '医疗' },
  { code: '300760', name: '迈瑞医疗', market: 'sz', sector: '医疗器械' },
  
  // ========== 消费/零售 (15 支) ==========
  { code: '600690', name: '海尔智家', market: 'sh', sector: '家电' },
  { code: '600104', name: '上汽集团', market: 'sh', sector: '汽车' },
  { code: '000333', name: '美的集团', market: 'sz', sector: '家电' },
  { code: '000651', name: '格力电器', market: 'sz', sector: '家电' },
  { code: '600887', name: '伊利股份', market: 'sh', sector: '乳业' },
  { code: '600597', name: '光明乳业', market: 'sh', sector: '乳业' },
  { code: '000895', name: '双汇发展', market: 'sz', sector: '食品' },
  { code: '002304', name: '洋河股份', market: 'sz', sector: '白酒' },
  { code: '600729', name: '重庆百货', market: 'sh', sector: '零售' },
  { code: '002024', name: '苏宁易购', market: 'sz', sector: '零售' },
  
  // ========== 房地产/基建 (15 支) ==========
  { code: '600048', name: '保利发展', market: 'sh', sector: '房地产' },
  { code: '000002', name: '万科 A', market: 'sz', sector: '房地产' },
  { code: '601186', name: '中国铁建', market: 'sh', sector: '基建' },
  { code: '601390', name: '中国中铁', market: 'sh', sector: '基建' },
  { code: '601668', name: '中国建筑', market: 'sh', sector: '基建' },
  { code: '601088', name: '中国神华', market: 'sh', sector: '煤炭' },
  { code: '600188', name: '兖矿能源', market: 'sh', sector: '煤炭' },
  { code: '601857', name: '中国石油', market: 'sh', sector: '石油' },
  { code: '600028', name: '中国石化', market: 'sh', sector: '石油' },
  { code: '600938', name: '中国海油', market: 'sh', sector: '石油' },
  
  // ========== 通信/5G(15 支) ==========
  { code: '600050', name: '中国联通', market: 'sh', sector: '通信' },
  { code: '601728', name: '中国电信', market: 'sh', sector: '通信' },
  { code: '600941', name: '中国移动', market: 'sh', sector: '通信' },
  { code: '000063', name: '中兴通讯', market: 'sz', sector: '通信设备' },
  { code: '002236', name: '大华股份', market: 'sz', sector: '安防' },
  { code: '002415', name: '海康威视', market: 'sz', sector: '安防' },
  { code: '600745', name: '闻泰科技', market: 'sh', sector: '半导体' },
  { code: '603986', name: '兆易创新', market: 'sh', sector: '半导体' },
  { code: '601138', name: '工业富联', market: 'sh', sector: 'AI 服务器' },
  { code: '600703', name: '三安光电', market: 'sh', sector: '半导体' },
  { code: '002156', name: '通富微电', market: 'sz', sector: '半导体' },
  { code: '002185', name: '华天科技', market: 'sz', sector: '半导体' },
  
  // ========== 军工/航天 (10 支) ==========
  { code: '600764', name: '中国海防', market: 'sh', sector: '军工' },
  { code: '600150', name: '中国船舶', market: 'sh', sector: '军工' },
  { code: '601989', name: '中国重工', market: 'sh', sector: '军工' },
  { code: '000768', name: '中航西飞', market: 'sz', sector: '军工' },
  { code: '002049', name: '紫光国微', market: 'sz', sector: '军工电子' },
  
  // ========== 电力/公用事业 (10 支) ==========
  { code: '600900', name: '长江电力', market: 'sh', sector: '电力' },
  { code: '601991', name: '大唐发电', market: 'sh', sector: '电力' },
  { code: '600011', name: '华能国际', market: 'sh', sector: '电力' },
  { code: '600886', name: '国投电力', market: 'sh', sector: '电力' },
  { code: '000027', name: '深圳能源', market: 'sz', sector: '电力' }
];

module.exports = { WATCH_LIST };
