import { Sim } from '../Sim';
import { GameStore } from '../simulation';
import { ITEMS, BUFFS } from '../../constants';
import { SocialLogic } from './social';
import { DecisionLogic } from './decision';
import { CareerLogic } from './career';
import { AgeStage } from '../../types';
import { SkillLogic } from './SkillLogic';
import { FurnitureUtility, FurnitureTag } from '../../config/furnitureTypes';

// 🆕 辅助函数：将 Item ID 映射到 Furniture Utility
// 这让市民知道为了买某个东西，应该去哪种设施
const getItemUtility = (itemId: string): string => {
    switch(itemId) {
        case 'drink': return FurnitureUtility.Vending; // 之前是 'buy_drink'，需确认枚举值是否一致
        case 'book': return FurnitureUtility.Book; // 或 'buy_book'，取决于枚举定义
        case 'cinema_2d':
        case 'cinema_3d': return FurnitureUtility.Cinema; // 或 'cinema_3d'
        case 'gym_pass': return FurnitureUtility.Exercise; // 'run'
        case 'museum_ticket': return FurnitureTag.Art; 
        case 'game_coin': return FurnitureUtility.Game;
        case 'gift_chocolates':
        case 'cosmetic_set':
        case 'fashion_mag':
        case 'protein_powder':
        case 'puzzle_game': 
            return FurnitureUtility.Shelf;; // 去通用商店货架
        default: return FurnitureUtility.Shelf;;
    }
};

// 🟢 [新增] 辅助函数：记录流水
const recordTransaction = (sim: Sim, amount: number, reason: string, type: 'income' | 'expense') => {
    const timeStr = `${String(GameStore.time.hour).padStart(2, '0')}:${String(GameStore.time.minute).padStart(2, '0')}`;
    sim.dailyTransactions.unshift({ // 最新发生的排在前面
        time: timeStr,
        amount: amount,
        reason: reason,
        type: type
    });
    // 限制列表长度，防止数据过多（例如只保留最近50条）
    if (sim.dailyTransactions.length > 50) sim.dailyTransactions.pop();
};

