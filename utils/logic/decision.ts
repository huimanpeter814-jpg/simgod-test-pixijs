
import type { Sim } from '../Sim'; 
import { GameStore } from '../simulation';
import { CONFIG } from '../../constants'; 
import { Furniture, SimAction, NeedType, AgeStage, JobType } from '../../types';
import { getInteractionPos } from '../simulationHelpers';
import { FeedBabyState, WaitingState, IdleState } from './SimStates';
import { PLOTS } from '../../data/plots'; 

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

    // === 🧠 核心决策函数 ===
    decideAction(sim: Sim) {
        // 1. 婴幼儿特殊逻辑
        if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
            // [原有逻辑] 检查是否离家出走... (保持不变)
            if (!sim.isAtHome() && sim.homeId) { /*...*/ return; }

            // === [修复 1] 拆解优先级链，防止一个需求卡死其他紧急需求 ===
            
            // A. 如厕 (Bladder) - 最紧急，独立检查
            if (sim.needs[NeedType.Bladder] < 40) {
                 if (this.findObject(sim, NeedType.Bladder)) return;
                 // 找不到厕所继续向下执行
            }

            // B. 卫生 (Hygiene) - 独立检查
            if (sim.needs[NeedType.Hygiene] < 40) {
                 if (this.findObject(sim, NeedType.Hygiene)) return;
            }

            // C. 饥饿 (Hunger) - 独立检查
            if (sim.needs[NeedType.Hunger] < 50) {
                // 尝试呼叫父母
                if (this.triggerHungerBroadcast(sim)) return; 
                // 如果没人喂，代码会继续向下运行，防止卡死
                sim.say("饿饿...🍼", 'bad');
            }

            // D. 睡觉 (Energy) - 独立检查
            if (sim.needs[NeedType.Energy] < 40) {
                if (this.findObject(sim, NeedType.Energy)) return;
                
                // 困极了的兜底
                if (sim.needs[NeedType.Energy] < 10) {
                    sim.say("困困...💤", 'bad');
                    sim.needs[NeedType.Energy] += 0.05;
                    return; // 强制休息，不再执行后续
                }
            }

            // === [修复 2] 增加社交逻辑，但加上“防走失”限制 ===
            // 只有当生理需求尚可时，才考虑社交
            if (sim.needs[NeedType.Social] < 60) {
                // 手动查找：只找“在家里的”且“能走到的”人，防止宝宝跑到公园去
                const target = GameStore.sims.find(s => 
                    s.id !== sim.id && 
                    s.homeId === sim.homeId && // 必须是一家人
                    s.isAtHome() &&            // 必须此刻在家
                    !DecisionLogic.isRestricted(sim, s.pos) // 必须能走到
                );

                if (target) {
                    sim.target = { x: target.pos.x + 30, y: target.pos.y };
                    sim.interactionTarget = { type: 'human', ref: target };
                    sim.startMovingToInteraction();
                    return;
                }
            }

            // E. 娱乐 (Fun) - 最后才考虑玩
            if (sim.needs[NeedType.Fun] < 60) {
                if (this.findObject(sim, NeedType.Fun)) return;
            }

            // F. 闲逛
            if (sim.action === SimAction.Idle && Math.random() < 0.5) sim.startWandering();
            return;
        }

        //成人
        // 2. 紧急生存检查 (Health)
        if (sim.health < 60 || sim.hasBuff('sick')) { 
            if (DecisionLogic.findObject(sim, 'healing')) return;
        }

        // 3. 需求危机处理 (Critical Needs)
        // [修复] 收集所有危机需求并按严重程度排序，依次尝试解决
        let critical = [
            { id: NeedType.Energy, val: sim.needs[NeedType.Energy] },
            { id: NeedType.Hunger, val: sim.needs[NeedType.Hunger] },
            { id: NeedType.Bladder, val: sim.needs[NeedType.Bladder] },
            { id: NeedType.Hygiene, val: sim.needs[NeedType.Hygiene] }
        ].filter(n => n.val < 40);

        if (critical.length > 0) {
            critical.sort((a, b) => a.val - b.val);
            // 依次尝试，如果某个需求解决失败（如没钱吃饭），则尝试下一个（如去睡觉）
            for (const crit of critical) {
                if (DecisionLogic.findObject(sim, crit.id)) return; // 成功找到解决方案
            }
            // 如果所有危机需求都无法解决，才会掉落到后续逻辑或闲逛
        }

        // 4. 普通评分逻辑
        let scores: { id: string, score: number, type: string }[] = [];

        scores.push({ id: NeedType.Energy, score: (100 - sim.needs[NeedType.Energy]) * 2.5, type: 'obj' });
        scores.push({ id: NeedType.Hunger, score: (100 - sim.needs[NeedType.Hunger]) * 2.0, type: 'obj' });
        scores.push({ id: NeedType.Bladder, score: (100 - sim.needs[NeedType.Bladder]) * 3.0, type: 'obj' });
        scores.push({ id: NeedType.Hygiene, score: (100 - sim.needs[NeedType.Hygiene]) * 1.5, type: 'obj' });
        
        let funWeight = sim.mbti.includes('P') ? 1.5 : 1.0;
        scores.push({ id: NeedType.Fun, score: (100 - sim.needs[NeedType.Fun]) * funWeight, type: 'fun' });

        let socialScore = (100 - sim.needs[NeedType.Social]) * 1.5;
        if (sim.mbti.startsWith('E')) socialScore *= 1.5;
        if (sim.hasBuff('lonely')) socialScore += 50;
        if (sim.hasBuff('in_love') || sim.partnerId) socialScore += 20;
        scores.push({ id: NeedType.Social, score: socialScore, type: 'social' });

        // 购物
        if (![AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage) && sim.money > 500 && (sim.mood > 80 || sim.hasBuff('shopping_spree'))) { 
            scores.push({ id: 'buy_item', score: 40 + (sim.money / 200), type: 'obj' }); 
        }

        // 副业
        if (sim.job.id === 'unemployed' && ![AgeStage.Infant, AgeStage.Toddler, AgeStage.Child].includes(sim.ageStage)) {
            let moneyDesire = 0;
            if (sim.money < 500) moneyDesire = 150; 
            else if (sim.money < 2000) moneyDesire = 80;
            else if (sim.lifeGoal.includes('富翁')) moneyDesire = 60;
            if (moneyDesire > 0) scores.push({ id: 'side_hustle', score: moneyDesire, type: 'work' });
        }

        // 技能
        if (![AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
            for (let skillKey in sim.skills) {
                let skillDesire = 0;
                const talent = sim.skillModifiers[skillKey] || 1;
                if (sim.mbti.includes('J')) skillDesire += 25;
                if (DecisionLogic.isCareerSkill(sim, skillKey)) skillDesire += 30;
                if (DecisionLogic.isGoalSkill(sim, skillKey)) skillDesire += 30;
                if (sim.traits.includes('懒惰')) skillDesire -= 30;
                if (sim.needs[NeedType.Energy] < 30) skillDesire -= 50;
                skillDesire *= talent;
                scores.push({ id: `skill_${skillKey}`, score: skillDesire, type: 'obj' });
            }
        }

        // 娱乐
        if (sim.needs[NeedType.Fun] < 60 && ![AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
            if (sim.money > 100) scores.push({ id: 'cinema_3d', score: (100 - sim.needs[NeedType.Fun]) * 1.2, type: 'obj' });
            if (sim.mbti.includes('N')) scores.push({ id: 'art', score: (100 - sim.needs[NeedType.Fun]) * 1.5, type: 'obj' });
        }

        scores.sort((a, b) => b.score - a.score);
        
        // 5. 执行Top 3 决策
        const topCandidates = scores.slice(0, 3).filter(s => s.score > 25);
        
        // [修复] 依次尝试 Top Candidates，直到成功为止
        for (const choice of topCandidates) {
            let success = false;
            
            if (choice.id === NeedType.Social) success = DecisionLogic.findHuman(sim);
            else if (choice.id === 'side_hustle') success = DecisionLogic.findSideHustle(sim);
            else if (choice.id.startsWith('skill_')) {
                const skillName = choice.id.replace('skill_', '');
                let actionType = skillName;
                if (skillName === 'charisma') actionType = 'practice_speech';
                if (skillName === 'logic') actionType = 'play_chess';
                if (skillName === 'creativity') actionType = 'paint';
                if (skillName === 'music') actionType = 'play_instrument';
                if (skillName === 'athletics') actionType = 'gym_run';
                success = DecisionLogic.findObject(sim, actionType);
            }
            else success = DecisionLogic.findObject(sim, choice.id);

            if (success) return; // 成功执行，退出
        }

        // 6. 青少年强制学习 (兜底)
        if ([AgeStage.Child, AgeStage.Teen].includes(sim.ageStage) && sim.job.id === 'unemployed') {
            if ((sim.schoolPerformance || 60) < 60 && sim.needs[NeedType.Fun] > 30) {
                if (DecisionLogic.findObject(sim, sim.ageStage === AgeStage.Teen ? 'study_high' : 'study')) return;
            }
        }

        // 7. 实在无事可做，才闲逛
        sim.startWandering();
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
    }
};
