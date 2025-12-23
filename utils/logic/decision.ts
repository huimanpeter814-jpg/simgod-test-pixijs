
import type { Sim } from '../Sim'; 
import { GameStore } from '../simulation';
import { CONFIG, BUFFS} from '../../constants'; 
import { Furniture, SimAction, NeedType, AgeStage, JobType, SimIntent, QueuedAction, Relationship} from '../../types';
import { getInteractionPos } from '../simulationHelpers';
// 🟢 [修改] 引入所有需要的状态类，移除 require
import { FeedBabyState, WaitingState, BatheBabyState, SchoolingState, WorkingState } from './SimStates';
import { PLOTS } from '../../data/plots'; 

// 辅助：判断是否是工作日/工作时间
const isWorkTime = (sim: Sim): boolean => {
    if (!sim.job || sim.job.id === 'unemployed') return false;
    const hour = GameStore.time.hour;
    // 简单的周一到周五判断 (假设 totalDays % 7 < 5)
    const isWeekend = (GameStore.time.totalDays % 7) >= 5; 
    if (isWeekend) return false;
    return hour >= sim.job.startHour && hour < sim.job.endHour;
};

// 辅助：判断是否是学校时间
const isSchoolTime = (sim: Sim): boolean => {
    if (![AgeStage.Child, AgeStage.Teen].includes(sim.ageStage)) return false;
    const hour = GameStore.time.hour;
    const isWeekend = (GameStore.time.totalDays % 7) >= 5;
    if (isWeekend) return false;
    return hour >= 8 && hour < 16;
};

