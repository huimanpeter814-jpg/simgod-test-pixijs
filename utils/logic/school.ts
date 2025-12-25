import { Sim } from '../Sim';
import { GameStore } from '../simulation';
import { SCHOOL_CONFIG, BUFFS, HOLIDAYS } from '../../constants';
import { DecisionLogic } from './decision';
import { SimAction, AgeStage, NeedType } from '../../types';
import { SchoolingState, CommutingSchoolState, IdleState, PlayingHomeState, PickingUpState, WaitingState } from './SimStates';
import { SkillLogic } from './SkillLogic'; // 🆕 引入 SkillLogic
import { PLOTS } from '../../data/plots'; // [新增] 引入 PLOTS

export const SchoolLogic = {
    findObjectInArea(sim: Sim, utility: string, area: {minX: number, maxX: number, minY: number, maxY: number}) {
        const candidates = GameStore.furnitureIndex.get(utility) || [];
        const valid = candidates.filter(f => 
            f.x >= area.minX && f.x <= area.maxX && 
            f.y >= area.minY && f.y <= area.maxY
        );
        
        if (valid.length > 0) {
            const obj = valid[Math.floor(Math.random() * valid.length)];
            sim.target = { x: obj.x + obj.w / 2, y: obj.y + obj.h / 2 };
            sim.interactionTarget = obj;
        } else {
            const tx = area.minX + Math.random() * (area.maxX - area.minX);
            const ty = area.minY + Math.random() * (area.maxY - area.minY);
            sim.target = { x: tx, y: ty };
        }
    },
    
    // [核心修复] 使用 type 字段判断是否在学校区域
    isInSchoolArea(sim: Sim, targetType: string): boolean {
        // 1. 找到所有匹配 type 的地块
        const validPlots = GameStore.worldLayout.filter(p => {
            const tpl = PLOTS[p.templateId];
            return tpl && tpl.type === targetType;
        });
        
        // 2. 检查市民坐标是否在任意一个有效地块内
        return validPlots.some(p => 
            sim.pos.x >= p.x && sim.pos.x <= p.x + (p.width || 300) &&
            sim.pos.y >= p.y && sim.pos.y <= p.y + (p.height || 300)
        );
    },

    // 呼叫家长/保姆来接
    requestEscort(sim: Sim, type: 'drop_off' | 'pick_up') {
        // 如果已经有人在接了，就忽略
        const existingPicker = GameStore.sims.find(s => s.carryingSimId === sim.id && (s.action === SimAction.PickingUp || s.action === SimAction.Escorting));
        if (existingPicker) return;

        // 寻找此人的父母
        const parents = GameStore.sims.filter(s => 
            (s.id === sim.fatherId || s.id === sim.motherId) &&
            !s.isTemporary &&
            // 排除忙碌的父母 (除了睡觉，睡觉可以叫醒)
            s.action !== SimAction.Working && 
            s.action !== SimAction.Commuting &&
            s.action !== SimAction.Escorting &&
            s.action !== SimAction.PickingUp
        );

        // 优先选心情好的
        const carrier = parents.sort((a, b) => b.mood - a.mood)[0];

        if (carrier) {
            carrier.changeState(new PickingUpState());
            carrier.carryingSimId = sim.id;
            carrier.target = null; // 重置目标，让 State 的 enter() 处理
            carrier.say(type === 'drop_off' ? "送宝宝上学" : "接宝宝放学", 'family');
            
            sim.changeState(new WaitingState());
            sim.say("等爸妈...", 'normal');
        } else {
            // 父母都没空，叫保姆
            if (sim.homeId) {
                GameStore.spawnNanny(sim.homeId, type, sim.id);
                sim.changeState(new WaitingState());
                sim.say("等保姆...", 'normal');
            }
        }
    },

    arrangePickup(sim: Sim) {
        const incomingPicker = GameStore.sims.find(s => s.carryingSimId === sim.id && s.action === SimAction.PickingUp);
        if (incomingPicker) return;

        const parents = GameStore.sims.filter(s => 
            (s.id === sim.fatherId || s.id === sim.motherId) &&
            !s.isTemporary &&
            s.action !== SimAction.Working && 
            s.action !== SimAction.Commuting &&
            s.action !== SimAction.Sleeping &&
            s.action !== SimAction.Escorting &&
            s.action !== SimAction.PickingUp
        );

        const carrier = parents.sort((a, b) => b.mood - a.mood)[0];

        if (carrier) {
            carrier.target = { x: sim.pos.x, y: sim.pos.y };
            carrier.carryingSimId = sim.id; 
            carrier.changeState(new PickingUpState());
            carrier.say("接宝宝放学咯~", 'family');
            sim.say("等爸爸/妈妈...", 'normal');
        } else {
            if (sim.homeId) {
                GameStore.spawnNanny(sim.homeId, 'pick_up', sim.id);
                sim.say("等保姆阿姨...", 'normal');
            }
        }
    },

    sendToSchool(sim: Sim, schoolType: string): boolean {
        // [核心修复] 根据 type 查找学校
        const schoolPlot = GameStore.worldLayout.find(p => {
            const tpl = PLOTS[p.templateId];
            // 注意：SchoolSchedule 传进来的 id 是 'elementary'，但 plots 里的 type 是 'elementary_school'
            // 这里做个简单映射，或者由调用方保证传对
            if (schoolType === 'elementary') return tpl && tpl.type === 'elementary_school';
            if (schoolType === 'high_school') return tpl && tpl.type === 'high_school';
            return tpl && tpl.type === schoolType;
        });

        if (!schoolPlot) return false;

        const targetRoom = GameStore.rooms.find(r => r.id.startsWith(`${schoolPlot.id}_`));
        let targetX = 0, targetY = 0;
        if (targetRoom) {
            targetX = targetRoom.x + targetRoom.w / 2 + (Math.random() - 0.5) * 40;
            targetY = targetRoom.y + targetRoom.h / 2 + (Math.random() - 0.5) * 40;
        } else {
            const w = schoolPlot.width || 300;
            const h = schoolPlot.height || 300;
            targetX = schoolPlot.x + w / 2;
            targetY = schoolPlot.y + h / 2;
        }

        if (schoolType === 'kindergarten') {
            this.requestEscort(sim, 'drop_off');
            return true;
        }

        sim.target = { x: targetX, y: targetY };
        sim.changeState(new CommutingSchoolState());
        sim.say("去学校...", 'act');
        return true;
    },

    // 核心调度循环
    checkKindergarten(sim: Sim) {
        if (![AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) return;

        const currentHour = GameStore.time.hour;
        const isDaycareTime = currentHour >= 8 && currentHour < 17; 
        
        // [修正] 传入 type: 'kindergarten'
        const inKindergarten = SchoolLogic.isInSchoolArea(sim, 'kindergarten');

        if (inKindergarten) {
            if (isDaycareTime) {
                // 🟢 [重构] 幼儿园内部行为逻辑
                // 不再强制锁定 SchoolingState，而是允许互动
                
                // 1. 自动补满严重缺乏的需求 (幼儿园福利)
                if (sim.needs.hunger < 30) {
                    // 尝试呼叫老师喂食 (依赖 decision.ts 的广播)
                    if (DecisionLogic.triggerHungerBroadcast(sim)) return;
                    // 如果老师没空，自动补一点防止饿死
                    sim.needs.hunger += 10; 
                }

                // 2. 只有在空闲时才决定下一步
                if (sim.action === SimAction.Idle || sim.action === SimAction.Schooling) {
                    if (sim.needs.fun < 60) {
                        // 找玩具玩 (限制在当前地块)
                        // 我们可以借用 DecisionLogic，但强制 limitToCurrentPlot
                        // 这里简单实现：
                        sim.say("玩玩具! 🧸", 'fun');
                        sim.needs.fun += 5;
                        sim.changeState(new SchoolingState()); // 暂时用 SchoolingState 模拟玩耍，你可以换成 Playing
                    } else if (sim.needs.social < 60) {
                        sim.say("找小朋友玩~", 'chat');
                        sim.needs.social += 5;
                        sim.changeState(new SchoolingState());
                    } else {
                        // 没事做就乖乖上课/睡觉
                        if (sim.action !== SimAction.Schooling) sim.changeState(new SchoolingState());
                    }
                }
                
                // 保持一些基础恢复
                if (sim.needs.social < 90) sim.needs.social += 0.05;
            } else {
                // 放学时间：如果在校但没被接，叫家长来接 (Pick-up)
                if (sim.action !== SimAction.BeingEscorted && sim.action !== SimAction.Waiting) {
                    SchoolLogic.requestEscort(sim, 'pick_up');
                }
            }
        }else {
            // 🟢 [核心修复] 如果不在幼儿园，且是上学时间 -> 呼叫家长送学
            if (isDaycareTime) {
                // 防止重复呼叫：如果已经在等待、被护送或正在路上，就不再呼叫
                const isBusy = sim.action === SimAction.Waiting || 
                               sim.action === SimAction.BeingEscorted || 
                               sim.action === SimAction.Escorting;
                
                // 且确保没有家长正在来接我的路上
                const processing = GameStore.sims.some(s => s.carryingSimId === sim.id);

                if (!isBusy && !processing) {
                    sim.say("我要上学...", 'sys');
                    SchoolLogic.requestEscort(sim, 'drop_off');
                }
            }
        }
    },

    checkSchoolSchedule(sim: Sim) {
        if (![AgeStage.Child, AgeStage.Teen].includes(sim.ageStage)) return;

        // 1. 确保能获取到配置
        const config = sim.ageStage === AgeStage.Child ? SCHOOL_CONFIG.elementary : SCHOOL_CONFIG.high_school;
        if (!config) return; // 安全检查

        const currentMonth = GameStore.time.month;
        const isWinterBreak = [1, 2].includes(currentMonth);
        const isSummerBreak = [7, 8].includes(currentMonth);

        if (isWinterBreak) { if (Math.random() < 0.001) sim.say("寒假快乐！❄️", 'act'); return; }
        if (isSummerBreak) { if (Math.random() < 0.001) sim.say("暑假万岁！🍉", 'act'); return; }
        if (HOLIDAYS[currentMonth]?.type === 'break') return;

        // 2. 确保时间判断包含 "分钟"
        const hour = GameStore.time.hour + GameStore.time.minute/60;

        if (hour >= config.startHour && hour < config.endHour) {
            if (sim.action === SimAction.Schooling) return;
            if (sim.action === SimAction.CommutingSchool) return;
            if (sim.hasLeftWorkToday) return; // 逃课标志

            let skipProb = 0.01; 
            if (sim.mbti.includes('P')) skipProb += 0.02; 
            if (sim.mbti.includes('J')) skipProb -= 0.02; 
            if (sim.morality < 30) skipProb += 0.05;      
            else if (sim.morality > 70) skipProb -= 0.1; 
            if (sim.iq > 80) skipProb -= 0.02;
            const grades = sim.schoolPerformance || 60;
            if (grades < 40) skipProb += 0.05;            
            else if (grades > 85) skipProb -= 0.05;       
            if (sim.ageStage === AgeStage.Teen) skipProb += 0.02;
            if (sim.needs.fun < 30) skipProb += 0.15;     
            if (sim.needs.energy < 20) skipProb += 0.10;  
            if (sim.mood < 30) skipProb += 0.03;          
            skipProb = Math.max(0, Math.min(0.8, skipProb));

            if (Math.random() < skipProb) {
                sim.hasLeftWorkToday = true;
                if (sim.needs.fun < 30) {
                    sim.say("学校太无聊了，去玩吧！🎮", 'bad');
                    GameStore.addLog(sim, "因忍受不了枯燥，决定逃学去玩！", 'bad');
                    DecisionLogic.findObject(sim, NeedType.Fun); 
                } else if (sim.needs.energy < 20) {
                    sim.say("太困了...再睡会 💤", 'bad');
                    GameStore.addLog(sim, "因精力不足，决定在宿舍补觉逃课。", 'bad');
                    if (sim.homeId) DecisionLogic.findObject(sim, NeedType.Energy);
                } else if (sim.morality < 30) {
                    sim.say("切，谁稀罕上学...", 'bad');
                    GameStore.addLog(sim, "作为不良少年，逃课是家常便饭。", 'bad');
                    sim.startWandering();
                } else {
                    sim.say("今天不想上学...", 'bad');
                    GameStore.addLog(sim, "心情不好，决定翘课。", 'bad');
                    sim.startWandering();
                }
                return;
            }

            // 发送去学校
            // [核心修复] 使用 type 查找学校
            // config.id 是 'elementary' 或 'high_school'
            // PLOTS 里的 type 是 'elementary_school' 或 'high_school'
            const targetType = config.id === 'elementary' ? 'elementary_school' : 'high_school';
            
            const schoolPlot = GameStore.worldLayout.find(p => {
                const tpl = PLOTS[p.templateId];
                return tpl && tpl.type === targetType;
            });
            
            if (schoolPlot) {
                sim.target = { 
                    x: schoolPlot.x + (schoolPlot.width||300)/2, 
                    y: schoolPlot.y + (schoolPlot.height||300)/2 
                };
                sim.changeState(new CommutingSchoolState());
                sim.say("去学校", 'act');
            }
        } 
        else if (hour >= config.endHour && sim.action === SimAction.Schooling) {
            sim.hasLeftWorkToday = false;
            sim.say("放学啦！", 'act');
            sim.changeState(new IdleState());
        }
    },

    autoReplenishNeeds(sim: Sim) {
        [NeedType.Hunger, NeedType.Bladder, NeedType.Hygiene, NeedType.Energy].forEach(n => {
            if (sim.needs[n] < 30) { sim.needs[n] = 90; sim.say("老师帮忙...", 'sys'); }
        });
        if (sim.needs.fun < 60) sim.needs.fun += 0.5;
    },

    giveAllowance(sim: Sim) {
        if (![AgeStage.Child, AgeStage.Teen].includes(sim.ageStage)) return;
        
        const config = sim.ageStage === AgeStage.Child ? SCHOOL_CONFIG.elementary : SCHOOL_CONFIG.high_school;
        let amount = config.allowanceBase;
        const parents = GameStore.sims.filter(s => s.id === sim.fatherId || s.id === sim.motherId);
        let totalParentMoney = 0;
        parents.forEach(p => totalParentMoney += p.money);

        if (totalParentMoney > 10000) amount *= 3;
        else if (totalParentMoney > 3000) amount *= 1.5;
        else if (totalParentMoney < 500) amount = 0;

        if (amount > 0 && totalParentMoney >= amount) {
            sim.money += amount;
            parents.forEach(p => p.money = Math.max(0, p.money - amount/parents.length));
            sim.say(`零花钱 +$${amount}`, 'money');
        }
    },

    doHomework(sim: Sim) {
        if (![AgeStage.Child, AgeStage.Teen].includes(sim.ageStage)) return;
        const successChance = (sim.iq * 0.4 + sim.skills.logic * 0.6) / 100;
        
        // 🆕 使用 SkillLogic
        SkillLogic.gainExperience(sim, 'logic', 0.2);
        sim.iq = Math.min(100, sim.iq + 0.05);
        
        if (Math.random() < successChance) {
            sim.say("题目好简单 ✏️", 'act');
            sim.schoolPerformance = Math.min(100, (sim.schoolPerformance || 60) + 5);
        } else {
            sim.say("这题太难了... 🤯", 'bad');
            sim.needs.fun -= 10;
            sim.schoolPerformance = Math.min(100, (sim.schoolPerformance || 60) + 2);
        }
    },

    calculateDailyPerformance(sim: Sim) {
        if (!sim.schoolPerformance) sim.schoolPerformance = 60;
        let delta = 0;
        if (sim.iq > 80) delta += 2;
        if (sim.mood > 70) delta += 1;
        sim.schoolPerformance = Math.max(0, Math.min(100, sim.schoolPerformance + delta));
        
        if (GameStore.time.totalDays % 30 > 25) {
            if (sim.schoolPerformance > 90) {
                sim.addBuff(BUFFS.promoted); 
                sim.addMemory("期末考试拿了满分！💯", 'achievement');
                sim.money += 100; 
            } else if (sim.schoolPerformance < 40) {
                sim.addBuff(BUFFS.stressed);
                sim.addMemory("期末考试挂科了... 怕被骂", 'bad');
            }
        }
    }
};