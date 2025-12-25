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
    // 移除周末检查，只要在工作时间内就是上班时间
    return hour >= sim.job.startHour && hour < sim.job.endHour;
};

// 辅助：判断是否是学校时间
const isSchoolTime = (sim: Sim): boolean => {
    if (![AgeStage.Child, AgeStage.Teen].includes(sim.ageStage)) return false;
    const hour = GameStore.time.hour;
    // 移除周末检查，每天都要上学
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
     * 🧠 [核心大脑] 意图评估系统 (透明化版)
     * 深度集成：MBTI、性格特质、情绪状态、职业野心、生理周期、环境时间
     * 🟢 新增：决策归因 (Reasoning) - 让 AI 能够解释 "为什么要这样做"
     */
    evaluateBestIntent(sim: Sim): SimIntent {
        // --- 0. 感知上下文 (Perception Context) ---
        // 修改 scores 定义，加入 reason 字段
        const scores: { intent: SimIntent, score: number, meta?: any, reason: string }[] = [];
        
        const hour = GameStore.time.hour;
        const day = GameStore.time.totalDays % 7; // 0-6 (假设0是周日)
        const isWeekend = day === 0 || day === 6; 
        const isNight = hour >= 22 || hour < 6;
        const isSleeping = sim.action === SimAction.Sleeping;

        // MBTI 解析
        const isExtravert = sim.mbti.startsWith('E'); 
        const isIntrovert = sim.mbti.startsWith('I'); 
        const isIntuitive = sim.mbti[1] === 'N';      
        // const isFeeling = sim.mbti[2] === 'F';
        // const isThinking = sim.mbti[2] === 'T';
        const isJudging = sim.mbti[3] === 'J';        
        // const isPerceiving = sim.mbti[3] === 'P';     

        // --- 1. 生存本能 (Survival) - 绝对最高优先级 ---
        // 每一个判断都附带具体的 reason 字符串
        if (sim.needs[NeedType.Hunger] < 15) {
            scores.push({ intent: SimIntent.SURVIVE, score: 500, reason: "⚠️ 极度饥饿 (Hunger < 15)" });
        }
        if (sim.needs[NeedType.Energy] < 10) {
            scores.push({ intent: SimIntent.SURVIVE, score: 600, reason: "⚠️ 极度疲劳 (Energy < 10)" });
        }
        if (sim.health < 50) {
            scores.push({ intent: SimIntent.SURVIVE, score: 800, reason: "🚑 健康危急 (Health < 50)" });
        }
        if (sim.needs[NeedType.Bladder] < 15) {
            scores.push({ intent: SimIntent.FULFILL_NEED, score: 550, meta: NeedType.Bladder, reason: "🚽 膀胱要炸了 (Bladder < 15)" });
        }
        
        // 如果有生存危机，立即返回最高分项，并记录原因
        if (scores.length > 0) {
            scores.sort((a, b) => b.score - a.score);
            const emergency = scores[0];
            // 如果已经在睡觉且还是困，保持睡觉意图 (特殊处理)
            if (isSleeping && sim.needs[NeedType.Energy] < 90 && emergency.intent === SimIntent.SURVIVE && sim.needs[NeedType.Energy] < 10) {
                 sim.lastDecisionReason = "💤 实在太困了，继续补觉";
                 return SimIntent.SLEEP;
            }
            sim.lastDecisionReason = emergency.reason; // 写入决策原因
            if (emergency.meta) sim['currentNeedType'] = emergency.meta;
            return emergency.intent; 
        }

        // --- 2. 刚性日程 (Schedule) ---
        let scheduleScore = 0;
        let scheduleReason = "";
        
        // 计算勤奋度
        let diligence = 1.0;
        let diligenceNotes: string[] = [];
        if (isJudging) { diligence += 0.2; diligenceNotes.push("J人"); }
        if (sim.traits.includes('勤奋')) { diligence += 0.2; diligenceNotes.push("勤奋"); }
        if (sim.traits.includes('懒惰')) { diligence -= 0.3; diligenceNotes.push("懒惰"); }
        
        // [特殊场景] 周一综合症
        const isMondayMorning = day === 1 && hour >= 6 && hour <= 9;
        if (isMondayMorning && sim.traits.includes('懒惰')) {
            diligence -= 0.5;
            diligenceNotes.push("周一厌班");
        }

        // 上班检查
        if (isWorkTime(sim) && !sim.hasLeftWorkToday) {
             if (sim.action === SimAction.Working) {
                 scheduleScore = 1000;
                 scheduleReason = "正在工作中...";
             } else {
                 scheduleScore = 300 * diligence;
                 scheduleReason = `工作时间 (勤奋系数: ${diligence.toFixed(1)})`;
                 if (diligenceNotes.length) scheduleReason += ` [${diligenceNotes.join('/')}]`;
             }
             scores.push({ intent: SimIntent.WORK, score: scheduleScore, reason: scheduleReason });
        }
        
        // 上学检查
        if (isSchoolTime(sim) && [AgeStage.Child, AgeStage.Teen].includes(sim.ageStage)) {
             if (sim.action === SimAction.Schooling) {
                 scheduleScore = 1000;
                 scheduleReason = "正在上课...";
             } else {
                 scheduleScore = 350;
                 scheduleReason = "上学时间 (强制)";
             }
             scores.push({ intent: SimIntent.WORK, score: scheduleScore, reason: scheduleReason });
        }

        // --- 3. 生理需求 (Needs) ---
        
        // A. 饥饿
        if (sim.needs[NeedType.Hunger] < 60) {
            let hungerScore = (100 - sim.needs[NeedType.Hunger]) * 2.5;
            let reasonParts = [`饥饿值(${Math.floor(sim.needs[NeedType.Hunger])})`];
            
            if (sim.traits.includes('吃货')) { 
                hungerScore *= 1.5; 
                reasonParts.push("[吃货]加成"); 
            }
            if ([7, 8, 12, 13, 18, 19].includes(hour)) { 
                hungerScore += 50; 
                reasonParts.push("饭点"); 
            }
            
            // 穷人忍耐
            if (sim.money < 50 && sim.needs[NeedType.Hunger] > 30 && !sim.traits.includes('吃货')) {
                hungerScore *= 0.5;
                reasonParts.push("没钱忍耐中");
            }

            scores.push({ intent: SimIntent.SATISFY_HUNGER, score: hungerScore, reason: reasonParts.join(' + ') });
        }

        // B. 困倦
        if (sim.needs[NeedType.Energy] < 40 || (isNight && sim.needs[NeedType.Energy] < 70)) {
            let sleepScore = (100 - sim.needs[NeedType.Energy]) * 2.0;
            let reasonParts = [`精力值(${Math.floor(sim.needs[NeedType.Energy])})`];

            if (isNight) {
                sleepScore += 100;
                reasonParts.push("深夜时刻");
            }
            
            if (sim.traits.includes('夜猫子') && hour >= 23) {
                sleepScore -= 60;
                reasonParts.push("[夜猫子]不想睡");
            }
            if (sim.traits.includes('夜猫子') && hour >= 4 && hour < 7) {
                sleepScore += 150;
                reasonParts.push("[夜猫子]熬不住了");
            }

            if (isSleeping && sim.needs[NeedType.Energy] < 95) {
                sleepScore += 500;
                reasonParts.push("还没睡醒");
            }
            
            scores.push({ intent: SimIntent.SLEEP, score: sleepScore, reason: reasonParts.join(' + ') });
        }

        // C. 卫生
        if (sim.needs[NeedType.Bladder] < 40) {
            scores.push({ 
                intent: SimIntent.FULFILL_NEED, 
                score: (100 - sim.needs[NeedType.Bladder]) * 3.5, 
                meta: NeedType.Bladder, 
                reason: `内急 (${Math.floor(sim.needs[NeedType.Bladder])})` 
            });
        }
        if (sim.needs[NeedType.Hygiene] < 30) {
            let hygieneScore = (100 - sim.needs[NeedType.Hygiene]) * 2.0;
            let reasonStr = `卫生差 (${Math.floor(sim.needs[NeedType.Hygiene])})`;
            
            if (sim.traits.includes('洁癖')) {
                hygieneScore *= 2.0;
                reasonStr += " + [洁癖]抓狂";
            }
            if (sim.traits.includes('邋遢')) {
                hygieneScore *= 0.5;
                reasonStr += " + [邋遢]无所谓";
            }
            
            scores.push({ intent: SimIntent.FULFILL_NEED, score: hygieneScore, meta: NeedType.Hygiene, reason: reasonStr });
        }

        // --- 4. 欲望与自我实现 (Desires) ---

        // A. 社交
        if (sim.needs[NeedType.Social] < 50) {
            let socialScore = (100 - sim.needs[NeedType.Social]);
            let reasonStr = `社交需求 (${Math.floor(sim.needs[NeedType.Social])})`;
            
            if (isExtravert) { socialScore *= 1.5; reasonStr += " + [E人]"; }
            if (isIntrovert) { socialScore *= 0.6; reasonStr += " + [I人]"; }
            if (sim.traits.includes('独行侠')) { socialScore *= 0.3; reasonStr += " + [独行侠]"; }
            if (sim.traits.includes('粘人精')) { socialScore *= 1.8; reasonStr += " + [粘人精]"; }

            // [特殊触发器] 寻找爱情
            const isSingle = !sim.partnerId;
            const isAdult = [AgeStage.Teen, AgeStage.Adult, AgeStage.MiddleAged].includes(sim.ageStage);
            const desiresLove = sim.lifeGoal.includes('爱') || sim.traits.includes('浪漫主义') || (Math.random() < 0.05);
            
            if (isSingle && isAdult && desiresLove) {
                scores.push({ 
                    intent: SimIntent.SOCIALIZE, 
                    score: socialScore + 60, 
                    meta: 'seek_romance',
                    reason: "💘 单身太久，渴望爱情 (特殊)" 
                });
            } else {
                 scores.push({ intent: SimIntent.SOCIALIZE, score: socialScore, reason: reasonStr });
            }

            // [特殊触发器] 周末派对
            if (isWeekend && hour >= 20 && [AgeStage.Teen, AgeStage.Adult].includes(sim.ageStage)) {
                if (sim.traits.includes('派对动物') || (isExtravert && Math.random() > 0.3)) {
                    scores.push({
                        intent: SimIntent.SOCIALIZE,
                        score: 200,
                        meta: 'party',
                        reason: "🎉 周末派对时间！"
                    });
                }
            }
        }

        // B. 娱乐与成长
        if (sim.needs[NeedType.Fun] < 40) {
            let funScore = (100 - sim.needs[NeedType.Fun]);
            let baseReason = `无聊 (${Math.floor(sim.needs[NeedType.Fun])})`;

            if (sim.ageStage === AgeStage.Child) { funScore *= 1.5; baseReason += " + [儿童]贪玩"; }
            if (sim.traits.includes('爱玩')) { funScore *= 1.3; baseReason += " + [爱玩]"; }

            // [情境分支 1] 摆烂
            if (sim.mood < 30) {
                scores.push({
                    intent: SimIntent.FUN,
                    score: funScore + 40, 
                    meta: 'passive_fun',
                    reason: "☁️ 心情低落，只想躺平 (抑郁模式)"
                });
            } 
            // [情境分支 2] 自我提升
            else if ((isIntuitive || sim.traits.includes('天才') || sim.traits.includes('书呆子')) && sim.mood > 60) {
                scores.push({
                    intent: SimIntent.FUN, 
                    score: funScore + 30,
                    meta: 'skill_building',
                    reason: "💡 灵感涌现，想学点什么 (进取模式)"
                });
            }
            // [情境分支 3] 搞钱
            else if (sim.traits.includes('工作狂') || sim.lifeGoal.includes('富翁')) {
                scores.push({
                    intent: SimIntent.FUN,
                    score: funScore + 20,
                    meta: 'side_hustle',
                    reason: "💰 休息时间也要搞钱 (工作狂)"
                });
            }
            else {
                scores.push({ intent: SimIntent.FUN, score: funScore, meta: 'any', reason: baseReason });
            }
        }

        // --- 5. 排序与决策 ---
        scores.sort((a, b) => b.score - a.score);
        
        const best = scores[0];
        
        // 兜底
        if (!best || best.score < 15) {
            sim.lastDecisionReason = "🍂 无所事事，随便逛逛";
            return SimIntent.WANDER;
        }

        // --- 6. 结果持久化 (关键：保存 Reason) ---
        // 格式化输出： "饥饿值(30) + [吃货]加成 (得分: 250)"
        sim.lastDecisionReason = `${best.reason} [Score: ${Math.floor(best.score)}]`;

        if (best.intent === SimIntent.FULFILL_NEED && best.meta) {
            sim['currentNeedType'] = best.meta as NeedType; 
        } else if (best.intent === SimIntent.SOCIALIZE) {
            sim['socialIntentMeta'] = best.meta || 'chat'; 
        } else if (best.intent === SimIntent.FUN) {
            sim['funPreference'] = best.meta || 'any';
        }

        return best.intent;
    },

    /**
     * 🗺️ [战术规划器] 将意图分解为行动队列 (Pro版 - 修复死循环)
     * 修复：加入“饥不择食”兜底逻辑，防止因性格偏好导致找不到物品而卡死。
     */
    planForIntent(sim: Sim, intent: SimIntent): QueuedAction[] {
        const queue: QueuedAction[] = [];
        
        // 辅助：快速添加移动+交互序列
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
            // === 1. 生存与生理需求 ===
            case SimIntent.SURVIVE:
            case SimIntent.SATISFY_HUNGER:
            case SimIntent.FULFILL_NEED:
            case SimIntent.SLEEP:
                // 确定具体需求类型
                let needType = NeedType.Hunger;
                if (intent === SimIntent.SATISFY_HUNGER) needType = NeedType.Hunger;
                else if (intent === SimIntent.SLEEP) needType = NeedType.Energy;
                else if (intent === SimIntent.SURVIVE) {
                    const needs = [NeedType.Energy, NeedType.Hunger, NeedType.Bladder, NeedType.Hygiene];
                    needType = needs.sort((a, b) => sim.needs[a] - sim.needs[b])[0];
                } else if (sim['currentNeedType']) {
                    needType = sim['currentNeedType'] as NeedType;
                }

                // 查找物品策略 (Tags)
                let searchTags: string[] = [];
                let actionVerb = 'use';

                // --- 🟢 [战术分支] 贫富与性格差异 ---
                const isSnob = sim.traits.includes('势利眼');     
                const isFrugal = sim.traits.includes('吝啬鬼') || sim.money < 50; 
                // ⚠️ 关键修正：如果是 SURVIVE 状态，意味着极度危险，此时忽略性格偏好
                const isDesperate = intent === SimIntent.SURVIVE || sim.needs[needType] < 15;

                if (needType === NeedType.Hunger) {
                    // 1. 优先找剩饭 (暂略)
                    
                    // 2. 策略分级
                    if (isDesperate) {
                        // 🚑 救命模式：什么都吃
                        searchTags = ['hunger', 'fridge', 'eat_out', 'buy_food', 'cooking', 'vending_machine']; 
                        actionVerb = 'eat';
                        sim.currentPlanDescription = "饿急了，饥不择食！🆘";
                    } else if (isSnob && sim.money > 200) {
                        searchTags = ['eat_out', 'restaurant', 'bar']; 
                        actionVerb = 'eat_out';
                        sim.currentPlanDescription = "势利眼：非高档餐厅不去 🍷";
                    } else if (sim.skills.cooking > 20 && sim.hasFreshIngredients) {
                        searchTags = ['stove', 'cooking']; 
                        actionVerb = 'cooking';
                        sim.currentPlanDescription = "大显身手：亲自下厨 🍳";
                    } else if (isFrugal) {
                        searchTags = ['fridge', 'vending_machine', 'hunger']; 
                        actionVerb = 'eat';
                        sim.currentPlanDescription = "省钱模式：吃点便宜的 🥡";
                    } else {
                        searchTags = ['hunger', 'fridge', 'eat_out', 'buy_food'];
                        actionVerb = 'eat';
                        sim.currentPlanDescription = "寻找最近的食物来源";
                    }
                } else if (needType === NeedType.Energy) {
                    if (isDesperate) {
                        searchTags = ['energy', 'bed', 'nap_crib', 'sofa', 'bench', 'chair'];
                        sim.currentPlanDescription = "困得不行，随便找地方睡";
                    } else if (isSnob) {
                        searchTags = ['bed', 'energy']; 
                        sim.currentPlanDescription = "回卧室休息 (只睡好床)";
                    } else {
                        searchTags = ['energy', 'bed', 'nap_crib', 'sofa', 'bench'];
                        sim.currentPlanDescription = "找地方补觉";
                    }
                    actionVerb = 'sleep';
                } else if (needType === NeedType.Bladder) {
                    searchTags = ['bladder', 'toilet'];
                    actionVerb = 'use_toilet';
                    sim.currentPlanDescription = "寻找卫生间";
                } else if (needType === NeedType.Hygiene) {
                    searchTags = ['hygiene', 'shower', 'bathtub'];
                    actionVerb = 'shower';
                    sim.currentPlanDescription = "去洗香香 🛁";
                }

                // 执行查找
                let targetObj = this.findBestFurniture(sim, searchTags);
                
                // 🟢 [兜底重试机制] 如果按偏好没找到，且不是救命模式，尝试全局搜索
                if (!targetObj && !isDesperate && needType === NeedType.Hunger) {
                     // 比如吝啬鬼没找到冰箱，那就只能去餐厅了，总比饿死强
                     targetObj = this.findBestFurniture(sim, ['hunger', 'fridge', 'eat_out', 'buy_food', 'cooking']);
                     if (targetObj) sim.currentPlanDescription = "没找到便宜的，只好破费了...";
                }

                if (targetObj) {
                    // 动态动词修正
                    if (needType === NeedType.Hunger && (targetObj.utility === 'cooking' || targetObj.label.includes('灶'))) actionVerb = 'cooking';
                    else if (needType === NeedType.Hunger && targetObj.utility === 'eat_out') actionVerb = 'eat_out';

                    addInteractSequence(targetObj, actionVerb, `${needType} @ ${targetObj.label}`);
                } else {
                    // 🔴 最终兜底：真的全图都找不到
                    if (needType === NeedType.Energy) {
                         // 睡地板逻辑
                         sim.currentPlanDescription = "无处可去，原地昏睡";
                         queue.push({ type: 'WAIT', duration: 10000, desc: '原地打盹' });
                         sim.say("太困了...直接睡地板吧 💤", 'bad');
                         // 这里建议直接回复一点体力，防止死循环
                         sim.needs[NeedType.Energy] += 10; 
                    } else {
                        sim.say(`附近没有解决 ${needType} 的设施!`, 'bad');
                        // 缩短等待时间，尽快重试或触发其他逻辑
                        queue.push({ type: 'WAIT', duration: 2000 });
                        sim.currentPlanDescription = `资源枯竭: ${needType}`;
                    }
                }
                break;

            // === 2. 工作与上学 (保持不变) ===
            case SimIntent.WORK:
                sim.currentPlanDescription = "履行社会责任";
                if ([AgeStage.Child, AgeStage.Teen].includes(sim.ageStage)) {
                    const schoolPlot = GameStore.worldLayout.find(p => ['school', 'elementary_school', 'high_school'].some(t => (p.customType||'').includes(t)) || p.templateId.includes('school'));
                    if (schoolPlot) {
                         const enterX = schoolPlot.x + (schoolPlot.width||300)/2;
                         const enterY = schoolPlot.y + (schoolPlot.height||300)/2;
                         queue.push({ type: 'WALK', targetPos: { x: enterX, y: enterY }, desc: '去学校' });
                         queue.push({ type: 'INTERACT', interactionKey: 'school_attend', desc: '上课' });
                         sim.currentPlanDescription = "去学校上课 🏫";
                    }
                } else if (sim.workplaceId) {
                    const workPlot = GameStore.worldLayout.find(p => p.id === sim.workplaceId);
                    if (workPlot) {
                        queue.push({ type: 'WALK', targetPos: { x: workPlot.x + 100, y: workPlot.y + 100 }, desc: '去上班' });
                         queue.push({ type: 'INTERACT', interactionKey: 'work_attend', desc: '工作' });
                         sim.currentPlanDescription = "去公司搬砖 💼";
                    }
                }
                break;

            // === 3. 社交 (Social) (保持不变) ===
            case SimIntent.SOCIALIZE:
                // ... (复用之前的代码) ...
                const socialType = sim['socialIntentMeta'] || 'chat';
                let candidates = GameStore.sims.filter(s => s.id !== sim.id && !s.isTemporary && !['sleeping', 'working', 'schooling', 'commuting'].includes(s.action as string));
                // 🆕 [新增] 婴幼儿社交限制：只允许找家里人或身边的人
                if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                    candidates = candidates.filter(target => {
                        // 1. 同住址且对方也在家
                        if (sim.homeId && target.homeId === sim.homeId && target.isAtHome()) return true;
                        
                        // 2. 或者距离非常近 (例如都在幼儿园房间里，或者父母抱着)
                        const dist = Math.hypot(target.pos.x - sim.pos.x, target.pos.y - sim.pos.y);
                        if (dist < 300) return true; // 300像素范围内

                        return false;
                    });

                    // 如果没找到合适的人，强制发呆，防止乱跑
                    if (candidates.length === 0) {
                        sim.say("没人陪我玩...", 'sys');
                        sim.currentPlanDescription = "孤单地发呆";
                        queue.push({ type: 'WAIT', duration: 3000 });
                        return queue;
                    }
                }
                if (socialType === 'seek_romance') {
                    sim.currentPlanDescription = "雷达扫描：寻找单身异性 💕";
                    candidates = candidates.filter(target => {
                        let match = true;
                        if (sim.orientation === 'hetero') match = target.gender !== sim.gender;
                        else if (sim.orientation === 'homo') match = target.gender === sim.gender;
                        const ageDiff = Math.abs(target.age - sim.age);
                        const isAdult = target.ageStage >= AgeStage.Teen;
                        const notFamily = target.familyId !== sim.familyId;
                        const isSingle = !target.partnerId;
                        return match && ageDiff < 15 && isAdult && notFamily && isSingle;
                    });
                    
                    if (candidates.length > 0) {
                         candidates.sort((a, b) => (b.appearanceScore || 50) - (a.appearanceScore || 50));
                         const target = candidates[0];
                         queue.push({ type: 'WALK', targetId: target.id, targetPos: target.pos, desc: `被 ${target.name} 吸引` });
                         queue.push({ type: 'INTERACT', targetId: target.id, interactionKey: 'flirt', desc: '搭讪' }); 
                         return queue;
                    } else {
                        sim.say("周围没有心动的人...", 'sys');
                        sim.currentPlanDescription = "没找到真爱，随便聊聊";
                    }
                }

                if (candidates.length > 0) {
                    candidates.sort((a, b) => {
                        const relA = sim.relationships[a.id]?.friendship || 0;
                        const relB = sim.relationships[b.id]?.friendship || 0;
                        let scoreA = relA, scoreB = relB;
                        if (sim.mbti.startsWith('I')) { scoreA += (relA > 20 ? 50 : 0); }
                        else { scoreA += (relA < 10 ? 20 : 0); }
                        const distA = Math.hypot(a.pos.x - sim.pos.x, a.pos.y - sim.pos.y);
                        const distB = Math.hypot(b.pos.x - sim.pos.x, b.pos.y - sim.pos.y);
                        return (scoreB - distB*0.1) - (scoreA - distA*0.1);
                    });
                    const targetSim = candidates[0];
                    queue.push({ type: 'WALK', targetId: targetSim.id, targetPos: targetSim.pos, desc: `去找 ${targetSim.name}` });
                    queue.push({ type: 'INTERACT', targetId: targetSim.id, interactionKey: 'chat', desc: '聊天' });
                } else {
                    sim.say("找不到人...", 'sys');
                    sim.currentPlanDescription = "举目无亲，孤独...";
                    queue.push({ type: 'WAIT', duration: 2000 });
                }
                break;

            // === 4. 娱乐与自我实现 (Fun) (保持不变) ===
            case SimIntent.FUN:
                const funPref = sim['funPreference'] || 'any';
                let funTypes: string[] = [];
                let funVerb = 'play';

                if (funPref === 'passive_fun') {
                    funTypes = ['tv', 'sofa', 'bed', 'bench', 'cinema_2d', 'bookshelf']; 
                    sim.currentPlanDescription = "只想躺平 (低能量模式) ☁️";
                } else if (funPref === 'skill_building') {
                    funTypes = ['art', 'chess', 'piano', 'gym', 'computer', 'bookshelf'];
                    sim.currentPlanDescription = "自我提升：练点技能 📈";
                } else if (funPref === 'side_hustle') {
                    funTypes = ['computer', 'work_station', 'painting'];
                    sim.currentPlanDescription = "搞点副业赚外快 💰";
                } else {
                    funTypes = ['fun', 'tv', 'computer', 'game', 'bookshelf', 'art', 'gym'];
                    if (sim.needs[NeedType.Energy] < 50) funTypes.push('comfort');
                    sim.currentPlanDescription = "寻找好玩的东西 🎮";
                }
                
                const funObj = this.findBestFurniture(sim, funTypes);
                
                if (funObj) {
                    if (funObj.utility === 'art' || funObj.label.includes('画')) funVerb = 'paint';
                    else if (funObj.utility === 'gym' || funObj.label.includes('跑')) funVerb = 'run';
                    else if (funObj.label.includes('琴')) funVerb = 'play_instrument';
                    else if (funObj.label.includes('棋')) funVerb = 'play_chess';
                    else if (funObj.label.includes('书')) funVerb = 'read_book';
                    else if (funObj.label.includes('电脑')) funVerb = funPref === 'side_hustle' ? 'work_coding' : 'play_game'; 

                    addInteractSequence(funObj, funVerb, '娱乐');
                } else {
                    // [核心修复] 婴幼儿找不到乐子时，原地玩耍/哭闹，严禁乱跑
                    if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                        queue.push({ type: 'WAIT', duration: 5000, desc: '发呆' });
                        sim.currentPlanDescription = "好无聊... (发呆)";
                        if (Math.random() > 0.7) sim.say("咿呀...", 'sys');
                    } else {
                        queue.push({ type: 'WALK', desc: '散步' }); 
                        sim.currentPlanDescription = "没东西玩，散散步";
                    }
                }
                break;

            case SimIntent.WANDER:
                default:
                    // [核心修复] 婴幼儿禁止闲逛
                    if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                         queue.push({ type: 'WAIT', duration: 5000, desc: '发呆' });
                         sim.currentPlanDescription = "发呆";
                    } else {
                        queue.push({ type: 'WALK', desc: '闲逛' });
                        sim.currentPlanDescription = "四处游荡";
                    }
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
                        // 🛑 [修复] 婴幼儿追人防暴走检查
                        if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                            // 1. 如果目标跑太远了 (>500px)，放弃追逐
                            const dist = Math.hypot(targetSim.pos.x - sim.pos.x, targetSim.pos.y - sim.pos.y);
                            if (dist > 500) {
                                sim.say("追不上...", 'sys');
                                sim.currentIntent = SimIntent.IDLE;
                                return;
                            }
                            // 2. 如果目标已经不在家了（且宝宝本来是在家的），放弃追逐
                            if (sim.isAtHome() && !targetSim.isAtHome()) {
                                sim.say("别跑呀...", 'sys');
                                sim.currentIntent = SimIntent.IDLE;
                                return;
                            }
                        }

                        sim.target = { ...targetSim.pos }; // 更新为最新位置
                        sim.interactionTarget = { type: 'human', ref: targetSim }; 
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
                        sim.startInteraction();
                    } else if (targetObj) {
                        sim.target = null;
                        sim.interactionTarget = targetObj;
                        
                        // 特殊 case 处理
                        if (action.interactionKey === 'work_attend') {
                            sim.changeState(new WorkingState());
                        } else if (action.interactionKey === 'school_attend') {
                            sim.changeState(new SchoolingState());
                        } else {
                            sim.startInteraction();
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
        // 🟢 [新增] 幼儿园老师检查
        // 如果孩子在幼儿园区域，且是上学时间，寻找同区域的老师
        if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
            const currentPlot = GameStore.worldLayout.find(p => 
                sim.pos.x >= p.x && sim.pos.x <= p.x + (p.width||300) &&
                sim.pos.y >= p.y && sim.pos.y <= p.y + (p.height||300)
            );
            
            if (currentPlot && (currentPlot.customType === 'kindergarten' || PLOTS[currentPlot.templateId]?.type === 'kindergarten')) {
                // 寻找在此地块工作的老师
                const teachers = GameStore.sims.filter(s => 
                    s.workplaceId === currentPlot.id && 
                    s.action === SimAction.Working && // 老师必须在上班
                    s.ageStage >= AgeStage.Adult
                );
                
                if (teachers.length > 0) {
                    const teacher = teachers[0]; // 随便找一个老师
                    teacher.finishAction();
                    teacher.changeState(new FeedBabyState(sim.id)); // 让老师去喂
                    sim.say("老师饿饿...🍼", 'sys');
                    sim.changeState(new WaitingState());
                    return true;
                }
            }
        }

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
             if (sim.needs[NeedType.Hunger] < 30) {
                 if (this.triggerHungerBroadcast(sim)) { sim.clearPlan(); return; }
             }
             if (sim.needs[NeedType.Hygiene] < 30) {
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
        // 🆕 [新增] 婴幼儿禁止搞副业
        if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) return false;
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
                // 检查是否正在工作
                const isAtWork = sim.workplaceId && currentPlot && currentPlot.id === sim.workplaceId;
                
                if (isAtWork) {
                    // 🟢 [修复] 如果人在公司，且是上班时间，严禁跑出去吃饭！
                    // 必须强制限制在当前地块(公司)内寻找设施(如公司食堂/厕所)
                    limitToCurrentPlot = true; 
                    
                    // 如果是娱乐需求(摸鱼)，也只能在公司内部找(如休息室)
                    if (type === NeedType.Fun) limitToCurrentPlot = true;
                } else {
                    // 不在公司，则强制回家找
                    forceHome = true;
                }
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
                // [新增] 婴幼儿强制居家逻辑 (防止独自外出找乐子)
                if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                    // 如果宝宝有家，只允许找家里的 (防止跑去邻居家或公园)
                    if (sim.homeId) {
                        if (f.homeId !== sim.homeId) {
                            // 如果已经在幼儿园(或外面)，且东西就在身边(距离<500)，允许使用
                            // 否则一律只许用家里的
                            const dist = Math.hypot(f.x - sim.pos.x, f.y - sim.pos.y);
                            if (!f.homeId && dist < 500) return true; // 公共设施且很近 -> 允许
                            return false; 
                        }
                    } else {
                        // 无家可归的宝宝：只允许找身边的，不准跨图跑
                        const dist = Math.hypot(f.x - sim.pos.x, f.y - sim.pos.y);
                        if (dist > 500) return false;
                    }
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
        // 🆕 [新增] 婴幼儿寻人限制
        if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
            others = others.filter(target => {
                if (sim.homeId && target.homeId === sim.homeId && target.isAtHome()) return true;
                const dist = Math.hypot(target.pos.x - sim.pos.x, target.pos.y - sim.pos.y);
                return dist < 300;
            });
        }
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
     * 🔍 [辅助] 查找最佳家具对象 (Pro版)
     * 具备“性格感知”和“情境感知”的智能评分系统
     */
    findBestFurniture(sim: Sim, utilityTypes: string[]): Furniture | null {
        let candidates: Furniture[] = [];
        
        // 1. 收集所有候选家具
        utilityTypes.forEach(type => {
            const list = GameStore.furnitureIndex.get(type);
            if (list) candidates = candidates.concat(list);
        });

        if (candidates.length === 0) return null;

        // --- 0. 准备上下文 ---
        // 预计算一些状态，避免在循环中重复计算
        const isUrgent = sim.needs[NeedType.Bladder] < 20 || sim.needs[NeedType.Hunger] < 15 || sim.needs[NeedType.Energy] < 10;
        const isSnob = sim.traits.includes('势利眼');
        const isGeek = sim.traits.includes('极客') || sim.traits.includes('书呆子');
        const isActive = sim.traits.includes('运动');
        const isLazy = sim.traits.includes('懒惰');
        const isLoner = sim.traits.includes('独行侠');
        
        // 2. 筛选逻辑 (硬性过滤)
        const validCandidates = candidates.filter(f => {
            // 🛑 [核心修复] 婴幼儿严禁独自出门：只能使用家里的东西
            if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                if (sim.homeId) {
                    // 如果有家，必须是家里的物品 (严禁跑去邻居家或公园)
                    if (f.homeId !== sim.homeId) return false;
                } else {
                    // 如果无家可归(极少见)，只准选身边的物品 (500px范围)，防止横穿地图
                    const distSq = (f.x - sim.pos.x)**2 + (f.y - sim.pos.y)**2;
                    if (distSq > 250000) return false; 
                }
            }
            // 🛑 [新增修复] 幼儿禁止使用成人危险设施
            if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                // 禁止健身
                if (['gym', 'run', 'lift', 'treadmill'].some(k => f.utility.includes(k))) return false;
                
                // 禁止玩电脑 (除非将来有儿童平板)
                if (f.label.includes('电脑') || f.utility.includes('computer') || f.utility === 'work') return false;
                
                // 禁止玩火/做饭
                if (f.utility === 'cooking' || f.utility === 'stove') return false;
            }
            // 🛑 [新增修复] 成人/青少年禁止使用婴儿床
            if (f.utility === 'nap_crib' && ![AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                return false;
            }
            // A. 权限检查 (核心)
            if (this.isRestricted(sim, f)) return false;
            
            // B. 经济检查 (买不起的别看)
            // 注意：某些公共设施 cost 为 0，但 interactionRegistry 里可能有扣费，这里只检查标价
            if ((f.cost || 0) > sim.money) return false;

            // C. 占用检查
            if (f.reserved && f.reserved !== sim.id) return false;
            if (!f.multiUser) {
                // 检查是否有人正在用 (InteractionTarget 指向它)
                const isOccupied = GameStore.sims.some(s => s.id !== sim.id && s.interactionTarget?.id === f.id);
                if (isOccupied) return false;
            }

            // D. 专用性检查
            // 电脑：如果是极客，只用高配电脑 (假设 label 区分)；如果是工作，必须用能工作的。
            // 这里暂且不做过细过滤，交给下面的评分系统
            
            return true;
        });

        if (validCandidates.length === 0) return null;

        // 3. 智能评分排序 (Smart Scoring)
        validCandidates.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;

            // --- 因子 1: 距离 (Distance) ---
            // 基础权重：越近分越高
            const distA = Math.hypot(a.x - sim.pos.x, a.y - sim.pos.y);
            const distB = Math.hypot(b.x - sim.pos.x, b.y - sim.pos.y);
            
            // 距离权重计算
            let distWeight = 0.5; // 默认权重
            if (isUrgent) distWeight = 5.0; // 尿急/饿昏时，距离就是一切
            if (isLazy) distWeight = 2.0;   // 懒人不想多走路

            scoreA -= distA * distWeight;
            scoreB -= distB * distWeight;

            // 如果非常紧急，基本只看距离，忽略下面花里胡哨的属性
            if (isUrgent) return scoreB - scoreA;

            // --- 因子 2: 物品等级/价格 (Tier/Cost) ---
            // 假设家具没有显式 tier 字段，用 cost 近似代替
            const costA = a.cost || 0;
            const costB = b.cost || 0;

            if (isSnob) {
                // 势利眼：喜欢贵的，讨厌便宜的
                scoreA += costA * 1.0; 
                scoreB += costB * 1.0;
            } else if (sim.money < 100) {
                // 穷人：优先选免费的
                if (costA === 0) scoreA += 500;
                if (costB === 0) scoreB += 500;
            }

            // --- 因子 3: 性格匹配 (Trait Matching) ---
            const matchTrait = (f: Furniture, keywords: string[], bonus: number) => {
                if (keywords.some(k => f.utility.includes(k) || f.label.includes(k))) return bonus;
                return 0;
            };

            // 极客/书呆子：爱电脑、书
            if (isGeek) {
                scoreA += matchTrait(a, ['computer', 'book', 'logic'], 100);
                scoreB += matchTrait(b, ['computer', 'book', 'logic'], 100);
                // 讨厌运动
                scoreA -= matchTrait(a, ['gym', 'sport', 'run'], 50);
                scoreB -= matchTrait(b, ['gym', 'sport', 'run'], 50);
            }

            // 运动狂：爱健身
            if (isActive) {
                scoreA += matchTrait(a, ['gym', 'sport', 'run', 'swim'], 150);
                scoreB += matchTrait(b, ['gym', 'sport', 'run', 'swim'], 150);
            }

            // --- 因子 4: 拥挤度/社交偏好 (Crowd/Privacy) ---
            // 独行侠不喜欢人多的地方
            if (isLoner) {
                // 简单的启发式：如果家具有 multiUser 标记（通常是沙发、长椅），独行侠会降低评分
                if (a.multiUser) scoreA -= 30;
                if (b.multiUser) scoreB -= 30;
            }

            // --- 因子 5: 舒适度与心情 (Mood) ---
            // 如果心情不好，优先找舒适度高的 (utility='comfort' 或 'bed')
            if (sim.mood < 40) {
                if (a.utility === 'comfort' || a.utility === 'bed') scoreA += 80;
                if (b.utility === 'comfort' || b.utility === 'bed') scoreB += 80;
            }

            return scoreB - scoreA; // 降序排列
        });

        // 引入一点随机性，避免永远只选分最高的那一个（增加行为多样性）
        // 取前 3 名，随机选一个 (如果是紧急情况，validCandidates 排序第一的通常是最近的，直接返回)
        if (isUrgent) return validCandidates[0];
        
        const topN = Math.min(validCandidates.length, 3);
        const bestCandidates = validCandidates.slice(0, topN);
        return bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
    },
    
    
};

