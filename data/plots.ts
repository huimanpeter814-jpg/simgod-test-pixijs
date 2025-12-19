import { PlotTemplate, Furniture } from '../types';

// 辅助：快速生成矩阵家具
const createGrid = (baseId: string, startX: number, startY: number, cols: number, rows: number, gapX: number, gapY: number, props: any) => {
    let items: Furniture[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            items.push({
                ...props, id: `${baseId}_${r}_${c}`,
                x: startX + c * gapX, y: startY + r * gapY
            });
        }
    }
    return items;
};

// ==========================================
// 1. 居住类 (Residential)
// ==========================================

// --- 便宜小公寓 (一卧一卫一厨) ---
const PLOT_APT_CHEAP_S: PlotTemplate = {
    id: 'apt_cheap_s', width: 170, height: 170, type: 'residential',
    housingUnits: [{ id: 'unit', name: '蜗居', capacity: 1, cost: 400, type: 'public_housing', area: { x: 5, y: 5, w: 160, h: 160 } }],
    rooms: [{ id: 'main', x: 5, y: 5, w: 160, h: 160, label: '房间', color: '#f5f6fa', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        { id: 'bed', x: 10, y: 10, w: 60, h: 80, color: '#74b9ff', label: '床', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed', 'sleep'] },
        { id: 'toilet', x: 130, y: 10, w: 20, h: 20, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
        { id: 'stove', x: 10, y: 130, w: 50, h: 30, color: '#b2bec3', label: '灶', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] }
    ]
};

const PLOT_APT_CHEAP_M: PlotTemplate = {
    id: 'apt_cheap_m', width: 155, height: 195, type: 'residential',
    housingUnits: [{ id: 'unit', name: '单间', capacity: 2, cost: 600, type: 'public_housing', area: { x: 5, y: 5, w: 145, h: 185 } }],
    rooms: [{ id: 'main', x: 5, y: 5, w: 145, h: 185, label: '房间', color: '#f5f6fa', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        { id: 'bed', x: 10, y: 10, w: 70, h: 90, color: '#74b9ff', label: '双人床', utility: 'energy', pixelPattern: 'bed_king', multiUser: true, tags: ['bed'] },
        { id: 'toilet', x: 110, y: 10, w: 20, h: 20, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
        { id: 'stove', x: 10, y: 150, w: 60, h: 30, color: '#b2bec3', label: '灶', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] }
    ]
};

const PLOT_APT_CHEAP_L: PlotTemplate = {
    id: 'apt_cheap_l', width: 195, height: 180, type: 'residential',
    housingUnits: [{ id: 'unit', name: '大单间', capacity: 2, cost: 800, type: 'public_housing', area: { x: 5, y: 5, w: 185, h: 170 } }],
    rooms: [{ id: 'main', x: 5, y: 5, w: 185, h: 170, label: '房间', color: '#f5f6fa', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        { id: 'bed', x: 10, y: 10, w: 80, h: 90, color: '#74b9ff', label: '大床', utility: 'energy', pixelPattern: 'bed_king', multiUser: true, tags: ['bed'] },
        { id: 'sofa', x: 10, y: 120, w: 60, h: 40, color: '#a29bfe', label: '沙发', utility: 'comfort', pixelPattern: 'sofa_pixel', tags: ['sofa'] },
        { id: 'toilet', x: 150, y: 10, w: 20, h: 20, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
        { id: 'stove', x: 100, y: 130, w: 60, h: 30, color: '#b2bec3', label: '厨', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] }
    ]
};

// --- 高级公寓 (两卧一卫一厨一厅) ---
const PLOT_APT_LUXURY_S: PlotTemplate = {
    id: 'apt_luxury_s', width: 215, height: 220, type: 'residential',
    housingUnits: [{ id: 'unit', name: '精致公寓', capacity: 3, cost: 2500, type: 'apartment', area: { x: 5, y: 5, w: 205, h: 210 } }],
    rooms: [
        { id: 'living', x: 5, y: 5, w: 100, h: 210, label: '厅', color: '#fff', pixelPattern: 'wood', hasWall: true },
        { id: 'rooms', x: 110, y: 5, w: 100, h: 210, label: '卧', color: '#f1f2f6', pixelPattern: 'wood', hasWall: true }
    ],
    furniture: [
        { id: 'sofa', x: 10, y: 10, w: 80, h: 40, color: '#a29bfe', label: '沙发', utility: 'comfort', pixelPattern: 'sofa_vip', tags: ['sofa'] },
        { id: 'kitchen', x: 10, y: 170, w: 80, h: 30, color: '#b2bec3', label: '厨', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'bed1', x: 120, y: 10, w: 70, h: 80, color: '#ff7675', label: '主卧', utility: 'energy', pixelPattern: 'bed_king', multiUser: true, tags: ['bed'] },
        { id: 'bed2', x: 120, y: 100, w: 50, h: 70, color: '#74b9ff', label: '次卧', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed'] },
        { id: 'toilet', x: 180, y: 180, w: 20, h: 20, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_APT_LUXURY_M: PlotTemplate = {
    id: 'apt_luxury_m', width: 260, height: 220, type: 'residential',
    housingUnits: [{ id: 'unit', name: '高级公寓', capacity: 4, cost: 3000, type: 'apartment', area: { x: 5, y: 5, w: 250, h: 210 } }],
    rooms: [{ id: 'main', x: 5, y: 5, w: 250, h: 210, label: '全屋', color: '#f5f6fa', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        { id: 'bed1', x: 160, y: 10, w: 70, h: 90, color: '#ff7675', label: '主卧', utility: 'energy', pixelPattern: 'bed_king', multiUser: true, tags: ['bed'] },
        { id: 'bed2', x: 160, y: 110, w: 60, h: 80, color: '#74b9ff', label: '次卧', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed'] },
        { id: 'sofa', x: 20, y: 20, w: 100, h: 40, color: '#a29bfe', label: '沙发', utility: 'comfort', pixelPattern: 'sofa_pixel', tags: ['sofa'] },
        { id: 'kitchen', x: 20, y: 170, w: 100, h: 30, color: '#b2bec3', label: '厨', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'toilet', x: 220, y: 180, w: 20, h: 20, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_APT_LUXURY_L: PlotTemplate = {
    id: 'apt_luxury_l', width: 260, height: 235, type: 'residential',
    housingUnits: [{ id: 'unit', name: '豪华大平层', capacity: 4, cost: 4000, type: 'apartment', area: { x: 5, y: 5, w: 250, h: 225 } }],
    rooms: [{ id: 'main', x: 5, y: 5, w: 250, h: 225, label: '大平层', color: '#f5f6fa', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        { id: 'bed1', x: 160, y: 10, w: 80, h: 90, color: '#ff7675', label: '主卧', utility: 'energy', pixelPattern: 'bed_king', multiUser: true, tags: ['bed'] },
        { id: 'bed2', x: 160, y: 110, w: 70, h: 80, color: '#74b9ff', label: '次卧', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed'] },
        { id: 'sofa', x: 20, y: 20, w: 120, h: 50, color: '#a29bfe', label: '大沙发', utility: 'comfort', pixelPattern: 'sofa_vip', tags: ['sofa'] },
        { id: 'kitchen', x: 20, y: 180, w: 100, h: 30, color: '#b2bec3', label: '整体厨房', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'toilet', x: 220, y: 200, w: 20, h: 20, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

// --- 别墅 (两卧一卫一厨一厅一书房一花园) ---
const PLOT_VILLA_S: PlotTemplate = {
    id: 'villa_s', width: 370, height: 290, type: 'residential',
    housingUnits: [{ id: 'unit', name: '花园洋房', capacity: 5, cost: 8000, type: 'villa', area: { x: 5, y: 5, w: 360, h: 280 } }],
    rooms: [
        { id: 'garden', x: 0, y: 0, w: 370, h: 290, label: '花园', color: '#55efc4', pixelPattern: 'grass' },
        { id: 'house', x: 20, y: 20, w: 250, h: 250, label: '主楼', color: '#fff', pixelPattern: 'wood', hasWall: true },
        { id: 'study', x: 280, y: 20, w: 80, h: 100, label: '书房', color: '#dfe6e9', pixelPattern: 'wood', hasWall: true }
    ],
    furniture: [
        { id: 'bed1', x: 30, y: 30, w: 80, h: 90, color: '#ff7675', label: '主卧', utility: 'energy', pixelPattern: 'bed_king', multiUser: true, tags: ['bed'] },
        { id: 'bed2', x: 120, y: 30, w: 60, h: 80, color: '#74b9ff', label: '次卧', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed'] },
        { id: 'desk', x: 290, y: 30, w: 60, h: 40, color: '#a29bfe', label: '书桌', utility: 'work', pixelPattern: 'desk_pixel', tags: ['desk', 'computer'] },
        { id: 'sofa', x: 30, y: 140, w: 100, h: 50, color: '#a29bfe', label: '厅', utility: 'comfort', pixelPattern: 'sofa_vip', tags: ['sofa'] },
        { id: 'kitchen', x: 150, y: 140, w: 100, h: 40, color: '#b2bec3', label: '厨', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'toilet', x: 180, y: 200, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
        { id: 'plant', x: 300, y: 200, w: 40, h: 40, color: '#2ecc71', label: '花', utility: 'gardening', pixelPattern: 'bush', tags: ['plant'] }
    ]
};

const PLOT_VILLA_M: PlotTemplate = {
    id: 'villa_m', width: 405, height: 285, type: 'residential',
    housingUnits: [{ id: 'unit', name: '湖景别墅', capacity: 6, cost: 10000, type: 'villa', area: { x: 5, y: 5, w: 395, h: 275 } }],
    rooms: [
        { id: 'garden', x: 0, y: 0, w: 405, h: 285, label: '花园', color: '#55efc4', pixelPattern: 'grass' },
        { id: 'house', x: 20, y: 20, w: 280, h: 245, label: '主楼', color: '#fff', pixelPattern: 'wood', hasWall: true },
        { id: 'study', x: 310, y: 20, w: 80, h: 100, label: '书房', color: '#dfe6e9', pixelPattern: 'wood', hasWall: true }
    ],
    furniture: [
        { id: 'bed1', x: 30, y: 30, w: 80, h: 90, color: '#ff7675', label: '主卧', utility: 'energy', pixelPattern: 'bed_king', multiUser: true, tags: ['bed'] },
        { id: 'bed2', x: 130, y: 30, w: 70, h: 80, color: '#74b9ff', label: '次卧', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed'] },
        { id: 'desk', x: 320, y: 30, w: 60, h: 40, color: '#a29bfe', label: '书桌', utility: 'work', pixelPattern: 'desk_pixel', tags: ['desk', 'computer'] },
        { id: 'sofa', x: 30, y: 150, w: 100, h: 50, color: '#a29bfe', label: '大厅', utility: 'comfort', pixelPattern: 'sofa_vip', tags: ['sofa'] },
        { id: 'kitchen', x: 160, y: 150, w: 100, h: 40, color: '#b2bec3', label: '厨房', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'toilet', x: 220, y: 210, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_VILLA_L: PlotTemplate = {
    id: 'villa_l', width: 425, height: 305, type: 'residential',
    housingUnits: [{ id: 'unit', name: '半山豪宅', capacity: 6, cost: 12000, type: 'villa', area: { x: 5, y: 5, w: 415, h: 295 } }],
    rooms: [
        { id: 'garden', x: 0, y: 0, w: 425, h: 305, label: '花园', color: '#55efc4', pixelPattern: 'grass' },
        { id: 'main', x: 20, y: 20, w: 300, h: 265, label: '主楼', color: '#fff', pixelPattern: 'wood', hasWall: true },
        { id: 'study', x: 330, y: 150, w: 80, h: 100, label: '书房', color: '#dfe6e9', pixelPattern: 'wood', hasWall: true }
    ],
    furniture: [
        { id: 'bed_k', x: 30, y: 30, w: 90, h: 100, color: '#ff7675', label: '皇室床', utility: 'energy', pixelPattern: 'bed_king', multiUser: true, tags: ['bed'] },
        { id: 'bed_s', x: 130, y: 30, w: 70, h: 90, color: '#74b9ff', label: '次卧', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed'] },
        { id: 'sofa', x: 30, y: 160, w: 120, h: 60, color: '#a29bfe', label: '真皮沙发', utility: 'comfort', pixelPattern: 'sofa_vip', tags: ['sofa'] },
        { id: 'kitchen', x: 180, y: 160, w: 100, h: 40, color: '#b2bec3', label: '开放厨房', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'desk', x: 340, y: 160, w: 60, h: 40, color: '#8b4513', label: '老板桌', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk', 'computer'] },
        { id: 'toilet', x: 240, y: 30, w: 40, h: 40, color: '#fff', label: '豪华卫', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

// ==========================================
// 2. 办公类 (Workplace)
// ==========================================

// --- 互联网公司 (办公+厕+饭堂+老板) ---
const PLOT_IT_S: PlotTemplate = {
    id: 'internet_s', width: 260, height: 230, type: 'work',
    rooms: [{ id: 'main', x: 5, y: 5, w: 250, h: 220, label: '初创IT', color: '#f1f2f6', pixelPattern: 'grid', hasWall: true }],
    furniture: [
        ...createGrid('desk', 20, 20, 2, 2, 70, 50, { w: 60, h: 40, color: '#dfe6e9', label: '工位', utility: 'work', pixelPattern: 'desk_pixel', tags: ['desk', 'computer'] }),
        { id: 'boss', x: 180, y: 20, w: 60, h: 40, color: '#8b4513', label: '老板', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk', 'boss_desk'] },
        { id: 'canteen', x: 20, y: 140, w: 60, h: 40, color: '#fab1a0', label: '饭堂', utility: 'eat_canteen', pixelPattern: 'table_dining', tags: ['table'] },
        { id: 'toilet', x: 180, y: 140, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_IT_M: PlotTemplate = {
    id: 'internet_m', width: 285, height: 230, type: 'work',
    rooms: [{ id: 'main', x: 5, y: 5, w: 275, h: 220, label: '科技公司', color: '#f1f2f6', pixelPattern: 'grid', hasWall: true }],
    furniture: [
        ...createGrid('desk', 20, 20, 3, 2, 60, 50, { w: 50, h: 40, color: '#dfe6e9', label: '工位', utility: 'work', pixelPattern: 'desk_pixel', tags: ['desk', 'computer'] }),
        { id: 'boss', x: 210, y: 20, w: 60, h: 50, color: '#8b4513', label: 'CEO', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk', 'boss_desk'] },
        { id: 'canteen', x: 20, y: 150, w: 80, h: 40, color: '#fab1a0', label: '员工餐', utility: 'eat_canteen', pixelPattern: 'table_dining', tags: ['table'] },
        { id: 'toilet', x: 220, y: 150, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_IT_L: PlotTemplate = {
    id: 'internet_l', width: 405, height: 285, type: 'work',
    rooms: [{ id: 'main', x: 5, y: 5, w: 395, h: 275, label: '互联网总部', color: '#f1f2f6', pixelPattern: 'grid', hasWall: true }],
    furniture: [
        ...createGrid('desk', 20, 20, 4, 3, 70, 60, { w: 50, h: 40, color: '#dfe6e9', label: '工位', utility: 'work', pixelPattern: 'desk_pixel', tags: ['desk', 'computer'] }),
        { id: 'boss', x: 320, y: 20, w: 70, h: 50, color: '#8b4513', label: '总裁办', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk', 'boss_desk'] },
        { id: 'canteen', x: 300, y: 150, w: 80, h: 60, color: '#fab1a0', label: '自助餐', utility: 'eat_canteen', pixelPattern: 'table_dining', tags: ['table'] },
        { id: 'toilet', x: 320, y: 230, w: 40, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

// --- 商务公司 (办公+厕+饭堂+老板) ---
const PLOT_BIZ_S: PlotTemplate = {
    id: 'business_s', width: 260, height: 220, type: 'work',
    rooms: [{ id: 'main', x: 5, y: 5, w: 250, h: 210, label: '办事处', color: '#ced6e0', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('desk', 20, 20, 2, 2, 70, 50, { w: 60, h: 40, color: '#b2bec3', label: '办公桌', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk'] }),
        { id: 'boss', x: 170, y: 20, w: 70, h: 50, color: '#2d3436', label: '经理', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk', 'boss_desk'] },
        { id: 'canteen', x: 20, y: 140, w: 60, h: 40, color: '#fab1a0', label: '用餐', utility: 'eat_canteen', pixelPattern: 'table_dining', tags: ['table'] },
        { id: 'toilet', x: 200, y: 140, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_BIZ_M: PlotTemplate = {
    id: 'business_m', width: 290, height: 205, type: 'work',
    rooms: [{ id: 'main', x: 5, y: 5, w: 280, h: 195, label: '商务部', color: '#ced6e0', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('desk', 20, 20, 3, 2, 70, 50, { w: 60, h: 40, color: '#b2bec3', label: '办公桌', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk', 'computer'] }),
        { id: 'boss', x: 20, y: 140, w: 80, h: 40, color: '#2d3436', label: '主管', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk', 'boss_desk'] },
        { id: 'canteen', x: 120, y: 140, w: 80, h: 40, color: '#fab1a0', label: '食堂', utility: 'eat_canteen', pixelPattern: 'table_dining', tags: ['table'] },
        { id: 'toilet', x: 220, y: 140, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_BIZ_L: PlotTemplate = {
    id: 'business_l', width: 410, height: 325, type: 'work',
    rooms: [{ id: 'main', x: 5, y: 5, w: 400, h: 315, label: '金融中心', color: '#ced6e0', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('desk', 20, 20, 3, 3, 90, 60, { w: 70, h: 40, color: '#b2bec3', label: '办公桌', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk', 'computer'] }),
        { id: 'boss', x: 300, y: 20, w: 90, h: 60, color: '#2d3436', label: '总裁', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk', 'boss_desk'] },
        { id: 'canteen', x: 20, y: 220, w: 100, h: 60, color: '#fab1a0', label: '自助餐厅', utility: 'eat_canteen', pixelPattern: 'table_dining', tags: ['table'] },
        { id: 'toilet', x: 350, y: 250, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

// --- 设计公司 (办公+厕+总监) ---
const PLOT_DESIGN_S: PlotTemplate = {
    id: 'design_s', width: 195, height: 240, type: 'work',
    rooms: [{ id: 'main', x: 5, y: 5, w: 185, h: 230, label: '工作室', color: '#fff0f0', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        ...createGrid('mac', 20, 20, 2, 2, 80, 60, { w: 60, h: 40, color: '#fff', label: 'iMac', utility: 'work', pixelPattern: 'desk_pixel', tags: ['computer', 'desk'] }),
        { id: 'dir', x: 20, y: 150, w: 70, h: 40, color: '#a29bfe', label: '总监', utility: 'work', pixelPattern: 'desk_pixel', tags: ['desk', 'boss_desk'] },
        { id: 'toilet', x: 140, y: 190, w: 30, h: 30, color: '#fff', label: '卫', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_DESIGN_M: PlotTemplate = {
    id: 'design_m', width: 260, height: 235, type: 'work',
    rooms: [{ id: 'main', x: 5, y: 5, w: 250, h: 225, label: '设计部', color: '#fff0f0', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        ...createGrid('mac', 20, 20, 2, 2, 90, 70, { w: 70, h: 40, color: '#fff', label: 'iMac', utility: 'work', pixelPattern: 'desk_pixel', tags: ['computer', 'desk'] }),
        { id: 'dir', x: 20, y: 170, w: 80, h: 40, color: '#a29bfe', label: '总监', utility: 'work', pixelPattern: 'desk_pixel', tags: ['desk', 'boss_desk'] },
        { id: 'toilet', x: 200, y: 180, w: 30, h: 30, color: '#fff', label: '卫', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_DESIGN_L: PlotTemplate = {
    id: 'design_l', width: 370, height: 290, type: 'work',
    rooms: [{ id: 'main', x: 5, y: 5, w: 360, h: 280, label: '创意园', color: '#fff0f0', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        ...createGrid('mac', 20, 20, 3, 2, 90, 70, { w: 70, h: 40, color: '#fff', label: 'iMac', utility: 'work', pixelPattern: 'desk_pixel', tags: ['computer', 'desk'] }),
        { id: 'dir', x: 20, y: 180, w: 90, h: 50, color: '#a29bfe', label: '创意总监', utility: 'work', pixelPattern: 'desk_pixel', tags: ['desk', 'boss_desk'] },
        { id: 'easel', x: 300, y: 20, w: 40, h: 50, color: '#ff7675', label: '画架', utility: 'paint', pixelPattern: 'easel', tags: ['easel'] },
        { id: 'toilet', x: 300, y: 230, w: 40, h: 30, color: '#fff', label: '卫', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

// ==========================================
// 3. 商业类 (Commercial)
// ==========================================

// --- 餐厅 (用餐+前台+后厨+公厕) ---
const PLOT_RESTAURANT_S: PlotTemplate = {
    id: 'restaurant_s', width: 190, height: 205, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 180, h: 195, label: '小餐馆', color: '#ffeb3b', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('table', 10, 10, 2, 2, 50, 50, { w: 40, h: 40, color: '#fab1a0', label: '餐桌', utility: 'eat_out', pixelPattern: 'table_dining', tags: ['table'] }),
        { id: 'cash', x: 10, y: 150, w: 50, h: 30, color: '#2c3e50', label: '前台', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        { id: 'stove', x: 130, y: 10, w: 40, h: 30, color: '#636e72', label: '灶', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'toilet', x: 140, y: 160, w: 30, h: 30, color: '#fff', label: '卫', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_RESTAURANT_M: PlotTemplate = {
    id: 'restaurant_m', width: 215, height: 220, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 205, h: 210, label: '餐厅', color: '#ffeb3b', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('table', 15, 15, 2, 2, 60, 60, { w: 45, h: 45, color: '#fab1a0', label: '餐桌', utility: 'eat_out', pixelPattern: 'table_dining', tags: ['table'] }),
        { id: 'cash', x: 15, y: 170, w: 60, h: 30, color: '#2c3e50', label: '前台', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        { id: 'stove', x: 150, y: 20, w: 40, h: 30, color: '#636e72', label: '灶', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'toilet', x: 160, y: 170, w: 30, h: 30, color: '#fff', label: '卫', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_RESTAURANT_L: PlotTemplate = {
    id: 'restaurant_l', width: 260, height: 230, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 250, h: 220, label: '大饭店', color: '#ffeb3b', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('table', 20, 20, 3, 2, 60, 60, { w: 50, h: 50, color: '#fab1a0', label: '大桌', utility: 'eat_out', pixelPattern: 'table_dining', tags: ['table'] }),
        { id: 'cash', x: 20, y: 170, w: 60, h: 30, color: '#2c3e50', label: '前台', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        { id: 'stove', x: 200, y: 20, w: 40, h: 40, color: '#636e72', label: '后厨', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'toilet', x: 210, y: 170, w: 30, h: 30, color: '#fff', label: '卫', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

// --- 咖啡厅 (用餐+前台+料理+公厕) ---
const PLOT_CAFE_S: PlotTemplate = {
    id: 'cafe_s', width: 155, height: 195, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 145, h: 185, label: '小咖', color: '#d4a373', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        { id: 'counter', x: 10, y: 10, w: 80, h: 30, color: '#8b4513', label: '前台', utility: 'work', pixelPattern: 'reception', tags: ['bar', 'cashier'] },
        { id: 'prep', x: 100, y: 10, w: 30, h: 30, color: '#b2bec3', label: '料', utility: 'work', pixelPattern: 'kitchen', tags: ['stove'] },
        ...createGrid('table', 10, 60, 2, 2, 60, 50, { w: 40, h: 40, color: '#fff', label: '圆桌', utility: 'eat_out', pixelPattern: 'table_dining', tags: ['table'] }),
        { id: 'toilet', x: 110, y: 150, w: 20, h: 20, color: '#fff', label: '卫', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_CAFE_M: PlotTemplate = {
    id: 'cafe_m', width: 195, height: 180, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 185, h: 170, label: '咖啡厅', color: '#d4a373', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        { id: 'counter', x: 10, y: 10, w: 100, h: 30, color: '#8b4513', label: '吧台', utility: 'work', pixelPattern: 'reception', tags: ['bar', 'cashier'] },
        { id: 'prep', x: 120, y: 10, w: 50, h: 30, color: '#b2bec3', label: '料理', utility: 'work', pixelPattern: 'kitchen', tags: ['stove'] },
        ...createGrid('table', 10, 60, 2, 2, 70, 50, { w: 40, h: 40, color: '#fff', label: '圆桌', utility: 'eat_out', pixelPattern: 'table_dining', tags: ['table'] }),
        { id: 'toilet', x: 150, y: 130, w: 30, h: 30, color: '#fff', label: '卫', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_CAFE_L: PlotTemplate = {
    id: 'cafe_l', width: 200, height: 260, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 190, h: 250, label: '精品咖啡', color: '#d4a373', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        { id: 'counter', x: 10, y: 10, w: 120, h: 30, color: '#8b4513', label: '大吧台', utility: 'work', pixelPattern: 'reception', tags: ['bar', 'cashier'] },
        { id: 'prep', x: 140, y: 10, w: 40, h: 30, color: '#b2bec3', label: '料理', utility: 'work', pixelPattern: 'kitchen', tags: ['stove'] },
        ...createGrid('table', 10, 60, 2, 3, 70, 60, { w: 50, h: 50, color: '#fff', label: '圆桌', utility: 'eat_out', pixelPattern: 'table_dining', tags: ['table'] }),
        { id: 'toilet', x: 150, y: 210, w: 30, h: 30, color: '#fff', label: '卫', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

// --- 便利店 (收银+货架+仓) ---
const PLOT_CONVENIENCE_S: PlotTemplate = {
    id: 'convenience_s', width: 155, height: 195, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 145, h: 185, label: '小店', color: '#fff', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        { id: 'cash', x: 10, y: 10, w: 50, h: 30, color: '#2c3e50', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        { id: 'shelf1', x: 10, y: 60, w: 40, h: 60, color: '#ffdd59', label: '货架', utility: 'buy_item', pixelPattern: 'shelf_food', tags: ['shelf'] },
        { id: 'shelf2', x: 60, y: 60, w: 40, h: 60, color: '#ffdd59', label: '货架', utility: 'buy_item', pixelPattern: 'shelf_food', tags: ['shelf'] },
        { id: 'storage', x: 80, y: 150, w: 50, h: 30, color: '#636e72', label: '仓库', utility: 'none', pixelPattern: 'closet', tags: ['furniture'] }
    ]
};

const PLOT_CONVENIENCE_M: PlotTemplate = {
    id: 'convenience_m', width: 170, height: 170, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 160, h: 160, label: '便利店', color: '#fff', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        { id: 'cash', x: 10, y: 10, w: 60, h: 30, color: '#2c3e50', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        ...createGrid('shelf', 10, 60, 3, 1, 50, 0, { w: 40, h: 60, color: '#ffdd59', label: '货架', utility: 'buy_item', pixelPattern: 'shelf_food', tags: ['shelf'] }),
        { id: 'storage', x: 10, y: 130, w: 140, h: 20, color: '#636e72', label: '仓库区', utility: 'none', pixelPattern: 'closet', tags: ['furniture'] }
    ]
};

const PLOT_CONVENIENCE_L: PlotTemplate = {
    id: 'convenience_l', width: 190, height: 205, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 180, h: 195, label: '24h店', color: '#fff', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        { id: 'cash', x: 10, y: 10, w: 60, h: 30, color: '#2c3e50', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        ...createGrid('shelf', 10, 60, 3, 1, 50, 0, { w: 40, h: 70, color: '#ffdd59', label: '货架', utility: 'buy_item', pixelPattern: 'shelf_food', tags: ['shelf'] }),
        { id: 'store', x: 10, y: 150, w: 160, h: 30, color: '#636e72', label: '仓库', utility: 'none', pixelPattern: 'closet', tags: ['furniture'] }
    ]
};

// --- 书店 (书架+收银) ---
const PLOT_BOOKSTORE_S: PlotTemplate = {
    id: 'bookstore_s', width: 190, height: 205, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 180, h: 195, label: '书店', color: '#f7f1e3', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        { id: 'cash', x: 10, y: 10, w: 60, h: 30, color: '#8b4513', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        ...createGrid('shelf', 10, 60, 2, 2, 70, 50, { w: 60, h: 30, color: '#a29bfe', label: '书架', utility: 'buy_book', pixelPattern: 'closet', tags: ['bookshelf'] })
    ]
};

const PLOT_BOOKSTORE_M: PlotTemplate = {
    id: 'bookstore_m', width: 200, height: 260, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 190, h: 250, label: '书屋', color: '#f7f1e3', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        { id: 'cash', x: 10, y: 10, w: 70, h: 30, color: '#8b4513', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        ...createGrid('shelf', 10, 60, 2, 3, 90, 50, { w: 80, h: 30, color: '#a29bfe', label: '书架', utility: 'buy_book', pixelPattern: 'closet', tags: ['bookshelf'] })
    ]
};

const PLOT_BOOKSTORE_L: PlotTemplate = {
    id: 'bookstore_l', width: 260, height: 235, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 250, h: 225, label: '书城', color: '#f7f1e3', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        { id: 'cash', x: 10, y: 10, w: 80, h: 30, color: '#8b4513', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        ...createGrid('shelf', 10, 60, 3, 3, 80, 50, { w: 70, h: 30, color: '#a29bfe', label: '书架', utility: 'buy_book', pixelPattern: 'closet', tags: ['bookshelf'] })
    ]
};

// --- 电影院 (售票+检票+影厅+公厕) ---
const PLOT_CINEMA_S: PlotTemplate = {
    id: 'cinema_s', width: 260, height: 230, type: 'commercial',
    rooms: [{ id: 'hall', x: 5, y: 5, w: 250, h: 220, label: '影厅', color: '#2d3436', pixelPattern: 'simple', hasWall: true }],
    furniture: [
        { id: 'screen', x: 30, y: 10, w: 190, h: 10, color: '#fff', label: '银幕', utility: 'none', tags: ['screen'] },
        ...createGrid('seat', 30, 40, 4, 3, 50, 40, { w: 30, h: 30, color: '#d63031', label: '座', utility: 'cinema_3d', pixelPattern: 'sofa_vip', tags: ['seat'] }),
        { id: 'ticket', x: 170, y: 180, w: 60, h: 30, color: '#e17055', label: '售票', utility: 'work', pixelPattern: 'reception', tags: ['desk', 'cashier'] },
        { id: 'check', x: 100, y: 180, w: 50, h: 10, color: '#636e72', label: '检票', utility: 'none', tags: ['furniture'] },
        { id: 'toilet', x: 10, y: 180, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_CINEMA_M: PlotTemplate = {
    id: 'cinema_m', width: 260, height: 300, type: 'commercial',
    rooms: [{ id: 'hall', x: 5, y: 5, w: 250, h: 290, label: '影院', color: '#2d3436', pixelPattern: 'simple', hasWall: true }],
    furniture: [
        { id: 'screen', x: 30, y: 10, w: 200, h: 10, color: '#fff', label: '大银幕', utility: 'none', tags: ['screen'] },
        ...createGrid('seat', 30, 40, 4, 4, 50, 40, { w: 30, h: 30, color: '#d63031', label: '座', utility: 'cinema_3d', pixelPattern: 'sofa_vip', tags: ['seat'] }),
        { id: 'ticket', x: 170, y: 250, w: 60, h: 30, color: '#e17055', label: '售票', utility: 'work', pixelPattern: 'reception', tags: ['desk', 'cashier'] },
        { id: 'check', x: 100, y: 250, w: 50, h: 10, color: '#636e72', label: '检票', utility: 'none', tags: ['furniture'] },
        { id: 'toilet', x: 20, y: 250, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_CINEMA_L: PlotTemplate = {
    id: 'cinema_l', width: 280, height: 425, type: 'commercial',
    rooms: [{ id: 'hall', x: 5, y: 5, w: 270, h: 415, label: 'IMAX城', color: '#2d3436', pixelPattern: 'simple', hasWall: true }],
    furniture: [
        { id: 'screen', x: 40, y: 20, w: 200, h: 15, color: '#fff', label: 'IMAX', utility: 'none', tags: ['screen'] },
        ...createGrid('seat', 40, 60, 4, 6, 50, 50, { w: 30, h: 30, color: '#d63031', label: '座', utility: 'cinema_3d', pixelPattern: 'sofa_vip', tags: ['seat'] }),
        { id: 'ticket', x: 180, y: 370, w: 70, h: 30, color: '#e17055', label: '售票', utility: 'work', pixelPattern: 'reception', tags: ['desk', 'cashier'] },
        { id: 'check', x: 100, y: 370, w: 60, h: 10, color: '#636e72', label: '检票', utility: 'none', tags: ['furniture'] },
        { id: 'toilet', x: 20, y: 370, w: 40, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

// --- 超市 (货架+多收银+公厕) ---
const PLOT_SUPERMARKET_S: PlotTemplate = {
    id: 'super_s', width: 260, height: 235, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 250, h: 225, label: '超市', color: '#fff', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('shelf', 20, 20, 3, 2, 70, 70, { w: 50, h: 50, color: '#ffdd59', label: '货', utility: 'buy_item', pixelPattern: 'shelf_food', tags: ['shelf'] }),
        { id: 'cash1', x: 20, y: 170, w: 50, h: 30, color: '#2c3e50', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        { id: 'cash2', x: 90, y: 170, w: 50, h: 30, color: '#2c3e50', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        { id: 'toilet', x: 190, y: 170, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_SUPERMARKET_M: PlotTemplate = {
    id: 'super_m', width: 285, height: 230, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 275, h: 220, label: '生鲜超', color: '#fff', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('shelf', 20, 20, 3, 2, 80, 70, { w: 60, h: 50, color: '#ffdd59', label: '货', utility: 'buy_item', pixelPattern: 'shelf_food', tags: ['shelf'] }),
        { id: 'cash1', x: 20, y: 170, w: 50, h: 30, color: '#2c3e50', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        { id: 'cash2', x: 80, y: 170, w: 50, h: 30, color: '#2c3e50', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        { id: 'toilet', x: 220, y: 170, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_SUPERMARKET_L: PlotTemplate = {
    id: 'super_l', width: 290, height: 205, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 280, h: 195, label: '大卖场', color: '#fff', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('shelf', 20, 20, 4, 2, 65, 70, { w: 45, h: 50, color: '#ffdd59', label: '货', utility: 'buy_item', pixelPattern: 'shelf_food', tags: ['shelf'] }),
        { id: 'cash1', x: 20, y: 160, w: 50, h: 30, color: '#2c3e50', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        { id: 'cash2', x: 80, y: 160, w: 50, h: 30, color: '#2c3e50', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        { id: 'cash3', x: 140, y: 160, w: 50, h: 30, color: '#2c3e50', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        { id: 'toilet', x: 230, y: 160, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

// --- 服装店 (衣架+收银) ---
const PLOT_CLOTHING_S: PlotTemplate = {
    id: 'clothing_s', width: 155, height: 325, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 145, h: 315, label: '潮牌', color: '#f5f6fa', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        { id: 'cash', x: 10, y: 10, w: 60, h: 30, color: '#2c3e50', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        ...createGrid('rack', 10, 60, 2, 4, 60, 60, { w: 50, h: 40, color: '#a29bfe', label: '衣架', utility: 'buy_item', pixelPattern: 'closet', tags: ['shelf'] })
    ]
};

const PLOT_CLOTHING_M: PlotTemplate = {
    id: 'clothing_m', width: 190, height: 305, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 180, h: 295, label: '服装店', color: '#f5f6fa', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        { id: 'cash', x: 100, y: 10, w: 70, h: 30, color: '#2c3e50', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        ...createGrid('rack', 10, 60, 3, 3, 60, 60, { w: 50, h: 40, color: '#a29bfe', label: '衣架', utility: 'buy_item', pixelPattern: 'closet', tags: ['shelf'] })
    ]
};

const PLOT_CLOTHING_L: PlotTemplate = {
    id: 'clothing_l', width: 200, height: 260, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 190, h: 250, label: '旗舰店', color: '#f5f6fa', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        { id: 'cash', x: 10, y: 10, w: 80, h: 30, color: '#2c3e50', label: '收银', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
        ...createGrid('rack', 10, 60, 3, 3, 60, 50, { w: 50, h: 30, color: '#a29bfe', label: '展架', utility: 'buy_item', pixelPattern: 'closet', tags: ['shelf'] })
    ]
};

// --- 网吧 (电脑+网管+厕) ---
const PLOT_NETCAFE_S: PlotTemplate = {
    id: 'netcafe_s', width: 195, height: 240, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 185, h: 230, label: '网吧', color: '#2f3542', pixelPattern: 'grid', hasWall: true }],
    furniture: [
        ...createGrid('pc', 15, 15, 2, 3, 80, 60, { w: 60, h: 40, color: '#3742fa', label: '电竞', utility: 'work', pixelPattern: 'desk_pixel', tags: ['computer', 'game'] }),
        { id: 'admin', x: 10, y: 190, w: 60, h: 30, color: '#a29bfe', label: '网管', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk', 'cashier'] },
        { id: 'toilet', x: 140, y: 190, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_NETCAFE_M: PlotTemplate = {
    id: 'netcafe_m', width: 260, height: 220, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 250, h: 210, label: '电竞馆', color: '#2f3542', pixelPattern: 'grid', hasWall: true }],
    furniture: [
        ...createGrid('pc', 20, 20, 3, 2, 70, 60, { w: 60, h: 40, color: '#3742fa', label: '电竞', utility: 'work', pixelPattern: 'desk_pixel', tags: ['computer', 'game'] }),
        { id: 'admin', x: 20, y: 160, w: 60, h: 30, color: '#a29bfe', label: '前台', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk', 'cashier'] },
        { id: 'toilet', x: 200, y: 160, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_NETCAFE_L: PlotTemplate = {
    id: 'netcafe_l', width: 260, height: 235, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 250, h: 225, label: '网络会所', color: '#2f3542', pixelPattern: 'grid', hasWall: true }],
    furniture: [
        ...createGrid('pc', 20, 20, 3, 3, 70, 50, { w: 60, h: 40, color: '#3742fa', label: '电竞', utility: 'work', pixelPattern: 'desk_pixel', tags: ['computer', 'game'] }),
        { id: 'admin', x: 20, y: 180, w: 60, h: 30, color: '#a29bfe', label: '网管', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk', 'cashier'] },
        { id: 'toilet', x: 200, y: 180, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

// --- 夜店 (DJ+吧台+舞池+厕) ---
const PLOT_NIGHTCLUB_S: PlotTemplate = {
    id: 'nightclub_s', width: 260, height: 235, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 250, h: 225, label: 'Club', color: '#000', pixelPattern: 'stripes', hasWall: true }],
    furniture: [
        { id: 'dj', x: 80, y: 10, w: 100, h: 40, color: '#a29bfe', label: 'DJ台', utility: 'music', pixelPattern: 'dj_stage', pixelGlow: true, tags: ['dj_booth'] },
        { id: 'dance', x: 60, y: 60, w: 140, h: 100, color: '#e84393', label: '舞池', utility: 'dance', pixelPattern: 'dance_machine', pixelGlow: true, tags: ['dance'] },
        { id: 'bar', x: 10, y: 180, w: 80, h: 30, color: '#636e72', label: '吧台', utility: 'buy_drink', pixelPattern: 'counter_cosmetic', tags: ['bar'] },
        { id: 'toilet', x: 210, y: 180, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_NIGHTCLUB_M: PlotTemplate = {
    id: 'nightclub_m', width: 285, height: 230, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 275, h: 220, label: '夜店', color: '#000', pixelPattern: 'stripes', hasWall: true }],
    furniture: [
        { id: 'dj', x: 90, y: 10, w: 100, h: 40, color: '#a29bfe', label: 'DJ', utility: 'music', pixelPattern: 'dj_stage', pixelGlow: true, tags: ['dj_booth'] },
        { id: 'dance', x: 70, y: 60, w: 140, h: 100, color: '#e84393', label: '舞池', utility: 'dance', pixelPattern: 'dance_machine', pixelGlow: true, tags: ['dance'] },
        { id: 'bar', x: 20, y: 180, w: 100, h: 30, color: '#636e72', label: '吧台', utility: 'buy_drink', pixelPattern: 'counter_cosmetic', tags: ['bar'] },
        { id: 'toilet', x: 220, y: 180, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_NIGHTCLUB_L: PlotTemplate = {
    id: 'nightclub_l', width: 370, height: 290, type: 'commercial',
    rooms: [{ id: 'main', x: 5, y: 5, w: 360, h: 280, label: '不夜城', color: '#000', pixelPattern: 'stripes', hasWall: true }],
    furniture: [
        { id: 'dj', x: 130, y: 10, w: 100, h: 40, color: '#a29bfe', label: 'DJ台', utility: 'music', pixelPattern: 'dj_stage', pixelGlow: true, tags: ['dj_booth'] },
        { id: 'dance', x: 80, y: 60, w: 200, h: 120, color: '#e84393', label: '大舞池', utility: 'dance', pixelPattern: 'dance_machine', pixelGlow: true, tags: ['dance'] },
        { id: 'bar', x: 20, y: 220, w: 150, h: 40, color: '#636e72', label: '长吧台', utility: 'buy_drink', pixelPattern: 'counter_cosmetic', tags: ['bar'] },
        { id: 'toilet', x: 300, y: 220, w: 40, h: 40, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

// ==========================================
// 4. 公共服务 (Public)
// ==========================================

// --- 美术馆 (展品+厕) ---
const PLOT_GALLERY_S: PlotTemplate = {
    id: 'gallery_s', width: 200, height: 260, type: 'public',
    rooms: [{ id: 'main', x: 5, y: 5, w: 190, h: 250, label: '小画廊', color: '#f5f6fa', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('art', 20, 20, 2, 3, 80, 70, { w: 60, h: 50, color: '#dcdde1', label: '画', utility: 'art', pixelPattern: 'painting', tags: ['art'] }),
        { id: 'toilet', x: 150, y: 210, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_GALLERY_M: PlotTemplate = {
    id: 'gallery_m', width: 260, height: 235, type: 'public',
    rooms: [{ id: 'main', x: 5, y: 5, w: 250, h: 225, label: '艺术馆', color: '#f5f6fa', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('art', 20, 20, 3, 2, 80, 80, { w: 60, h: 50, color: '#dcdde1', label: '画', utility: 'art', pixelPattern: 'painting', tags: ['art'] }),
        { id: 'statue', x: 100, y: 170, w: 50, h: 50, color: '#b2bec3', label: '雕塑', utility: 'art', pixelPattern: 'statue', tags: ['art'] },
        { id: 'toilet', x: 200, y: 180, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_GALLERY_L: PlotTemplate = {
    id: 'gallery_l', width: 270, height: 305, type: 'public',
    rooms: [{ id: 'main', x: 5, y: 5, w: 260, h: 295, label: '美术馆', color: '#f5f6fa', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('art', 30, 30, 2, 3, 100, 80, { w: 80, h: 60, color: '#dcdde1', label: '巨幅画', utility: 'art', pixelPattern: 'painting', tags: ['art'] }),
        { id: 'statue1', x: 30, y: 220, w: 60, h: 60, color: '#b2bec3', label: '雕塑', utility: 'art', pixelPattern: 'statue', tags: ['art'] },
        { id: 'statue2', x: 120, y: 220, w: 60, h: 60, color: '#b2bec3', label: '雕塑', utility: 'art', pixelPattern: 'statue', tags: ['art'] },
        { id: 'toilet', x: 210, y: 250, w: 40, h: 40, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

// --- 幼儿园 (休息+玩耍+厕+老师) ---
const PLOT_KINDERGARTEN_S: PlotTemplate = {
    id: 'kindergarten_s', width: 215, height: 220, type: 'public',
    rooms: [
        { id: 'play', x: 5, y: 5, w: 140, h: 210, label: '幼托', color: '#ff9ff3', pixelPattern: 'wood', hasWall: true },
        { id: 'nap', x: 150, y: 5, w: 60, h: 210, label: '睡', color: '#74b9ff', pixelPattern: 'simple', hasWall: true }
    ],
    furniture: [
        ...createGrid('crib', 160, 20, 1, 3, 0, 50, { w: 40, h: 40, color: '#fab1a0', label: '床', utility: 'nap_crib', pixelPattern: 'bed_crib', tags: ['bed', 'baby'] }),
        { id: 'toy', x: 20, y: 20, w: 60, h: 60, color: '#fdcb6e', label: '积木', utility: 'play_blocks', pixelPattern: 'rug_art', tags: ['play'] },
        { id: 'teacher', x: 20, y: 150, w: 60, h: 30, color: '#a29bfe', label: '讲台', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk'] },
        { id: 'toilet', x: 100, y: 150, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_KINDERGARTEN_M: PlotTemplate = {
    id: 'kindergarten_m', width: 260, height: 220, type: 'public',
    rooms: [
        { id: 'play', x: 5, y: 5, w: 180, h: 210, label: '幼儿园', color: '#ff9ff3', pixelPattern: 'wood', hasWall: true },
        { id: 'nap', x: 190, y: 5, w: 65, h: 210, label: '午睡房', color: '#74b9ff', pixelPattern: 'simple', hasWall: true }
    ],
    furniture: [
        ...createGrid('crib', 200, 20, 1, 3, 0, 50, { w: 40, h: 40, color: '#fab1a0', label: '床', utility: 'nap_crib', pixelPattern: 'bed_crib', tags: ['bed', 'baby'] }),
        { id: 'slide', x: 100, y: 20, w: 60, h: 70, color: '#ff7675', label: '滑梯', utility: 'play', pixelPattern: 'treadmill', tags: ['play'] },
        { id: 'toys', x: 20, y: 20, w: 60, h: 60, color: '#fdcb6e', label: '玩具', utility: 'play_blocks', pixelPattern: 'rug_art', tags: ['play'] },
        { id: 'teacher', x: 20, y: 150, w: 60, h: 30, color: '#a29bfe', label: '老师', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk'] },
        { id: 'toilet', x: 140, y: 170, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_KINDERGARTEN_L: PlotTemplate = {
    id: 'kindergarten_l', width: 285, height: 230, type: 'public',
    rooms: [
        { id: 'play', x: 5, y: 5, w: 200, h: 220, label: '双语幼儿园', color: '#ff9ff3', pixelPattern: 'wood', hasWall: true },
        { id: 'nap', x: 210, y: 5, w: 70, h: 220, label: '静音房', color: '#74b9ff', pixelPattern: 'simple', hasWall: true }
    ],
    furniture: [
        ...createGrid('crib', 220, 20, 1, 4, 0, 50, { w: 40, h: 40, color: '#fab1a0', label: '床', utility: 'nap_crib', pixelPattern: 'bed_crib', tags: ['bed', 'baby'] }),
        { id: 'slide', x: 120, y: 20, w: 70, h: 80, color: '#ff7675', label: '大滑梯', utility: 'play', pixelPattern: 'treadmill', tags: ['play'] },
        { id: 'toys', x: 20, y: 20, w: 80, h: 80, color: '#fdcb6e', label: '积木城', utility: 'play_blocks', pixelPattern: 'rug_art', tags: ['play'] },
        { id: 'teacher', x: 20, y: 160, w: 70, h: 40, color: '#a29bfe', label: '教案桌', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk'] },
        { id: 'toilet', x: 150, y: 180, w: 40, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

// --- 小学 (教室+操场+食堂+厕) ---
const PLOT_SCHOOL_ELEM_S: PlotTemplate = {
    id: 'school_elem_s', width: 260, height: 300, type: 'public',
    rooms: [
        { id: 'class', x: 5, y: 5, w: 150, h: 290, label: '教学', color: '#dfe6e9', pixelPattern: 'wood', hasWall: true },
        { id: 'field', x: 160, y: 5, w: 95, h: 290, label: '操场', color: '#27ae60', pixelPattern: 'grass', hasWall: false }
    ],
    furniture: [
        ...createGrid('desk', 10, 50, 2, 3, 50, 50, { w: 40, h: 30, color: '#fdcb6e', label: '课桌', utility: 'study', pixelPattern: 'desk_school', tags: ['desk', 'study'] }),
        { id: 'board', x: 30, y: 10, w: 80, h: 10, color: '#2d3436', label: '黑板', utility: 'work', tags: ['blackboard'] },
        { id: 'hoop', x: 180, y: 20, w: 20, h: 10, color: '#e17055', label: '篮框', utility: 'play', tags: ['sports'] },
        { id: 'guard', x: 200, y: 250, w: 40, h: 30, color: '#636e72', label: '门卫', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk'] },
        { id: 'canteen_t', x: 20, y: 220, w: 40, h: 40, color: '#fab1a0', label: '食堂', utility: 'eat_canteen', pixelPattern: 'table_dining', tags: ['table'] },
        { id: 'kitchen', x: 70, y: 220, w: 30, h: 30, color: '#b2bec3', label: '厨', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'toilet', x: 110, y: 260, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_SCHOOL_ELEM_M: PlotTemplate = {
    id: 'school_elem_m', width: 270, height: 305, type: 'public',
    rooms: [
        { id: 'class', x: 5, y: 5, w: 260, h: 180, label: '教学楼', color: '#dfe6e9', pixelPattern: 'wood', hasWall: true },
        { id: 'field', x: 5, y: 190, w: 260, h: 110, label: '操场', color: '#27ae60', pixelPattern: 'grass', hasWall: false }
    ],
    furniture: [
        ...createGrid('desk', 20, 40, 4, 2, 50, 50, { w: 40, h: 30, color: '#fdcb6e', label: '课桌', utility: 'study', pixelPattern: 'desk_school', tags: ['desk', 'study'] }),
        { id: 'board', x: 60, y: 10, w: 120, h: 10, color: '#2d3436', label: '黑板', utility: 'work', tags: ['blackboard'] },
        { id: 'hoop', x: 120, y: 200, w: 20, h: 10, color: '#e17055', label: '篮框', utility: 'play', tags: ['sports'] },
        { id: 'guard', x: 220, y: 260, w: 40, h: 30, color: '#636e72', label: '门卫', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk'] },
        { id: 'canteen_t1', x: 20, y: 140, w: 40, h: 30, color: '#fab1a0', label: '食堂', utility: 'eat_canteen', pixelPattern: 'table_dining', tags: ['table'] },
        { id: 'canteen_t2', x: 70, y: 140, w: 40, h: 30, color: '#fab1a0', label: '食堂', utility: 'eat_canteen', pixelPattern: 'table_dining', tags: ['table'] },
        { id: 'kitchen', x: 120, y: 140, w: 40, h: 30, color: '#b2bec3', label: '后厨', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'toilet', x: 220, y: 140, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] }
    ]
};

const PLOT_SCHOOL_ELEM_L: PlotTemplate = {
    id: 'school_elem_l', width: 410, height: 325, type: 'public',
    rooms: [
        { id: 'class', x: 5, y: 5, w: 250, h: 315, label: '综合楼', color: '#dfe6e9', pixelPattern: 'wood', hasWall: true },
        { id: 'field', x: 260, y: 5, w: 145, h: 315, label: '大操场', color: '#27ae60', pixelPattern: 'grass', hasWall: false }
    ],
    furniture: [
        ...createGrid('desk', 20, 50, 4, 3, 50, 50, { w: 40, h: 30, color: '#fdcb6e', label: '课桌', utility: 'study', pixelPattern: 'desk_school', tags: ['desk', 'study'] }),
        { id: 'board', x: 60, y: 10, w: 120, h: 10, color: '#2d3436', label: '黑板', utility: 'work', tags: ['blackboard'] },
        { id: 'canteen_t', x: 20, y: 220, w: 100, h: 40, color: '#fab1a0', label: '食堂', utility: 'eat_canteen', pixelPattern: 'table_dining', tags: ['table'] },
        { id: 'kitchen', x: 130, y: 220, w: 50, h: 40, color: '#b2bec3', label: '后厨', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'toilet', x: 200, y: 280, w: 40, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
        { id: 'hoop', x: 320, y: 20, w: 20, h: 10, color: '#e17055', label: '篮框', utility: 'play', tags: ['sports'] },
        { id: 'guard', x: 350, y: 280, w: 40, h: 30, color: '#636e72', label: '门卫', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk'] }
    ]
};

// --- 中学 (Small 270*305, Medium 280*425, Large 425*305) ---
const PLOT_SCHOOL_HIGH_S: PlotTemplate = {
    id: 'school_high_s', width: 270, height: 305, type: 'public',
    rooms: [
        { id: 'class', x: 5, y: 5, w: 260, h: 200, label: '教学楼', color: '#dfe6e9', pixelPattern: 'wood', hasWall: true },
        { id: 'field', x: 5, y: 210, w: 260, h: 90, label: '操场', color: '#27ae60', pixelPattern: 'grass', hasWall: false }
    ],
    furniture: [
        ...createGrid('desk', 20, 40, 4, 2, 50, 50, { w: 40, h: 30, color: '#fdcb6e', label: '课桌', utility: 'study', pixelPattern: 'desk_school', tags: ['desk', 'study'] }),
        { id: 'board', x: 70, y: 10, w: 100, h: 10, color: '#2d3436', label: '黑板', utility: 'work', tags: ['blackboard'] },
        { id: 'canteen', x: 20, y: 160, w: 50, h: 30, color: '#fab1a0', label: '食堂', utility: 'eat_canteen', pixelPattern: 'table_dining', tags: ['table'] },
        { id: 'kitchen', x: 80, y: 160, w: 30, h: 30, color: '#b2bec3', label: '厨', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'toilet', x: 200, y: 160, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
        { id: 'hoop', x: 120, y: 220, w: 20, h: 10, color: '#e17055', label: '篮', utility: 'play', tags: ['sports'] },
        { id: 'guard', x: 220, y: 260, w: 30, h: 30, color: '#636e72', label: '门卫', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk'] }
    ]
};

const PLOT_SCHOOL_HIGH_M: PlotTemplate = {
    id: 'school_high_m', width: 280, height: 425, type: 'public',
    rooms: [
        { id: 'class', x: 5, y: 5, w: 270, h: 250, label: '实验楼', color: '#dfe6e9', pixelPattern: 'wood', hasWall: true },
        { id: 'field', x: 5, y: 260, w: 270, h: 160, label: '体育场', color: '#27ae60', pixelPattern: 'grass', hasWall: false }
    ],
    furniture: [
        ...createGrid('desk', 20, 40, 4, 3, 60, 50, { w: 40, h: 30, color: '#fdcb6e', label: '课桌', utility: 'study', pixelPattern: 'desk_school', tags: ['desk', 'study'] }),
        { id: 'board', x: 70, y: 10, w: 140, h: 10, color: '#2d3436', label: '大黑板', utility: 'work', tags: ['blackboard'] },
        { id: 'canteen_t', x: 20, y: 200, w: 60, h: 40, color: '#fab1a0', label: '食堂', utility: 'eat_canteen', pixelPattern: 'table_dining', tags: ['table'] },
        { id: 'kitchen', x: 90, y: 200, w: 40, h: 40, color: '#b2bec3', label: '后厨', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'toilet', x: 230, y: 200, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
        { id: 'hoop', x: 130, y: 270, w: 20, h: 10, color: '#e17055', label: '篮框', utility: 'play', tags: ['sports'] },
        { id: 'guard', x: 220, y: 380, w: 40, h: 30, color: '#636e72', label: '门卫', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk'] }
    ]
};

const PLOT_SCHOOL_HIGH_L: PlotTemplate = {
    id: 'school_high_l', width: 425, height: 305, type: 'public',
    rooms: [
        { id: 'class', x: 5, y: 5, w: 260, h: 295, label: '教学楼', color: '#dfe6e9', pixelPattern: 'wood', hasWall: true },
        { id: 'field', x: 270, y: 5, w: 150, h: 295, label: '大操场', color: '#27ae60', pixelPattern: 'grass', hasWall: false }
    ],
    furniture: [
        ...createGrid('desk', 20, 40, 3, 3, 70, 50, { w: 50, h: 30, color: '#fdcb6e', label: '课桌', utility: 'study', pixelPattern: 'desk_school', tags: ['desk', 'study'] }),
        { id: 'board', x: 60, y: 10, w: 140, h: 10, color: '#2d3436', label: '黑板', utility: 'work', tags: ['blackboard'] },
        { id: 'canteen', x: 20, y: 230, w: 100, h: 50, color: '#fab1a0', label: '食堂', utility: 'eat_canteen', pixelPattern: 'table_dining', tags: ['table'] },
        { id: 'kitchen', x: 130, y: 230, w: 60, h: 40, color: '#b2bec3', label: '后厨', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
        { id: 'toilet', x: 210, y: 250, w: 40, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
        { id: 'hoop', x: 340, y: 20, w: 20, h: 10, color: '#e17055', label: '篮', utility: 'play', tags: ['sports'] },
        { id: 'guard', x: 370, y: 250, w: 40, h: 30, color: '#636e72', label: '门卫', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk'] }
    ]
};

// --- 医院 (诊+护+病+厕+淋+术) ---
const PLOT_HOSPITAL_S: PlotTemplate = {
    id: 'hospital_s', width: 285, height: 230, type: 'public',
    rooms: [
        { id: 'main', x: 5, y: 5, w: 275, h: 220, label: '社区医院', color: '#fff', pixelPattern: 'simple', hasWall: true }
    ],
    furniture: [
        { id: 'nurse', x: 10, y: 10, w: 60, h: 30, color: '#fff', label: '护士站', utility: 'work', pixelPattern: 'reception', tags: ['desk'] },
        { id: 'doc', x: 10, y: 60, w: 50, h: 30, color: '#fff', label: '诊室', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk'] },
        ...createGrid('bed', 80, 10, 2, 2, 60, 80, { w: 50, h: 70, color: '#fff', label: '病床', utility: 'healing', pixelPattern: 'medical_bed', tags: ['medical_bed', 'bed'] }),
        { id: 'op', x: 200, y: 10, w: 60, h: 80, color: '#b2bec3', label: '手术室', utility: 'none', pixelPattern: 'scanner', tags: ['medical_device'] },
        { id: 'toilet', x: 230, y: 130, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
        { id: 'shower', x: 230, y: 170, w: 30, h: 30, color: '#81ecec', label: '淋', utility: 'hygiene', pixelPattern: 'shower_stall', tags: ['shower'] }
    ]
};

const PLOT_HOSPITAL_M: PlotTemplate = {
    id: 'hospital_m', width: 280, height: 425, type: 'public',
    rooms: [
        { id: 'main', x: 5, y: 5, w: 270, h: 415, label: '综合医院', color: '#fff', pixelPattern: 'simple', hasWall: true }
    ],
    furniture: [
        { id: 'nurse', x: 20, y: 20, w: 80, h: 40, color: '#74b9ff', label: '分诊台', utility: 'work', pixelPattern: 'reception', tags: ['desk'] },
        { id: 'doc1', x: 20, y: 80, w: 60, h: 40, color: '#fff', label: '诊室1', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk'] },
        { id: 'doc2', x: 100, y: 80, w: 60, h: 40, color: '#fff', label: '诊室2', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk'] },
        ...createGrid('bed', 20, 150, 2, 3, 70, 90, { w: 50, h: 80, color: '#fff', label: '病床', utility: 'healing', pixelPattern: 'medical_bed', tags: ['medical_bed', 'bed'] }),
        { id: 'op', x: 180, y: 20, w: 80, h: 80, color: '#b2bec3', label: '手术室', utility: 'none', pixelPattern: 'scanner', tags: ['medical_device'] },
        { id: 'toilet', x: 200, y: 380, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
        { id: 'shower', x: 240, y: 380, w: 30, h: 30, color: '#81ecec', label: '淋', utility: 'hygiene', pixelPattern: 'shower_stall', tags: ['shower'] }
    ]
};

const PLOT_HOSPITAL_L: PlotTemplate = {
    id: 'hospital_l', width: 410, height: 325, type: 'public',
    rooms: [
        { id: 'out', x: 5, y: 5, w: 150, h: 315, label: '门诊部', color: '#fff', pixelPattern: 'tile', hasWall: true },
        { id: 'in', x: 160, y: 5, w: 245, h: 315, label: '住院部', color: '#dff9fb', pixelPattern: 'simple', hasWall: true }
    ],
    furniture: [
        { id: 'nurse', x: 20, y: 20, w: 80, h: 40, color: '#74b9ff', label: '护士总台', utility: 'work', pixelPattern: 'reception', tags: ['desk'] },
        ...createGrid('doc', 20, 80, 2, 2, 60, 50, { w: 50, h: 40, color: '#fff', label: '诊室', utility: 'work', pixelPattern: 'desk_simple', tags: ['desk'] }),
        { id: 'op', x: 20, y: 230, w: 80, h: 70, color: '#b2bec3', label: '手术室', utility: 'none', pixelPattern: 'scanner', tags: ['medical_device'] },
        ...createGrid('bed', 180, 20, 3, 2, 70, 90, { w: 50, h: 80, color: '#fff', label: '病床', utility: 'healing', pixelPattern: 'medical_bed', tags: ['medical_bed', 'bed'] }),
        { id: 'toilet', x: 360, y: 220, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
        { id: 'shower', x: 360, y: 260, w: 30, h: 30, color: '#81ecec', label: '淋', utility: 'hygiene', pixelPattern: 'shower_stall', tags: ['shower'] }
    ]
};

// --- 养老院 (单间+护工+厕+淋+办) ---
const PLOT_ELDER_S: PlotTemplate = {
    id: 'elder_home_s', width: 280, height: 425, type: 'residential',
    housingUnits: [{ id: 'unit', name: '温馨养老', capacity: 6, cost: 1200, type: 'elder_care', area: { x: 5, y: 5, w: 270, h: 415 } }],
    rooms: [{ id: 'main', x: 5, y: 5, w: 270, h: 415, label: '养老院', color: '#f0fff4', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('bed', 20, 20, 2, 3, 80, 90, { w: 60, h: 80, color: '#fff', label: '单人床', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed', 'medical_bed'] }),
        { id: 'nurse', x: 180, y: 20, w: 60, h: 40, color: '#fff', label: '护工位', utility: 'work', pixelPattern: 'reception', tags: ['desk'] },
        { id: 'office', x: 180, y: 80, w: 60, h: 40, color: '#8b4513', label: '办公室', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk'] },
        { id: 'toilet', x: 180, y: 300, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
        { id: 'shower', x: 220, y: 300, w: 30, h: 30, color: '#81ecec', label: '淋', utility: 'hygiene', pixelPattern: 'shower_stall', tags: ['shower'] }
    ]
};

const PLOT_ELDER_M: PlotTemplate = {
    id: 'elder_home_m', width: 370, height: 290, type: 'residential',
    housingUnits: [{ id: 'unit', name: '安康社区', capacity: 6, cost: 1500, type: 'elder_care', area: { x: 5, y: 5, w: 360, h: 280 } }],
    rooms: [{ id: 'main', x: 5, y: 5, w: 360, h: 280, label: '康养中心', color: '#f0fff4', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('bed', 20, 20, 3, 2, 80, 100, { w: 60, h: 80, color: '#fff', label: '护理床', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed', 'medical_bed'] }),
        { id: 'nurse', x: 280, y: 20, w: 60, h: 40, color: '#fff', label: '护工', utility: 'work', pixelPattern: 'reception', tags: ['desk'] },
        { id: 'office', x: 280, y: 80, w: 60, h: 40, color: '#8b4513', label: '院长', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk'] },
        { id: 'toilet', x: 280, y: 200, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
        { id: 'shower', x: 320, y: 200, w: 30, h: 30, color: '#81ecec', label: '淋', utility: 'hygiene', pixelPattern: 'shower_stall', tags: ['shower'] }
    ]
};

const PLOT_ELDER_L: PlotTemplate = {
    id: 'elder_home_l', width: 410, height: 325, type: 'residential',
    housingUnits: [{ id: 'unit', name: '高端养老', capacity: 8, cost: 1800, type: 'elder_care', area: { x: 5, y: 5, w: 400, h: 315 } }],
    rooms: [{ id: 'main', x: 5, y: 5, w: 400, h: 315, label: '疗养中心', color: '#f0fff4', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('bed', 20, 20, 4, 2, 80, 100, { w: 60, h: 80, color: '#fff', label: '护理床', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed', 'medical_bed'] }),
        { id: 'nurse', x: 20, y: 240, w: 80, h: 40, color: '#fff', label: '护工站', utility: 'work', pixelPattern: 'reception', tags: ['desk'] },
        { id: 'office', x: 120, y: 240, w: 60, h: 40, color: '#8b4513', label: '院长室', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk'] },
        { id: 'toilet', x: 350, y: 220, w: 30, h: 30, color: '#fff', label: '厕', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
        { id: 'shower', x: 350, y: 260, w: 30, h: 30, color: '#81ecec', label: '淋', utility: 'hygiene', pixelPattern: 'shower_stall', tags: ['shower'] }
    ]
};

// --- 图书馆 (书架+管理桌) ---
const PLOT_LIBRARY_S: PlotTemplate = {
    id: 'library_s', width: 200, height: 260, type: 'public',
    rooms: [{ id: 'main', x: 5, y: 5, w: 190, h: 250, label: '阅览室', color: '#f7f1e3', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        { id: 'admin', x: 10, y: 210, w: 60, h: 30, color: '#8b4513', label: '管理', utility: 'work', pixelPattern: 'reception', tags: ['desk'] },
        ...createGrid('shelf', 10, 10, 2, 3, 70, 50, { w: 60, h: 30, color: '#a29bfe', label: '书架', utility: 'buy_book', pixelPattern: 'closet', tags: ['bookshelf'] })
    ]
};

const PLOT_LIBRARY_M: PlotTemplate = {
    id: 'library_m', width: 260, height: 300, type: 'public',
    rooms: [{ id: 'main', x: 5, y: 5, w: 250, h: 290, label: '图书馆', color: '#f7f1e3', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        { id: 'admin', x: 20, y: 250, w: 80, h: 30, color: '#8b4513', label: '服务台', utility: 'work', pixelPattern: 'reception', tags: ['desk'] },
        ...createGrid('shelf', 20, 20, 3, 3, 70, 50, { w: 60, h: 30, color: '#a29bfe', label: '书架', utility: 'buy_book', pixelPattern: 'closet', tags: ['bookshelf'] }),
        ...createGrid('read', 20, 180, 2, 1, 70, 0, { w: 50, h: 30, color: '#fab1a0', label: '阅览', utility: 'study', pixelPattern: 'desk_simple', tags: ['desk', 'study'] })
    ]
};

const PLOT_LIBRARY_L: PlotTemplate = {
    id: 'library_l', width: 270, height: 305, type: 'public',
    rooms: [{ id: 'main', x: 5, y: 5, w: 260, h: 295, label: '市图书馆', color: '#f7f1e3', pixelPattern: 'wood', hasWall: true }],
    furniture: [
        { id: 'admin', x: 20, y: 260, w: 80, h: 30, color: '#8b4513', label: '总服务台', utility: 'work', pixelPattern: 'reception', tags: ['desk'] },
        ...createGrid('shelf', 20, 20, 3, 4, 70, 50, { w: 60, h: 30, color: '#a29bfe', label: '书架', utility: 'buy_book', pixelPattern: 'closet', tags: ['bookshelf'] }),
        ...createGrid('read', 20, 220, 3, 1, 70, 0, { w: 50, h: 30, color: '#fab1a0', label: '阅览', utility: 'study', pixelPattern: 'desk_simple', tags: ['desk', 'study'] })
    ]
};

// --- 健身房 (补充) ---
const PLOT_GYM_S: PlotTemplate = {
    id: 'gym_s', width: 190, height: 305, type: 'public',
    rooms: [{ id: 'main', x: 5, y: 5, w: 180, h: 295, label: '健身室', color: '#2f3542', pixelPattern: 'tile', hasWall: true }],
    furniture: [
        ...createGrid('run', 20, 20, 2, 2, 60, 90, { w: 40, h: 70, color: '#2d3436', label: '跑机', utility: 'run', pixelPattern: 'treadmill', tags: ['gym'] }),
        ...createGrid('lift', 20, 200, 2, 1, 70, 0, { w: 50, h: 80, color: '#636e72', label: '举重', utility: 'lift', pixelPattern: 'weights_rack', tags: ['gym'] }),
        { id: 'mat', x: 140, y: 50, w: 30, h: 70, color: '#ff7aa8', label: '瑜伽', utility: 'stretch', pixelPattern: 'yoga_mat', tags: ['gym'] },
        { id: 'shower', x: 140, y: 200, w: 30, h: 30, color: '#81ecec', label: '淋', utility: 'hygiene', pixelPattern: 'shower_stall', tags: ['shower'] }
    ]
};

// 导出所有
export const PLOTS: Record<string, PlotTemplate> = {
    'apt_cheap_s': PLOT_APT_CHEAP_S,
    'apt_cheap_m': PLOT_APT_CHEAP_M,
    'apt_cheap_l': PLOT_APT_CHEAP_L,
    'apt_luxury_s': PLOT_APT_LUXURY_S,
    'apt_luxury_m': PLOT_APT_LUXURY_M,
    'apt_luxury_l': PLOT_APT_LUXURY_L,
    'villa_s': PLOT_VILLA_S,
    'villa_m': PLOT_VILLA_M,
    'villa_l': PLOT_VILLA_L,
    'internet_s': PLOT_IT_S,
    'internet_m': PLOT_IT_M,
    'internet_l': PLOT_IT_L,
    'business_s': PLOT_BIZ_S,
    'business_m': PLOT_BIZ_M,
    'business_l': PLOT_BIZ_L,
    'design_s': PLOT_DESIGN_S,
    'design_m': PLOT_DESIGN_M,
    'design_l': PLOT_DESIGN_L,
    'restaurant_s': PLOT_RESTAURANT_S,
    'restaurant_m': PLOT_RESTAURANT_M,
    'restaurant_l': PLOT_RESTAURANT_L,
    'cafe_s': PLOT_CAFE_S,
    'cafe_m': PLOT_CAFE_M,
    'cafe_l': PLOT_CAFE_L,
    'gallery_s': PLOT_GALLERY_S,
    'gallery_m': PLOT_GALLERY_M,
    'gallery_l': PLOT_GALLERY_L,
    'kindergarten_s': PLOT_KINDERGARTEN_S,
    'kindergarten_m': PLOT_KINDERGARTEN_M,
    'kindergarten_l': PLOT_KINDERGARTEN_L,
    'school_elem_s': PLOT_SCHOOL_ELEM_S,
    'school_elem_m': PLOT_SCHOOL_ELEM_M,
    'school_elem_l': PLOT_SCHOOL_ELEM_L,
    'school_high_s': PLOT_SCHOOL_HIGH_S,
    'school_high_m': PLOT_SCHOOL_HIGH_M,
    'school_high_l': PLOT_SCHOOL_HIGH_L,
    'hospital_s': PLOT_HOSPITAL_S,
    'hospital_m': PLOT_HOSPITAL_M,
    'hospital_l': PLOT_HOSPITAL_L,
    'elder_home_s': PLOT_ELDER_S,
    'elder_home_m': PLOT_ELDER_M,
    'elder_home_l': PLOT_ELDER_L,
    'convenience_s': PLOT_CONVENIENCE_S,
    'convenience_m': PLOT_CONVENIENCE_M,
    'convenience_l': PLOT_CONVENIENCE_L,
    'bookstore_s': PLOT_BOOKSTORE_S,
    'bookstore_m': PLOT_BOOKSTORE_M,
    'bookstore_l': PLOT_BOOKSTORE_L,
    'cinema_s': PLOT_CINEMA_S,
    'cinema_m': PLOT_CINEMA_M,
    'cinema_l': PLOT_CINEMA_L,
    'super_s': PLOT_SUPERMARKET_S,
    'super_m': PLOT_SUPERMARKET_M,
    'super_l': PLOT_SUPERMARKET_L,
    'clothing_s': PLOT_CLOTHING_S,
    'clothing_m': PLOT_CLOTHING_M,
    'clothing_l': PLOT_CLOTHING_L,
    'netcafe_s': PLOT_NETCAFE_S,
    'netcafe_m': PLOT_NETCAFE_M,
    'netcafe_l': PLOT_NETCAFE_L,
    'nightclub_s': PLOT_NIGHTCLUB_S,
    'nightclub_m': PLOT_NIGHTCLUB_M,
    'nightclub_l': PLOT_NIGHTCLUB_L,
    'library_s': PLOT_LIBRARY_S,
    'library_m': PLOT_LIBRARY_M,
    'library_l': PLOT_LIBRARY_L,
    'gym_center': PLOT_GYM_S, // Add gym mapping
    'default_empty': { id: 'default_empty', width: 170, height: 170, type: 'public', rooms: [], furniture: [] }
};