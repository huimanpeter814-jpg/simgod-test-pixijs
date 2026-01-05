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
    'bathroom':{
        label:'卫浴',
        items:[
            {},
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