import { BUFFS } from '../../config/gameplay';
import { Furniture, SimAction, AgeStage } from '../../types';
import type { Sim } from '../Sim';
import { SchoolLogic } from './school';
import { SkillLogic } from './SkillLogic'; 
import { GameStore } from '../GameStore';
import { InteractionType, NeedType, ItemTag } from '../../config/gameConstants';
import { ITEM_REGISTRY } from '../../data/items';
import { EconomyLogic } from './EconomyLogic';

// === 接口定义 ===
export interface InteractionHandler {
    verb: string;
    duration: number; // 基础分钟数
    getDuration?: (sim: Sim, obj: Furniture) => number; // 动态计算时长
    getVerb?: (sim: Sim, obj: Furniture) => string; // 动态计算动作名
    onStart?: (sim: Sim, obj: Furniture) => boolean; // 返回 false 表示交互失败
    onUpdate?: (sim: Sim, obj: Furniture, f: number, getRate: (m: number) => number) => void;
    onFinish?: (sim: Sim, obj: Furniture) => void;
}

// === 辅助函数：统一处理年龄限制 ===
const checkAgeRestriction = (sim: Sim, minAge: string | undefined, errMsg: string = "太小了，做不到...") => {
    // 简单的年龄层级判断逻辑 (这里简化处理，实际可根据 Enum 顺序判断)
    const restricted = [AgeStage.Infant, AgeStage.Toddler];
    if (minAge === 'Child' && restricted.includes(sim.ageStage)) {
        sim.say(errMsg, 'bad');
        return false;
    }
    // 婴儿和幼儿几乎大部分通用交互都不能做
    if (restricted.includes(sim.ageStage)) {
         sim.say("够不着...", 'bad');
         return false;
    }
    return true;
};

// === 辅助函数：应用物品/行为效果 ===
const applyEffects = (sim: Sim, effects: any, f: number = 1.0) => {
    if (!effects) return;

    // 1. 需求恢复
    if (effects.needs) {
        Object.entries(effects.needs).forEach(([need, amount]) => {
            if (sim.needs[need as NeedType] !== undefined) {
                // 如果是 onUpdate 这种持续调用的，amount 需要乘以 f (frame delta)
                // 这里假设 effects 定义的是总值，还是速率，需要根据上下文。
                // 为了通用，我们假设这里处理的是单次结算(onFinish)或速率(onUpdate)
                // 在此代码段中，我们主要在 update 中手动处理速率，这里处理单次获得的 buff/attr
            }
        });
    }

    // 2. 属性提升 (IQ, EQ, etc)
    if (effects.attrGain) {
        const { id, amount } = effects.attrGain;
        if ((sim as any)[id] !== undefined) {
            (sim as any)[id] = Math.min(100, (sim as any)[id] + amount * f);
        }
    }

    // 3. Buff (仅限单次触发)
    if (effects.buffs && f === 1.0) { // f=1.0 暗示是单次调用
        effects.buffs.forEach((buffId: string) => {
             if((BUFFS as any)[buffId]) sim.addBuff((BUFFS as any)[buffId]);
        });
    }
};

// === 常量定义 ===
export const RESTORE_TIMES: Record<string, number> = {
    [NeedType.Bladder]: 15, 
    [NeedType.Hygiene]: 20, 
    [NeedType.Hunger]: 30, 
    energy_sleep: 420, 
    energy_nap: 60,
    fun_high: 60, 
    fun_low: 120,
    default: 60
};

// === 辅助函数：获取家具的交互配置 ===
const getConfig = (obj: Furniture, type: InteractionType) => {
    return obj.interactions?.[type] || {};
};

