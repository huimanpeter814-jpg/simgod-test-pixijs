import { Sim } from '../Sim';
import { GameStore } from '../GameStore';
import { SimAction, JobType, NeedType, AgeStage, Furniture } from '../../types';
import { CareerLogic } from './career';
import { DecisionLogic } from './decision';
import { SocialLogic } from './social';
import { SchoolLogic } from './school';
import { INTERACTIONS, RESTORE_TIMES } from './interactionRegistry';
import { hasRequiredTags, getInteractionPos } from '../simulationHelpers';
import { PLOTS } from '../../data/plots'; 
import { FurnitureUtility, FurnitureTag } from '../../config/furnitureTypes';

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

// 🟢 [新增] 简单的闲逛状态 (如果还没有的话)
export class WanderingState extends BaseState {
    actionName = SimAction.Wandering;
    duration = 0;
    
    enter(sim: Sim) {
        this.duration = 100 + Math.random() * 200;
        // 随机找个附近点
        const dist = 50 + Math.random() * 100;
        const angle = Math.random() * Math.PI * 2;
        sim.target = {
            x: Math.max(0, Math.min(GameStore.worldLayout[0]?.width || 2000, sim.pos.x + Math.cos(angle) * dist)),
            y: Math.max(0, Math.min(GameStore.worldLayout[0]?.height || 2000, sim.pos.y + Math.sin(angle) * dist))
        };
        //sim.say("...", 'normal'); // 或者是哼着歌
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        const arrived = sim.moveTowardsTarget(dt);
        this.duration -= dt;
        if (arrived || this.duration <= 0) {
            sim.changeState(new IdleState());
        }
    }
}

// --- 🟢 [核心修改] 空闲状态 ---
export class IdleState extends BaseState {
    actionName = SimAction.Idle;
    // 🟢 [新增] 记录连续失败次数
    idleCycles = 0;

    enter(sim: Sim) {
        sim.target = null;
        sim.interactionTarget = null;
        sim.path = [];
        // 🟢 [修复] 增加进入空闲时的随机延迟
        // 之前这里没有设置 decisionTimer，导致如果上个状态结束时 timer 为 0，
        // 所有 Sim 会在同一帧立刻触发 decideAction，导致“集体行动”。
        // 现在给予 0~60 帧 (约0-1秒) 的随机偏差。
        sim.decisionTimer = Math.random() * 60;
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);

        // 1. 优先检查行为队列 (Action Queue)
        // 如果有未完成的计划，立即执行下一步，不等待思考冷却
        if (sim.hasPlan()) {
            DecisionLogic.decideAction(sim);
            return;
        }

        // 2. 思考计时器 (模拟发呆/反应时间)
        if (sim.decisionTimer > 0) {
            sim.decisionTimer -= dt;
        } else {
            // 记录当前状态是否改变
            const oldAction = sim.action;
            // 3. 婴幼儿特殊保护逻辑
            if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                if (sim.isAtHome() || !sim.getHomeLocation()) {
                    DecisionLogic.decideAction(sim); 
                } else {
                    // 迷路/在校等待接送
                    if (sim.action !== SimAction.Waiting) {
                        sim.say("我要回家...", 'bad');
                        SchoolLogic.arrangePickup(sim);
                        sim.changeState(new WaitingState());
                    }
                }
            } else {
                // 4. 成年人/儿童：触发AI决策生成新意图
                DecisionLogic.decideAction(sim);
            }
            // 🟢 [核心修复] 防呆检测
            // 如果决策完了，状态还是 Idle (说明没找到事做)，就增加计数
            if (sim.action === SimAction.Idle) {
                this.idleCycles++;
                
                // 如果连续 2 次都没找到事做，或者随机概率触发，强制去闲逛
                // 这样市民就会动起来，而不是一直站桩
                if (this.idleCycles > 1 || Math.random() < 0.3) {
                    this.idleCycles = 0; // 重置
                    sim.changeState(new WanderingState()); // 强制闲逛
                    return;
                }
                
                // 没找到事做，给个气泡反馈 (调试用，如果太频繁可以注释掉)
                // if (Math.random() < 0.1) sim.say("无聊...", 'sys');
                
                // 稍微延长下一次思考时间，避免高频空转
                sim.decisionTimer = 60 + Math.random() * 100;
            } else {
                    // 成功切换了状态 (比如去工作、去睡觉了)
                    this.idleCycles = 0;
                }
            
        }
    }
}

// --- 🟢 [核心修改] 等待状态 ---
export class WaitingState extends BaseState {
    actionName = SimAction.Waiting;
    
    enter(sim: Sim) {
        sim.target = null;
        sim.path = [];
        // 如果队列没有指定时间，默认给个短时间，防止无限等待
        if (!sim.actionTimer || sim.actionTimer <= 0) {
            sim.actionTimer = 200; 
        }
        if (!sim.bubble.text) sim.say("...", 'sys');
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        
        sim.actionTimer -= dt;
        
        // 倒计时结束，返回 Idle，这样队列的下一步动作(如果有)就会被 IdleState 执行
        if (sim.actionTimer <= 0) {
            sim.changeState(new IdleState());
        }
    }
}

