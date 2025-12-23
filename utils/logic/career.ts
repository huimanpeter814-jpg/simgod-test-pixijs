import { Sim } from '../Sim';
import { GameStore } from '../simulation';
import { JOBS, BUFFS, HOLIDAYS } from '../../constants';
import { Furniture, JobType, SimAction, AgeStage, Job } from '../../types';
import { CommutingState, IdleState, WorkingState } from './SimStates';
import { SocialLogic } from './social';
import { SkillLogic } from './SkillLogic'; 
import { hasRequiredTags } from '../simulationHelpers'; 
import { PLOTS } from '../../data/plots'; // [修复] 引入 PLOTS 用于查找默认地块类型

// Job Preferences logic remains the same...
const JOB_PREFERENCES: Record<JobType, (sim: Sim) => number> = {
    [JobType.Unemployed]: () => -9999,
    [JobType.Internet]: (sim) => {
        let s = sim.iq * 0.6 + sim.skills.logic * 3;
        if (sim.mbti.includes('T')) s += 20;
        if (sim.mbti.includes('N')) s += 10;
        if (sim.lifeGoal.includes('黑客') || sim.lifeGoal.includes('大牛') || sim.lifeGoal.includes('富翁')) s += 50;
        return s;
    },
    [JobType.Design]: (sim) => {
        let s = sim.creativity * 0.6 + (sim.skills.creativity || 0) * 3;
        if (sim.mbti.includes('P')) s += 15;
        if (sim.mbti.includes('N')) s += 15;
        if (sim.lifeGoal.includes('艺术') || sim.lifeGoal.includes('设计')) s += 50;
        return s;
    },
    [JobType.Business]: (sim) => {
        let s = sim.eq * 0.4 + (sim.skills.charisma || 0) * 3 + sim.appearanceScore * 0.3;
        if (sim.mbti.includes('E') && sim.mbti.includes('J')) s += 30;
        if (sim.lifeGoal.includes('富翁') || sim.lifeGoal.includes('大亨') || sim.lifeGoal.includes('领袖')) s += 50;
        return s;
    },
    [JobType.Store]: (sim) => {
        let s = sim.eq * 0.3 + (sim.skills.charisma || 0) * 1.5 + sim.constitution * 0.3 + 30; 
        if (sim.ageStage === AgeStage.Teen) s += 20;
        return s;
    },
    [JobType.Restaurant]: (sim) => {
        let s = sim.skills.cooking * 4 + sim.constitution * 0.5;
        if (sim.lifeGoal.includes('美食') || sim.lifeGoal.includes('主厨')) s += 60;
        return s;
    },
    [JobType.Library]: (sim) => {
        let s = sim.iq * 0.4;
        if (sim.mbti.includes('I')) s += 40;
        if (sim.lifeGoal.includes('博学') || sim.lifeGoal.includes('岁月静好')) s += 40;
        return s;
    },
    [JobType.School]: (sim) => {
        // 基础分给高一点，确保总有人选
        let s = 50; 
        
        // 不需要极高的智商，中等即可
        s += sim.iq * 0.2; 
        
        // 喜欢 S(实感) J(判断) F(情感) 的人都适合
        if (sim.mbti.includes('S')) s += 15;
        if (sim.mbti.includes('J')) s += 15;
        if (sim.mbti.includes('F')) s += 15; // 有爱心
        
        // 任何有教书育人倾向的
        if (sim.lifeGoal.includes('桃李') || sim.lifeGoal.includes('家庭') || sim.lifeGoal.includes('安稳')) s += 60;
        
        return s;
    },
    [JobType.Nightlife]: (sim) => {
        let s = (sim.skills.music || 0) * 2 + (sim.skills.dancing || 0) * 2 + (sim.skills.charisma || 0) * 1.5 + sim.appearanceScore * 0.5;
        if (sim.mbti.includes('E') && sim.mbti.includes('P')) s += 40;
        if (sim.lifeGoal.includes('派对') || sim.lifeGoal.includes('万人迷')) s += 60;
        return s;
    },
    [JobType.Hospital]: (sim) => {
        let s = sim.iq * 0.5 + sim.constitution * 0.4;
        if (sim.mbti.includes('J')) s += 20;
        if (sim.traits.includes('洁癖')) s += 15;
        if (sim.lifeGoal.includes('大牛') || sim.lifeGoal.includes('救死扶伤')) s += 40;
        return s;
    },
    [JobType.ElderCare]: (sim) => {
        let s = sim.constitution * 0.6 + sim.eq * 0.4;
        if (sim.mbti.includes('F')) s += 30;
        if (sim.traits.includes('善良') || sim.traits.includes('热心')) s += 30;
        return s;
    }
};

