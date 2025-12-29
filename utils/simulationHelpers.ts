import { Job, Furniture, Vector2 } from '../types';
import { TIME_CONFIG } from '../constants'; // 引入统一配置
import { FurnitureUtility, FurnitureTag } from '../config/furnitureTypes';

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

    if (label.includes('电脑') || pattern.includes('pc')) inferred.push(FurnitureTag.Computer, FurnitureUtility.Work);
    if (label.includes('办公桌') || label.includes('工位') || pattern.includes('desk')) inferred.push(FurnitureTag.Desk, FurnitureUtility.Work);
    if (label.includes('会议') || pattern.includes('meet')) inferred.push(FurnitureTag.Meeting, FurnitureUtility.Work);
    if (label.includes('老板') || label.includes('保险')) inferred.push(FurnitureTag.BossChair, FurnitureUtility.Work);
    if (label.includes('收银') || pattern.includes('cashier')) inferred.push(FurnitureTag.Cashier, FurnitureUtility.Work);
    if (label.includes('货架') || label.includes('柜台')) inferred.push(FurnitureTag.Shelf, FurnitureTag.Counter, FurnitureUtility.Work);
    if (label.includes('吧台') || label.includes('酒')) inferred.push(FurnitureTag.Bar, FurnitureUtility.Work);
    if (label.includes('灶') || utility === FurnitureUtility.Cooking) inferred.push(FurnitureTag.Stove, FurnitureTag.Kitchen, FurnitureUtility.Work);
    if (label.includes('餐桌') || label.includes('椅')) inferred.push(FurnitureTag.Table, FurnitureTag.Seat);
    if (label.includes('病床') || utility === FurnitureUtility.Healing) inferred.push(FurnitureTag.MedicalBed, FurnitureTag.Bed, FurnitureUtility.Work);
    if (label.includes('黑板') || label.includes('讲台')) inferred.push(FurnitureTag.Blackboard, FurnitureUtility.Work);
    if (label.includes('DJ')) inferred.push(FurnitureTag.DjBooth, FurnitureUtility.Work);
    if (label.includes('画架')) inferred.push(FurnitureTag.Easel, FurnitureTag.Art, FurnitureUtility.Work);
    if (label.includes('床') || utility === FurnitureUtility.Energy) inferred.push(FurnitureTag.Bed);
    if (label.includes('沙发') || utility === FurnitureUtility.Comfort) inferred.push(FurnitureTag.Sofa, FurnitureTag.Seat);

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

    // 1. Bed
    if (tags.includes(FurnitureTag.Bed)) {
        anchor = { x: f.x - 15, y: f.y + f.h / 2 }; 
    }
    // 2. Seat/Sofa
    else if (tags.includes(FurnitureTag.Seat) || tags.includes(FurnitureTag.Sofa) || tags.includes(FurnitureTag.BossChair) || label.includes('马桶')) {
        anchor = { x: center.x, y: f.y + f.h + 10 }; 
        interact = { ...center };
    }
    // 3. Work/Counter
    else if (tags.includes(FurnitureTag.Stove) || tags.includes(FurnitureTag.Counter) || tags.includes(FurnitureTag.Cashier) || tags.includes(FurnitureTag.Bar) || tags.includes(FurnitureTag.Shelf) || tags.includes(FurnitureTag.Easel) || label.includes('黑板')) {
        anchor = { x: center.x, y: f.y + f.h + 15 };
        interact = { x: center.x, y: f.y + f.h + 5 }; 
    }
    // 4. Desk/Computer
    else if (tags.includes(FurnitureTag.Desk) || tags.includes(FurnitureTag.Computer)) {
        anchor = { x: center.x, y: f.y + f.h + 15 };
        interact = { x: center.x, y: f.y + f.h + 5 }; 
    }

    return { anchor, interact };
};