export const DecisionLogic = {
    /**
     * 核心权限检查：判断市民是否被禁止进入某目标区域/使用某物品
     */
    isRestricted(sim: Sim, target: { x: number, y: number } | Furniture): boolean {
        // 1. 寻找目标所在的具体地块
        const plot = GameStore.worldLayout.find(p => 
            target.x >= p.x && target.x <= p.x + (p.width || 300) &&
            target.y >= p.y && target.y <= p.y + (p.height || 300)
        );

        // 2. 基于地皮类型的规则
        if (plot) {
            const plotTemplate = PLOTS[plot.templateId];
            const plotType = plot.customType || (plotTemplate ? plotTemplate.type : 'public');

            // [规则 A] 学校区域警戒
            const schoolTypes = ['kindergarten', 'elementary_school', 'high_school'];
            const isSchool = schoolTypes.includes(plotType);
            const isKindergarten = plotType === 'kindergarten';
            const currentHour = GameStore.time.hour;
            const isSchoolTime = currentHour >= 8 && currentHour < 17;
            
            if (isSchool && (isSchoolTime || isKindergarten)) {
                if (sim.workplaceId === plot.id) return false; // 员工
                const validParentActions = [SimAction.PickingUp, SimAction.Escorting, SimAction.Waiting, SimAction.FeedBaby];
                if (validParentActions.includes(sim.action as SimAction)) return false; // 家长任务

                let isStudent = false;
                if (isKindergarten && [AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) isStudent = true;
                if (plotType === 'elementary_school' && sim.ageStage === AgeStage.Child) isStudent = true;
                if (plotType === 'high_school' && sim.ageStage === AgeStage.Teen) isStudent = true;
                
                if (isStudent) return false;
                return true; // 其他人禁止
            }

            // [规则 B] 成人娱乐场所
            if (plotType === 'bar') {
                if ([AgeStage.Infant, AgeStage.Toddler, AgeStage.Child, AgeStage.Teen].includes(sim.ageStage)) return true;
            }

            // [规则 C] 办公区域
            const privateOfficeTypes = ['internet', 'business', 'design'];
            if (privateOfficeTypes.includes(plotType)) {
                if (sim.workplaceId === plot.id) return false;
                return true;
            }

            // [规则 D] 养老院/私人社区
            if (plotType === 'elder_care') {
                const unit = GameStore.housingUnits.find(u => u.id === sim.homeId && u.id.startsWith(plot.id));
                if (unit) return false; 
                if (sim.workplaceId === plot.id) return false;
                if (sim.job.id === 'nanny' && sim.isTemporary && sim.homeId && sim.homeId.startsWith(plot.id)) return false;
                return true;
            }
        }

        // 3. 私宅归属权检查 (关键修改：确保流浪汉不闯民宅，但可以用公共设施)
        let homeId: string | undefined;
        if ('homeId' in target && (target as Furniture).homeId) {
            homeId = (target as Furniture).homeId;
        } else if (plot) {
            const unit = GameStore.housingUnits.find(u => 
                u.id.startsWith(plot.id) && 
                target.x >= u.x && target.x <= u.x + u.area.w &&
                target.y >= u.y && target.y <= u.y + u.area.h
            );
            if (unit) homeId = unit.id;
        }

        if (homeId) {
            if (sim.homeId === homeId) return false;
            if (sim.isTemporary && sim.job.id === 'nanny' && sim.homeId === homeId) return false;
            // 只要是有主的房子，外人（包括无家可归者）都不能随便用
            const isOccupied = GameStore.sims.some(s => s.homeId === homeId);
            if (isOccupied) return true;
        }

        return false;
    },
    /**
     * 🧠 [核心大脑] 意图评估系统
     * 综合考虑生理、性格、社会关系、环境因素，为各种意图打分。
     */
    evaluateBestIntent(sim: Sim): SimIntent {
        const scores: { intent: SimIntent, score: number, meta?: any }[] = [];
        const hour = GameStore.time.hour;
        const isNight = hour >= 22 || hour < 6;
        const isSleeping = sim.action === SimAction.Sleeping;

        // === 1. 生存本能 (Survival) - 绝对最高优先级 ===
        let survivalScore = 0;
        if (sim.needs[NeedType.Hunger] < 15) survivalScore += 500; // 饿昏了
        if (sim.needs[NeedType.Energy] < 10) survivalScore += 600; // 困死
        if (sim.health < 50) survivalScore += 800; // 生病/受伤
        
        // 婴幼儿的生存需求转化为 "CRY_FOR_HELP" 或直接由成人系统接管，这里主要针对能自主行动的人
        if (survivalScore > 0) {
            // 如果已经在睡觉且还是困，保持睡觉意图
            if (isSleeping && sim.needs[NeedType.Energy] < 90) return SimIntent.SLEEP;
            return SimIntent.SURVIVE; 
        }

        // === 2. 刚性日程 (Schedule) ===
        // 只有 'J' (判断型) 或尽职度高的人会严格遵守，'P' (感知型) 或叛逆者可能翘班
        let scheduleScore = 0;
        const diligence = (sim.mbti.includes('J') ? 1.2 : 0.8) * (sim.traits.includes('勤奋') ? 1.2 : 1.0);
        
        // 上班
        if (isWorkTime(sim) && !sim.hasLeftWorkToday) {
             // 如果已经在工作，分数极高以维持状态
            if (sim.action === SimAction.Working) scheduleScore = 1000;
            else scheduleScore = 300 * diligence;
            
            if (sim.traits.includes('懒惰') && Math.random() < 0.1) scheduleScore = 0; // 懒人偶尔翘班
            scores.push({ intent: SimIntent.WORK, score: scheduleScore });
        }
        
        // 上学 (包括幼儿园)
        // [修复] 幼儿(Toddler)如果去了幼儿园，也算是一种 School 状态
        if (isSchoolTime(sim) && [AgeStage.Child, AgeStage.Teen].includes(sim.ageStage)) {
             if (sim.action === SimAction.Schooling) scheduleScore = 1000;
             else scheduleScore = 350; // 学生必须上学
             scores.push({ intent: SimIntent.WORK, score: scheduleScore }); // WORK 意图复用于上学
        }

        // === 3. 生理需求 (Needs) - 动态加权 ===
        // 只有需求低于阈值才考虑，避免“满血吃药”
        // 性格影响忍耐度：ISTJ (忍耐力强) vs ESFP (享乐主义)
        
        // A. 饥饿
        if (sim.needs[NeedType.Hunger] < 70) {
            let hungerScore = (100 - sim.needs[NeedType.Hunger]) * 2.5;
            if (sim.traits.includes('吃货')) hungerScore *= 1.5;
            // 饭点加分 (7-8, 12-13, 18-19)
            if ([7, 8, 12, 13, 18, 19].includes(hour)) hungerScore += 50;
            scores.push({ intent: SimIntent.SATISFY_HUNGER, score: hungerScore });
        }

        // B. 困倦 (Energy)
        if (sim.needs[NeedType.Energy] < 60 || (isNight && sim.needs[NeedType.Energy] < 90)) {
            let sleepScore = (100 - sim.needs[NeedType.Energy]) * 2.0;
            if (isNight) sleepScore += 100; // 晚上就该睡觉
            if (sim.traits.includes('夜猫子') && isNight) sleepScore -= 50; // 夜猫子晚上不爱睡
            
            // 如果已经在睡觉，且没睡饱，极大加分防止起床
            if (isSleeping && sim.needs[NeedType.Energy] < 95) sleepScore += 500;
            
            scores.push({ intent: SimIntent.SLEEP, score: sleepScore });
        }

        // C. 卫生 & 排泄
        if (sim.needs[NeedType.Bladder] < 60) scores.push({ intent: SimIntent.FULFILL_NEED, score: (100 - sim.needs[NeedType.Bladder]) * 3.5, meta: NeedType.Bladder });
        if (sim.needs[NeedType.Hygiene] < 60) {
            let hygieneScore = (100 - sim.needs[NeedType.Hygiene]) * 2.0;
            if (sim.traits.includes('洁癖')) hygieneScore *= 1.5;
            scores.push({ intent: SimIntent.FULFILL_NEED, score: hygieneScore, meta: NeedType.Hygiene });
        }

        // === 4. 欲望与个性 (Desire) ===
        // 当基本需求满足时，Sim 会追求什么？

        // A. 社交 (Social)
        if (sim.needs[NeedType.Social] < 80) {
            let socialScore = (100 - sim.needs[NeedType.Social]) * 1.0;
            
            // MBTI 修正
            if (sim.mbti.startsWith('E')) socialScore *= 1.5; // 外向者渴望社交
            if (sim.mbti.startsWith('I')) socialScore *= 0.6; // 内向者不需要太多
            
            // 关系修正：如果有爱人且很久没见了
            if (sim.partnerId) socialScore += 20;
            if (sim.hasBuff('lonely')) socialScore += 50;
            
            // 星座修正 (风象星座爱社交: 双子/天秤/水瓶)
            if (['Gemini', 'Libra', 'Aquarius'].includes(sim.zodiac?.name)) socialScore *= 1.2;

            scores.push({ intent: SimIntent.SOCIALIZE, score: socialScore });
        }

        // B. 娱乐 (Fun)
        if (sim.needs[NeedType.Fun] < 70) {
            let funScore = (100 - sim.needs[NeedType.Fun]) * 1.2;
            if (sim.ageStage === AgeStage.Child) funScore *= 1.5; // 小孩只知道玩
            if (sim.traits.includes('爱玩')) funScore *= 1.3;
            scores.push({ intent: SimIntent.FUN, score: funScore });
        }

        // C. 个人目标/技能 (Self-Actualization)
        // 基于 LifeGoal 和 职业
        let goalScore = 10 + (sim.mood / 5); // 心情好才想努力
        if (sim.lifeGoal.includes('富翁')) goalScore += 20; // 想赚钱，可能会去触发 side_hustle (归类为 FUN 或 WORK)
        
        // 如果有特定的 buff 激发灵感
        if (sim.hasBuff('inspired')) goalScore += 30;
        
        // 简单归类为 FUN (如画画) 或 WORK，这里我们引入一个新的意图: IMPROVE_SKILL
        // 为了兼容现有 Types，暂时归入 FUN，但在 plan 阶段会优先找技能物品
        if (sim.mbti.includes('N') || sim.traits.includes('天才')) {
             scores.push({ intent: SimIntent.FUN, score: goalScore, meta: 'skill_building' }); 
        }

        // === 5. 排序与决策 ===
        scores.sort((a, b) => b.score - a.score);
        
        // [调试]
        // console.log(`[${sim.name}] Intent Scores:`, scores.map(s => `${s.intent}(${Math.round(s.score)})`).join(', '));

        const best = scores[0];
        
        // 兜底：如果实在没分 (都满状态)，就闲逛
        if (!best || best.score < 15) return SimIntent.WANDER;

        // 特殊处理：如果选中的是 FULFILL_NEED，记录下是哪个需求，方便 plan
        if (best.intent === SimIntent.FULFILL_NEED && best.meta) {
            sim['currentNeedType'] = best.meta; // 临时存在 sim 上传给 plan 用，或者扩展 planForIntent 参数
        }
        
        // 特殊处理：如果是 FUN 且想练技能
        if (best.intent === SimIntent.FUN && best.meta === 'skill_building') {
            sim['funPreference'] = 'skill'; 
        } else {
            sim['funPreference'] = 'any';
        }

        return best.intent;
    },

    /**
     * 🗺️ [战术规划器] 将意图分解为行动队列
     * 负责具体的寻路、物品查找、交互序列生成。
     */
    planForIntent(sim: Sim, intent: SimIntent): QueuedAction[] {
        const queue: QueuedAction[] = [];
        
        // 辅助：快速添加移动+交互
        const addInteractSequence = (target: Furniture, interactionKey: string, desc: string) => {
            const { anchor } = getInteractionPos(target);
            queue.push({
                type: 'WALK',
                targetPos: anchor,
                targetId: target.id,
                desc: `走向: ${desc}`
            });
            queue.push({
                type: 'INTERACT',
                targetId: target.id,
                interactionKey: interactionKey,
                desc: `正在: ${desc}`
            });
        };

        switch (intent) {
            case SimIntent.SURVIVE:
            case SimIntent.SATISFY_HUNGER:
            case SimIntent.FULFILL_NEED:
            case SimIntent.SLEEP:
                // 确定具体需求类型
                let needType = NeedType.Hunger;
                if (intent === SimIntent.SATISFY_HUNGER) needType = NeedType.Hunger;
                else if (intent === SimIntent.SLEEP) needType = NeedType.Energy;
                else if (intent === SimIntent.SURVIVE) {
                    // 找出最危急的
                    const needs = [NeedType.Energy, NeedType.Hunger, NeedType.Bladder, NeedType.Hygiene];
                    needType = needs.sort((a, b) => sim.needs[a] - sim.needs[b])[0];
                } else if (sim['currentNeedType']) {
                    needType = sim['currentNeedType'];
                }

                // 查找物品策略
                let searchTags: string[] = [];
                let actionVerb = 'use';

                if (needType === NeedType.Hunger) {
                    // 1. 优先找剩饭/做好的饭 (暂未实现物品库存，先跳过)
                    // 2. 如果会做饭且有食材 -> 找炉灶 (cooking)
                    // 3. 如果没食材但有钱 -> 找冰箱 (buy_food/cooking) / 叫外卖 / 去餐厅
                    if (sim.skills.cooking > 20 && sim.hasFreshIngredients) {
                        searchTags = ['stove', 'cooking'];
                        actionVerb = 'cooking';
                    } else if (sim.money > 50) {
                        searchTags = ['eat_out', 'buy_food', 'hunger', 'fridge'];
                        actionVerb = 'eat'; // 泛指，具体由 InteractionRegistry 处理
                    } else {
                        searchTags = ['hunger', 'fridge']; // 找便宜的
                    }
                } else if (needType === NeedType.Energy) {
                    // 优先回家睡床，其次沙发
                    searchTags = ['energy', 'bed', 'nap_crib', 'sofa', 'bench'];
                    actionVerb = 'sleep';
                } else if (needType === NeedType.Bladder) {
                    searchTags = ['bladder', 'toilet'];
                    actionVerb = 'use_toilet';
                } else if (needType === NeedType.Hygiene) {
                    searchTags = ['hygiene', 'shower', 'bathtub'];
                    actionVerb = 'shower';
                }

                // 执行查找
                const targetObj = this.findBestFurniture(sim, searchTags);
                
                if (targetObj) {
                    // 特殊：如果是去餐厅吃饭，可能需要更复杂的逻辑（如先走到座位，再点餐），这里简化为直接交互
                    // 如果是 Hunger 且找到的是 Stove，动作设为 cooking
                    if (needType === NeedType.Hunger && (targetObj.utility === 'cooking' || targetObj.label.includes('灶'))) {
                        actionVerb = 'cooking';
                    }
                    else if (needType === NeedType.Hunger && targetObj.utility === 'eat_out') {
                        actionVerb = 'eat_out';
                    }

                    addInteractSequence(targetObj, actionVerb, `${needType} @ ${targetObj.label}`);
                } else {
                    // 找不到物品的兜底
                    if (needType === NeedType.Energy) {
                        // 实在找不到床，原地睡地板 (Survival)
                         queue.push({
                            type: 'WAIT',
                            duration: 5000,
                            desc: '无处可去，原地打盹'
                        });
                        // 也可以直接加 energy
                        sim.say("太困了...💤", 'bad');
                    } else {
                        sim.say(`找不到地方解决 ${needType}`, 'bad');
                        queue.push({ type: 'WAIT', duration: 2000 });
                    }
                }
                break;

            case SimIntent.WORK:
                if ([AgeStage.Child, AgeStage.Teen].includes(sim.ageStage)) {
                    // 上学逻辑
                    // 1. 找到学校 Plot
                    const schoolPlot = GameStore.worldLayout.find(p => ['school', 'elementary_school', 'high_school'].some(t => (p.customType||'').includes(t)) || p.templateId.includes('school'));
                    if (schoolPlot) {
                         const enterX = schoolPlot.x + (schoolPlot.width||300)/2;
                         const enterY = schoolPlot.y + (schoolPlot.height||300)/2;
                         queue.push({
                             type: 'WALK',
                             targetPos: { x: enterX, y: enterY },
                             desc: '去学校'
                         });
                         // 到达后切换到 Schooling 状态 (这通常是一个持续状态，直到时间结束)
                         queue.push({
                             type: 'INTERACT',
                             interactionKey: 'school_attend', // 特殊 key
                             desc: '上课'
                         });
                    }
                } else if (sim.workplaceId) {
                    // 上班逻辑
                    const workPlot = GameStore.worldLayout.find(p => p.id === sim.workplaceId);
                    if (workPlot) {
                        queue.push({
                            type: 'WALK',
                            targetPos: { x: workPlot.x + 100, y: workPlot.y + 100 },
                            desc: '去上班'
                        });
                         queue.push({
                             type: 'INTERACT',
                             interactionKey: 'work_attend',
                             desc: '工作'
                         });
                    }
                }
                break;

            case SimIntent.SOCIALIZE:
                // 1. 寻找最佳目标 (优先爱人 -> 家人 -> 朋友)
                // 排除正在睡觉、工作、不在地图上的人
                const candidates = GameStore.sims.filter(s => 
                    s.id !== sim.id && 
                    !s.isTemporary && // 暂时不找路人 NPC
                    s.action !== SimAction.Sleeping && 
                    s.action !== SimAction.Working &&
                    s.action !== SimAction.Schooling
                );

                if (candidates.length > 0) {
                    // 评分排序
                    candidates.sort((a, b) => {
                        const relA = sim.relationships[a.id]?.friendship || 0;
                        const relB = sim.relationships[b.id]?.friendship || 0;
                        
                        let scoreA = relA;
                        let scoreB = relB;

                        // 优先找爱人
                        if (sim.partnerId === a.id) scoreA += 50;
                        if (sim.partnerId === b.id) scoreB += 50;

                        // 优先找家人
                        if (sim.familyId === a.familyId) scoreA += 20;
                        if (sim.familyId === b.familyId) scoreB += 20;
                        
                        // 距离越近越好
                        const distA = Math.hypot(a.pos.x - sim.pos.x, a.pos.y - sim.pos.y);
                        const distB = Math.hypot(b.pos.x - sim.pos.x, b.pos.y - sim.pos.y);
                        scoreA -= distA * 0.05;
                        scoreB -= distB * 0.05;

                        return scoreB - scoreA;
                    });

                    const targetSim = candidates[0];
                    // 社交序列
                    // 注意：这里我们生成的是静态的 targetPos。
                    // 实际执行时 'WALK' 动作如果指定了 targetId，Execute 逻辑应该动态获取对方位置。
                    queue.push({
                        type: 'WALK',
                        targetId: targetSim.id,
                        targetPos: targetSim.pos, // 初始位置作为参考
                        desc: `去找 ${targetSim.name}`
                    });
                    
                    // 交互类型：取决于关系
                    let socialKey = 'chat';
                    if (sim.partnerId === targetSim.id && Math.random() > 0.5) socialKey = 'kiss';
                    else if ((sim.relationships[targetSim.id]?.friendship || 0) < 0) socialKey = 'argue';

                    queue.push({
                        type: 'INTERACT',
                        targetId: targetSim.id,
                        interactionKey: socialKey,
                        desc: '社交互动'
                    });
                } else {
                    sim.say("找不到人聊天...", 'sys');
                    queue.push({ type: 'WAIT', duration: 2000 });
                }
                break;

            case SimIntent.FUN:
                // 区分是 "练技能" 还是 "纯玩"
                let funTypes = ['fun', 'tv', 'computer', 'game', 'bookshelf'];
                if (sim['funPreference'] === 'skill') {
                    // 针对性格/职业选择技能设施
                    funTypes = ['art', 'chess', 'piano', 'gym', 'bookshelf', 'computer'];
                }
                
                const funObj = this.findBestFurniture(sim, funTypes);
                if (funObj) {
                    let verb = 'play';
                    // 根据物品 utility 映射具体的 interactionKey
                    if (funObj.utility === 'art' || funObj.label.includes('画')) verb = 'paint';
                    else if (funObj.utility === 'gym' || funObj.label.includes('跑步')) verb = 'run';
                    else if (funObj.label.includes('琴')) verb = 'play_instrument';
                    else if (funObj.label.includes('棋')) verb = 'play_chess';
                    else if (funObj.label.includes('书')) verb = 'read_book';
                    else if (funObj.label.includes('电视')) verb = 'cinema_';
                    
                    addInteractSequence(funObj, verb, '娱乐');
                } else {
                    // 找不到好玩的，就闲逛
                    queue.push({ type: 'WALK', desc: '散步' }); // 此处 WALK 没目标，会被解析为随机游荡
                }
                break;

            case SimIntent.WANDER:
            default:
                // 随机移动
                queue.push({
                    type: 'WALK',
                    desc: '闲逛'
                });
                break;
        }

        return queue;
    },

    // 辅助：执行队列中的下一个动作
    executeNextAction(sim: Sim) {
        const action = sim.popNextAction();
        if (!action) {
            sim.currentIntent = SimIntent.IDLE;
            return;
        }

        // console.log(`${sim.name} 执行: ${action.type} - ${action.desc}`);

        switch (action.type) {
            case 'WALK':
                if (action.targetId) {
                    // 如果是追人/找物体，再次确认目标是否存在/位置更新
                    // 对于人：
                    const targetSim = GameStore.sims.find(s => s.id === action.targetId);
                    if (targetSim) {
                        sim.target = { ...targetSim.pos }; // 更新为最新位置
                        sim.interactionTarget = { type: 'human', ref: targetSim }; // 预设交互目标
                    } 
                    // 对于物体：
                    else {
                        const targetObj = GameStore.furniture.find(f => f.id === action.targetId);
                        if (targetObj) {
                            const { anchor } = getInteractionPos(targetObj);
                            sim.target = anchor;
                            sim.interactionTarget = targetObj;
                        } else if (action.targetPos) {
                            sim.target = action.targetPos;
                        }
                    }
                } else if (action.targetPos) {
                    sim.target = action.targetPos;
                } else {
                    // 没目标 = 闲逛
                    sim.startWandering();
                    return;
                }
                
                sim.startMovingToInteraction();
                break;

            case 'INTERACT':
                if (action.targetId && action.interactionKey) {
                    // 区分是对人还是对物
                    const targetSim = GameStore.sims.find(s => s.id === action.targetId);
                    const targetObj = GameStore.furniture.find(f => f.id === action.targetId);
                    
                    if (targetSim) {
                        // 面对面
                        sim.target = null; // 停止移动
                        // 简单处理：如果是 kiss/chat 等，触发 interactionRegistry
                        // 注意：这里需要你的 InteractionSystem 支持 'chat' 等 key
                        // 如果暂不支持，回退到原来的 SocialLogic 调用
                        sim.interactionTarget = { type: 'human', ref: targetSim };
                        sim.enterInteractionState(action.interactionKey); // 这里假设 InteractionState 能处理 key
                    } else if (targetObj) {
                        sim.target = null;
                        sim.interactionTarget = targetObj;
                        
                        // 特殊 case 处理
                        if (action.interactionKey === 'work_attend') {
                            sim.changeState(new WorkingState());
                        } else if (action.interactionKey === 'school_attend') {
                            sim.changeState(new SchoolingState());
                        } else {
                            sim.enterInteractionState(action.interactionKey);
                        }
                    }
                }
                break;
            
            case 'WAIT':
                sim.changeState(new WaitingState()); // 需确保 WaitingState 会在一段时间后自动 finishAction
                sim.actionTimer = action.duration || 2000;
                break;
        }
    },


    isCareerSkill(sim: Sim, skillKey: string): boolean {
        const type = sim.job.companyType;
        if (!type || type === JobType.Unemployed) return false;
        
        const map: Record<string, string[]> = {
            [JobType.Internet]: ['logic', 'coding'],
            [JobType.Design]: ['creativity', 'paint'],
            [JobType.Business]: ['charisma', 'logic', 'eq'],
            [JobType.Store]: ['charisma', 'eq'],
            [JobType.Restaurant]: ['cooking'],
            [JobType.Nightlife]: ['music', 'dancing', 'charisma'],
            [JobType.Hospital]: ['logic', 'constitution'],
            [JobType.School]: ['logic', 'charisma'],
            [JobType.Library]: ['logic', 'writing'],
            [JobType.ElderCare]: ['constitution', 'eq']
        };
        return map[type]?.some(k => skillKey.includes(k)) || false;
    },

    isGoalSkill(sim: Sim, skillKey: string): boolean {
        const goal = sim.lifeGoal;
        if (goal.includes('富翁') || goal.includes('大亨')) return ['logic', 'charisma'].includes(skillKey);
        if (goal.includes('艺术') || goal.includes('设计') || goal.includes('制作人')) return ['creativity', 'music', 'painting'].includes(skillKey);
        if (goal.includes('黑客') || goal.includes('大牛')) return ['logic', 'coding'].includes(skillKey);
        if (goal.includes('健身') || goal.includes('长生')) return ['athletics', 'constitution'].includes(skillKey);
        if (goal.includes('主厨') || goal.includes('美食')) return ['cooking'].includes(skillKey);
        if (goal.includes('万人迷') || goal.includes('领袖')) return ['charisma'].includes(skillKey);
        return false;
    },

    triggerHungerBroadcast(sim: Sim) {
        const potentialCaregivers = GameStore.sims.filter(s => 
            s.id !== sim.id && 
            s.action !== SimAction.FeedBaby && 
            s.health > 20 &&
            (
                // 1. 父母 (无视地点，只要活着且不是婴儿/幼儿)
                ((s.id === sim.fatherId || s.id === sim.motherId) && ![AgeStage.Infant, AgeStage.Toddler].includes(s.ageStage)) ||
                
                // 2. 保姆 (必须在家且同住址 - 依然受限)
                (sim.homeId && s.homeId === sim.homeId && s.isAtHome() && s.job.id === 'nanny') ||
                
                // 3. 同住成年亲属 (必须在家)
                (sim.homeId && s.homeId === sim.homeId && s.isAtHome() && s.ageStage >= AgeStage.Adult && s.familyId === sim.familyId)
            )
        );

        const candidates = potentialCaregivers.map(candidate => {
            let score = 0;
            if (candidate.isTemporary && candidate.job.id === 'nanny') score += 100;
            if (candidate.id === sim.fatherId || candidate.id === sim.motherId) score += 50;
            
            // 距离越近越好
            const dist = Math.sqrt(Math.pow(candidate.pos.x - sim.pos.x, 2) + Math.pow(candidate.pos.y - sim.pos.y, 2));
            score -= dist * 0.05; // 加大距离惩罚，优先选身边的父母
            
            // 如果父母正在工作，给予极大的负分惩罚，让他们尽量别翘班
            if (candidate.action === SimAction.Working || candidate.action === SimAction.Commuting) score -= 1000;

            if (candidate.action === SimAction.Idle || candidate.action === SimAction.Wandering) score += 30;
            return { sim: candidate, score };
        });

        // 过滤掉太远或太忙的 (负分)
        const validCandidates = candidates.filter(c => c.score > -50).sort((a, b) => b.score - a.score);

        const best = validCandidates[0];
        if (best) {
            const caregiver = best.sim;
            caregiver.finishAction();
            caregiver.interactionTarget = null;
            caregiver.target = null;
            caregiver.path = [];
            caregiver.changeState(new FeedBabyState(sim.id));
            
            sim.say("哇！🍼", 'family');
            sim.changeState(new WaitingState());
            return true;
        }

        // === [新增修复] 紧急保姆召唤逻辑 ===
        // 如果上面找不到合适的人（父母都在上班，且家里没其他人），自动召唤保姆
        if (sim.homeId) {
            // 检查是否已经有保姆在路上了（避免重复召唤）
            const existingNanny = GameStore.sims.find(s => s.homeId === sim.homeId && s.job.id === 'nanny');
            
            if (!existingNanny) {
                GameStore.spawnNanny(sim.homeId, 'home_care');
                sim.say("呜呜... (等待保姆)", 'sys');
                sim.changeState(new WaitingState());
                return true; // 视为已处理
            }
        }
        // ====================================

        return false;
    },

    // [新增] 呼叫洗澡逻辑
    triggerHygieneBroadcast(sim: Sim) {
        // 1. 检查家里有没有洗澡设施 (淋浴或浴缸)
        const hasShower = GameStore.furniture.some(f => f.homeId === sim.homeId && (f.utility === 'shower' || f.utility === 'hygiene'));
        if (!hasShower) {
            sim.say("家里没澡盆...", 'bad');
            return false;
        }

        // 2. 寻找合适的照顾者（优先保姆，其次父母，最后亲戚）
        const potentialCaregivers = GameStore.sims.filter(s => 
            s.id !== sim.id && 
            s.ageStage >= AgeStage.Adult && // 必须是成年人
            s.homeId === sim.homeId && 
            s.isAtHome() &&
            (s.job.id === 'nanny' || s.familyId === sim.familyId) &&
            // 只能打断空闲、闲逛或保姆工作状态
            (s.action === SimAction.Idle || s.action === SimAction.Wandering || s.action === SimAction.NannyWork)
        );

        if (potentialCaregivers.length > 0) {
            // 排序：保姆 > 父母 > 其他
            potentialCaregivers.sort((a, b) => {
                let scoreA = a.job.id === 'nanny' ? 100 : 0;
                let scoreB = b.job.id === 'nanny' ? 100 : 0;
                if (a.id === sim.motherId || a.id === sim.fatherId) scoreA += 50;
                if (b.id === sim.motherId || b.id === sim.fatherId) scoreB += 50;
                return scoreB - scoreA;
            });

            const caregiver = potentialCaregivers[0];
            
            // 3. 触发行为
            caregiver.finishAction(); // 打断大人当前行为
            caregiver.changeState(new BatheBabyState(sim.id)); // 对应下一步在 SimStates 里新建的类
            
            sim.say("洗澡澡! 🛁", 'sys');
            sim.changeState(new WaitingState()); // 宝宝原地等待
            return true;
        }
        return false;
    },    

    // === 🧠 核心决策函数 ===
    decideAction(sim: Sim) {
        // 1. 婴幼儿特殊保护逻辑 (保持你原有的修复，优先级最高)
        if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
             // 检查紧急需求，如果需要呼救，直接打断所有计划
             if (sim.needs[NeedType.Hunger] < 40) {
                 if (this.triggerHungerBroadcast(sim)) { sim.clearPlan(); return; }
             }
             if (sim.needs[NeedType.Hygiene] < 40) {
                 if (this.triggerHygieneBroadcast(sim)) { sim.clearPlan(); return; }
             }
             // 防止幼儿离家出走
             if (!sim.isAtHome() && sim.homeId && sim.action === SimAction.Idle) {
                 // 简单的自动回家指令
                 sim.setPlan(SimIntent.SURVIVE, [{
                     type: 'WALK',
                     targetPos: sim.getHomeLocation() || {x:0,y:0},
                     desc: '回家'
                 }]);
             }
        }

        // 2. 如果当前有计划队列，且处于空闲状态，执行下一步
        if (sim.hasPlan() && sim.action === SimAction.Idle) {
            this.executeNextAction(sim);
            return;
        }

        // 3. 如果正在忙 (Working, Sleeping, etc.)，除非发生紧急状况，否则不打断
        // (紧急状况打断逻辑通常在 NeedsLogic.checkHealth 或外部事件中处理，这里只负责空闲时的决策)
        if (sim.action !== SimAction.Idle && sim.action !== SimAction.Wandering) {
            return;
        }

        // 4. 处于空闲状态，生成新意图
        // 增加一个简单的冷却时间，避免每帧都思考，模拟“发呆”
        sim.decisionTimer = (sim.decisionTimer || 0) - 1;
        if (sim.decisionTimer > 0) return;
        sim.decisionTimer = 60; // 每 60 帧思考一次

        // A. 评估意图
        const intent = this.evaluateBestIntent(sim);
        
        // B. 生成计划
        const plan = this.planForIntent(sim, intent);
        
        // C. 应用计划
        if (plan.length > 0) {
            sim.setPlan(intent, plan);
            this.executeNextAction(sim); // 立即执行第一步
        } else {
            // 如果没生成计划（比如找不到东西），则随机闲逛一会
            sim.startWandering();
        }
    },

    // [修复] 返回 boolean 表示是否成功找到并开始执行
    findSideHustle(sim: Sim): boolean {
        let options: { type: string; target: Furniture }[] = [];

        if (sim.skills.logic > 5 || sim.skills.creativity > 5) {
            let pcs = GameStore.furniture.filter(f => f.label.includes('电脑') && (!f.reserved || f.reserved === sim.id));
            pcs = pcs.filter(f => !DecisionLogic.isRestricted(sim, f));
            if (pcs.length > 0) {
                const netCafePcs = pcs.filter(p => p.label.includes('网吧'));
                const homePcs = pcs.filter(p => !p.label.includes('网吧'));
                if (sim.money > 100 && netCafePcs.length > 0 && Math.random() > 0.4) options.push({ type: 'pc', target: netCafePcs[Math.floor(Math.random() * netCafePcs.length)] });
                else if (homePcs.length > 0) options.push({ type: 'pc', target: homePcs[Math.floor(Math.random() * homePcs.length)] });
                else if (pcs.length > 0) options.push({ type: 'pc', target: pcs[Math.floor(Math.random() * pcs.length)] });
            }
        }
        
        let lake = GameStore.furnitureIndex.get('fishing')?.[0]; 
        if (lake) options.push({ type: 'lake', target: lake });

        let flowers = GameStore.furnitureIndex.get('gardening') || [];
        flowers = flowers.filter(f => !DecisionLogic.isRestricted(sim, f));
        if (flowers.length > 0) options.push({ type: 'garden', target: flowers[Math.floor(Math.random() * flowers.length)] });

        if (options.length > 0) {
            let best = options[Math.floor(Math.random() * options.length)];
            const { anchor } = getInteractionPos(best.target);
            sim.target = anchor;
            sim.interactionTarget = best.target;
            sim.isSideHustle = true; 
            sim.startMovingToInteraction();
            return true;
        }
        return false;
    },
    

    // [修复] 返回 boolean，移除自动闲逛
    findObject(sim: Sim, type: string): boolean {
        // 🆕 辅助函数：统一价格检查逻辑
        const canAfford = (sim: Sim, f: Furniture) => {
            let estimatedCost = f.cost || 0;
            
            // 补充隐形消费的价格（必须 >= interactionRegistry 中的判定值）
            if (estimatedCost === 0) {
                switch (f.utility) {
                    case 'eat_out': estimatedCost = 60; break;
                    case 'buy_food': estimatedCost = 20; break;
                    case 'buy_drink': estimatedCost = 5; break;
                    case 'buy_book': estimatedCost = 60; break;
                    case 'buy_item': estimatedCost = 50; break;
                    case 'gardening': estimatedCost = 5; break; // 种子
                    case 'paint': estimatedCost = 20; break; // 颜料
                    case 'cooking': 
                        // 做饭特判：有食材就免费，没食材要花钱买菜
                        if (!sim.hasFreshIngredients) estimatedCost = 20; 
                        break;
                }
            }

            // 1. 绝对买不起
            if (estimatedCost > sim.money) return false;

            // 2. 穷困潦倒保护：如果钱很少(<20)，且不是快饿死(<10)，不要去消费，尽量找免费的
            if (sim.money < 20 && estimatedCost > 0) {
                // 如果是极度饥饿，允许饥不择食（只要买得起）
                if (sim.needs.hunger > 10) return false;
            }

            return true;
        };
        let utility = type;
        const simpleMap: Record<string, string> = {
             [NeedType.Hunger]: 'hunger', [NeedType.Bladder]: 'bladder', [NeedType.Hygiene]: 'hygiene', [NeedType.Energy]: 'energy',
             'healing': 'healing', cooking: 'cooking', gardening: 'gardening', fishing: 'fishing', art: 'art', play: 'play',
             practice_speech: 'practice_speech', play_chess: 'play_chess', play_instrument: 'play_instrument', paint: 'paint', gym_run: 'run',
             'computer_play': 'work', // 映射到电脑(通常utility是work)，但在 interactionRegistry 里我们做了区分
             'read_book': 'bookshelf',
             'watch_tv': 'cinema_', // 假设电视和电影院共用逻辑，或者根据实际家具 utility 填写
        };
        if (simpleMap[type]) utility = simpleMap[type];

        let candidates: Furniture[] = [];

        // 策略填充 candidates (代码保持原样，省略以节省空间，逻辑不变)...
        if (type === 'healing') candidates = GameStore.furnitureIndex.get('healing') || [];
        else if (type === NeedType.Fun) {
             const funTypes = ['fun', 'cinema_2d', 'cinema_3d', 'art', 'play', 'fishing', 'dance', 'play_chess'];
             if (sim.needs[NeedType.Energy] < 50) funTypes.push('comfort');
             funTypes.forEach(t => { 
                 const list = GameStore.furnitureIndex.get(t); 
                 if (list) candidates = candidates.concat(list); 
             });
        }
        else if (type === 'gym_run' || type === 'gym') {
             ['run', 'lift', 'stretch', 'dance'].forEach(u => { const list = GameStore.furnitureIndex.get(u); if (list) candidates = candidates.concat(list); });
        }
        else if (type === NeedType.Energy) {
             candidates = candidates.concat(GameStore.furnitureIndex.get('energy') || []);
             // [修复] 搜寻精力设施时，同时也搜寻婴儿床，确保通用逻辑能找到它
             candidates = candidates.concat(GameStore.furnitureIndex.get('nap_crib') || []);
             if (sim.needs[NeedType.Energy] < 30) candidates = candidates.concat(GameStore.furnitureIndex.get('comfort') || []);
        }
        else if (type === NeedType.Hunger) {
            if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                candidates = candidates.concat(GameStore.furnitureIndex.get('hunger') || []);
                // [新增] 婴儿也可以尝试奶瓶/厨房 (逻辑在 interactionRegistry 细化，这里先扩大搜索范围)
            } else {
                candidates = candidates.concat(GameStore.furnitureIndex.get('hunger') || []); 
                candidates = candidates.concat(GameStore.furnitureIndex.get('eat_out') || []); 
                candidates = candidates.concat(GameStore.furnitureIndex.get('buy_drink') || []);
                candidates = candidates.concat(GameStore.furnitureIndex.get('buy_food') || []); 
            }
        } 
        else if (type === NeedType.Hygiene) {
             candidates = candidates.concat(GameStore.furnitureIndex.get('hygiene') || []);
             candidates = candidates.concat(GameStore.furnitureIndex.get('shower') || []);
        } 
        else if (type === NeedType.Bladder) {
             candidates = candidates.concat(GameStore.furnitureIndex.get('bladder') || []);
             if (candidates.length === 0) candidates = candidates.concat((GameStore.furnitureIndex.get('comfort') || []).filter(f => f.label.includes('马桶')));
        } 
        else {
            candidates = GameStore.furnitureIndex.get(utility) || [];
        }

        // [核心修改] 优先回家逻辑 & 流浪汉处理
        // [核心修改] 优先回家逻辑 & 门禁 & 封校
        const basicNeeds = [NeedType.Hunger, NeedType.Energy, NeedType.Bladder, NeedType.Hygiene];
        let forceHome = false;
        let limitToCurrentPlot = false; // 新增：强制限制在当前地块（用于学校/监狱等）

        // 只有当有家的时候才考虑强制回家
        if (sim.homeId) {
            const currentPlot = GameStore.worldLayout.find(p => sim.pos.x >= p.x && sim.pos.x <= p.x + (p.width||300) && sim.pos.y >= p.y && sim.pos.y <= p.y + (p.height||300));
            
            // 1. 婴幼儿逻辑 (保持之前的修复)
            if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                const isInKindergarten = currentPlot && (currentPlot.customType === 'kindergarten' || (PLOTS[currentPlot.templateId] && PLOTS[currentPlot.templateId].type === 'kindergarten'));
                if (!isInKindergarten) forceHome = true;
                else limitToCurrentPlot = true; // 在幼儿园里就只能用幼儿园的东西
            } 
            
            // 2. 儿童及青少年特殊逻辑 (新增)
            else if ([AgeStage.Child, AgeStage.Teen].includes(sim.ageStage)) {
                const isNight = GameStore.time.hour >= 21 || GameStore.time.hour < 6;
                const isSchoolTime = GameStore.time.hour >= 8 && GameStore.time.hour < 16;
                const isInSchool = currentPlot && ['school', 'elementary_school', 'high_school'].some(t => (currentPlot.customType || '').includes(t));

                // [修复 A] 门禁系统：儿童深夜必须回家，禁止去网吧/公园
                if (sim.ageStage === AgeStage.Child && isNight) {
                    forceHome = true;
                }
                // [修复 B] 封校系统：上课期间如果在学校，禁止去校外找东西（防止逃课去买饭）
                else if (isSchoolTime && isInSchool) {
                    limitToCurrentPlot = true;
                }
                // [原有逻辑] 基础需求优先回家，但在校/在职期间除外
                else if (basicNeeds.includes(type as NeedType)) {
                     // 只有当“不在”学校且“不在”工作岗位时，才强制回家找吃的/睡的
                     // 如果在学校，上面 limitToCurrentPlot 已经处理了，或者允许在校内解决
                     if (!isInSchool && !(sim.workplaceId && currentPlot && currentPlot.id === sim.workplaceId)) {
                        forceHome = true;
                     }
                }
            }

            // 3. 成人逻辑
            else if (basicNeeds.includes(type as NeedType)) {
                const isAtWork = sim.workplaceId && currentPlot && currentPlot.id === sim.workplaceId;
                if (!isAtWork) forceHome = true;
            }
        }

        if (candidates.length) {
            // 获取当前地块信息（为了 limitToCurrentPlot）
            const currentPlot = limitToCurrentPlot ? GameStore.worldLayout.find(p => sim.pos.x >= p.x && sim.pos.x <= p.x + (p.width||300) && sim.pos.y >= p.y && sim.pos.y <= p.y + (p.height||300)) : null;

            let validCandidates = candidates.filter((f: Furniture)=> {
                // 1. 权限
                if (DecisionLogic.isRestricted(sim, f)) return false;
                
                // 2. 回家优先
                if (forceHome && f.homeId !== sim.homeId) return false;

                // [新增] 区域锁定 (防止逃课/越狱)
                if (limitToCurrentPlot && currentPlot) {
                    // 检查物品是否在当前地块内
                    const inPlot = f.x >= currentPlot.x && f.x <= currentPlot.x + (currentPlot.width||300) &&
                                   f.y >= currentPlot.y && f.y <= currentPlot.y + (currentPlot.height||300);
                    if (!inPlot) return false;
                }
                
                // [新增] 流浪汉逻辑：如果没有家，且是基础需求，优先找公共设施 (无 homeId 的家具)
                if (!sim.homeId && basicNeeds.includes(type as NeedType)) {
                    // 如果家具有主，流浪汉不能用 (避免闯入别人家)
                    // 注意：isRestricted 已经处理了大部分“私宅”判断，这里是双重保险
                    if (f.homeId) return false;
                }

                // 3. 经济
                //if (type === NeedType.Hunger && sim.money < 20 && estimatedCost > 0 && sim.needs[NeedType.Hunger] > 10) return false;
                if (!canAfford(sim, f)) return false;
                // 4. 占用
                if (f.reserved && f.reserved !== sim.id) return false;
                if (!f.multiUser) {
                    const isOccupied = GameStore.sims.some(s => s.id !== sim.id && s.interactionTarget?.id === f.id);
                    if (isOccupied) return false;
                }
                
                // 5. 婴幼儿允许项
                if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                    // [优化] 增加 'fun' (通用娱乐) 和 'comfort' (沙发)，防止家里没玩具时宝宝无聊死
                    const allowed = ['energy', 'nap_crib', 'play', 'play_blocks', 'hunger', 'bladder', 'hygiene', 'fun', 'comfort'];
                    if (!allowed.includes(f.utility) && !f.tags?.includes('baby')) return false;
                    if (f.tags?.includes('stove') || f.tags?.includes('gym') || f.tags?.includes('computer')) return false;
                    
                    // [关键修改] 如果无家可归，允许使用公共 crib
                    if (!sim.homeId && f.utility === 'nap_crib' && !f.homeId) return true;
                }
                return true;
            });

            // 兜底：如果强制回家导致没找到，尝试公共设施
            // [修复] 增加年龄判断：如果是婴幼儿，严禁触发兜底逻辑去外面找东西，找不到就找不到（会触发发呆或哭闹），坚决不能自己出门
            if (validCandidates.length === 0 && forceHome && ![AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                validCandidates = candidates.filter((f: Furniture) => {
                    if (DecisionLogic.isRestricted(sim, f)) return false;
                    if (f.homeId && f.homeId !== sim.homeId) return false; 
                    
                    // 3. 经济 (同样替换为新函数)
                    if (!canAfford(sim, f)) return false; 
                    
                    if (f.reserved && f.reserved !== sim.id) return false;
                    if (!f.multiUser && GameStore.sims.some(s => s.id !== sim.id && s.interactionTarget?.id === f.id)) return false;
                    return true;
                });
            }

            candidates = validCandidates;

            if (candidates.length) {
                candidates.sort((a, b) => {
                    const distA = Math.pow(a.x - sim.pos.x, 2) + Math.pow(a.y - sim.pos.y, 2);
                    const distB = Math.pow(b.x - sim.pos.x, 2) + Math.pow(b.y - sim.pos.y, 2);
                    return distA - distB;
                });
                
                let poolSize = (type === NeedType.Fun || type === 'play') ? 10 : 3;
                let obj = candidates[Math.floor(Math.random() * Math.min(candidates.length, poolSize))];
                
                const { anchor } = getInteractionPos(obj);
                sim.target = anchor;
                sim.interactionTarget = obj;
                sim.startMovingToInteraction();
                return true; // 成功
            }
        }
        return false; // 失败
    },

    // [修复] 返回 boolean
    findHuman(sim: Sim): boolean {
        let others = GameStore.sims.filter(s => s.id !== sim.id && s.action !== SimAction.Sleeping && s.action !== SimAction.Working);
        others.sort(() => Math.random() - 0.5); 
        
        others.sort((a, b) => {
            let relA = (sim.relationships[a.id]?.friendship || 0);
            let relB = (sim.relationships[b.id]?.friendship || 0);
            return relB - relA; 
        });

        if (others.length) {
            const bestRel = sim.relationships[others[0].id]?.friendship || 0;
            let poolSize = bestRel < 20 ? 10 : 3;
            poolSize = Math.min(others.length, poolSize);

            let partner = others[Math.floor(Math.random() * poolSize)];
            
            if (DecisionLogic.isRestricted(sim, partner.pos)) return false;

            const angle = Math.random() * Math.PI * 2;
            sim.target = { 
                x: partner.pos.x + Math.cos(angle) * 40, 
                y: partner.pos.y + Math.sin(angle) * 40 
            };
            sim.interactionTarget = { type: 'human', ref: partner };
            sim.startMovingToInteraction();
            return true;
        }
        return false;
    },

    /**
     * 🔍 [辅助] 查找最佳家具对象 (不修改 Sim 状态，只返回对象)
     * 从原 findObject 逻辑提取重构
     */
    findBestFurniture(sim: Sim, utilityTypes: string[]): Furniture | null {
        let candidates: Furniture[] = [];
        
        // 1. 收集所有候选家具
        utilityTypes.forEach(type => {
            const list = GameStore.furnitureIndex.get(type);
            if (list) candidates = candidates.concat(list);
        });

        if (candidates.length === 0) return null;

        // 2. 筛选逻辑 (权限、距离、金钱)
        const validCandidates = candidates.filter(f => {
            if (this.isRestricted(sim, f)) return false;
            
            // 简单的金钱检查
            if ((f.cost || 0) > sim.money) return false;

            // 占用检查
            if (f.reserved && f.reserved !== sim.id) return false;
            if (!f.multiUser && GameStore.sims.some(s => s.id !== sim.id && s.interactionTarget?.id === f.id)) return false;

            return true;
        });

        if (validCandidates.length === 0) return null;

        // 3. 排序 (距离优先)
        validCandidates.sort((a, b) => {
            const distA = Math.pow(a.x - sim.pos.x, 2) + Math.pow(a.y - sim.pos.y, 2);
            const distB = Math.pow(b.x - sim.pos.x, 2) + Math.pow(b.y - sim.pos.y, 2);
            return distA - distB;
        });

        return validCandidates[0]; // 返回最近的一个
    },
    
    
};

