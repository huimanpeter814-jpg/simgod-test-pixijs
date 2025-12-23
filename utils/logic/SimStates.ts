import { Sim } from '../Sim';
import { GameStore } from '../simulation';
import { SimAction, JobType, NeedType, AgeStage, Furniture } from '../../types';
import { CareerLogic } from './career';
import { DecisionLogic } from './decision';
import { SocialLogic } from './social';
import { SchoolLogic } from './school';
import { INTERACTIONS, RESTORE_TIMES } from './interactionRegistry';
import { hasRequiredTags } from '../simulationHelpers';
import { PLOTS } from '../../data/plots'; // [新增] 引入 PLOTS 用于查表

// === 1. 状态接口定义 ===
export interface SimState {
    actionName: SimAction | string; 
    enter(sim: Sim): void;
    update(sim: Sim, dt: number): void;
    exit(sim: Sim): void;
}

// === 2. 基础状态 ===
export abstract class BaseState implements SimState {
    abstract actionName: string;
    enter(sim: Sim): void {}
    update(sim: Sim, dt: number): void { this.decayNeeds(sim, dt); }
    exit(sim: Sim): void {}
    protected decayNeeds(sim: Sim, dt: number, exclude: NeedType[] = []) { sim.decayNeeds(dt, exclude); }
}

// === 过渡状态 (平滑动画) ===
export class TransitionState extends BaseState {
    actionName = 'transition';
    targetPos: { x: number, y: number };
    nextStateFactory: () => SimState;
    duration: number = 0.5; // 秒
    elapsed: number = 0;
    startPos: { x: number, y: number } | null = null;

    constructor(targetPos: {x: number, y: number}, nextStateFactory: () => SimState) {
        super();
        this.targetPos = targetPos;
        this.nextStateFactory = nextStateFactory;
    }

    enter(sim: Sim) {
        this.startPos = { ...sim.pos };
        this.elapsed = 0;
        sim.path = []; 
        sim.target = null; // 停止寻路系统，完全由动画接管
    }

    update(sim: Sim, dt: number) {
        // 将 dt (帧数) 转换为秒，粗略估计 60fps
        const dtSeconds = dt / 60; 
        this.elapsed += dtSeconds;
        const t = Math.min(1, this.elapsed / this.duration);
        
        // Ease Out Cubic
        const easeT = 1 - Math.pow(1 - t, 3);

        if (this.startPos) {
            sim.pos.x = this.startPos.x + (this.targetPos.x - this.startPos.x) * easeT;
            sim.pos.y = this.startPos.y + (this.targetPos.y - this.startPos.y) * easeT;
        }

        if (t >= 1) {
            sim.pos = { ...this.targetPos };
            sim.changeState(this.nextStateFactory());
        }
    }
}

// --- 空闲状态 ---
export class IdleState extends BaseState {
    actionName = SimAction.Idle;

    enter(sim: Sim) {
        sim.target = null;
        sim.interactionTarget = null;
        sim.path = [];
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);

        if (sim.decisionTimer > 0) {
            sim.decisionTimer -= dt;
        } else {
            // 婴幼儿逻辑
            if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                // 🚨 [修复] 增加 !sim.getHomeLocation() 判断
                // 如果已经在家里，或者根本没有家(流浪/家被拆了)，则不要呼叫接送，直接在当前位置活动
                if (sim.isAtHome() || !sim.getHomeLocation()) {
                    // 在家或流浪：就地玩耍/睡觉
                    DecisionLogic.decideAction(sim); 
                } else {
                    // 在外面 (且确实有家可回)：主动呼叫接送
                    sim.say("我要回家...", 'bad');
                    SchoolLogic.arrangePickup(sim);
                    
                    if (sim.action !== SimAction.Waiting) {
                        sim.changeState(new WaitingState());
                    }
                }
            } else {
                DecisionLogic.decideAction(sim);
            }
            sim.decisionTimer = 60 + Math.random() * 60;
        }
    }
}


// --- 等待状态 (重要：用于婴儿等待接送) ---
export class WaitingState extends BaseState {
    actionName = SimAction.Waiting;
    timeoutTimer = 0; // [新增] 超时计时器

    enter(sim: Sim) {
        sim.target = null;
        sim.path = [];
        sim.say("...", 'sys');
        this.timeoutTimer = 350; 
    }

    update(sim: Sim, dt: number) {
        // [新增] 超时检查
        this.timeoutTimer -= dt;
        if (this.timeoutTimer <= 0) {
            sim.say("没人理我...", 'bad');
            sim.changeState(new IdleState()); // 回到 Idle，这样下一次 update 就会重新触发 decideAction -> 重新呼叫父母
        }
    }
}
// --- 移动状态 ---
export class MovingState extends BaseState {
    actionName: string;
    stuckTimer: number = 0;
    lastPos: { x: number, y: number } = { x: 0, y: 0 };

    constructor(actionName: string = SimAction.Moving) {
        super();
        this.actionName = actionName;
    }

