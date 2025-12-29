import { Furniture } from '../types';

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
    { id: 'decor_tree_1', label: '🌳 大树', w: 100, h: 100, color: '#27ae60' },
    { id: 'decor_fountain', label: '⛲ 喷泉', w: 80, h: 80, color: '#74b9ff' },
];

export const WORLD_SURFACE_ITEMS = [
    //地基
    { 
        id:'foundation_corner_top',
        label: '地基-上角', w: 96, h: 96, color: '#ffffff',
        type:'road',
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(377,29), "tileSize": { "w": 96, "h": 96 },
    },
    { 
        id:'foundation_corner_bl',
        label: '地基-左下', w: 96, h: 96, color: '#ffffff',
        type:'road',
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(435,29), "tileSize": { "w": 96, "h": 96 },
    },
    { 
        id:'foundation_corner_br"',
        label: '地基-右下', w: 96, h: 96, color: '#ffffff',
        type:'road',
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(437,29), "tileSize": { "w": 96, "h": 96 },
    },
    { 
        id:'foundation_edge_top"',
        label: '地基-上边', w: 96, h: 96, color: '#ffffff',
        type:'road',
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(384,29), "tileSize": { "w": 96, "h": 96 },
    },
    { 
        id:'foundation_edge_bottom"',
        label: '地基-下边', w: 96, h: 96, color: '#ffffff',
        type:'road',
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(422,29), "tileSize": { "w": 96, "h": 96 },
    },
    //马路
    { 
        id:'surface_road',
        label: '马路', w: 48, h: 48, color: '#ffffff',
        type:'road',
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: { "x": 4, "y": 7 }, "tileSize": { "w": 48, "h": 48 },
    },
    { 
        id:'surface_road_line',
        label: '马路_竖线', w: 48, h: 48, color: '#ffffff',
        type:'road',
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: { "x": 9, "y": 9 }, "tileSize": { "w": 48, "h": 48 },
    },
    { 
        id:'road_corner',
        label: '马路转角', w: 48, h: 48, color: '#ffffff',
        type:'road',
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(154,29), "tileSize": { "w": 48, "h": 48 },
    },
    { 
        id:'zebra_crossing',
        label: '斑马线', w: 96, h: 48, color: '#ffffff',
        type:'road',
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
        type:'road',
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(9,29), "tileSize": { "w": 96, "h": 96 },
    },
    { 
        id:'floor_tile_small',
        label: '小地砖', w: 48, h: 48, color: '#ffffff',
        type:'road',
        sheetPath: '/src/assets/world_builder/2_City_Terrains_48x48.png', 
        tilePos: getTile(30,29), "tileSize": { "w": 48, "h": 48 },
    },
    //草地
    { 
        id:'grass',
        label: '草地', w: 48, h: 48, color: '#ffffff',
        type:'grass',
        sheetPath: '/src/assets/world_builder/3_City_Props_48x48.png', 
        tilePos: getTile(281,32), "tileSize": { "w": 48, "h": 48 },
    },
    { 
        id:'grass_flower',
        label: '草地_花', w: 48, h: 48, color: '#ffffff',
        type:'grass',
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
                tags: ['light'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(20,32), "tileSize": { "w": 48, "h": 192 },
            },
            { 
                label: '路灯_02_L', w: 48*2, h: 48*4, color: '#ffffff',
                tags: ['light'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(903,32), "tileSize": { "w": 48*2, "h": 48*4 },
            },
            { 
                label: '路灯_2_R', w: 48*2, h: 48*4, color: '#ffffff',
                tags: ['light'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(901,32), "tileSize": { "w": 48*2, "h": 48*4 },
            },
            { 
                label: '长椅_长', w: 48*3, h: 96, color: '#ffffff',
                tags: ['seat'],utility: 'comfort',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(85,32), "tileSize": { "w": 48*3, "h": 96 },
            },
            { 
                label: '长椅_短', w: 48*2, h: 96, color: '#ffffff',
                tags: ['seat'],utility: 'comfort',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(21,32), "tileSize": { "w": 48*2, "h": 96 },
            },
            { 
                label: '垃圾桶_小', w: 48, h: 96, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(791,32), "tileSize": { "w": 48, "h": 96 },
            },
            { 
                label: '垃圾桶_大', w: 96, h: 96, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(692,32), "tileSize": { "w": 96, "h": 96 },
            },
            { 
                label: '消防栓', w: 48, h: 96, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(817,32), "tileSize": { "w": 48, "h": 96 },
            },
            { 
                label: '小摊车_1', w: 48*3, h: 48*3, color: '#ffffff',
                tags: ['shop'],utility: 'buy_drink',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(149,32), "tileSize": { "w": 48*3, "h": 48*3 },
            },
            { 
                label: '小摊车_2', w: 48*3, h: 48*3, color: '#ffffff',
                tags: ['shop'],utility: 'buy_drink',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(245,32), "tileSize": { "w": 48*3, "h": 48*3 },
            },
            { 
                label: '电话亭', w: 48*3, h: 48*5, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(412,32), "tileSize": { "w": 48*3, "h": 48*5 },
            },
            { 
                label: '下水道口', w: 48, h: 48, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(567,32), "tileSize": { "w": 48, "h": 48 },
            },
            { 
                label: '小花坛_1', w: 48*2, h: 48, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(576,32), "tileSize": { "w": 48*2, "h": 48 },
            },
            { 
                label: '小花坛_2', w: 48*2, h: 48, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(608,32), "tileSize": { "w": 48*2, "h": 48 },
            },
            { 
                label: '小花坛_3', w: 48*2, h: 48, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(640,32), "tileSize": { "w": 48*2, "h": 48 },
            },
            { 
                label: '大花坛', w: 48*3, h: 48, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(578,32), "tileSize": { "w": 48*3, "h": 48 },
            },
            { 
                label: '野花_1', w: 48, h: 48, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(411,32), "tileSize": { "w": 48, "h": 48 },
            },
            { 
                label: '野花_2', w: 48, h: 48, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(443,32), "tileSize": { "w": 48, "h": 48 },
            },
            { 
                label: '小树丛', w: 48, h: 48, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(506,32), "tileSize": { "w": 48, "h": 48 },
            },
            { 
                label: '树丛_1', w: 48*2, h: 48*4, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(734,32), "tileSize": { "w": 48*2, "h": 48*4 },
            },
            { 
                label: '树丛_2', w: 48*2, h: 48*3, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(862,32), "tileSize": { "w": 48*2, "h": 48*3 },
            },
            { 
                label: '树_1', w: 48*2, h: 48*3, color: '#ffffff',
                tags: ['decor'],utility: 'none',
                tileSheet: '/src/assets/world_builder/3_City_Props_48x48.png', 
                tilePos: getTile(730,32), "tileSize": { "w": 48*2, "h": 48*3 },
            },
            { 
                label: '树_2', w: 48*3, h: 48*4, color: '#ffffff',
                tags: ['decor'],utility: 'none',
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
            { 
                label: '大柜子', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                frameName: 'Living_Room_Singles_48x48_1.png' 
            },
            { 
                label: '大柜子', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                frameName: 'Living_Room_Singles_48x48_37.png' 
            },
            { 
                label: '柜子', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                frameName: 'Living_Room_Singles_48x48_39.png' 
            },
            { 
                label: '柜子', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                frameName: 'Living_Room_Singles_48x48_52.png' 
            },
            { 
                label: '柜子', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                frameName: 'Living_Room_Singles_48x48_56.png' 
            },
            { 
                label: '柜子', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                frameName: 'Living_Room_Singles_48x48_70.png' 
            },
            { 
                label: '长柜子',
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                frameName: 'Living_Room_Singles_48x48_54.png' 
            },
            { 
                label: '茶几', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                isSurface: true, 
                surfaceHeight: 30, 
                placementLayer: 'floor',
                h: 20,
                frameName: 'Living_Room_Singles_48x48_2.png' 
            },
            { 
                label: '茶几', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 30,
                frameName: 'Living_Room_Singles_48x48_47.png' 
            },
            { 
                label: '茶几', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                isSurface: true, 
                surfaceHeight: 30, 
                placementLayer: 'floor',
                h: 30,
                frameName: 'Living_Room_Singles_48x48_29.png' 
            },
            { 
                label: '茶几',
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                frameName: 'Living_Room_Singles_48x48_36.png' 
            },
            { 
                label: '高茶几', 
                color: '#ffffff',
                utility: 'none', 
                isSurface: true, 
                surfaceHeight: 30, 
                placementLayer: 'floor',
                tags: ['decor'],
                frameName: 'Living_Room_Singles_48x48_3.png' 
            },
            { 
                label: '方茶几',  
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                isSurface: true, 
                surfaceHeight: 10, 
                placementLayer: 'floor',
                frameName: 'Living_Room_Singles_48x48_4.png' 
            },
            { 
                label: '矮桌',  
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                isSurface: true, 
                surfaceHeight: 10, 
                placementLayer: 'floor',
                frameName: 'Basement_Singles_Shadowless_48x48_1.png' 
            },
            { 
                label: '矮桌',  
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                isSurface: true, 
                surfaceHeight: 10, 
                placementLayer: 'floor',
                frameName: 'Basement_Singles_Shadowless_48x48_2.png' 
            },
            { 
                label: '矮桌',  
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                isSurface: true, 
                surfaceHeight: 10, 
                placementLayer: 'floor',
                frameName: 'Basement_Singles_Shadowless_48x48_3.png' 
            },
            { 
                label: '小柜子', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 24,
                isSurface: true, 
                surfaceHeight: 30, 
                placementLayer: 'floor',
                frameName: 'Living_Room_Singles_48x48_7.png' 
            },
            { 
                label: '小柜子',
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 24,
                isSurface: true, 
                surfaceHeight: 30, 
                placementLayer: 'floor',
                frameName: 'Living_Room_Singles_48x48_65.png' 
            },
            { 
                label: '小柜子',
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 24,
                isSurface: true, 
                surfaceHeight: 30, 
                placementLayer: 'floor',
                frameName: 'Living_Room_Singles_48x48_69.png' 
            },
            { 
                label: '高柜子',
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 24,
                frameName: 'Living_Room_Singles_48x48_89.png' 
            },
            { 
                label: '电视',
                color: '#ffffff',
                utility: 'cinema_', 
                tags: ['tv'],
                h: 12,
                frameDirs:{
                    0:'Basement_Singles_Shadowless_48x48_165.png',
                    1:'Basement_Singles_Shadowless_48x48_186.png',
                    2:'Basement_Singles_Shadowless_48x48_166.png',
                    3:'Basement_Singles_Shadowless_48x48_186.png',
                },
                frameName: 'Basement_Singles_Shadowless_48x48_165.png' 
            },
            { 
                label: '电视',
                color: '#ffffff',
                utility: 'cinema_', 
                tags: ['tv'],
                h: 12,
                frameDirs:{
                    0:'Basement_Singles_Shadowless_48x48_164.png',
                    1:'Basement_Singles_Shadowless_48x48_190.png',
                    2:'Basement_Singles_Shadowless_48x48_163.png',
                    3:'Basement_Singles_Shadowless_48x48_190.png',
                },
                frameName: 'Basement_Singles_Shadowless_48x48_164.png' 
            },
            { 
                label: '游戏机',
                color: '#ffffff',
                utility: 'play', 
                tags: ['tv','game'],
                h: 6,
                placementLayer: 'surface',
                frameName: 'Basement_Singles_Shadowless_48x48_177.png' 
            },
            { 
                label: '游戏机',
                color: '#ffffff',
                utility: 'play', 
                tags: ['tv','game'],
                h: 6,
                placementLayer: 'surface',
                frameName: 'Basement_Singles_Shadowless_48x48_180.png' 
            },
            { 
                label: '椅子', 
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat'],
                h: 32,
                frameName: 'Living_Room_Singles_48x48_92.png' 
            },
            { 
                label: '椅子',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat'],
                h: 32,
                frameName: 'Living_Room_Singles_48x48_93.png' 
            },
            { 
                label: '单人沙发椅',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat','sofa'],
                h: 24,
                frameDirs:{
                    0:'Basement_Singles_Shadowless_48x48_202.png',
                    1:'Basement_Singles_Shadowless_48x48_211.png',
                    2:'Basement_Singles_Shadowless_48x48_206.png',
                    3:'Basement_Singles_Shadowless_48x48_215.png',
                },
                frameName: 'Basement_Singles_Shadowless_48x48_202.png' 
            },
            { 
                label: '单人沙发椅',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat','sofa'],
                h: 24,
                frameDirs:{
                    0:'Basement_Singles_Shadowless_48x48_203.png',
                    1:'Basement_Singles_Shadowless_48x48_210.png',
                    2:'Basement_Singles_Shadowless_48x48_207.png',
                    3:'Basement_Singles_Shadowless_48x48_214.png',
                },
                frameName: 'Basement_Singles_Shadowless_48x48_203.png' 
            },
            { 
                label: '单人沙发椅',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat','sofa'],
                h: 24,
                frameDirs:{
                    0:'Basement_Singles_Shadowless_48x48_204.png',
                    1:'Basement_Singles_Shadowless_48x48_213.png',
                    2:'Basement_Singles_Shadowless_48x48_208.png',
                    3:'Basement_Singles_Shadowless_48x48_217.png',
                },
                frameName: 'Basement_Singles_Shadowless_48x48_204.png' 
            },
            { 
                label: '单人沙发椅',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat','sofa'],
                h: 24,
                frameDirs:{
                    0:'Basement_Singles_Shadowless_48x48_205.png',
                    1:'Basement_Singles_Shadowless_48x48_212.png',
                    2:'Basement_Singles_Shadowless_48x48_209.png',
                    3:'Basement_Singles_Shadowless_48x48_216.png',
                },
                frameName: 'Basement_Singles_Shadowless_48x48_205.png' 
            },
            { 
                label: '组合沙发椅-左',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat','sofa'],
                frameDirs:{
                    0:'Basement_Singles_Shadowless_48x48_4.png',
                    1:'Basement_Singles_Shadowless_48x48_33.png',
                    2:'Basement_Singles_Shadowless_48x48_53.png',
                    3:'Basement_Singles_Shadowless_48x48_38.png',
                },
                frameName: 'Basement_Singles_Shadowless_48x48_4.png' 
            },
            { 
                label: '组合沙发椅-中',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat','sofa'],
                frameDirs:{
                    0:'Basement_Singles_Shadowless_48x48_5.png',
                    1:'Basement_Singles_Shadowless_48x48_34.png',
                    2:'Basement_Singles_Shadowless_48x48_52.png',
                    3:'Basement_Singles_Shadowless_48x48_37.png',
                },
                frameName: 'Basement_Singles_Shadowless_48x48_5.png' 
            },
            { 
                label: '组合沙发椅-右',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat','sofa'],
                frameDirs:{
                    0:'Basement_Singles_Shadowless_48x48_6.png',
                    1:'Basement_Singles_Shadowless_48x48_35.png',
                    2:'Basement_Singles_Shadowless_48x48_51.png',
                    3:'Basement_Singles_Shadowless_48x48_36.png',
                },
                frameName: 'Basement_Singles_Shadowless_48x48_6.png' 
            },
            { 
                label: '矮沙发椅',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat'],
                h: 32,
                frameName: 'Basement_Singles_Shadowless_48x48_9.png' 
            },
            { 
                label: '单人沙发椅',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat'],
                frameName: 'Basement_Singles_Shadowless_48x48_198.png' 
            },
            { 
                label: '单人沙发椅',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat'],
                frameName: 'Basement_Singles_Shadowless_48x48_200.png' 
            },
            { 
                label: '板凳',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat'],
                h: 20,
                frameName: 'Basement_Singles_Shadowless_48x48_103.png' 
            },
            { 
                label: '板凳',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat'],
                h: 20,
                frameName: 'Basement_Singles_Shadowless_48x48_105.png' 
            },
            { 
                label: '板凳',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat'],
                h: 20,
                frameName: 'Basement_Singles_Shadowless_48x48_107.png' 
            },
            { 
                label: '板凳',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat'],
                h: 20,
                frameName: 'Basement_Singles_Shadowless_48x48_109.png' 
            },
            { 
                label: '板凳',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat'],
                h: 20,
                frameName: 'Basement_Singles_Shadowless_48x48_111.png' 
            },
            { 
                label: '板凳',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat'],
                h: 20,
                frameName: 'Basement_Singles_Shadowless_48x48_113.png' 
            },
            { 
                label: '小盆栽', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 12,
                frameName: 'Living_Room_Singles_48x48_13.png' 
            },
            { 
                label: '小盆栽', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 12,
                frameName: 'Living_Room_Singles_48x48_14.png' 
            },
            { 
                label: '迷你盆栽',
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 10,
                placementLayer: 'surface',
                frameName: 'Living_Room_Singles_48x48_15.png' 
            },
            { 
                label: '小盆栽',
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 12,
                frameName: 'Living_Room_Singles_48x48_16.png' 
            },
            { 
                label: '梳妆台', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 32,
                frameName: 'Living_Room_Singles_48x48_19.png' 
            },
            { 
                label: '梳妆台', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 32,
                frameName: 'Living_Room_Singles_48x48_26.png' 
            },
            { 
                label: '落地灯',
                color: '#ffffff',
                utility: 'none', 
                tags: ['light'],
                h: 12,
                frameName: 'Living_Room_Singles_48x48_80.png' 
            },
            { 
                label: '落地灯',
                color: '#ffffff',
                utility: 'none', 
                tags: ['light'],
                h: 12,
                frameName: 'Living_Room_Singles_48x48_81.png' 
            },
            { 
                label: '落地灯',
                color: '#ffffff',
                utility: 'none', 
                tags: ['light'],
                h: 12,
                frameName: 'Living_Room_Singles_48x48_83.png' 
            },
            { 
                label: '落地灯',
                color: '#ffffff',
                utility: 'none', 
                tags: ['light'],
                h: 12,
                frameName: 'Living_Room_Singles_48x48_84.png' 
            },
            { 
                label: '落地灯',
                color: '#ffffff',
                utility: 'none', 
                tags: ['light'],
                h: 12,
                frameName: 'Living_Room_Singles_48x48_88.png' 
            },
            { 
                label: '壁炉', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 36,
                frameName: 'Living_Room_Singles_48x48_108.png' 
            },
            { 
                label: '壁炉',  
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 36,
                frameName: 'Living_Room_Singles_48x48_110.png' 
            },
            { 
                label: '壁炉', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 36,
                frameName: 'Living_Room_Singles_48x48_112.png' 
            },
            { 
                label: '壁炉', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 36,
                frameName: 'Living_Room_Singles_48x48_114.png' 
            },
            { 
                label: '柴', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 36,
                frameName: 'Living_Room_Singles_48x48_116.png' 
            },
            { 
                label: '柴', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 36,
                frameName: 'Living_Room_Singles_48x48_121.png' 
            },
        ]
    },
    'bedroom':{
        label:'卧室',
        items:[
            {},
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
            {},
        ]
    },
    'work': {
        label: '办公用品',
        items: [
            { label: '工位', w: 50, h: 40, color: '#dfe6e9', utility: 'work', pixelPattern: 'desk_pixel', tags: ['computer', 'desk'] },
            { label: '收银台', w: 60, h: 40, color: '#2c3e50', utility: 'work', pixelPattern: 'cashier', tags: ['cashier'] },
            { label: '货架', w: 50, h: 100, color: '#fdcb6e', utility: 'buy_item', pixelPattern: 'shelf_food', tags: ['shelf'] },
            { 
                label: '办公工位',
                color: '#ffffff',
                utility: 'work', 
                tags: ['seat','computer'],
                frameDirs:{
                    0:'办公椅背01.png',
                    1:'办公椅左01.png',
                    2:'办公椅正01.png',
                    3:'办公椅右01.png',
                },
                frameName: '办公椅背01.png' 
            },
            { 
                label: '办公工位',
                color: '#ffffff',
                utility: 'work', 
                tags: ['seat','computer'],
                frameDirs:{
                    0:'办公椅背02.png',
                    1:'办公椅左02.png',
                    2:'办公椅正02.png',
                    3:'办公椅右02.png',
                },
                frameName: '办公椅背02.png' 
            },
            { 
                label: '单人沙发',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat','sofa'],
                frameName: '单人沙发01.png' 
            },
            { 
                label: '单人沙发',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat','sofa'],
                frameName: '单人沙发02.png' 
            },
            { 
                label: '沙发',
                color: '#ffffff',
                utility: 'comfort', 
                tags: ['seat','sofa'],
                frameName: '沙发.png' 
            },
            { 
                label: '方桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameName: '方桌01.png',
                isSurface: true, 
                surfaceHeight: 5, 
                placementLayer: 'floor' 
            },
            { 
                label: '方桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameName: '方桌02.png',
                isSurface: true, 
                surfaceHeight: 5, 
                placementLayer: 'floor' 
            },
            { 
                label: '方桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameName: '方桌03.png',
                isSurface: true, 
                surfaceHeight: 5, 
                placementLayer: 'floor' 
            },
            { 
                label: '方桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameName: '方桌04.png',
                isSurface: true, 
                surfaceHeight: 5, 
                placementLayer: 'floor' 
            },
            { 
                label: '长桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameName: '长桌01.png',
                isSurface: true, 
                surfaceHeight: 10, 
                placementLayer: 'floor' 
            },
            { 
                label: '长桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameName: '长桌02.png',
                isSurface: true, 
                surfaceHeight: 10, 
                placementLayer: 'floor' 
            },
            { 
                label: '长桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameName: '长桌03.png',
                isSurface: true, 
                surfaceHeight: 10, 
                placementLayer: 'floor' 
            },
            { 
                label: '长桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameName: '长桌04.png',
                isSurface: true, 
                surfaceHeight: 10, 
                placementLayer: 'floor' 
            },
            { 
                label: 'C桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameName: 'c桌01.png',
                isSurface: true, 
                surfaceHeight: 5, 
                h:48*3,
                placementLayer: 'floor' 
            },
            { 
                label: 'C桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameName: 'c桌02.png',
                isSurface: true, 
                surfaceHeight: 5, 
                h:48*3,
                placementLayer: 'floor' 
            },
            { 
                label: 'C桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameName: 'c桌03.png',
                isSurface: true, 
                surfaceHeight: 5, 
                h:48*3,
                placementLayer: 'floor' 
            },
            { 
                label: 'C桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameName: 'c桌04.png',
                isSurface: true, 
                surfaceHeight: 5,
                h:48*3, 
                placementLayer: 'floor' 
            },
            { 
                label: 'L桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameDirs:{
                    0:'l桌竖01.png',
                    1:'l桌左01.png',
                    2:'l桌竖01.png',
                    3:'l桌右01.png',
                },
                frameName: 'l桌竖01.png',
                isSurface: true, 
                surfaceHeight: 5, 
                h:48*3, 
                placementLayer: 'floor' 
            },
            { 
                label: 'L桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameDirs:{
                    0:'l桌竖02.png',
                    1:'l桌左02.png',
                    2:'l桌竖02.png',
                    3:'l桌右02.png',
                },
                frameName: 'l桌竖02.png',
                isSurface: true, 
                surfaceHeight: 5, 
                h:48*3, 
                placementLayer: 'floor' 
            },
            { 
                label: 'L桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameDirs:{
                    0:'l桌竖03.png',
                    1:'l桌左03.png',
                    2:'l桌竖03.png',
                    3:'l桌右03.png',
                },
                frameName: 'l桌竖03.png',
                isSurface: true, 
                surfaceHeight: 5, 
                h:48*3, 
                placementLayer: 'floor' 
            },
            { 
                label: 'L桌',
                color: '#ffffff',
                utility: 'none', 
                tags: ['desk'],
                frameDirs:{
                    0:'l桌竖04.png',
                    1:'l桌左04.png',
                    2:'l桌竖04.png',
                    3:'l桌右04.png',
                },
                frameName: 'l桌竖04.png',
                isSurface: true, 
                surfaceHeight: 5,
                h:48*3, 
                placementLayer: 'floor' 
            },
            { 
                label: '笔记本电脑',
                color: '#ffffff',
                utility: 'work', 
                tags: ['computer'],
                h: 10,
                placementLayer: 'surface',
                frameDirs:{
                    0:'笔记本正01.png',
                    1:'笔记本左.png',
                    2:'笔记本背01.png',
                    3:'笔记本右.png',
                },
                frameName: '笔记本正01.png' 
            },
            { 
                label: '电脑',
                color: '#ffffff',
                utility: 'work', 
                tags: ['computer'],
                h: 6,
                placementLayer: 'surface',
                frameDirs:{
                    0:'显示屏正01.png',
                    1:'显示屏左01.png',
                    2:'显示屏背01.png',
                    3:'显示屏右01.png',
                },
                frameName: '显示屏正01.png' 
            },
            { 
                label: '电脑',
                color: '#ffffff',
                utility: 'work', 
                tags: ['computer'],
                h: 6,
                placementLayer: 'surface',
                frameDirs:{
                    0:'显示屏正02.png',
                    1:'显示屏左02.png',
                    2:'显示屏背02.png',
                    3:'显示屏右02.png',
                },
                frameName: '显示屏正02.png' 
            },
            { 
                label: '电话',
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 10,
                placementLayer: 'surface',
                frameName: '固话.png' 
            },
            { 
                label: '茶水台',
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                frameName: '茶水台01.png' 
            },
            { 
                label: '茶水台',
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                frameName: '茶水台02.png' 
            },
            { 
                label: '茶水台',
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                frameName: '茶水台03.png' 
            },
            { 
                label: '饮水机',
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                frameName: '饮水机.png' 
            },
            { 
                label: '自动售卖机',
                color: '#ffffff',
                utility: 'buy_drink', 
                tags: ['shop'],
                frameName: '自动贩卖机.png' 
            },
            { 
                label: '书架',
                color: '#ffffff',
                utility: 'none', 
                h: 15,
                tags: ['decor'],
                frameName: '书架满.png' 
            },
            { 
                label: '白板',
                color: '#ffffff',
                utility: 'none', 
                h: 10,
                tags: ['decor'],
                frameName: '黑板02.png' 
            },
            { 
                label: '白板',
                color: '#ffffff',
                utility: 'none', 
                h: 10,
                tags: ['decor'],
                frameName: '黑板03.png' 
            },
            { 
                label: '键盘鼠标',
                color: '#ffffff',
                utility: 'none', 
                placementLayer: 'surface',
                h: 6,
                tags: ['decor'],
                frameName: '键盘鼠标.png' 
            },
            { 
                label: '台灯',
                color: '#ffffff',
                utility: 'none', 
                placementLayer: 'surface',
                h: 6,
                tags: ['light'],
                frameDirs:{
                    0:'台灯右01.png',
                    1:'台灯左01.png',
                    2:'台灯右01.png',
                    3:'台灯左01.png',
                },
                frameName: '台灯右01.png' 
            },
            { 
                label: '打印机',
                color: '#ffffff',
                utility: 'none', 
                placementLayer: 'surface',
                h: 15,
                tags: ['decor'],
                frameName: '打印机.png' 
            },
            { 
                label: '纸',
                color: '#ffffff',
                utility: 'none', 
                placementLayer: 'surface',
                h: 15,
                tags: ['decor'],
                frameName: '打印纸.png' 
            },
            { 
                label: '资料',
                color: '#ffffff',
                utility: 'none', 
                placementLayer: 'surface',
                h: 15,
                tags: ['decor'],
                frameName: '一摞资料.png' 
            },
            { 
                label: '垃圾桶', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 30,
                frameName: '办公室垃圾箱关.png' 
            },
            { 
                label: '盆栽', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 20,
                frameName: '盆栽01.png' 
            },
            { 
                label: '盆栽', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                h: 20,
                frameName: '盆栽02.png' 
            },
            { 
                label: '桌面盆栽', 
                color: '#ffffff',
                utility: 'none', 
                tags: ['decor'],
                placementLayer: 'surface',
                h: 10,
                frameName: '盆栽04.png' 
            },
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