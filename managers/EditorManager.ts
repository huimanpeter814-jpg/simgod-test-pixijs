import { GameStore } from '../utils/simulation';
import { PLOTS } from '../data/plots';
import { Furniture, WorldPlot, RoomDef, EditorAction, EditorState } from '../types';

export class EditorManager implements EditorState {
    mode: 'none' | 'plot' | 'furniture' | 'floor' = 'none';
    activeTool: 'camera' | 'select' = 'select';

    gridSize: number = 50; 
    showGrid: boolean = true;
    snapToGrid: boolean = true;
    isValidPlacement: boolean = true;

    selectedPlotId: string | null = null;
    selectedFurnitureId: string | null = null;
    selectedRoomId: string | null = null;
    
    isDragging: boolean = false;
    dragOffset: { x: number, y: number } = { x: 0, y: 0 };
    
    placingTemplateId: string | null = null;
    placingFurniture: Partial<Furniture> | null = null;

    interactionState: 'idle' | 'carrying' | 'resizing' | 'drawing' = 'idle';
    resizeHandle: 'nw' | 'ne' | 'sw' | 'se' | null = null;
    
    drawingPlot: any = null;
    drawingFloor: any = null;
    previewPos: { x: number, y: number } | null = null;

    history: EditorAction[] = [];
    redoStack: EditorAction[] = [];
    
