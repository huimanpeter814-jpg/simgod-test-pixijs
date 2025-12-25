import { JOBS, CONFIG, ASSET_CONFIG, SAB_CONFIG, SAB_BYTE_LENGTH, ACTION_CODE } from '../constants'; // <--- 加上 SAB_CONFIG, SAB_BYTE_LENGTH
import { PLOTS } from '../data/plots'; 
import { WORLD_LAYOUT, STREET_PROPS } from '../data/world'; 
import { LogEntry, GameTime, Furniture, RoomDef, HousingUnit, WorldPlot, SimAction, AgeStage, EditorAction, EditorState } from '../types';
import { Sim } from './Sim';
import { SpatialHashGrid } from './spatialHash';
import { PathFinder } from './pathfinding'; 
import { FamilyGenerator } from './logic/genetics';
import { EditorManager } from '../managers/EditorManager';
import { SaveManager, GameSaveData } from '../managers/SaveManager'; 
import { NannyState, PickingUpState } from './logic/SimStates';
import { SimInitConfig } from './logic/SimInitializer';
import { SocialLogic } from './logic/social';
import SimulationWorker from './simulationWorker?worker';

// 生成反向映射表 (用于把 SAB 里的数字 1 变回 "idle")
const ACTION_NAMES = Object.entries(ACTION_CODE).reduce((acc, [key, val]) => {
    acc[val] = key;
    return acc;
}, {} as Record<number, string>);

export class GameStore {
    static sims: Sim[] = [];
    // === 🚀 零拷贝内存管理 (新增) ===
    static sharedBuffer: SharedArrayBuffer;
    static sharedView: Float32Array;
    
    // 映射表：Sim.id -> 内存索引 (0 ~ MAX_SIMS-1)
    static simIndexMap: Map<string, number> = new Map();
    // 回收池：存放空闲的索引
    static availableIndices: number[] = [];

    // 修改后：支持传入 buffer (Worker 用)
    static initSharedMemory(existingBuffer?: SharedArrayBuffer) {
        if (!existingBuffer && !self.crossOriginIsolated) {
            console.error("❌ 无法使用 SharedArrayBuffer: 页面未处于跨域隔离环境。");
            return;
        }

        if (existingBuffer) {
            // Worker 模式：使用接收到的内存
            console.log("[GameStore] Linking to Shared Memory (Worker Mode)...");
            this.sharedBuffer = existingBuffer;
        } else {
            // 主线程模式：新建内存
            console.log(`[GameStore] Allocating Shared Memory: ${SAB_BYTE_LENGTH} bytes...`);
            this.sharedBuffer = new SharedArrayBuffer(SAB_BYTE_LENGTH);
        }

        this.sharedView = new Float32Array(this.sharedBuffer);
        
        // 重置回收池 (两端逻辑一致)
        this.availableIndices = [];
        for (let i = SAB_CONFIG.MAX_SIMS - 1; i >= 0; i--) {
            this.availableIndices.push(i);
        }
        this.simIndexMap.clear();
    }

    // 为 Sim 分配一个内存位置
    static allocSabIndex(simId: string): number {
        // 如果已经有位置了，直接返回
        if (this.simIndexMap.has(simId)) {
            return this.simIndexMap.get(simId)!;
        }

        // 从回收池拿一个空位
        const index = this.availableIndices.pop();
        if (index === undefined) {
            console.warn(`⚠️ 共享内存已满 (${SAB_CONFIG.MAX_SIMS} 人)，无法分配新位置！`);
            return -1;
        }

        this.simIndexMap.set(simId, index);
        return index;
    }

    // 回收 Sim 的内存位置 (当 Sim 离开或死亡时)
    static freeSabIndex(simId: string) {
        const index = this.simIndexMap.get(simId);
        if (index !== undefined) {
            // 1. 清空该位置的数据 (防止幽灵数据)
            const start = index * SAB_CONFIG.STRUCT_SIZE;
            const end = start + SAB_CONFIG.STRUCT_SIZE;
            this.sharedView.fill(0, start, end);

            // 2. 从映射表移除
            this.simIndexMap.delete(simId);
            
            // 3. 归还到回收池
            this.availableIndices.push(index);
        }
    }