export const CareerLogic = {
    getDynamicJobCapacity(job: Job): number {
        if (job.level >= 4) return 1;
        if (job.level >= 3) return 3;
        return 20; 
    },

    assignJob(sim: Sim) {
        const scores: { type: JobType, score: number }[] = [];
        
        (Object.keys(JOB_PREFERENCES) as JobType[]).forEach(type => {
            if (type === JobType.Unemployed) return;
            const calculateScore = JOB_PREFERENCES[type];
            let score = calculateScore(sim);
            score += Math.random() * 20; 
            scores.push({ type, score });
        });

        scores.sort((a, b) => b.score - a.score);

        let assignedJob: Job | undefined = undefined;

        // 遍历偏好，寻找有空缺的职位
        for (const candidate of scores) {
            const jobType = candidate.type;
            
            // 获取该类型下的所有职位定义
            const validJobs = JOBS.filter(j => j.companyType === jobType);
            
            // 检查是否有空缺
            const availableJobs = validJobs.filter(j => {
                const cap = this.getDynamicJobCapacity(j);
                const currentCount = GameStore.sims.filter(s => s.job.id === j.id).length;
                return currentCount < cap;
            });

            if (availableJobs.length > 0) {
                // 优先从 Level 1 或 Level 2 开始分配
                // 这里的逻辑是加权随机：低级职位权重高
                const weightedPool: Job[] = [];
                availableJobs.forEach(job => {
                    let weight = 10;
                    if (job.level === 2) weight = 5;
                    if (job.level >= 3) weight = 1;
                    // 特殊：如果是学校，大幅增加权重，确保填满
                    if (jobType === JobType.School) weight += 10;
                    
                    for(let k=0; k<weight; k++) weightedPool.push(job);
                });
                
                assignedJob = weightedPool[Math.floor(Math.random() * weightedPool.length)];
                break; 
            }
        }

        if (!assignedJob) {
            assignedJob = JOBS.find(j => j.id === 'unemployed');
            sim.say("找不到合适的工作...", 'bad');
        } else {
            if (scores[0].type === assignedJob.companyType) {
                sim.addBuff(BUFFS.promoted); 
                sim.say("这是我的梦想职业！", 'act');
            } else {
                sim.say("先干着这份工吧...", 'normal');
            }
        }

        sim.job = assignedJob!;
        
        if (sim.job.id !== 'unemployed') {
            this.bindWorkplace(sim);
        } else {
            sim.workplaceId = undefined;
        }

        const isJ = sim.mbti.includes('J');
        const basePre = isJ ? 60 : 30;
        const variance = Math.random() * 30;
        sim.commutePreTime = Math.floor(isJ ? basePre + variance : basePre - variance);
        
        if (sim.traits.includes('懒惰')) sim.commutePreTime = 5;
        if (sim.traits.includes('洁癖')) sim.commutePreTime += 20;
    },

    bindWorkplace(sim: Sim) {
        // 1. 定义：当前职业需要寻找什么类型的地块？
        let targetType = 'work';
        
        // 特殊职业的类型映射
        switch (sim.job.companyType) {
            case JobType.Hospital:
                targetType = 'hospital'; 
                break;
            case JobType.School:
                // [核心修复] 根据 Job ID 或 Title 细分去向
                // 假设你的职业ID命名类似于 'teacher_high', 'teacher_elem', 'teacher_kindergarten'
                // 或者职位名称包含 '中', '小', '幼'
                if (sim.job.id.includes('high') || sim.job.title.includes('中') || sim.job.title.includes('高')) {
                    targetType = 'high_school'; // 对应 plots.ts 中的 type
                } 
                else if (sim.job.id.includes('elem') || sim.job.id.includes('primary') || sim.job.title.includes('小')) {
                    targetType = 'elementary_school';
                } 
                else {
                    // 默认为幼儿园 (kindergarten)
                    targetType = 'kindergarten';
                }
                break;
            case JobType.ElderCare:
                targetType = 'elder_care';
                break;
            case JobType.Library:
                targetType = 'library';
                break;
            case JobType.Nightlife:
                targetType = 'bar'; // data/plots.ts 中夜店的 type 是 'bar'
                break;
            case JobType.Restaurant:
                targetType = 'restaurant'; // data/plots.ts 中 cafe 也是 'restaurant'
                break;
            case JobType.Store:
                targetType = 'store'; // data/plots.ts 中 convenience, supermarket, clothing 都是 'store'
                break;
            case JobType.Internet:
                targetType = 'internet'; // data/plots.ts 中是 'internet'
                break;
            case JobType.Design:
                targetType = 'design'; // data/plots.ts 中是 'design'
                break;
            case JobType.Business:
                targetType = 'business'; // data/plots.ts 中是 'business'
                break;
            default:
                targetType = 'work'; // 兜底
                break;
        }

        // 2. 搜索匹配的地块
        const potentialWorkplaces = GameStore.worldLayout.filter(p => {
            // [核心修复] 直接查表获取类型
            const template = PLOTS[p.templateId];
            const actualType = p.customType || (template ? template.type : 'public');

            // 规则 A: 精确匹配
            if (actualType === targetType) return true;

            // 规则 B: 商店兼容 (书店 bookstore 也可以作为 store 工作地点)
            if (targetType === 'store') {
                if (['store', 'bookstore', 'supermarket', 'commercial'].includes(actualType)) return true;
            }

            // 规则 C: 餐饮兼容 (如果只有通用 restaurant，但要去 cafe)
            if (targetType === 'restaurant') {
                if (['restaurant', 'cafe'].includes(actualType)) return true;
            }

            // 规则 D: 通用办公兼容 (找不到 internet 公司时，去 business 或 work 凑合)
            const officeTypes = ['internet', 'design', 'business'];
            if (officeTypes.includes(targetType)) {
                if (actualType === 'work' || actualType === 'office') return true;
                // 互通性：如果没有专门的互联网公司，去商务中心也可以
                if (officeTypes.includes(actualType)) return true;
            }

            return false;
        });

        // 3. 优选：在符合类型的地块中，优先选有电脑/椅子的
        if (potentialWorkplaces.length > 0) {
            let finalCandidates = potentialWorkplaces;
            const requiredTags = sim.job.requiredTags;

            // 尝试找出设施完善的地块
            if (requiredTags && requiredTags.length > 0) {
                const withFurniture = potentialWorkplaces.filter(p => {
                    const furnitureInPlot = GameStore.furnitureByPlot.get(p.id) || [];
                    return furnitureInPlot.some(f => hasRequiredTags(f, requiredTags));
                });
                if (withFurniture.length > 0) {
                    finalCandidates = withFurniture;
                }
            }

            // 随机分配一个
            const workplace = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
            sim.workplaceId = workplace.id;
            this.updateColleagues(sim, workplace.id);
            // console.log(`[Career] ${sim.name} assigned to ${workplace.customName || workplace.templateId}`);
        } else {
            sim.workplaceId = undefined;
            // console.warn(`[Career] No workplace found for ${sim.name} (Target: ${targetType})`);
        }
    },

    updateColleagues(sim: Sim, workplaceId: string) {
        GameStore.sims.forEach(other => {
            if (other.id !== sim.id && other.workplaceId === workplaceId) {
                if (!sim.relationships[other.id]) SocialLogic.updateRelationship(sim, other, 'friendship', 0);
                if (!other.relationships[sim.id]) SocialLogic.updateRelationship(other, sim, 'friendship', 0);
                
                sim.relationships[other.id].isColleague = true;
                other.relationships[sim.id].isColleague = true;
            }
        });
    },

    checkSchedule(sim: Sim) {
        if (sim.isTemporary) return;

        if ([AgeStage.Infant, AgeStage.Toddler, AgeStage.Elder].includes(sim.ageStage) || sim.job.id === 'unemployed') return;

        const currentMonth = GameStore.time.month;
        const holiday = HOLIDAYS[currentMonth];
        const isVacationMonth = sim.job.vacationMonths?.includes(currentMonth);
        const isPublicHoliday = holiday && (holiday.type === 'traditional' || holiday.type === 'break');

        // === [新增] 教师寒暑假逻辑 ===
        let isTeacherBreak = false;
        if (sim.job.companyType === JobType.School) {
            // 排除幼儿园老师 (根据职称或ID判断)
            const isKindergarten = sim.job.id.includes('kindergarten') || sim.job.title.includes('幼') || sim.job.title.includes('保育');
            
            if (!isKindergarten) {
                // 1,2月寒假; 7,8月暑假
                if ([1, 2, 7, 8].includes(currentMonth)) {
                    isTeacherBreak = true;
                    // 5% 概率值班，不放假
                    if (Math.random() < 0.002) { // 每分钟检测，概率要设极低，或者用 persistent flag (这里简单处理：只要触发一次上班状态就会持续到下班)
                        // 实际上 checkSchedule 是高频调用的，用随机数做入口控制不太稳。
                        // 更好的做法是：如果是假期，直接 isTeacherBreak = true。
                        // 只有当 sim 身上有 "on_duty" buff 时才允许上班。
                        // 简化版：这里直接强制放假。
                    }
                }
            }
        }
        // [优化] 如果是假期，且正在工作，必须强制下班，不能直接 return
        if (isPublicHoliday || isVacationMonth || isTeacherBreak) {
            if (sim.action === SimAction.Working || sim.action === SimAction.Commuting) {
                // 只有非值班状态才下班 (如果有值班逻辑可在此扩展)
                this.offWork(sim);
                if (isTeacherBreak) sim.say("寒暑假快乐！🏖️", 'act');
                else sim.say("放假咯！", 'act');
            }
            return;
        }

        const currentHour = GameStore.time.hour + GameStore.time.minute / 60;
        const jobStart = sim.job.startHour;
        const jobEnd = sim.job.endHour;

        const preTimeHours = (sim.commutePreTime || 30) / 60;
        let commuteStart = jobStart - preTimeHours;
        
        let isWorkTime = false;
        if (jobStart < jobEnd) {
            isWorkTime = currentHour >= commuteStart && currentHour < jobEnd;
        } else {
            isWorkTime = currentHour >= commuteStart || currentHour < jobEnd;
        }

        if (isWorkTime) {
            if (sim.hasLeftWorkToday) return;

            if (sim.action === SimAction.Working || sim.action === SimAction.Commuting) return;

            sim.isSideHustle = false;
            sim.consecutiveAbsences = 0; 
            sim.changeState(new CommutingState()); 
            sim.say("去上班... 💼", 'act');
        } 
        else {
            if (sim.action === SimAction.Working) {
                this.offWork(sim);
            }
        }
    },

    offWork(sim: Sim) {
        sim.hasLeftWorkToday = false;
        sim.lastPunchInTime = undefined;

        sim.target = null;
        sim.interactionTarget = null;
        sim.path = [];
        // 🟢 [修复] 正常下班也需要记录流水和日志
        const earned = sim.job.salary;
        sim.money += earned;
        sim.dailyIncome += earned;
        // 手动记录流水 (避免与 EconomyLogic 循环引用)
        const timeStr = `${String(GameStore.time.hour).padStart(2, '0')}:${String(GameStore.time.minute).padStart(2, '0')}`;
        if (!sim.dailyTransactions) sim.dailyTransactions = [];
        sim.dailyTransactions.unshift({
            time: timeStr,
            amount: earned,
            reason: '工资结算',
            type: 'income'
        });
        // 限制长度
        if (sim.dailyTransactions.length > 50) sim.dailyTransactions.pop();
        
        GameStore.addLog(sim, `完成工作，收到工资 +$${earned}`, 'money');
        sim.say(`下班! +$${earned}`, 'money');

        sim.addBuff(BUFFS.stressed);

        this.updatePerformance(sim);

        sim.changeState(new IdleState());
    },

    updatePerformance(sim: Sim) {
        let dailyPerf = 0;
        
        if (sim.job.companyType === JobType.Internet && sim.iq > 70) dailyPerf += 3;
        if (sim.job.companyType === JobType.Business && (sim.eq > 70 || (sim.skills.charisma || 0) > 20)) dailyPerf += 3;
        if (sim.job.companyType === JobType.Hospital && sim.constitution > 70) dailyPerf += 3;
        
        if (sim.mood > 80) dailyPerf += 5;
        else if (sim.mood < 40) dailyPerf -= 5;

        dailyPerf += Math.floor(Math.random() * 10) - 4; 

        sim.workPerformance += dailyPerf;
        sim.workPerformance = Math.max(-100, Math.min(200, sim.workPerformance));

        if (sim.workPerformance > 100 && sim.job.level < 4) {
            this.promote(sim);
            sim.workPerformance = 50; 
        }
    },

    promote(sim: Sim) {
        const nextLevel = JOBS.find(j => {
             if (j.companyType !== sim.job.companyType) return false;
             if (j.level !== sim.job.level + 1) return false;
             
             if (sim.job.companyType === JobType.School || sim.job.companyType === JobType.Hospital) {
                 const kw = sim.job.title.substring(0, 1); 
                 if (!j.title.includes(kw)) return false; 
             }
             return true;
        });

        if (!nextLevel) return;

        const cap = this.getDynamicJobCapacity(nextLevel);
        const currentHolders = GameStore.sims.filter(s => s.job.id === nextLevel.id);
        
        if (currentHolders.length < cap) {
            sim.job = nextLevel;
            sim.money += 1000;
            GameStore.addLog(sim, `升职了！现在是 ${nextLevel.title}`, 'sys');
            sim.say("升职啦! 🚀", 'act');
            sim.addBuff(BUFFS.promoted);
        } else {
            const victim = currentHolders.sort((a, b) => a.workPerformance - b.workPerformance)[0];
            if (sim.workPerformance > victim.workPerformance + 20) {
                const oldJob = sim.job;
                sim.job = nextLevel;
                victim.job = oldJob; 
                victim.addBuff(BUFFS.demoted);
                GameStore.addLog(sim, `PK 成功！取代 ${victim.name} 晋升。`, 'sys');
            }
        }
    },

    leaveWorkEarly(sim: Sim) {
        const currentHour = GameStore.time.hour + GameStore.time.minute / 60;
        let startHour = sim.lastPunchInTime || sim.job.startHour;
        const totalDuration = sim.job.endHour - sim.job.startHour;
        let workedDuration = currentHour - startHour;
        if (workedDuration < 0) workedDuration += 24;

        const workRatio = Math.max(0, Math.min(1, workedDuration / totalDuration));
        const actualPay = Math.floor(sim.job.salary * workRatio);
        
        // 🟢 [修复] 早退工资逻辑：增加收入统计、流水记录和日志
        if (actualPay > 0) {
            sim.money += actualPay;
            sim.dailyIncome += actualPay; // 更新今日收入统计

            // 手动记录流水 (避免直接调用 EconomyLogic 导致循环依赖)
            const timeStr = `${String(GameStore.time.hour).padStart(2, '0')}:${String(GameStore.time.minute).padStart(2, '0')}`;
            if (!sim.dailyTransactions) sim.dailyTransactions = [];
            sim.dailyTransactions.unshift({
                time: timeStr,
                amount: actualPay,
                reason: '早退结算',
                type: 'income'
            });
            if (sim.dailyTransactions.length > 50) sim.dailyTransactions.pop();

            GameStore.addLog(sim, `早退结算工资 +$${actualPay}`, 'money');
        }
        sim.hasLeftWorkToday = true;
        
        sim.workPerformance -= 15;
        
        sim.target = null;
        sim.interactionTarget = null;
        sim.say("早退... 😓", 'bad');
        sim.say(`早退... (+$${actualPay})`, 'bad'); // 气泡也提示一下金额
        sim.changeState(new IdleState());
    },

    checkCareerSatisfaction(sim: Sim) {
        if (sim.job.id === 'unemployed') return;
        
        let quitScore = 0;
        if (sim.mood < 30) quitScore += 20;
        if (sim.hasBuff('stressed') || sim.hasBuff('anxious')) quitScore += 30;
        if (sim.money > 10000) quitScore += 10; 
        
        if (sim.job.companyType === JobType.Internet && sim.mbti.includes('F')) quitScore += 10;
        if (sim.job.companyType === JobType.Business && sim.mbti.includes('I')) quitScore += 15;
        
        if (Math.random() * 100 < quitScore && quitScore > 50) {
            this.fireSim(sim, 'resign');
        }
    },

    checkFire(sim: Sim) {
        if (sim.job.id === 'unemployed') return;

        if (sim.workPerformance < -60) {
            this.fireSim(sim, 'fired');
        } else if (sim.consecutiveAbsences >= 3) {
            this.fireSim(sim, 'absent');
        }
    },

    fireSim(sim: Sim, reason: 'resign' | 'fired' | 'absent') {
        const oldTitle = sim.job.title;
        sim.job = JOBS.find(j => j.id === 'unemployed')!;
        sim.workplaceId = undefined;
        sim.workPerformance = 0;
        sim.consecutiveAbsences = 0; 
        
        if (reason === 'fired') {
            GameStore.addLog(sim, `被公司开除了 (${oldTitle})`, 'bad');
            sim.addBuff(BUFFS.fired);
        } else if (reason === 'absent') {
            GameStore.addLog(sim, `因旷工被辞退`, 'bad');
        } else if (reason === 'resign') {
            GameStore.addLog(sim, `辞去了 ${oldTitle} 的工作`, 'sys');
            sim.addBuff(BUFFS.well_rested);
        }
    }
};