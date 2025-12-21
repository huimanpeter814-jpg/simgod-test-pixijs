import { JOBS, CONFIG, ASSET_CONFIG } from '../constants'; 
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

export class GameStore {
    static sims: Sim[] = [];
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

    static removeSim(id: string) {
        this.sims = this.sims.filter(s => s.id !== id);
        if (this.selectedSimId === id) this.selectedSimId = null;
        this.notify();
    }

    static spawnNanny(homeId: string, task: 'home_care' | 'drop_off' | 'pick_up' = 'home_care', targetChildId?: string) {
        let nanny = this.sims.find(s => s.homeId === homeId && s.isTemporary);
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

        if (initial) {
            this.rooms = [];
        } else {
            this.rooms = this.rooms.filter(r => r.isCustom);
        }
        
        this.housingUnits = [];
        
        if (initial) {
            this.furniture = [];
            // @ts-ignore
            this.furniture.push(...STREET_PROPS);
        } else {
            this.furniture = this.furniture.filter(f => f.id.startsWith('custom_') || f.id.startsWith('vending_') || f.id.startsWith('trash_') || f.id.startsWith('hydrant_'));
        }

        this.worldLayout.forEach(plot => {
            GameStore.instantiatePlot(plot);
        });

        // [修复] 重建后必须强制更新索引，否则寻路和查询会失效
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
            if (f.id.startsWith('custom_')) {
                const cx = f.x + f.w / 2;
                const cy = f.y + f.h / 2;
                const ownerUnit = this.housingUnits.find(u => {
                    const maxX = u.maxX ?? (u.x + u.area.w);
                    const maxY = u.maxY ?? (u.y + u.area.h);
                    return cx >= u.x && cx < maxX && cy >= u.y && cy < maxY;
                });
                if (ownerUnit) f.homeId = ownerUnit.id;
                else delete f.homeId;
            }
        });
    }

    static getMapData() {
        return {
            version: "1.0",
            timestamp: Date.now(),
            worldLayout: this.worldLayout,
            rooms: this.rooms.filter(r => r.isCustom),
            customFurniture: this.furniture.filter(f => f.id.startsWith('custom_') || f.id.startsWith('vending_') || f.id.startsWith('trash_') || f.id.startsWith('hydrant_'))
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
            if (validData.rooms) this.rooms = [...this.rooms, ...validData.rooms];
            if (validData.customFurniture) this.furniture = [...this.furniture, ...validData.customFurniture];
            
            this.triggerMapUpdate();
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
    
    static placePlot(x: number, y: number) { this.editor.placePlot(x, y); this.triggerMapUpdate(); }
    static createCustomPlot(rect: any, templateId: string) { this.editor.createCustomPlot(rect, templateId); this.triggerMapUpdate(); }
    static placeFurniture(x: number, y: number) { this.editor.placeFurniture(x, y); this.triggerMapUpdate(); }
    static createCustomRoom(rect: any, pattern: string, color: string, label: string, hasWall: boolean) { this.editor.createCustomRoom(rect, pattern, color, label, hasWall); this.triggerMapUpdate(); }
    static removePlot(plotId: string) { this.editor.removePlot(plotId); this.triggerMapUpdate(); }
    static removeRoom(roomId: string) { this.editor.removeRoom(roomId); this.triggerMapUpdate(); }
    static removeFurniture(id: string) { this.editor.removeFurniture(id); this.triggerMapUpdate(); }
    static changePlotTemplate(plotId: string, templateId: string) { this.editor.changePlotTemplate(plotId, templateId); this.triggerMapUpdate(); }
    static finalizeMove(type: 'plot'|'furniture'|'room', id: string, startPos: any) { this.editor.finalizeMove(type, id, startPos); this.triggerMapUpdate(); }
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

            // 查找该家具属于哪个地块
            // 1. 优先尝试 ID 匹配 (性能最快)
            let ownerPlot = this.worldLayout.find(p => f.id.startsWith(p.id));
            
            // 2. 如果 ID 不匹配 (例如是 custom_ 开头的放置物)，则进行【坐标判定】
            if (!ownerPlot) {
                // 计算家具中心点
                const cx = f.x + f.w / 2;
                const cy = f.y + f.h / 2;
                
                ownerPlot = this.worldLayout.find(p => {
                    const pw = p.width || 300; // 如果未定义宽度，使用默认值
                    const ph = p.height || 300;
                    return cx >= p.x && cx < p.x + pw && 
                        cy >= p.y && cy < p.y + ph;
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
            if (r.isCustom) {
                this.worldGrid.insert({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, type: 'room', ref: r });
            }
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
            rooms: this.rooms.filter(r => r.isCustom),
            customFurniture: this.furniture.filter(f => f.id.startsWith('custom_') || f.id.startsWith('vending_') || f.id.startsWith('trash_') || f.id.startsWith('hydrant_')) 
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
            if (!silent) {
                this.showToast(`❌ 读取存档失败`);
            }
            return false;
        }

        try {
            // [修复] 增加对 worldLayout 数据的校验
            if (data.worldLayout && Array.isArray(data.worldLayout) && data.worldLayout.length > 0) {
                this.worldLayout = data.worldLayout;
            } else {
                console.warn("[GameStore] Corrupted world layout in save, using default.");
                this.worldLayout = JSON.parse(JSON.stringify(WORLD_LAYOUT));
            }

            this.rebuildWorld(true); 

            if (data.rooms) this.rooms = [...this.rooms, ...data.rooms];
            if (data.customFurniture) {
                const staticFurniture = this.furniture; 
                this.furniture = [...staticFurniture, ...data.customFurniture];
            }

            this.time = { ...data.time, speed: 1 };
            this.logs = data.logs || [];

            this.loadSims(data.sims);

            this.triggerMapUpdate(); 
            
            if (!silent) {
                this.showToast(`📂 读取存档 ${slotIndex} 成功！`);
            }
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
            
            // [关键] 自动分配缺失的服装资源 (存档迁移)
            if (!sim.appearance.clothes && ASSET_CONFIG.clothes.length > 0) {
                sim.appearance.clothes = ASSET_CONFIG.clothes[Math.floor(Math.random() * ASSET_CONFIG.clothes.length)];
            }
            if (!sim.appearance.pants && ASSET_CONFIG.pants.length > 0) {
                sim.appearance.pants = ASSET_CONFIG.pants[Math.floor(Math.random() * ASSET_CONFIG.pants.length)];
            }
            if (!sim.appearance.hair && ASSET_CONFIG.hairs.length > 0) {
                sim.appearance.hair = ASSET_CONFIG.hairs[Math.floor(Math.random() * ASSET_CONFIG.hairs.length)];
            }

            const currentJobDefinition = JOBS.find(j => j.id === sim.job.id);
            if (currentJobDefinition) {
                sim.job = { ...currentJobDefinition };
            }

            sim.restoreState();

            return sim;
        });
    }

    static spawnFamily(size?: number) {
        const count = size || (2 + Math.floor(Math.random() * 3)); 
        const fam = FamilyGenerator.generate(count, this.housingUnits, this.sims);
        this.sims.push(...fam);
        
        const logMsg = count === 1 
            ? `新居民 ${fam[0].name} 搬入了城市。`
            : `新家庭 (${fam[0].surname}家) 搬入城市！共 ${fam.length} 人。`;
            
        this.addLog(null, logMsg, "sys");
        this.notify();
    }

    static spawnSingle() {
        this.spawnFamily(1);
    }

    static spawnCustomSim(config: SimInitConfig) {
        const sim = new Sim(config);
        
        this.sims.push(sim);
        this.assignRandomHome(sim); 
        
        this.addLog(null, `[入住] 新居民 ${sim.name} (自定义) 搬入了城市。`, "sys");
        this.showToast(`✨ ${sim.name} 创建成功！`);
        this.notify();
        
        this.selectedSimId = sim.id;
    }

    static spawnCustomFamily(configs: any[]) {
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
            
            // 如果外观没有设置，尝试自动分配
            if (!sim.appearance.hair && ASSET_CONFIG.hairs.length > 0) {
                sim.appearance.hair = ASSET_CONFIG.hairs[Math.floor(Math.random() * ASSET_CONFIG.hairs.length)];
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
}

export function initGame() {
    GameStore.sims = [];
    GameStore.particles = [];
    GameStore.logs = []; 
    GameStore.time = { totalDays: 1, year: 1, month: 1, hour: 8, minute: 0, speed: 2 };

    GameStore.rebuildWorld(true); 

    if (GameStore.loadGame(1,true)) {
        GameStore.addLog(null, "自动读取存档 1 成功", "sys");
    } else {
        GameStore.addLog(null, "正在初始化新城市人口...", "sys");
        
        GameStore.spawnSingle();
        GameStore.spawnSingle();
        GameStore.spawnFamily();
        GameStore.spawnFamily();

        GameStore.addLog(null, `新世界已生成！当前人口: ${GameStore.sims.length}`, "sys");
    }
    GameStore.notify();
}