    enter(sim: Sim) {
        super.enter(sim);
        this.stuckTimer = 0;
        this.lastPos = { x: sim.pos.x, y: sim.pos.y };
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        
        // 1. 卡死检测
        const distMoved = (sim.pos.x - this.lastPos.x)**2 + (sim.pos.y - this.lastPos.y)**2;
        if (distMoved < 0.01) {
            this.stuckTimer += dt;
        } else {
            this.stuckTimer = 0;
            this.lastPos = { x: sim.pos.x, y: sim.pos.y };
        }

        if (this.stuckTimer > 300) { // 约5秒不动
            if (sim.target) {
                // 如果离目标很近 (50px)，瞬移
                const distToTarget = (sim.target.x - sim.pos.x)**2 + (sim.target.y - sim.pos.y)**2;
                if (distToTarget < 2500) {
                    sim.pos = { ...sim.target };
                    this.handleArrival(sim);
                } else {
                    // 离得远还卡住，说明寻路失败
                    sim.say("过不去...", 'sys');
                    sim.changeState(new IdleState());
                }
            } else {
                sim.changeState(new IdleState());
            }
            return;
        }

        // 2. 执行移动
        const arrived = sim.moveTowardsTarget(dt);
        if (arrived) {
            this.handleArrival(sim);
        }
    }

    private handleArrival(sim: Sim) {
        if (sim.interactionTarget) { 
            sim.startInteraction(); 
        } else {
            sim.changeState(new IdleState());
        }
    }
}

// --- 通勤状态 ---
export class CommutingState extends BaseState {
    actionName = SimAction.Commuting;
    phase: 'to_plot' | 'to_station' = 'to_station';
    // 🆕 修复：添加卡死检测变量
    stuckTimer: number = 0;
    lastPos: { x: number, y: number } = { x: 0, y: 0 };
    enter(sim: Sim) {
        sim.path = [];
        sim.commuteTimer = 0;
        this.stuckTimer = 0;
        this.lastPos = { x: sim.pos.x, y: sim.pos.y };
        const station = this.findWorkstation(sim);
        if (station) {
            this.phase = 'to_station';
            sim.target = { x: station.x + station.w/2, y: station.y + station.h + 5 };
            sim.interactionTarget = { ...station, utility: 'work' };
            sim.say("去工位...", 'act');
        } else if (sim.workplaceId) {
            this.phase = 'to_plot';
            const plot = GameStore.worldLayout.find(p => p.id === sim.workplaceId);
            if (plot) {
                sim.target = { x: plot.x + (plot.width||300)/2 + (Math.random()-0.5)*50, y: plot.y + (plot.height||300)/2 + (Math.random()-0.5)*50 };
                sim.say("去单位...", 'act');
            } else { sim.say("公司倒闭了?!", 'bad'); sim.changeState(new IdleState()); }
        } else { sim.say("开始搬砖", 'act'); sim.changeState(new WorkingState()); }
    }
    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        if (sim.moveTowardsTarget(dt)) {
            sim.changeState(new WorkingState());
        }
    }
    private handleArrival(sim: Sim) {
        if (this.phase === 'to_plot') {
            sim.lastPunchInTime = GameStore.time.hour + GameStore.time.minute / 60;
            if (sim.lastPunchInTime > sim.job.startHour + 0.1) { sim.say("迟到了！😱", 'bad'); sim.workPerformance -= 5; } else { sim.say("打卡成功", 'sys'); }
            
            const station = this.findWorkstation(sim);
            if (station) {
                this.phase = 'to_station';
                sim.target = { x: station.x + station.w/2, y: station.y + station.h + 5 };
                sim.interactionTarget = { ...station, utility: 'work' };
                this.stuckTimer = 0;
                sim.path = [];
            } else { 
                sim.say("没位置了...", 'bad'); 
                sim.changeState(new WorkingState()); 
            }
        } else { 
            sim.changeState(new WorkingState()); 
        }
    }
    private findWorkstation(sim: Sim): Furniture | null {
        const requiredTags = sim.job.requiredTags || ['work'];
        if (sim.workplaceId) {
            const plotFurniture = GameStore.furnitureByPlot.get(sim.workplaceId) || [];
            const candidates = plotFurniture.filter(f => hasRequiredTags(f, requiredTags));
            const free = candidates.filter(f => !this.isOccupied(f, sim.id));
            if (free.length > 0) return this.selectBest(sim, free);
            if (Math.random() < 0.1) sim.say("公司没位置了...", 'bad');
            return null; 
        }
        let validCandidates: Furniture[] = [];
        if (sim.homeId) {
            const homeFurniture = GameStore.furniture.filter(f => f.homeId === sim.homeId);
            validCandidates = validCandidates.concat(homeFurniture.filter(f => hasRequiredTags(f, requiredTags)));
        }
        const publicWorkPlots = GameStore.worldLayout.filter(p => p.templateId === 'netcafe' || p.templateId === 'library' || p.customName?.includes('网咖'));
        publicWorkPlots.forEach(plot => {
            const furnitureInPlot = GameStore.furnitureByPlot.get(plot.id) || [];
            validCandidates = validCandidates.concat(furnitureInPlot.filter(f => hasRequiredTags(f, requiredTags)));
        });
        const allFree = validCandidates.filter(f => !this.isOccupied(f, sim.id));
        if (allFree.length > 0) return this.selectBest(sim, allFree);
        return null;
    }
    private isOccupied(f: Furniture, selfId: string): boolean {
        if (f.multiUser) return false;
        return GameStore.sims.some(s => s.id !== selfId && (s.interactionTarget?.id === f.id || (s.target && s.target.x === f.x + f.w/2 && Math.abs(s.target.y - (f.y + f.h)) < 10)));
    }
    private selectBest(sim: Sim, candidates: Furniture[]): Furniture {
        if (candidates.length < 5) return candidates[Math.floor(Math.random() * candidates.length)];
        let best = candidates[0];
        let minDist = Number.MAX_VALUE;
        candidates.forEach(f => {
            const dist = Math.pow(f.x - sim.pos.x, 2) + Math.pow(f.y - sim.pos.y, 2);
            if (dist < minDist) { minDist = dist; best = f; }
        });
        return best;
    }
}

