import { JOBS, BUFFS } from '../constants';
import { Vector2, Job, Buff, SimAppearance, Memory, Relationship, AgeStage, SimAction, JobType, NeedType } from '../types';
import { GameStore } from './simulation'; 
import { minutes } from './simulationHelpers';

// 逻辑模块导入
import { SocialLogic } from './logic/social';
import { CareerLogic } from './logic/career';
import { SchoolLogic } from './logic/school';
import { LifeCycleLogic } from './logic/LifeCycleLogic'; 
import { EconomyLogic } from './logic/EconomyLogic';     
import { SimInitializer, SimInitConfig } from './logic/SimInitializer';
import { MovementLogic } from './logic/MovementLogic';
import { NeedsLogic } from './logic/NeedsLogic';
import { InteractionSystem } from './logic/InteractionSystem';

// 状态机导入
import { 
    SimState, IdleState, WorkingState, MovingState, CommutingState, InteractionState, 
    FollowingState, CommutingSchoolState, SchoolingState, PlayingHomeState, 
    PickingUpState, EscortingState, BeingEscortedState, NannyState 
} from './logic/SimStates';

export class Sim {
    // === 数据属性 (Data Properties) ===
    id!: string;
    familyId!: string;
    homeId: string | null = null;
    workplaceId?: string; 
    commutePreTime: number = 30; 
    lastPunchInTime?: number;    
    
    pos!: Vector2;
    prevPos!: Vector2; 
    target: Vector2 | null = null;
    
    path: Vector2[] = [];
    currentPathIndex: number = 0;
    
    speed!: number;
    gender!: 'M' | 'F';
    name!: string;
    surname!: string;
    
    skinColor!: string;
    hairColor!: string;
    clothesColor!: string;
    pantsColor!: string;
    appearance!: SimAppearance;

    mbti!: string;
    zodiac!: any;
    
    traits!: string[];
    familyLore?: string;

    age!: number;
    ageStage!: AgeStage; 
    health!: number;

    partnerId: string | null = null;
    fatherId: string | null = null;
    motherId: string | null = null;
    childrenIds: string[] = [];

    isPregnant: boolean = false;
    pregnancyTimer: number = 0;
    partnerForBabyId: string | null = null;

    lifeGoal!: string;
    orientation!: string;
    faithfulness!: number;

    height!: number;
    weight!: number;
    appearanceScore!: number;
    luck!: number;
    constitution!: number;    
    eq!: number;              
    iq!: number;              
    reputation!: number;      
    morality!: number;        
    creativity!: number;      

    needs!: Record<NeedType, number>; 
    skills!: any;
    relationships: Record<string, Relationship> = {};
    
    buffs!: Buff[];
    mood!: number;
    
    money!: number;
    dailyBudget!: number;
    workPerformance!: number;
    consecutiveAbsences: number = 0; 

    job!: Job; 
    dailyExpense!: number;
    dailyIncome!: number; 
    isSideHustle: boolean = false;
    currentShiftStart: number = 0;

    // 🆕 自由职业/物品相关
    royalty: { amount: number, daysLeft: number } = { amount: 0, daysLeft: 0 };
    hasFreshIngredients: boolean = false;
    
    // 🆕 购买意图缓存 (防止云购物)
    intendedShoppingItemId?: string;

    schoolPerformance: number = 60; 
    hasLeftWorkToday: boolean = false;

    metabolism!: any;
    skillModifiers!: Record<string, number>;
    socialModifier!: number;

    memories: Memory[] = [];

    state: SimState;
    action: SimAction | string; 
    
    actionTimer!: number;
    interactionTarget: any = null;
    bubble: { text: string | null; timer: number; type: string } = { text: null, timer: 0, type: 'normal' };

    commuteTimer: number = 0;
    decisionTimer: number = 0; 

    carryingSimId: string | null = null; 
    carriedBySimId: string | null = null; 

    // [修改] 标记是否为临时角色/NPC
    isTemporary: boolean = false; 
    // [新增] 明确标记 NPC 身份 (UI层应据此过滤，不显示在居民列表)
    isNPC: boolean = false;

    constructor(config: SimInitConfig = {}) {
        SimInitializer.initialize(this, config);
        
        // 构造后逻辑
        this.calculateDailyBudget();
        if ([AgeStage.Adult, AgeStage.MiddleAged].includes(this.ageStage)) { 
            this.assignJob(); 
        }
        
        // 初始状态
        this.state = new IdleState();
        this.action = SimAction.Idle;
    }

    // === 核心生命周期 (Lifecycle) ===

