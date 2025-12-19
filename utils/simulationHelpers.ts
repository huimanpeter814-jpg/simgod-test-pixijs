import { Job, Furniture, Vector2 } from '../types';
import { TIME_CONFIG } from '../constants'; // 引入统一配置

// 将游戏分钟转换为 tick 数
// 保持和 GameLoop 中一致的时间流逝定义
export const minutes = (m: number) => m * TIME_CONFIG.TICKS_PER_MINUTE;

// 计算特定职业的工位容量
export const getJobCapacity = (job: Job) => {
    const FIXED_CAPACITY = 50; 
    if (job.level >= 4) return 1;
    return FIXED_CAPACITY;
};

export const getFurnitureTags = (f: Furniture): string[] => {
    if (f.tags && f.tags.length > 0) return f.tags;
    const inferred: string[] = [];
    const label = f.label || '';
    const utility = f.utility || '';
    const pattern = f.pixelPattern || '';

    if (label.includes('电脑') || pattern.includes('pc')) inferred.push('computer', 'work');
    if (label.includes('办公桌') || label.includes('工位') || pattern.includes('desk')) inferred.push('desk', 'work');
    if (label.includes('会议') || pattern.includes('meet')) inferred.push('meeting', 'work');
    if (label.includes('老板') || label.includes('保险')) inferred.push('boss_chair', 'work');
    if (label.includes('收银') || pattern.includes('cashier')) inferred.push('cashier', 'work');
    if (label.includes('货架') || label.includes('柜台')) inferred.push('shelf', 'counter', 'work');
    if (label.includes('吧台') || label.includes('酒')) inferred.push('bar', 'work');
    if (label.includes('灶') || utility === 'cook') inferred.push('stove', 'kitchen', 'work');
    if (label.includes('餐桌') || label.includes('椅')) inferred.push('table', 'seat');
    if (label.includes('病床') || utility === 'healing') inferred.push('medical_bed', 'bed', 'work');
    if (label.includes('黑板') || label.includes('讲台')) inferred.push('blackboard', 'work');
    if (label.includes('DJ')) inferred.push('dj_booth', 'work');
    if (label.includes('画架')) inferred.push('easel', 'art', 'work');
    if (label.includes('床') || utility === 'energy') inferred.push('bed');
    if (label.includes('沙发') || utility === 'comfort') inferred.push('sofa', 'seat');

    return inferred;
};

export const hasRequiredTags = (f: Furniture, requiredTags?: string[]): boolean => {
    if (!requiredTags || requiredTags.length === 0) return true; 
    const furnitureTags = getFurnitureTags(f);
    return requiredTags.some(tag => furnitureTags.includes(tag));
};

// anchor: 市民走到的位置 (寻路终点)
// interact: 市民实际进行交互的位置 (动画位置)
export const getInteractionPos = (f: Furniture): { anchor: Vector2, interact: Vector2 } => {
    const center = { x: f.x + f.w / 2, y: f.y + f.h / 2 };
    
    // 默认：走到中心，在中心交互
    let anchor = { ...center };
    let interact = { ...center };

    const tags = getFurnitureTags(f);
    const label = f.label || '';

    // 1. 床 (Bed): 走到床边，躺在中心
    if (tags.includes('bed')) {
        // 简单假设走到床的左侧或右侧，视空间而定，这里简化为左侧略偏下
        // 实际上为了不穿模，应该根据家具方向，这里暂定下方或侧方
        anchor = { x: f.x - 15, y: f.y + f.h / 2 }; 
        // 如果是双人床，可能需要更精细判断，这里先统一
    }
    // 2. 座椅/沙发 (Seat): 走到前方，坐到中心
    else if (tags.includes('seat') || tags.includes('sofa') || tags.includes('boss_chair') || label.includes('马桶')) {
        // 假设椅子正面朝下 (y+)
        anchor = { x: center.x, y: f.y + f.h + 10 }; 
        interact = { ...center };
    }
    // 3. 柜台/灶台/货架 (Work/Counter): 走到前方，在前方操作 (不进入物体)
    else if (tags.includes('stove') || tags.includes('counter') || tags.includes('cashier') || tags.includes('bar') || tags.includes('shelf') || tags.includes('easel') || label.includes('黑板')) {
        anchor = { x: center.x, y: f.y + f.h + 15 };
        interact = { x: center.x, y: f.y + f.h + 5 }; // 贴近物体边缘
    }
    // 4. 电脑桌 (Desk): 走到椅子位置
    else if (tags.includes('desk') || tags.includes('computer')) {
        // 假设椅子在桌子下方
        anchor = { x: center.x, y: f.y + f.h + 15 };
        interact = { x: center.x, y: f.y + f.h + 5 }; 
    }

    return { anchor, interact };
};