    snapshot: any = null;

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
        GameStore.setGameSpeed(0);
        GameStore.notify();
    }

    confirmChanges() {
        this.snapshot = null; 
        this.resetState();
        GameStore.setGameSpeed(1);
        GameStore.initIndex(); 
        GameStore.refreshFurnitureOwnership();
        GameStore.sendUpdateMap();
        GameStore.notify();
    }
    // [新增] 删除当前选中的物体
    deleteCurrentSelection() {
        if (this.mode === 'furniture' && this.selectedFurnitureId) {
            this.removeFurniture(this.selectedFurnitureId);
            this.selectedFurnitureId = null;
        } else if (this.mode === 'plot' && this.selectedPlotId) {
            this.removePlot(this.selectedPlotId);
            this.selectedPlotId = null;
        } else if (this.mode === 'floor' && this.selectedRoomId) {
            this.removeRoom(this.selectedRoomId);
            this.selectedRoomId = null;
        }
        GameStore.notify();
    }

    // 1. 优化：检查放置位置是否合法 (简单的 AABB 碰撞检测)
    checkPlacementValidity(x: number, y: number, w: number, h: number): boolean {
        // 简单示例：如果是家具，不能和其他家具重叠
        if (this.mode === 'furniture') {
            const rect = { x, y, w, h };
            // 排除自己（如果是移动模式）
            const others = GameStore.furniture.filter(f => f.id !== this.selectedFurnitureId);
            
            for (const other of others) {
                if (x < other.x + other.w && x + w > other.x &&
                    y < other.y + other.h && y + h > other.y) {
                    return false; // 重叠了
                }
            }
        }
        // 这里可以扩展更多逻辑，比如必须在地板上等
        return true;
    }

    cancelChanges() {
        if (this.snapshot) {
            GameStore.worldLayout = this.snapshot.worldLayout;
            // [修复] 恢复旧逻辑：因为 rebuildWorld(false) 只处理自定义家具
            // 如果我们之前是全量加载，这里需要特别处理，或者简单地全量恢复
            GameStore.furniture = this.snapshot.furniture;
            
            // 房间需要区分：系统生成 vs 自定义
            // 简单策略：重建世界以恢复系统房间，然后追加快照里的自定义房间
            // 但因为我们之前修改了 GameStore.furniture 指向了快照，rebuildWorld 会清空它
            // 所以正确的顺序是：
            
            // 1. 恢复 Layout
            GameStore.worldLayout = this.snapshot.worldLayout;
            
            // 2. 重建系统默认对象
            // 注意：rebuildWorld(false) 在 GameStore 中被定义为只保留自定义物品
            // 这里我们需要的是“恢复到进入编辑模式前的状态”
            // 既然 snapshot.furniture 存的是当时的所有家具，直接赋值即可
            
            GameStore.furniture = this.snapshot.furniture;
            
            // 房间同理，但因为房间有 template 生成的，比较复杂
            // 最稳妥的方法：重新从 layout 生成系统房间，然后覆盖自定义属性？
            // 为了简化，我们假设用户不想撤销对默认家具的移动（如果太复杂），
            // 但为了体验，还是全量恢复比较好。
            // 鉴于 rebuildWorld 逻辑比较死板，我们这里手动恢复：
            
            // 恢复房间：快照里只存了 isCustom 的房间？
            // 在 enterEditorMode 里：rooms: JSON.parse(JSON.stringify(GameStore.rooms.filter(r => r.isCustom))) 
            // 这意味着非 custom 的房间没存快照。
            // 所以我们需要重新生成非 custom 房间
            
            const customRooms = this.snapshot.rooms;
            GameStore.rebuildWorld(true); // 生成默认房间和家具
            
            // 现在的 GameStore.furniture 是默认的。我们需要用快照覆盖它吗？
            // 快照里的是进入编辑模式时的所有家具（包括已移动的默认家具）
            GameStore.furniture = this.snapshot.furniture;
            
            // 房间：合并
            const defaultRooms = GameStore.rooms.filter(r => !r.isCustom);
            GameStore.rooms = [...defaultRooms, ...customRooms];
        }
        this.snapshot = null;
        this.resetState();
        GameStore.setGameSpeed(1);
        GameStore.triggerMapUpdate();
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
        GameStore.triggerMapUpdate(); 
    }

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
        if (this.placingFurniture) {
            const oldRot = this.placingFurniture.rotation || 0;
            this.placingFurniture.rotation = (oldRot + 1) % 4;
            const temp = this.placingFurniture.w;
            this.placingFurniture.w = this.placingFurniture.h;
            this.placingFurniture.h = temp;
            this.dragOffset = { x: (this.placingFurniture.w||0)/2, y: (this.placingFurniture.h||0)/2 };
            GameStore.notify();
            return;
        }

        if (this.selectedFurnitureId) {
            const f = GameStore.furniture.find(i => i.id === this.selectedFurnitureId);
            if (f) {
                f.rotation = ((f.rotation || 0) + 1) % 4;
                const temp = f.w;
                f.w = f.h;
                f.h = temp;
                GameStore.initIndex(); 
                GameStore.triggerMapUpdate(); 
            }
        }
    }

    placePlot(x: number, y: number) {
        const templateId = this.placingTemplateId || 'default_empty';
        const prefix = templateId.startsWith('road') ? 'road_custom_' : 'plot_';
        const newId = `${prefix}${Date.now()}`;
        const newPlot: WorldPlot = { id: newId, templateId: templateId, x: x, y: y };
        GameStore.worldLayout.push(newPlot);
        GameStore.instantiatePlot(newPlot); 
        GameStore.initIndex(); 
        
        this.placingTemplateId = null;
        this.isDragging = false;
        this.interactionState = 'idle';
        this.selectedPlotId = newId; 
        GameStore.triggerMapUpdate();
    }

    createCustomPlot(rect: {x: number, y: number, w: number, h: number}, templateId: string) {
        const newId = `plot_custom_${Date.now()}`;
        const newPlot: WorldPlot = { id: newId, templateId: templateId, x: rect.x, y: rect.y, width: rect.w, height: rect.h };
        GameStore.worldLayout.push(newPlot);
        GameStore.instantiatePlot(newPlot);
        GameStore.initIndex();
        this.selectedPlotId = newId;
        this.interactionState = 'idle';
        GameStore.triggerMapUpdate();
    }

    // 2. 优化：放置家具逻辑，增加连续放置支持
    placeFurniture(x: number, y: number, keepPlacing: boolean = false) {
        const tpl = this.placingFurniture;
        if (!tpl) return;
        
        // 检查合法性
        if (!this.isValidPlacement) {
            GameStore.showToast("❌ 这里不能放置物品");
            return;
        }

        const newItem = { 
            ...tpl, 
            id: `custom_${Date.now()}_${Math.random().toString(36).substr(2,5)}`, 
            x: x, 
            y: y,
            rotation: tpl.rotation || 0
        } as Furniture;
        
        GameStore.furniture.push(newItem);
        GameStore.initIndex();
        GameStore.refreshFurnitureOwnership();
        
        if (!keepPlacing) {
            this.placingFurniture = null; 
            this.isDragging = false; 
            this.interactionState = 'idle';
            this.selectedFurnitureId = newItem.id; // 选中刚放置的
        } else {
            // 连续放置模式：不清除 placingFurniture
             GameStore.showToast("按住 Shift 可连续放置");
        }

        GameStore.triggerMapUpdate();
    }

    // 3. 优化：更新预览位置（包含吸附和合法性检查）
    updatePreviewPos(worldX: number, worldY: number) {
        // 只要是在放置模式（有模板或有家具）或者正在拖拽，就计算预览位置
        const isPlacing = this.placingFurniture || this.placingTemplateId;
        
        if (!this.isDragging && !isPlacing) return;

        let w = 100, h = 100;
        // 获取当前操作对象的尺寸
        if (this.mode === 'furniture') {
            const tpl = this.placingFurniture || GameStore.furniture.find(f => f.id === this.selectedFurnitureId);
            if (tpl) { w = tpl.w ?? 100; h = tpl.h ?? 100; }
        } else if (this.mode === 'plot') {
             if (this.placingTemplateId) {
                 const tpl = PLOTS[this.placingTemplateId];
                 if (tpl) { w = tpl.width; h = tpl.height; }
             } else if (this.selectedPlotId) {
                 const p = GameStore.worldLayout.find(x => x.id === this.selectedPlotId);
                 if (p) { w = p.width || 300; h = p.height || 300; }
             }
        }

        // 计算吸附
        let finalX = worldX;
        let finalY = worldY;

        // 如果是新放置（Placing），预览位置以鼠标为中心或左上角
        // 这里假设 dragOffset 在 startPlacing 时已经设置好。
        // 如果是悬停状态（isDragging=false），我们需要动态计算一个“虚拟”的 dragOffset，通常设为中心
        let offsetX = this.dragOffset.x;
        let offsetY = this.dragOffset.y;

        if (!this.isDragging && isPlacing) {
            offsetX = w / 2;
            offsetY = h / 2;
        }

        if (this.snapToGrid) {
            finalX = Math.round((worldX - offsetX) / this.gridSize) * this.gridSize;
            finalY = Math.round((worldY - offsetY) / this.gridSize) * this.gridSize;
        } else {
            finalX = worldX - offsetX;
            finalY = worldY - offsetY;
        }

        this.previewPos = { x: finalX, y: finalY };
        
        // 实时更新合法性状态
        this.isValidPlacement = this.checkPlacementValidity(finalX, finalY, w, h);
    }

    createCustomRoom(rect: {x: number, y: number, w: number, h: number}, pattern: string, color: string, label: string, hasWall: boolean) {
        const newRoom: RoomDef = {
            id: `custom_room_${Date.now()}`,
            x: rect.x, y: rect.y, w: rect.w, h: rect.h,
            label: label, color: color, pixelPattern: pattern, isCustom: true, hasWall: hasWall
        };
        GameStore.rooms.push(newRoom);
        GameStore.initIndex();
        this.selectedRoomId = newRoom.id;
        this.interactionState = 'idle';
        GameStore.triggerMapUpdate();
    }

    changePlotTemplate(plotId: string, templateId: string) {
        const plot = GameStore.worldLayout.find(p => p.id === plotId);
        if (plot) {
            // 清理旧数据
            GameStore.rooms = GameStore.rooms.filter(r => !r.id.startsWith(`${plotId}_`));
            GameStore.furniture = GameStore.furniture.filter(f => !f.id.startsWith(`${plotId}_`));
            GameStore.housingUnits = GameStore.housingUnits.filter(h => !h.id.startsWith(`${plotId}_`));

            plot.templateId = templateId;
            GameStore.instantiatePlot(plot);
            GameStore.initIndex();
            GameStore.refreshFurnitureOwnership();
            GameStore.triggerMapUpdate();
        }
    }

    removePlot(plotId: string) {
        GameStore.worldLayout = GameStore.worldLayout.filter(p => p.id !== plotId);
        GameStore.rooms = GameStore.rooms.filter(r => !r.id.startsWith(`${plotId}_`)); 
        this.selectedPlotId = null;
        GameStore.initIndex();
        GameStore.triggerMapUpdate();
    }

    removeFurniture(id: string) {
        GameStore.furniture = GameStore.furniture.filter(f => f.id !== id);
        this.selectedFurnitureId = null;
        GameStore.initIndex();
        GameStore.triggerMapUpdate();
    }

    removeRoom(roomId: string) {
        GameStore.rooms = GameStore.rooms.filter(r => r.id !== roomId);
        this.selectedRoomId = null;
        GameStore.initIndex();
        GameStore.triggerMapUpdate();
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
        GameStore.triggerMapUpdate();
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
            GameStore.initIndex();
            GameStore.refreshFurnitureOwnership();
            GameStore.triggerMapUpdate();
        }
        
        this.isDragging = false;
        this.interactionState = 'idle';
        this.previewPos = null;
        GameStore.notify();
    }
    
    recordAction(action: EditorAction) {}
    undo() {}
    redo() {}
}