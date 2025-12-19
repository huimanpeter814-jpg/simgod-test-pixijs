import { GameStore } from '../utils/simulation';
import { PLOTS } from '../data/plots';
import { Furniture, WorldPlot, RoomDef, EditorAction, EditorState } from '../types';

export class EditorManager implements EditorState {
    // === 状态 ===
    mode: 'none' | 'plot' | 'furniture' | 'floor' = 'none';

    activeTool: 'camera' | 'select' = 'select';

    selectedPlotId: string | null = null;
    selectedFurnitureId: string | null = null;
    selectedRoomId: string | null = null;
    
    isDragging: boolean = false;
    dragOffset: { x: number, y: number } = { x: 0, y: 0 };
    
    placingTemplateId: string | null = null;
    placingFurniture: Partial<Furniture> | null = null;

    // [新增] 交互状态管理，修复类型错误
    interactionState: 'idle' | 'carrying' | 'resizing' | 'drawing' = 'idle';
    resizeHandle: 'nw' | 'ne' | 'sw' | 'se' | null = null;
    
    drawingPlot: {
        startX: number;
        startY: number;
        currX: number;
        currY: number;
        templateId: string;
    } | null = null;

    drawingFloor: {
        startX: number;
        startY: number;
        currX: number;
        currY: number;
        pattern: string;
        color: string;
        label: string;
        hasWall: boolean;
    } | null = null;

    previewPos: { x: number, y: number } | null = null;

    // 历史记录
    history: EditorAction[] = [];
    redoStack: EditorAction[] = [];
    
    // 快照
    snapshot: {
        worldLayout: WorldPlot[];
        furniture: Furniture[];
        rooms: RoomDef[]; 
    } | null = null;

    // === 核心逻辑 ===

    enterEditorMode() {
        this.mode = 'plot'; 
        this.snapshot = {
            worldLayout: JSON.parse(JSON.stringify(GameStore.worldLayout)),
            furniture: JSON.parse(JSON.stringify(GameStore.furniture)),
            rooms: JSON.parse(JSON.stringify(GameStore.rooms.filter(r => r.isCustom))) 
        };
        this.history = [];
        this.redoStack = [];
        this.interactionState = 'idle';
        GameStore.time.speed = 0; 
        GameStore.notify();
    }

    confirmChanges() {
        this.snapshot = null; 
        this.resetState();
        GameStore.time.speed = 1; 
        GameStore.initIndex(); 
        GameStore.refreshFurnitureOwnership();
        GameStore.notify();
    }

    cancelChanges() {
        if (this.snapshot) {
            GameStore.worldLayout = this.snapshot.worldLayout;
            const snapshotCustom = this.snapshot.furniture.filter(f => f.id.startsWith('custom_') || f.id.startsWith('vending_') || f.id.startsWith('trash_') || f.id.startsWith('hydrant_'));
            GameStore.furniture = [...GameStore.furniture.filter(f => !f.id.startsWith('custom_')), ...snapshotCustom];
            const existingSystemRooms = GameStore.rooms.filter(r => !r.isCustom);
            GameStore.rooms = [...existingSystemRooms, ...this.snapshot.rooms];
            GameStore.rebuildWorld(false); 
        }
        this.snapshot = null;
        this.resetState();
        GameStore.time.speed = 1;
        GameStore.notify();
    }

    setTool(tool: 'camera' | 'select') {
        this.activeTool = tool;
        this.interactionState = 'idle'; 
        GameStore.notify();
    }

    resetState() {
        this.mode = 'none';
        this.activeTool = 'select'; 
        this.selectedPlotId = null;
        this.selectedFurnitureId = null;
        this.selectedRoomId = null;
        this.placingTemplateId = null;
        this.placingFurniture = null;
        this.drawingFloor = null;
        this.drawingPlot = null;
        this.isDragging = false;
        this.interactionState = 'idle';
        this.resizeHandle = null;
        this.previewPos = null;
    }

    clearMap() {
        if (this.mode === 'none') return;
        if (!confirm('确定要清空所有地皮和家具吗？')) return;
        GameStore.worldLayout = [];
        GameStore.furniture = []; 
        GameStore.rooms = [];
        GameStore.housingUnits = [];
        GameStore.initIndex();
        GameStore.notify();
    }

    // === 撤销/重做 ===