    update(dt: number, minuteChanged: boolean) {
        if (!this.prevPos) this.prevPos = { x: this.pos.x, y: this.pos.y };
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;
        
        // 每分钟更新逻辑 (低频)
        if (minuteChanged) {
            SchoolLogic.checkKindergarten(this); 
            NeedsLogic.updateBuffs(this, 1); 
            NeedsLogic.updateMood(this); 
            NeedsLogic.checkHealth(this, dt);
            
            LifeCycleLogic.checkDeath(this, dt); 
            this.checkSchedule();

            // 零点检查 & 版税结算
            if (GameStore.time.hour === 0 && GameStore.time.minute === 0) { 
                CareerLogic.checkFire(this); 
                
                // 🆕 结算版税
                if (this.royalty && this.royalty.amount > 0) {
                    this.money += this.royalty.amount;
                    this.dailyIncome += this.royalty.amount;
                    GameStore.addLog(this, `收到作品版税 +$${this.royalty.amount}`, 'money');
                    this.say("版税到账 💰", 'money');
                    
                    this.royalty.daysLeft--;
                    if (this.royalty.daysLeft <= 0) {
                        this.royalty.amount = 0;
                        this.say("版税停了，该写新书了...", 'sys');
                    }
                }
            }
            
            // 怀孕逻辑
            if (this.isPregnant) { 
                this.pregnancyTimer -= 1; 
                if (this.pregnancyTimer <= 0) this.giveBirth(); 
                else if (this.pregnancyTimer % 60 === 0 && Math.random() > 0.8) this.say("宝宝踢我了...", 'act'); 
            }
            
            // 零花钱
            if (GameStore.time.hour === 6 && GameStore.time.minute === 0) { 
                SchoolLogic.giveAllowance(this); 
            }
            
            // 负面状态检查
            if (this.needs[NeedType.Social] < 20 && !this.hasBuff('lonely')) { this.addBuff(BUFFS.lonely); this.say("好孤独...", 'bad'); }
            if (this.needs[NeedType.Fun] < 20 && !this.hasBuff('bored')) { this.addBuff(BUFFS.bored); this.say("无聊透顶...", 'bad'); }
            if (this.needs[NeedType.Hygiene] < 20 && !this.hasBuff('smelly')) { this.addBuff(BUFFS.smelly); this.say("身上有味了...", 'bad'); }
            
            // [保姆生成逻辑优化]
            if (this.homeId && [AgeStage.Infant, AgeStage.Toddler].includes(this.ageStage) && this.isAtHome() && !this.carriedBySimId && this.action !== SimAction.Waiting && this.action !== SimAction.BeingEscorted) {
                const parentsHome = GameStore.sims.some(s => (s.id === this.motherId || s.id === this.fatherId) && s.homeId === this.homeId && s.isAtHome());
                if (!parentsHome) { 
                    // 检查是否已经有保姆/NPC在服务
                    const hasNanny = GameStore.sims.some(s => s.homeId === this.homeId && (s.isTemporary || s.isNPC)); 
                    if (!hasNanny) GameStore.spawnNanny(this.homeId, 'home_care'); 
                }
            }
        }

        // [修改] 移除婴幼儿自动跟随逻辑，响应用户需求 "婴幼儿取消跟随状态"
        /*
        if ([AgeStage.Infant, AgeStage.Toddler].includes(this.ageStage)) { 
            if (this.action === SimAction.Idle && !this.target && !this.interactionTarget) { 
                if (this.isAtHome()) { this.changeState(new FollowingState()); } 
            } 
        }
        */
        
        this.state.update(this, dt);
        
        if (this.bubble.timer > 0) this.bubble.timer -= dt;
    }

    // === 委托方法 (Delegate Methods) ===

    // 移动
    moveTowardsTarget(dt: number): boolean { 
        return MovementLogic.moveTowardsTarget(this, dt); 
    }

    // 需求
    decayNeeds(dt: number, exclude: NeedType[] = []) { 
        NeedsLogic.decayNeeds(this, dt, exclude); 
    }
    updateBuffs(minutes: number) { NeedsLogic.updateBuffs(this, minutes); }
    updateMood() { NeedsLogic.updateMood(this); }
    addBuff(buff: any) { NeedsLogic.addBuff(this, buff); }
    removeBuff(id: string) { NeedsLogic.removeBuff(this, id); }
    hasBuff(id: string) { return NeedsLogic.hasBuff(this, id); }

    // 交互
    startInteraction() { InteractionSystem.startInteraction(this); }
    finishAction() { InteractionSystem.finishAction(this); }
    
    // 生涯与经济
    assignJob() { CareerLogic.assignJob(this); }
    payRent() { EconomyLogic.payRent(this); }
    calculateDailyBudget() { EconomyLogic.calculateDailyBudget(this); }
    checkSpending() { EconomyLogic.checkSpending(this); }
    checkCareerSatisfaction() { CareerLogic.checkCareerSatisfaction(this); }
    buyItem(item: any) { EconomyLogic.buyItem(this, item); }
    earnMoney(amount: number, source: string) { EconomyLogic.earnMoney(this, amount, source); }
    leaveWorkEarly() { CareerLogic.leaveWorkEarly(this); }
    checkSchedule() { CareerLogic.checkSchedule(this); SchoolLogic.checkSchoolSchedule(this); }

