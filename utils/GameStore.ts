import { JOBS, CONFIG, ASSET_CONFIG, SAB_CONFIG, SAB_BYTE_LENGTH, ACTION_CODE } from '../constants'; 
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
import { SocialLogic as SocialLogicSystem } from './logic/social'; // 防止命名冲突
// 🛑 [修复步骤1] 移除这行导入，切断循环依赖
// import SimulationWorker from './simulationWorker?worker'; 

// 生成反向映射表
const ACTION_NAMES = Object.entries(ACTION_CODE).reduce((acc, [key, val]) => {
    acc[val] = key;
    return acc;
}, {} as Record<number, string>);

export class GameStore {
    static sims: Sim[] = [];
    // === 🚀 零拷贝内存管理 ===
    static sharedBuffer: SharedArrayBuffer;
    static sharedView: Float32Array;
    
    static simIndexMap: Map<string, number> = new Map();
    static availableIndices: number[] = [];

    static initSharedMemory(existingBuffer?: SharedArrayBuffer) {
        if (!existingBuffer && !self.crossOriginIsolated) {
            console.error("❌ 无法使用 SharedArrayBuffer: 页面未处于跨域隔离环境。");
            return;
        }

        if (existingBuffer) {
            console.log("[GameStore] Linking to Shared Memory (Worker Mode)...");
            this.sharedBuffer = existingBuffer;
        } else {
            console.log(`[GameStore] Allocating Shared Memory: ${SAB_BYTE_LENGTH} bytes...`);
            this.sharedBuffer = new SharedArrayBuffer(SAB_BYTE_LENGTH);
        }

        this.sharedView = new Float32Array(this.sharedBuffer);
        
        this.availableIndices = [];
        for (let i = SAB_CONFIG.MAX_SIMS - 1; i >= 0; i--) {
            this.availableIndices.push(i);
        }
        this.simIndexMap.clear();
    }

    static allocSabIndex(simId: string): number {
        if (this.simIndexMap.has(simId)) {
            return this.simIndexMap.get(simId)!;
        }
        const index = this.availableIndices.pop();
        if (index === undefined) {
            console.warn(`⚠️ 共享内存已满 (${SAB_CONFIG.MAX_SIMS} 人)，无法分配新位置！`);
            return -1;
        }
        this.simIndexMap.set(simId, index);
        return index;
    }

    static freeSabIndex(simId: string) {
        const index = this.simIndexMap.get(simId);
        if (index !== undefined) {
            const start = index * SAB_CONFIG.STRUCT_SIZE;
            const end = start + SAB_CONFIG.STRUCT_SIZE;
            this.sharedView.fill(0, start, end);
            this.simIndexMap.delete(simId);
            this.availableIndices.push(index);
        }
    }

    // 🟢 [修复步骤2] 修改 boot 方法
    // 既然 PixiGameCanvas 已经在负责创建 Worker，这里就不应该再创建了
    static async boot() {
        if (this.worker) {
            console.log("⚠️ GameStore worker already assigned (likely by UI).");
            // 如果需要在 boot 时做一些不依赖 Worker 创建的初始化，写在这里
            // 但不要 new SimulationWorker()
            
            // 确保内存初始化（如果 UI 层没做的话）
            if (!this.sharedBuffer) {
                 this.initSharedMemory();
            }
            return;
        }

        // 🛑 [删除] 不要在这里创建 Worker，会导致循环引用
        // this.worker = new SimulationWorker(); 

        console.log("🚀 Booting GameStore (Logic Only)...");

        // 仅初始化内存
        this.initSharedMemory();

        // 如果本地没有数据，先构建默认世界
        if (this.worldLayout.length === 0) {
            console.log("构建默认世界数据...");
            this.rebuildWorld(true);
        }
        
        console.log("✅ GameStore booted.");
    }

    // 持有 Worker 引用
    static worker: Worker | null = null;

    static setGameSpeed(speed: number) {
        this.time.speed = speed;
        if (this.worker) {
            this.worker.postMessage({ type: 'SET_SPEED', payload: speed });
            if (speed > 0) {
                this.worker.postMessage({ type: 'START' });
            }
        }
    }

    static togglePause(isPaused: boolean) {
        if (this.worker) {
            if (isPaused) {
                this.worker.postMessage({ type: 'PAUSE' });
            } else {
                this.worker.postMessage({ type: 'START' });
            }
        }
    }

