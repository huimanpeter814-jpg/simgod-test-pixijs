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

    /**
     * 🟢 [重构] 全方位离职判定逻辑
     * 综合考虑：经济压力、职业前景、性格匹配、家庭负担、身心健康
     */
    checkCareerSatisfaction(sim: Sim) {
        // 1. 基础拦截：无业、临时工、学生不需要辞职
        if (!sim.job || sim.job.id === 'unemployed') return;
        if (sim.isTemporary || sim.isNPC) return;
        if (sim.ageStage === AgeStage.Child || sim.ageStage === AgeStage.Teen) return; // 学生兼职暂时不处理辞职，由学校逻辑托管

        let quitScore = 0;
        const reasons: string[] = []; // 调试用，记录想辞职的原因

        // ==========================================
        // 📉 阻力因素 (减分项 - 让人不想/不敢辞职)
        // ==========================================

        // 1. 经济枷锁 (最核心的修复：穷人不敢辞职)
        // 假设每日生活成本约 50-100，存款不足 2000 (约1个月生活费) 时极度恐慌
        if (sim.money < 500) {
            quitScore -= 500; // 绝对不可能辞职，除非死掉
        } else if (sim.money < 2000) {
            quitScore -= 100; // 没钱，忍着
        } else if (sim.money < 5000) {
            quitScore -= 50;  // 手头紧，不敢动
        }

        // 2. 职位沉没成本 (等级越高越舍不得)
        // Level 1: -0, Level 2: -20, Level 3: -40, Level 4: -80
        if (sim.job.level > 1) {
            const sunkCost = Math.pow(sim.job.level, 2) * 5; 
            quitScore -= sunkCost;
        }

        // 3. 性格特质：稳重型
        if (sim.mbti.includes('J')) quitScore -= 10; // J人喜欢稳定
        if (sim.traits.includes('勤奋') || sim.traits.includes('工作狂')) quitScore -= 30;
        if (sim.lifeGoal.includes('富翁') || sim.lifeGoal.includes('大亨')) quitScore -= 20; // 搞钱要紧

        // 4. 高薪诱惑
        if (sim.job.salary > 200) quitScore -= 20;

        // ==========================================
        // 📈 动力因素 (加分项 - 让人想辞职)
        // ==========================================

        // 1. 身心健康 (崩溃边缘)
        if (sim.health < 30) {
            quitScore += 100; 
            reasons.push("身体垮了");
        }
        if (sim.mood < 20) {
            quitScore += 40;
            reasons.push("心情极差");
        }
        // 只有严重的负面状态才算数
        if (sim.hasBuff('burnout')) { quitScore += 50; reasons.push("严重职业倦怠"); }
        if (sim.hasBuff('depressed')) { quitScore += 30; reasons.push("抑郁"); }

        // 2. 财富自由 (有钱任性)
        if (sim.money > 50000) {
            quitScore += 40; 
            reasons.push("财富自由");
        } else if (sim.money > 20000) {
            quitScore += 10;
        }

        // 3. 人岗不匹配 (MBTI & 技能)
        // I人干销售/夜店 (E类工作)
        if (sim.mbti.includes('I') && ['nightlife', 'business', 'sales'].includes(sim.job.companyType as string)) {
            quitScore += 15;
            reasons.push("社恐干销售");
        }
        // F人(情感)干 逻辑类工作 (T类)
        if (sim.mbti.includes('F') && ['internet', 'logic', 'science'].includes(sim.job.companyType as string)) {
            quitScore += 10;
            reasons.push("感性做码农");
        }
        // 技能严重溢出 (怀才不遇) -> 只有当该职业没法升级时才生效
        // 简单判定：智商/核心技能远超当前职位要求
        if (sim.iq > 80 && sim.job.level === 1 && sim.age > 25) {
            quitScore += 10;
            reasons.push("怀才不遇");
        }

        // 4. 职业倦怠期 (随机波动)
        // 懒惰特质
        if (sim.traits.includes('懒惰')) quitScore += 15;
        // 自由散漫 (P人)
        if (sim.mbti.includes('P')) quitScore += 5;

        // 5. 家庭因素 (回归家庭)
        // 家里有婴儿(Infant/Toddler) + 没请保姆 + 且配偶更有钱/或者单亲
        const hasBaby = GameStore.sims.some(s => s.homeId === sim.homeId && [AgeStage.Infant, AgeStage.Toddler].includes(s.ageStage));
        if (hasBaby) {
            if (sim.traits.includes('家庭') || sim.lifeGoal.includes('家庭')) {
                quitScore += 50;
                reasons.push("想回家带娃");
            } else {
                quitScore += 10; // 普通人也会分心
            }
        }

        // 6. 老龄化 (退休)
        if (sim.ageStage === AgeStage.Elder) {
            quitScore += 80; // 老年人极大该率退休
            reasons.push("年事已高");
            // 除非是工作狂或者很穷
            if (sim.money < 5000) { quitScore -= 60; reasons.push("养老金不够"); }
        }

        // ==========================================
        // 🎲 最终判定
        // ==========================================
        
        // 设定一个较高的阈值，保证不会轻易离职
        // 只有当积怨已久(Score > 80) 时才纳入考虑
        const threshold = 80;

        if (quitScore > threshold) {
            // 即使分高，也只有 5% 的概率真的提离职 (犹豫期)
            // 这样模拟了人们"每天都想辞职，但第二天还是去上班"的状态
            const roll = Math.random();
            const chance = sim.traits.includes('冲动') ? 0.15 : 0.05;

            if (roll < chance) {
                // 1. 确定是退休还是辞职
                const isRetire = sim.ageStage === AgeStage.Elder;
                
                // 2. 整理原因字符串
                const reasonStr = reasons.join(' + ') || "个人发展原因";

                // 3. 🟢 [核心修改] 调用 fireSim 并传入详细原因
                // 注意：这里不再调用 GameStore.addLog，因为 fireSim 里已经统一写了
                this.fireSim(sim, isRetire ? 'retire' : 'resign', reasonStr);
                
                // 4. 保留气泡作为视觉反馈
                if (!isRetire) sim.say("世界那么大，我想去看看。", 'life');
                // 退休的气泡也在 fireSim 里处理了，这里可以不写，或者写个不一样的
            }
        }
    },

    /**
     * 🟢 [重构] 智能辞退判定逻辑
     * 综合考量：绩效、考勤、资历、职场政治、个人特质与运气
     */
    checkFire(sim: Sim) {
        // 1. 基础拦截：无业、临时工、NPC、未成年人不会被常规开除
        if (!sim.job || sim.job.id === 'unemployed') return;
        if (sim.isTemporary || sim.isNPC) return;
        if (sim.ageStage === AgeStage.Child || sim.ageStage === AgeStage.Teen) return; 

        let fireScore = 0;
        const reasons: string[] = [];

        // ==========================================
        // 🚨 风险积累 (Risk Accumulation)
        // ==========================================

        // 1. 核心指标：绩效 (Performance)
        // 范围通常是 -100 到 100
        // 只有负分才会有开除风险
        if (sim.workPerformance < 0) {
            // 基础分：绝对值。例如 -60 分 -> +60 风险
            fireScore += Math.abs(sim.workPerformance);
            
            // 严重不合格惩罚 (红线)
            if (sim.workPerformance < -60) {
                fireScore += 30;
                reasons.push("业绩长期不达标");
            }
        } else {
            // 绩效好可以作为"免死金牌"，抵消缺勤或性格问题
            // 例如 +50 分 -> 抵消 25 风险
            fireScore -= sim.workPerformance * 0.5;
        }

        // 2. 核心指标：考勤 (Attendance)
        if (sim.consecutiveAbsences > 0) {
            // 每一天旷工增加大量风险 (比绩效更严重，态度问题)
            let absencePenalty = sim.consecutiveAbsences * 30; 
            
            // [挽救判定] 尝试用口才/逻辑找借口
            // 逻辑(Logic)高编理由，魅力(Charisma)高求情，高情商(EQ)懂卖惨
            const excusePower = (sim.skills.logic || 0) * 0.5 + (sim.skills.charisma || 0) * 0.5 + (sim.eq || 50) * 0.2;
            // 难度随旷工天数指数级增加
            const excuseDifficulty = sim.consecutiveAbsences * 25; 
            
            if (Math.random() * 100 < (excusePower - excuseDifficulty)) {
                absencePenalty *= 0.4; // 成功糊弄过去，风险大幅降低
                // 只有小概率会冒泡，避免刷屏
                if (Math.random() > 0.8) sim.say("还好老板信了我的理由...😰", 'sys');
            } else {
                reasons.push(`连续旷工(${sim.consecutiveAbsences}天)`);
            }
            
            fireScore += absencePenalty;
        }

        // ==========================================
        // 🛡️ 职场护身符 (Protections)
        // ==========================================
        
        // A. 资历 (Level): 老员工(Level 3+)有豁免权，新人(Level 1)最容易背锅
        if (sim.job.level >= 3) fireScore -= 50; // 经理级别很难被动开除
        else if (sim.job.level === 2) fireScore -= 20;
        
        // B. 关键能力 (Competence): 智商高，老板舍不得开
        if (sim.iq > 85) fireScore -= 15;

        // C. 职场政治 (Office Politics)
        // 魅力高、情商高、E人(外向) -> 容易维护上下级关系
        if (sim.traits.includes('魅力') || (sim.skills.charisma || 0) > 40) fireScore -= 20;
        if (sim.eq > 70) fireScore -= 15;
        if (sim.mbti.startsWith('E')) fireScore -= 10;
        
        // D. 运气 (Luck)
        if (sim.traits.includes('幸运')) fireScore -= 30; // 锦鲤体质，总能化险为夷

        // ==========================================
        // 💣 危险因子 (Risk Factors)
        // ==========================================
        
        // A. 性格地雷
        if (sim.traits.includes('倒霉')) fireScore += 25; // 喝凉水都塞牙，裁员先裁他
        if (sim.traits.includes('懒惰')) fireScore += 20; // 摸鱼被发现
        if (sim.traits.includes('刻薄') || sim.traits.includes('邪恶')) fireScore += 20; // 同事联名投诉
        
        // B. 状态糟糕
        // 长期心情不好/健康差，容易在工作中出纰漏或发脾气
        if (sim.mood < 20) fireScore += 15;
        if (sim.health < 30) {
            fireScore += 20;
            reasons.push("健康状况堪忧");
        }

        // C. 人岗不匹配 (和辞职逻辑呼应)
        // I人做销售/夜店，容易被孤立或业绩差
        if (sim.mbti.startsWith('I') && ['sales', 'business', 'nightlife'].includes(sim.job.companyType as string)) {
            fireScore += 15;
        }

        // ==========================================
        // ⚖️ 最终裁决 (Final Judgment)
        // ==========================================
        
        const threshold = 100; // 风险阈值：满分100，超过即进入"待处理名单"
        
        if (fireScore > threshold) {
            // 并非达到阈值就一定开除，给予概率缓冲 (Russian Roulette)
            // 分数越高，概率越大
            
            // 基础概率 15% (给予一定的存活空间)
            let fireChance = 0.15;
            
            // 旷工零容忍：旷工3天以上概率直接拉满
            if (sim.consecutiveAbsences >= 3) fireChance = 0.95;
            
            // 绩效极差 (-90以下) 概率提升
            if (sim.workPerformance < -90) fireChance += 0.5;
            
            // 倒霉蛋概率加倍
            if (sim.traits.includes('倒霉')) fireChance *= 1.5;

            if (Math.random() < fireChance) {
                // --- 触发开除 ---
                const reasonType = sim.consecutiveAbsences >= 3 ? 'absent' : 'fired';
                
                // 1. 整理原因
                const finalReason = reasons.length > 0 ? reasons.join(' + ') : "综合表现不佳";
                
                // 2. 🟢 [核心修改] 传入 finalReason，移除这里的 console.log 和 GameStore.addLog
                this.fireSim(sim, reasonType, finalReason);
                
                // 3. 保留临场气泡
                if (sim.health < 30) sim.say("这时候失业...要命啊...", 'bad');
                else if (sim.money < 1000) sim.say("下个月房租怎么办...😭", 'bad');
                else sim.say("此处不留爷，自有留爷处！", 'bad');
                
            } else {
                // --- 侥幸逃脱 (严重警告) ---
                if (!sim.hasBuff('stressed')) sim.addBuff(BUFFS.stressed); 
                sim.say("老板找我谈话了...好险...", 'bad');
                GameStore.addLog(sim, "收到公司的【严重警告信】，请尽快改善表现！", 'career');
                if (sim.workPerformance < -50) sim.workPerformance = -45;
            }
        }
    },

    /**
     * 🟢 [重构] 执行离职/解雇的底层操作
     * @param sim 市民对象
     * @param type 类型：主动辞职 | 被开除 | 旷工辞退 | 退休
     * @param detail (可选) 详细原因字符串，用于生成更有趣的日志
     */
    fireSim(sim: Sim, type: 'resign' | 'fired' | 'absent' | 'retire', detail?: string) {
        const oldTitle = sim.job.title;
        const oldJobId = sim.job.id;

        // 1. 核心数据重置
        sim.job = JOBS.find(j => j.id === 'unemployed')!;
        sim.workplaceId = undefined;
        sim.workPerformance = 0;
        sim.consecutiveAbsences = 0;
        // 注意：不重置 dailyIncome，因为那是他今天已经赚到的钱，离职不能没收工资

        // 2. [关键修复] 状态立即中断
        // 如果市民正在工作、通勤，必须立刻打断，防止成为"幽灵员工"
        if (sim.action === SimAction.Working || sim.action === SimAction.Commuting) {
            sim.changeState(new IdleState());
            sim.path = []; // 清空寻路路径
            sim.target = null;
            sim.interactionTarget = null;
        }

        // 3. 区分类型处理 (日志 & Buff)
        switch (type) {
            case 'fired':
                // 开除：心情大跌，获得"被解雇"Buff
                GameStore.addLog(sim, detail ? `惨遭开除: ${detail}` : `被公司开除了 (${oldTitle})`, 'bad');
                sim.addBuff(BUFFS.fired); 
                sim.addBuff(BUFFS.sad); // 叠加一个悲伤
                sim.say("我的天呐...失业了...", 'bad');
                break;
                
            case 'absent':
                // 旷工辞退
                GameStore.addLog(sim, `因长期旷工被辞退`, 'bad');
                sim.addBuff(BUFFS.fired);
                sim.say("早就想到了...", 'normal');
                break;
                
            case 'resign':
                // 主动辞职：如释重负
                GameStore.addLog(sim, detail ? `辞职生效: ${detail}` : `辞去了 ${oldTitle} 的工作`, 'career');
                sim.addBuff(BUFFS.well_rested); // 感到轻松
                sim.addBuff(BUFFS.happy);       // 甚至有点开心
                // 根据原因稍微吐槽一下
                if (detail && detail.includes('富翁')) sim.say("不装了，我是亿万富翁。", 'money');
                else sim.say("拜拜了您嘞！", 'act');
                break;
                
            case 'retire':
                // 退休：光荣离开
                GameStore.addLog(sim, `从 ${oldTitle} 光荣退休`, 'life');
                sim.addBuff(BUFFS.happy); 
                sim.addBuff(BUFFS.relaxed); // 专属：退休生活
                sim.say("终于可以享受生活了...", 'life');
                break;
        }
    }
};