export const EconomyLogic = {
    calculateDailyBudget(sim: Sim) {
        if ([AgeStage.Infant, AgeStage.Toddler, AgeStage.Child].includes(sim.ageStage)) {
            sim.dailyBudget = 0;
            return;
        }

        let safetyPercent = 0.2;
        const isEarth = sim.zodiac.element === 'earth';
        const isFire = sim.zodiac.element === 'fire';
        const isJ = sim.mbti.includes('J');

        if (isEarth || isJ) safetyPercent = 0.4;
        if (isFire || !isJ) safetyPercent = 0.1;

        const safetyMargin = sim.money * safetyPercent;
        let disposable = Math.max(0, sim.money - safetyMargin);

        let propensity = 0.2;
        if (sim.hasBuff('rich_feel')) propensity = 0.5;
        if (sim.hasBuff('shopping_spree')) propensity = 0.8; 
        if (sim.hasBuff('stressed')) propensity = 0.4;

        sim.dailyBudget = Math.floor(disposable * propensity);
    },

    checkSpending(sim: Sim) {
        if (sim.action !== 'wandering' && sim.action !== 'idle') {
            return;
        }
        // 🔒 [安全守卫] 婴幼儿绝对禁止产生购物意图
        if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) return;
        
        if (sim.money <= 0) return;

        if (sim.money < 100) {
            if (!sim.hasBuff('broke') && !sim.hasBuff('anxious')) {
                sim.addBuff(BUFFS.broke);
                sim.addBuff(BUFFS.anxious);
            }
            return;
        }

        const affordable = ITEMS.filter(item => item.cost <= sim.dailyBudget && item.cost <= sim.money);
        let bestItem: any = null;
        let maxScore = 0;

        affordable.forEach(item => {
            let score = 0;
            if (item.needs) {
                if (item.needs.hunger && sim.needs.hunger < 60) score += item.needs.hunger * 2;
                if (item.needs.fun && sim.needs.fun < 60) score += item.needs.fun * 2;
                if (item.needs.energy && sim.needs.energy < 50 && item.needs.energy > 0) score += 20;
            }
            if (item.id === 'museum_ticket' && (sim.mbti.includes('N') || sim.skills.creativity > 20)) {
                score += 40;
            }
            
            if (item.skill) {
                if (sim.lifeGoal.includes('博学') || sim.lifeGoal.includes('富翁')) score += 30;
                if (sim.mbti.includes('N') && item.skill === 'logic') score += 20;
                if (sim.zodiac.element === 'fire' && item.skill === 'athletics') score += 20;
            }

            if (item.attribute) {
                const currentVal = (sim as any)[item.attribute] || 0;
                if (currentVal < 40) score += 30;

                if (item.attribute === 'iq' && sim.job.companyType === 'internet') score += 40;
                if (item.attribute === 'creativity' && sim.job.companyType === 'design') score += 40;
                if ((item.attribute === 'appearanceScore' || item.attribute === 'eq') && sim.job.companyType === 'business') score += 40;
                if (item.attribute === 'constitution' && sim.job.companyType === 'restaurant') score += 30;

                if (sim.lifeGoal.includes('万人迷') && item.attribute === 'appearanceScore') score += 50;
                if (sim.lifeGoal.includes('大牛') && item.attribute === 'iq') score += 50;
                if (sim.lifeGoal.includes('健身') && item.attribute === 'constitution') score += 50;
            }

            if (sim.hasBuff('shopping_spree')) {
                score += 50; 
                if (item.cost > 100) score += 30; 
            }

            if (item.trigger === 'rich_hungry' && sim.money > 5000) score += 50;
            if (item.trigger === 'addicted' && sim.mbti.includes('P') && sim.needs.fun < 30) score += 100;
            if (item.trigger === 'love' && sim.hasBuff('in_love')) score += 80;
            if (item.trigger === 'beauty' && sim.appearanceScore < 50) score += 30; 

            score += Math.random() * 20;

            if (score > 50 && score > maxScore) {
                maxScore = score;
                bestItem = item;
            }
        });

        if (bestItem) {
            // 🔒 [修复] 不再直接调用 buyItem 进行“云购物”
            // 1. 设置购买意图
            sim.intendedShoppingItemId = bestItem.id;
            
            // 2. 找到对应的售卖设施
            const targetUtility = getItemUtility(bestItem.id);
            
            // 3. 触发寻路决策
            sim.say(`想去买${bestItem.label}...`, 'act');
            DecisionLogic.findObject(sim, targetUtility);
        }
        
        CareerLogic.checkCareerSatisfaction(sim);
    },

    buyItem(sim: Sim, item: any) {
        sim.money -= item.cost;
        sim.dailyExpense += item.cost;
        sim.dailyBudget -= item.cost;
        // 🟢 [新增] 记录消费
        recordTransaction(sim, item.cost, item.label, 'expense');

        if (item.needs) {
            for (let k in item.needs) {
                if (sim.needs[k] !== undefined) sim.needs[k] = Math.min(100, sim.needs[k] + item.needs[k]);
            }
        }

        if (item.skill) {
            let val = item.skillVal || 5;
            SkillLogic.gainExperience(sim, item.skill, val);
            sim.say("📚 涨知识", 'act');
        }

        if (item.attribute) {
            let val = item.attrVal || 2;
            const current = (sim as any)[item.attribute] || 0;
            (sim as any)[item.attribute] = Math.min(100, current + val);
            
            let emoji = '✨';
            if (item.attribute === 'appearanceScore') emoji = '💅';
            if (item.attribute === 'constitution') emoji = '💪';
            if (item.attribute === 'iq') emoji = '🧠';
            
            sim.say(`${emoji} 提升!`, 'act');
        }

        if (item.buff) sim.addBuff(BUFFS[item.buff as keyof typeof BUFFS]);

        if (item.id === 'museum_ticket') {
             sim.say("买票去看展 🎨", 'act');
             sim.addBuff(BUFFS.art_inspired);
             // 买完票直接去看展，如果当前就在美术馆，交互系统会自动处理接下来的动作
        }

        let logSuffix = "";
        if (item.rel) {
            const loverId = Object.keys(sim.relationships).find(id => sim.relationships[id].isLover);
            if (loverId) {
                const lover = GameStore.sims.find(s => s.id === loverId);
                if (lover) {
                    let relBonus = 15;
                    if (lover.lifeGoal.includes('富翁')) relBonus += 10;
                    
                    SocialLogic.updateRelationship(lover, sim, 'romance', relBonus);
                    lover.needs.fun = Math.min(100, lover.needs.fun + 20);
                    logSuffix = ` (送给 ${lover.name})`;
                    sim.addMemory(`给 ${lover.name} 买了 ${item.label}，希望Ta喜欢。`, 'social', lover.id);
                }
            }
        }

        if (item.id !== 'museum_ticket') sim.say(`💸 ${item.label}`, 'act');
        GameStore.addLog(sim, `购买了 ${item.label} -$${item.cost}${logSuffix}`, 'money');
    },

    payRent(sim: Sim) {
        if (!sim.homeId) return; 
        if (sim.ageStage === 'Infant' || sim.ageStage === 'Toddler' || sim.ageStage === 'Child') return;

        const home = GameStore.housingUnits.find(u => u.id === sim.homeId);
        if (!home) return;

        const adultRoommates = GameStore.sims.filter(s => s.homeId === sim.homeId && !['Infant', 'Toddler', 'Child'].includes(s.ageStage));
        const share = Math.ceil(home.cost / (adultRoommates.length || 1));

        if (sim.money >= share) {
            sim.money -= share;
            sim.dailyExpense += share;
            // 🟢 [新增] 记录房租
            recordTransaction(sim, share, '支付房租', 'expense');
        } else {
            sim.addBuff(BUFFS.broke);
            sim.say("房租要交不起了...", 'bad');
        }
    },

    earnMoney(sim: Sim, amount: number, source: string) {
        // 🔒 [安全守卫] 严格禁止未成年人赚钱
        // 婴儿、幼儿、儿童均不可获得收入
        if ([AgeStage.Infant, AgeStage.Toddler, AgeStage.Child].includes(sim.ageStage)) {
            return;
        }

        const earned = Math.floor(amount);
        if (earned <= 0) return;

        sim.money += earned;
        sim.dailyIncome += earned; 
        // 🟢 [新增] 记录收入
        recordTransaction(sim, earned, source, 'income');
        GameStore.addLog(sim, `通过 ${source} 赚了 $${earned}`, 'money');
        sim.say(`赚到了! +$${earned}`, 'money');
        sim.addBuff(BUFFS.side_hustle_win);
    }
};