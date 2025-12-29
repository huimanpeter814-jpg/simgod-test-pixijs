import { Furniture } from '../types';
import { ItemTag, InteractionType, SlotType, NeedType } from '../config/gameConstants';

const getTile = (id: number, width: number) => {
    return {
        x: id % width,
        y: Math.floor(id / width)
    };
};

// ==========================================
// 1. 世界地表与装饰 (World Mode 专用)
// ==========================================
export const WORLD_DECOR_ITEMS = [
    // 🌳 大型景观 (仍然建议作为 Plot 地皮处理，因为它们体积大)
    { },
    
];

export const WORLD_SURFACE_ITEMS = [
    //地基
    { 
        id:'foundation_corner_top',
        label: '地基-上角', w: 96, h: 96, color: '#ffffff',
        type:ItemTag.Floor,
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(377,29), "tileSize": { "w": 96, "h": 96 },
    },
    { 
        id:'foundation_corner_bl',
        label: '地基-左下', w: 96, h: 96, color: '#ffffff',
        type:ItemTag.Floor,
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(435,29), "tileSize": { "w": 96, "h": 96 },
    },
    { 
        id:'foundation_corner_br"',
        label: '地基-右下', w: 96, h: 96, color: '#ffffff',
        type:ItemTag.Floor,
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(437,29), "tileSize": { "w": 96, "h": 96 },
    },
    { 
        id:'foundation_edge_top"',
        label: '地基-上边', w: 96, h: 96, color: '#ffffff',
        type:ItemTag.Floor,
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(384,29), "tileSize": { "w": 96, "h": 96 },
    },
    { 
        id:'foundation_edge_bottom"',
        label: '地基-下边', w: 96, h: 96, color: '#ffffff',
        type:ItemTag.Floor,
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(422,29), "tileSize": { "w": 96, "h": 96 },
    },
    //马路
    { 
        id:'surface_road',
        label: '马路', w: 48, h: 48, color: '#ffffff',
        type:ItemTag.Floor,
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: { "x": 4, "y": 7 }, "tileSize": { "w": 48, "h": 48 },
    },
    { 
        id:'surface_road_line',
        label: '马路_竖线', w: 48, h: 48, color: '#ffffff',
        type:ItemTag.Floor,
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: { "x": 9, "y": 9 }, "tileSize": { "w": 48, "h": 48 },
    },
    { 
        id:'road_corner',
        label: '马路转角', w: 48, h: 48, color: '#ffffff',
        type:ItemTag.Floor,
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(154,29), "tileSize": { "w": 48, "h": 48 },
    },
    { 
        id:'zebra_crossing',
        label: '斑马线', w: 96, h: 48, color: '#ffffff',
        type:ItemTag.Floor,
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(123,29), 
        tilePosDir: {
            0: getTile(123,29), // 横墙素材位置
            1: getTile(359,29), // 竖墙素材位置 (假设离得很远)
            2: getTile(123,29), // 背面也用横墙
            3: getTile(359,29)  // 右面也用竖墙
        },
        "tileSize": { "w": 96, "h": 48 },
    },
    //地砖
    { 
        id:'floor_tile_big',
        label: '大地砖', w: 96, h: 96, color: '#ffffff',
        type:ItemTag.Floor,
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(9,29), "tileSize": { "w": 96, "h": 96 },
    },
    { 
        id:'floor_tile_small',
        label: '小地砖', w: 48, h: 48, color: '#ffffff',
        type:ItemTag.Floor,
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(30,29), "tileSize": { "w": 48, "h": 48 },
    },
    //草地
    { 
        id:'grass',
        label: '草地', w: 48, h: 48, color: '#ffffff',
        type:ItemTag.Floor,
        sheetPath: '/src/assets/world_builder/3_City_Props_48x48.png', 
        tilePos: getTile(281,32), "tileSize": { "w": 48, "h": 48 },
    },
    { 
        id:'grass_flower',
        label: '草地_花', w: 48, h: 48, color: '#ffffff',
        type: ItemTag.Floor,
        sheetPath: '/src/assets/world_builder/3_City_Props_48x48.png', 
        tilePos: getTile(250,32), "tileSize": { "w": 48, "h": 48 },
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
            { 
                label: '路灯_01', w: 48, h: 192, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(20,32), "tileSize": { "w": 48, "h": 192 },
            },
            { 
                label: '路灯_02_L', w: 48*2, h: 48*4, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(903,32), "tileSize": { "w": 48*2, "h": 48*4 },
            },
            { 
                label: '路灯_2_R', w: 48*2, h: 48*4, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(901,32), "tileSize": { "w": 48*2, "h": 48*4 },
            },
            { 
                label: '长椅_长', color: '#ffffff',
                tags: [ItemTag.Seat], 
                placementLayer: SlotType.Floor,
                interactions: {
                    [InteractionType.Sit]: {
                        restoreNeed: NeedType.Energy, // 或者 Comfort
                        restoreRate: 0.3,             // 普通椅子回体力慢
                        comfortRating: 10             // 舒适度一般
                    }
                },
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(85,32),
            },
            { 
                label: '长椅_短', color: '#ffffff',
                tags: [ItemTag.Seat], 
                placementLayer: SlotType.Floor,
                interactions: {
                    [InteractionType.Sit]: {
                        restoreNeed: NeedType.Energy, // 或者 Comfort
                        restoreRate: 0.3,             // 普通椅子回体力慢
                        comfortRating: 10             // 舒适度一般
                    }
                },
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(21,32),
            },
            { 
                label: '垃圾桶_小', w: 48, h: 96, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(791,32), "tileSize": { "w": 48, "h": 96 },
            },
            { 
                label: '垃圾桶_大', w: 96, h: 96, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(692,32), "tileSize": { "w": 96, "h": 96 },
            },
            { 
                label: '消防栓', w: 48, h: 96, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(817,32), "tileSize": { "w": 48, "h": 96 },
            },
            { 
                label: '小摊车_1', w: 48*3, h: 48*3, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(149,32), "tileSize": { "w": 48*3, "h": 48*3 },
            },
            { 
                label: '小摊车_2', w: 48*3, h: 48*3, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(245,32), "tileSize": { "w": 48*3, "h": 48*3 },
            },
            { 
                label: '电话亭', w: 48*3, h: 48*5, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(412,32), "tileSize": { "w": 48*3, "h": 48*5 },
            },
            { 
                label: '下水道口', w: 48, h: 48, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(567,32), "tileSize": { "w": 48, "h": 48 },
            },
            { 
                label: '小花坛_1', w: 48*2, h: 48, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(576,32), "tileSize": { "w": 48*2, "h": 48 },
            },
            { 
                label: '小花坛_2', w: 48*2, h: 48, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(608,32), "tileSize": { "w": 48*2, "h": 48 },
            },
            { 
                label: '小花坛_3', w: 48*2, h: 48, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(640,32), "tileSize": { "w": 48*2, "h": 48 },
            },
            { 
                label: '大花坛', w: 48*3, h: 48, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(578,32), "tileSize": { "w": 48*3, "h": 48 },
            },
            { 
                label: '野花_1', w: 48, h: 48, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(411,32), "tileSize": { "w": 48, "h": 48 },
            },
            { 
                label: '野花_2', w: 48, h: 48, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(443,32), "tileSize": { "w": 48, "h": 48 },
            },
            { 
                label: '小树丛', w: 48, h: 48, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(506,32), "tileSize": { "w": 48, "h": 48 },
            },
            { 
                label: '树丛_1', w: 48*2, h: 48*4, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(734,32), "tileSize": { "w": 48*2, "h": 48*4 },
            },
            { 
                label: '树丛_2', w: 48*2, h: 48*3, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(862,32), "tileSize": { "w": 48*2, "h": 48*3 },
            },
            { 
                label: '树_1', w: 48*2, h: 48*3, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(730,32), "tileSize": { "w": 48*2, "h": 48*3 },
            },
            { 
                label: '树_2', w: 48*3, h: 48*4, color: '#ffffff',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(824,32), "tileSize": { "w": 48*3, "h": 48*4 },
            },


           
        ]
    },
    'wall': {
        label: '墙面',
        items: [
            {
                label: '墙面_01_中',
                w: 48, h: 48,          // 逻辑大小：占 1 格
                textureHeight: 96,     // 视觉大小：高 2 格 (素材通常比较高)
                isWall: true,          // 标记为墙
                // 假设墙体只有两个方向：横着放(0) 和 竖着放(1)
                // 我们可以复用 rotation 字段
                tileSheet: '/src/assets/world_builder/Room_Builder_48x48.png',
                tilePosDir: {
                    0: getTile(355,59), // 横墙素材位置
                    1: getTile(359,59), // 竖墙素材位置 (假设离得很远)
                    2: getTile(355,59), // 背面也用横墙
                    3: getTile(359,59)  // 右面也用竖墙
                }
            },
            {
                label: '墙面_01_左',
                w: 48, h: 48,          // 逻辑大小：占 1 格
                textureHeight: 96,     // 视觉大小：高 2 格 (素材通常比较高)
                isWall: true,          // 标记为墙
                // 假设墙体只有两个方向：横着放(0) 和 竖着放(1)
                // 我们可以复用 rotation 字段
                tileSheet: '/src/assets/world_builder/Room_Builder_48x48.png',
                tilePosDir: {
                    0: getTile(354,59), // 横墙素材位置
                    1: getTile(358,59), // 竖墙素材位置 (假设离得很远)
                    2: getTile(354,59), // 背面也用横墙
                    3: getTile(358,59)  // 右面也用竖墙
                }
            },
            {
                label: '墙面_01_右',
                w: 48, h: 48,          // 逻辑大小：占 1 格
                textureHeight: 96,     // 视觉大小：高 2 格 (素材通常比较高)
                isWall: true,          // 标记为墙
                // 假设墙体只有两个方向：横着放(0) 和 竖着放(1)
                // 我们可以复用 rotation 字段
                tileSheet: '/src/assets/world_builder/Room_Builder_48x48.png',
                tilePosDir: {
                    0: getTile(356,59), // 横墙素材位置
                    1: getTile(360,59), // 竖墙素材位置 (假设离得很远)
                    2: getTile(356,59), // 背面也用横墙
                    3: getTile(360,59)  // 右面也用竖墙
                }
            },
        ]
    },

    'livingroom': { 
        label: '客厅',
        items: [

        ]
    },
    'bedroom':{
        label:'卧室',
        items:[
            {
                label: '双人床', tags: [ItemTag.Bed], 
                placementLayer: SlotType.Floor,
                interactions: {
                    [InteractionType.Sleep]: {
                        restoreRate: 1.0,  // 标准睡眠速度
                        canWoohoo: true    // 双人床特有属性
                    },
                    [InteractionType.Sit]: { // 也可以坐在床上
                        restoreNeed: NeedType.Energy,
                        restoreRate: 0.3
                    }
                }, 
                frameName: 'Bedroom_Singles_Shadowless_48x48_217.png',
                variants: [
                    { id: 'var_1', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_220.png' },
                    { id: 'var_2', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_221.png' },
                    { id: 'var_3', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_228.png' },
                    { id: 'var_4', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_219.png' },
                    { id: 'var_5', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_224.png' },
                    { id: 'var_6', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_227.png' },
                    { id: 'var_7', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_218.png' },
                    { id: 'var_8', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_223.png' },
                    { id: 'var_9', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_226.png' },
                    { id: 'var_10', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_230.png' },
                    { id: 'var_11', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_222.png' },
                    { id: 'var_12', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_225.png' },
                    { id: 'var_13', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_229.png' },
                ]
            },
            {
                label: '双人床', tags: [ItemTag.Bed], 
                placementLayer: SlotType.Floor,
                interactions: {
                    [InteractionType.Sleep]: {
                        restoreRate: 1.0,  // 标准睡眠速度
                        canWoohoo: true    // 双人床特有属性
                    },
                    [InteractionType.Sit]: { // 也可以坐在床上
                        restoreNeed: NeedType.Energy,
                        restoreRate: 0.3
                    }
                }, 
                frameName: 'Bedroom_Singles_Shadowless_48x48_233.png',
                variants: [
                    { id: 'var_1', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_234.png' },
                    { id: 'var_2', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_242.png' },
                    { id: 'var_3', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_244.png' },
                    { id: 'var_4', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_231.png' },
                    { id: 'var_5', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_232.png' },
                    { id: 'var_6', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_241.png' },
                    { id: 'var_7', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_243.png' },
                    { id: 'var_8', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_236.png' },
                    { id: 'var_9', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_239.png' },
                    { id: 'var_10', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_240.png' },
                    { id: 'var_11', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_235.png' },
                    { id: 'var_12', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_237.png' },
                    { id: 'var_13', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_238.png' },
                ]
            },
            {
                label: '双人床', tags: [ItemTag.Bed], 
                placementLayer: SlotType.Floor,
                interactions: {
                    [InteractionType.Sleep]: {
                        restoreRate: 1.0,  // 标准睡眠速度
                        canWoohoo: true    // 双人床特有属性
                    },
                    [InteractionType.Sit]: { // 也可以坐在床上
                        restoreNeed: NeedType.Energy,
                        restoreRate: 0.3
                    }
                }, 
                frameName: 'Bedroom_Singles_Shadowless_48x48_266.png',
                variants: [
                    { id: 'var_1', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_263.png' },
                    { id: 'var_2', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_265.png' },
                    { id: 'var_3', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_260.png' },
                    { id: 'var_4', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_264.png' },
                    { id: 'var_5', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_261.png' },
                    { id: 'var_6', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_262.png' },
                    { id: 'var_7', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_259.png' },
                    { id: 'var_8', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_267.png' },
                    { id: 'var_9', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_268.png' },
                    { id: 'var_10', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_269.png' },
                    { id: 'var_11', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_270.png' },
                    { id: 'var_12', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_271.png' },
                    { id: 'var_13', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_272.png' },
                ]
            },
            {
                label: '双人床', tags: [ItemTag.Bed], 
                placementLayer: SlotType.Floor,
                interactions: {
                    [InteractionType.Sleep]: {
                        restoreRate: 1.0,  // 标准睡眠速度
                        canWoohoo: true    // 双人床特有属性
                    },
                    [InteractionType.Sit]: { // 也可以坐在床上
                        restoreNeed: NeedType.Energy,
                        restoreRate: 0.3
                    }
                }, 
                frameName: 'Bedroom_Singles_Shadowless_48x48_246.png',
                variants: [
                    { id: 'var_1', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_253.png' },
                    { id: 'var_2', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_247.png' },
                    { id: 'var_3', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_254.png' },
                    { id: 'var_4', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_245.png' },
                    { id: 'var_5', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_252.png' },
                    { id: 'var_6', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_248.png' },
                    { id: 'var_7', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_255.png' },
                    { id: 'var_8', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_249.png' },
                    { id: 'var_9', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_256.png' },
                    { id: 'var_10', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_250.png' },
                    { id: 'var_11', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_257.png' },
                    { id: 'var_12', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_251.png' },
                    { id: 'var_13', label: '双人床', frameName: 'Bedroom_Singles_Shadowless_48x48_258.png' },
                ]
            },
            {
                label: '婴儿床', tags: [ItemTag.Crib], 
                placementLayer: SlotType.Floor,
                interactions: {
                    [InteractionType.Sleep]: {
                        restoreRate: 1.0 // 婴儿睡得快？
                    }
                },
                frameName: 'Bedroom_Singles_Shadowless_48x48_504.png',
                variants: [
                    { id: 'var_1', label: '婴儿床', frameName: 'Bedroom_Singles_Shadowless_48x48_491.png' },
                    { id: 'var_2', label: '婴儿床', frameName: 'Bedroom_Singles_Shadowless_48x48_482.png' },
                    { id: 'var_3', label: '婴儿床', frameName: 'Bedroom_Singles_Shadowless_48x48_501.png' },
                    { id: 'var_4', label: '婴儿床', frameName: 'Bedroom_Singles_Shadowless_48x48_493.png' },
                    { id: 'var_5', label: '婴儿床', frameName: 'Bedroom_Singles_Shadowless_48x48_481.png' },
                ]
            },
        ]
    },
    'bathroom':{
        label:'卫浴',
        items:[
            {},
        ]
    },
    'kitchen':{
        label:'厨房',
        items:[
            {
                label: '冰箱', h: 20, tags: [ItemTag.Fridge, ItemTag.FoodSource],
                placementLayer: SlotType.Floor,
                
                interactions: {
                    // 1. 打开取东西
                    [InteractionType.OpenStorage]: {
                        capacity: 50,
                        preservesFood: true,
                        inventoryType: 'food'
                    },
                    // 2. 做饭的起点 (取食材)
                    // 即使它本身不加热，但做饭逻辑通常会寻找 "FoodSource"
                    // 可以在这里配置它支持的食材等级
                    [InteractionType.Cook]: {
                         tier: 0 // 仅作为食材库
                    }
                },
                frameName: 'Kitchen_Singles_Shadowless_48x48_158.png', // UI缩略图
                frameDirs: {
                    0: 'Kitchen_Singles_Shadowless_48x48_158.png', // 正
                    1: 'Kitchen_Singles_Shadowless_48x48_170.png', // 侧 (左)
                    2: 'Kitchen_Singles_Shadowless_48x48_158.png', // 背 (复用正)
                    3: 'Kitchen_Singles_Shadowless_48x48_170.png', // 右 (复用侧)
                },
                variants: [
                    {
                        id: 'var_1', label: '冰箱',
                frameDirs: {
                    0: 'Kitchen_Singles_Shadowless_48x48_159.png', // 正
                    1: 'Kitchen_Singles_Shadowless_48x48_164.png', // 侧 (左)
                    2: 'Kitchen_Singles_Shadowless_48x48_159.png', // 背 (复用正)
                    3: 'Kitchen_Singles_Shadowless_48x48_164.png', // 右 (复用侧)
                },
                    },
                    {
                        id: 'var_2', label: '冰箱',
                frameDirs: {
                    0: 'Kitchen_Singles_Shadowless_48x48_160.png', // 正
                    1: 'Kitchen_Singles_Shadowless_48x48_168.png', // 侧 (左)
                    2: 'Kitchen_Singles_Shadowless_48x48_160.png', // 背 (复用正)
                    3: 'Kitchen_Singles_Shadowless_48x48_168.png', // 右 (复用侧)
                },
                    },
                ]
            },
            {
                label: '橱柜', h: 20, tags: [ItemTag.Decoration],
                placementLayer: SlotType.Floor,
                frameName: 'Kitchen_Singles_Shadowless_48x48_114.png',
                variants: [
                    { id: 'var_1', label: '橱柜', frameName: 'Kitchen_Singles_Shadowless_48x48_94.png' },
                    { id: 'var_2', label: '橱柜', frameName: 'Kitchen_Singles_Shadowless_48x48_104.png' },
                ]
            },
            {
                label: '橱柜', h: 20,tags: [ItemTag.Decoration],
                placementLayer: SlotType.Floor, frameName: 'Kitchen_Singles_Shadowless_48x48_118.png',
                variants: [
                    { id: 'var_1', label: '橱柜', frameName: 'Kitchen_Singles_Shadowless_48x48_98.png' },
                    { id: 'var_2', label: '橱柜', frameName: 'Kitchen_Singles_Shadowless_48x48_108.png' },
                ]
            },
            {
                label: '橱柜', h: 20, tags: [ItemTag.Decoration],
                placementLayer: SlotType.Floor, frameName: 'Kitchen_Singles_Shadowless_48x48_119.png',
                variants: [
                    { id: 'var_1', label: '橱柜', frameName: 'Kitchen_Singles_Shadowless_48x48_99.png' },
                    { id: 'var_2', label: '橱柜', frameName: 'Kitchen_Singles_Shadowless_48x48_109.png' },
                ]
            },
            {
                label: '料理台', h: 10, tags: [ItemTag.Table, ItemTag.Surface],
                placementLayer: SlotType.Floor, isSurface: true, surfaceHeight: 30, frameName: 'Kitchen_Singles_Shadowless_48x48_76.png',
                variants: [
                    { id: 'var_1', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_68.png' },
                    { id: 'var_2', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_58.png' },
                ]
            },
            {
                label: '料理台', h: 10, tags: [ItemTag.Table, ItemTag.Surface],
                placementLayer: SlotType.Floor, isSurface: true, surfaceHeight: 30, frameName: 'Kitchen_Singles_Shadowless_48x48_68.png',
                variants: [
                    { id: 'var_1', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_77.png' },
                    { id: 'var_2', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_59.png' },
                ]
            },
            {
                label: '料理台', h: 10, tags: [ItemTag.Table, ItemTag.Surface],
                placementLayer: SlotType.Floor, isSurface: true, surfaceHeight: 30, frameName: 'Kitchen_Singles_Shadowless_48x48_69.png',
                variants: [
                    { id: 'var_1', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_78.png' },
                    { id: 'var_2', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_60.png' },
                ]
            },
            {
                label: '料理台', h: 10, tags: [ItemTag.Table, ItemTag.Surface],
                placementLayer: SlotType.Floor, isSurface: true, surfaceHeight: 30, frameName: 'Kitchen_Singles_Shadowless_48x48_4.png',
                variants: [
                    { id: 'var_1', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_31.png' },
                    { id: 'var_2', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_40.png' },
                    { id: 'var_3', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_49.png' },
                    { id: 'var_4', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_22.png' },
                    { id: 'var_5', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_13.png' },
                ]
            },
            {
                label: '料理台', h: 10, tags: [ItemTag.Table, ItemTag.Surface],
                placementLayer: SlotType.Floor, isSurface: true, surfaceHeight: 30, frameName: 'Kitchen_Singles_Shadowless_48x48_5.png',
                variants: [
                    { id: 'var_1', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_32.png' },
                    { id: 'var_2', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_41.png' },
                    { id: 'var_3', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_50.png' },
                    { id: 'var_4', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_23.png' },
                    { id: 'var_5', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_14.png' },
                ]
            },
            {
                label: '料理台', h: 10, tags: [ItemTag.Table, ItemTag.Surface],
                placementLayer: SlotType.Floor, isSurface: true, surfaceHeight: 30, frameName: 'Kitchen_Singles_Shadowless_48x48_6.png',
                variants: [
                    { id: 'var_1', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_33.png' },
                    { id: 'var_2', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_42.png' },
                    { id: 'var_3', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_51.png' },
                    { id: 'var_4', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_24.png' },
                    { id: 'var_5', label: '料理台', frameName: 'Kitchen_Singles_Shadowless_48x48_15.png' },
                ]
            },
            {
                label: '炉',  tags: [ItemTag.Stove],
                placementLayer: SlotType.Floor,
                interactions: {
                    // 真正的做饭交互
                    [InteractionType.Cook]: {
                        tier: 2, // 普通炉灶
                        allowedMeals: ['pancakes', 'steak', 'pasta'] // 可选：限制食谱
                    }
                }, frameName: 'Kitchen_Singles_Shadowless_48x48_148.png',
                variants: [
                    { id: 'var_1', label: '炉', frameName: 'Kitchen_Singles_Shadowless_48x48_151.png' },
                    { id: 'var_2', label: '炉', frameName: 'Kitchen_Singles_Shadowless_48x48_152.png' },
                ]
            },
            {
                label: '炸炉', tags: [ItemTag.Stove],
                placementLayer: SlotType.Floor,
                interactions: {
                    // 真正的做饭交互
                    [InteractionType.Cook]: {
                        tier: 2, // 普通炉灶
                        allowedMeals: ['pancakes', 'steak', 'pasta'] // 可选：限制食谱
                    }
                },  frameName: 'Kitchen_Singles_Shadowless_48x48_194.png',
                variants: [
                    { id: 'var_1', label: '炸炉', frameName: 'Kitchen_Singles_Shadowless_48x48_193.png' },
                ]
            },
            {
                label: '洗手池', h: 15, tags: [ItemTag.KitchenSink], placementLayer: SlotType.Surface,
                interactions: {
                    // 真正的做饭交互
                    [InteractionType.WashDishes]: {
                    }
                },
                 frameName: 'Kitchen_Singles_Shadowless_48x48_143.png',
                variants: [
                    { id: 'var_1', label: '洗手池', frameName: 'Kitchen_Singles_Shadowless_48x48_141.png' },
                    { id: 'var_2', label: '洗手池', frameName: 'Kitchen_Singles_Shadowless_48x48_145.png' },
                    { id: 'var_3', label: '洗手池', frameName: 'Kitchen_Singles_Shadowless_48x48_144.png' },
                    { id: 'var_4', label: '洗手池', frameName: 'Kitchen_Singles_Shadowless_48x48_142.png' },
                    { id: 'var_5', label: '洗手池', frameName: 'Kitchen_Singles_Shadowless_48x48_146.png' },
                ]
            },
            {
                label: '餐桌', tags: [ItemTag.Table, ItemTag.Surface],
                placementLayer: SlotType.Floor, isSurface: true, surfaceHeight: 30,
                frameName: 'Kitchen_Singles_Shadowless_48x48_311.png', // UI缩略图
                frameDirs: {
                    0: 'Kitchen_Singles_Shadowless_48x48_311.png', // 正
                    1: 'Kitchen_Singles_Shadowless_48x48_310.png', // 侧 (左)
                    2: 'Kitchen_Singles_Shadowless_48x48_311.png', // 背 (复用正)
                    3: 'Kitchen_Singles_Shadowless_48x48_310.png', // 右 (复用侧)
                },
                variants: [
                    {
                        id: 'var_1', label: '餐桌',
                frameDirs: {
                    0: 'Kitchen_Singles_Shadowless_48x48_309.png', // 正
                    1: 'Kitchen_Singles_Shadowless_48x48_322.png', // 侧 (左)
                    2: 'Kitchen_Singles_Shadowless_48x48_309.png', // 背 (复用正)
                    3: 'Kitchen_Singles_Shadowless_48x48_322.png', // 右 (复用侧)
                },
                    },
                    {
                        id: 'var_2', label: '餐桌',
                frameDirs: {
                    0: 'Kitchen_Singles_Shadowless_48x48_321.png', // 正
                    1: 'Kitchen_Singles_Shadowless_48x48_323.png', // 侧 (左)
                    2: 'Kitchen_Singles_Shadowless_48x48_321.png', // 背 (复用正)
                    3: 'Kitchen_Singles_Shadowless_48x48_323.png', // 右 (复用侧)
                },
                    },
                ]
            },
            {
                label: '木凳', h: 20, tags: [ItemTag.Seat], 
                placementLayer: SlotType.Floor,
                interactions: {
                    [InteractionType.Sit]: {
                        restoreNeed: NeedType.Comfort, // 或者 Comfort
                        restoreRate: 0.3,             // 普通椅子回体力慢
                        comfortRating: 10             // 舒适度一般
                    },
                    [InteractionType.Eat]: {
                    }
                },
                frameName: 'Kitchen_Singles_Shadowless_48x48_280.png', // UI缩略图
                frameDirs: {
                    0: 'Kitchen_Singles_Shadowless_48x48_280.png', // 正
                    1: 'Kitchen_Singles_Shadowless_48x48_284.png', // 侧 (左)
                    2: 'Kitchen_Singles_Shadowless_48x48_280.png', // 背 (复用正)
                    3: 'Kitchen_Singles_Shadowless_48x48_284.png', // 右 (复用侧)
                },
                variants: [
                    {
                        id: 'var_1', label: '木凳',
                frameDirs: {
                    0: 'Kitchen_Singles_Shadowless_48x48_281.png', // 正
                    1: 'Kitchen_Singles_Shadowless_48x48_285.png', // 侧 (左)
                    2: 'Kitchen_Singles_Shadowless_48x48_281.png', // 背 (复用正)
                    3: 'Kitchen_Singles_Shadowless_48x48_285.png', // 右 (复用侧)
                },
                    },
                    {
                        id: 'var_2', label: '木凳',
                frameDirs: {
                    0: 'Kitchen_Singles_Shadowless_48x48_282.png', // 正
                    1: 'Kitchen_Singles_Shadowless_48x48_286.png', // 侧 (左)
                    2: 'Kitchen_Singles_Shadowless_48x48_282.png', // 背 (复用正)
                    3: 'Kitchen_Singles_Shadowless_48x48_286.png', // 右 (复用侧)
                },
                    },
                    {
                        id: 'var_3', label: '木凳',
                frameDirs: {
                    0: 'Kitchen_Singles_Shadowless_48x48_283.png', // 正
                    1: 'Kitchen_Singles_Shadowless_48x48_287.png', // 侧 (左)
                    2: 'Kitchen_Singles_Shadowless_48x48_283.png', // 背 (复用正)
                    3: 'Kitchen_Singles_Shadowless_48x48_287.png', // 右 (复用侧)
                },
                    },
                ]
            },
            {
                label: '小木凳', h: 24, tags: [ItemTag.Seat], 
                placementLayer: SlotType.Floor,
                interactions: {
                    [InteractionType.Sit]: {
                        restoreNeed: NeedType.Comfort, // 或者 Comfort
                        restoreRate: 0.2,             // 普通椅子回体力慢
                        comfortRating: 10             // 舒适度一般
                    },
                    [InteractionType.Eat]: {
                    }
                },
                frameName: 'Kitchen_Singles_Shadowless_48x48_373.png', // UI缩略图
                frameDirs: {
                    0: 'Kitchen_Singles_Shadowless_48x48_373.png', // 正
                    1: 'Kitchen_Singles_Shadowless_48x48_370.png', // 侧 (左)
                    2: 'Kitchen_Singles_Shadowless_48x48_373.png', // 背 (复用正)
                    3: 'Kitchen_Singles_Shadowless_48x48_370.png', // 右 (复用侧)
                },
                variants: [
                    {
                        id: 'var_1', label: '小木凳',
                frameDirs: {
                    0: 'Kitchen_Singles_Shadowless_48x48_371.png', // 正
                    1: 'Kitchen_Singles_Shadowless_48x48_369.png', // 侧 (左)
                    2: 'Kitchen_Singles_Shadowless_48x48_371.png', // 背 (复用正)
                    3: 'Kitchen_Singles_Shadowless_48x48_369.png', // 右 (复用侧)
                },
                    },
                    {
                        id: 'var_2', label: '小木凳',
                frameDirs: {
                    0: 'Kitchen_Singles_Shadowless_48x48_372.png', // 正
                    1: 'Kitchen_Singles_Shadowless_48x48_368.png', // 侧 (左)
                    2: 'Kitchen_Singles_Shadowless_48x48_372.png', // 背 (复用正)
                    3: 'Kitchen_Singles_Shadowless_48x48_368.png', // 右 (复用侧)
                },
                    },
                ]
            },
            {
                label: '小板凳', tags: [ItemTag.Seat], 
                placementLayer: SlotType.Floor,
                interactions: {
                    [InteractionType.Sit]: {
                        restoreNeed: NeedType.Comfort, // 或者 Comfort
                        restoreRate: 0.2,             // 普通椅子回体力慢
                        comfortRating: 5             // 舒适度一般
                    },
                }, frameName: 'Kitchen_Singles_Shadowless_48x48_273.png',
                variants: [
                    { id: 'var_1', label: '小板凳', frameName: 'Kitchen_Singles_Shadowless_48x48_274.png' },
                    { id: 'var_2', label: '小板凳', frameName: 'Kitchen_Singles_Shadowless_48x48_275.png' },
                    { id: 'var_3', label: '小板凳', frameName: 'Kitchen_Singles_Shadowless_48x48_272.png' },
                ]
            },
            {
                label: '小板凳', tags: [ItemTag.Seat], 
                placementLayer: SlotType.Floor,
                interactions: {
                    [InteractionType.Sit]: {
                        restoreNeed: NeedType.Comfort, // 或者 Comfort
                        restoreRate: 0.2,             // 普通椅子回体力慢
                        comfortRating: 5             // 舒适度一般
                    },
                },  frameName: 'Kitchen_Singles_Shadowless_48x48_276.png',
                variants: [
                    { id: 'var_1', label: '小板凳', frameName: 'Kitchen_Singles_Shadowless_48x48_277.png' },
                    { id: 'var_2', label: '小板凳', frameName: 'Kitchen_Singles_Shadowless_48x48_278.png' },
                    { id: 'var_3', label: '小板凳', frameName: 'Kitchen_Singles_Shadowless_48x48_279.png' },
                ]
            },
            {
                label: '电饭煲', h: 8, tags: [ItemTag.Decoration],placementLayer: SlotType.Surface, frameName: 'Kitchen_Singles_Shadowless_48x48_195.png',
                variants: [
                    { id: 'var_1', label: '电饭煲', frameName: 'Kitchen_Singles_Shadowless_48x48_197.png' },
                    { id: 'var_2', label: '电饭煲', frameName: 'Kitchen_Singles_Shadowless_48x48_196.png' },
                    { id: 'var_3', label: '电饭煲', frameName: 'Kitchen_Singles_Shadowless_48x48_198.png' },
                ]
            },
            {
                label: '烤面包机', h: 5, tags: [ItemTag.Decoration],placementLayer: SlotType.Surface, frameName: 'Kitchen_Singles_Shadowless_48x48_136.png',
                variants: [
                    { id: 'var_1', label: '烤面包机', frameName: 'Kitchen_Singles_Shadowless_48x48_135.png' },
                ]
            },
            {
                label: '榨汁机', h: 5, tags: [ItemTag.Decoration],placementLayer: SlotType.Surface, frameName: 'Kitchen_Singles_Shadowless_48x48_184.png',
                variants: [
                    { id: 'var_1', label: '榨汁机', frameName: 'Kitchen_Singles_Shadowless_48x48_183.png' },
                ]
            },
            {
                label: '咖啡机', h: 16, tags: [ItemTag.Decoration],placementLayer: SlotType.Surface, frameName: 'Kitchen_Singles_Shadowless_48x48_179.png',
                variants: [
                    { id: 'var_1', label: '咖啡机', frameName: 'Kitchen_Singles_Shadowless_48x48_177.png' },
                    { id: 'var_2', label: '咖啡机', frameName: 'Kitchen_Singles_Shadowless_48x48_180.png' },
                    { id: 'var_3', label: '咖啡机', frameName: 'Kitchen_Singles_Shadowless_48x48_178.png' },
                ]
            },
            {
                label: '调料', h: 5,tags: [ItemTag.Decoration],placementLayer: SlotType.Surface, frameName: 'Kitchen_Singles_Shadowless_48x48_397.png',
                variants: [
                    { id: 'var_1', label: '调料', frameName: 'Kitchen_Singles_Shadowless_48x48_396.png' },
                ]
            },
            {
                label: '甜甜圈', h: 5, tags: [ItemTag.Decoration],placementLayer: SlotType.Surface, frameName: 'Kitchen_Singles_Shadowless_48x48_402.png',
                variants: [
                    { id: 'var_1', label: '甜甜圈', frameName: 'Kitchen_Singles_Shadowless_48x48_403.png' },
                    { id: 'var_2', label: '甜甜圈', frameName: 'Kitchen_Singles_Shadowless_48x48_405.png' },
                    { id: 'var_3', label: '甜甜圈', frameName: 'Kitchen_Singles_Shadowless_48x48_404.png' },
                    { id: 'var_4', label: '甜甜圈', frameName: 'Kitchen_Singles_Shadowless_48x48_401.png' },
                    { id: 'var_5', label: '甜甜圈', frameName: 'Kitchen_Singles_Shadowless_48x48_400.png' },
                    { id: 'var_6', label: '甜甜圈', frameName: 'Kitchen_Singles_Shadowless_48x48_399.png' },
                    { id: 'var_7', label: '甜甜圈', frameName: 'Kitchen_Singles_Shadowless_48x48_398.png' },
                ]
            },
            {
                label: '菜', h: 5, tags: [ItemTag.Decoration],placementLayer: SlotType.Surface, frameName: 'Kitchen_Singles_Shadowless_48x48_388.png',
                variants: [
                    { id: 'var_1', label: '菜', frameName: 'Kitchen_Singles_Shadowless_48x48_384.png' },
                    { id: 'var_2', label: '菜', frameName: 'Kitchen_Singles_Shadowless_48x48_386.png' },
                    { id: 'var_3', label: '菜', frameName: 'Kitchen_Singles_Shadowless_48x48_389.png' },
                    { id: 'var_4', label: '菜', frameName: 'Kitchen_Singles_Shadowless_48x48_385.png' },
                    { id: 'var_5', label: '菜', frameName: 'Kitchen_Singles_Shadowless_48x48_387.png' },
                    { id: 'var_6', label: '菜', frameName: 'Kitchen_Singles_Shadowless_48x48_390.png' },
                ]
            },
            {
                label: '灯', h: 10, tags: [ItemTag.Light],placementLayer: SlotType.Surface, frameName: 'Kitchen_Singles_Shadowless_48x48_203.png',
                variants: [
                    { id: 'var_1', label: '灯', frameName: 'Kitchen_Singles_Shadowless_48x48_205.png' },
                    { id: 'var_2', label: '灯', frameName: 'Kitchen_Singles_Shadowless_48x48_204.png' },
                    { id: 'var_3', label: '灯', frameName: 'Kitchen_Singles_Shadowless_48x48_206.png' },
                ]
            },
        ]
    },
    'work': {
        label: '办公用品',
        items: []
    },
    'skills': {
        label: '技能设施',
        items: [
        ]
    }
};