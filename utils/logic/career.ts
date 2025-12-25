import { Sim } from '../Sim';
import { GameStore } from '../simulation';
import { JOBS, BUFFS, HOLIDAYS } from '../../constants';
import { Furniture, JobType, SimAction, AgeStage, Job,NeedType } from '../../types';
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

    /**
     * 🟢 [重构] 智能入职分配
     * 不再随机盲选，而是基于市民的年龄、能力分和职位空缺进行"人岗匹配"
     */
    assignJob(sim: Sim) {
        // 1. 计算所有职业类型的匹配分 (Preferences & Competence)
        const scores: { type: JobType, score: number }[] = [];
        
        (Object.keys(JOB_PREFERENCES) as JobType[]).forEach(type => {
            if (type === JobType.Unemployed) return;
            const calculateScore = JOB_PREFERENCES[type];
            let score = calculateScore(sim);
            // [优化] 移除大幅度的随机扰动，改用微小浮动，保证高能力者稳定排在前面
            // 我们希望市民优先选择他真正擅长和喜欢的行业
            score += Math.random() * 5; 
            scores.push({ type, score });
        });

        // 按分数从高到低排序 (优先考虑最匹配的行业)
        scores.sort((a, b) => b.score - a.score);

        let assignedJob: Job | undefined = undefined;

        // 2. 遍历偏好列表，寻找最合适的职位
        for (const candidate of scores) {
            const jobType = candidate.type;
            const capabilityScore = candidate.score; // 这个分数通常在 40(普通) ~ 150(天才+梦想) 之间
            
            // 获取该类型下的所有职位定义
            const allJobs = JOBS.filter(j => j.companyType === jobType);
            
            // 3. [核心优化] 计算该市民在此行业的"胜任等级上限" (Max Competent Level)
            // 避免 40岁大牛去当实习生，也避免 20岁菜鸟空降CEO
            let maxLevel = 1; // 默认为实习生
            
            // A. 能力硬门槛 (基于 JobPreferences 计算出的分数)
            if (capabilityScore > 50) maxLevel = 2;  // 胜任中级 (熟手)
            if (capabilityScore > 90) maxLevel = 3;  // 胜任高级 (专家/经理)
            if (capabilityScore > 130) maxLevel = 4; // 胜任顶级 (合伙人/高管)

            // B. 年龄/阅历修正 (Age Ceiling)
            if (sim.ageStage === AgeStage.Teen) {
                // 青少年只能做兼职/实习 (Level 1)
                maxLevel = Math.min(maxLevel, 1); 
            } else if (sim.ageStage === AgeStage.Adult) {
                // 刚成年的(20-30岁)，除非绝世天才(score>130)，否则很难直接当CEO(Lvl 4)
                if (capabilityScore < 130) maxLevel = Math.min(maxLevel, 3);
            }
            // MiddleAged(中年) 和 Elder(老年) 不设上限，允许凭能力空降 Level 4

            // 4. 筛选出【有空缺】且【符合胜任等级】的职位
            const availableJobs = allJobs.filter(j => {
                // 排除超纲的职位
                if (j.level > maxLevel) return false;

                // 检查坑位容量
                const cap = this.getDynamicJobCapacity(j);
                const currentCount = GameStore.sims.filter(s => s.job.id === j.id).length;
                return currentCount < cap;
            });

            if (availableJobs.length > 0) {
                // 5. [优化] 加权选择：优先选择"人尽其才"的职位
                // 之前的逻辑是 heavily 偏向 Level 1，现在我们要偏向 maxLevel
                const weightedPool: Job[] = [];
                availableJobs.forEach(job => {
                    let weight = 1;
                    
                    // 如果职位等级正好是胜任等级，权重最高 (最匹配)
                    // 例如：能力够当经理，就优先分经理的活，而不是分实习生的活
                    if (job.level === maxLevel) weight += 30;
                    // 降一级也行 (屈就)
                    else if (job.level === maxLevel - 1) weight += 10;
                    // 再次之
                    else weight += 2;

                    // 特殊行业修正：学校总是缺人，稍微增加权重
                    if (jobType === JobType.School) weight += 5;
                    
                    for(let k=0; k<weight; k++) weightedPool.push(job);
                });
                
                assignedJob = weightedPool[Math.floor(Math.random() * weightedPool.length)];
                
                // 找到了最优解，停止遍历
                break; 
            }
        }

        // 6. 最终处理
        if (!assignedJob) {
            // 真的找不到工作 (极少情况，除非所有坑都满了)
            assignedJob = JOBS.find(j => j.id === 'unemployed');
            // 只有找了很久没找到才抱怨，避免刷屏
            if (Math.random() > 0.7) sim.say("行情不好，找不到工作...", 'bad');
        } else {
            // 入职成功
            const isDreamJob = scores[0].type === assignedJob.companyType;
            if (isDreamJob) {
                sim.addBuff(BUFFS.promoted); // 获得入职Buff
                sim.say(`入职了！目标：${assignedJob.title}`, 'act');
            } else {
                sim.say(`新工作：${assignedJob.title}`, 'normal');
            }
        }

        sim.job = assignedJob!;
        
        // 绑定办公地点等后续逻辑 (保持不变)
        if (sim.job.id !== 'unemployed') {
            this.bindWorkplace(sim);
        } else {
            sim.workplaceId = undefined;
        }

        // 通勤时间计算 (保持不变)
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

        // 🟢 [核心修复] 引入“生物钟偏差” (Personal Offset)
        // 利用 sim.id 的哈希值生成一个 -15 到 +15 分钟的固定偏差
        // 这样每个人的通勤时间点都是固定的，但人与人之间是错开的
        const idSum = sim.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const minuteOffset = (idSum % 31) - 15; // -15 ~ +15 分钟
        const hourOffset = minuteOffset / 60;

        const currentHour = GameStore.time.hour + GameStore.time.minute / 60;
        
        // 应用偏差
        const jobStart = sim.job.startHour + hourOffset; 
        const jobEnd = sim.job.endHour + hourOffset;

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
            // 🟢 [核心修复] 检查是否有办公地点，如果没有，尝试重新绑定
            if (!sim.workplaceId) {
                this.bindWorkplace(sim);
                // 如果绑定后还是没有 (说明地图上真没这公司)，则不要去上班，避免死循环
                if (!sim.workplaceId) {
                    if (Math.random() < 0.01) sim.say("公司倒闭了? 没地儿上班", 'bad');
                    return;
                }
            }

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

    /**
     * 🟢 [重构] 每日绩效结算
     * 核心逻辑：绩效不再是随机数，而是由 "状态 + 能力 + 态度" 共同决定
     */
    updatePerformance(sim: Sim) {
        let delta = 0;
        const logs: { factor: string, score: number }[] = [];
        // 辅助函数：记录得分
        const addScore = (factor: string, score: number) => {
            if (score === 0) return;
            delta += score;
            logs.push({ factor, score });
        };

        // 1. 状态基础分 (Mood & Needs)
        // 只有身心愉悦，才能高效产出
        if (sim.mood > 80) delta += 3;
        else if (sim.mood < 40) delta -= 3;

        // 精力是打工人的电池
        if (sim.needs[NeedType.Energy] > 80) delta += 2;
        if (sim.needs[NeedType.Energy] < 30) delta -= 5; // 累了会严重影响产出

        // 2. 核心胜任力 (Competence): 你的能力是否配得上这个职位？
        // 职位等级越高，对能力数值要求越高 (L1:25, L2:50, L3:75, L4:100)
        const requiredStat = sim.job.level * 25; 
        let myStat = 0;
        let statName = "综合能力";
        
        // 根据职业类型，考核不同的核心属性
        switch(sim.job.companyType) {
            case JobType.Internet: 
            case JobType.Hospital:
            case JobType.School:
                // 脑力密集型：看智商和逻辑
                myStat = Math.max(sim.iq, sim.skills.logic);
                statName = "逻辑/智商";
                break;
            case JobType.Business:
            case JobType.Store:
            case JobType.Nightlife:
                // 社交密集型：看情商和魅力
                myStat = Math.max(sim.eq, sim.skills.charisma || 0);
                statName = "社交/魅力";
                break;
            case JobType.Design:
                // 创意密集型
                myStat = Math.max(sim.creativity, sim.skills.creativity || 0);
                statName = "创意能力";
                break;
            case JobType.Restaurant:
                myStat = sim.skills.cooking;
                statName = "烹饪技能";
                break;
            case JobType.ElderCare:
                myStat = Math.max(sim.constitution, sim.eq);
                statName = "体能/耐心";
                break;
            default:
                myStat = 50; // 兜底
        }

        // 胜任力判定
        if (myStat > requiredStat + 30) addScore(`能力出众 (${statName})`, 5);      // 降维打击 (大材小用，业绩起飞)
        else if (myStat > requiredStat + 10) addScore(`能力优秀 (${statName})`, 3); // 游刃有余
        else if (myStat > requiredStat - 10) addScore(`能力达标`, 1); // 勉强胜任
        else addScore(`能力不足 (${statName})`, -4);                                 // 德不配位 (能力不足，业绩下滑)

        // 3. 态度与特质 (Attitude)
        if (sim.traits.includes('勤奋') || sim.traits.includes('工作狂')) addScore("勤奋特质", 3);
        if (sim.traits.includes('懒惰')) addScore("偷懒摸鱼", -3);
        if (sim.traits.includes('完美主义')) addScore("太纠结细节/完美作品", (Math.random() > 0.5 ? 4 : -1)); // 纠结细节，要么神作要么延期

        // 4. Buff 修正
        if (sim.hasBuff('well_rested')) addScore("休息充分", 2);
        if (sim.hasBuff('stressed')) addScore("压力过大", -2);
        if (sim.hasBuff('promoted')) addScore("新官上任三把火", 5); // 新官上任三把火
        
        // 5. 随机波动 (职场意外)
        const luckScore = Math.floor(Math.random() * 6) - 2;
        if (luckScore !== 0) addScore("职场运气", luckScore);

        // === 结算 ===
        sim.workPerformance += delta;
        sim.workPerformance = Math.max(-100, Math.min(200, sim.workPerformance));

        // [新增] 保存日志到 Sim 对象，供前端展示
        sim.dailyWorkLog = logs;
        // 触发升职检查 (只有绩效非常优秀时才尝试)
        if (sim.workPerformance > 100) {
            this.promote(sim);
        }
    },

    /**
     * 🟢 [重构] 升职判定
     * 引入"软技能"考核和更严格的竞争机制
     */
    promote(sim: Sim) {
        const currentLevel = sim.job.level;
        if (currentLevel >= 4) return; // 已到天花板

        // 1. 动态门槛 (Threshold)
        // 越往上越难升：L1->2 (100分), L2->3 (130分), L3->4 (160分)
        // 防止平庸之辈轻易混入高层
        const threshold = 100 + (currentLevel - 1) * 30;
        if (sim.workPerformance < threshold) return;

        // 2. 寻找下一级职位
        // 必须是同公司类型的上一级
        let nextJob = JOBS.find(j => 
            j.companyType === sim.job.companyType && 
            j.level === currentLevel + 1
        );
        
        // [特殊修复] 允许教师/医生跨头衔晋升 (如 小学老师 -> 中学老师 -> 校长)
        // 只要是同类型且Level+1即可，不再强制检查 title 字面量
        if (!nextJob) return;

        // 3. 管理岗位的"软技能"硬性考核 (Soft Skills Check)
        // 想升管理层 (Level 3+)，情商或魅力必须及格，否则业务再好也不能带团队
        if (nextJob.level >= 3) {
            const softSkill = Math.max(sim.eq, sim.skills.charisma || 0);
            if (softSkill < 40) {
                 // 只有小概率提示，避免刷屏
                 if (Math.random() < 0.05) sim.say("业务能力强，但管理能力还差点...", 'sys');
                 return;
            }
        }

        // 4. 坑位竞争 (Vacancy & Competition)
        const cap = this.getDynamicJobCapacity(nextJob);
        const holders = GameStore.sims.filter(s => s.job.id === nextJob.id);
        
        if (holders.length < cap) {
            // 有空缺，直接晋升
            this.executePromotion(sim, nextJob);
        } else {
            // 没空缺，触发 PK 机制
            // 找出占着茅坑表现最差的人
            const victim = holders.sort((a, b) => a.workPerformance - b.workPerformance)[0];
            
            // 挑战者必须比受害者高出一大截 (30分) 才能挤掉，防止频繁换血
            const pkThreshold = 30; 
            
            if (sim.workPerformance > victim.workPerformance + pkThreshold) {
                // 晋升挑战者
                this.executePromotion(sim, nextJob);
                
                // 降职受害者
                const oldJob = JOBS.find(j => j.companyType === sim.job.companyType && j.level === currentLevel); // 降回挑战者原来的等级
                if (oldJob) {
                    victim.job = oldJob;
                    victim.workPerformance = 70; // 降职后保留及格分
                    victim.addBuff(BUFFS.demoted);
                    GameStore.addLog(victim, `在与 ${sim.name} 的职场竞争中落败，惨遭降职。`, 'career');
                    victim.say("可恶...被新人挤下去了...", 'bad');
                }
            } else {
                 // 没挤掉
                 if (Math.random() < 0.05) sim.say("上面没坑位了，升不上去...", 'bad');
            }
        }
    },

    /**
     * 🟢 [新增] 执行升职的原子操作
     */
    executePromotion(sim: Sim, newJob: Job) {
        sim.job = newJob;
        // 升职后绩效重置到中等偏上 (50)，而不是清零，保留一点"余威"
        sim.workPerformance = 50; 
        sim.money += 1000; // 升职奖金
        sim.addBuff(BUFFS.promoted);
        
        sim.say(`耶！晋升为 ${newJob.title} ！`, 'act');
        GameStore.addLog(sim, `凭杰出表现晋升为 【${newJob.title}】`, 'career');
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