// --- 🟢 [核心修改] 移动状态 ---
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

        if (this.stuckTimer > 300) { 
            // 卡死处理：瞬移或放弃
            if (sim.target) {
                const distToTarget = (sim.target.x - sim.pos.x)**2 + (sim.target.y - sim.pos.y)**2;
                if (distToTarget < 2500) {
                    sim.pos = { ...sim.target };
                    this.handleArrival(sim);
                } else {
                    sim.say("过不去...", 'sys');
                    // 卡死也视为当前动作结束，返回 Idle 让队列决定是重试还是放弃
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
        // [关键逻辑] 如果 Sim 正在执行一个计划队列
        // 移动结束不代表交互开始，应该返回 Idle，由 IdleState 触发队列的下一项 (INTERACT)
        if (sim.hasPlan()) {
            sim.changeState(new IdleState());
            return;
        }

        // [兼容旧逻辑] 如果没有队列，尝试自动交互
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
        // 1. 卡死检测
        const distMoved = (sim.pos.x - this.lastPos.x)**2 + (sim.pos.y - this.lastPos.y)**2;
        if (distMoved < 0.01) {
            this.stuckTimer += dt;
        } else {
            this.stuckTimer = 0;
            this.lastPos = { x: sim.pos.x, y: sim.pos.y };
        }

        // 如果卡住超过5秒，直接强制瞬移或进入工作状态 (防止一直在路上晃荡)
        if (this.stuckTimer > 300) {
            this.handleArrival(sim);
            return;
        }

        // 2. 移动与到达处理
        // [修复] 到达后必须调用 handleArrival 进行打卡，而不是直接 new WorkingState()
        if (sim.moveTowardsTarget(dt)) {
            this.handleArrival(sim);
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
        const requiredTags = sim.job.requiredTags || [FurnitureUtility.Work];
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

        // === 1. 基础生存检查 (保留原有逻辑) ===
        
        // 如果饥饿或如厕太低，自动恢复到安全线 (60-80)
        if (sim.needs[NeedType.Hunger] < 20) {
            sim.needs[NeedType.Hunger] = 60 + Math.random() * 20;
            sim.say("偷偷吃点东西...", 'act');
        }
        if (sim.needs[NeedType.Bladder] < 20) {
            sim.needs[NeedType.Bladder] = 80;
            sim.say("去趟洗手间", 'act');
        }

        // 如果精力耗尽，提前结束工作
        if (sim.needs[NeedType.Energy] <= 0) {
            sim.say("实在太困了... 撑不住了", 'bad');
            CareerLogic.leaveWorkEarly(sim);
            return;
        }

        // === 2. 技能与数值成长 (保留原有逻辑) ===
        const rate = 0.005 * dt;
        switch (sim.job.companyType) {
            case JobType.Internet: sim.skills.logic += rate; break;
            case JobType.Design: sim.skills.creativity += rate; break;
            case JobType.Restaurant: sim.skills.cooking += rate; break;
            case JobType.Nightlife: sim.skills.music += rate; sim.skills.dancing += rate; break;
            case JobType.Hospital: sim.skills.logic += rate; break;
            case JobType.Store: sim.eq = Math.min(100, sim.eq + rate); break;
        }

        // === 3. 随机同事社交 (保留原有逻辑) ===
        if (Math.random() < 0.0005 * dt) {
            const nearby = GameStore.sims.find(s => 
                s.id !== sim.id && 
                s.workplaceId === sim.workplaceId && 
                Math.abs(s.pos.x - sim.pos.x) < 80 && 
                Math.abs(s.pos.y - sim.pos.y) < 80
            );
            if (nearby) {
                const topics = ["在那边怎么样？", "老板今天很凶...", "中午吃啥？", "周末去哪玩？", "这项目真难搞"];
                sim.say(topics[Math.floor(Math.random() * topics.length)], 'normal');
                SocialLogic.updateRelationship(sim, nearby, 'friendship', 1);
                if (Math.random() < 0.1 && sim.orientation !== 'aro') { 
                    SocialLogic.triggerJealousy(sim, nearby, sim); 
                }
            }
        }

        // === 4. 职位特定的移动与行为 AI (修改部分) ===
        
        // 如果正在移动中，优先执行移动，不进行新的决策
        if (sim.target) {
            const arrived = sim.moveTowardsTarget(dt);
            if (arrived) {
                sim.target = null;
                // 到达目的地后，站桩工作一段时间 (3~6秒)
                this.subStateTimer = 180 + Math.random() * 180; 
            }
            return;
        }

        // 倒计时：如果还在站桩工作中，就不要动
        this.subStateTimer -= dt;
        if (this.subStateTimer > 0) return;

        // 倒计时结束，决定下一个动作
        if (sim.job.companyType === JobType.Restaurant) {
            this.handleRestaurantBehavior(sim);
        } else {
            this.handleGenericBehavior(sim);
        }
    }

    /**
     * 餐厅职业专用逻辑
     */
    private handleRestaurantBehavior(sim: Sim) {
        // 重置思考时间，防止每一帧都计算
        this.subStateTimer = 100; // 默认短暂停顿

        const furnitureList = GameStore.furnitureByPlot.get(sim.workplaceId!) || [];
        const isChef = sim.job.title.includes('厨') || sim.job.title.includes('Chef');
        
        if (isChef) {
            // 👨‍🍳 厨师：只在 炉灶(stove) 或 厨房柜台(kitchen) 之间移动
            const workstations = furnitureList.filter(f => f.utility === FurnitureUtility.Cooking || f.tags?.includes(FurnitureTag.Kitchen));
            
            if (workstations.length > 0) {
                const target = workstations[Math.floor(Math.random() * workstations.length)];
                sim.target = { 
                    x: target.x + target.w / 2, 
                    y: target.y + target.h + 20 // 站在家具前方
                };
                sim.say("火候正好🔥", 'work');
            } else {
                sim.say("厨房在哪里？", 'bad');
            }
        } else {
            // 🤵 服务员：在 厨房取餐口(counter/stove) 和 餐桌(table/seat) 之间往返
            const rand = Math.random();
            if (rand < 0.5) {
                // 50% 去出餐口拿菜
                const pickupSpots = furnitureList.filter(f => f.tags?.includes(FurnitureTag.Counter) || f.utility === FurnitureUtility.Cooking);
                if (pickupSpots.length > 0) {
                    const t = pickupSpots[Math.floor(Math.random() * pickupSpots.length)];
                    sim.target = { x: t.x + t.w/2, y: t.y + t.h + 20 };
                    sim.say("上菜咯", 'work');
                }
            } else {
                // 50% 去客人桌子
                const tables = furnitureList.filter(f => f.tags?.includes(FurnitureTag.Table) || f.tags?.includes(FurnitureTag.Seat));
                if (tables.length > 0) {
                    const t = tables[Math.floor(Math.random() * tables.length)];
                    sim.target = { x: t.x + t.w/2, y: t.y + t.h + 20 };
                    sim.say("请慢用", 'work');
                }
            }
        }
    }

    /**
     * 通用职业逻辑 (保留旧有的漫步逻辑)
     */
    private handleGenericBehavior(sim: Sim) {
        // 设置较长的移动间隔
        this.subStateTimer = 300 + Math.random() * 300; 

        const jobType = sim.job.companyType;
        const jobTitle = sim.job.title;
        const plot = sim.workplaceId ? GameStore.worldLayout.find(p => p.id === sim.workplaceId) : null;
        
        if (!plot) return;

        // 判断是否是需要经常走动的职业
        const isActiveJob = 
            (jobType === JobType.Store && !jobTitle.includes('收银')) || 
            (jobType === JobType.Hospital && jobTitle.includes('护士')) || 
            (jobType === JobType.ElderCare);

        // 或者是偶尔走动的职业 (医生/老师)
        const isSemiActiveJob = 
            (jobType === JobType.Hospital && jobTitle.includes('医')) || 
            (jobType === JobType.School);

        if (isActiveJob || (isSemiActiveJob && Math.random() > 0.7)) {
            // 在地块范围内随机找点
            const tx = plot.x + 20 + Math.random() * ((plot.width || 300) - 40);
            const ty = plot.y + 20 + Math.random() * ((plot.height || 300) - 40);
            sim.target = { x: tx, y: ty };
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
            if (target.utility === FurnitureUtility.Book || target.label?.includes('书')) {
                sim.say("突击复习...", 'act');
                sim.skills.logic += 0.5; // 学习加成
            } else if (target.utility === FurnitureTag.Gym || target.utility === FurnitureUtility.Exercise) {
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
            f.utility === FurnitureUtility.Book || f.label.includes('书') || 
            f.label.includes('桌') || f.label.includes('椅') || 
            f.utility === FurnitureUtility.Vending
        ) || [];
            if (props.length > 0) {
                this.goToObject(sim, props);
                return;
            }
        }

        // 20% 运动 (如果操场有篮球架或跑道)
        if (rand < 0.9) {
            const sports = GameStore.furnitureByPlot.get(plot.id)?.filter(f => 
            f.utility === FurnitureTag.Gym || f.utility === FurnitureUtility.Exercise || f.label.includes('球')
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
            f.utility === FurnitureUtility.Game || f.utility === FurnitureUtility.Toy || f.label.includes('滑梯')
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
            f.utility === FurnitureUtility.NapCrib || f.tags?.includes(FurnitureTag.Bed)
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
        // 1. 衰减逻辑 (保持不变)
        const excludeDecay: NeedType[] = [];
        if (this.actionName === SimAction.Sleeping) excludeDecay.push(NeedType.Energy);
        if (this.actionName === SimAction.Eating) excludeDecay.push(NeedType.Hunger);
        if (this.actionName === SimAction.Talking) excludeDecay.push(NeedType.Social);
        this.decayNeeds(sim, dt, excludeDecay);

        // 2. 恢复逻辑
        if (this.actionName === SimAction.Talking) { 
            sim.needs[NeedType.Social] += getRate(RESTORE_TIMES[NeedType.Social]); 
        }
        else if (obj) {
            let handler = INTERACTIONS[obj.utility];
            
            // 模糊匹配逻辑 (保持不变)
            if (!handler) { 
                const prefixKey = Object.keys(INTERACTIONS).find(k => k.endsWith('_') && obj.utility && obj.utility.startsWith(k)); 
                if (prefixKey) handler = INTERACTIONS[prefixKey]; 
            }
            
            // 如果找到了特定的 handler 且它有 onUpdate，就用它的
            if (handler && handler.onUpdate) { 
                handler.onUpdate(sim, obj, f, getRate); 
            } 
            // 🔴 [修复] 否则，尝试通用映射恢复
            else {
                // update 方法中
                // 尝试将 utility 映射为 NeedType
                let targetNeed: NeedType | null = null;
                const u = obj.utility;
                
                if (u === FurnitureUtility.Toilet) targetNeed = NeedType.Bladder;
                else if (u === FurnitureUtility.Shower || u === FurnitureUtility.Bathtub) targetNeed = NeedType.Hygiene;
                else if (u === FurnitureUtility.Fridge || u === FurnitureUtility.Cooking) targetNeed = NeedType.Hunger;
                else if (u === FurnitureUtility.Energy || u === FurnitureTag.Bed || u === FurnitureTag.Sofa) targetNeed = NeedType.Energy;
                else if (u === FurnitureUtility.TV || u === FurnitureTag.Computer || u === FurnitureTag.Bookshelf) targetNeed = NeedType.Fun;
                // 如果 utility 本身就是标准 NeedType (如 'hunger', 'energy')
                else if (Object.values(NeedType).includes(u as NeedType)) targetNeed = u as NeedType;

                if (targetNeed) {
                    const t = RESTORE_TIMES[targetNeed] || RESTORE_TIMES.default;
                    if (sim.needs[targetNeed] !== undefined) {
                        sim.needs[targetNeed] += getRate(t);
                    }
                    
                    // 额外处理：洗澡/睡觉通常会完全补满舒适度
                    if (targetNeed === NeedType.Energy || targetNeed === NeedType.Hygiene) {
                         sim.needs[NeedType.Comfort] = 100;
                    }
                } else {
                    // 如果实在匹配不到，使用 'default' handler 的逻辑 (作为最后的兜底)
                     const defaultHandler = INTERACTIONS['default'];
                     if (defaultHandler && defaultHandler.onUpdate) {
                         defaultHandler.onUpdate(sim, obj, f, getRate);
                     }
                }
            }
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

        // 🟢 [修复] 防卡死检测：如果保姆位于 (0,0) 附近，强制瞬移到家庭或地图中心
        if (sim.pos.x < 10 && sim.pos.y < 10) {
            const home = sim.getHomeLocation();
            if (home) {
                sim.pos = { x: home.x, y: home.y };
            } else {
                // 如果找不到家，先瞬移到地图中间防止卡在左上角
                sim.pos = { x: 1500, y: 1000 }; 
            }
            // 瞬移后重置状态，让她重新思考
            sim.path = [];
            sim.target = null;
        }

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

        // 🟢 [修复] 闲逛逻辑增强
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
            this.wanderTimer = 300 + Math.random() * 300;
            const home = sim.getHomeLocation();
            
            if (home) {
                const tx = home.x + (Math.random() - 0.5) * 100;
                const ty = home.y + (Math.random() - 0.5) * 100;
                sim.target = { x: tx, y: ty };
            } else {
                // [兜底] 如果没有家 (getHomeLocation失败)，就原地附近随机走，不要去 (0,0)
                sim.target = { 
                    x: Math.max(100, sim.pos.x + (Math.random()-0.5)*200),
                    y: Math.max(100, sim.pos.y + (Math.random()-0.5)*200)
                };
            }
        }
        if (sim.target) sim.moveTowardsTarget(dt);
    }
}

// 3. 家长去接人 (PickingUp)
export class PickingUpState extends BaseState {
    actionName = SimAction.PickingUp;
    repathTimer = 0; // [优化] 减少重寻路频率
    stuckTimer = 0; // [新增] 卡死检测
    lastPos = { x: 0, y: 0 };
    
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
        // 1. [新增] 优先检查孩子是否饿了，如果饿了先喂食
        if (child.needs[NeedType.Hunger] < 30) {
            sim.say("先喂宝宝...", 'family');
            sim.changeState(new FeedBabyState(child.id));
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
        // 检测是否卡住不动了
        const moveDist = (sim.pos.x - this.lastPos.x)**2 + (sim.pos.y - this.lastPos.y)**2;
        if (moveDist < 0.01) this.stuckTimer += dt;
        else { this.stuckTimer = 0; this.lastPos = { x: sim.pos.x, y: sim.pos.y }; }
        // [关键修复] 判定成功的条件：
        // A. 距离 < 60px (3600) - 扩大范围，因为婴儿床有碰撞体积
        // B. 寻路显示到达 (arrived)
        // C. 卡住超过 2秒 且 距离孩子不远 (< 100px) - 视为隔着家具抱到了
        const isStuckButClose = this.stuckTimer > 120 && distSq < 10000;

        if (distSq <= 3600 || arrived || isStuckButClose) {
            sim.say("抓到你了！", 'family');
            
            const kindergarten = GameStore.worldLayout.find(p => {
                const tpl = PLOTS[p.templateId];
                return tpl && tpl.type === 'kindergarten';
            });

            const inSchool = kindergarten && 
                             child.pos.x >= kindergarten.x && 
                             child.pos.x <= kindergarten.x + (kindergarten.width||300) &&
                             child.pos.y >= kindergarten.y && 
                             child.pos.y <= kindergarten.y + (kindergarten.height||300);
            
            let targetPos = { x: 0, y: 0 };
            const currentHour = GameStore.time.hour;
            const isSchoolTime = currentHour >= 8 && currentHour < 17;
            
            if (inSchool || !isSchoolTime) {
                // 回家逻辑
                let homeLoc = sim.getHomeLocation();
                if (!homeLoc) homeLoc = { x: 1500, y: 1000 };
                targetPos = homeLoc;
                sim.say("回家咯~", "family");
            } else if (kindergarten) {
                // 去学校
                targetPos = { 
                    x: kindergarten.x + (kindergarten.width||300)/2, 
                    y: kindergarten.y + (kindergarten.height||300)/2 
                };
                sim.say("去幼儿园~", "family");
            } else {
                sim.say("没学校去...", "bad");
                sim.carryingSimId = null; // 确保清除引用
                sim.changeState(new IdleState());
                return;
            }

            if (targetPos) {
                child.carriedBySimId = sim.id; // 正式绑定
                child.changeState(new BeingEscortedState());
                sim.changeState(new EscortingState(targetPos));
            }
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
        // [防御] 如果目的地是 (0,0)，说明上一步逻辑有误，强行纠正回 Idle
        if (this.dest.x === 0 && this.dest.y === 0) {
            console.warn("Escorting to (0,0) detected, aborting.");
            sim.changeState(new IdleState());
            return;
        }
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
                    // [优化判定] 除了判定坐标，如果已经到达了目的地(target)，也视为成功
                    // 这样即使坐标计算有细微偏差，也不会导致任务失败
                    const distToDest = (sim.pos.x - this.dest.x)**2 + (sim.pos.y - this.dest.y)**2;
                    const isAtDestination = distToDest < 100; // 允许10px误差
                    
                    if (inSchool|| isAtDestination) {
                        child.changeState(new SchoolingState());
                        child.say("到学校啦 👋", 'family');
                        sim.say("乖乖听话", 'family');
                        droppedAtSchool = true; // 标记成功
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

// === [新增] 大人给宝宝洗澡状态 ===
export class BatheBabyState extends BaseState {
    actionName = SimAction.BatheBaby;
    phase: 'go_to_baby' | 'go_to_shower' | 'bathing' = 'go_to_baby'; // 状态机阶段
    targetBabyId: string;
    targetShower: Furniture | null = null;
    timer: number = 0;

    constructor(babyId: string) {
        super();
        this.targetBabyId = babyId;
    }

    enter(sim: Sim) {
        // 1. 寻找最近的淋浴间/浴缸
        const showers = GameStore.furniture.filter(f => f.homeId === sim.homeId && (f.utility === FurnitureUtility.Shower || f.utility === NeedType.Hygiene));
        if (showers.length === 0) {
            sim.say("找不到浴室...", 'bad');
            sim.changeState(new IdleState());
            return;
        }
        // 找最近的一个
        this.targetShower = showers.sort((a, b) => {
            const distA = (a.x - sim.pos.x)**2 + (a.y - sim.pos.y)**2;
            const distB = (b.x - sim.pos.x)**2 + (b.y - sim.pos.y)**2;
            return distA - distB;
        })[0];

        // 2. 第一步：先走向宝宝
        const baby = GameStore.sims.find(s => s.id === this.targetBabyId);
        if (baby) {
            sim.target = { x: baby.pos.x, y: baby.pos.y }; // 走到宝宝身边
            sim.path = []; // 重置路径
            sim.say("来洗澡咯 🛁", 'family');
        } else {
            sim.changeState(new IdleState());
        }
    }

    update(sim: Sim, dt: number) {
        const baby = GameStore.sims.find(s => s.id === this.targetBabyId);
        if (!baby) { sim.changeState(new IdleState()); return; }

        // --- 阶段 1: 走向宝宝 ---
        if (this.phase === 'go_to_baby') {
            const arrived = sim.moveTowardsTarget(dt);
            const distSq = (sim.pos.x - baby.pos.x)**2 + (sim.pos.y - baby.pos.y)**2;
            
            // 到达或者距离很近 (<40px)
            if (arrived || distSq < 1600) {
                // 抱起宝宝
                baby.carriedBySimId = sim.id;
                sim.carryingSimId = baby.id;
                baby.changeState(new BeingBathedState()); // 宝宝进入被动状态
                
                // 切换目标：去浴室
                this.phase = 'go_to_shower';
                if (this.targetShower) {
                    const { anchor } = getInteractionPos(this.targetShower);
                    sim.target = anchor;
                    sim.path = [];
                    sim.say("去浴室...", 'act');
                }
            }
        } 
        // --- 阶段 2: 抱着宝宝去浴室 ---
        else if (this.phase === 'go_to_shower') {
            const arrived = sim.moveTowardsTarget(dt);
            
            // 手动同步宝宝位置 (模拟抱着)
            baby.pos = { x: sim.pos.x + 5, y: sim.pos.y + 5 };
            
            if (arrived) {
                // 到达浴室，放下宝宝，开始洗澡
                this.phase = 'bathing';
                this.timer = 60; // 洗澡时长 (秒)
                sim.say("洗刷刷 🚿", 'act');
                
                // 视觉上把宝宝放在淋浴位置
                baby.carriedBySimId = null;
                sim.carryingSimId = null;
                if (this.targetShower) {
                    baby.pos = { x: this.targetShower.x + 10, y: this.targetShower.y + 10 };
                }
            }
        } 
        // --- 阶段 3: 洗澡中 ---
        else if (this.phase === 'bathing') {
            // 1. 计时
            this.timer -= (dt / 60); 
            
            // 2. 恢复数值
            baby.needs[NeedType.Hygiene] = Math.min(100, baby.needs[NeedType.Hygiene] + 0.5); // 宝宝变干净
            sim.needs[NeedType.Hygiene] = Math.min(100, sim.needs[NeedType.Hygiene] + 0.1);  // 大人顺便洗洗手
            
            // 3. 结束判断
            if (this.timer <= 0 || baby.needs[NeedType.Hygiene] >= 100) {
                baby.needs[NeedType.Hygiene] = 100;
                
                // 结束
                baby.changeState(new IdleState());
                baby.say("香喷喷！✨", 'happy');
                sim.say("洗干净啦", 'family');
                
                // 大人回归原职
                if (sim.job.id === 'nanny') sim.changeState(new NannyState());
                else sim.changeState(new IdleState());
            }
        }
    }
}

// === [新增] 宝宝被洗澡状态 (被动) ===
export class BeingBathedState extends BaseState {
    actionName = SimAction.BeingBathed;
    
    enter(sim: Sim) {
        sim.target = null;
        sim.path = [];
        sim.say("...", 'sys');
    }

    update(sim: Sim, dt: number) {
        // 全程被动，无需逻辑
        // 安全检查：如果长时间没大人管 (比如大人突然消失了)，自动恢复
        if (!sim.carriedBySimId && sim.needs[NeedType.Hygiene] < 100) {
            // 这里可以加一个简单的超时判断，防止卡死
        }
    }
}

/**
 * 1. 取食材状态：走向冰箱
 */
export class FetchingFoodState extends BaseState {
    actionName = SimAction.FetchingFood;
    targetFridge: Furniture;

    constructor(fridge: Furniture) {
        super();
        this.targetFridge = fridge;
    }

    enter(sim: Sim) {
        // 计算冰箱交互位置
        const { interact } = getInteractionPos(this.targetFridge);
        sim.target = interact;
        sim.path = [];
        sim.say("饿了，找点吃的...", 'act');
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        const arrived = sim.moveTowardsTarget(dt);
        
        if (arrived) {
            // 到达冰箱后，决定是直接吃（速食）还是做饭
            // 简单逻辑：如果家里有炉灶，且心情不错，就做饭；否则吃速食
            const stoves = GameStore.furniture.filter(f => f.homeId === sim.homeId && f.utility === 'cooking');
            const hasStove = stoves.length > 0;
            
            if (hasStove && Math.random() < 0.7) {
                // 去做饭
                const stove = stoves[Math.floor(Math.random() * stoves.length)];
                sim.changeState(new CookingState(stove));
            } else {
                // 直接找地方吃
                sim.say("随便吃点吧", 'act');
                sim.changeState(new FindingSeatState());
            }
        }
    }
}

/**
 * 2. 烹饪状态：在炉灶前等待
 */
export class CookingState extends BaseState {
    actionName = SimAction.Cooking;
    targetStove: Furniture;
    timer: number = 0;

    constructor(stove: Furniture) {
        super();
        this.targetStove = stove;
    }

    enter(sim: Sim) {
        const { interact } = getInteractionPos(this.targetStove);
        sim.target = interact;
        sim.path = [];
        this.timer = 120; // 烹饪时间 (约2秒)
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        
        if (sim.target) {
            const arrived = sim.moveTowardsTarget(dt);
            if (arrived) {
                sim.target = null; // 停止移动，开始做饭
                sim.say("展示厨艺！🍳", 'act');
            }
        } else {
            // 烹饪倒计时
            this.timer -= dt;
            sim.skills.cooking += 0.005 * dt; // 增加烹饪技能

            if (this.timer <= 0) {
                sim.say("好香啊~", 'happy');
                sim.changeState(new FindingSeatState());
            }
        }
    }
}

/**
 * 3. 寻找座位状态：端着盘子找最近的餐椅
 */
export class FindingSeatState extends BaseState {
    actionName = SimAction.FindingSeat;
    
    enter(sim: Sim) {
        // 寻找附近的椅子/沙发
        const seats = GameStore.furniture.filter(f => 
            (f.tags?.includes(FurnitureTag.Seat) || f.utility === FurnitureUtility.Comfort) && 
            (sim.homeId ? f.homeId === sim.homeId : true)
        );

        if (seats.length === 0) {
            sim.say("没地坐了...", 'bad');
            sim.changeState(new DiningState(null));
            return;
        }

        // 🔴 [修复] 显式声明类型: Furniture | null
        let bestSeat: Furniture | null = null; 
        let minDist = Infinity;

        seats.forEach(s => {
            if (this.isOccupied(s, sim.id)) return;
            const d = (s.x - sim.pos.x)**2 + (s.y - sim.pos.y)**2;
            if (d < minDist) {
                minDist = d;
                bestSeat = s; // 现在这里不会报错了
            }
        });

        if (bestSeat) {
            const { interact } = getInteractionPos(bestSeat);
            sim.target = interact;
            sim.interactionTarget = bestSeat; 
        } else {
            sim.changeState(new DiningState(null)); 
        }
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        if (sim.target) {
            const arrived = sim.moveTowardsTarget(dt);
            if (arrived) {
                // 必须确保传递的是 Furniture，虽然逻辑上 interactionTarget 已经是了，但在TS里最好强转或判空
                sim.changeState(new DiningState(sim.interactionTarget as Furniture));
            }
        }
    }

    private isOccupied(f: Furniture, selfId: string): boolean {
        return GameStore.sims.some(s => s.id !== selfId && s.interactionTarget?.id === f.id);
    }
}

/**
 * 4. 进食状态：坐在椅子上恢复饥饿
 */
export class DiningState extends BaseState {
    actionName = SimAction.Dining;
    chair: Furniture | null;
    timer: number = 0;

    constructor(chair: Furniture | null) {
        super();
        this.chair = chair;
    }

    enter(sim: Sim) {
        sim.target = null;
        sim.path = [];
        this.timer = 180; // 吃饭耗时 (约3秒)
        sim.say("开动！🙏", 'act');
        
        // 如果有椅子，修正坐姿朝向
        if (this.chair) {
            // 简单的视觉处理：位置对齐
             sim.pos = { x: this.chair.x + this.chair.w/2, y: this.chair.y + this.chair.h/2 };
        }
    }

    update(sim: Sim, dt: number) {
        this.decayNeeds(sim, dt, [NeedType.Hunger]); // 吃饭时不扣饥饿

        this.timer -= dt;
        
        // 恢复饥饿值
        sim.needs[NeedType.Hunger] = Math.min(100, sim.needs[NeedType.Hunger] + 0.5 * dt);
        
        // 恢复舒适度 (如果坐着)
        if (this.chair) sim.needs[NeedType.Comfort] = Math.min(100, sim.needs[NeedType.Comfort] + 0.1 * dt);

        if (sim.needs[NeedType.Hunger] >= 100 || this.timer <= 0) {
            sim.needs[NeedType.Hunger] = 100;
            sim.say("吃饱了~", 'happy');
            sim.finishAction(); // 回归 Idle
        }
    }
}

// ==========================================
// 🏪 餐厅顾客状态链
// ==========================================

export class OrderingState extends BaseState {
    actionName = SimAction.Ordering;
    counter: Furniture;

    constructor(counter: Furniture) {
        super();
        this.counter = counter;
    }

    enter(sim: Sim) {
        const { interact } = getInteractionPos(this.counter);
        sim.target = interact;
        sim.say("去点餐...", 'act');
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        if (sim.moveTowardsTarget(dt)) {
            sim.money -= 20; // 扣钱
            sim.say("我要一份豪华套餐", 'chat');
            // 点完餐，去找位子等
            sim.changeState(new WaitingForFoodState(this.counter.homeId || this.counter.id)); // 传入 plotId 或关联ID
        }
    }
}

export class WaitingForFoodState extends BaseState {
    actionName = SimAction.WaitingForFood;
    plotId: string;
    timer: number = 200; 

    constructor(plotId: string) {
        super();
        this.plotId = plotId;
    }

    enter(sim: Sim) {
        // 在当前店铺(地块)范围内找椅子
        const seats = GameStore.furniture.filter(f => {
            // 简单判定：距离市民不要太远 (比如 20格以内)，且属于该店铺
            const dist = (f.x - sim.pos.x)**2 + (f.y - sim.pos.y)**2;
            // 这里的 100000 约等于 300像素距离
            return dist < 100000 && (f.tags?.includes(FurnitureTag.Seat) || f.utility === FurnitureUtility.Comfort);
        });

        // 🔴 [修复] 显式声明类型
        let bestSeat: Furniture | null = null;
        let minDist = Infinity;

        seats.forEach(s => {
            // 如果被占用，跳过
            if (GameStore.sims.some(other => other.id !== sim.id && other.interactionTarget?.id === s.id)) return;
            
            const d = (s.x - sim.pos.x)**2 + (s.y - sim.pos.y)**2;
            if (d < minDist) {
                minDist = d;
                bestSeat = s;
            }
        });
        
        if (bestSeat) {
            const { interact } = getInteractionPos(bestSeat);
            sim.target = interact;
            sim.interactionTarget = bestSeat;
        } else {
            // 没位子就在原地等
            sim.say("没位子了，站着等吧", 'bad');
            sim.target = null;
        }
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        
        if (sim.target) {
            // 走向位子
            if (sim.moveTowardsTarget(dt)) {
                sim.target = null; 
                // 视觉对齐：坐到椅子中心
                if (sim.interactionTarget) {
                     sim.pos = { 
                         x: sim.interactionTarget.x + sim.interactionTarget.w/2, 
                         y: sim.interactionTarget.y + sim.interactionTarget.h/2 
                     };
                }
            }
        } else {
            // 坐下/站立等待中
            this.timer -= dt;
            if (this.timer % 100 < 1) sim.say("菜还没好吗...", 'sys');

            if (this.timer <= 0) {
                // 上菜了！
                sim.say("终于来了！", 'happy');
                // 进入进食状态
                sim.changeState(new DiningState(sim.interactionTarget as Furniture));
            }
        }
    }
}

// ==========================================
// 📖 沉浸式阅读行为链
// ==========================================

/**
 * 1. 取书状态：走向书架
 */
export class FetchingBookState extends BaseState {
    actionName = 'fetching_book';
    targetBookshelf: Furniture;

    constructor(bookshelf: Furniture) {
        super();
        this.targetBookshelf = bookshelf;
    }

    enter(sim: Sim) {
        const { interact } = getInteractionPos(this.targetBookshelf);
        sim.target = interact;
        sim.say("找本好书看看...", 'act');
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        if (sim.moveTowardsTarget(dt)) {
            // 到达书架，手里拿书 (逻辑上)，开始找坐位
            sim.say("就这本了", 'act');
            sim.changeState(new FindingReadingSpotState());
        }
    }
}

/**
 * 2. 寻找阅读位状态：优先找沙发，其次找椅子
 */
export class FindingReadingSpotState extends BaseState {
    actionName = 'finding_reading_spot';

    enter(sim: Sim) {
        // 筛选舒适的座位 (优先 sofa)
        const seats = GameStore.furniture.filter(f => 
            (f.homeId === sim.homeId || f.homeId === sim.workplaceId) && // 在当前环境找
            (f.tags?.includes(FurnitureTag.Sofa) || f.tags?.includes(FurnitureTag.Armchair) || f.utility === FurnitureUtility.Comfort)
        );

        // 如果没沙发，勉强找普通椅子
        if (seats.length === 0) {
            const chairs = GameStore.furniture.filter(f => 
                (f.homeId === sim.homeId) && f.tags?.includes(FurnitureTag.Seat)
            );
            seats.push(...chairs);
        }

        // 找最近的一个空位
        let bestSeat: Furniture | null = null;
        let minDist = Infinity;

        seats.forEach(s => {
            if (this.isOccupied(s, sim.id)) return;
            const d = (s.x - sim.pos.x)**2 + (s.y - sim.pos.y)**2;
            if (d < minDist) {
                minDist = d;
                bestSeat = s;
            }
        });

        if (bestSeat) {
            const { interact } = getInteractionPos(bestSeat);
            sim.target = interact;
            sim.interactionTarget = bestSeat; // 绑定座位
        } else {
            // 没地坐，站着读
            sim.say("没地坐，站着看吧", 'sys');
            sim.changeState(new ReadingState(null)); 
        }
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        if (sim.target && sim.moveTowardsTarget(dt)) {
            sim.changeState(new ReadingState(sim.interactionTarget as Furniture));
        }
    }

    private isOccupied(f: Furniture, selfId: string): boolean {
        return GameStore.sims.some(s => s.id !== selfId && s.interactionTarget?.id === f.id);
    }
}

/**
 * 3. 阅读状态：坐在舒适的地方读书
 */
export class ReadingState extends BaseState {
    actionName = 'reading';
    seat: Furniture | null;
    timer: number = 0;

    constructor(seat: Furniture | null) {
        super();
        this.seat = seat;
    }

    enter(sim: Sim) {
        sim.target = null;
        // 如果有座位，对齐坐标
        if (this.seat) {
            sim.pos = { x: this.seat.x + this.seat.w/2, y: this.seat.y + this.seat.h/2 };
            // 如果是沙发，稍微回一点精力和舒适
            if (this.seat.tags?.includes(FurnitureTag.Sofa)) {
                sim.say("这沙发真舒服...", 'happy');
            }
        }
        
        // 读书时长根据 逻辑/智商 技能缩短
        this.timer = 120; // 约2秒
    }

    update(sim: Sim, dt: number) {
        this.decayNeeds(sim, dt, [NeedType.Fun]); // 读书不扣娱乐

        this.timer -= dt;
        
        // 读书效果
        sim.needs[NeedType.Fun] += 0.2 * dt; // 增加娱乐
        
        // 随机增加逻辑或写作技能
        if (Math.random() < 0.05) sim.skills.logic += 0.01;

        // 如果坐着，回复舒适度
        if (this.seat) sim.needs[NeedType.Comfort] = Math.min(100, sim.needs[NeedType.Comfort] + 0.1 * dt);

        if (this.timer <= 0 || sim.needs[NeedType.Fun] >= 100) {
            sim.say("读完了，真精彩", 'act');
            // 可以在这里加一个 PuttingBookBackState (放回书)，或者直接结束
            sim.finishAction(); 
        }
    }
}

// ==========================================
// 🛍️ 真实购物行为链
// ==========================================

/**
 * 1. 浏览商品状态：在货架前徘徊
 */
export class BrowsingState extends BaseState {
    actionName = 'browsing';
    shelf: Furniture;
    timer: number = 60; // 浏览时间
    
    constructor(shelf: Furniture) {
        super();
        this.shelf = shelf;
    }

    enter(sim: Sim) {
        const { interact } = getInteractionPos(this.shelf);
        // 稍微随机一点位置，不要所有人站同一个点
        sim.target = { 
            x: interact.x + (Math.random() - 0.5) * 20, 
            y: interact.y + (Math.random() - 0.5) * 20 
        };
        sim.say("看看有什么...", 'act');
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        if (sim.target) {
            if (sim.moveTowardsTarget(dt)) {
                sim.target = null; // 到达货架，开始挑选
            }
        } else {
            this.timer -= dt;
            if (this.timer <= 0) {
                sim.say("就买这个！", 'act');
                // 挑选完毕，去结账
                sim.changeState(new GoingToCheckoutState(this.shelf));
            }
        }
    }
}

/**
 * 2. 前往收银台状态
 */
export class GoingToCheckoutState extends BaseState {
    actionName = 'checkout_queue';
    targetItemShelf: Furniture; // 记录原本是在哪个货架买的东西，用于获取价格等

    constructor(shelf: Furniture) {
        super();
        this.targetItemShelf = shelf;
    }

    enter(sim: Sim) {
        // 寻找该店铺内的收银台
        const cashiers = GameStore.furniture.filter(f => 
            (f.homeId === sim.workplaceId || f.homeId === this.targetItemShelf.homeId) && // 同一地块
            (f.tags?.includes(FurnitureTag.Cashier) || f.label.includes('收银') || f.utility === FurnitureUtility.Work)
        );

        if (cashiers.length === 0) {
            // 没有收银台？自助结账（直接扣钱）
            sim.say("没人收钱？那我直接扫码了", 'sys');
            this.performTransaction(sim);
            sim.finishAction();
            return;
        }

        // 找最近的收银台
        const cashier = cashiers[0]; // 简化，取第一个
        const { interact } = getInteractionPos(cashier);
        sim.target = interact;
        sim.interactionTarget = cashier;
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        if (sim.target && sim.moveTowardsTarget(dt)) {
            // 到达收银台，执行交易
            this.performTransaction(sim);
            sim.finishAction();
        }
    }

    private performTransaction(sim: Sim) {
        // 复用 interactionRegistry 里的 buy_item 逻辑，或者简单扣款
        const cost = this.targetItemShelf.cost || 20; // 默认价格
        if (sim.money >= cost) {
            sim.money -= cost;
            sim.say(`支付了 $${cost}`, 'money');
            sim.needs[NeedType.Fun] += 10;
            // 如果是书架买的书，可以在这里添加物品进背包(如果有背包系统)
        } else {
            sim.say("哎呀，钱不够...", 'bad');
        }
    }
}