// --- 工作状态 ---
export class WorkingState extends BaseState {
    actionName = SimAction.Working;
    subStateTimer = 0;
    
    update(sim: Sim, dt: number) {
        super.update(sim, dt);

        // 🆕 [需求] 工作期间特殊需求处理
        // 1. 如果饥饿或如厕太低，自动恢复到安全线 (60-80)
        if (sim.needs[NeedType.Hunger] < 20) {
            sim.needs[NeedType.Hunger] = 60 + Math.random() * 20;
            sim.say("偷偷吃点东西...", 'act');
        }
        if (sim.needs[NeedType.Bladder] < 20) {
            sim.needs[NeedType.Bladder] = 80;
            sim.say("去趟洗手间", 'act');
        }

        // 2. 如果精力耗尽，提前结束工作并获得对应工资
        if (sim.needs[NeedType.Energy] <= 0) {
            sim.say("实在太困了... 撑不住了", 'bad');
            CareerLogic.leaveWorkEarly(sim);
            return;
        }

        const rate = 0.005 * dt;
        switch (sim.job.companyType) {
            case JobType.Internet: sim.skills.logic += rate; break;
            case JobType.Design: sim.skills.creativity += rate; break;
            case JobType.Restaurant: sim.skills.cooking += rate; break;
            case JobType.Nightlife: sim.skills.music += rate; sim.skills.dancing += rate; break;
            case JobType.Hospital: sim.skills.logic += rate; break;
            case JobType.Store: sim.eq = Math.min(100, sim.eq + rate); break;
        }
        if (Math.random() < 0.0005 * dt) {
            const nearby = GameStore.sims.find(s => s.id !== sim.id && s.workplaceId === sim.workplaceId && Math.abs(s.pos.x - sim.pos.x) < 80 && Math.abs(s.pos.y - sim.pos.y) < 80);
            if (nearby) {
                const topics = ["在那边怎么样？", "老板今天很凶...", "中午吃啥？", "周末去哪玩？", "这项目真难搞"];
                sim.say(topics[Math.floor(Math.random() * topics.length)], 'normal');
                SocialLogic.updateRelationship(sim, nearby, 'friendship', 1);
                if (Math.random() < 0.1 && sim.orientation !== 'aro') { SocialLogic.triggerJealousy(sim, nearby, sim); }
            }
        }
        this.subStateTimer -= dt;
        if (this.subStateTimer > 0) return;
        this.subStateTimer = 300 + Math.random() * 300; 
        const jobType = sim.job.companyType;
        const jobTitle = sim.job.title;
        const plot = sim.workplaceId ? GameStore.worldLayout.find(p => p.id === sim.workplaceId) : null;
        if (plot && ((jobType === JobType.Restaurant && jobTitle.includes('服务')) || (jobType === JobType.Store && !jobTitle.includes('收银')) || (jobType === JobType.Hospital && jobTitle.includes('护士')) || (jobType === JobType.ElderCare))) {
            const tx = plot.x + 20 + Math.random() * ((plot.width||300) - 40);
            const ty = plot.y + 20 + Math.random() * ((plot.height||300) - 40);
            sim.target = { x: tx, y: ty };
            sim.moveTowardsTarget(dt);
        } else if (jobType === JobType.School && (jobTitle.includes('师') || jobTitle.includes('教'))) {
            if (Math.random() > 0.7) sim.say("同学们看黑板...", 'act');
        } else if (jobType === JobType.Hospital && jobTitle.includes('医')) {
             if (Math.random() > 0.8 && sim.workplaceId) {
                 const bed = GameStore.furniture.find(f => f.id.startsWith(sim.workplaceId!) && f.label.includes('病床'));
                 if (bed) { sim.target = { x: bed.x + 20, y: bed.y + bed.h + 5 }; }
             }
        }
    }
}

// --- 上学通勤 ---
export class CommutingSchoolState extends BaseState {
    actionName = SimAction.CommutingSchool;
    enter(sim: Sim) {
        // 目标已经在 SchoolLogic 中设置好了
        if (!sim.target) sim.changeState(new IdleState());
    }
    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        if (sim.moveTowardsTarget(dt)) {
            sim.changeState(new SchoolingState());
            sim.say("开始上课", 'act');
        }
    }
}

// 上学状态
export class SchoolingState extends BaseState {
    actionName = SimAction.Schooling;
    decisionTimer = 0;
    isInteracting = false;

    // [新增 1] 卡死检测变量
    stuckTimer = 0;
    lastPos = { x: 0, y: 0 };

    enter(sim: Sim) {
        sim.target = null;
        sim.path = [];
        this.decisionTimer = 60;
        // [新增 1] 初始化卡死检测
        this.stuckTimer = 0;
        this.lastPos = { x: sim.pos.x, y: sim.pos.y };
    }

