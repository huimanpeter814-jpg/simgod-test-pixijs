import type { Sim } from '../Sim'; 
import { GameStore } from '../simulation';
import { CONFIG } from '../../constants'; 
import { Furniture, SimAction, NeedType, AgeStage, JobType } from '../../types';
import { getInteractionPos } from '../simulationHelpers';
import { FeedBabyState, WaitingState, IdleState } from './SimStates';
import { PLOTS } from '../../data/plots'; // [关键] 引入 PLOTS

export const DecisionLogic = {
    /**
     * 核心权限检查：判断市民是否被禁止进入某目标区域/使用某物品
     * @param sim 市民对象
     * @param target 目标位置或家具对象
     * @returns true = 禁止进入 (Restricted), false = 允许 (Allowed)
     */
    isRestricted(sim: Sim, target: { x: number, y: number } | Furniture): boolean {
        // --- 1. 寻找目标所在的具体地块 (Plot) ---
        const plot = GameStore.worldLayout.find(p => 
            target.x >= p.x && target.x <= p.x + (p.width || 300) &&
            target.y >= p.y && target.y <= p.y + (p.height || 300)
        );

        // --- 2. 基于地皮类型的规则 ---
        // --- 2. 基于地皮类型的规则 (统一使用 Type 判断) ---
        if (plot) {
            // [修复] 获取准确的地块类型
            const plotTemplate = PLOTS[plot.templateId];
            const plotType = plot.customType || (plotTemplate ? plotTemplate.type : 'public');

            // [规则 A] 学校区域警戒 (Security)
            // 包含: kindergarten, elementary_school, high_school
            const schoolTypes = ['kindergarten', 'elementary_school', 'high_school'];
            const isSchool = schoolTypes.includes(plotType);
            
            // 幼儿园全天警戒，中小学限制教学时间
            const isKindergarten = plotType === 'kindergarten';
            const currentHour = GameStore.time.hour;
            const isSchoolTime = currentHour >= 8 && currentHour < 17;
            
            if (isSchool && (isSchoolTime || isKindergarten)) {
                // 1. 允许教职工
                if (sim.workplaceId === plot.id) return false;

                // 2. 允许家长任务
                const validParentActions = [SimAction.PickingUp, SimAction.Escorting, SimAction.Waiting, SimAction.FeedBaby];
                if (validParentActions.includes(sim.action as SimAction)) return false;

                // 3. 允许对应学龄的学生
                let isStudent = false;
                if (isKindergarten && [AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) isStudent = true;
                if (plotType === 'elementary_school' && sim.ageStage === AgeStage.Child) isStudent = true;
                if (plotType === 'high_school' && sim.ageStage === AgeStage.Teen) isStudent = true;
                
                if (isStudent) return false;

                // 🚫 其他人禁止入内
                return true;
            }

            // [规则 B] 成人娱乐场所 (Adult Only)
            // 包含: bar (夜店在 plots.ts 里 type 也是 bar)
            if (plotType === 'bar') {
                if ([AgeStage.Infant, AgeStage.Toddler, AgeStage.Child, AgeStage.Teen].includes(sim.ageStage)) {
                    return true;
                }
            }

            // [规则 C] 办公区域 (Workplace Security)
            // 限制非员工进入纯办公场所 (Internet, Business, Design)
            // 注意：Store, Restaurant, Library, Gym 是公共场所，不限制
            const privateOfficeTypes = ['internet', 'business', 'design'];
            
            if (privateOfficeTypes.includes(plotType)) {
                // 1. 允许该地块的员工
                if (sim.workplaceId === plot.id) return false;
                
                // 🚫 禁止非员工使用办公设施
                return true;
            }

            // [规则 D] 养老院/私人社区门禁
            if (plotType === 'elder_care') {
                const unit = GameStore.housingUnits.find(u => u.id === sim.homeId && u.id.startsWith(plot.id));
                if (unit) return false; // 住户
                if (sim.workplaceId === plot.id) return false; // 员工
                if (sim.job.id === 'nanny' && sim.isTemporary && sim.homeId && sim.homeId.startsWith(plot.id)) return false; // 保姆
                return true;
            }
        }

        // --- 3. 私宅归属权检查 (Private Property) ---
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
            const isOccupied = GameStore.sims.some(s => s.homeId === homeId);
            if (isOccupied) return true;
        }

        return false;
    },

    // 🆕 辅助：判断技能是否对职业有帮助
    isCareerSkill(sim: Sim, skillKey: string): boolean {
        const type = sim.job.companyType;
        // [修复] 增加 !type 检查，防止 undefined 报错
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

    // 🆕 辅助：判断技能是否符合人生目标
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

    // 🆕 婴儿饥饿广播系统
    triggerHungerBroadcast(sim: Sim) {
        if (!sim.homeId) return false;

        // 寻找潜在看护人：在同一房子里，且处于清醒/空闲/居家状态的成年人/老人
        const potentialCaregivers = GameStore.sims.filter(s => 
            s.id !== sim.id &&
            s.homeId === sim.homeId &&
            s.isAtHome() && // 必须在家
            (s.ageStage === AgeStage.Adult || s.ageStage === AgeStage.MiddleAged || s.ageStage === AgeStage.Elder) &&
            // 排除正在应对紧急情况的人 (例如也在被喂食，或者生病严重)
            s.action !== SimAction.FeedBaby && 
            s.health > 20
        );

        // 评分筛选：保姆优先，其次是父母/祖父母，再次是其他
        const candidates = potentialCaregivers.map(candidate => {
            let score = 0;
            
            // 保姆最高优先级
            if (candidate.isTemporary && candidate.job.id === 'nanny') score += 100;
            
            // 父母次之
            if (candidate.id === sim.fatherId || candidate.id === sim.motherId) score += 50;
            
            // 🆕 祖父母：如果是老人且是家庭成员
            if (candidate.ageStage === AgeStage.Elder && candidate.familyId === sim.familyId) {
                // 检查是否是直系祖父母 (如果是父母的父母)
                const father = GameStore.sims.find(p => p.id === sim.fatherId);
                const mother = GameStore.sims.find(p => p.id === sim.motherId);
                if ((father && (father.fatherId === candidate.id || father.motherId === candidate.id)) ||
                    (mother && (mother.fatherId === candidate.id || mother.motherId === candidate.id))) {
                    score += 60; // 隔代亲，权重甚至高于父母(忙碌时)
                } else {
                    score += 40; // 普通同住老人
                }
            }

            // 距离权重
            const dist = Math.sqrt(Math.pow(candidate.pos.x - sim.pos.x, 2) + Math.pow(candidate.pos.y - sim.pos.y, 2));
            score -= dist * 0.01;

            // 状态权重：闲着的人优先
            if (candidate.action === SimAction.Idle || candidate.action === SimAction.Wandering) score += 30;
            if (candidate.action === SimAction.Working) score -= 50; // 在家办公也不容易
            if (candidate.action === SimAction.Sleeping) score -= 20; // 睡觉会被吵醒，但权重甚至高于睡觉

            return { sim: candidate, score };
        });

        // 排序
        candidates.sort((a, b) => b.score - a.score);

        const best = candidates[0];
        if (best && best.score > 0) {
            const caregiver = best.sim;
            
            // [修复] 强制清理家长当前的所有交互
            caregiver.finishAction(); // 先清理旧状态
            caregiver.interactionTarget = null;
            caregiver.target = null;
            caregiver.path = [];
            
            // 切换到喂食状态
            caregiver.changeState(new FeedBabyState(sim.id));
            
            sim.say("哇！🍼 (饿了)", 'family');
            sim.changeState(new WaitingState());
            
            if (caregiver.action === SimAction.Sleeping) caregiver.say("哈欠...来了来了", 'normal');
            else caregiver.say("宝宝饿了吗？", 'family');
            
            return true;
        } else {
            sim.say("Waaaaaah!!! (没人理)", 'bad');
            return false;
        }
    },

    decideAction(sim: Sim) {
        // 🚨 1. 婴儿/幼儿特殊保护逻辑
        if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
            // 如果不在家，什么都不做，等待 PickingUpState (由父母/学校逻辑触发)
            if (!sim.isAtHome()) {
                if (sim.action !== SimAction.Waiting && sim.action !== SimAction.BeingEscorted) {
                    sim.say("我要回家...", 'bad');
                    sim.changeState(new WaitingState());
                }
                return; 
            }

            // 如果在家，只能做有限的事 (不能自己做饭，不能出门)
            if (sim.needs[NeedType.Hunger] < 50) {
                // 尝试呼叫喂食
                const success = this.triggerHungerBroadcast(sim);
                if (!success) sim.say("饿饿...🍼", 'bad');
                return;
            }

            if (sim.needs[NeedType.Energy] < 30) {
                // 自己找床睡 (仅限家里的婴儿床)
                this.findObject(sim, 'nap_crib'); 
                return;
            }

            if (sim.needs[NeedType.Fun] < 50) {
                // 玩积木 (家里)
                this.findObject(sim, 'play_blocks');
                return;
            }

            // 没事做就闲逛一下或者发呆
            if (Math.random() < 0.5) sim.startWandering();
            return;
        }

        // 1. 生存危机检查 (优先级最高)
        if (sim.health < 60 || sim.hasBuff('sick')) { DecisionLogic.findObject(sim, 'healing'); return; }


        let critical = [
            { id: NeedType.Energy, val: sim.needs[NeedType.Energy] },
            { id: NeedType.Hunger, val: sim.needs[NeedType.Hunger] },
            { id: NeedType.Bladder, val: sim.needs[NeedType.Bladder] },
            { id: NeedType.Hygiene, val: sim.needs[NeedType.Hygiene] }
        ].filter(n => n.val < 40); // 阈值

        if (critical.length > 0) {
            critical.sort((a, b) => a.val - b.val);
            DecisionLogic.findObject(sim, critical[0].id);
            return;
        }

        let scores: { id: string, score: number, type: string }[] = [];

        // 2. 基础生理需求评分 (非紧急状态)
        // 即使不紧急，如果不满也应该有基础分，随缺口线性增长
        scores.push({ id: NeedType.Energy, score: (100 - sim.needs[NeedType.Energy]) * 2.5, type: 'obj' });
        scores.push({ id: NeedType.Hunger, score: (100 - sim.needs[NeedType.Hunger]) * 2.0, type: 'obj' });
        scores.push({ id: NeedType.Bladder, score: (100 - sim.needs[NeedType.Bladder]) * 3.0, type: 'obj' });
        scores.push({ id: NeedType.Hygiene, score: (100 - sim.needs[NeedType.Hygiene]) * 1.5, type: 'obj' });
        
        // 娱乐需求：随性的人(P)更看重娱乐
        let funWeight = sim.mbti.includes('P') ? 1.5 : 1.0;
        scores.push({ id: NeedType.Fun, score: (100 - sim.needs[NeedType.Fun]) * funWeight, type: 'fun' });

        // 3. 社交需求评分
        let socialScore = (100 - sim.needs[NeedType.Social]) * 1.5;
        if (sim.mbti.startsWith('E')) socialScore *= 1.5; // 外向者更渴望社交
        else if (sim.mbti.startsWith('I')) socialScore *= 0.6; // 内向者较低
        
        // 孤独Buff加权
        if (sim.hasBuff('lonely')) socialScore += 50;
        // 恋爱脑加权
        if (sim.hasBuff('in_love') || sim.partnerId) socialScore += 20;
        
        scores.push({ id: NeedType.Social, score: socialScore, type: 'social' });

        // 4. 购物欲望
        // 快乐或有钱时想花钱
        // 🆕 [修复] 婴儿禁止购物
        if (![AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage) && sim.money > 500 && (sim.mood > 80 || sim.hasBuff('shopping_spree'))) { 
            scores.push({ id: 'buy_item', score: 40 + (sim.money / 200), type: 'obj' }); 
        }

        // 5. 赚钱/副业 (Side Hustle)
        if (sim.job.id === 'unemployed' && ![AgeStage.Infant, AgeStage.Toddler, AgeStage.Child].includes(sim.ageStage)) {
            let moneyDesire = 0;
            // 穷的时候迫切需要钱
            if (sim.money < 500) moneyDesire = 150; 
            else if (sim.money < 2000) moneyDesire = 80;
            else if (sim.lifeGoal.includes('富翁')) moneyDesire = 60; // 有钱也想更有钱
            
            // 能力加成
            if (sim.skills.coding > 10) moneyDesire += 20;
            if (sim.skills.creativity > 10) moneyDesire += 20;
            
            if (moneyDesire > 0) { scores.push({ id: 'side_hustle', score: moneyDesire, type: 'work' }); }
        }

        // === 🆕 6. 技能提升决策树 (Skill Improvement Logic) ===
        // [修复] 只有儿童及以上年龄段才会产生练习技能的欲望
        if (![AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
            for (let skillKey in sim.skills) {
                let skillDesire = 0;
                const currentLevel = sim.skills[skillKey];
                const talent = sim.skillModifiers[skillKey] || 1;

                // A. 性格驱动 (Personality Drive)
                // J型 (Judging): 规划性强，即使快乐也会提升自我
                if (sim.mbti.includes('J')) {
                    skillDesire += 25; 
                    // 心情好时，J型人更有动力自我提升 ("Maslow's Bonus")
                    if (sim.mood > 75) skillDesire += 20; 
                } else {
                    // P型: 随性，主要靠兴趣(Fun缺口)或突发灵感
                    if (sim.needs[NeedType.Fun] < 60) skillDesire += 15;
                }

                // MBTI 维度偏好
                if (sim.mbti.includes('N') && ['logic', 'creativity', 'charisma'].includes(skillKey)) skillDesire += 15;
                if (sim.mbti.includes('S') && ['athletics', 'cooking', 'gardening', 'fishing'].includes(skillKey)) skillDesire += 15;

                // B. 职业驱动 (Career Drive)
                if (DecisionLogic.isCareerSkill(sim, skillKey)) {
                    skillDesire += 30;
                    // 绩效压力：如果有工作且绩效不满，极其渴望提升
                    if (sim.workPerformance < 50 && sim.job.id !== 'unemployed') skillDesire += 40;
                    else if (sim.workPerformance < 100) skillDesire += 20;
                }

                // C. 目标驱动 (Goal Drive)
                if (DecisionLogic.isGoalSkill(sim, skillKey)) {
                    skillDesire += 30; // 梦想的力量
                }

                // D. 特质修正 (Trait Modifiers)
                if (sim.traits.includes('懒惰')) skillDesire -= 30; // 懒人即使有规划也不想动
                if (sim.traits.includes('活力') && skillKey === 'athletics') skillDesire += 40;
                if (sim.traits.includes('天才') && skillKey === 'logic') skillDesire += 30;
                if (sim.traits.includes('有创意') && skillKey === 'creativity') skillDesire += 30;
                if (sim.traits.includes('社恐') && skillKey === 'charisma') skillDesire -= 20;

                // E. 状态修正 (Condition)
                // 太累或太饿时，不想学习 (除非是工作狂 J + Career)
                if (sim.needs[NeedType.Energy] < 30 || sim.needs[NeedType.Hunger] < 30) {
                    skillDesire -= 50;
                }
                
                // F. 娱乐补偿 (Fun Factor)
                // 练习技能本身也能回复一定娱乐，所以缺娱乐时也会作为备选项
                // 但对于 J 型人，这部分权重降低，更看重上面的规划权重
                const funDeficit = 100 - sim.needs[NeedType.Fun];
                skillDesire += funDeficit * 0.3; 

                // 天赋倍率
                skillDesire *= talent;

                // 防止过度沉迷：如果技能已经很高，除非是完美主义者(J)，否则欲望稍降
                if (currentLevel > 90 && !sim.mbti.includes('J')) skillDesire *= 0.5;

                scores.push({ id: `skill_${skillKey}`, score: skillDesire, type: 'obj' });
            }
        }

        // 7. 特殊娱乐活动 (Cinema, Art, etc.)
        // 主要是为了快速回血 Fun
        // [修复] 只有儿童及以上才能看电影/看展
        if (sim.needs[NeedType.Fun] < 60 && ![AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
            if (sim.money > 100) {
                let cinemaScore = (100 - sim.needs[NeedType.Fun]) * 1.2;
                scores.push({ id: 'cinema_3d', score: cinemaScore, type: 'obj' });
            }
            
            // 艺术鉴赏
            if (sim.mbti.includes('N') || sim.traits.includes('有创意')) {
                scores.push({ id: 'art', score: (100 - sim.needs[NeedType.Fun]) * 1.5, type: 'obj' });
            }
        }

        // 8. 排序决策
        scores.sort((a, b) => b.score - a.score);
        
        // 增加随机性，避免永远选第一名 (Top 3 Weighted Random)
        const topCandidates = scores.slice(0, 3).filter(s => s.score > 25); // 阈值过滤，分数太低不如闲逛

        let choice = topCandidates.length > 0 
            ? topCandidates[Math.floor(Math.random() * topCandidates.length)] 
            : null;

        if (choice) {
            // 执行决策
            if (choice.id === NeedType.Social) DecisionLogic.findHuman(sim);
            else if (choice.id === 'side_hustle') DecisionLogic.findSideHustle(sim);
            else if (choice.id.startsWith('skill_')) {
                // 映射技能到具体动作/物品类型
                const skillName = choice.id.replace('skill_', '');
                let actionType = skillName;
                
                // 特殊映射
                if (skillName === 'charisma') actionType = 'practice_speech';
                if (skillName === 'logic') actionType = 'play_chess'; // 也可以是看书/电脑，findObject会处理泛型
                if (skillName === 'creativity') actionType = 'paint';
                if (skillName === 'music') actionType = 'play_instrument';
                if (skillName === 'athletics') actionType = 'gym_run'; // 或者 lift/stretch

                DecisionLogic.findObject(sim, actionType);
            }
            else DecisionLogic.findObject(sim, choice.id);
        } else {
            sim.startWandering();
        }

        // 9. 儿童/青少年强制学习逻辑 (放学后)
        if ([AgeStage.Child, AgeStage.Teen].includes(sim.ageStage) && sim.job.id === 'unemployed') {
            let studyDesire = 0;
            // J型学生更自觉
            if (sim.mbti.includes('J')) studyDesire += 50;
            // 成绩差会被迫学习
            if ((sim.schoolPerformance || 60) < 60) studyDesire += 60; 
            // 晚上是作业时间
            const hour = GameStore.time.hour;
            if (hour > 18 && hour < 21) studyDesire += 40;
            
            if (studyDesire > 80 && sim.needs[NeedType.Fun] > 30) { // 如果不是极其无聊
                DecisionLogic.findObject(sim, sim.ageStage === AgeStage.Teen ? 'study_high' : 'study');
                return; // 强制覆盖上面的决策
            }
        }
    },

    findSideHustle(sim: Sim) {
        let options: { type: string; target: Furniture }[] = [];

        if (sim.skills.logic > 5 || sim.skills.creativity > 5) {
            let pcs = GameStore.furniture.filter(f => f.label.includes('电脑') && (!f.reserved || f.reserved === sim.id));
            pcs = pcs.filter(f => !DecisionLogic.isRestricted(sim, f));
            if (pcs.length > 0) {
                const netCafePcs = pcs.filter(p => p.label.includes('网吧'));
                const homePcs = pcs.filter(p => !p.label.includes('网吧'));
                if (sim.money > 100 && netCafePcs.length > 0 && Math.random() > 0.4) { options.push({ type: 'pc', target: netCafePcs[Math.floor(Math.random() * netCafePcs.length)] }); } 
                else if (homePcs.length > 0) { options.push({ type: 'pc', target: homePcs[Math.floor(Math.random() * homePcs.length)] }); } 
                else if (pcs.length > 0) { options.push({ type: 'pc', target: pcs[Math.floor(Math.random() * pcs.length)] }); }
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
        } else {
            sim.startWandering();
        }
    },

    findObject(sim: Sim, type: string) {
        const isBaby = [AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage);
        let utility = type;
        // 映射表：将抽象需求/技能映射到具体的家具 utility
        const simpleMap: Record<string, string> = {
             [NeedType.Hunger]: 'hunger', 
             [NeedType.Bladder]: 'bladder', 
             [NeedType.Hygiene]: 'hygiene',
             [NeedType.Energy]: 'energy',
             'healing': 'healing', 
             cooking: 'cooking', gardening: 'gardening', fishing: 'fishing', art: 'art', play: 'play',
             practice_speech: 'practice_speech',
             play_chess: 'play_chess',
             play_instrument: 'play_instrument',
             paint: 'paint',
             gym_run: 'run', // 优先跑步机，没有会找其他
        };
        if (simpleMap[type]) utility = simpleMap[type];

        let candidates: Furniture[] = [];

        // === 查找策略 ===
        if (type === 'healing') { candidates = GameStore.furnitureIndex.get('healing') || []; } 
        else if (type === NeedType.Fun) {
            const funTypes = ['fun', 'cinema_2d', 'cinema_3d', 'cinema_imax', 'art', 'play', 'fishing', 'dance', 'play_chess'];
            // 如果精力不足，不要去跳舞或跑步
            if (sim.needs[NeedType.Energy] < 50) funTypes.push('comfort'); // 休息也是娱乐
            
            // 根据性格筛选娱乐
            const preferred: string[] = [];
            if (sim.mbti.includes('N')) preferred.push('art', 'play_chess', 'cinema_2d');
            if (sim.mbti.includes('S')) preferred.push('dance', 'play', 'fishing');
            
            funTypes.forEach(t => { 
                const list = GameStore.furnitureIndex.get(t); 
                if (list) {
                    // 如果是偏好类型，复制一份增加权重(概率)
                    if (preferred.includes(t)) candidates = candidates.concat(list, list);
                    else candidates = candidates.concat(list);
                }
            });
        } 
        else if (type === 'gym_run' || type === 'gym') {
             // 健身相关
             ['run', 'lift', 'stretch', 'dance'].forEach(u => {
                 const list = GameStore.furnitureIndex.get(u);
                 if (list) candidates = candidates.concat(list);
             });
        }
        else if (type === NeedType.Energy) {
             const beds = GameStore.furnitureIndex.get('energy') || [];
             candidates = candidates.concat(beds);
             // 极度困倦时沙发也行
             if (sim.needs[NeedType.Energy] < 30) {
                 const sofas = GameStore.furnitureIndex.get('comfort') || [];
                 candidates = candidates.concat(sofas);
             }
        } 
        else if (type === NeedType.Hunger) {
            // [修复] 婴幼儿饥饿时不应该去找餐厅或自己做饭，只能用奶瓶或等人喂
            // 目前简化为：如果家里有奶粉/食物 (hunger type objects like fridge/table)，或者等待保姆
            if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                // 只查找家里的食物源
                candidates = candidates.concat(GameStore.furnitureIndex.get('hunger') || []);
            } else {
                candidates = candidates.concat(GameStore.furnitureIndex.get('hunger') || []); // 冰箱
                candidates = candidates.concat(GameStore.furnitureIndex.get('eat_out') || []); // 餐厅
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
             if (candidates.length === 0) {
                 const comforts = GameStore.furnitureIndex.get('comfort') || [];
                 candidates = candidates.concat(comforts.filter(f => f.label.includes('马桶')));
             }
        } 
        else {
            // 默认直接查找 utility
            candidates = GameStore.furnitureIndex.get(utility) || [];
        }

        // === [新增/修改] 优先回家解决生理需求逻辑 ===
        const basicNeeds = [NeedType.Hunger, NeedType.Energy, NeedType.Bladder, NeedType.Hygiene];
        let forceHome = false;

        if (sim.homeId && basicNeeds.includes(type as NeedType)) {
            // 检查当前是否在工作/上学地点
            const currentPlot = GameStore.worldLayout.find(p => 
                sim.pos.x >= p.x && sim.pos.x <= p.x + (p.width||300) &&
                sim.pos.y >= p.y && sim.pos.y <= p.y + (p.height||300)
            );
            
            const isAtWork = sim.workplaceId && currentPlot && currentPlot.id === sim.workplaceId;
            const isAtSchool = currentPlot && ['school','kindergarten'].some(t => currentPlot.templateId.includes(t));
            
            // 如果不在工作也不在上学，且不是婴儿(婴儿由保姆照顾)，则优先回家
            if (!isAtWork && !isAtSchool) {
                forceHome = true;
            }
        }

        // 过滤不可用对象
        if (candidates.length) {
        // [修复] 使用 validCandidates 变量来暂存筛选结果，避免直接覆盖 candidates 导致无法进行兜底回退
        let validCandidates = candidates.filter((f: Furniture)=> {
                // 1. 权限检查 (私宅/学校/夜店)
                if (DecisionLogic.isRestricted(sim, f)) return false;
                
                // [新增] 归家优先逻辑 (第一轮严格筛选)
                if (forceHome) {
                    // 如果强制回家，必须是自己家的设施
                    if (f.homeId !== sim.homeId) return false;
                }

                // 2. 经济检查
                if (type === NeedType.Hunger && sim.money < 20) {
                    // 没钱只能用免费的 (冰箱/公共饮水)
                    if (f.cost && f.cost > 0) return false;
                }
                if (f.cost && f.cost > sim.money) return false;
                
                // 3. 占用检查
                if (f.reserved && f.reserved !== sim.id) return false;
                if (!f.multiUser) {
                    const isOccupied = GameStore.sims.some(s => s.id !== sim.id && s.interactionTarget?.id === f.id);
                    if (isOccupied) return false;
                }
                
                // 4. 婴幼儿专属过滤
                if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                    const allowed = ['energy', 'nap_crib', 'play', 'play_blocks', 'hunger', 'bladder', 'hygiene'];
                    if (!allowed.includes(f.utility) && !f.tags?.includes('baby')) return false;
                    if (f.tags?.includes('stove') || f.tags?.includes('gym') || f.tags?.includes('computer')) return false;
                }

                return true;
        });

        // [兜底逻辑] 如果因为“强制回家”导致找不到任何可用设施，则放宽限制（允许去公共场所）
        if (validCandidates.length === 0 && forceHome) {
            // console.log(`${sim.name} 家里没设施，尝试寻找公共设施...`);
            validCandidates = candidates.filter((f: Furniture) => {
                // 依然要检查基础权限
                if (DecisionLogic.isRestricted(sim, f)) return false;
                
                // 只要不是别人的私宅就可以（公共设施 homeId 为空，或者属于 public）
                if (f.homeId && f.homeId !== sim.homeId) return false; 
                
                // 重复之前的通用检查 (经济/占用/婴幼儿)
                if (type === NeedType.Hunger && sim.money < 20 && f.cost && f.cost > 0) return false;
                if (f.cost && f.cost > sim.money) return false;
                if (f.reserved && f.reserved !== sim.id) return false;
                if (!f.multiUser) {
                    const isOccupied = GameStore.sims.some(s => s.id !== sim.id && s.interactionTarget?.id === f.id);
                    if (isOccupied) return false;
                }
                if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                    const allowed = ['energy', 'nap_crib', 'play', 'play_blocks', 'hunger', 'bladder', 'hygiene'];
                    if (!allowed.includes(f.utility) && !f.tags?.includes('baby')) return false;
                    if (f.tags?.includes('stove') || f.tags?.includes('gym') || f.tags?.includes('computer')) return false;
                }
                return true;
            });
        }

        // 将最终筛选结果赋值回 candidates
        candidates = validCandidates;

        if (candidates.length) {
            // 距离排序
            candidates.sort((a: Furniture, b: Furniture) => {
                const distA = Math.pow(a.x - sim.pos.x, 2) + Math.pow(a.y - sim.pos.y, 2);
                const distB = Math.pow(b.x - sim.pos.x, 2) + Math.pow(b.y - sim.pos.y, 2);
                return distA - distB;
            });

            // 随机取最近的几个
            let poolSize = 3;
            if (type === NeedType.Fun || type === 'play' || type === 'art') poolSize = 10; 
            else if (type === NeedType.Hunger) poolSize = 5;  
            
            let obj = candidates[Math.floor(Math.random() * Math.min(candidates.length, poolSize))];
            
            const { anchor } = getInteractionPos(obj);
            sim.target = anchor;
            sim.interactionTarget = obj;
            
            sim.startMovingToInteraction();
            return;
        } else {
            if (type === 'healing') { sim.say("医院没床位了...", 'bad'); } 
            else if (type === NeedType.Hunger) { sim.say("好饿...没吃的", 'bad'); }
            else { 
                if (type.includes('skill') || type.includes('play')) sim.say("找不到地方练习...", 'sys');
            }
        }
    }
    if (!isBaby) sim.startWandering();
},

    findHuman(sim: Sim) {
        let others = GameStore.sims.filter(s => s.id !== sim.id && s.action !== SimAction.Sleeping && s.action !== SimAction.Working);
        others.sort(() => Math.random() - 0.5); // 先打乱
        
        // 优先找熟人
        others.sort((a, b) => {
            let relA = (sim.relationships[a.id]?.friendship || 0);
            let relB = (sim.relationships[b.id]?.friendship || 0);
            return relB - relA; 
        });

        if (others.length) {
            const bestRel = sim.relationships[others[0].id]?.friendship || 0;
            // 关系好的圈子小，关系差的随机范围大
            let poolSize = bestRel < 20 ? 10 : 3;
            poolSize = Math.min(others.length, poolSize);

            let partner = others[Math.floor(Math.random() * poolSize)];
            
            if (DecisionLogic.isRestricted(sim, partner.pos)) {
                sim.startWandering();
                return;
            }

            const angle = Math.random() * Math.PI * 2;
            const socialDistance = 40;
            
            sim.target = { 
                x: partner.pos.x + Math.cos(angle) * socialDistance, 
                y: partner.pos.y + Math.sin(angle) * socialDistance 
            };
            
            sim.interactionTarget = { type: 'human', ref: partner };
            sim.startMovingToInteraction();
        } else {
            sim.startWandering();
        }
    }
};