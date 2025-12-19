import { Sim } from '../Sim';
import { GameStore } from '../simulation';
import { SimAction, JobType, NeedType, AgeStage, Furniture } from '../../types';
import { CareerLogic } from './career';
import { DecisionLogic } from './decision';
import { SocialLogic } from './social';
import { SchoolLogic } from './school';
import { INTERACTIONS, RESTORE_TIMES } from './interactionRegistry';
import { hasRequiredTags } from '../simulationHelpers';

// === 1. 状态接口定义 ===
export interface SimState {
    actionName: SimAction | string; 
    enter(sim: Sim): void;
    update(sim: Sim, dt: number): void;
    exit(sim: Sim): void;
}

// === 2. 基础状态 (提供默认行为) ===
export abstract class BaseState implements SimState {
    abstract actionName: string;

    enter(sim: Sim): void {}
    
    update(sim: Sim, dt: number): void {
        this.decayNeeds(sim, dt);
    }

    exit(sim: Sim): void {}

    protected decayNeeds(sim: Sim, dt: number, exclude: NeedType[] = []) {
        sim.decayNeeds(dt, exclude);
    }
}
// === 🆕 过渡状态 (Transition) ===
// 用于处理从行走结束点(Anchor)到实际交互点(InteractPos)的平滑位移
// 解决“瞬移”和“穿模”问题
export class TransitionState extends BaseState {
    actionName = 'transition';
    targetPos: { x: number, y: number };
    nextStateFactory: () => SimState;
    duration: number = 0.3; // 300ms 过渡时间
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
        sim.path = []; // 清空寻路路径，防止干扰
    }

    update(sim: Sim, dt: number) {
        // 简单 Lerp 动画
        // 注意：dt 是 tick 增量，这里我们需要将其视为时间流逝
        // 假设 dt=1 约为 1/60 秒 (16ms)
        const deltaSec = 0.016 * dt * GameStore.time.speed; 
        
        // 为了视觉平滑，忽略游戏加速带来的过快跳跃，使用固定步长
        // 或者直接累加进度
        this.elapsed += 0.05 * dt; // 调节这个系数控制速度

        const t = Math.min(1, this.elapsed / (this.duration * 60)); // duration以秒为单位，这里简单估算
        
        // Ease-out
        const easeT = 1 - Math.pow(1 - t, 3);

        if (this.startPos) {
            sim.pos.x = this.startPos.x + (this.targetPos.x - this.startPos.x) * easeT;
            sim.pos.y = this.startPos.y + (this.targetPos.y - this.startPos.y) * easeT;
        }

        if (t >= 1) {
            // 动画结束，吸附坐标并进入下一状态
            sim.pos = { ...this.targetPos };
            sim.changeState(this.nextStateFactory());
        }
    }
}
// === 3. 具体状态实现 ===

// --- 空闲状态 (Idle) ---
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
            // 只有非工作状态且空闲时才做决策
            if (sim.job.id !== 'unemployed' || ![AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
                 DecisionLogic.decideAction(sim);
                 sim.decisionTimer = 30 + Math.random() * 30;
            } else {
                 DecisionLogic.decideAction(sim);
                 sim.decisionTimer = 30 + Math.random() * 30;
            }
        }
    }
}

// 原地等待状态
export class WaitingState extends BaseState {
    actionName = SimAction.Waiting;
    
    enter(sim: Sim) {
        sim.target = null;
        sim.path = [];
        sim.say("...", 'sys');
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
    }
}

// --- 移动状态 ---
export class MovingState extends BaseState {
    actionName: string;
    moveTimeout: number = 0;

    constructor(actionName: string = SimAction.Moving) {
        super();
        this.actionName = actionName;
    }

    enter(sim: Sim) {
        super.enter(sim);
        this.moveTimeout = 0;
    }

    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        this.moveTimeout += dt;
        
        if (this.moveTimeout > 1500 && sim.target) {
            sim.pos = { ...sim.target };
            this.handleArrival(sim);
            return;
        }