    update(sim: Sim, dt: number) {
        // 1. 基础数值变化
        sim.needs[NeedType.Fun] -= 0.001 * dt; 
        sim.skills.logic += 0.003 * dt; 
        
        // 2. 移动中
        // 2. 移动中
        if (sim.target) {
            // [新增 1] 卡死检测逻辑：如果位置几乎没变，就开始计时
            const distMoved = (sim.pos.x - this.lastPos.x)**2 + (sim.pos.y - this.lastPos.y)**2;
            if (distMoved < 0.01) {
                this.stuckTimer += dt;
            } else {
                this.stuckTimer = 0;
                this.lastPos = { x: sim.pos.x, y: sim.pos.y };
            }

            // 如果卡住超过 5秒 (约300帧)，放弃当前目标，立即重新决策
            if (this.stuckTimer > 300) {
                sim.target = null;
                this.stuckTimer = 0;
                this.decisionTimer = 0; // 归零倒计时，下一帧立刻触发 makeDecision
                sim.say("过不去...", 'sys');
                return;
            }
            const arrived = sim.moveTowardsTarget(dt);
            if (arrived) {
                sim.target = null;
                this.isInteracting = true;
                this.stuckTimer = 0; // 到达后重置
                sim.actionTimer = 300 + Math.random() * 300; 
                
                if (sim.interactionTarget) {
                    // === 差异化互动气泡 ===
                    if (sim.interactionTarget.type === 'human') {
                        this.doSocialInteraction(sim, sim.interactionTarget.ref);
                    } else {
                        // 玩设施/学习
                        this.doObjectInteraction(sim, sim.interactionTarget);
                    }
                }
            }
            return;
        }

        // 3. 互动中
        if (this.isInteracting) {
            sim.actionTimer -= dt;
            if (sim.actionTimer <= 0) {
                this.isInteracting = false;
                this.decisionTimer = 100 + Math.random() * 100; 
                sim.interactionTarget = null;
            }
            return;
        }

        // 4. 决策
        this.decisionTimer -= dt;
        if (this.decisionTimer <= 0) {
            this.makeDecision(sim);
        }
    }

    private doSocialInteraction(sim: Sim, target: Sim) {
        let topics: string[] = [];
        sim.needs[NeedType.Social] += 20;

        if (sim.ageStage === AgeStage.Teen) {
            topics = ["周末去哪玩？", "听说隔壁班...", "这题太难了", "好困啊...", "那个谁好帅/美", "借我笔记抄抄"];
            // 中学生社交稍微恢复一点娱乐
            sim.needs[NeedType.Fun] += 10;
        } else if (sim.ageStage === AgeStage.Child) {
            topics = ["作业写完没？", "放学去探险！", "你是笨蛋 😝", "老师来了！", "换卡片吗？"];
            sim.needs[NeedType.Fun] += 15;
        } else {
            // 幼儿园
            topics = ["老师看我！", "抱抱~", "给你糖", "一起玩！", "我要妈妈..."];
            sim.needs[NeedType.Fun] += 20;
        }

        // 如果对象是老师(成年人)，覆盖话题
        if (target.ageStage >= AgeStage.Adult) {
            if (sim.ageStage === AgeStage.Teen) topics = ["老师，这题怎么做？", "作业忘带了...", "下次不敢了"];
            else if (sim.ageStage === AgeStage.Child) topics = ["老师我要上厕所！", "他打我！", "作业本丢了"];
            else topics = ["老师抱抱~", "肚肚饿...", "我要回家"];
        }

        sim.say(topics[Math.floor(Math.random() * topics.length)], 'social');
    }

    private doObjectInteraction(sim: Sim, target: any) {
        if (sim.ageStage === AgeStage.Teen) {
            if (target.utility === 'book' || target.label?.includes('书')) {
                sim.say("突击复习...", 'act');
                sim.skills.logic += 0.5; // 学习加成
            } else if (target.utility === 'gym' || target.utility === 'run') {
                sim.say("挥洒汗水！", 'act');
                sim.needs[NeedType.Fun] += 20;
            } else {
                sim.say("摸鱼中...", 'sys');
                sim.needs[NeedType.Fun] += 10;
            }
        } else {
            sim.say("好玩！", 'fun');
            sim.needs[NeedType.Fun] += 30;
        }
    }

    private makeDecision(sim: Sim) {
        // 1. 确定学校类型和地块
        let schoolType = 'kindergarten';
        if (sim.ageStage === AgeStage.Child) schoolType = 'elementary';
        else if (sim.ageStage === AgeStage.Teen) schoolType = 'high_school';

        const plot = GameStore.worldLayout.find(p => p.templateId === schoolType);
        
        if (!plot) { this.decisionTimer = 200; return; }

        const area = {
            minX: plot.x + 20,
            maxX: plot.x + (plot.width || 300) - 20,
            minY: plot.y + 20,
            maxY: plot.y + (plot.height || 300) - 20
        };

        // 跑出界了就回来
        if (sim.pos.x < area.minX || sim.pos.x > area.maxX || sim.pos.y < area.minY || sim.pos.y > area.maxY) {
            sim.target = { x: (area.minX + area.maxX) / 2, y: (area.minY + area.maxY) / 2 };
            return;
        }

        // === 差异化行为逻辑 ===
        if (sim.ageStage === AgeStage.Teen) {
            this.decideForTeen(sim, plot, area);
        } else if (sim.ageStage === AgeStage.Child) {
            this.decideForChild(sim, plot, area);
        } else {
            this.decideForKindergarten(sim, plot, area);
        }
    }

