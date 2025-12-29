import { WorldPlot, Furniture, RoomDef } from '../types';

// ==========================================
// 🗺️ 默认世界布局 (World Layout)
// 由 simgod_map_1766416388927.json 转换
// ==========================================

export const WORLD_LAYOUT: WorldPlot[] = [
  {
    "id": "plot_1766148335940",
    "templateId": "apt_luxury_l",
    "x": 470,
    "y": 540
  },
  {
    "id": "plot_1766148349422",
    "templateId": "apt_luxury_s",
    "x": 260,
    "y": 770
  },
  {
    "id": "plot_1766148358724",
    "templateId": "apt_luxury_m",
    "x": 470,
    "y": 770
  },
  {
    "id": "plot_1766148393622",
    "templateId": "clothing_s",
    "x": 870,
    "y": 670
  },
  {
    "id": "plot_1766148407587",
    "templateId": "super_l",
    "x": 870,
    "y": 460
  },
  {
    "id": "plot_1766148422808",
    "templateId": "convenience_l",
    "x": 1160,
    "y": 460
  },
  {
    "id": "plot_1766148430672",
    "templateId": "bookstore_s",
    "x": 1340,
    "y": 460
  },
  {
    "id": "plot_1766148453489",
    "templateId": "restaurant_s",
    "x": 1670,
    "y": 460
  },
  {
    "id": "plot_1766148495204",
    "templateId": "convenience_l",
    "x": 1860,
    "y": 460
  },
  {
    "id": "plot_1766148551070",
    "templateId": "convenience_s",
    "x": 870,
    "y": 1150
  },
  {
    "id": "plot_1766148562820",
    "templateId": "elder_home_s",
    "x": 250,
    "y": 1150
  },
  {
    "id": "plot_1766148582684",
    "templateId": "apt_cheap_l",
    "x": 530,
    "y": 1150
  },
  {
    "id": "plot_1766148654923",
    "templateId": "convenience_m",
    "x": 850,
    "y": 1500
  },
  {
    "id": "plot_1766148757939",
    "templateId": "school_high_l",
    "x": 1920,
    "y": 1790
  },
  {
    "id": "plot_1766148799587",
    "templateId": "villa_m",
    "x": 1120,
    "y": 1760
  },
  {
    "id": "plot_1766148838101",
    "templateId": "kindergarten_l",
    "x": 750,
    "y": 1770,
    "width": 350,
    "height": 200
  },
  {
    "id": "plot_1766148853318",
    "templateId": "school_elem_s",
    "x": 470,
    "y": 1580
  },
  {
    "id": "plot_1766148865251",
    "templateId": "hospital_l",
    "x": 2470,
    "y": 1380
  },
  {
    "id": "plot_1766148905301",
    "templateId": "cinema_s",
    "x": 2470,
    "y": 1150
  },
  {
    "id": "plot_1766148925833",
    "templateId": "cafe_l",
    "x": 2460,
    "y": 730
  },
  {
    "id": "plot_1766148984082",
    "templateId": "business_l",
    "x": 1670,
    "y": 0
  },
  {
    "id": "plot_1766149124198",
    "templateId": "gallery_l",
    "x": 1250,
    "y": 30
  },
  {
    "id": "plot_1766149159115",
    "templateId": "design_s",
    "x": 760,
    "y": 130,
    "width": 300,
    "height": 200
  },
  {
    "id": "plot_1766149246230",
    "templateId": "school_high_s",
    "x": 2470,
    "y": 430
  },
  {
    "id": "plot_1766149324514",
    "templateId": "kindergarten_m",
    "x": 2050,
    "y": 440
  },
  {
    "id": "plot_1766149365930",
    "templateId": "cafe_s",
    "x": 2170,
    "y": 1150
  },
  {
    "id": "plot_1766149401707",
    "templateId": "gym_center",
    "x": 1060,
    "y": 30
  },
  {
    "id": "plot_1766149499216",
    "templateId": "nightclub_m",
    "x": 2660,
    "y": 730,
    "width": 300,
    "height": 250
  },
  {
    "id": "plot_1766149512633",
    "templateId": "netcafe_s",
    "x": 2730,
    "y": 1140
  },
  {
    "id": "plot_1766149526965",
    "templateId": "clothing_s",
    "x": 2170,
    "y": 670
  },
  {
    "id": "plot_1766149547032",
    "templateId": "design_m",
    "x": 2080,
    "y": 85,
    "width": 300,
    "height": 250
  },
  {
    "id": "plot_1766149571678",
    "templateId": "villa_s",
    "x": 2350,
    "y": 1790
  },
  {
    "id": "plot_1766149594944",
    "templateId": "apt_cheap_s",
    "x": 1030,
    "y": 1500
  },
  {
    "id": "plot_1766149598128",
    "templateId": "apt_cheap_s",
    "x": 2000,
    "y": 1500
  },
  {
    "id": "plot_1766149608745",
    "templateId": "internet_s",
    "x": 1670,
    "y": 1790,
    "width": 250,
    "height": 250
  },
  {
    "id": "plot_1766149627595",
    "templateId": "apt_cheap_l",
    "x": 530,
    "y": 1330
  },
  {
    "id": "plot_1766149644374",
    "templateId": "restaurant_s",
    "x": 2170,
    "y": 1500,
    "width": 200,
    "height": 200
  },
  {
    "id": "plot_1766149759760",
    "templateId": "library_s",
    "x": 1680,
    "y": 1510,
    "width": 300,
    "height": 150
  },
  {
    "id": "plot_1766149874910",
    "templateId": "apt_luxury_m",
    "x": 1190,
    "y": 1490,
    "width": 300,
    "height": 200
  }
];

