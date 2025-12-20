import { WorldPlot, Furniture, PlotTemplate } from '../types';

// ==========================================
// 🗺️ 默认世界布局 (World Layout)
// 基于用户上传的 JSON 地图数据
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
      "rotation": 0,
      "homeId": "plot_1766149173114_unit"
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
    }
];