    // 中学生行为模式
    private decideForTeen(sim: Sim, plot: any, area: any) {
        const rand = Math.random();
        
        // 40% 社交 (更喜欢找同龄人聊天/早恋)
        if (rand < 0.4) {
            if (this.findPeerToInteract(sim, area)) return;
        }
        
        // 30% 学习/休息 (找书架、桌子、长椅、贩卖机)
        if (rand < 0.7) {
            const props = GameStore.furnitureByPlot.get(plot.id)?.filter(f => 
                f.utility === 'book' || f.label.includes('书') || 
                f.label.includes('桌') || f.label.includes('椅') || 
                f.utility === 'vending'
            ) || [];
            if (props.length > 0) {
                this.goToObject(sim, props);
                return;
            }
        }

        // 20% 运动 (如果操场有篮球架或跑道)
        if (rand < 0.9) {
            const sports = GameStore.furnitureByPlot.get(plot.id)?.filter(f => 
                f.utility === 'gym' || f.utility === 'run' || f.label.includes('球')
            ) || [];
            if (sports.length > 0) {
                this.goToObject(sim, sports);
                return;
            }
        }

        // 10% 闲逛
        this.wanderInArea(sim, area);
    }

    // 小学生行为模式
    private decideForChild(sim: Sim, plot: any, area: any) {
        const rand = Math.random();

        // 40% 玩设施 (操场、滑梯)
        if (rand < 0.4) {
            const toys = GameStore.furnitureByPlot.get(plot.id)?.filter(f => 
                f.utility === 'play' || f.utility === 'fun' || f.label.includes('滑梯')
            ) || [];
            if (toys.length > 0) {
                this.goToObject(sim, toys);
                return;
            }
        }

        // 30% 找同学 (打闹)
        if (rand < 0.7) {
            if (this.findPeerToInteract(sim, area)) return;
        }

        // 20% 找老师 (告状/问问题)
        if (rand < 0.9) {
            if (this.findAdultToInteract(sim, area)) return;
        }

        this.wanderInArea(sim, area);
    }

    // 幼儿园行为模式 (保持之前的逻辑)
    private decideForKindergarten(sim: Sim, plot: any, area: any) {
        // 1. 优先检查精力，如果困了就去睡午觉
        const hour = GameStore.time.hour;
        const isNapTime = hour >= 12 && hour <= 14;
        
        if (sim.needs[NeedType.Energy] < 40 || isNapTime) {
            const cribs = GameStore.furnitureByPlot.get(plot.id)?.filter(f => 
                f.utility === 'nap_crib' || f.tags?.includes('bed')
            ) || [];
            if (cribs.length > 0) {
                const freeCribs = cribs.filter(c => !GameStore.sims.some(s => s.id !== sim.id && s.interactionTarget?.id === c.id));
                if (freeCribs.length > 0) {
                    this.goToObject(sim, freeCribs);
                    return;
                }
            }
        }

        // 原有的随机行为
        const rand = Math.random();
        if (rand < 0.4) {
            const toys = GameStore.furnitureByPlot.get(plot.id)?.filter(f => f.utility === 'play' || f.utility === 'fun') || [];
            if (toys.length > 0) { this.goToObject(sim, toys); return; }
        }
        if (rand < 0.7) { if (this.findAdultToInteract(sim, area)) return; }
        if (rand < 0.9) { if (this.findPeerToInteract(sim, area)) return; }
        
        this.wanderInArea(sim, area);
    }

    // === 辅助方法 ===

    private goToObject(sim: Sim, candidates: any[]) {
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        sim.target = { x: target.x + target.w/2, y: target.y + target.h + 10 };
        sim.interactionTarget = target;
    }

    private findPeerToInteract(sim: Sim, area: any): boolean {
        const peers = GameStore.sims.filter(s => 
            s.id !== sim.id && 
            s.ageStage === sim.ageStage && // 同龄人
            s.pos.x > area.minX && s.pos.x < area.maxX &&
            s.pos.y > area.minY && s.pos.y < area.maxY
        );
        if (peers.length > 0) {
            const peer = peers[Math.floor(Math.random() * peers.length)];
            sim.target = { x: peer.pos.x + 20, y: peer.pos.y };
            sim.interactionTarget = { type: 'human', ref: peer };
            return true;
        }
        return false;
    }

    private findAdultToInteract(sim: Sim, area: any): boolean {
        const adults = GameStore.sims.filter(s => 
            s.id !== sim.id && 
            s.ageStage >= AgeStage.Adult &&
            s.pos.x > area.minX && s.pos.x < area.maxX &&
            s.pos.y > area.minY && s.pos.y < area.maxY
        );
        if (adults.length > 0) {
            const adult = adults[Math.floor(Math.random() * adults.length)];
            sim.target = { x: adult.pos.x + 15, y: adult.pos.y };
            sim.interactionTarget = { type: 'human', ref: adult };
            return true;
        }
        return false;
    }

    private wanderInArea(sim: Sim, area: any) {
        const tx = area.minX + Math.random() * (area.maxX - area.minX);
        const ty = area.minY + Math.random() * (area.maxY - area.minY);
        sim.target = { x: tx, y: ty };
        this.decisionTimer = 100 + Math.random() * 200;
    }
}