export const STREET_PROPS: Furniture[] = [
  {
    "label": "标准工位",
    "w": 50,
    "h": 40,
    "color": "#dfe6e9",
    "utility": "work",
    "pixelPattern": "desk_pixel",
    "tags": [
      "computer",
      "desk"
    ],
    "id": "custom_1766150115823_ip1f6",
    "x": 1680,
    "y": 1920,
    "rotation": 0
  },
  {
    "label": "标准工位",
    "w": 50,
    "h": 40,
    "color": "#dfe6e9",
    "utility": "work",
    "pixelPattern": "desk_pixel",
    "tags": [
      "computer",
      "desk"
    ],
    "id": "custom_1766150120005_sbz0f",
    "x": 1750,
    "y": 1920,
    "rotation": 0
  },
  {
    "label": "灌木",
    "w": 30,
    "h": 30,
    "color": "#2ecc71",
    "utility": "none",
    "pixelPattern": "bush",
    "tags": [
      "plant"
    ],
    "id": "custom_1766150136717_48mpr",
    "x": 1460,
    "y": 1970,
    "rotation": 0,
    "homeId": "plot_1766148799587_unit"
  },
  {
    "label": "标准工位",
    "w": 50,
    "h": 40,
    "color": "#dfe6e9",
    "utility": "work",
    "pixelPattern": "desk_pixel",
    "tags": [
      "computer",
      "desk"
    ],
    "id": "custom_1766150284238_occ49",
    "x": 820,
    "y": 190,
    "rotation": 0
  },
  {
    "label": "标准工位",
    "w": 50,
    "h": 40,
    "color": "#dfe6e9",
    "utility": "work",
    "pixelPattern": "desk_pixel",
    "tags": [
      "computer",
      "desk"
    ],
    "id": "custom_1766150332255_nys8z",
    "x": 2280,
    "y": 120,
    "rotation": 0
  },
  {
    "label": "标准工位",
    "w": 50,
    "h": 40,
    "color": "#dfe6e9",
    "utility": "work",
    "pixelPattern": "desk_pixel",
    "tags": [
      "computer",
      "desk"
    ],
    "id": "custom_1766150335551_q7pie",
    "x": 2280,
    "y": 190,
    "rotation": 0
  },
  {
    "label": "单人床",
    "w": 50,
    "h": 80,
    "color": "#ffffff",
    "utility": "energy",
    "pixelPattern": "bed_king",
    "tags": [
      "bed",
      "sleep"
    ],
    "id": "custom_1766150373083_568i6",
    "x": 280,
    "y": 1460,
    "rotation": 0,
    "homeId": "plot_1766148562820_unit"
  },
  {
    "label": "单人床",
    "w": 50,
    "h": 80,
    "color": "#ffffff",
    "utility": "energy",
    "pixelPattern": "bed_king",
    "tags": [
      "bed",
      "sleep"
    ],
    "id": "custom_1766150377301_zafqo",
    "x": 350,
    "y": 1460,
    "rotation": 0,
    "homeId": "plot_1766148562820_unit"
  },
  {
    "label": "自动贩卖机",
    "w": 40,
    "h": 30,
    "color": "#ff5252",
    "utility": "buy_drink",
    "pixelPattern": "vending",
    "tags": [
      "shop"
    ],
    "id": "custom_1766416139711_vvun6",
    "x": 980,
    "y": 980,
    "rotation": 0
  },
  {
    "label": "自动贩卖机",
    "w": 40,
    "h": 30,
    "color": "#f7d794",
    "utility": "buy_drink",
    "pixelPattern": "vending",
    "tags": [
      "shop"
    ],
    "id": "custom_1766416167600_8mh16",
    "x": 930,
    "y": 980,
    "rotation": 0
  },
  {
    "label": "自动贩卖机",
    "w": 40,
    "h": 30,
    "color": "#6c5ce7",
    "utility": "buy_drink",
    "pixelPattern": "vending",
    "tags": [
      "shop"
    ],
    "id": "custom_1766416182530_doa7t",
    "x": 1330,
    "y": 660,
    "rotation": 0
  },
  {
    "label": "自动贩卖机",
    "w": 40,
    "h": 30,
    "color": "#6c5ce7",
    "utility": "buy_drink",
    "pixelPattern": "vending",
    "tags": [
      "shop"
    ],
    "id": "custom_1766416221133_osuwd",
    "x": 1840,
    "y": 660,
    "rotation": 0
  },
  {
    "label": "垃圾桶",
    "w": 20,
    "h": 20,
    "color": "#636e72",
    "utility": "none",
    "pixelPattern": "trash",
    "tags": [
      "decor"
    ],
    "id": "custom_1766416229470_zgflu",
    "x": 1680,
    "y": 670,
    "rotation": 0
  },
  {
    "label": "垃圾桶",
    "w": 20,
    "h": 20,
    "color": "#636e72",
    "utility": "none",
    "pixelPattern": "trash",
    "tags": [
      "decor"
    ],
    "id": "custom_1766416235030_o2hbx",
    "x": 1490,
    "y": 670,
    "rotation": 0
  },
  {
    "label": "垃圾桶",
    "w": 20,
    "h": 20,
    "color": "#636e72",
    "utility": "none",
    "pixelPattern": "trash",
    "tags": [
      "decor"
    ],
    "id": "custom_1766416240912_y169s",
    "x": 2160,
    "y": 990,
    "rotation": 0
  },
  {
    "label": "垃圾桶",
    "w": 20,
    "h": 20,
    "color": "#636e72",
    "utility": "none",
    "pixelPattern": "trash",
    "tags": [
      "decor"
    ],
    "id": "custom_1766416252043_2f5k9",
    "x": 2660,
    "y": 990,
    "rotation": 0
  },
  {
    "label": "垃圾桶",
    "w": 20,
    "h": 20,
    "color": "#636e72",
    "utility": "none",
    "pixelPattern": "trash",
    "tags": [
      "decor"
    ],
    "id": "custom_1766416258714_6z7e5",
    "x": 2300,
    "y": 1470,
    "rotation": 0
  },
  {
    "label": "垃圾桶",
    "w": 20,
    "h": 20,
    "color": "#636e72",
    "utility": "none",
    "pixelPattern": "trash",
    "tags": [
      "decor"
    ],
    "id": "custom_1766416263383_debtq",
    "x": 1490,
    "y": 1480,
    "rotation": 0
  },
  {
    "label": "垃圾桶",
    "w": 20,
    "h": 20,
    "color": "#636e72",
    "utility": "none",
    "pixelPattern": "trash",
    "tags": [
      "decor"
    ],
    "id": "custom_1766416270666_1mcoz",
    "x": 2470,
    "y": 1710,
    "rotation": 0
  },
  {
    "label": "垃圾桶",
    "w": 20,
    "h": 20,
    "color": "#636e72",
    "utility": "none",
    "pixelPattern": "trash",
    "tags": [
      "decor"
    ],
    "id": "custom_1766416282709_ge0fv",
    "x": 1200,
    "y": 1340,
    "rotation": 0
  },
  {
    "label": "垃圾桶",
    "w": 20,
    "h": 20,
    "color": "#636e72",
    "utility": "none",
    "pixelPattern": "trash",
    "tags": [
      "decor"
    ],
    "id": "custom_1766416287860_cnja3",
    "x": 690,
    "y": 1510,
    "rotation": 0
  },
  {
    "label": "垃圾桶",
    "w": 20,
    "h": 20,
    "color": "#636e72",
    "utility": "none",
    "pixelPattern": "trash",
    "tags": [
      "decor"
    ],
    "id": "custom_1766416292793_2ep76",
    "x": 1040,
    "y": 1780,
    "rotation": 0
  },
  {
    "label": "灌木",
    "w": 30,
    "h": 30,
    "color": "#636e72",
    "utility": "none",
    "pixelPattern": "bush",
    "tags": [
      "plant"
    ],
    "id": "custom_1766416304116_yd40o",
    "x": 1430,
    "y": 920,
    "rotation": 0
  },
  {
    "label": "灌木",
    "w": 30,
    "h": 30,
    "color": "#636e72",
    "utility": "none",
    "pixelPattern": "bush",
    "tags": [
      "plant"
    ],
    "id": "custom_1766416309048_m4ect",
    "x": 1880,
    "y": 930,
    "rotation": 0
  },
  {
    "label": "灌木",
    "w": 30,
    "h": 30,
    "color": "#636e72",
    "utility": "none",
    "pixelPattern": "bush",
    "tags": [
      "plant"
    ],
    "id": "custom_1766416313300_lx6or",
    "x": 1870,
    "y": 1200,
    "rotation": 0
  },
  {
    "label": "公园长椅",
    "w": 60,
    "h": 20,
    "color": "#e17055",
    "utility": "comfort",
    "pixelPattern": "bench_park",
    "tags": [
      "seat"
    ],
    "id": "custom_1766416323102_seb9w",
    "x": 1340,
    "y": 1120,
    "rotation": 0
  },
  {
    "label": "公园长椅",
    "w": 60,
    "h": 20,
    "color": "#e17055",
    "utility": "comfort",
    "pixelPattern": "bench_park",
    "tags": [
      "seat"
    ],
    "id": "custom_1766416330749_rskma",
    "x": 1340,
    "y": 1010,
    "rotation": 0
  },
  {
    "label": "公园长椅",
    "w": 60,
    "h": 20,
    "color": "#e17055",
    "utility": "comfort",
    "pixelPattern": "bench_park",
    "tags": [
      "seat"
    ],
    "id": "custom_1766416342448_3dwa7",
    "x": 1800,
    "y": 1010,
    "rotation": 0
  },
  {
    "label": "公园长椅",
    "w": 60,
    "h": 20,
    "color": "#e17055",
    "utility": "comfort",
    "pixelPattern": "bench_park",
    "tags": [
      "seat"
    ],
    "id": "custom_1766416355929_g3a0a",
    "x": 1800,
    "y": 1110,
    "rotation": 0
  }
];