        const arrived = sim.moveTowardsTarget(dt);
        if (arrived) {
            this.handleArrival(sim);
        }
    }

    private handleArrival(sim: Sim) {
        if (this.actionName === SimAction.MovingHome) {
            sim.changeState(new IdleState());
        } else if (sim.interactionTarget) { // [修复] 这里之前错误地使用了 this.interactionTarget
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
    enter(sim: Sim) {
        sim.path = [];
        const station = this.findWorkstation(sim);
        if (station) {
            this.phase = 'to_station';
            // 🆕 使用 getInteractionPos 确保走到椅子前而不是穿模
            // 但这里为了简单，暂时保留原逻辑，或者你可以在 findWorkstation 返回后调用 getInteractionPos
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
        const arrived = sim.moveTowardsTarget(dt);
        if (arrived) {
            if (this.phase === 'to_plot') {
                sim.lastPunchInTime = GameStore.time.hour + GameStore.time.minute / 60;
                if (sim.lastPunchInTime > sim.job.startHour + 0.1) { sim.say("迟到了！😱", 'bad'); sim.workPerformance -= 5; } else { sim.say("打卡成功", 'sys'); }
                const station = this.findWorkstation(sim);
                if (station) {
                    this.phase = 'to_station';
                    sim.target = { x: station.x + station.w/2, y: station.y + station.h + 5 };
                    sim.interactionTarget = { ...station, utility: 'work' };
                } else { sim.say("没位置了...", 'bad'); sim.changeState(new WorkingState()); }
            } else { sim.changeState(new WorkingState()); }
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
    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        sim.commuteTimer += dt;
        if (sim.commuteTimer > 1200 && sim.target) {
            sim.pos = { ...sim.target };
            sim.changeState(new SchoolingState());
            sim.say("上课中...", 'act');
            return;
        }
        const arrived = sim.moveTowardsTarget(dt);
        if (arrived) { sim.changeState(new SchoolingState()); sim.say("乖乖上学", 'act'); }
    }
}

// 上学状态
export class SchoolingState extends BaseState {
    actionName = SimAction.Schooling;
    wanderTimer = 0;
    update(sim: Sim, dt: number) {
        sim.needs[NeedType.Fun] -= 0.002 * dt;
        sim.skills.logic += 0.002 * dt;
        if (sim.target) {
            const arrived = sim.moveTowardsTarget(dt);
            if (arrived && sim.interactionTarget) { sim.actionTimer = 200; sim.target = null; }
            return;
        }
        if (sim.actionTimer > 0) { sim.actionTimer -= dt; return; }
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
            this.wanderTimer = 300 + Math.random() * 300; 
            let schoolType = 'high_school';
            if (sim.ageStage === AgeStage.Child) schoolType = 'elementary';
            if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) schoolType = 'kindergarten';
            const plot = GameStore.worldLayout.find(p => p.templateId === schoolType);
            if (plot) {
                if (Math.random() > 0.5) {
                    const area = { minX: plot.x, maxX: plot.x + (plot.width||300), minY: plot.y, maxY: plot.y + (plot.height||300) };
                    SchoolLogic.findObjectInArea(sim, 'play', area); 
                } else {
                    const tx = plot.x + 20 + Math.random() * ((plot.width||300) - 40);
                    const ty = plot.y + 20 + Math.random() * ((plot.height||300) - 40);
                    sim.target = { x: tx, y: ty };
                }
            }
        }
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

// 🆕 修正：跟随状态仅允许在家里跟随
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

// 🆕 保姆工作状态
export class NannyState extends BaseState {
    actionName = SimAction.NannyWork;
    wanderTimer = 0;
    update(sim: Sim, dt: number) {
        const parentsHome = GameStore.sims.some(s => s.homeId === sim.homeId && !s.isTemporary && s.ageStage !== AgeStage.Infant && s.ageStage !== AgeStage.Toddler && s.isAtHome());
        if (parentsHome) { GameStore.addLog(sim, "主人回来啦，我下班了。", "normal"); GameStore.removeSim(sim.id); return; }
        const babies = GameStore.sims.filter(s => s.homeId === sim.homeId && (s.ageStage === AgeStage.Infant || s.ageStage === AgeStage.Toddler));
        if (babies.length > 0) {
            const needyBaby = babies.sort((a, b) => a.mood - b.mood)[0];
            if (needyBaby.mood < 60) {
                const dist = Math.sqrt(Math.pow(sim.pos.x - needyBaby.pos.x, 2) + Math.pow(sim.pos.y - needyBaby.pos.y, 2));
                if (dist > 40) { sim.target = { x: needyBaby.pos.x + 10, y: needyBaby.pos.y }; sim.moveTowardsTarget(dt); } 
                else { if (Math.random() < 0.01) { sim.say("乖宝宝不哭~", "family"); needyBaby.needs[NeedType.Fun] += 10; needyBaby.needs[NeedType.Social] += 10; needyBaby.needs[NeedType.Hunger] += 10; } }
                return;
            }
        }
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
            this.wanderTimer = 200 + Math.random() * 200;
            const home = sim.getHomeLocation();
            if (home) {
                const homeUnit = GameStore.housingUnits.find(u => u.id === sim.homeId);
                if (homeUnit) { const tx = homeUnit.x + Math.random() * homeUnit.area.w; const ty = homeUnit.y + Math.random() * homeUnit.area.h; sim.target = { x: tx, y: ty }; }
            }
        }
        if (sim.target) sim.moveTowardsTarget(dt);
    }
}

// 家长去接孩子 (PickingUp)
export class PickingUpState extends BaseState {
    actionName = SimAction.PickingUp;
    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        if (sim.carryingSimId) {
            const child = GameStore.sims.find(s => s.id === sim.carryingSimId);
            if (child) {
                sim.target = { x: child.pos.x, y: child.pos.y };
                if (sim.path.length > 0) {
                    const lastNode = sim.path[sim.path.length - 1];
                    const distToPathEnd = Math.sqrt(Math.pow(lastNode.x - child.pos.x, 2) + Math.pow(lastNode.y - child.pos.y, 2));
                    if (distToPathEnd > 40) sim.path = []; 
                }
            }
        }
        const arrived = sim.moveTowardsTarget(dt);
        if (sim.carryingSimId) {
            const child = GameStore.sims.find(s => s.id === sim.carryingSimId);
            if (child) {
                const dist = Math.sqrt(Math.pow(sim.pos.x - child.pos.x, 2) + Math.pow(sim.pos.y - child.pos.y, 2));
                if (dist < 20) { 
                    const kindergarten = GameStore.worldLayout.find(p => p.templateId === 'kindergarten');
                    const isAtSchool = kindergarten && child.pos.x >= kindergarten.x && child.pos.x <= kindergarten.x + (kindergarten.width||300) && child.pos.y >= kindergarten.y && child.pos.y <= kindergarten.y + (kindergarten.height||300);
                    if (isAtSchool) {
                        const home = sim.getHomeLocation(); 
                        if (home) { sim.target = { x: home.x, y: home.y }; sim.path = []; child.carriedBySimId = sim.id; child.changeState(new BeingEscortedState()); sim.changeState(new EscortingState()); sim.say("走，回家咯！", 'family'); }
                    } else if (kindergarten) {
                        const tx = kindergarten.x + (kindergarten.width || 300)/2; const ty = kindergarten.y + (kindergarten.height || 300)/2;
                        sim.target = { x: tx, y: ty }; sim.path = []; child.carriedBySimId = sim.id; child.changeState(new BeingEscortedState()); sim.changeState(new EscortingState()); sim.say("抓到你了，上学去！", 'family');
                    } else { sim.carryingSimId = null; sim.changeState(new IdleState()); }
                }
            }
        }
    }
}

// 家长护送/抱着孩子 (Escorting)
export class EscortingState extends BaseState {
    actionName = SimAction.Escorting;
    enter(sim: Sim) { sim.path = []; }
    update(sim: Sim, dt: number) {
        super.update(sim, dt);
        const arrived = sim.moveTowardsTarget(dt);
        if (sim.carryingSimId) {
            const child = GameStore.sims.find(s => s.id === sim.carryingSimId);
            if (child) { child.pos.x = sim.pos.x + 6; child.pos.y = sim.pos.y - 12; child.target = null; child.path = []; }
        }
        if (arrived) {
            if (sim.carryingSimId) {
                const child = GameStore.sims.find(s => s.id === sim.carryingSimId);
                if (child) {
                    child.carriedBySimId = null;
                    const kindergarten = GameStore.worldLayout.find(p => p.templateId === 'kindergarten');
                    const isAtSchool = kindergarten && sim.pos.x >= kindergarten.x && sim.pos.x <= kindergarten.x + (kindergarten.width||300) && sim.pos.y >= kindergarten.y && sim.pos.y <= kindergarten.y + (kindergarten.height||300);
                    if (isAtSchool) { child.changeState(new SchoolingState()); child.say("拜拜~ 👋", 'family'); } 
                    else { child.changeState(new IdleState()); child.say("到家啦！", 'family'); }
                }
                sim.carryingSimId = null;
            }
            sim.say("任务完成", 'family');
            if (sim.isTemporary) { GameStore.removeSim(sim.id); } else { sim.changeState(new IdleState()); }
        }
    }
}

// 孩子被抱着 (BeingEscorted)
export class BeingEscortedState extends BaseState {
    actionName = SimAction.BeingEscorted;
    update(sim: Sim, dt: number) {
        sim.needs[NeedType.Social] += 0.01 * dt;
        sim.needs[NeedType.Fun] += 0.01 * dt;
        if (sim.carriedBySimId) {
            const carrier = GameStore.sims.find(s => s.id === sim.carriedBySimId);
            if (!carrier || (carrier.action !== SimAction.Escorting && carrier.action !== SimAction.PickingUp)) {
                sim.carriedBySimId = null;
                sim.changeState(new IdleState());
            }
        } else { sim.changeState(new IdleState()); }
    }
}

// 🆕 喂食婴儿状态
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
            sim.target = { x: baby.pos.x + 15, y: baby.pos.y };
            sim.say("来喂宝宝了~", 'family');
        } else {
            sim.changeState(new IdleState());
        }
    }

    update(sim: Sim, dt: number) {
        const baby = GameStore.sims.find(s => s.id === this.targetBabyId);
        if (!baby) {
            sim.changeState(new IdleState());
            return;
        }

        // 如果还没到，继续移动
        if (sim.target) {
            const arrived = sim.moveTowardsTarget(dt);
            if (!arrived) return;
        }

        // 到达后喂食
        if (baby.needs[NeedType.Hunger] < 100) {
            // 恢复系数
            const restoreAmount = 0.5 * dt; 
            baby.needs[NeedType.Hunger] += restoreAmount;
            
            // 家长消耗
            sim.needs[NeedType.Energy] -= 0.05 * dt;

            if (Math.random() < 0.05) {
                sim.say("乖乖吃饭...", 'family');
                baby.say("🍼...", 'normal');
            }
        } else {
            // 喂饱了
            sim.say("吃饱饱啦！", 'family');
            baby.say("😊", 'love');
            sim.changeState(new IdleState());
            baby.changeState(new IdleState());
        }
    }
}