    recordAction(action: EditorAction) {
        this.history.push(action);
        this.redoStack = []; 
        if (this.history.length > 50) this.history.shift(); 
    }

    undo() {
        const action = this.history.pop();
        if (!action) return;
        this.redoStack.push(action);
        this.applyUndoRedo(action, true);
    }

    redo() {
        const action = this.redoStack.pop();
        if (!action) return;
        this.history.push(action);
        this.applyUndoRedo(action, false);
    }

    private applyUndoRedo(action: EditorAction, isUndo: boolean) {
        const data = isUndo ? action.prevData : action.newData;
        const type = isUndo ? (action.type === 'add' ? 'remove' : (action.type === 'remove' ? 'add' : (action.type === 'modify' ? 'modify' : (action.type === 'resize' ? 'resize' : (action.type === 'rotate' ? 'rotate' : 'move'))))) : action.type;

        if (type === 'move') {
            if (action.entityType === 'plot') {
                const plot = GameStore.worldLayout.find(p => p.id === action.id);
                if (plot && data) { plot.x = data.x; plot.y = data.y; GameStore.rebuildWorld(false); }
            } else if (action.entityType === 'furniture') {
                const furn = GameStore.furniture.find(f => f.id === action.id);
                if (furn && data) { furn.x = data.x; furn.y = data.y; }
            } else if (action.entityType === 'room') {
                const room = GameStore.rooms.find(r => r.id === action.id);
                if (room && data) { room.x = data.x; room.y = data.y; }
            }
        } else if (type === 'add') {
            if (action.entityType === 'plot' && data) { GameStore.worldLayout.push(data); GameStore.rebuildWorld(false); }
            else if (action.entityType === 'furniture' && data) { GameStore.furniture.push(data); }
            else if (action.entityType === 'room' && data) { GameStore.rooms.push(data); }
        } else if (type === 'remove') {
            if (action.entityType === 'plot') { this.removePlot(action.id, false); }
            else if (action.entityType === 'furniture') { this.removeFurniture(action.id, false); }
            else if (action.entityType === 'room') { this.removeRoom(action.id, false); }
        } else if (type === 'modify') {
            if (action.entityType === 'plot' && data) {
                const plot = GameStore.worldLayout.find(p => p.id === action.id);
                if (plot) {
                    if (data.templateId) plot.templateId = data.templateId;
                    GameStore.rebuildWorld(false);
                }
            } else if (action.entityType === 'room' && data) {
                const room = GameStore.rooms.find(r => r.id === action.id);
                if (room) {
                    if (data.color) room.color = data.color;
                    if (data.pixelPattern) room.pixelPattern = data.pixelPattern;
                }
            }
        } else if (type === 'resize') {
            const entityId = action.id;
            const entityType = action.entityType;
            if (entityType === 'plot') {
                const plot = GameStore.worldLayout.find(p => p.id === entityId);
                if (plot && data) {
                    plot.x = data.x; plot.y = data.y; plot.width = data.w; plot.height = data.h;
                    // 同步 base room
                    const baseRoom = GameStore.rooms.find(r => r.id === `${plot.id}_base`);
                    if (baseRoom) { baseRoom.x = data.x; baseRoom.y = data.y; baseRoom.w = data.w; baseRoom.h = data.h; }
                }
            } else if (entityType === 'room') {
                const room = GameStore.rooms.find(r => r.id === entityId);
                if (room && data) {
                    room.x = data.x; room.y = data.y; room.w = data.w; room.h = data.h;
                }
            }
        } else if (type === 'rotate') {
            if (action.entityType === 'furniture' && data) {
                const f = GameStore.furniture.find(f => f.id === action.id);
                if (f) {
                    f.rotation = data.rotation;
                    f.w = data.w;
                    f.h = data.h;
                }
            }
        }
        GameStore.initIndex();
        GameStore.notify();
    }

    // === 操作 ===

    startPlacingPlot(templateId: string) {
        this.mode = 'plot';
        this.placingTemplateId = templateId;
        this.placingFurniture = null;
        this.drawingFloor = null;
        this.drawingPlot = null;
        this.selectedPlotId = null;
        this.selectedFurnitureId = null;
        this.isDragging = true; 
        this.interactionState = 'carrying'; 
        
        let w = 300, h = 300;
        if (templateId) {
            const tpl = PLOTS[templateId];
            if (tpl) { w = tpl.width; h = tpl.height; }
        }
        this.dragOffset = { x: w / 2, y: h / 2 };
        GameStore.notify();
    }