    // 🟢 [新增] 核心启动方法：封装所有底层初始化逻辑
    static async boot() {
        // 防止重复初始化 (React StrictMode 可能会调用两次)
        if (this.worker) {
            console.log("⚠️ GameStore already booted, skipping...");
            return;
        }

        console.log("🚀 Booting GameStore...");

        // 1. 创建 Worker
        this.worker = new SimulationWorker();

        // 2. 绑定消息监听 (收敛到一个地方处理)
        this.worker.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'SYNC_STATE') {
                this.handleWorkerSync(payload);
            } else {
                this.handleWorkerMessage(type, payload);
            }
        };

        // 3. 初始化共享内存 (SAB)
        this.initSharedMemory();
        this.worker.postMessage({ 
            type: 'INIT_SHARED_MEMORY', 
            payload: this.sharedBuffer 
        });

        // 4. 构建/加载世界数据
        // 如果本地没有数据（例如第一次打开），先构建默认世界
        if (this.worldLayout.length === 0) {
            console.log("构建默认世界数据...");
            this.rebuildWorld(true);
        }

        // 5. 🔥 [关键] 立即同步地图给 Worker
        // 确保 Worker 里的 AI 一醒来就有路可走
        this.sendUpdateMap();

        // 6. 启动游戏流程 (读取存档或新开局)
        await this.initGameFlow();
        
        console.log("✅ GameStore booted successfully.");
    }

    

    // 1. [新增] 持有 Worker 引用，用于发送指令
    static worker: Worker | null = null;

    // 2. [新增] 统一修改速度的方法 (UI 应该调用这个，而不是直接改属性)
    static setGameSpeed(speed: number) {
        // 修改本地显示用的数值
        this.time.speed = speed;
        
        // 通知 Worker 同步修改
        if (this.worker) {
            this.worker.postMessage({ type: 'SET_SPEED', payload: speed });
            
            // 如果速度 > 0，确保 Worker 循环是启动状态
            if (speed > 0) {
                this.worker.postMessage({ type: 'START' });
            }
        }
    }

    // 3. [新增] 暂停/继续的快捷方法
    static togglePause(isPaused: boolean) {
        if (this.worker) {
            if (isPaused) {
                this.worker.postMessage({ type: 'PAUSE' });
            } else {
                this.worker.postMessage({ type: 'START' });
            }
        }
    }
    // 🚀 [新增] 请求 Worker 生成单人
    static sendSpawnSingle() {
        if (this.worker) {
            this.worker.postMessage({ type: 'SPAWN_SINGLE' });
            this.addLog(null, "已请求生成新居民...", "sys");
        }
    }

    // 🚀 [新增] 请求 Worker 生成家庭
    static sendSpawnFamily(size?: number) {
        if (this.worker) {
            this.worker.postMessage({ type: 'SPAWN_FAMILY', payload: { size } });
            this.addLog(null, "已请求生成新家庭...", "sys");
        }
    }
    // ✅ [新增] 发送自定义家庭数据
    static sendSpawnCustomFamily(configs: any[]) {
        if (this.worker) {
            this.worker.postMessage({ type: 'SPAWN_CUSTOM_FAMILY', payload: configs });
        }
    }
    // ✅ [新增] 同步地图数据给 Worker (用于编辑器应用后、导入地图后)
    static sendUpdateMap() {
        if (this.worker) {
            this.worker.postMessage({
                type: 'UPDATE_MAP',
                payload: {
                    worldLayout: this.worldLayout,
                    furniture: this.furniture,
                    rooms: this.rooms,
                    housingUnits: this.housingUnits
                }
            });
        }
    }
    static particles: { x: number; y: number; life: number }[] = [];
    
    static time: GameTime = { totalDays: 1, year: 1, month: 1, hour: 8, minute: 0, speed: 2 };
    
    static timeAccumulator: number = 0;
    static logs: LogEntry[] = [];
    static selectedSimId: string | null = null;
    static listeners: (() => void)[] = [];

    static mapVersion: number = 0;

    static editor = new EditorManager();

    static rooms: RoomDef[] = [];
    static furniture: Furniture[] = [];
    static housingUnits: (HousingUnit & { x: number, y: number })[] = [];
    
    static worldLayout: WorldPlot[] = [];

    static furnitureIndex: Map<string, Furniture[]> = new Map();
    static worldGrid: SpatialHashGrid = new SpatialHashGrid(100);
    static pathFinder: PathFinder = new PathFinder(CONFIG.CANVAS_W, CONFIG.CANVAS_H, 20);

    static toastMessage: string | null = null;
    static toastTimer: any = null;
    
    static subscribe(cb: () => void) {
        this.listeners.push(cb);
        return () => { this.listeners = this.listeners.filter(l => l !== cb); };
    }

    static notify() {
        this.listeners.forEach(cb => cb());
    }

    static triggerMapUpdate() {
        this.mapVersion++;
        this.initIndex(); 
        this.refreshFurnitureOwnership(); 
        this.notify(); 
        this.sendUpdateMap();
    }

    static showToast(msg: string) {
        this.toastMessage = msg;
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            this.toastMessage = null;
            this.notify();
        }, 3000);
        this.notify();
    }

    // ✅ [新增] 1. 选中/取消选中 Sim (同时更新本地和 Worker)
    static selectSim(id: string | null) {
        // 1. 立即更新本地状态 (为了 UI 响应速度)
        this.selectedSimId = id;
        this.notify();

        // 2. 告诉 Worker 我选中了谁 (以便 Worker 下一帧发回详细数据)
        if (this.worker) {
            this.worker.postMessage({ type: 'SELECT_SIM', payload: id });
        }
    }

    // ✅ [新增] 2. 发送分配住址指令
    static sendAssignHome(simId: string) {
        if (this.worker) {
            this.worker.postMessage({ type: 'ASSIGN_HOME', payload: simId });
            this.showToast("⏳ 正在分配住址...");
        }
    }

    // ✅ [新增] 发送保姆生成指令 (完整参数支持)
    static sendSpawnNanny(homeId: string, task: 'home_care' | 'drop_off' | 'pick_up' = 'home_care', targetChildId?: string) {
        if (this.worker) {
            this.worker.postMessage({
                type: 'SPAWN_NANNY',
                payload: {
                    homeId,
                    task,
                    targetChildId
                }
            });
            this.showToast("已呼叫家庭保姆...");
        }
    }

    static removeSim(id: string) {
        // 🛑 [拦截]
        if (this.worker) {
            this.worker.postMessage({ type: 'REMOVE_SIM', payload: id });
            // UI 层面可以做个乐观更新，先把选中态清空，防止报错
            if (this.selectedSimId === id) this.selectedSimId = null;
            return;
        }

        // --- Worker 逻辑 ---
        this.sims = this.sims.filter(s => s.id !== id);
        // 回收索引 (权威操作)
        this.freeSabIndex(id);
        
        // 清理关系等逻辑...
        this.sims.forEach(s => {
            if (s.relationships[id]) {
                delete s.relationships[id];
            }
        });
        
        // Worker 不需要 notify UI，它会通过下一次 SYNC 告诉主线程人没了
    }

    // ✅ [新增] 请求存档
    static requestSaveGame(slot: number) {
        if (this.worker) {
            this.worker.postMessage({ type: 'SAVE_GAME', payload: { slot } });
            this.showToast(`💾 正在归档数据 (Slot ${slot})...`);
        }
    }

    static spawnNanny(homeId: string, task: 'home_care' | 'drop_off' | 'pick_up' = 'home_care', targetChildId?: string) {
        // 🛑 [修复] 主线程拦截：如果是主线程调用，直接转发给 Worker，自己不执行
        if (this.worker) {
            this.sendSpawnNanny(homeId, task, targetChildId);
            return;
        }
        // [修改] 检查是否已经有 NPC 或 临时工
        let nanny = this.sims.find(s => s.homeId === homeId && (s.isTemporary || s.isNPC));
        const home = this.housingUnits.find(u => u.id === homeId);
        if (!home) return;

        if (!nanny) {
            nanny = new Sim({
                x: home.x + home.area.w / 2,
                y: home.y + home.area.h / 2,
                surname: "Nanny",
                ageStage: AgeStage.Adult,
                gender: 'F', 
                homeId: homeId,
                money: 0
            });
            nanny.name = "家庭保姆";
            // [新增] 标记为 NPC 和 临时角色
            nanny.isTemporary = true; 
            nanny.isNPC = true; 

            nanny.clothesColor = '#575fcf';
            nanny.job = { id: 'nanny', title: '全职保姆', level: 1, salary: 0, startHour: 0, endHour: 0 };
            
            this.sims.push(nanny);
            this.addLog(null, `[服务] 已指派保姆前往 ${home.name}`, 'sys');
        }

        if (task === 'drop_off' && targetChildId) {
            nanny.changeState(new PickingUpState());
            nanny.carryingSimId = targetChildId; 
            nanny.target = null; 
            nanny.say("我来送宝宝上学", "sys");
        } 
        else if (task === 'pick_up' && targetChildId) {
            nanny.changeState(new PickingUpState());
            nanny.carryingSimId = targetChildId;
            nanny.say("出发去接宝宝放学", "sys");
        }
        else {
            if (nanny.action !== SimAction.PickingUp && nanny.action !== SimAction.Escorting) {
                nanny.changeState(new NannyState());
                nanny.say("宝宝乖，我在家陪你", "sys");
            }
        }
        this.notify();
    }
    
    static assignRandomHome(sim: Sim, preferredTypes?: string[]) {
        // 🛑 [拦截] 主线程如果误调用了这个方法（通常不会直接调用，但为了保险），
        // 应该发送 ASSIGN_HOME 指令。但注意：assignRandomHome 需要 sim 对象，
        // 而主线程跟 Worker 通信只能传 ID。
        // 所以建议把主线程的调用点改为：GameStore.sendAssignHome(sim.id)
        
        // 这里做一个兼容处理：
        if (this.worker) {
            this.sendAssignHome(sim.id);
            return;
        }
        let targetTypes = preferredTypes || [];
        if (targetTypes.length === 0) {
            if (sim.ageStage === AgeStage.Elder) targetTypes = ['elder_care', 'apartment', 'public_housing'];
            else if (sim.money > 5000) targetTypes = ['villa', 'apartment'];
            else if (sim.money < 2000) targetTypes = ['public_housing'];
            else targetTypes = ['apartment', 'public_housing'];
        }

        let candidates = this.housingUnits.filter(unit => {
            const residents = this.sims.filter(s => s.homeId === unit.id).length;
            return targetTypes.includes(unit.type) && residents < unit.capacity;
        });

        const preferred = candidates.filter(u => u.type === targetTypes[0]);
        if (preferred.length > 0) candidates = preferred;

        if (candidates.length === 0) {
            candidates = this.housingUnits.filter(unit => {
                const residents = this.sims.filter(s => s.homeId === unit.id).length;
                if (unit.type === 'elder_care' && sim.ageStage !== AgeStage.Elder) return false;
                return residents < unit.capacity;
            });
        }

        if (candidates.length === 0) {
            this.showToast("❌ 没有空闲的住处了！");
            return;
        }

        const newHome = candidates[Math.floor(Math.random() * candidates.length)];
        sim.homeId = newHome.id;

        if (newHome.type === 'elder_care') this.addLog(sim, `办理了入住手续，搬进了养老社区：${newHome.name}`, 'life');
        else if (newHome.type === 'villa') this.addLog(sim, `搬进了豪宅：${newHome.name}`, 'life');
        else this.addLog(sim, `搬进了新家：${newHome.name}`, 'life');
        
        this.showToast(`✅ 已分配住址：${newHome.name}`);

        if (newHome.type !== 'elder_care') {
            const partner = this.sims.find(s => s.id === sim.partnerId && sim.relationships[s.id]?.isSpouse);
            if (partner && partner.homeId !== newHome.id) {
                const partnerHome = this.housingUnits.find(u => u.id === partner.homeId);
                if (!partnerHome || partnerHome.type !== 'elder_care') {
                    partner.homeId = newHome.id;
                    this.addLog(partner, `随配偶搬进了新家`, 'family');
                }
            }
            const children = this.sims.filter(s => 
                sim.childrenIds.includes(s.id) && 
                ([AgeStage.Infant, AgeStage.Toddler, AgeStage.Child, AgeStage.Teen] as AgeStage[]).includes(s.ageStage)
            );
            children.forEach(child => { if (child.homeId !== newHome.id) child.homeId = newHome.id; });
        }

        this.refreshFurnitureOwnership();
        this.notify();
    }

    static rebuildWorld(initial = false) {
        // [修复] 如果世界布局为空，强制重载默认布局
        if (this.worldLayout.length === 0) {
            console.warn("⚠️ World Layout is empty, reloading default.");
            this.worldLayout = JSON.parse(JSON.stringify(WORLD_LAYOUT));
        }

        // [重要] 初始化时清空，或者重置时清空
        if (initial) {
            this.rooms = [];
            this.furniture = [];
            this.housingUnits = [];
            
            // 只有在完全初始化时才加载默认街道物品
            // @ts-ignore
            this.furniture.push(...STREET_PROPS);
        } else {
            // [修复] 非初始化重构（例如撤销/取消编辑），保留自定义物品
            // 但如果是在 Import 流程中，通常我们会先调 rebuildWorld(true)
            // 所以这里主要是为了 Editor 的 Cancel 逻辑服务
            this.rooms = this.rooms.filter(r => r.isCustom);
            this.furniture = this.furniture.filter(f => f.id.startsWith('custom_') || f.id.startsWith('vending_') || f.id.startsWith('trash_') || f.id.startsWith('hydrant_'));
            this.housingUnits = [];
        }

        this.worldLayout.forEach(plot => {
            GameStore.instantiatePlot(plot);
        });

        this.triggerMapUpdate();
    }

    static instantiatePlot(plot: WorldPlot) {
        let template = PLOTS[plot.templateId];
        
        if (!template) {
            console.error(`❌ Template not found for plot: ${plot.templateId} (at ${plot.x},${plot.y}). Falling back to empty.`);
        }

        if (!template || plot.templateId === 'default_empty') {
            const w = plot.width || 300;
            const h = plot.height || 300;
            
            template = {
                id: 'default_empty',
                width: w,
                height: h,
                type: (plot.customType as any) || 'public', 
                rooms: [
                    { 
                        id: 'base', x: 0, y: 0, w: w, h: h, 
                        label: plot.customName || '空地皮', 
                        color: plot.customColor || '#dcdcdc', 
                        pixelPattern: 'simple' 
                    }
                ],
                furniture: [],
                housingUnits: [] 
            };

            const type = plot.customType;
            if (type && ['dorm', 'villa', 'apartment', 'residential'].includes(type)) {
                let unitType: 'public_housing' | 'apartment' | 'villa' = 'public_housing';
                let capacity = 6;
                let cost = 500;

                if (type === 'villa') {
                    unitType = 'villa'; capacity = 4; cost = 5000;
                } else if (type === 'apartment') {
                    unitType = 'apartment'; capacity = 2; cost = 1500;
                } else if (type === 'dorm' || type === 'residential') {
                    unitType = 'public_housing'; capacity = 8; cost = 200;
                }

                template.housingUnits!.push({
                    id: 'custom_home', 
                    name: plot.customName || (unitType === 'villa' ? '私人别墅' : '自建公寓'),
                    capacity: capacity,
                    cost: cost,
                    type: unitType,
                    area: { x: 0, y: 0, w: w, h: h } 
                });
            }
        }

        const plotUnits: (HousingUnit & { x: number, y: number, maxX: number, maxY: number })[] = [];

        if (template.housingUnits) {
            template.housingUnits.forEach(u => {
                const unitAbs = {
                    ...u,
                    id: `${plot.id}_${u.id}`,
                    x: u.area.x + plot.x,
                    y: u.area.y + plot.y,
                    maxX: u.area.x + plot.x + u.area.w,
                    maxY: u.area.y + plot.y + u.area.h
                };
                this.housingUnits.push(unitAbs);
                plotUnits.push(unitAbs);
            });
        }

        template.rooms.forEach(r => {
            const absX = r.x + plot.x;
            const absY = r.y + plot.y;
            const ownerUnit = plotUnits.find(u => absX >= u.x && absX < u.maxX && absY >= u.y && absY < u.maxY);
            this.rooms.push({ ...r, id: `${plot.id}_${r.id}`, x: absX, y: absY, homeId: ownerUnit ? ownerUnit.id : undefined });
        });

        template.furniture.forEach(f => {
            const absX = f.x + plot.x;
            const absY = f.y + plot.y;
            const ownerUnit = plotUnits.find(u => absX >= u.x && absX < u.maxX && absY >= u.y && absY < u.maxY);
            this.furniture.push({ 
                ...f, 
                id: `${plot.id}_${f.id}`, 
                x: absX, 
                y: absY, 
                homeId: ownerUnit ? ownerUnit.id : undefined,
            });
        });
    }

    static updatePlotAttributes(plotId: string, attrs: { name?: string, color?: string, type?: string }) {
        const plot = this.worldLayout.find(p => p.id === plotId);
        if (!plot) return;

        let hasChange = false;
        if (attrs.name !== undefined && plot.customName !== attrs.name) { plot.customName = attrs.name; hasChange = true; }
        if (attrs.color !== undefined && plot.customColor !== attrs.color) { plot.customColor = attrs.color; hasChange = true; }
        if (attrs.type !== undefined && plot.customType !== attrs.type) { plot.customType = attrs.type; hasChange = true; }

        if (hasChange) {
            this.rooms = this.rooms.filter(r => !r.id.startsWith(`${plotId}_`));
            this.furniture = this.furniture.filter(f => !f.id.startsWith(`${plotId}_`));
            this.housingUnits = this.housingUnits.filter(h => !h.id.startsWith(`${plotId}_`));
            this.instantiatePlot(plot);
            this.triggerMapUpdate();
        }
    }

    static refreshFurnitureOwnership() {
        this.furniture.forEach(f => {
            // [修改] 对所有家具都尝试刷新归属权，不仅是 custom_
            const cx = f.x + f.w / 2;
            const cy = f.y + f.h / 2;
            const ownerUnit = this.housingUnits.find(u => {
                const maxX = u.maxX ?? (u.x + u.area.w);
                const maxY = u.maxY ?? (u.y + u.area.h);
                return cx >= u.x && cx < maxX && cy >= u.y && cy < maxY;
            });
            if (ownerUnit) f.homeId = ownerUnit.id;
            else if (f.id.startsWith('custom_')) delete f.homeId; // 只有自定义家具在移出区域后会失去归属
        });
    }

    // [核心修复] 导出全量数据，包括所有已编辑、移动的默认家具和房间
    static getMapData() {
        return {
            version: "2.0", // 升级版本号
            timestamp: Date.now(),
            worldLayout: this.worldLayout,
            rooms: this.rooms, // 导出所有房间 (包括模版自带但可能被修改的)
            furniture: this.furniture // 导出所有家具
        };
    }

    // [核心修复] 导入全量数据
    static importMapData(rawJson: any) {
        const validData = SaveManager.parseMapData(rawJson);
        if (!validData) {
            this.showToast("❌ 导入失败：文件格式无效");
            return;
        }
        try {
            this.worldLayout = validData.worldLayout;
            
            // 1. 重建基础结构 (主要是为了生成 HousingUnits 和确保 Plot 结构完整)
            // 这会生成默认的房间和家具
            this.rebuildWorld(true);
            
            // 2. [关键] 如果存档包含全量数据，使用存档数据覆盖默认生成的数据
            // 这样可以保留用户对默认家具的移动/旋转操作
            if (validData.furniture && validData.furniture.length > 0) {
                this.rooms = validData.rooms || this.rooms; // 如果存档有房间数据则覆盖
                this.furniture = validData.furniture; // 覆盖家具
                
                // 3. 重新计算归属权，确保家具与房屋关联正确
                this.refreshFurnitureOwnership();
            } else {
                // 兼容旧版存档 (只存了 customFurniture)
                if (validData.rooms) this.rooms = [...this.rooms, ...validData.rooms]; // 追加自定义房间
                if (validData.customFurniture) this.furniture = [...this.furniture, ...validData.customFurniture]; // 追加自定义家具
            }
            
            this.triggerMapUpdate();
            // [新增] 立即同步给 Worker
            this.sendUpdateMap();
            this.showToast("✅ 地图导入成功！");
        } catch (e) {
            console.error("Import execution failed", e);
            this.showToast("❌ 导入过程出错，请重试");
        }
    }


    static get history() { return this.editor.history; } 
    static get redoStack() { return this.editor.redoStack; }

    static enterEditorMode() { this.editor.enterEditorMode(); }
    static confirmEditorChanges() { this.editor.confirmChanges(); }
    static cancelEditorChanges() { this.editor.cancelChanges(); }
    static resetEditorState() { this.editor.resetState(); }
    static clearMap() { this.editor.clearMap(); }
    static recordAction(action: EditorAction) { this.editor.recordAction(action); }
    static undo() { this.editor.undo(); this.triggerMapUpdate(); } 
    static redo() { this.editor.redo(); this.triggerMapUpdate(); } 
    static startPlacingPlot(templateId: string) { this.editor.startPlacingPlot(templateId); }
    static startDrawingPlot(templateId: string) { this.editor.startDrawingPlot(templateId); }
    static startPlacingFurniture(template: Partial<Furniture>) { this.editor.startPlacingFurniture(template); }
    static startDrawingFloor(pattern: string, color: string, label: string, hasWall: boolean) { this.editor.startDrawingFloor(pattern, color, label, hasWall); }
    static deleteSelection() { this.editor.deleteCurrentSelection(); }

    static placePlot(x: number, y: number) { this.editor.placePlot(x, y); this.triggerMapUpdate(); }
    static createCustomPlot(rect: any, templateId: string) { this.editor.createCustomPlot(rect, templateId); this.triggerMapUpdate(); }
    static placeFurniture(x: number, y: number) { this.editor.placeFurniture(x, y); this.triggerMapUpdate(); }
    static createCustomRoom(rect: any, pattern: string, color: string, label: string, hasWall: boolean) { this.editor.createCustomRoom(rect, pattern, color, label, hasWall); this.triggerMapUpdate(); }
    static removePlot(plotId: string) { this.editor.removePlot(plotId); this.triggerMapUpdate(); }
    static removeRoom(roomId: string) { this.editor.removeRoom(roomId); this.triggerMapUpdate(); }
    static removeFurniture(id: string) { this.editor.removeFurniture(id); this.triggerMapUpdate(); }
    static changePlotTemplate(plotId: string, templateId: string) { this.editor.changePlotTemplate(plotId, templateId); this.triggerMapUpdate(); }
    static finalizeMove(type: 'plot'|'furniture'|'room', id: string, startPos: any) {
    // 直接调用 EditorManager 的方法，不要在这里重写一遍逻辑
    this.editor.finalizeMove(type, id, startPos);
    
    // 或者，如果你喜欢 GameStore 版本的 instantiatePlot 逻辑（更稳健），
    // 请把那个逻辑移到 EditorManager 里，然后 GameStore 只做转发。
}
    static resizeEntity(type: 'plot'|'room', id: string, newRect: any) { this.editor.resizeEntity(type, id, newRect); this.triggerMapUpdate(); } 
    
    static furnitureByPlot: Map<string, Furniture[]> = new Map();

    static initIndex() {
        this.furnitureIndex.clear();
        this.worldGrid.clear();
        this.pathFinder.clear();
        this.furnitureByPlot.clear(); 

        const passableTypes = ['rug_fancy', 'rug_persian', 'rug_art', 'pave_fancy', 'stripes', 'zebra', 'manhole', 'grass', 'concrete', 'tile', 'wood', 'run_track', 'water'];

        this.furniture.forEach(f => {
            if (!this.furnitureIndex.has(f.utility)) { this.furnitureIndex.set(f.utility, []); }
            this.furnitureIndex.get(f.utility)!.push(f);
            
            this.worldGrid.insert({ id: f.id, x: f.x, y: f.y, w: f.w, h: f.h, type: 'furniture', ref: f });

            let ownerPlot = this.worldLayout.find(p => f.id.startsWith(p.id));
            if (!ownerPlot) {
                const cx = f.x + f.w / 2;
                const cy = f.y + f.h / 2;
                ownerPlot = this.worldLayout.find(p => {
                    const pw = p.width || 300; 
                    const ph = p.height || 300;
                    return cx >= p.x && cx < p.x + pw && cy >= p.y && cy < p.y + ph;
                });
            }
            if (ownerPlot) {
                if (!this.furnitureByPlot.has(ownerPlot.id)) {
                    this.furnitureByPlot.set(ownerPlot.id, []);
                }
                this.furnitureByPlot.get(ownerPlot.id)!.push(f);
            }

            const padding = 4;
            const isPassable = f.pixelPattern && passableTypes.some(t => f.pixelPattern?.includes(t));
            if (!isPassable && f.utility !== 'none' && !f.label.includes('地毯')) {
                this.pathFinder.setObstacle(f.x + padding, f.y + padding, Math.max(1, f.w - padding * 2), Math.max(1, f.h - padding * 2));
            }
        });

        this.rooms.forEach(r => {
            // [修改] 现在所有房间都加入网格，以便在 Floor Mode 选中
            this.worldGrid.insert({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, type: 'room', ref: r });
        });
    }

    static spawnHeart(x: number, y: number) {
        this.particles.push({ x, y, life: 1.0 });
    }

    static addLog(sim: Sim | null, text: string, type: any, isAI = false) {
        const timeStr = `Y${this.time.year} M${this.time.month} | ${String(this.time.hour).padStart(2, '0')}:${String(this.time.minute).padStart(2, '0')}`;
        
        let category: 'sys' | 'chat' | 'rel' | 'life' | 'career' = 'life';

        if (type === 'sys') {
            if (text.includes("新家庭") || text.includes("新居民") || text.includes("离世") || text.includes("出生") || text.includes("新年") || text.includes("本月是")) {
                category = 'sys';
            } else {
                category = 'life';
            }
        }
        else if (type === 'money' || (sim && text.includes("工作") && !text.includes("聊"))) {
            category = 'career';
        }
        else if (['love', 'jealous', 'rel_event', 'family'].includes(type)) {
            category = 'rel';
        }
        else if (['chat', 'bad'].includes(type)) {
            category = 'chat';
        }
        else {
            category = 'life'; 
        }

        const entry: LogEntry = {
            id: Math.random(),
            time: timeStr,
            text: text,
            type: type,
            category: category,
            isAI: isAI,
            simName: sim ? sim.name : '系统'
        };
        this.logs.unshift(entry);
        if (this.logs.length > 200) this.logs.pop();
        this.notify();
    }

    static getSaveSlots() {
        return SaveManager.getSaveSlots();
    }

    static saveGame(slotIndex: number = 1) {
        const safeSims = this.sims.map(sim => {
            const s = Object.assign({}, sim);
            if (s.interactionTarget && (s.interactionTarget as any).ref) {
                s.interactionTarget = null; s.action = 'idle'; s.target = null;
                // @ts-ignore
                s.path = []; s.bubble = { text: null, timer: 0, type: 'normal' };
            }
            return s;
        });

        // [修改] 存档时保存所有对象状态，确保位置修改被记录
        const saveData: GameSaveData = {
            version: 3.2, 
            timestamp: Date.now(),
            time: this.time,
            logs: this.logs,
            sims: safeSims,
            worldLayout: this.worldLayout,
            rooms: this.rooms, 
            customFurniture: this.furniture 
        };

        const success = SaveManager.saveToSlot(slotIndex, saveData);
        
        if (success) {
            this.showToast(`✅ 存档 ${slotIndex} 保存成功！`);
        } else {
            this.showToast(`❌ 保存失败: 存储空间不足?`);
        }
    }

    static loadGame(slotIndex: number = 1, silent: boolean = false): boolean {
        const data = SaveManager.loadFromSlot(slotIndex);
        if (!data) {
            if (!silent) this.showToast(`❌ 读取存档失败`);
            return false;
        }

        try {
            if (data.worldLayout && Array.isArray(data.worldLayout) && data.worldLayout.length > 0) {
                this.worldLayout = data.worldLayout;
            } else {
                this.worldLayout = JSON.parse(JSON.stringify(WORLD_LAYOUT));
            }

            // [核心修复] 读取逻辑：如果有全量数据则直接使用，否则走旧版逻辑
            this.rebuildWorld(true); 

            if (data.furniture && data.furniture.length > 0) {
                this.rooms = data.rooms || this.rooms;
                this.furniture = data.furniture;
            } else {
                // 兼容旧存档
                if (data.rooms) this.rooms = [...this.rooms, ...data.rooms];
                if (data.customFurniture) {
                    const staticFurniture = this.furniture; 
                    this.furniture = [...staticFurniture, ...data.customFurniture];
                }
            }

            this.time = { ...data.time, speed: 1 };
            this.logs = data.logs || [];

            this.loadSims(data.sims);

            this.triggerMapUpdate(); 
            
            if (!silent) this.showToast(`📂 读取存档 ${slotIndex} 成功！`);
            return true;
        } catch (e) {
            console.error("[GameStore] Hydration failed:", e);
            if (!silent) this.showToast(`❌ 存档数据损坏，无法恢复`);
            return false;
        }
    }

    static deleteSave(slotIndex: number) {
        SaveManager.deleteSlot(slotIndex);
        this.notify();
        this.showToast(`🗑️ 存档 ${slotIndex} 已删除`);
    }

    static loadSims(simsData: any[]) {
        this.sims = simsData.map((sData: any) => {
            const sim = new Sim({ x: sData.pos.x, y: sData.pos.y }); 
            
            Object.assign(sim, sData);
            
            if (!sim.childrenIds) sim.childrenIds = [];
            if (!sim.health) sim.health = 100;
            if (!sim.ageStage) sim.ageStage = AgeStage.Adult;
            if (sim.interactionTarget) sim.interactionTarget = null;
            // [修复] 自动分配缺失资源 (存档迁移)
            // 默认使用 adult 资源池作为兜底，或者根据 sData.ageStage 判断
            const defaultPool = ASSET_CONFIG.adult;
            
            // [关键] 自动分配缺失的服装资源 (存档迁移)
            // 重点修复 hair 的检查：
            if (!sim.appearance.hair && defaultPool.hairs.length > 0) {
                sim.appearance.hair = defaultPool.hairs[Math.floor(Math.random() * defaultPool.hairs.length)];
            }
            // 如果 body/outfit 也没了，也可以补
            if (!sim.appearance.body && defaultPool.bodies.length > 0) {
                sim.appearance.body = defaultPool.bodies[Math.floor(Math.random() * defaultPool.bodies.length)];
            }
            if (!sim.appearance.outfit && defaultPool.outfits.length > 0) {
                sim.appearance.outfit = defaultPool.outfits[Math.floor(Math.random() * defaultPool.outfits.length)];
            }

            const currentJobDefinition = JOBS.find(j => j.id === sim.job.id);
            if (currentJobDefinition) {
                sim.job = { ...currentJobDefinition };
            }

            sim.restoreState();
            // ✅ [新增] 恢复索引
            this.allocSabIndex(sim.id);

            return sim;
        });
    }

    static spawnFamily(size?: number) {
        // 🛑 [拦截] 主线程只发指令
        if (this.worker) {
            this.sendSpawnFamily(size);
            return;
        }

        // --- Worker 逻辑 ---
        const count = size || (2 + Math.floor(Math.random() * 3)); 
        const fam = FamilyGenerator.generate(count, this.housingUnits, this.sims);
        this.sims.push(...fam);
        
        // 关键：为生成的每个人分配索引
        fam.forEach(s => this.allocSabIndex(s.id)); 

        const logMsg = count === 1 
            ? `新居民 ${fam[0].name} 搬入了城市。`
            : `新家庭 (${fam[0].surname}家) 搬入城市！共 ${fam.length} 人。`;
        this.addLog(null, logMsg, "sys");
    }

    static spawnSingle() {
        // 🛑 [拦截]
        if (this.worker) {
            this.sendSpawnSingle();
            return;
       }
        this.spawnFamily(1);
    }

    static spawnCustomSim(config: SimInitConfig) {
        // 🛑 [拦截]
        if (this.worker) {
            // 注意：这里需要一个新的消息类型 SPAWN_CUSTOM
            this.worker.postMessage({ type: 'SPAWN_CUSTOM', payload: config });
            this.showToast("正在创建角色...");
            return; 
        }

        // --- 以下是 Worker 才会执行的逻辑 ---
        const sim = new Sim(config);
        this.sims.push(sim);
        // Worker 分配内存索引 (这是权威操作)
        this.allocSabIndex(sim.id);
        
        this.assignRandomHome(sim); 
        this.addLog(null, `[入住] 新居民 ${sim.name} (自定义) 搬入了城市。`, "sys");
        
        // 注意：Worker 里没有 showToast，这些 UI 通知需要通过 postMessage 发回，或者忽略
        // this.showToast(...) // Worker 里不需要这个，或者发回主线程处理
        
        // Worker 不需要 selectSim，或者只是标记一下
        this.selectedSimId = sim.id;
    }

    static spawnCustomFamily(configs: any[]) {
        // 🛑 [拦截]
        if (this.worker) {
            this.worker.postMessage({ type: 'SPAWN_CUSTOM_FAMILY', payload: configs });
            this.showToast("正在创建家庭...");
            return;
        }
        if (configs.length === 0) return;

        const newSims: Sim[] = [];
        const familyId = Math.random().toString(36).substring(2, 8);
        const surname = configs[0].name.substring(0, 1);

        configs.forEach(cfg => {
            let newId = Math.random().toString(36).substring(2, 11);
            if (cfg.hairStyleIndex !== undefined) {
                let attempts = 0;
                while (attempts < 1000) {
                    const hash = newId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    if (hash % 17 === cfg.hairStyleIndex) break;
                    newId = Math.random().toString(36).substring(2, 11);
                    attempts++;
                }
            }

            const sim = new Sim({
                ...cfg,
                familyId: familyId,
                surname: surname, 
                homeId: null 
            });
            sim.id = newId; 

            const pool = ASSET_CONFIG.adult; // 简单修复
            
            // 如果外观没有设置，尝试自动分配
            if (!sim.appearance.hair && pool.hairs.length > 0) {
                sim.appearance.hair = pool.hairs[Math.floor(Math.random() * pool.hairs.length)];
            }
            if (!sim.appearance.clothes && ASSET_CONFIG.clothes.length > 0) {
                sim.appearance.clothes = ASSET_CONFIG.clothes[Math.floor(Math.random() * ASSET_CONFIG.clothes.length)];
            }
            if (!sim.appearance.pants && ASSET_CONFIG.pants.length > 0) {
                sim.appearance.pants = ASSET_CONFIG.pants[Math.floor(Math.random() * ASSET_CONFIG.pants.length)];
            }

            newSims.push(sim);
        });

        const head = newSims[0];
        
        for (let i = 1; i < newSims.length; i++) {
            const member = newSims[i];
            const relation = configs[i].relationshipToHead;

            if (relation === 'spouse') {
                SocialLogic.marry(head, member, true);
            } else if (relation === 'child') {
                SocialLogic.setKinship(head, member, 'child');
                SocialLogic.setKinship(member, head, 'parent');
                head.childrenIds.push(member.id);
                if (head.partnerId) {
                    const partner = newSims.find(s => s.id === head.partnerId);
                    if (partner) {
                        SocialLogic.setKinship(partner, member, 'child');
                        SocialLogic.setKinship(member, partner, 'parent');
                        partner.childrenIds.push(member.id);
                    }
                }
            } else if (relation === 'parent') {
                SocialLogic.setKinship(member, head, 'child');
                SocialLogic.setKinship(head, member, 'parent');
                member.childrenIds.push(head.id);
            } else if (relation === 'sibling') {
                SocialLogic.setKinship(head, member, 'sibling');
                SocialLogic.setKinship(member, head, 'sibling');
            } else {
                SocialLogic.updateRelationship(head, member, 'friendship', 50);
                SocialLogic.updateRelationship(member, head, 'friendship', 50);
            }
        }

        const requiredCapacity = newSims.length;
        
        let targetHomeTypes = ['apartment', 'public_housing'];
        const totalMoney = newSims.reduce((sum, s) => sum + s.money, 0);
        if (totalMoney > 20000) targetHomeTypes = ['villa', 'apartment'];
        else if (totalMoney > 5000) targetHomeTypes = ['apartment', 'public_housing'];

        const availableHomes = this.housingUnits.filter(unit => {
            const occupants = this.sims.filter(s => s.homeId === unit.id).length;
            return targetHomeTypes.includes(unit.type) && (occupants + requiredCapacity <= unit.capacity);
        });

        let homeId: string | null = null;
        if (availableHomes.length > 0) {
            const home = availableHomes[Math.floor(Math.random() * availableHomes.length)];
            homeId = home.id;
        } else {
            const anyHome = this.housingUnits.find(u => {
                const occupants = this.sims.filter(s => s.homeId === u.id).length;
                return (occupants + requiredCapacity <= u.capacity);
            });
            if (anyHome) homeId = anyHome.id;
        }

        if (homeId) {
            const home = this.housingUnits.find(u => u.id === homeId)!;
            newSims.forEach(s => {
                s.homeId = homeId;
                s.pos = { 
                    x: home.x + home.area.w/2 + (Math.random()-0.5)*20, 
                    y: home.y + home.area.h/2 + (Math.random()-0.5)*20 
                };
            });
            this.addLog(null, `[入住] 新家庭 (${surname}家) 入住了 ${home.name}`, "sys");
        } else {
            this.showToast("⚠️ 警告：没有足够大的空房容纳整个家庭，他们暂时无家可归。");
            this.addLog(null, `[入住] 新家庭 (${surname}家) 到达城市 (暂无居所)`, "sys");
        }

        this.sims.push(...newSims);
        this.selectedSimId = head.id;
        this.refreshFurnitureOwnership();
        this.notify();
    }

    // ✅ [新增] 处理 Worker 发来的同步数据
    static handleWorkerSync(payload: any) {
        // 1. 同步时间
        this.time = payload.time;

        // 2. 同步日志 (合并或替换)
        // 注意：为了避免日志跳动，可以只追加新的，或者直接替换 UI 展示用的数组
        if (payload.logs && payload.logs.length > 0) {
            this.logs = payload.logs;
        }

        // 3. 核心：同步 Sims 列表
        const incomingSims = payload.sims;
        if (!Array.isArray(incomingSims)) return; // 防御检查

        const activeIds = new Set(incomingSims.map((s: any) => s?.id).filter(Boolean)); // 过滤掉无效 ID

        // 3.1 移除已经消失的 Sim
        for (let i = this.sims.length - 1; i >= 0; i--) {
            const localSim = this.sims[i];
            // [修复] 增加对 localSim 的非空检查
            if (!localSim || !activeIds.has(localSim.id)) {
                if (localSim) this.freeSabIndex(localSim.id);
                this.sims.splice(i, 1);
                // 顺便清理索引 Map
                if (localSim) this.simIndexMap.delete(localSim.id);
            }
        }

        // 3.2 更新或创建 Sim
        incomingSims.forEach((data: any) => {
            // [修复] 增加数据完整性检查
            if (!data || !data.id) return;

            let sim = this.sims.find(s => s.id === data.id);

            // A. 新 Sim
            if (!sim) {
                // 初始化 pos 防止 Pixi 报错
                sim = new Sim({ x: 0, y: 0 }); 
                sim.id = data.id;
                this.sims.push(sim);
            }

            // B. 同步低频状态 (UI展示用的数据)
            // 这些数据不走 SAB，还是走 postMessage
            // 1. === 基础视觉与身份属性 (所有 Sim 都有) ===
            sim.action = data.action;
            sim.bubble = data.bubble;
            sim.mood = data.mood;
            sim.appearance = data.appearance;
            sim.name = data.name;
            sim.surname = data.surname;
            sim.familyId = data.familyId;
            sim.gender = data.gender;
            sim.ageStage = data.ageStage;
            sim.age = data.age;
            sim.health = data.health;
            sim.homeId = data.homeId;
            sim.isPregnant = data.isPregnant;
            if (data.name) sim.name = data.name;
            if (data.surname) sim.surname = data.surname;
            if (data.hairColor) sim.hairColor = data.hairColor;
            if (data.skinColor) sim.skinColor = data.skinColor;
            if (data.clothesColor) sim.clothesColor = data.clothesColor;
            if (data.pantsColor) sim.pantsColor = data.pantsColor;
            if (data.traits) sim.traits = data.traits;
            if (data.mbti) sim.mbti = data.mbti;
            
            // 职业数据处理 (可能是简略版 {title}，也可能是完整版)
            // 使用合并更新，保留本地 Job 对象的默认结构
            if (data.job && data.job.id) {
            // 如果本地的职业 ID 和服务器发来的不一样（说明本地随机错了）
                if (sim.job.id !== data.job.id) {
                    // 从常量表里找到正确的职业配置（获取 salary, workHours 等静态数据）
                    const jobDef = JOBS.find(j => j.id === data.job.id);
                    if (jobDef) {
                        // 使用正确的定义覆盖，并合并服务器传来的动态数据（如 title 可能被升职修改过）
                        sim.job = { ...jobDef, ...data.job };
                    } else {
                        // 兜底
                        sim.job = { ...sim.job, ...data.job };
                    }
                } else {
                    // ID 一样，正常更新属性（比如 title 变了）
                    sim.job = { ...sim.job, ...data.job };
                }
            }

            // 2. === 详细属性 (只有被选中时 Worker 才会发送) ===
            // ⚠️ 必须检查是否存在，否则会将未选中状态下的旧数据覆盖为 undefined

            // 核心需求 & Buffs
            if (data.needs) sim.needs = data.needs;
            if (data.buffs) sim.buffs = data.buffs;

            // 🟢 修改后：(逐项检查，防止覆盖)
            // 经济系统
            if (data.money !== undefined) sim.money = data.money;
            if (data.dailyBudget !== undefined) sim.dailyBudget = data.dailyBudget;
            if (data.dailyIncome !== undefined) sim.dailyIncome = data.dailyIncome;
            if (data.dailyExpense !== undefined) sim.dailyExpense = data.dailyExpense;
            if (data.dailyTransactions !== undefined) sim.dailyTransactions = data.dailyTransactions;

            // AI 决策大脑 (显示在 Inspector 的 Header 或调试区)
            if (data.currentIntent) {
                sim.currentIntent = data.currentIntent;
                sim.actionQueue = data.actionQueue;
                sim.lastDecisionReason = data.lastDecisionReason;
                sim.currentPlanDescription = data.currentPlanDescription;
                sim.interactionTarget = data.interactionTarget;
            }

            // 技能与特质
            if (data.skills) sim.skills = data.skills;
            if (data.traits) sim.traits = data.traits;
            if (data.lifeGoal) sim.lifeGoal = data.lifeGoal;
            if (data.zodiac) sim.zodiac = data.zodiac;
            if (data.mbti) sim.mbti = data.mbti;
            
            // 身体数值 (用于体检报告或详细信息)
            if (data.height !== undefined) {
                sim.height = data.height;
                sim.weight = data.weight;
                sim.appearanceScore = data.appearanceScore;
                sim.constitution = data.constitution;
                sim.iq = data.iq;
                sim.eq = data.eq;
            }

            // 详细色值 (用于外观编辑或显示)
            if (data.skinColor) {
                sim.skinColor = data.skinColor;
                sim.hairColor = data.hairColor;
                sim.clothesColor = data.clothesColor;
                sim.pantsColor = data.pantsColor;
            }

            // 社交关系与家族
            if (data.relationships) {
                sim.relationships = data.relationships;
                sim.partnerId = data.partnerId;
                sim.fatherId = data.fatherId;
                sim.motherId = data.motherId;
                sim.childrenIds = data.childrenIds;
                sim.familyLore = data.familyLore;
                sim.faithfulness = data.faithfulness;
            }

            // 记忆系统
            if (data.memories) sim.memories = data.memories;
            
            // 工作表现 (如果有)
            if (data.workPerformance !== undefined) sim.workPerformance = data.workPerformance;
            // 🟢 [新增] 接收考评日志 (漏了这一行)
            if (data.dailyWorkLog) sim.dailyWorkLog = data.dailyWorkLog;
            // C. 🚨🚨🚨 [核心修改] 接收 SAB 索引 🚨🚨🚨
            // data.sabIndex 是 Worker 告诉我们的“座位号”
            if (data.sabIndex !== undefined && data.sabIndex !== -1) {
                
                // 1. 只有当 这个小人还没有被连线，或者座位号变了 时，才执行注入
                // 我们用一个隐藏属性 _sabIndex 来记录当前连接的座位号
                // (sim as any) 是为了绕过 TS 检查访问这个临时属性
                if ((sim as any)._sabIndex !== data.sabIndex) {
                    
                    // 记录到全局 Map，供渲染层快速查询
                    this.simIndexMap.set(data.id, data.sabIndex);
                    
                    // 🔥 执行连线：把 sim.pos 变成一个“传送门”，直接读共享内存
                    this.injectSabGetters(sim, data.sabIndex);
                    
                    // 记录一下“我已经连好线了”，防止下一帧重复执行消耗性能
                    (sim as any)._sabIndex = data.sabIndex;
                    
                    // console.log(`🔗 Linked ${sim.name} to SAB index ${data.sabIndex}`);
                }
            }
        });

        // 3. 通知 UI 更新
        this.notify();
    }

    // ✅ [修改] 处理 Worker 返回的消息 (在 App.tsx 调用的 handleWorkerSync 里，或者单独的 listener)
    // 建议把这个逻辑加到 handleWorkerSync 旁边，或者扩充 onmessage
    static handleWorkerMessage(type: string, payload: any) {
        if (type === 'SAVE_DATA_READY') {
            const { slot, data } = payload;
            const success = SaveManager.saveToSlot(slot, data);
            if (success) {
                this.showToast(`✅ 存档 ${slot} 保存成功！`);
                // 这里可以触发 UI 刷新，比如通过 event bus 或者再次 notify
                this.notify();
            } else {
                this.showToast(`❌ 保存失败: 空间不足?`);
            }
        }
        // ✅ [新增] 处理 Worker 发回的地图初始化数据
        else if (type === 'INIT_MAP') {
            console.log("[Main] Received Map Data from Worker");
            
            this.worldLayout = payload.worldLayout;
            this.furniture = payload.furniture;
            this.rooms = payload.rooms;
            this.housingUnits = payload.housingUnits;
            
            // 重建索引，确保渲染层能找到东西
            this.initIndex();
            this.triggerMapUpdate(); // 通知 Pixi 重新生成世界
            
            this.showToast("🌍 世界加载完成");
        }
    }

    // 注入共享内存读取器
    private static injectSabGetters(sim: any, index: number) {
        (sim as any)._sabIndex = index;
        const view = this.sharedView;
        
        // 1. 位置实时同步 (已有)
        Object.defineProperty(sim, 'pos', {
            get: () => {
                const base = index * SAB_CONFIG.STRUCT_SIZE;
                return {
                    x: view[base + SAB_CONFIG.OFFSET_X],
                    y: view[base + SAB_CONFIG.OFFSET_Y]
                };
            },
            configurable: true
        });
        // 2. 🟢 [新增] 动作实时同步
        // 这样即使 postMessage 慢了，动画切换也是 0 延迟的
        Object.defineProperty(sim, 'action', {
            get: () => {
                const base = index * SAB_CONFIG.STRUCT_SIZE;
                const code = view[base + SAB_CONFIG.OFFSET_ACTION];
                return ACTION_NAMES[code] || 'idle';
            },
            // Setter 也要保留，防止 handleWorkerSync 覆盖时报错，
            // 虽然有了 getter 后 setter 通常无效，但为了兼容性可以留空
            set: (val) => { /* no-op */ },
            configurable: true
        });
        // 如果需要，也可以覆盖 action (将数字转回字符串)
        // 注意：这需要你有 ACTION_CODE 的反向映射表
        // Object.defineProperty(sim, 'action', { ... }) 
    }
    static async initGameFlow() {
    // 确保 Worker 已经准备好
    if (!this.worker) {
        console.error("Worker not ready yet!");
        return;
    }

    // 1. 尝试读取自动存档 (Slot 1)
    // 注意：SaveManager 在主线程，所以我们读出数据，然后传给 Worker
    const autoSave = SaveManager.loadFromSlot(1);
    
        if (autoSave) {
            console.log("Found auto-save, loading...");
            this.worker.postMessage({ type: 'LOAD_GAME', payload: autoSave });
        } else {
            console.log("No save found, starting new game...");
            this.worker.postMessage({ type: 'START_NEW_GAME' });
        }
    }
}
