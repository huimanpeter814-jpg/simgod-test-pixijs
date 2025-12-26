import { GameStore } from '../utils/simulation';
import { PLOTS } from '../data/plots';
import { Furniture, WorldPlot, RoomDef, EditorAction, EditorState } from '../types';

export class EditorManager implements EditorState {
    mode: 'none' | 'plot' | 'furniture' | 'floor' = 'none';
    activeTool: 'camera' | 'select' = 'select';

    activePlotId: string | null = null;

    gridSize: number = 10; 
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
    // [新增] 用于存储放置时的临时自定义尺寸
    placingSize: { w: number, h: number } | null = null;
    // [新增] 用于记录当前放置物的类型 ('decor' | 'surface' | null)
    placingType: string | null = null;
    
    drawingPlot: any = null;
    drawingFloor: any = null;
    previewPos: { x: number, y: number } | null = null;

    history: EditorAction[] = [];
    redoStack: EditorAction[] = [];
    
    snapshot: any = null;

    // 进入世界编辑模式
    enterEditorMode() {
        this.resetState();
        this.mode = 'plot'; // 默认进入地皮编辑
        this.activePlotId = null; // 确保没有激活的地皮
        // 暂停游戏
        GameStore.setGameSpeed(0);

        // 创建快照 (用于撤销/取消)
        this.snapshot = {
            worldLayout: JSON.parse(JSON.stringify(GameStore.worldLayout)),
            furniture: JSON.parse(JSON.stringify(GameStore.furniture)),
            rooms: JSON.parse(JSON.stringify(GameStore.rooms.filter(r => r.isCustom))) 
        };
        GameStore.notify();
    }

    // 进入建筑模式 (Build Mode)
    enterBuildMode(plotId: string) {
        const plot = GameStore.worldLayout.find(p => p.id === plotId);
        if (!plot) return;

        this.activePlotId = plotId;
        this.selectedPlotId = null; // 进入内部后，取消选中地皮本身
        this.mode = 'furniture'; // 默认切到家具 Tab
        this.activeTool = 'select';
        
        GameStore.showToast(`正在装修: ${plot.customName || '未命名地皮'}`);
        GameStore.notify();
    }