// 🆕 核心交互策略表
export const INTERACTIONS: Record<string, InteractionHandler> = {

    // ========================================================
    // 🛒 通用购物 (Shop)
    // 涵盖：自动贩卖机、书店、超市、买门票
    // ========================================================
    [InteractionType.Shop]: {
        verb: '购物', 
        duration: 15,
        getVerb: (sim, obj) => {
            const config = obj.interactions?.[InteractionType.Shop];
            return config?.verb || '购物';
        },
        onStart: (sim, obj) => {
            if (!checkAgeRestriction(sim, 'Child')) return false;

            // 1. 确定要买什么 (优先查看意图，其次查看家具默认售卖列表)
            let targetItemId = sim.intendedShoppingItemId;
            
            // 如果 Sim 没有明确想买的，但点击了该家具，尝试获取该家具售卖列表的第一个作为默认
            if (!targetItemId) {
                const shopConfig = obj.interactions?.[InteractionType.Shop];
                if (shopConfig?.inventory && shopConfig.inventory.length > 0) {
                    targetItemId = shopConfig.inventory[0];
                }
            }

            if (!targetItemId) {
                sim.say("没看到想买的东西...", 'normal');
                return false;
            }

            // 2. 获取物品数据
            const item = ITEM_REGISTRY[targetItemId];
            if (!item) return false;

            // 3. 检查金钱 (支持家具特定的价格系数，如自家冰箱免费)
            const shopConfig = obj.interactions?.[InteractionType.Shop];
            const multiplier = shopConfig?.priceMultiplier ?? 1.0;
            const finalPrice = Math.floor(item.price * multiplier);

            // 贫困保护逻辑 (保留原汁原味)
            if (sim.money < 100 && item.tags.includes(ItemTag.Drink) && sim.needs[NeedType.Hunger] > 30 && finalPrice > 0) {
                 sim.say("省点钱喝凉水吧...", 'bad');
                 return false;
            }

            if (sim.money < finalPrice) {
                sim.say("买不起...", 'bad');
                // 清理意图，避免死循环
                sim.intendedShoppingItemId = undefined;
                return false;
            }

            // 4. 预扣款 (或在 finish 扣款，这里选择 start 扣款简单点，或者由 buyItem 处理)
            // 这里我们模拟过程，实际交易在 finish
            sim['tempTransaction'] = { item, price: finalPrice };
            
            return true;
        },
        onFinish: (sim, obj) => {
            const transaction = sim['tempTransaction'];
            if (transaction) {
                // 真正的购买逻辑：扣钱，加物品进背包或直接使用
                if (transaction.price > 0) sim.money -= transaction.price;
                
                // 如果是食物/饮料，通常直接产生效果（或者放入背包，这里简化为直接消费/获得效果）
                // 复用 EconomyLogic 或直接写
                sim.buyItem(transaction.item); 
                
                // 触发特殊语音
                if (transaction.item.tags.includes(ItemTag.Book)) sim.say("知识就是力量 📖", 'act');
                else sim.say("买到了! ✨", 'money');

                delete sim['tempTransaction'];
            } else {
                // 只是看看
                sim.say("只是看看~", 'act');
                sim.needs[NeedType.Fun] += 5;
            }
            // 交互结束，清理意图
            sim.intendedShoppingItemId = undefined;
        }
    },
    // ==========================================
    // 🎨 通用技能/练习逻辑 (PracticeSkill)
    // 涵盖: 健身, 瑜伽, 画画, 弹琴, 下棋, 园艺, 钓鱼, 演讲
    // ==========================================
    [InteractionType.PracticeSkill]: {
        verb: '练习',
        duration: 60,
        getVerb: (sim, obj) => getConfig(obj, InteractionType.PracticeSkill).verb || '练习',
        
        onStart: (sim, obj) => {
            if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) { 
                sim.say("我还太小了...", 'bad'); return false; 
            }
            // 部分技能需要耗材 (如画画)
            const cfg = getConfig(obj, InteractionType.PracticeSkill);
            if (cfg.skillId === 'creativity' && obj.tags.includes(ItemTag.Easel)) {
                 if (sim.money < 10) { sim.say("没钱买颜料...", 'bad'); return false; }
                 sim.money -= 10;
            }
            if (cfg.skillId === 'gardening' && sim.money < 5) {
                 sim.say("没钱买种子...", 'bad'); return false;
            }
            return true;
        },

        onUpdate: (sim, obj, f, getRate) => {
            const cfg = getConfig(obj, InteractionType.PracticeSkill);
            const skillId = cfg.skillId || 'general';
            const xpRate = cfg.xpRate || 0.1;
            
            // 1. 增加经验
            SkillLogic.gainExperience(sim, skillId, xpRate * f);
            
            // 2. 处理副作用 (精力消耗/卫生消耗)
            const energyCost = cfg.energyCost || 100;
            sim.needs[NeedType.Energy] -= getRate(energyCost);

            // 3. 健身特例：消耗卫生
            if (skillId === 'athletics') {
                sim.needs[NeedType.Hygiene] -= getRate(200);
                sim.constitution = Math.min(100, sim.constitution + 0.05 * f);
            }
            
            // 4. 娱乐回馈 (可选)
            if (cfg.funRate) {
                sim.needs[NeedType.Fun] += getRate(cfg.funRate);
            }
        },

        onFinish: (sim, obj) => {
            const cfg = getConfig(obj, InteractionType.PracticeSkill);
            const skillId = cfg.skillId;

            // --- 特殊产出逻辑 ---
            // 健身受伤逻辑
            if (skillId === 'athletics' && sim.constitution < 30 && Math.random() < 0.1) {
                sim.say("哎哟！腰闪了... 🚑", 'bad');
                sim.health -= 5;
            }
            
            // 1. 园艺产出
            if (skillId === 'gardening') {
                const failChance = Math.max(0.05, 0.4 - sim.skills.gardening * 0.01);
                if (Math.random() < failChance) {
                    sim.say("枯死了... 🍂", 'bad');
                } else {
                    const profit = Math.floor(20 + sim.skills.gardening * 0.5);
                    if (sim.ageStage === AgeStage.Child) {
                        sim.say("收菜啦！🥬", 'act');
                    } else if (sim.hasFreshIngredients) {
                        sim.earnMoney(profit, 'selling_veggies'); // 冰箱满了就卖掉
                    } else {
                        sim.hasFreshIngredients = true;
                        sim.say("获得新鲜食材 🥬", 'life');
                    }
                }
            }
            // 2. 绘画产出
            if (skillId === 'creativity' || skillId === 'painting') {
                if (sim.ageStage === AgeStage.Child) {
                    sim.say("画好了！🎨", 'act');
                    sim.addMemory("画了一幅画。", 'achievement');
                } else {
                    // 卖画逻辑
                    const quality = sim.skills.creativity || 0;
                    if (Math.random() < Math.max(0.05, 0.4 - quality * 0.008)) {
                        sim.say("画毁了... 🗑️", 'bad');
                    } else {
                        let val = 30 + quality * 3;
                        if (quality > 80 && Math.random() > 0.8) {
                            val *= 3;
                            sim.say("传世杰作! 🎨", 'act');
                        } else {
                            sim.say("卖掉画作 🖼️", 'money');
                        }
                        sim.earnMoney(Math.floor(val), 'selling_art');
                    }
                }
            }
            // 3. 钓鱼产出
            else if (skillId === 'fishing') {
                if (Math.random() > 0.6) {
                    sim.earnMoney(20, 'sell_fish');
                    sim.say("大鱼! 🐟", 'money');
                } else {
                    sim.say("空军...", 'normal');
                }
            }
            // 4. 通用完成反馈
            else {
                sim.say("感觉变强了！💪", 'act');
            }
        }
    },

    // ==========================================
    // 🎮 通用娱乐逻辑 (UseEntertainment)
    // 涵盖: 电视, 游戏机, 看画, 跳舞毯
    // ==========================================
    [InteractionType.UseEntertainment]: {
        verb: '娱乐', 
        duration: 90,
        getVerb: (sim, obj) => obj.interactions?.[InteractionType.UseEntertainment]?.verb || '娱乐',
        onStart: (sim, obj) => {
            const config = obj.interactions?.[InteractionType.UseEntertainment];
            sim.enterInteractionState(SimAction.Using); // 通用动画状态
            
            // 特殊 Buff
            if (config?.contentTags?.includes('movie')) sim.addBuff(BUFFS.movie_fun);
            
            return true;
        },
        onUpdate: (sim, obj, f, getRate) => {
            const config = obj.interactions?.[InteractionType.UseEntertainment];
            const funRate = config?.funRate || 100;
            const energyCost = config?.energyCost || 50;

            sim.needs[NeedType.Fun] += getRate(funRate);
            sim.needs[NeedType.Energy] -= getRate(energyCost);
            
            // 甚至可以在这里根据 tags 加一点属性，比如看新闻加智商
        },
        onFinish: (sim) => {
            // 简单的结束语
            sim.say("真有意思！", 'act');
        }
    },

    // ==========================================
    // 💻 工作与学习 (Work & Study)
    // 涵盖: 电脑工作, 电脑游戏, 写作
    // 注意: 去公司上班通常是 Map 级的 Rabbit Hole，不在这里处理，这里主要处理互动物件
    // ==========================================
    [InteractionType.AttendInstitution]: {
        verb: '使用电脑',
        duration: 120,
        getVerb: (sim) => {
           if (sim.ageStage === AgeStage.Child || sim.ageStage === AgeStage.Teen) return '上学 🎒';
            if (sim.isSideHustle) return '接单 💻';
            return '工作 💼';
        },
        onStart: (sim) => {
            // 意图分流
            if (sim.currentIntent === SimIntent.FUN) {
                sim.enterInteractionState(SimAction.Using); // 玩游戏姿态
            } else {
                sim.enterWorkingState(); // 工作姿态
            }
            return true;
        },
        onUpdate: (sim, obj, f, getRate) => {
            // 模式 A: 玩游戏
            if (sim.currentIntent === SimIntent.FUN) {
                sim.needs[NeedType.Fun] += getRate(150);
                sim.needs[NeedType.Social] += getRate(50); // 假装在联机
                return;
            }
            
            // 模式 B: 工作/接单
            if (sim.isSideHustle) {
                // 接单时练习逻辑
                SkillLogic.gainExperience(sim, 'logic', 0.1 * f);
                sim.needs[NeedType.Fun] -= getRate(50);
            }
        },
        onFinish: (sim) => {
            if (sim.currentIntent === SimIntent.FUN) {
                sim.say("好玩!", 'act');
            } else if (sim.isSideHustle) {
                const earned = 50 + sim.skills.logic * 2;
                sim.earnMoney(earned, 'freelance');
                sim.say("赚点外快 💰", 'money');
            }
        }
    },

    // ==========================================
    // 🍳 烹饪 (Cook)
    // 涵盖: 微波炉, 炉灶, 专业厨房
    // ==========================================
    [InteractionType.Cook]: {
        verb: '做饭',
        duration: 60,
        onStart: (sim, obj) => {
            if ([AgeStage.Infant, AgeStage.Toddler, AgeStage.Child].includes(sim.ageStage)) {
                sim.say("小孩不能玩火 🔥", 'bad'); return false;
            }
            
            // 检查食材
            if (sim.hasFreshIngredients) {
                sim.hasFreshIngredients = false;
                sim.say("使用新鲜蔬菜 🥬", 'act');
            } else {
                if (sim.money < 15) { sim.say("没钱买菜...", 'bad'); return false; }
                sim.money -= 15;
            }
            
            sim.enterInteractionState(SimAction.Cooking);
            return true;
        },
        onUpdate: (sim, obj, f, getRate) => {
            SkillLogic.gainExperience(sim, 'cooking', 0.1 * f);
        },
        onFinish: (sim) => {
            // 烹饪结果
            if (Math.random() < 0.1 && sim.skills.cooking < 20) {
                sim.say("烧焦了... 🔥", 'bad');
                sim.mood -= 10;
            } else {
                sim.say("开饭咯! 🍲", 'act');
                sim.needs[NeedType.Hunger] = 100;
                sim.addBuff(BUFFS.good_meal);
            }
        }
    },