// --- 通用交互 ---
export class InteractionState extends BaseState {
    actionName: string;
    constructor(actionName: string) { super(); this.actionName = actionName; }
    update(sim: Sim, dt: number) {
        const obj = sim.interactionTarget;
        const f = 0.0008 * dt;
        const getRate = (mins: number) => (100 / (mins * 60)) * dt;
        const excludeDecay: NeedType[] = [];
        if (this.actionName === SimAction.Sleeping) excludeDecay.push(NeedType.Energy);
        if (this.actionName === SimAction.Eating) excludeDecay.push(NeedType.Hunger);
        if (this.actionName === SimAction.Talking) excludeDecay.push(NeedType.Social);
        this.decayNeeds(sim, dt, excludeDecay);
        if (this.actionName === SimAction.Talking) { sim.needs[NeedType.Social] += getRate(RESTORE_TIMES[NeedType.Social]); }
        else if (obj) {
            let handler = INTERACTIONS[obj.utility];
            if (!handler) { const prefixKey = Object.keys(INTERACTIONS).find(k => k.endsWith('_') && obj.utility && obj.utility.startsWith(k)); if (prefixKey) handler = INTERACTIONS[prefixKey]; }
            if (!handler) handler = INTERACTIONS['default'];
            if (handler && handler.onUpdate) { handler.onUpdate(sim, obj, f, getRate); }
        }
        sim.actionTimer -= dt;
        if (sim.actionTimer <= 0) { sim.finishAction(); }
    }
}

// --- 婴儿/家庭相关 ---
export class PlayingHomeState extends BaseState {
    actionName = SimAction.PlayingHome;
    update(sim: Sim, dt: number) { super.update(sim, dt); sim.actionTimer -= dt; if (sim.actionTimer <= 0) sim.finishAction(); }
}

export class FollowingState extends BaseState {
    actionName = SimAction.Following;
    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        if (sim.carriedBySimId) return; 
        let target = GameStore.sims.find(s => s.homeId === sim.homeId && s.isTemporary);
        if (!target) { target = GameStore.sims.find(s => (s.id === sim.motherId || s.id === sim.fatherId) && s.homeId === sim.homeId && s.isAtHome()); }
        if (!target) { sim.changeState(new PlayingHomeState()); sim.actionTimer = 200; return; }
        if (!target.isAtHome()) { sim.say("不出去了...", 'sys'); sim.changeState(new PlayingHomeState()); sim.actionTimer = 200; return; }
        const dist = Math.sqrt(Math.pow(sim.pos.x - target.pos.x, 2) + Math.pow(sim.pos.y - target.pos.y, 2));
        if (dist > 40) { sim.target = { x: target.pos.x + 20, y: target.pos.y }; sim.moveTowardsTarget(dt); }
    }
}

export class NannyState extends BaseState {
    actionName = SimAction.NannyWork;
    wanderTimer = 0;
    workTimer = 0; // 记录工作时长
    
    update(sim: Sim, dt: number) {
        this.workTimer += dt;

        // [核心修复] 智能下班判断
        // 1. 如果家里有家长，且工作时间足够 -> 下班 (保留)
        const parentsHome = GameStore.sims.some(s => s.homeId === sim.homeId && !s.isTemporary && s.ageStage !== AgeStage.Infant && s.ageStage !== AgeStage.Toddler && s.isAtHome());
        if (parentsHome && this.workTimer > 3000) {  
            sim.say("家长回来了，那我下班啦 👋", 'sys');
            GameStore.removeSim(sim.id); 
            return; 
        }
        // 2. [新增] 如果家里根本没有需要照顾的孩子 (例如都上学去了)，直接下班，别傻等
        // 获取该家庭的所有婴幼儿
        const childrenAtHome = GameStore.sims.filter(s => 
            s.homeId === sim.homeId && 
            (s.ageStage === AgeStage.Infant || s.ageStage === AgeStage.Toddler) && 
            s.isAtHome() // 关键：必须在家
        );
        // 如果没有孩子在家，且工作了一小会儿 (避免刚生成就消失)
        if (childrenAtHome.length === 0 && this.workTimer > 500) {
            sim.say("家里没人，我先撤了 👋", 'sys');
            GameStore.removeSim(sim.id);
            return;
        }

        // 🆕 [需求] 保姆必须照顾婴幼儿 (优先扫描)
        const babies = GameStore.sims.filter(s => s.homeId === sim.homeId && (s.ageStage === AgeStage.Infant || s.ageStage === AgeStage.Toddler));
        
        if (babies.length > 0) {
            // 找到最需要照顾的宝宝
            const needyBaby = babies.sort((a, b) => {
                const scoreA = (100 - a.needs[NeedType.Hunger]) + (100 - a.needs[NeedType.Social]) + (100 - a.mood);
                const scoreB = (100 - b.needs[NeedType.Hunger]) + (100 - b.needs[NeedType.Social]) + (100 - b.mood);
                return scoreB - scoreA;
            })[0];

            // 只要宝宝有不满，就去照顾，不一定要等到红色警戒
            if (needyBaby.needs[NeedType.Hunger] < 80) {
                sim.changeState(new FeedBabyState(needyBaby.id));
                return;
            }
            
            if (needyBaby.mood < 70) {
                const dist = Math.sqrt(Math.pow(sim.pos.x - needyBaby.pos.x, 2) + Math.pow(sim.pos.y - needyBaby.pos.y, 2));
                if (dist > 40) { 
                    sim.target = { x: needyBaby.pos.x + 10, y: needyBaby.pos.y }; 
                    sim.moveTowardsTarget(dt); 
                } 
                else { 
                    if (Math.random() < 0.05) { 
                        sim.say("乖宝宝~", "family"); 
                        needyBaby.needs[NeedType.Fun] += 10; 
                        needyBaby.needs[NeedType.Social] += 10; 
                    } 
                }
                return;
            }
        }

        // 如果没事做，随机闲逛
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
            this.wanderTimer = 300 + Math.random() * 300;
            const home = sim.getHomeLocation();
            if (home) {
                const tx = home.x + (Math.random() - 0.5) * 100;
                const ty = home.y + (Math.random() - 0.5) * 100;
                sim.target = { x: tx, y: ty };
            }
        }
        if (sim.target) sim.moveTowardsTarget(dt);
    }
}