// ⚠️ 以下房间数据包含了自定义的墙体和地板布局
// 如果你需要游戏加载这些自定义布局，请确保在游戏初始化逻辑中使用了 WORLD_ROOMS
export const WORLD_ROOMS: RoomDef[] = [
  {
    "id": "plot_1766148335940_main",
    "x": 475,
    "y": 545,
    "w": 250,
    "h": 225,
    "label": "大平层",
    "color": "#f5f6fa",
    "pixelPattern": "wood",
    "hasWall": true,
    "homeId": "plot_1766148335940_unit"
  },
  {
    "id": "plot_1766148349422_living",
    "x": 265,
    "y": 775,
    "w": 100,
    "h": 210,
    "label": "厅",
    "color": "#fff",
    "pixelPattern": "wood",
    "hasWall": true,
    "homeId": "plot_1766148349422_unit"
  },
  {
    "id": "plot_1766148349422_rooms",
    "x": 370,
    "y": 775,
    "w": 100,
    "h": 210,
    "label": "卧",
    "color": "#f1f2f6",
    "pixelPattern": "wood",
    "hasWall": true,
    "homeId": "plot_1766148349422_unit"
  },
  {
    "id": "plot_1766148358724_main",
    "x": 475,
    "y": 775,
    "w": 250,
    "h": 210,
    "label": "全屋",
    "color": "#f5f6fa",
    "pixelPattern": "wood",
    "hasWall": true,
    "homeId": "plot_1766148358724_unit"
  },
  {
    "id": "plot_1766148393622_main",
    "x": 875,
    "y": 675,
    "w": 145,
    "h": 315,
    "label": "潮牌",
    "color": "#f5f6fa",
    "pixelPattern": "tile",
    "hasWall": true
  },
  {
    "id": "plot_1766148407587_main",
    "x": 875,
    "y": 465,
    "w": 280,
    "h": 195,
    "label": "大卖场",
    "color": "#fff",
    "pixelPattern": "tile",
    "hasWall": true
  },
  {
    "id": "plot_1766148422808_main",
    "x": 1165,
    "y": 465,
    "w": 180,
    "h": 195,
    "label": "24h店",
    "color": "#fff",
    "pixelPattern": "tile",
    "hasWall": true
  },
  {
    "id": "plot_1766148430672_main",
    "x": 1345,
    "y": 465,
    "w": 180,
    "h": 195,
    "label": "书店",
    "color": "#f7f1e3",
    "pixelPattern": "wood",
    "hasWall": true
  },
  {
    "id": "plot_1766148453489_main",
    "x": 1675,
    "y": 465,
    "w": 180,
    "h": 195,
    "label": "小餐馆",
    "color": "#ffeb3b",
    "pixelPattern": "tile",
    "hasWall": true
  },
  {
    "id": "plot_1766148495204_main",
    "x": 1865,
    "y": 465,
    "w": 180,
    "h": 195,
    "label": "24h店",
    "color": "#fff",
    "pixelPattern": "tile",
    "hasWall": true
  },
  {
    "id": "plot_1766148551070_main",
    "x": 875,
    "y": 1155,
    "w": 145,
    "h": 185,
    "label": "小店",
    "color": "#fff",
    "pixelPattern": "tile",
    "hasWall": true
  },
  {
    "id": "plot_1766148562820_main",
    "x": 255,
    "y": 1155,
    "w": 270,
    "h": 415,
    "label": "养老院",
    "color": "#f0fff4",
    "pixelPattern": "tile",
    "hasWall": true,
    "homeId": "plot_1766148562820_unit"
  },
  {
    "id": "plot_1766148582684_main",
    "x": 535,
    "y": 1155,
    "w": 185,
    "h": 170,
    "label": "房间",
    "color": "#f5f6fa",
    "pixelPattern": "wood",
    "hasWall": true,
    "homeId": "plot_1766148582684_unit"
  },
  {
    "id": "plot_1766148654923_main",
    "x": 855,
    "y": 1505,
    "w": 160,
    "h": 160,
    "label": "便利店",
    "color": "#fff",
    "pixelPattern": "tile",
    "hasWall": true
  },
  {
    "id": "plot_1766148757939_class",
    "x": 1925,
    "y": 1795,
    "w": 260,
    "h": 295,
    "label": "教学楼",
    "color": "#dfe6e9",
    "pixelPattern": "wood",
    "hasWall": true
  },
  {
    "id": "plot_1766148757939_field",
    "x": 2190,
    "y": 1795,
    "w": 150,
    "h": 295,
    "label": "大操场",
    "color": "#27ae60",
    "pixelPattern": "grass",
    "hasWall": false
  },
  {
    "id": "plot_1766148799587_garden",
    "x": 1120,
    "y": 1760,
    "w": 405,
    "h": 285,
    "label": "花园",
    "color": "#55efc4",
    "pixelPattern": "grass"
  },
  {
    "id": "plot_1766148799587_house",
    "x": 1140,
    "y": 1780,
    "w": 280,
    "h": 245,
    "label": "主楼",
    "color": "#fff",
    "pixelPattern": "wood",
    "hasWall": true,
    "homeId": "plot_1766148799587_unit"
  },
  {
    "id": "plot_1766148799587_study",
    "x": 1430,
    "y": 1780,
    "w": 80,
    "h": 100,
    "label": "书房",
    "color": "#dfe6e9",
    "pixelPattern": "wood",
    "hasWall": true,
    "homeId": "plot_1766148799587_unit"
  },
  {
    "id": "plot_1766148838101_play",
    "x": 755,
    "y": 1775,
    "w": 200,
    "h": 220,
    "label": "双语幼儿园",
    "color": "#ff9ff3",
    "pixelPattern": "wood",
    "hasWall": true
  },
  {
    "id": "plot_1766148838101_nap",
    "x": 960,
    "y": 1775,
    "w": 70,
    "h": 220,
    "label": "静音房",
    "color": "#74b9ff",
    "pixelPattern": "simple",
    "hasWall": true
  },
  {
    "id": "plot_1766148853318_class",
    "x": 475,
    "y": 1585,
    "w": 150,
    "h": 290,
    "label": "教学",
    "color": "#dfe6e9",
    "pixelPattern": "wood",
    "hasWall": true
  },
  {
    "id": "plot_1766148853318_field",
    "x": 630,
    "y": 1585,
    "w": 95,
    "h": 290,
    "label": "操场",
    "color": "#27ae60",
    "pixelPattern": "grass",
    "hasWall": false
  },
  {
    "id": "plot_1766148865251_out",
    "x": 2475,
    "y": 1385,
    "w": 150,
    "h": 315,
    "label": "门诊部",
    "color": "#fff",
    "pixelPattern": "tile",
    "hasWall": true
  },
  {
    "id": "plot_1766148865251_in",
    "x": 2630,
    "y": 1385,
    "w": 245,
    "h": 315,
    "label": "住院部",
    "color": "#dff9fb",
    "pixelPattern": "simple",
    "hasWall": true
  },
  {
    "id": "plot_1766148905301_hall",
    "x": 2475,
    "y": 1155,
    "w": 250,
    "h": 220,
    "label": "影厅",
    "color": "#2d3436",
    "pixelPattern": "simple",
    "hasWall": true
  },
  {
    "id": "plot_1766148925833_main",
    "x": 2465,
    "y": 735,
    "w": 190,
    "h": 250,
    "label": "精品咖啡",
    "color": "#d4a373",
    "pixelPattern": "wood",
    "hasWall": true
  },
  {
    "id": "plot_1766148984082_main",
    "x": 1675,
    "y": 5,
    "w": 400,
    "h": 315,
    "label": "金融中心",
    "color": "#ced6e0",
    "pixelPattern": "tile",
    "hasWall": true
  },
  {
    "id": "plot_1766149124198_main",
    "x": 1255,
    "y": 35,
    "w": 260,
    "h": 295,
    "label": "美术馆",
    "color": "#f5f6fa",
    "pixelPattern": "tile",
    "hasWall": true
  },
  {
    "id": "plot_1766149159115_main",
    "x": 765,
    "y": 135,
    "w": 185,
    "h": 230,
    "label": "工作室",
    "color": "#fff0f0",
    "pixelPattern": "wood",
    "hasWall": true
  },
  {
    "id": "plot_1766149246230_class",
    "x": 2475,
    "y": 435,
    "w": 260,
    "h": 200,
    "label": "教学楼",
    "color": "#dfe6e9",
    "pixelPattern": "wood",
    "hasWall": true
  },
  {
    "id": "plot_1766149246230_field",
    "x": 2475,
    "y": 640,
    "w": 260,
    "h": 90,
    "label": "操场",
    "color": "#27ae60",
    "pixelPattern": "grass",
    "hasWall": false
  },
  {
    "id": "plot_1766149324514_play",
    "x": 2055,
    "y": 445,
    "w": 180,
    "h": 210,
    "label": "幼儿园",
    "color": "#ff9ff3",
    "pixelPattern": "wood",
    "hasWall": true
  },
  {
    "id": "plot_1766149324514_nap",
    "x": 2240,
    "y": 445,
    "w": 65,
    "h": 210,
    "label": "午睡房",
    "color": "#74b9ff",
    "pixelPattern": "simple",
    "hasWall": true
  },
  {
    "id": "plot_1766149365930_main",
    "x": 2175,
    "y": 1155,
    "w": 145,
    "h": 185,
    "label": "小咖",
    "color": "#d4a373",
    "pixelPattern": "wood",
    "hasWall": true
  },
  {
    "id": "plot_1766149401707_main",
    "x": 1065,
    "y": 35,
    "w": 180,
    "h": 295,
    "label": "健身室",
    "color": "#2f3542",
    "pixelPattern": "tile",
    "hasWall": true
  },
  {
    "id": "plot_1766149499216_main",
    "x": 2665,
    "y": 735,
    "w": 275,
    "h": 220,
    "label": "夜店",
    "color": "#000",
    "pixelPattern": "stripes",
    "hasWall": true
  },
  {
    "id": "plot_1766149512633_main",
    "x": 2735,
    "y": 1145,
    "w": 185,
    "h": 230,
    "label": "网吧",
    "color": "#2f3542",
    "pixelPattern": "grid",
    "hasWall": true
  },
  {
    "id": "plot_1766149526965_main",
    "x": 2175,
    "y": 675,
    "w": 145,
    "h": 315,
    "label": "潮牌",
    "color": "#f5f6fa",
    "pixelPattern": "tile",
    "hasWall": true
  },
  {
    "id": "plot_1766149547032_main",
    "x": 2085,
    "y": 90,
    "w": 250,
    "h": 225,
    "label": "设计部",
    "color": "#fff0f0",
    "pixelPattern": "wood",
    "hasWall": true
  },
  {
    "id": "plot_1766149571678_garden",
    "x": 2350,
    "y": 1790,
    "w": 370,
    "h": 290,
    "label": "花园",
    "color": "#55efc4",
    "pixelPattern": "grass"
  },
  {
    "id": "plot_1766149571678_house",
    "x": 2370,
    "y": 1810,
    "w": 250,
    "h": 250,
    "label": "主楼",
    "color": "#fff",
    "pixelPattern": "wood",
    "hasWall": true,
    "homeId": "plot_1766149571678_unit"
  },
  {
    "id": "plot_1766149571678_study",
    "x": 2630,
    "y": 1810,
    "w": 80,
    "h": 100,
    "label": "书房",
    "color": "#dfe6e9",
    "pixelPattern": "wood",
    "hasWall": true,
    "homeId": "plot_1766149571678_unit"
  },
  {
    "id": "plot_1766149594944_main",
    "x": 1035,
    "y": 1505,
    "w": 160,
    "h": 160,
    "label": "房间",
    "color": "#f5f6fa",
    "pixelPattern": "wood",
    "hasWall": true,
    "homeId": "plot_1766149594944_unit"
  },
  {
    "id": "plot_1766149598128_main",
    "x": 2005,
    "y": 1505,
    "w": 160,
    "h": 160,
    "label": "房间",
    "color": "#f5f6fa",
    "pixelPattern": "wood",
    "hasWall": true,
    "homeId": "plot_1766149598128_unit"
  },
  {
    "id": "plot_1766149608745_main",
    "x": 1675,
    "y": 1795,
    "w": 250,
    "h": 220,
    "label": "初创IT",
    "color": "#f1f2f6",
    "pixelPattern": "grid",
    "hasWall": true
  },
  {
    "id": "plot_1766149627595_main",
    "x": 535,
    "y": 1335,
    "w": 185,
    "h": 170,
    "label": "房间",
    "color": "#f5f6fa",
    "pixelPattern": "wood",
    "hasWall": true,
    "homeId": "plot_1766149627595_unit"
  },
  {
    "id": "plot_1766149644374_main",
    "x": 2175,
    "y": 1505,
    "w": 180,
    "h": 195,
    "label": "小餐馆",
    "color": "#ffeb3b",
    "pixelPattern": "tile",
    "hasWall": true
  },
  {
    "id": "plot_1766149759760_main",
    "x": 1685,
    "y": 1515,
    "w": 190,
    "h": 250,
    "label": "阅览室",
    "color": "#f7f1e3",
    "pixelPattern": "wood",
    "hasWall": true
  },
  {
    "id": "plot_1766149874910_main",
    "x": 1195,
    "y": 1495,
    "w": 250,
    "h": 210,
    "label": "全屋",
    "color": "#f5f6fa",
    "pixelPattern": "wood",
    "hasWall": true,
    "homeId": "plot_1766149874910_unit"
  }
];