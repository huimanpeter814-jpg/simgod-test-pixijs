// utils/simulationWorker.ts
import { GameStore } from './GameStore';
import { gameLoopStep } from './GameLoop';
import { Sim } from './Sim';
import { SAB_CONFIG, ACTION_CODE } from '../constants'; // 引入配置

// 标记我们在 Worker 环境中，避免 GameStore 尝试创建 Worker
// @ts-ignore
self.isWorker = true;

console.log("[Worker] Simulation Worker Started");

let loopInterval: any = null;

// 初始化 Worker 端的 GameStore
// 注意：这里的 GameStore 是 Worker 线程中独立的实例
GameStore.sims = [];
GameStore.worldLayout = [];

const TARGET_FPS = 30; // 逻辑帧率可以锁定在 30 或 60
const TICK_RATE = 1000 / TARGET_FPS;

const startLoop = () => {
    if (loopInterval) clearInterval(loopInterval);
    loopInterval = setInterval(() => {
        // 1. 执行逻辑计算 (保持不变)
        gameLoopStep(1); 

        // 2. 🚀 [新增] 将数据写入共享内存 (Zero Copy Sync)
        // 只有当内存初始化后才执行
        if (GameStore.sharedView) {
            GameStore.sims.forEach(s => {
                // 确保该 Sim 分配了内存位置
                // (Worker 是逻辑源头，所以由 Worker 负责调用 allocSabIndex)
                const index = GameStore.allocSabIndex(s.id);
                
                if (index !== -1) {
                    const base = index * SAB_CONFIG.STRUCT_SIZE;
                    const view = GameStore.sharedView;

                    // 写入各项数据
                    view[base + SAB_CONFIG.OFFSET_X] = s.pos.x;
                    view[base + SAB_CONFIG.OFFSET_Y] = s.pos.y;
                    
                    // 将字符串动作转换为数字 ID (如果在 ACTION_CODE 里没找到，就默认为 0/idle)
                    // 注意：你需要确保 s.action 是字符串，或者根据你的逻辑调整
                    const actionKey = s.action as string; 
                    view[base + SAB_CONFIG.OFFSET_ACTION] = ACTION_CODE[actionKey as keyof typeof ACTION_CODE] || 0;
                    
                    // 示例：写入朝向 (简单判断：如果目标在右边则为 1，左边为 0)
                    // view[base + SAB_CONFIG.OFFSET_DIR] = (s.target && s.target.x > s.pos.x) ? 1 : 0;
                }
            });
        }

        // 3. 发送消息回主线程
        // ⚠️ 关键优化：既然位置已经通过 SAB 同步了，payload 里就不需要发那么详细的数据了
        // 但为了保持兼容性，同时也为了让主线程知道 "哪个 ID 对应 哪个 SAB Index"，
        // 我们需要在 payload 里带上 index 信息。
        
        const syncData = {
            type: 'SYNC',
            payload: {
                sims: GameStore.sims.map(s => {
                    // 1. 基础数据 (Roster 和 Canvas 需要的)
                    const baseData: any = {
                        id: s.id,
                        sabIndex: GameStore.simIndexMap.get(s.id) ?? -1,
                        name: s.name,
                        surname: s.surname,
                        familyId: s.familyId, // Roster 分组需要
                        gender: s.gender,
                        ageStage: s.ageStage,
                        age: s.age, // Inspector header 需要
                        appearance: s.appearance, // Roster 头像需要
                        mood: s.mood,
                        health: s.health,
                        action: s.action, // UI文字显示
                        bubble: s.bubble,
                        homeId: s.homeId, 
                        job: { title: s.job?.title }, // 简略职业信息
                        isPregnant: s.isPregnant,
                    };

                   
                    // 2. 🔥 [优化] 只有当该 Sim 是被选中的 Sim 时，才发送详细数据
                    if (s.id === GameStore.selectedSimId) {
                        // === 核心需求与状态 (StatusTab) ===
                        baseData.needs = s.needs;
                        baseData.buffs = s.buffs;
                        
                        // === AI 决策大脑 (StatusTab) ===
                        baseData.currentIntent = s.currentIntent;
                        baseData.actionQueue = s.actionQueue;
                        baseData.lastDecisionReason = s.lastDecisionReason; // Why
                        baseData.currentPlanDescription = s.currentPlanDescription; // Strategy
                        // 处理 interactionTarget，防止发送巨大对象或循环引用，只取 UI 需要的 label
                        baseData.interactionTarget = s.interactionTarget ? { label: s.interactionTarget.label } : null;

                        // === 经济系统 (StatusTab) ===
                        baseData.money = s.money;
                        baseData.dailyBudget = s.dailyBudget;
                        baseData.dailyIncome = s.dailyIncome;
                        baseData.dailyExpense = s.dailyExpense;
                        baseData.dailyTransactions = s.dailyTransactions;

                        // === 属性与技能 (AttrTab) ===
                        baseData.skills = s.skills;
                        baseData.traits = s.traits;
                        baseData.lifeGoal = s.lifeGoal;
                        baseData.zodiac = s.zodiac;
                        baseData.mbti = s.mbti;
                        baseData.orientation = s.orientation;
                        
                        // 身体数值 (AttrTab)
                        baseData.height = s.height;
                        baseData.weight = s.weight;
                        baseData.appearanceScore = s.appearanceScore;
                        baseData.luck = s.luck;
                        baseData.constitution = s.constitution;
                        baseData.iq = s.iq;
                        baseData.eq = s.eq;

                        // 详细色值 (AttrTab 显示文字需要，InspectorFace 可能也需要)
                        baseData.skinColor = s.skinColor;
                        baseData.hairColor = s.hairColor;
                        baseData.clothesColor = s.clothesColor;
                        baseData.pantsColor = s.pantsColor;

                        // === 职业详细信息 (AttrTab) ===
                        // baseData 里只有简略的 title，这里覆盖为完整对象以获取 level, salary, hours
                        baseData.job = s.job; 
                        baseData.workPerformance = s.workPerformance;

                        // === 社交与家庭 (FamilyTab / Inspector) ===
                        baseData.relationships = s.relationships; // 包含亲密度、恋爱关系
                        baseData.partnerId = s.partnerId;
                        baseData.fatherId = s.fatherId;
                        baseData.motherId = s.motherId;
                        baseData.childrenIds = s.childrenIds;
                        baseData.familyLore = s.familyLore;
                        baseData.faithfulness = s.faithfulness; // 专一度

                        // === 记忆系统 (Inspector Memory Tab) ===
                        baseData.memories = s.memories;
                    }

                    return baseData;
                }),
                time: GameStore.time,
                logs: GameStore.logs // 日志也可以做 diff 优化，暂时全量
            }
        };
        self.postMessage(syncData);

    }, TICK_RATE);
};