// 3. 家长去接人 (PickingUp)
export class PickingUpState extends BaseState {
    actionName = SimAction.PickingUp;
    repathTimer = 0; // [优化] 减少重寻路频率
    
    enter(sim: Sim) {
        sim.path = [];
        const child = GameStore.sims.find(s => s.id === sim.carryingSimId);
        if (child) {
            sim.target = { x: child.pos.x, y: child.pos.y };
            sim.say(`去接 ${child.name}`, 'family');
        } else {
            sim.changeState(new IdleState());
        }
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        
        const child = GameStore.sims.find(s => s.id === sim.carryingSimId);
        // 如果孩子没了，或者孩子已经被别人接走了（防止多重接送），则放弃
        if (!child || (child.carriedBySimId && child.carriedBySimId !== sim.id)) { 
            sim.carryingSimId = null;
            sim.changeState(new IdleState()); 
            return; 
        }

        // [优化] 只有当孩子位置发生显著变化时，或者每隔一段时间，才更新目标
        // 防止每帧重算路径导致性能浪费和鬼畜
        this.repathTimer -= dt;
        if (this.repathTimer <= 0) {
            const distToTarget = sim.target ? (sim.target.x - child.pos.x)**2 + (sim.target.y - child.pos.y)**2 : 9999;
            if (distToTarget > 100) { // 只有孩子移动了超过 10px 才更新目标
                sim.target = { x: child.pos.x, y: child.pos.y };
            }
            this.repathTimer = 30; // 每 0.5 秒检查一次
        }

        // 移动逻辑
        const arrived = sim.moveTowardsTarget(dt);
        const distSq = (sim.pos.x - child.pos.x)**2 + (sim.pos.y - child.pos.y)**2;
        
        // [核心修复] 判定条件：
        // 1. 距离小于 60px (3600) - 即使隔着婴儿床也能抱到
        // 2. 或者寻路系统认为已经到达 (arrived === true)，说明撞到了障碍物边缘
        if (distSq <= 900 || arrived) {
            // === 成功接到孩子 ===
            sim.say("抓到你了！", 'family');
            
            // 1. 建立双向绑定
            child.carriedBySimId = sim.id;
            
            // 2. 强制打断孩子当前状态，进入被护送状态
            child.changeState(new BeingEscortedState());
            
            // 3. 计算目的地 (学校 or 家)
            // [核心修复] 使用 PLOTS[id].type 查找幼儿园
            const kindergarten = GameStore.worldLayout.find(p => {
                const tpl = PLOTS[p.templateId];
                return tpl && tpl.type === 'kindergarten';
            });
            // 判断逻辑：如果孩子当前就在幼儿园范围内，说明是接放学，要回家
            // 否则就是送上学
            const inSchool = kindergarten && 
                             child.pos.x >= kindergarten.x && 
                             child.pos.x <= kindergarten.x + (kindergarten.width||300) &&
                             child.pos.y >= kindergarten.y && 
                             child.pos.y <= kindergarten.y + (kindergarten.height||300);
            
            let targetPos = { x: 0, y: 0 };

            // [修复开始] 引入时间判断，防止大半夜送孩子上学
            const currentHour = GameStore.time.hour;
            // 幼儿园通常是 8点到17点
            const isSchoolTime = currentHour >= 8 && currentHour < 17;
            
            if (inSchool || !isSchoolTime) {
                // -> 目标：回家 (接放学)
                
                // 🚨 [核心修复] 无家可归处理逻辑
                // sim 是家长(或保姆)，优先取 sim 的家
                let homeLoc = sim.getHomeLocation();
                
                if (!homeLoc) {
                    // 如果是流浪汉家庭，"回家"意味着去非学校的公共场所
                    // 寻找一个 type 为 park 或 public 的地块，且不是当前的学校地块
                    const safePlot = GameStore.worldLayout.find(p => {
                        const tpl = PLOTS[p.templateId];
                        const type = p.customType || (tpl ? tpl.type : 'public');
                        const isSchoolPlot = ['kindergarten', 'elementary_school', 'high_school'].includes(type);
                        const isCurrentPlot = kindergarten && p.id === kindergarten.id;
                        
                        return !isSchoolPlot && !isCurrentPlot; 
                    });

                    if (safePlot) {
                        homeLoc = { 
                            x: safePlot.x + (safePlot.width || 300) / 2, 
                            y: safePlot.y + (safePlot.height || 300) / 2 
                        };
                        sim.say("去公园...", "family");
                    } else {
                        // 实在找不到（比如全是学校），找个地图中间空地
                        homeLoc = { x: 1500, y: 1000 };
                        sim.say("四海为家...", "bad");
                    }
                }

                if (homeLoc) {
                    targetPos = homeLoc;
                    sim.say("回家咯~", "family");
                } else {
                    // 理论上不会到这里，除非地图是空的
                    targetPos = { x: sim.pos.x + 50, y: sim.pos.y + 50 };
                }

            } else if (kindergarten) {
                // -> 去幼儿园
                targetPos = { 
                    x: kindergarten.x + (kindergarten.width||300)/2, 
                    y: kindergarten.y + (kindergarten.height||300)/2 
                };
                sim.say("去幼儿园~", "family");
            } else {
                sim.say("没地方去...", "bad");
                sim.changeState(new IdleState());
                return;
            }
            // [修复结束]

            // 4. 切换到护送状态
            sim.changeState(new EscortingState(targetPos));
        }
    }
}