    // 退出建筑模式，返回世界模式
    exitBuildMode() {
        this.activePlotId = null;
        this.resetState();
        this.mode = 'plot'; // 切回地皮模式
        GameStore.showToast("返回世界地图");
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


    cancelChanges() {
        if (this.snapshot) {
            // 1. 强制深拷贝恢复世界布局 (确保包含被删除的地皮)
            GameStore.worldLayout = JSON.parse(JSON.stringify(this.snapshot.worldLayout));
            
            // 2. 调用 rebuildWorld(true) 重建基础结构
            // 这会根据恢复后的 worldLayout 重新生成所有的 Default Rooms, Default Furniture 和 HousingUnits
            // 这一步至关重要，因为它会“复活”被删除地皮的基础显示（如草地/地板）
            GameStore.rebuildWorld(true);
            
            // 3. 恢复家具 (覆盖 rebuildWorld 生成的默认家具)
            // 这样可以保留进入编辑模式时的所有家具状态（包括位置、旋转、自定义家具）
            GameStore.furniture = JSON.parse(JSON.stringify(this.snapshot.furniture));
            
            // 4. 恢复自定义房间并合并
            // defaultRooms 是刚才 rebuildWorld 生成的（比如地皮自带的地板）
            // customRooms 是快照里存的用户画的房间
            const defaultRooms = GameStore.rooms.filter(r => !r.isCustom);
            const customRooms = this.snapshot.rooms || [];
            GameStore.rooms = [...defaultRooms, ...customRooms];

            // 5. 重新计算归属权 (因为 furniture 被覆盖了，需要重新关联到新生成的 HousingUnits)
            GameStore.refreshFurnitureOwnership();
        }

        this.snapshot = null;
        this.resetState();
        GameStore.setGameSpeed(1); // 恢复游戏速度
        
        // 6. 最后触发一次全局更新，确保 Worker 和 UI 同步
        GameStore.triggerMapUpdate();
    }

    deleteCurrentSelection() {
        // 世界模式：只能删地皮
        if (!this.activePlotId) {
            if (this.selectedPlotId) {
                this.removePlot(this.selectedPlotId);
                this.selectedPlotId = null;
            }
        } 
        // 建筑模式：只能删家具/房间
        else {
            if (this.selectedFurnitureId) {
                this.removeFurniture(this.selectedFurnitureId);
                this.selectedFurnitureId = null;
            } else if (this.selectedRoomId) {
                this.removeRoom(this.selectedRoomId);
                this.selectedRoomId = null;
            }
        }
        GameStore.notify();
    }

    // 1. 优化：检查放置位置是否合法 (简单的 AABB 碰撞检测)
    checkPlacementValidity(x: number, y: number, w: number, h: number): boolean {
        // 1. 如果处于建筑模式，必须检查是否在地皮范围内
        if (this.activePlotId) {
            const plot = GameStore.worldLayout.find(p => p.id === this.activePlotId);
            if (!plot) return false;

            // 简单的 AABB 包含检测
            const plotRight = plot.x + (plot.width || 300);
            const plotBottom = plot.y + (plot.height || 300);
            const itemRight = x + w;
            const itemBottom = y + h;

            // 严格检测：物体不能超出地皮边界
            if (x < plot.x || y < plot.y || itemRight > plotRight || itemBottom > plotBottom) {
                return false; 
            }
        }
        // 2. 世界模式：地皮不能重叠
        else if (this.mode === 'plot') {
            const others = GameStore.worldLayout.filter(p => p.id !== this.selectedPlotId);
            for (const other of others) {
                const ow = other.width || 300;
                const oh = other.height || 300;
                // AABB 重叠检测
                if (x < other.x + ow && x + w > other.x &&
                    y < other.y + oh && y + h > other.y) {
                    return false;
                }
            }
        }
        // 这里可以扩展更多逻辑，比如必须在地板上等
        return true;
    }

    setTool(tool: 'camera' | 'select') {
        this.activeTool = tool;
        this.interactionState = 'idle'; 
        GameStore.notify();
    }

    resetState() {
        // 不重置 activePlotId，只重置交互状态
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
        this.placingType = null; // [新增] 重置类型
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

    // 🟢 [修改] startPlacingPlot 支持传入自定义尺寸
    startPlacingPlot(templateId: string, customSize?: { w: number, h: number }, customType?: string) {
        if (this.activePlotId) {
            GameStore.showToast("❌ 请先退出装修模式");
            return;
        }
        this.mode = 'plot';
        this.placingTemplateId = templateId;
        this.placingType = customType || null; // [新增] 记录类型
        
        this.isDragging = true; 
        this.interactionState = 'carrying';
        
        let w = 300, h = 300;
        
        // 优先使用传入的自定义尺寸
        if (customSize) {
            w = customSize.w;
            h = customSize.h;
            this.placingSize = customSize;
        } else if (templateId && PLOTS[templateId]) {
            w = PLOTS[templateId].width;
            h = PLOTS[templateId].height;
            this.placingSize = null;
        }
        
        this.dragOffset = { x: w / 2, y: h / 2 };
        GameStore.notify();
    }

    startDrawingPlot(templateId: string = 'default_empty') {
        if (this.activePlotId) return; // 建筑模式下不能画地皮
        this.mode = 'plot';
        this.drawingPlot = { startX: 0, startY: 0, currX: 0, currY: 0, templateId };
        this.interactionState = 'drawing';
        GameStore.notify();
    }

    startPlacingFurniture(template: Partial<Furniture>) {
        if (!this.activePlotId) {
            GameStore.showToast("❌ 请先选择地皮并【进入装修】");
            return;
        }
        this.mode = 'furniture';
        this.placingFurniture = { ...template, rotation: 0 };
        this.isDragging = true;
        this.interactionState = 'carrying';
        this.dragOffset = { x: (template.w || 0) / 2, y: (template.h || 0) / 2 };
        GameStore.notify();
    }

    startDrawingFloor(pattern: string, color: string, label: string, hasWall: boolean = false) {
        if (!this.activePlotId) return; // 世界模式下不能画地板
        this.mode = 'floor';
        this.drawingFloor = { startX: 0, startY: 0, currX: 0, currY: 0, pattern, color, label, hasWall };
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
        let w = 300, h = 300;
        if (PLOTS[templateId]) { w = PLOTS[templateId].width; h = PLOTS[templateId].height; }
        if (this.placingSize) { w = this.placingSize.w; h = this.placingSize.h; }
        const newPlot: WorldPlot = { 
            id: newId, 
            templateId: templateId, 
            x: x, 
            y: y,
            width: w,
            height: h,
            // [修改] 如果有明确的 placingType，则直接设置；否则根据是否为自定义尺寸判断（保持兼容）
            customType: this.placingType || undefined, 
            // [修改] 默认名称逻辑优化
            customName: this.placingType === 'decor' ? '景观装饰' : 
                       (this.placingType === 'surface' ? '地形地表' : 
                       (this.placingSize ? '装饰/地表' : undefined))
        };
        GameStore.worldLayout.push(newPlot);
        GameStore.instantiatePlot(newPlot); 
        GameStore.initIndex(); 
        
        this.placingTemplateId = null;
        this.placingSize = null; 
        this.placingType = null; // [新增] 重置
        this.isDragging = false;
        this.interactionState = 'idle';
        this.selectedPlotId = newId; 
        
        // 这一步会将带 customType 的数据同步给 Worker
        GameStore.triggerMapUpdate();
    }

    // 🟢 [新增] 更新地皮元数据的方法
    updatePlotMetadata(id: string, name: string, type: string) {
        const plot = GameStore.worldLayout.find(p => p.id === id);
        if (plot) {
            plot.customName = name;
            plot.customType = type;
            // 通知 Worker 更新
            GameStore.triggerMapUpdate();
            GameStore.notify();
        }
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
        const isPlacing = this.placingFurniture || this.placingTemplateId;
        if (!this.isDragging && !isPlacing) return;

        let w = 100, h = 100;
        // 获取尺寸
        if (this.mode === 'furniture') {
            const tpl = this.placingFurniture || GameStore.furniture.find(f => f.id === this.selectedFurnitureId);
            if (tpl) { w = tpl.w ?? 100; h = tpl.h ?? 100; }
        } else if (this.mode === 'plot') {
             // 修改这里：优先读取 placingSize
             if (this.placingSize) {
                 w = this.placingSize.w;
                 h = this.placingSize.h;
             } else if (this.placingTemplateId) {
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

        // 边界吸附 (Clamping)
        if (this.activePlotId) {
            const plot = GameStore.worldLayout.find(p => p.id === this.activePlotId);
            if (plot) {
                const minX = plot.x;
                const minY = plot.y;
                const maxX = plot.x + (plot.width || 300) - w;
                const maxY = plot.y + (plot.height || 300) - h;
                finalX = Math.max(minX, Math.min(finalX, maxX));
                finalY = Math.max(minY, Math.min(finalY, maxY));
            }
        }
        this.previewPos = { x: finalX, y: finalY };
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
        // 1. 先获取地皮信息，用于后续计算空间范围
        const plot = GameStore.worldLayout.find(p => p.id === plotId);
        
        // 2. 从世界布局中移除地皮
        GameStore.worldLayout = GameStore.worldLayout.filter(p => p.id !== plotId);
        
        // 3. 移除关联的 HousingUnits (这一步很重要，否则家具的归属权会出错)
        GameStore.housingUnits = GameStore.housingUnits.filter(h => !h.id.startsWith(`${plotId}_`));

        // 4. 移除房间 (包括模版自带的和空间范围内的自定义房间)
        GameStore.rooms = GameStore.rooms.filter(r => {
            // A. 移除模版自带房间 (ID 以 plotId_ 开头)
            if (r.id.startsWith(`${plotId}_`)) return false;
            
            // B. 移除位于该地皮范围内的自定义房间
            if (plot) {
                const pw = plot.width || 300;
                const ph = plot.height || 300;
                // 简单的包含检测
                if (r.x >= plot.x && r.x < plot.x + pw && r.y >= plot.y && r.y < plot.y + ph) {
                    return false;
                }
            }
            return true;
        }); 

        // 5. ✅ [核心修复] 移除家具
        GameStore.furniture = GameStore.furniture.filter(f => {
            // A. 移除模版自带家具 (ID 以 plotId_ 开头)
            if (f.id.startsWith(`${plotId}_`)) return false;
            
            // B. 移除位于该地皮范围内的自定义家具
            if (plot) {
                const cx = f.x + f.w / 2;
                const cy = f.y + f.h / 2;
                const pw = plot.width || 300;
                const ph = plot.height || 300;
                // 检测家具中心点是否在地皮内
                if (cx >= plot.x && cx < plot.x + pw && cy >= plot.y && cy < plot.y + ph) {
                    return false;
                }
            }
            return true;
        });

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
        
        // 1. 移动地皮：采用 "销毁 -> 重建" 策略，确保绝对稳健
        if (entityType === 'plot') {
            const plot = GameStore.worldLayout.find(p => p.id === id);
            // 只有坐标真正发生变化时才执行
            if (plot && (plot.x !== x || plot.y !== y)) {
                // A. 更新 Plot 自身坐标
                plot.x = x; 
                plot.y = y; 
                GameStore.rooms = GameStore.rooms.filter(r => !r.id.startsWith(`${id}_`));
                 GameStore.furniture = GameStore.furniture.filter(f => !f.id.startsWith(`${id}_`));
                 GameStore.housingUnits = GameStore.housingUnits.filter(h => !h.id.startsWith(`${id}_`));
                 GameStore.instantiatePlot(plot);
                 GameStore.triggerMapUpdate();
            }
        } 
        else if (entityType === 'furniture') {
            const f = GameStore.furniture.find(i => i.id === id);
            if (f) { f.x = x; f.y = y; GameStore.triggerMapUpdate(); }
        }
        else if (entityType === 'room') {
            const r = GameStore.rooms.find(i => i.id === id);
            if (r) { r.x = x; r.y = y; GameStore.triggerMapUpdate(); }
        }
        this.isDragging = false;
        this.interactionState = 'idle';
        this.previewPos = null;

        GameStore.initIndex();
        GameStore.refreshFurnitureOwnership();
        GameStore.notify();
    }
    
    recordAction(action: EditorAction) {}
    undo() {}
    redo() {}
}