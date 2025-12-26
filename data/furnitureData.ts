import { Furniture } from '../types';

// ==========================================
// 1. 世界地表与装饰 (World Mode 专用)
// ==========================================
export const WORLD_DECOR_ITEMS = [
    // 🌳 大型景观 (仍然建议作为 Plot 地皮处理，因为它们体积大)
    { id: 'decor_tree_1', label: '🌳 大树', w: 100, h: 100, color: '#27ae60' },
    { id: 'decor_fountain', label: '⛲ 喷泉', w: 80, h: 80, color: '#74b9ff' },
];

export const WORLD_SURFACE_ITEMS = [
    { id: 'surface_water', label: '💧 水域', w: 100, h: 100, color: '#54a0ff', type: 'water' },
    { id: 'surface_grass', label: '🌱 草地', w: 100, h: 100, color: '#78e08f', type: 'grass' },
    { id: 'surface_concrete', label: '⬜ 混凝土', w: 100, h: 100, color: '#b2bec3', type: 'concrete' },
    { 
        id:'surface_road',
        label: '马路', w: 48, h: 48, color: '#ffffff',
        type:'road',
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        // 切片坐标 (假设路灯在第0列，第0行)
        tileX: 4, tileY: 7, tileW: 48, tileH: 48 
    },
];

// ==========================================
// 2. 家具目录 (Build Mode & World Mode 通用)
// ==========================================
// 这里你可以大量录入你的 SpriteSheet 素材
export const FURNITURE_CATALOG: Record<string, { label: string, items: Partial<Furniture>[] }> = {
    'street': {
        label: '街道设施',
        items: [
            // ✨ 示例：使用 SpriteSheet 的路灯
            // { 
            //     label: '路灯', w: 20, h: 60, color: '#f1c40f', utility: 'light', 
            //     tags: ['street_light'],
            //     // sheetPath 指向你的图集文件
            //     sheetPath: '/src/assets/furniture/city_props.png', 
            //     // 切片坐标 (假设路灯在第0列，第0行)
            //     tileX: 0, tileY: 0, tileW: 48, tileH: 96 
            // },
            // { 
            //     label: '长椅', w: 60, h: 20, color: '#e17055', utility: 'comfort', 
            //     pixelPattern: 'bench_park', tags: ['seat'],
            //     sheetPath: '/src/assets/furniture/city_props.png',
            //     tileX: 1, tileY: 0 
            // },
            // { 
            //     label: '消防栓', w: 20, h: 20, color: '#ff5252', utility: 'none', 
            //     pixelPattern: 'hydrant', tags: ['decor'],
            //     sheetPath: '/src/assets/furniture/city_props.png',
            //     tileX: 2, tileY: 0 
            // },
            { label: '垃圾桶', w: 20, h: 20, color: '#636e72', utility: 'none', pixelPattern: 'trash', tags: ['decor'] },
            { label: '贩卖机', w: 40, h: 30, color: '#ff5252', utility: 'buy_drink', pixelPattern: 'vending', tags: ['shop'] },
        ]
    },
    'home': {
        label: '生活家居',
        items: [
            { label: '双人床', w: 80, h: 100, color: '#ff7675', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed', 'sleep'] },
            { label: '沙发', w: 100, h: 40, color: '#a29bfe', utility: 'comfort', pixelPattern: 'sofa_vip', tags: ['sofa', 'seat'] },
            { label: '餐桌', w: 60, h: 60, color: '#fab1a0', utility: 'hunger', pixelPattern: 'table_dining', tags: ['table'] },
            { label: '冰箱', w: 40, h: 40, color: '#fff', utility: 'hunger', pixelPattern: 'fridge', tags: ['kitchen'] },
            { label: '马桶', w: 30, h: 30, color: '#fff', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
            { label: '淋浴间', w: 40, h: 40, color: '#81ecec', utility: 'hygiene', pixelPattern: 'shower_stall', tags: ['shower'] },
        ]
    },
    'work': {
        label: '办公商业',
        items: [
            { label: '工位', w: 50, h: 40, color: '#dfe6e9', utility: 'work', pixelPattern: 'desk_pixel', tags: ['computer', 'desk'] },
            { label: '收银台', w: 60, h: 40, color: '#2c3e50', utility: 'work', pixelPattern: 'cashier', tags: ['cashier'] },
            { label: '货架', w: 50, h: 100, color: '#fdcb6e', utility: 'buy_item', pixelPattern: 'shelf_food', tags: ['shelf'] },
        ]
    },
    'skills': {
        label: '技能设施',
        items: [
            { label: '跑步机', w: 40, h: 70, color: '#2d3436', utility: 'run', pixelPattern: 'treadmill', tags: ['gym'] },
            { label: '画架', w: 40, h: 50, color: '#a29bfe', utility: 'paint', pixelPattern: 'easel', tags: ['easel', 'art'] },
            { label: '钢琴', w: 60, h: 50, color: '#1e1e1e', utility: 'play_instrument', pixelPattern: 'piano', tags: ['piano', 'instrument'] },
        ]
    }
};