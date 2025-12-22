// utils/simulationWorker.ts
import { GameStore } from './GameStore';
import { gameLoopStep } from './GameLoop';
import { Sim } from './Sim';

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
        // 执行一帧逻辑
        gameLoopStep(1); // dt = 1 (或者基于时间差计算)

        // 将核心数据同步回主线程用于渲染
        // 为了性能，我们只发送渲染和UI需要的数据
        const syncData = {
            type: 'SYNC',
            payload: {
                sims: GameStore.sims.map(s => ({
                    // 序列化 Sim 对象，保留渲染所需属性
                    id: s.id,
                    name: s.name,
                    pos: s.pos,
                    action: s.action,
                    ageStage: s.ageStage,
                    appearance: s.appearance,
                    skinColor: s.skinColor,
                    hairColor: s.hairColor,
                    clothesColor: s.clothesColor,
                    pantsColor: s.pantsColor,
                    mood: s.mood,
                    health: s.health,
                    bubble: s.bubble,
                    carryingSimId: s.carryingSimId,
                    carriedBySimId: s.carriedBySimId,
                    // 其他 UI 可能需要的属性...
                    job: s.job,
                    money: s.money,
                    needs: s.needs,
                    relationships: s.relationships,
                    memories: s.memories, // 注意：如果记忆太多可能会卡，可考虑截断
                    familyId: s.familyId,
                    surname: s.surname,
                    partnerId: s.partnerId,
                    childrenIds: s.childrenIds,
                    traits: s.traits,
                    isPregnant: s.isPregnant,
                    isTemporary: s.isTemporary,
                    homeId: s.homeId,
                    workplaceId: s.workplaceId
                })),
                time: GameStore.time,
                logs: GameStore.logs // 同步日志
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
            
        case 'REMOVE_SIM':
            GameStore.removeSim(payload);
            break;
    }
};