    startDrawingPlot(templateId: string = 'default_empty') {
        this.mode = 'plot';
        this.drawingPlot = { startX: 0, startY: 0, currX: 0, currY: 0, templateId };
        this.placingTemplateId = null;
        this.placingFurniture = null;
        this.drawingFloor = null;
        this.selectedPlotId = null;
        this.selectedFurnitureId = null;
        this.interactionState = 'drawing';
        GameStore.notify();
    }

    startPlacingFurniture(template: Partial<Furniture>) {
        this.mode = 'furniture';
        // 初始旋转为 0
        this.placingFurniture = { ...template, rotation: 0 };
        this.placingTemplateId = null;
        this.drawingFloor = null;
        this.drawingPlot = null;
        this.selectedPlotId = null;
        this.selectedFurnitureId = null;
        this.isDragging = true;
        this.interactionState = 'carrying';
        this.dragOffset = { x: (template.w || 0) / 2, y: (template.h || 0) / 2 };
        GameStore.notify();
    }

    startDrawingFloor(pattern: string, color: string, label: string, hasWall: boolean = false) {
        this.mode = 'floor';
        this.drawingFloor = { startX: 0, startY: 0, currX: 0, currY: 0, pattern, color, label, hasWall };
        this.placingTemplateId = null;
        this.placingFurniture = null;
        this.drawingPlot = null;
        this.selectedPlotId = null;
        this.selectedFurnitureId = null;
        this.selectedRoomId = null;
        this.interactionState = 'drawing';
        GameStore.notify();
    }

    rotateSelection() {
        // 1. 旋转正在放置的家具
        if (this.placingFurniture) {
            const oldRot = this.placingFurniture.rotation || 0;
            const newRot = (oldRot + 1) % 4;
            this.placingFurniture.rotation = newRot;
            
            // 交换宽高
            const oldW = this.placingFurniture.w || 0;
            const oldH = this.placingFurniture.h || 0;
            this.placingFurniture.w = oldH;
            this.placingFurniture.h = oldW;
            
            // 更新拖拽偏移，保持中心
            this.dragOffset = { x: oldH / 2, y: oldW / 2 };
            GameStore.notify();
            return;
        }

        // 2. 旋转已选中的家具
        if (this.selectedFurnitureId) {
            const f = GameStore.furniture.find(i => i.id === this.selectedFurnitureId);
            if (f) {
                const prevData = { rotation: f.rotation || 0, w: f.w, h: f.h };
                
                f.rotation = ((f.rotation || 0) + 1) % 4;
                const temp = f.w;
                f.w = f.h;
                f.h = temp;
                
                const newData = { rotation: f.rotation, w: f.w, h: f.h };
                this.recordAction({ type: 'rotate', entityType: 'furniture', id: f.id, prevData, newData });
                GameStore.notify();
            }
        }
    }

    placePlot(x: number, y: number) {
        const templateId = this.placingTemplateId || 'default_empty';
        const prefix = templateId.startsWith('road') ? 'road_custom_' : 'plot_';
        const newId = `${prefix}${Date.now()}`;
        const newPlot: WorldPlot = { id: newId, templateId: templateId, x: x, y: y };
        this.recordAction({ type: 'add', entityType: 'plot', id: newId, newData: newPlot });
        GameStore.worldLayout.push(newPlot);
        GameStore.instantiatePlot(newPlot); 
        GameStore.initIndex(); 
        this.placingTemplateId = null;
        this.isDragging = false;
        this.interactionState = 'idle';
        this.selectedPlotId = newId; 
        GameStore.notify();
    }

    createCustomPlot(rect: {x: number, y: number, w: number, h: number}, templateId: string) {
        const newId = `plot_custom_${Date.now()}`;
        const newPlot: WorldPlot = { id: newId, templateId: templateId, x: rect.x, y: rect.y, width: rect.w, height: rect.h };
        this.recordAction({ type: 'add', entityType: 'plot', id: newId, newData: newPlot });
        GameStore.worldLayout.push(newPlot);
        GameStore.instantiatePlot(newPlot);
        GameStore.initIndex();
        this.selectedPlotId = newId;
        this.interactionState = 'idle';
        GameStore.notify();
    }