    // 生命周期与社交
    checkDeath(dt: number) { LifeCycleLogic.checkDeath(this, dt); }
    die(cause: string) { LifeCycleLogic.die(this, cause); }
    handleInheritance() { LifeCycleLogic.handleInheritance(this); }
    giveBirth() { LifeCycleLogic.giveBirth(this); }
    triggerJealousy(actor: Sim, target: Sim) { SocialLogic.triggerJealousy(this, actor, target); }
    updateRelationship(target: Sim, type: string, delta: number) { SocialLogic.updateRelationship(this, target, type, delta); }
    getRelLabel(rel: any) { return SocialLogic.getRelLabel(rel); }
    getDialogue(typeId: string, target: Sim) { return SocialLogic.getDialogue(this, typeId, target); }

    // 其他
    applyTraits() { 
        if (this.mbti.includes('E')) { this.metabolism.social = 1.6; this.socialModifier *= 1.2; } else { this.metabolism.social = 0.6; this.socialModifier *= 0.9; } 
        if (this.traits.includes('活力')) { this.metabolism.energy *= 0.9; }
    }
    
    applyMonthlyEffects(month: number, holiday?: { name: string, type: string }) { 
        this.age += 0.1; 
        LifeCycleLogic.checkAgeStage(this); 
        if (!holiday) return;
        if (holiday.type === 'traditional') this.addBuff(BUFFS.festive_joy);
    }

    say(text: string, type: string = 'normal') { 
        this.bubble.text = text; 
        this.bubble.timer = 300; 
        this.bubble.type = type; 
    }

    // 辅助
    getHomeLocation(): Vector2 | null { 
        if (!this.homeId) return null; 
        const home = GameStore.housingUnits.find(u => u.id === this.homeId); 
        if (!home) return null; 
        return { x: home.x + home.area.w / 2, y: home.y + home.area.h / 2 }; 
    }
    
    isAtHome(): boolean { 
        if (!this.homeId) return false; 
        const home = GameStore.housingUnits.find(u => u.id === this.homeId); 
        if (!home) return false; 
        return (this.pos.x >= home.x && this.pos.x <= home.x + home.area.w && this.pos.y >= home.y && this.pos.y <= home.y + home.area.h); 
    }

    addMemory(text: string, type: Memory['type'], relatedSimId?: string) { 
        const timeStr = `Y${GameStore.time.year} M${GameStore.time.month} | ${String(GameStore.time.hour).padStart(2, '0')}:${String(GameStore.time.minute).padStart(2, '0')}`; 
        const newMemory: Memory = { id: Math.random().toString(36).substring(2, 9), time: timeStr, type: type, text: text, relatedSimId: relatedSimId }; 
        this.memories.unshift(newMemory); 
        if (this.memories.length > 50) { this.memories.pop(); } 
    }

    addDiary(content: string) { 
        this.addMemory(`📔 [日记] ${content}`, 'life'); 
        if (Math.random() > 0.7) this.say("写完了月度总结...", 'sys'); 
    }

    getDaySummary(monthIndex: number) { 
        const recentMemories = this.memories.slice(0, 5).map(m => m.text); 
        const activeBuffs = this.buffs.map(b => b.label).join(', '); 
        let partnerName = "无"; 
        const partnerId = Object.keys(this.relationships).find(id => this.relationships[id].isLover); 
        if (partnerId) { const partner = GameStore.sims.find(s => s.id === partnerId); if (partner) partnerName = partner.name; } 
        return { id: this.id, name: this.name, age: this.age, mbti: this.mbti, job: this.job.title, lifeGoal: this.lifeGoal, money: this.money, buffs: activeBuffs, partner: partnerName, events: recentMemories }; 
    }

    // === 状态机管理 ===

    changeState(newState: SimState) {
        if (this.state) {
            this.state.exit(this);
        }
        this.state = newState;
        this.action = newState.actionName; 
        this.state.enter(this);
    }

    restoreState() {
        switch (this.action) {
            case SimAction.Idle: this.state = new IdleState(); break;
            case SimAction.Working: this.state = new WorkingState(); break;
            case SimAction.Commuting: this.state = new CommutingState(); break;
            case SimAction.CommutingSchool: this.state = new CommutingSchoolState(); break;
            case SimAction.Schooling: this.state = new SchoolingState(); break;
            case SimAction.Following: this.state = new FollowingState(); break;
            case SimAction.PlayingHome: this.state = new PlayingHomeState(); break;
            case SimAction.PickingUp: this.state = new PickingUpState(); break;
            case SimAction.Escorting: this.state = new EscortingState(); break;
            case SimAction.BeingEscorted: this.state = new BeingEscortedState(); break;
            case SimAction.NannyWork: this.state = new NannyState(); break; 
            case SimAction.Moving:
            case SimAction.Wandering:
            case SimAction.MovingHome:
                this.state = new MovingState(this.action);
                break;
            default:
                this.state = new InteractionState(this.action);
                break;
        }
        if (!this.state) {
            this.state = new IdleState();
            this.action = SimAction.Idle;
        }
    }

    // 快捷状态切换方法
    startCommuting() { this.changeState(new CommutingState()); }
    startMovingToInteraction() { this.changeState(new MovingState(SimAction.Moving)); }
    startWandering() { this.changeState(new MovingState(SimAction.Wandering)); }
    enterWorkingState() { this.changeState(new WorkingState()); }
    enterInteractionState(actionName: string) { this.changeState(new InteractionState(actionName)); }
}