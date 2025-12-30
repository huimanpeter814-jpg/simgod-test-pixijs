// data/items.ts
import { NeedType, ItemTag } from '../config/gameConstants';

// 定义物品的数据结构
export interface GameItem {
    id: string;
    label: string;
    price: number;
    description?: string; // 描述文本
    tags: ItemTag[];      // 标签：用于分类 (Food, Drink, Book, Ticket)
    
    // 🌟 效果定义 (数据驱动核心)
    effects: {
        // 满足需求：{ hunger: 20, fun: 5 }
        needs?: Partial<Record<NeedType, number>>; 
        // 获得 Buff ID
        buffs?: string[];    
        // 提升技能：{ skillId: 'logic', amount: 5 }
        skillGain?: { id: string; amount: number }; 
        // 提升属性：{ attrId: 'iq', amount: 2 }
        attrGain?: { id: string; amount: number };
    };
    
    // 使用条件
    minAge?: string; // 例如 'Child'
    trigger?: string; // AI决策用的触发器标签 (原 trigger 字段)
}

// 🌟 物品注册表
export const ITEM_REGISTRY: Record<string, GameItem> = {
    // --- 饮食类 ---
    'drink_cola': {
        id: 'drink_cola', label: '冰美式', price: 28, 
        tags: [ItemTag.Drink],
        effects: { needs: { [NeedType.Hunger]: 2, [NeedType.Fun]: 5 } },
        trigger: 'street'
    },
    'food_snack': {
        id: 'food_snack', label: '小点心', price: 20, 
        tags: [ItemTag.Food],
        effects: { needs: { [NeedType.Hunger]: 40, [NeedType.Fun]: 10 } },
        trigger: 'hungry'
    },
    'protein_powder': {
        id: 'protein_powder', label: '蛋白粉', price: 450, 
        tags: [ItemTag.Food],
        effects: { 
            needs: { [NeedType.Hunger]: 10 },
            attrGain: { id: 'constitution', amount: 3 }
        },
        trigger: 'active'
    },
    'gift_chocolates': {
        id: 'gift_chocolates', label: '进口巧克力', price: 320, 
        tags: [ItemTag.Food],
        effects: { needs: { [NeedType.Hunger]: 10, [NeedType.Fun]: 10 } },
        // 注意：送礼逻辑稍后在交互里特殊处理，这里先定义物品属性
        trigger: 'love'
    },

    // --- 书籍/技能类 ---
    'book_design': {
        id: 'book_design', label: '设计年鉴', price: 180, 
        tags: [ItemTag.Book],
        effects: { 
            needs: { [NeedType.Fun]: 10 },
            skillGain: { id: 'logic', amount: 5 }, // 假设逻辑技能
            attrGain: { id: 'iq', amount: 2 }
        },
        trigger: 'smart'
    },
    'fashion_mag': {
        id: 'fashion_mag', label: '时尚杂志', price: 45, 
        tags: [ItemTag.Book],
        effects: { 
            needs: { [NeedType.Fun]: 10 },
            attrGain: { id: 'creativity', amount: 2 }
        },
        trigger: 'art'
    },
    'puzzle_game': {
        id: 'puzzle_game', label: '益智模型', price: 260, 
        tags: [ItemTag.Toy],
        effects: { 
            needs: { [NeedType.Fun]: 20 },
            attrGain: { id: 'iq', amount: 2 }
        },
        trigger: 'smart'
    },

    // --- 票务/门票类 ---
    'ticket_cinema_2d': {
        id: 'ticket_cinema_2d', label: '文艺片票', price: 65, 
        tags: [ItemTag.General],
        effects: { needs: { [NeedType.Fun]: 40 } },
        trigger: 'bored'
    },
    'ticket_cinema_3d': {
        id: 'ticket_cinema_3d', label: 'IMAX大片', price: 120, 
        tags: [ItemTag.General],
        effects: { needs: { [NeedType.Fun]: 60 } },
        trigger: 'rich'
    },
    'ticket_museum': {
        id: 'ticket_museum', label: '特展门票', price: 100, 
        tags: [ItemTag.General],
        effects: { 
            needs: { [NeedType.Fun]: 50 },
            buffs: ['art_inspired'],
            attrGain: { id: 'creativity', amount: 3 }
        },
        trigger: 'smart'
    },
    'pass_gym': {
        id: 'pass_gym', label: '私教课', price: 800, 
        tags: [ItemTag.General],
        effects: { 
            needs: { [NeedType.Energy]: -20 }, // 消耗体力
            skillGain: { id: 'athletics', amount: 5 },
            attrGain: { id: 'constitution', amount: 4 }
        },
        trigger: 'active'
    },

    // --- 杂物/其他 ---
    'medicine': {
        id: 'medicine', label: '急救包', price: 300, 
        tags: [ItemTag.Medical],
        effects: { buffs: ['healing'] },
        trigger: 'sick'
    },
    'game_coin': {
        id: 'game_coin', label: '游戏代币', price: 10, 
        tags: [ItemTag.General],
        effects: { needs: { [NeedType.Fun]: 20 } },
        trigger: 'bored'
    },
    'cosmetic_set': {
        id: 'cosmetic_set', label: '高级美妆', price: 2200, 
        tags: [ItemTag.General],
        effects: { 
            needs: { [NeedType.Fun]: 20 },
            attrGain: { id: 'appearanceScore', amount: 5 }
        },
        trigger: 'beauty'
    },
    'protection': {
        id: 'protection', label: '安全措施', price: 20, 
        tags: [ItemTag.General],
        effects: {},
        trigger: 'safe_sex'
    },
};