    placeFurniture(x: number, y: number) {
        const tpl = this.placingFurniture;
        if (!tpl) return;
        const newItem = { 
            ...tpl, 
            id: `custom_${Date.now()}_${Math.random().toString(36).substr(2,5)}`, 
            x: x, 
            y: y,
            rotation: tpl.rotation || 0 // 确保保存旋转
        } as Furniture;
        
        this.recordAction({ type: 'add', entityType: 'furniture', id: newItem.id, newData: newItem });
        GameStore.furniture.push(newItem);
        GameStore.initIndex();
        GameStore.refreshFurnitureOwnership();
        
        // 连续放置模式：不清除 placingFurniture，但生成新的 ID
        // 如果想按ESC退出，在UI里处理
        // this.placingFurniture = null; 
        // this.isDragging = false;
        // this.interactionState = 'idle';
        
        // 暂时保持单次放置，如果想连续放置，注释掉下面这行
        this.placingFurniture = null; this.isDragging = false; this.interactionState = 'idle';
        
        this.selectedFurnitureId = newItem.id;
        GameStore.notify();
    }

    createCustomRoom(rect: {x: number, y: number, w: number, h: number}, pattern: string, color: string, label: string, hasWall: boolean) {
        const newRoom: RoomDef = {
            id: `custom_room_${Date.now()}`,
            x: rect.x, y: rect.y, w: rect.w, h: rect.h,
            label: label, color: color, pixelPattern: pattern, isCustom: true, hasWall: hasWall
        };
        this.recordAction({ type: 'add', entityType: 'room', id: newRoom.id, newData: newRoom });
        GameStore.rooms.push(newRoom);
        GameStore.initIndex();
        this.selectedRoomId = newRoom.id;
        this.interactionState = 'idle';
        GameStore.notify();
    }

    removePlot(plotId: string, record = true) {
        const plot = GameStore.worldLayout.find(p => p.id === plotId);
        if (!plot) return;
        if (record) this.recordAction({ type: 'remove', entityType: 'plot', id: plotId, prevData: plot });
        
        GameStore.worldLayout = GameStore.worldLayout.filter(p => p.id !== plotId);
        GameStore.rooms = GameStore.rooms.filter(r => !r.id.startsWith(`${plotId}_`)); 
        this.selectedPlotId = null;
        GameStore.initIndex();
        GameStore.notify();
    }

    resizeEntity(type: 'plot' | 'room', id: string, newRect: { x: number, y: number, w: number, h: number }) {
        if (type === 'plot') {
            const plot = GameStore.worldLayout.find(p => p.id === id);
            if (plot) {
                plot.x = newRect.x;
                plot.y = newRect.y;
                plot.width = Math.max(50, newRect.w);
                plot.height = Math.max(50, newRect.h);
                if (plot.templateId === 'default_empty' || plot.id.startsWith('plot_custom')) {
                     const baseRoom = GameStore.rooms.find(r => r.id === `${plot.id}_base`);
                     if (baseRoom) {
                         baseRoom.x = newRect.x;
                         baseRoom.y = newRect.y;
                         baseRoom.w = plot.width;
                         baseRoom.h = plot.height;
                     }
                }
            }
        } else if (type === 'room') {
            const room = GameStore.rooms.find(r => r.id === id);
            if (room) {
                room.x = newRect.x;
                room.y = newRect.y;
                room.w = Math.max(50, newRect.w);
                room.h = Math.max(50, newRect.h);
            }
        }
        GameStore.initIndex(); 
        GameStore.notify();
    }
    
    finalizeResize(type: 'plot'|'room', id: string, prevRect: {x:number,y:number,w:number,h:number}, newRect: {x:number,y:number,w:number,h:number}) {
        //this.isResizing = false;
        this.resizeHandle = null;
        this.interactionState = 'idle';
        this.recordAction({ 
            type: 'resize', 
            entityType: type, 
            id, 
            prevData: prevRect, 
            newData: newRect 
        });
        GameStore.notify();
    }

    removeRoom(roomId: string, record = true) {
        const room = GameStore.rooms.find(r => r.id === roomId);
        if (!room) return;
        if (record) this.recordAction({ type: 'remove', entityType: 'room', id: roomId, prevData: room });
        GameStore.rooms = GameStore.rooms.filter(r => r.id !== roomId);
        this.selectedRoomId = null;
        GameStore.initIndex();
        GameStore.notify();
    }