    static sendSpawnSingle() {
        if (this.worker) {
            this.worker.postMessage({ type: 'SPAWN_SINGLE' });
            this.addLog(null, "已请求生成新居民...", "sys");
        }
    }

    static sendSpawnFamily(size?: number) {
        if (this.worker) {
            this.worker.postMessage({ type: 'SPAWN_FAMILY', payload: { size } });
            this.addLog(null, "已请求生成新家庭...", "sys");
        }
    }

    static sendSpawnCustomFamily(configs: any[]) {
        if (this.worker) {
            this.worker.postMessage({ type: 'SPAWN_CUSTOM_FAMILY', payload: configs });
        }
    }

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

    static selectSim(id: string | null) {
        this.selectedSimId = id;
        this.notify();
        if (this.worker) {
            this.worker.postMessage({ type: 'SELECT_SIM', payload: id });
        }
    }

    static sendAssignHome(simId: string) {
        if (this.worker) {
            this.worker.postMessage({ type: 'ASSIGN_HOME', payload: simId });
            this.showToast("⏳ 正在分配住址...");
        }
    }

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
        if (this.worker) {
            this.worker.postMessage({ type: 'REMOVE_SIM', payload: id });
            if (this.selectedSimId === id) this.selectedSimId = null;
            return;
        }
        this.sims = this.sims.filter(s => s.id !== id);
        this.freeSabIndex(id);
        this.sims.forEach(s => {
            if (s.relationships[id]) {
                delete s.relationships[id];
            }
        });
    }

    static requestSaveGame(slot: number) {
        if (this.worker) {
            this.worker.postMessage({ type: 'SAVE_GAME', payload: { slot } });
            this.showToast(`💾 正在归档数据 (Slot ${slot})...`);
        }
    }

    static spawnNanny(homeId: string, task: 'home_care' | 'drop_off' | 'pick_up' = 'home_care', targetChildId?: string) {
        if (this.worker) {
            this.sendSpawnNanny(homeId, task, targetChildId);
            return;
        }
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
        if (this.worldLayout.length === 0) {
            console.warn("⚠️ World Layout is empty, reloading default.");
            this.worldLayout = JSON.parse(JSON.stringify(WORLD_LAYOUT));
        }

        if (initial) {
            this.rooms = [];
            this.furniture = [];
            this.housingUnits = [];
            // @ts-ignore
            this.furniture.push(...STREET_PROPS);
        } else {
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
                        pixelPattern: 'simple' ,
                        // ✨ [新增] 将地皮(plot)上的贴图属性透传给房间(room)
                        sheetPath: plot.sheetPath,
                        tileX: plot.tileX,
                        tileY: plot.tileY,
                        tileW: plot.tileW,
                        tileH: plot.tileH
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
            const cx = f.x + f.w / 2;
            const cy = f.y + f.h / 2;
            const ownerUnit = this.housingUnits.find(u => {
                const maxX = u.maxX ?? (u.x + u.area.w);
                const maxY = u.maxY ?? (u.y + u.area.h);
                return cx >= u.x && cx < maxX && cy >= u.y && cy < maxY;
            });
            if (ownerUnit) f.homeId = ownerUnit.id;
            else if (f.id.startsWith('custom_')) delete f.homeId; 
        });
    }

    static getMapData() {
        return {
            version: "2.0", 
            timestamp: Date.now(),
            worldLayout: this.worldLayout,
            rooms: this.rooms, 
            furniture: this.furniture 
        };
    }

    static importMapData(rawJson: any) {
        const validData = SaveManager.parseMapData(rawJson);
        if (!validData) {
            this.showToast("❌ 导入失败：文件格式无效");
            return;
        }
        try {
            this.worldLayout = validData.worldLayout;
            this.rebuildWorld(true);
            
            if (validData.furniture && validData.furniture.length > 0) {
                this.rooms = validData.rooms || this.rooms; 
                this.furniture = validData.furniture; 
                this.refreshFurnitureOwnership();
            } else {
                if (validData.rooms) this.rooms = [...this.rooms, ...validData.rooms]; 
                if (validData.customFurniture) this.furniture = [...this.furniture, ...validData.customFurniture]; 
            }
            
            this.triggerMapUpdate();
            this.sendUpdateMap();
            this.showToast("✅ 地图导入成功！");
        } catch (e) {
            console.error("Import execution failed", e);
            this.showToast("❌ 导入过程出错，请重试");
        }
    }

    static get history() { return this.editor.history; } 
    static get redoStack() { return this.editor.redoStack; }

    static enterEditorMode() { 
        this.setGameSpeed(0);
        this.editor.enterEditorMode();
    }
    static confirmEditorChanges() { 
        this.editor.confirmChanges(); 
        // 退出编辑模式时恢复速度
        this.setGameSpeed(1); 
        this.notify();
    }
    static cancelEditorChanges() { 
        this.editor.cancelChanges(); 
        // 退出编辑模式时恢复速度
        this.setGameSpeed(1); 
        this.notify();
    }
    static resetEditorState() { this.editor.resetState(); }
    static clearMap() { 
        this.editor.clearMap(); 
        // 🟢 [修复] 强制发送更新给 Worker
        this.sendUpdateMap();
    }
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
        this.editor.finalizeMove(type, id, startPos);
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

            this.rebuildWorld(true); 

            if (data.furniture && data.furniture.length > 0) {
                this.rooms = data.rooms || this.rooms;
                this.furniture = data.furniture;
            } else {
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
            const defaultPool = ASSET_CONFIG.adult;
            
            if (!sim.appearance.hair && defaultPool.hairs.length > 0) {
                sim.appearance.hair = defaultPool.hairs[Math.floor(Math.random() * defaultPool.hairs.length)];
            }
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
            this.allocSabIndex(sim.id);

            return sim;
        });
    }

    static spawnFamily(size?: number) {
        if (this.worker) {
            this.sendSpawnFamily(size);
            return;
        }
        const count = size || (2 + Math.floor(Math.random() * 3)); 
        const fam = FamilyGenerator.generate(count, this.housingUnits, this.sims);
        this.sims.push(...fam);
        fam.forEach(s => this.allocSabIndex(s.id)); 

        const logMsg = count === 1 
            ? `新居民 ${fam[0].name} 搬入了城市。`
            : `新家庭 (${fam[0].surname}家) 搬入城市！共 ${fam.length} 人。`;
        this.addLog(null, logMsg, "sys");
    }

    static spawnSingle() {
        if (this.worker) {
            this.sendSpawnSingle();
            return;
       }
        this.spawnFamily(1);
    }

    static spawnCustomSim(config: SimInitConfig) {
        if (this.worker) {
            this.worker.postMessage({ type: 'SPAWN_CUSTOM', payload: config });
            this.showToast("正在创建角色...");
            return; 
        }
        const sim = new Sim(config);
        this.sims.push(sim);
        this.allocSabIndex(sim.id);
        this.assignRandomHome(sim); 
        this.addLog(null, `[入住] 新居民 ${sim.name} (自定义) 搬入了城市。`, "sys");
        this.selectedSimId = sim.id;
    }

    static spawnCustomFamily(configs: any[]) {
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

            const pool = ASSET_CONFIG.adult; 
            
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

    static handleWorkerSync(payload: any) {
        if (this.editor.mode !== 'none') {
            this.time = { ...this.time, speed: 0 };
        } else {
            this.time = payload.time;
        }

        if (payload.logs && payload.logs.length > 0) {
            this.logs = payload.logs;
        }

        const incomingSims = payload.sims;
        if (!Array.isArray(incomingSims)) return; 

        const activeIds = new Set(incomingSims.map((s: any) => s?.id).filter(Boolean)); 

        for (let i = this.sims.length - 1; i >= 0; i--) {
            const localSim = this.sims[i];
            if (!localSim || !activeIds.has(localSim.id)) {
                if (localSim) this.freeSabIndex(localSim.id);
                this.sims.splice(i, 1);
                if (localSim) this.simIndexMap.delete(localSim.id);
            }
        }

        incomingSims.forEach((data: any) => {
            if (!data || !data.id) return;

            let sim = this.sims.find(s => s.id === data.id);

            if (!sim) {
                sim = new Sim({ x: 0, y: 0 }); 
                sim.id = data.id;
                this.sims.push(sim);
            }

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
            
            if (data.job && data.job.id) {
                if (sim.job.id !== data.job.id) {
                    const jobDef = JOBS.find(j => j.id === data.job.id);
                    if (jobDef) {
                        sim.job = { ...jobDef, ...data.job };
                    } else {
                        sim.job = { ...sim.job, ...data.job };
                    }
                } else {
                    sim.job = { ...sim.job, ...data.job };
                }
            }

            if (data.needs) sim.needs = data.needs;
            if (data.buffs) sim.buffs = data.buffs;

            if (data.money !== undefined) sim.money = data.money;
            if (data.dailyBudget !== undefined) sim.dailyBudget = data.dailyBudget;
            if (data.dailyIncome !== undefined) sim.dailyIncome = data.dailyIncome;
            if (data.dailyExpense !== undefined) sim.dailyExpense = data.dailyExpense;
            if (data.dailyTransactions !== undefined) sim.dailyTransactions = data.dailyTransactions;

            if (data.currentIntent) {
                sim.currentIntent = data.currentIntent;
                sim.actionQueue = data.actionQueue;
                sim.lastDecisionReason = data.lastDecisionReason;
                sim.currentPlanDescription = data.currentPlanDescription;
                sim.interactionTarget = data.interactionTarget;
            }

            if (data.skills) sim.skills = data.skills;
            if (data.traits) sim.traits = data.traits;
            if (data.lifeGoal) sim.lifeGoal = data.lifeGoal;
            if (data.zodiac) sim.zodiac = data.zodiac;
            if (data.mbti) sim.mbti = data.mbti;
            
            if (data.height !== undefined) {
                sim.height = data.height;
                sim.weight = data.weight;
                sim.appearanceScore = data.appearanceScore;
                sim.constitution = data.constitution;
                sim.iq = data.iq;
                sim.eq = data.eq;
            }

            if (data.skinColor) {
                sim.skinColor = data.skinColor;
                sim.hairColor = data.hairColor;
                sim.clothesColor = data.clothesColor;
                sim.pantsColor = data.pantsColor;
            }

            if (data.relationships) {
                sim.relationships = data.relationships;
                sim.partnerId = data.partnerId;
                sim.fatherId = data.fatherId;
                sim.motherId = data.motherId;
                sim.childrenIds = data.childrenIds;
                sim.familyLore = data.familyLore;
                sim.faithfulness = data.faithfulness;
            }

            if (data.memories) sim.memories = data.memories;
            
            if (data.workPerformance !== undefined) sim.workPerformance = data.workPerformance;
            if (data.dailyWorkLog) sim.dailyWorkLog = data.dailyWorkLog;

            if (data.sabIndex !== undefined && data.sabIndex !== -1) {
                if ((sim as any)._sabIndex !== data.sabIndex) {
                    this.simIndexMap.set(data.id, data.sabIndex);
                    this.injectSabGetters(sim, data.sabIndex);
                    (sim as any)._sabIndex = data.sabIndex;
                }
            }
        });

        this.notify();
    }

    static handleWorkerMessage(type: string, payload: any) {
        if (type === 'SAVE_DATA_READY') {
            const { slot, data } = payload;
            const success = SaveManager.saveToSlot(slot, data);
            if (success) {
                this.showToast(`✅ 存档 ${slot} 保存成功！`);
                this.notify();
            } else {
                this.showToast(`❌ 保存失败: 空间不足?`);
            }
        }
        else if (type === 'INIT_MAP') {
            console.log("[Main] Received Map Data from Worker");
            
            this.worldLayout = payload.worldLayout;
            this.furniture = payload.furniture;
            this.rooms = payload.rooms;
            this.housingUnits = payload.housingUnits;
            
            this.initIndex();
            this.triggerMapUpdate(); 
            
            this.showToast("🌍 世界加载完成");
        }
    }

    private static injectSabGetters(sim: any, index: number) {
        (sim as any)._sabIndex = index;
        const view = this.sharedView;
        
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

        Object.defineProperty(sim, 'action', {
            get: () => {
                const base = index * SAB_CONFIG.STRUCT_SIZE;
                const code = view[base + SAB_CONFIG.OFFSET_ACTION];
                return ACTION_NAMES[code] || 'idle';
            },
            set: (val) => { /* no-op */ },
            configurable: true
        });
    }

    static async initGameFlow() {
        if (!this.worker) {
            console.error("Worker not ready yet!");
            return;
        }

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