// ==========================================
    // 🍽️ 进食 (Dining)
    // 涵盖: 在餐桌吃饭, 在餐厅吃饭
    // ==========================================
    [InteractionType.Dining]: {
        verb: '用餐',
        duration: 30,
        onStart: (sim) => { sim.enterInteractionState(SimAction.Eating); return true; },
        onUpdate: (sim, obj, f, getRate) => {
             sim.needs[NeedType.Hunger] += getRate(60);
             // 如果是餐厅 (根据 obj 配置或 tag) 还可以加娱乐
             if (obj.tags.includes(ItemTag.Seat) && obj.cost > 0) { // 假设付费座位是餐厅
                 sim.needs[NeedType.Fun] += getRate(50);
             }
        }
    },

    [InteractionType.Sleep]: {
        verb: '睡觉 💤', duration: 420,
        getVerb: (sim, obj) => (obj.label.includes('沙发') || obj.label.includes('长椅')) ? '小憩' : '睡觉 💤',
        getDuration: (sim, obj) => {
             // ... (保持原样)
             const missing = 100 - sim.needs[NeedType.Energy];
             return (missing / 100) * RESTORE_TIMES.energy_sleep * 1.1; 
        },
        onStart: (sim, obj) => { 
            if (obj.label.includes('沙发')) sim.enterInteractionState(SimAction.Using);
            else sim.enterInteractionState(SimAction.Sleeping);
            return true; 
        },
        onUpdate: (sim, obj, f, getRate) => {
            let timeKey = (obj.label.includes('沙发') || obj.label.includes('长椅')) ? 'energy_nap' : 'energy_sleep';
            let t = RESTORE_TIMES[timeKey];
            if (sim.needs[NeedType.Energy] !== undefined) sim.needs[NeedType.Energy] += getRate(t);
            if (timeKey === 'energy_nap') sim.needs[NeedType.Comfort] = 100;

            // [优化] 智能唤醒：精力满且天亮了才起床
            const isNight = GameStore.time.hour >= 23 || GameStore.time.hour < 6;
            const isHungry = sim.needs[NeedType.Hunger] < 20;
            
            // 只有在 (精力满 且 不是深夜) 或者 (饿醒了) 时才起床
            if ((sim.needs[NeedType.Energy] >= 100 && !isNight) || isHungry) {
                sim.finishAction();
                if (isHungry) sim.say("饿醒了...", 'bad');
                else sim.say("睡饱了！☀️", 'act');
            }
        }
    },

    // ==========================================
    // 🚽 核心需求: 卫生与排泄
    // ==========================================
    [InteractionType.UseToilet]: {
        verb: '方便', duration: 15,
        onUpdate: genericRestore(NeedType.Bladder)
    },
    [InteractionType.Shower]: {
        verb: '洗澡 🚿', duration: 20,
        onStart: (sim) => { 
            if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) return false; 
            sim.enterInteractionState(SimAction.Using); 
            return true; 
        },
        onUpdate: (sim, obj, f, getRate) => {
            sim.needs[NeedType.Hygiene] += getRate(20);
            sim.needs[NeedType.Comfort] += getRate(50);
        }
    },
    
    // ==========================================
    // 🛋️ 坐下/休息 (Sit)
    // ==========================================
    [InteractionType.Sit]: {
        verb: '休息', duration: 30,
        onStart: (sim) => { sim.enterInteractionState(SimAction.Using); return true; },
        onUpdate: (sim, obj, f, getRate) => {
            sim.needs[NeedType.Energy] += getRate(60);
            sim.needs[NeedType.Comfort] = 100;
        }
    },

    // ==========================================
    // 👶 幼儿交互
    // ==========================================
    [InteractionType.NapCrib]: {
        verb: '睡午觉', duration: 120,
        onUpdate: (sim, obj, f, getRate) => {
            sim.needs[NeedType.Energy] += getRate(120);
            sim.health += 0.01 * f;
        }
    },
    [InteractionType.PlayBlocks]: {
        verb: '玩积木', duration: 45,
        onUpdate: (sim, obj, f, getRate) => {
            sim.needs[NeedType.Fun] += getRate(60);
            SkillLogic.gainExperience(sim, 'creativity', 0.05 * f);
        }
    },

    // 默认回退
    'default': {
        verb: '使用', duration: 30,
        onUpdate: (sim, obj, f, getRate) => {
             // 简单的回血逻辑，防止报错
             if (sim.needs[NeedType.Fun] !== undefined) sim.needs[NeedType.Fun] += getRate(30);
        }
    }
};

// 简单的辅助函数，用于快速生成回血逻辑
function genericRestore(needType: NeedType, time: number = 30) {
    return (sim: Sim, obj: Furniture, f: number, getRate: (m: number) => number) => {
        if (sim.needs[needType] !== undefined) {
            sim.needs[needType] += getRate(time);
        }
    };
}