    removeFurniture(id: string, record = true) {
        const item = GameStore.furniture.find(f => f.id === id);
        if (!item) return;
        if (record) this.recordAction({ type: 'remove', entityType: 'furniture', id, prevData: item });
        GameStore.furniture = GameStore.furniture.filter(f => f.id !== id);
        this.selectedFurnitureId = null;
        GameStore.initIndex();
        GameStore.notify();
    }

    changePlotTemplate(plotId: string, newTemplateId: string) {
        const plot = GameStore.worldLayout.find(p => p.id === plotId);
        if (!plot) return;
        const oldTemplate = plot.templateId;
        this.recordAction({ type: 'modify', entityType: 'plot', id: plotId, prevData: { templateId: oldTemplate }, newData: { templateId: newTemplateId } });
        plot.templateId = newTemplateId;
        GameStore.rooms = GameStore.rooms.filter(r => !r.id.startsWith(`${plotId}_`));
        GameStore.furniture = GameStore.furniture.filter(f => !f.id.startsWith(`${plotId}_`));
        GameStore.housingUnits = GameStore.housingUnits.filter(h => !h.id.startsWith(`${plotId}_`));
        GameStore.instantiatePlot(plot);
        GameStore.initIndex();
        GameStore.notify();
    }

    modifyRoom(roomId: string, changes: Partial<RoomDef>) {
        const room = GameStore.rooms.find(r => r.id === roomId);
        if (!room) return;
        const prevData = { color: room.color, pixelPattern: room.pixelPattern };
        
        let changed = false;
        if (changes.color) { room.color = changes.color; changed = true; }
        if (changes.pixelPattern) { room.pixelPattern = changes.pixelPattern; changed = true; }
        
        if (changed) {
            this.recordAction({ type: 'modify', entityType: 'room', id: roomId, prevData, newData: changes });
            GameStore.notify();
        }
    }

    finalizeMove(entityType: 'plot' | 'furniture' | 'room', id: string, startPos: {x:number, y:number}) {
        if (!this.previewPos) return;
        const { x, y } = this.previewPos;
        let hasChange = false;
        
        if (entityType === 'plot') {
            const plot = GameStore.worldLayout.find(p => p.id === id);
            if (plot && (plot.x !== x || plot.y !== y)) {
                const dx = x - plot.x;
                const dy = y - plot.y;
                plot.x = x; plot.y = y; 
                GameStore.rooms.forEach(r => { if(r.id.startsWith(`${id}_`)) { r.x += dx; r.y += dy; } });
                GameStore.furniture.forEach(f => { if(f.id.startsWith(`${id}_`)) { f.x += dx; f.y += dy; } });
                GameStore.housingUnits.forEach(u => { 
                    if(u.id.startsWith(`${id}_`)) { u.x += dx; u.y += dy; if(u.maxX) u.maxX += dx; if(u.maxY) u.maxY += dy; } 
                });
                hasChange = true; 
            }
        } else if (entityType === 'furniture') {
            const furn = GameStore.furniture.find(f => f.id === id);
            if (furn && (furn.x !== x || furn.y !== y)) { furn.x = x; furn.y = y; hasChange = true; }
        } else if (entityType === 'room') {
            const room = GameStore.rooms.find(r => r.id === id);
            if (room && (room.x !== x || room.y !== y)) { room.x = x; room.y = y; hasChange = true; }
        }

        if (hasChange) {
            this.recordAction({ type: 'move', entityType, id, prevData: startPos, newData: { x, y } });
            GameStore.initIndex();
            GameStore.refreshFurnitureOwnership();
            if (entityType === 'furniture') {
                // 如果家具被移动了，更新正在使用它的市民的位置
                GameStore.sims.forEach(sim => {
                    if (sim.interactionTarget && sim.interactionTarget.id === id) {
                        if (sim.action === 'using' || sim.action === 'working' || sim.action === 'sleeping') {
                            const f = GameStore.furniture.find(i => i.id === id);
                            if (f) { sim.pos.x = f.x + f.w / 2; sim.pos.y = f.y + f.h / 2; }
                        }
                    }
                });
            }
        }
        
        // Reset state after move
        this.isDragging = false;
        this.interactionState = 'idle';
        this.previewPos = null;
        GameStore.notify();
    }
}