// 4. 家长护送中 (Escorting)
export class EscortingState extends BaseState {
    actionName = SimAction.Escorting;
    dest: { x: number, y: number };

    constructor(dest: { x: number, y: number }) {
        super();
        this.dest = dest;
    }

    enter(sim: Sim) {
        sim.target = this.dest;
        sim.path = [];
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        
        const arrived = sim.moveTowardsTarget(dt);
        
        // 同步孩子位置 (核心逻辑：孩子被抱着走)
        if (sim.carryingSimId) {
            const child = GameStore.sims.find(s => s.id === sim.carryingSimId);
            if (child) {
                // 孩子位置稍微偏移一点，模拟抱着
                child.pos.x = sim.pos.x + 5;
                child.pos.y = sim.pos.y - 5;
                // 强制更新视图位置，防止闪烁
                child.prevPos = { ...child.pos };
            }
        }

        if (arrived) {
            let droppedAtSchool = false;
            // 到达目的地，放下孩子
            if (sim.carryingSimId) {
                const child = GameStore.sims.find(s => s.id === sim.carryingSimId);
                if (child) {
                    child.carriedBySimId = null;
                    
                    // [核心修复] 使用 PLOTS[id].type 判断当前位置是否是幼儿园
                    const kindergarten = GameStore.worldLayout.find(p => {
                        const tpl = PLOTS[p.templateId];
                        return tpl && tpl.type === 'kindergarten';
                    });
                    const inSchool = kindergarten && 
                                     sim.pos.x >= kindergarten.x && 
                                     sim.pos.x <= kindergarten.x + (kindergarten.width||300) &&
                                     sim.pos.y >= kindergarten.y && 
                                     sim.pos.y <= kindergarten.y + (kindergarten.height||300);
                    
                    if (inSchool) {
                        child.changeState(new SchoolingState());
                        child.say("到学校啦 👋", 'family');
                        sim.say("乖乖听话", 'family');
                    } else {
                        child.changeState(new IdleState()); // 到家了
                        child.say("回家啦！", 'family');
                    }
                }
                sim.carryingSimId = null;
            }
            
            // [核心修复] 如果保姆完成了送学任务（在学校且放下了孩子），直接消失
            if (sim.job.id === 'nanny') {
                if (droppedAtSchool) {
                    sim.say("送达完成，我先走了 👋", 'sys');
                    GameStore.removeSim(sim.id);
                } else {
                    sim.changeState(new NannyState());
                }
            } else {
                sim.changeState(new IdleState());
            }
        }
    }
}

// 5. 孩子被护送 (BeingEscorted)
export class BeingEscortedState extends BaseState {
    actionName = SimAction.BeingEscorted;
    
    enter(sim: Sim) {
        sim.target = null;
        sim.path = [];
        sim.say("抱抱~", 'love');
    }

    update(sim: Sim, dt: number) {
        // 啥也不干，位置由 Parent 更新
        // 只有当 Parent 丢失时才恢复
        if (sim.carriedBySimId) {
            const parent = GameStore.sims.find(s => s.id === sim.carriedBySimId);
            if (!parent || (parent.action !== SimAction.Escorting && parent.action !== SimAction.PickingUp)) {
                sim.carriedBySimId = null;
                sim.changeState(new IdleState());
            }
        } else {
            sim.changeState(new IdleState());
        }
    }
}

export class FeedBabyState extends BaseState {
    actionName = SimAction.FeedBaby;
    targetBabyId: string;
    
    constructor(targetBabyId: string) {
        super();
        this.targetBabyId = targetBabyId;
    }

    enter(sim: Sim) {
        const baby = GameStore.sims.find(s => s.id === this.targetBabyId);
        if (baby) {
            sim.target = { x: baby.pos.x + 15, y: baby.pos.y }; // 目标稍作偏移
            sim.say("来喂宝宝了~", 'family');
        } else {
            sim.changeState(new IdleState());
        }
    }

    update(sim: Sim, dt: number) {
        const baby = GameStore.sims.find(s => s.id === this.targetBabyId);
        if (!baby) { sim.changeState(new IdleState()); return; }

        if (sim.target) {
            // [修复] 手动计算距离，而不是完全依赖 moveTowardsTarget 的返回值
            // 只要距离足够近 (例如 < 60px)，就视为到达，防止被婴儿床碰撞体挡住
            const distSq = (sim.pos.x - sim.target.x)**2 + (sim.pos.y - sim.target.y)**2;
            const arrived = sim.moveTowardsTarget(dt);

            if (arrived || distSq < 3600) { // 60*60 = 3600
                // 到达后喂食
                baby.needs.hunger = 100;
                sim.say("吃饱了吗？", 'family');
                baby.say("饱了~", 'love');
                
                // [关键] 必须重置婴儿状态，否则婴儿会一直 Waiting
                baby.changeState(new IdleState()); 
                
                if (sim.job.id === 'nanny') sim.changeState(new NannyState());
                else sim.changeState(new IdleState());
            }
        }
    }
}