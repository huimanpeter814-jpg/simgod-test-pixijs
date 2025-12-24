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
                // 简化版 Sims 列表 (不再包含 x, y 等高频数据，只发元数据)
                sims: GameStore.sims.map(s => ({
                    id: s.id,
                    // 必须把分配的 index 告诉主线程！
                    sabIndex: GameStore.simIndexMap.get(s.id) ?? -1, 
                    
                    // 下面这些属性是 UI 展示需要的，依然需要发送 (除非你也把它们放入 SAB)
                    name: s.name,
                    ageStage: s.ageStage,
                    appearance: s.appearance,
                    skinColor: s.skinColor,
                    hairColor: s.hairColor,
                    clothesColor: s.clothesColor,
                    pantsColor: s.pantsColor,
                    mood: s.mood,
                    bubble: s.bubble, // 气泡是稀疏数据，适合 postMessage
                    action: s.action, // UI 显示文字用
                    // ... 其他 UI 属性保持不变 ...
                })),
                time: GameStore.time,
                logs: GameStore.logs
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
            break;
            
        case 'REMOVE_SIM':
            GameStore.removeSim(payload);
            break;
    }
};