const stopLoop = () => {
    if (loopInterval) clearInterval(loopInterval);
    loopInterval = null;
};

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT_SAB':
            // 接收主线程发来的共享内存，并初始化 Worker 端的 GameStore
            GameStore.initSharedMemory(payload.buffer);
            console.log("[Worker] Shared Memory Linked Successfully");
            break;
        case 'INIT':
            // 接收初始地图数据
            if (payload.worldLayout) GameStore.worldLayout = payload.worldLayout;
            if (payload.furniture) GameStore.furniture = payload.furniture;
            if (payload.rooms) GameStore.rooms = payload.rooms;
            if (payload.housingUnits) GameStore.housingUnits = payload.housingUnits;
            // 重建索引
            GameStore.initIndex();
            GameStore.refreshFurnitureOwnership();
            console.log("[Worker] World Initialized");
            break;

        case 'START':
            startLoop();
            break;

        case 'PAUSE':
            stopLoop();
            break;

        case 'SET_SPEED':
            GameStore.time.speed = payload;
            break;

        case 'SPAWN_FAMILY':
            GameStore.spawnFamily(payload.size);
            break;

        case 'SPAWN_SINGLE':
            GameStore.spawnSingle();
            break;
        
        case 'SPAWN_CUSTOM':
            GameStore.spawnCustomSim(payload);
            break;
            
        case 'SPAWN_CUSTOM_FAMILY':
            GameStore.spawnCustomFamily(payload);
            break;

        case 'UPDATE_MAP':
            // 编辑器修改了地图，同步给 Worker
            GameStore.worldLayout = payload.worldLayout;
            GameStore.furniture = payload.furniture;
            GameStore.rooms = payload.rooms;
            GameStore.housingUnits = payload.housingUnits; // 记得同步房屋单元数据
            GameStore.initIndex();
            GameStore.refreshFurnitureOwnership();
            break;

        case 'LOAD_GAME':
            // 加载存档
            // 我们复用 GameStore.loadGame 的逻辑，但要注意它原本是从 localStorage 读取
            // 这里我们直接接收数据
            const data = payload;
            GameStore.worldLayout = data.worldLayout || [];
            GameStore.rooms = data.rooms || [];
            GameStore.furniture = data.furniture || (data.customFurniture ? [...GameStore.furniture, ...data.customFurniture] : []);
            GameStore.time = data.time;
            GameStore.logs = data.logs || [];
            GameStore.loadSims(data.sims);
            GameStore.initIndex();
            GameStore.refreshFurnitureOwnership();
            // 🔥 [新增] 加载完后，把地图数据发回给主线程！
            self.postMessage({
                type: 'INIT_MAP', // 使用专用类型
                payload: {
                    worldLayout: GameStore.worldLayout,
                    furniture: GameStore.furniture,
                    rooms: GameStore.rooms,
                    housingUnits: GameStore.housingUnits
                }
            });
            break;

        case 'SAVE_GAME':
             const slot = payload.slot;
             // 收集全量数据
             const saveData = {
                 version: 3.2,
                 timestamp: Date.now(),
                 time: GameStore.time,
                 logs: GameStore.logs,
                 sims: GameStore.sims, // Worker 里的 sims 是全量的，包含所有细节！
                 worldLayout: GameStore.worldLayout,
                 rooms: GameStore.rooms,
                 furniture: GameStore.furniture
             };
             // 发回给主线程保存
             self.postMessage({ type: 'SAVE_DATA_READY', payload: { slot, data: saveData } });
             break;

        // ✅ [新增] 处理开始新游戏 (生成默认地图和人口)
        case 'START_NEW_GAME':
            console.log("[Worker] Starting New Game...");
            GameStore.rebuildWorld(true); // 加载默认地图
            
            // 生成初始人口 (和以前 initGame 的逻辑一样)
            GameStore.spawnSingle();
            GameStore.spawnSingle();
            GameStore.spawnFamily();
            GameStore.spawnFamily();
            
            // 记录日志
            GameStore.addLog(null, `新世界已生成！当前人口: ${GameStore.sims.length}`, "sys");
            // 🔥 [新增] 生成完后，把地图数据发回给主线程！
            self.postMessage({
                type: 'INIT_MAP',
                payload: {
                    worldLayout: GameStore.worldLayout,
                    furniture: GameStore.furniture,
                    rooms: GameStore.rooms,
                    housingUnits: GameStore.housingUnits
                }
            });
            break;

        case 'SELECT_SIM':
            GameStore.selectedSimId = payload;
            break;

        // ✅ [新增] 处理分配住址
        case 'ASSIGN_HOME':
            {
                const sim = GameStore.sims.find(s => s.id === payload);
                if (sim) {
                    // 这里直接调用 Worker 端 GameStore 的原有逻辑
                    // 因为 Worker 拥有完整的 worldLayout 和 housingUnits 数据
                    GameStore.assignRandomHome(sim);
                    
                    // 强制 Worker 立即同步一次日志和 Toast 回去 (可选)
                    // 下一次 gameLoopStep 也会自动同步
                }
            }
            break;
            
        // ✅ [新增] 处理生成保姆
        case 'SPAWN_NANNY':
             GameStore.spawnNanny(payload); // payload is homeId
             break;
            
        case 'REMOVE_SIM':
            GameStore.removeSim(payload);
            break;
    }
};