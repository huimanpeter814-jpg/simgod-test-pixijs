import { GameStore } from '../utils/GameStore';
import { PLOTS } from '../data/plots';
import { Furniture, WorldPlot, RoomDef, EditorAction, EditorState } from '../types';
import { WORLD_SURFACE_ITEMS } from '../data/furnitureData';
import { getTexture, getSmartFootprintWidth } from '../utils/assetLoader'; 
import { Texture } from 'pixi.js';

export class EditorManager implements EditorState {
    mode: 'none' | 'plot' | 'furniture' | 'floor' = 'none';
    activeTool: 'camera' | 'select' = 'select';

    activePlotId: string | null = null;

    gridSize: number = 12; 
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
    placingData: any = null;
    
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
        GameStore.togglePause(true);

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

        if (!this.snapshot) {
            this.snapshot = {
                worldLayout: JSON.parse(JSON.stringify(GameStore.worldLayout)),
                furniture: JSON.parse(JSON.stringify(GameStore.furniture)),
                rooms: JSON.parse(JSON.stringify(GameStore.rooms.filter(r => r.isCustom))) 
            };
        }

        // 确保游戏暂停 (防止装修时 Sims 乱跑)
        GameStore.togglePause(true); 

        this.activePlotId = plotId;
        this.selectedPlotId = null; 
        this.mode = 'furniture'; 
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
        this.history = []; // 清空历史
        this.redoStack = [];
        this.resetState();
        this.mode = 'none'; 
        this.activePlotId = null;
        GameStore.togglePause(false);
        GameStore.initIndex(); 
        GameStore.refreshFurnitureOwnership();
        GameStore.sendUpdateMap();
        GameStore.notify();
    }


    cancelChanges() {
        if (this.snapshot) {
            // 1. 恢复世界布局
            GameStore.worldLayout = JSON.parse(JSON.stringify(this.snapshot.worldLayout));
            
            // 2. 重建基础结构 (家具和房间会被覆盖，但 HousingUnits 会重建)
            GameStore.rebuildWorld(true);
            
            // 3. 恢复家具 (覆盖 rebuildWorld 生成的默认家具)
            GameStore.furniture = JSON.parse(JSON.stringify(this.snapshot.furniture));
            
            // 4. 恢复房间
            const defaultRooms = GameStore.rooms.filter(r => !r.isCustom);
            const customRooms = this.snapshot.rooms || [];
            GameStore.rooms = [...defaultRooms, ...customRooms];

            // 5. 重新计算归属
            GameStore.refreshFurnitureOwnership();

            // 🟢 [关键修复] 立即强制同步给 Worker，防止 Worker 用旧数据覆盖回来
            GameStore.sendUpdateMap();
        }

        this.snapshot = null;
        this.history = [];
        this.redoStack = [];
        this.resetState();
        this.mode = 'none';
        this.activePlotId = null;
        
        GameStore.triggerMapUpdate();
    }

    deleteCurrentSelection() {
        // 世界模式 (没有 activePlotId)
        if (!this.activePlotId) {
            if (this.selectedPlotId) {
                // 删除地皮 (原有逻辑)
                const plot = GameStore.worldLayout.find(p => p.id === this.selectedPlotId);
                if (plot) {
                    this.recordAction({ type: 'delete_plot', data: JSON.parse(JSON.stringify(plot)) });
                    this.removePlot(this.selectedPlotId);
                    this.selectedPlotId = null;
                }
            }
            // 🟢 [新增] 允许删除世界家具 (街道设施)
            else if (this.selectedFurnitureId) {
                const f = GameStore.furniture.find(i => i.id === this.selectedFurnitureId);
                if (f) {
                    this.recordAction({ type: 'delete_furniture', data: JSON.parse(JSON.stringify(f)) });
                    this.removeFurniture(this.selectedFurnitureId);
                    this.selectedFurnitureId = null;
                }
            }
        }
        // 建筑模式：只能删家具/房间
        else {
            if (this.selectedFurnitureId) {
                const f = GameStore.furniture.find(i => i.id === this.selectedFurnitureId);
                if (f) {
                    this.recordAction({ type: 'delete_furniture', data: JSON.parse(JSON.stringify(f)) });
                    this.removeFurniture(this.selectedFurnitureId);
                    this.selectedFurnitureId = null;
                }
            }
        }
        GameStore.notify();
    }

    // 1. 优化：检查放置位置是否合法 (简单的 AABB 碰撞检测)
    checkPlacementValidity(x: number, y: number, w: number, h: number): boolean {
        const targetItem = this.placingFurniture; // 当前正在放置的物品
        const isSurfaceItem = targetItem?.placementLayer === 'surface'; // 它是不是像电脑这样放在桌上的？
       // 1. 基础边界检查 (不能跑出地图/地皮)
        if (this.activePlotId) {
            const plot = GameStore.worldLayout.find(p => p.id === this.activePlotId);
            if (!plot) return false;
            const plotRight = plot.x + (plot.width || 288);
            const plotBottom = plot.y + (plot.height || 288);
            if (x < plot.x || y < plot.y || x + w > plotRight || y + h > plotBottom) {
                return false; 
            }
        }

        // 2. ✨ 碰撞与层级检查 ✨
        // 我们需要遍历所有已存在的家具，看是否冲突
        const allFurniture = GameStore.furniture;
        
        // 获取当前物体的包围盒 (AABB)
        const rect1 = { x: x, y: y, w: w, h: h };

        // 标记：如果这是个放在桌上的物品，我们需要确保下面真的有桌子
        let supportedBySurface = false; 

        for (const other of allFurniture) {
            // 忽略自己
            if (targetItem && other.id === targetItem.id) continue;
            // 忽略不同地皮的 (如果在装修模式)
            if (this.activePlotId && !other.id.startsWith(this.activePlotId)) continue;

            const rect2 = { x: other.x, y: other.y, w: other.w, h: other.h };

            // 简单的 AABB 碰撞检测
            const isOverlapping = (
                rect1.x < rect2.x + rect2.w &&
                rect1.x + rect1.w > rect2.x &&
                rect1.y < rect2.y + rect2.h &&
                rect1.y + rect1.h > rect2.y
            );

            if (isOverlapping) {
                // Case A: 正在放置的是【桌上物品】 (电脑)
                if (isSurfaceItem) {
                    if (other.isSurface) {
                        // 碰到了桌子 -> 合法，且被支持了
                        // 进阶：你可以在这里判断 rect1 是否完全包含在 rect2 内部
                        supportedBySurface = true; 
                        continue; // 允许重叠，继续检查其他物体
                    } else {
                        // 碰到了其他东西 (比如碰到了另一台电脑，或者碰到了墙) -> 禁止
                        // 除非你允许桌上的东西互相堆叠，否则这里应该 return false
                        if (other.placementLayer === 'surface') return false; 
                    }
                } 
                
                // Case B: 正在放置的是【普通物品/桌子】
                else {
                    // 如果碰到了桌上物品 (比如桌子移到了电脑下面) -> 理论上允许，但逻辑比较绕
                    // 这里简化：普通物品不能和任何东西重叠
                    return false;
                }
            }
        }

        // 3. 最终判定
        if (isSurfaceItem) {
            // 如果是电脑，必须放在桌子上 (supportedBySurface 必须为 true)
            return supportedBySurface;
        }

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
        this.placingData = null;
    }


    clearMap() {
        if (this.mode === 'none') return;
        if (!confirm('确定要清空所有地皮和家具吗？')) return;
        
        // 记录一个全清前的状态用于撤销（可选，这里为了简单先不加）
        GameStore.worldLayout = [];
        GameStore.furniture = []; 
        GameStore.rooms = [];
        GameStore.housingUnits = [];
        GameStore.initIndex();
        
        // 🟢 [修复] 必须同步 Worker
        GameStore.sendUpdateMap();
        GameStore.triggerMapUpdate(); 
    }

    // 🟢 [修改] startPlacingPlot 支持传入自定义尺寸
    startPlacingPlot(templateId: string, customSize?: { w: number, h: number }, customType?: string, extraData?: any) {
        if (this.activePlotId) {
            GameStore.showToast("❌ 请先退出装修模式");
            return;
        }
        this.mode = 'plot';
        this.placingTemplateId = templateId;
        this.placingType = customType || null;
        this.placingData = extraData || null;
        
        this.isDragging = true; 
        this.interactionState = 'carrying';
        
        let w = 288, h = 288;
        
        // 🟢 [新增] 检查是否为地表素材，如果是，强制使用其定义的尺寸
        const surfaceItem = WORLD_SURFACE_ITEMS.find(i => i.id === templateId);
        if (surfaceItem) {
            w = surfaceItem.w;
            h = surfaceItem.h;
            this.placingSize = { w, h }; // 记录尺寸，这很关键
            // 自动标记类型，防止 UI 层漏传
            if (!this.placingType) this.placingType = 'surface'; 
        }
        // [原有逻辑] 优先使用传入的自定义尺寸
        else if (customSize) {
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
        // 🟢 [新逻辑] 自动推断尺寸
        // 如果数据里没写 w，就去读图集的实际宽度；如果还没加载到图，就兜底为 48
        // 如果数据里没写 h，就默认设为 48 (如你所愿)
        
        let autoW = template.w;
        let autoH = template.h;

        // 1. 尝试自动解析 Width
        if (autoW === undefined) {
            let tex: Texture | null = null;
            if (template.frameName) tex = getTexture(template.frameName);
            else if (template.imagePath) tex = getTexture(template.imagePath);

            if (tex && tex !== Texture.EMPTY) {
                // 🟢 改用智能计算，只算底部 25% 的区域
                autoW = getSmartFootprintWidth(tex, 0.25);
            }
        }

        // 2. 兜底默认值
        // 如果上面没取到 (比如资源还没加载完)，或者本来就没配，就用默认值
        const finalW = autoW || 48; 
        const finalH = autoH || 48; // 这里实现了你的需求：默认为 48

        this.placingType = null; 
        this.placingTemplateId = null; 
        this.placingSize = null;
        
        this.mode = 'furniture';
        
        // 🟢 将计算好的宽高合并进去
        this.placingFurniture = { 
            ...template, 
            w: finalW,
            h: finalH,
            rotation: 0 
        };
        
        this.isDragging = true;
        this.interactionState = 'carrying';
        // 更新拖拽中心点 (让鼠标要在物体的中心)
        this.dragOffset = { x: finalW / 2, y: finalH / 2 };
        
        if (!this.activePlotId) {
            GameStore.showToast("🌍 正在世界地图上放置物件");
        }
        
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
        // 1. 获取当前正在操作的对象（无论是正在放置的，还是已选中的）
        let target: Partial<Furniture> | Furniture | null = this.placingFurniture;
        if (!target && this.selectedFurnitureId) {
            target = GameStore.furniture.find(i => i.id === this.selectedFurnitureId) || null;
        }
    
        if (!target) return;
    
        // 2. 记录旋转前的状态
        const oldRot = target.rotation || 0;
        const oldW = target.w || 48; // 旋转前的逻辑宽度
        const oldH = target.h || 48; // 旋转前的逻辑高度/进深

        // 3. 计算新方向 (0->1->2->3)
        const newRot = (oldRot + 1) % 4;
        target.rotation = newRot;
    
        // 4. ✨ 核心修改：基于图片自动调整 W，基于逻辑自动调整 H ✨
        let textureFound = false;
    
        // 检查是否有方向性贴图配置 (frameDirs)
        if (target.frameDirs && target.frameDirs[newRot]) {
            const frameName = target.frameDirs[newRot];
            const tex = getTexture(frameName);
            
            // 确保图片已加载且有效
            if (tex && tex !== Texture.EMPTY) {
                // ✅ 宽度 (w): 直接使用新图片的宽度
                // 这解决了“图片对不上”的问题，无论图片多宽，包围盒都会自动适配
                target.w = getSmartFootprintWidth(tex, 0.25);

                // ✅ 高度 (h): 这里的 h 指的是“逻辑进深” (占地面积的 Y 轴长度)
                // 物体旋转90度后，原来的“宽”变成了现在的“深”。
                // 所以我们把旧的 oldW 赋值给新的 h。
                target.h = oldW; 

                // 举例：
                // 电视机原状态(0): 宽100, 深20 (图片宽100)
                // 旋转后(1): 
                //    - 新 w = 图片宽 20 (侧面图)
                //    - 新 h = 旧宽 100 (变成了进深)
                // 这样中心点计算 (x + w/2, y + h/2) 依然准确
                
                textureFound = true;
            }
        }
    
        if (!textureFound) {
            // 兜底方案：如果没有特定方向的图片（比如正方形物体），简单交换宽高
            target.w = oldH;
            target.h = oldW;
        }
    
        // 5. 更新拖拽时的鼠标中心偏移
        // 这一步很重要，否则旋转后鼠标会指在奇怪的地方
        if (this.placingFurniture) {
            this.dragOffset = { x: (target.w || 0) / 2, y: (target.h || 0) / 2 };
        }
    
        // 6. 触发更新
        GameStore.initIndex(); 
        GameStore.triggerMapUpdate(); 
        GameStore.notify();
    }

    placePlot(x: number, y: number) {
        const templateId = this.placingTemplateId || 'default_empty';
        const prefix = templateId.startsWith('road') ? 'road_custom_' : 'plot_';
        const newId = `${prefix}${Date.now()}`;
        let w = 288, h = 288;
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
            customName: this.placingType === 'decor' ? '景观装饰' : /* ... */ undefined,

            // ✨ [新增] 将暂存的贴图数据写入地皮对象
            sheetPath: this.placingData?.sheetPath,
            tileX: this.placingData?.tileX,
            tileY: this.placingData?.tileY,
            tileW: this.placingData?.tileW,
            tileH: this.placingData?.tileH
        };
        GameStore.worldLayout.push(newPlot);
        GameStore.instantiatePlot(newPlot); 
        this.recordAction({ type: 'place_plot', data: newPlot });
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

    // 这种方法不重置 placingTemplateId，允许用户继续画
    tryPaintPlotAt(worldX: number, worldY: number) {
        if (!this.placingTemplateId) return;

        // 1. 确认当前选中的是 Surface 类型
        const isSurface = this.placingType === 'surface' || this.placingTemplateId.startsWith('surface_');
        if (!isSurface) return;

        // 2. 获取固定尺寸
        const surfaceConfig = WORLD_SURFACE_ITEMS.find(i => i.id === this.placingTemplateId);
        const w = surfaceConfig ? surfaceConfig.w : 100;
        const h = surfaceConfig ? surfaceConfig.h : 100;

        // 3. 计算网格吸附坐标
        const stepX = w; 
        const stepY = h; 
        const gridX = Math.floor(worldX / stepX) * stepX;
        const gridY = Math.floor(worldY / stepY) * stepY;

        // 4. 检查该位置是否已经有同类型的地表
        const alreadyExists = GameStore.worldLayout.some(p => 
            p.x === gridX && p.y === gridY && p.customType === 'surface'
        );

        if (alreadyExists) {
            // 4.1 进阶逻辑：如果是不同的材质，应该替换掉旧的
            const existingIndex = GameStore.worldLayout.findIndex(p => p.x === gridX && p.y === gridY && p.customType === 'surface');
            if (existingIndex !== -1) {
                const existingPlot = GameStore.worldLayout[existingIndex];
                // 如果材质一样，就什么都不做
                if (existingPlot.templateId === this.placingTemplateId) return;
                
                // 🟢 [新增] 记录删除旧地表的操作 (为了能撤销回旧地表)
                // 必须深拷贝，因为 splice 会移除它
                this.recordAction({ 
                    type: 'delete_plot', 
                    data: JSON.parse(JSON.stringify(existingPlot)) 
                });

                // 删掉旧的
                GameStore.worldLayout.splice(existingIndex, 1);
            }
        }

        // 5. 创建新的地表 Plot
        const newId = `surface_${gridX}_${gridY}_${Date.now()}`; 
        const newPlot: WorldPlot = {
            id: newId,
            templateId: this.placingTemplateId,
            x: gridX,
            y: gridY,
            width: w, 
            height: h,
            customType: 'surface', 
            customName: surfaceConfig?.label || '地表',
            sheetPath: this.placingData?.sheetPath,
            tileX: this.placingData?.tileX,
            tileY: this.placingData?.tileY,
            tileW: this.placingData?.tileW,
            tileH: this.placingData?.tileH
        };

        GameStore.worldLayout.push(newPlot);
        GameStore.instantiatePlot(newPlot);
        
        // 🟢 [新增] 记录放置新地表的操作
        this.recordAction({ type: 'place_plot', data: newPlot });

        // 6. 触发更新
        GameStore.initIndex();
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
        
        if (!this.isValidPlacement) {
            GameStore.showToast("❌ 这里不能放置物品");
            return;
        }
        // 🟢 [修复] ID 生成逻辑
        let newId = '';
        if (this.activePlotId) {
            // 如果在装修模式，ID 必须包含地皮 ID 前缀，否则无法被选中
            newId = `${this.activePlotId}_furniture_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
        } else {
            // 如果是世界模式（放路灯等），保持原样
            newId = `custom_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
        }

        const newItem = { 
            ...tpl, 
            id: newId, // 使用新生成的 ID
            x: x, 
            y: y,
            rotation: tpl.rotation || 0
        } as Furniture;
        
        GameStore.furniture.push(newItem);
        
        // 🟢 记录操作
        this.recordAction({ type: 'place_furniture', data: newItem });

        GameStore.initIndex();
        GameStore.refreshFurnitureOwnership();
        
        if (!keepPlacing) {
            this.placingFurniture = null; 
            this.isDragging = false; 
            this.interactionState = 'idle';
            this.selectedFurnitureId = newItem.id; 
            // 🟢 [修复] 强制切回选择工具，解决放置后无法点击的问题
            this.activeTool = 'select';
        } else {
             GameStore.showToast("按住 Shift 可连续放置");
        }

        // 同步给 Worker
        GameStore.triggerMapUpdate();
    }

    // 辅助函数：检查某个插槽是否已经被其他家具占用
    private isSlotOccupied(parentId: string, slotIndex: number): boolean {
        return GameStore.furniture.some(f => f.parentId === parentId && f.parentSlotIndex === slotIndex);
    }

    // 辅助函数：计算旋转后的插槽世界坐标
    private calculateSlotPos(parent: Furniture, slot: { x: number, y: number }): { x: number, y: number } {
        const rot = parent.rotation || 0;
        let sx = slot.x;
        let sy = slot.y;

        // parent.w 和 parent.h 是家具*当前状态*（旋转后）的宽高
        // 我们基于当前的宽高进行坐标变换
        
        switch (rot) {
            case 0: // 0度：不变
                return { x: parent.x + sx, y: parent.y + sy };
            
            case 1: // 90度 (顺时针)：原点在右上，x -> y, y -> (w - x)
                // 此时 parent.w 对应原始的 height，parent.h 对应原始的 width
                // 变换公式：新x = 当前宽 - 原y, 新y = 原x
                return { x: parent.x + (parent.w - sy), y: parent.y + sx };
            
            case 2: // 180度：原点在右下，x -> (w - x), y -> (h - y)
                return { x: parent.x + (parent.w - sx), y: parent.y + (parent.h - sy) };
            
            case 3: // 270度 (逆时针90度)：原点在左下
                // 变换公式：新x = 原y, 新y = 当前高 - 原x
                return { x: parent.x + sy, y: parent.y + (parent.h - sx) };
                
            default:
                return { x: parent.x + sx, y: parent.y + sy };
        }
    }

    // 3. 优化：更新预览位置（包含吸附和合法性检查）

    updatePreviewPos(worldX: number, worldY: number) {
        const targetItem = this.placingFurniture;
        const isPlacing = targetItem || this.placingTemplateId;
        
        if (!this.isDragging && !isPlacing) return;

        // --- (A. 获取尺寸 w, h 代码保持不变) ---
        let w = 100, h = 100;
        if (this.mode === 'furniture') {
            if (targetItem) { 
                w = targetItem.w ?? 100; 
                h = targetItem.h ?? 100; 
            } else {
                const existing = GameStore.furniture.find(f => f.id === this.selectedFurnitureId);
                if (existing) { w = existing.w; h = existing.h; }
            }
        } else if (this.mode === 'plot') {
             if (this.placingSize) { w = this.placingSize.w; h = this.placingSize.h; }
             else if (this.placingTemplateId) { const tpl = PLOTS[this.placingTemplateId]; if(tpl){w=tpl.width;h=tpl.height;} }
             else if (this.selectedPlotId) { const p = GameStore.worldLayout.find(x => x.id === this.selectedPlotId); if(p){w=p.width||288;h=p.height||288;} }
        }

        let finalX = worldX;
        let finalY = worldY;

        const isSurface = this.placingType === 'surface' || 
                          (this.placingTemplateId && this.placingTemplateId.startsWith('surface_'));

        if (isSurface) {
            finalX = Math.floor(worldX / w) * w;
            finalY = Math.floor(worldY / h) * h;
        } 
        else {
            // --- (B. 智能插槽吸附逻辑) ---
            let snappedToSlot = false;

            if (targetItem && targetItem.placementLayer === 'surface') {
                targetItem.parentId = undefined;
                targetItem.parentSlotIndex = undefined;

                let bestSlot: { parent: Furniture; index: number; x: number; y: number } | null = null;
                let bestDist = Infinity;

                // 筛选候选家具 (必须是台面，且鼠标在范围内)
                // 🟢 这里不再强制要求 f.slots 存在，只要是 isSurface 即可
                const candidates = GameStore.furniture.filter(f => 
                    f.isSurface && 
                    worldX >= f.x && worldX < f.x + f.w && 
                    worldY >= f.y && worldY < f.y + f.h
                );

                for (const parent of candidates) {
                    
                    // === 分支 1: 手动配置的插槽 (优先级高，适合异形桌) ===
                    if (parent.slots && parent.slots.length > 0) {
                        for (let index = 0; index < parent.slots.length; index++) {
                            const slot = parent.slots[index];
                            // 使用之前的旋转计算函数
                            const { x: slotWorldX, y: slotWorldY } = this.calculateSlotPos(parent, slot);
                            
                            const dx = worldX - slotWorldX;
                            const dy = worldY - slotWorldY;
                            const dist = Math.sqrt(dx*dx + dy*dy);

                            if (dist < 30 && !this.isSlotOccupied(parent.id, index)) {
                                if (dist < bestDist) {
                                    bestDist = dist;
                                    bestSlot = { parent, index, x: slotWorldX, y: slotWorldY };
                                }
                            }
                        }
                    } 
                    // === 分支 2: 自动网格插槽 (适合普通方桌、长桌) ===
                    // 🟢 如果没有手动 slots，则根据宽高自动生成 48x48 的中心点
                    else {
                        // 计算桌子当前的网格列数和行数
                        const cols = Math.floor(parent.w / 48);
                        const rows = Math.floor(parent.h / 48);
                        
                        // 遍历每个格子
                        for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                                // 动态生成索引：行号 * 总列数 + 列号
                                // 这种算法生成的索引是稳定的，只要桌子大小不变
                                const autoIndex = r * cols + c;

                                // 计算该格子的中心点世界坐标
                                // parent.x + 列偏移 + 半个格子偏移
                                const slotWorldX = parent.x + (c * 48) + 24;
                                const slotWorldY = parent.y + (r * 48) + 24;

                                const dx = worldX - slotWorldX;
                                const dy = worldY - slotWorldY;
                                const dist = Math.sqrt(dx*dx + dy*dy);

                                if (dist < 30 && !this.isSlotOccupied(parent.id, autoIndex)) {
                                    if (dist < bestDist) {
                                        bestDist = dist;
                                        bestSlot = { parent, index: autoIndex, x: slotWorldX, y: slotWorldY };
                                    }
                                }
                            }
                        }
                    }
                }

                if (bestSlot) {
                    snappedToSlot = true;
                    targetItem.parentId = bestSlot.parent.id;
                    targetItem.parentSlotIndex = bestSlot.index;
                    
                    finalX = bestSlot.x - w / 2;
                    finalY = bestSlot.y - h / 2;
                    targetItem.x = finalX;
                    targetItem.y = finalY;
                }
            }

            // --- (C. 常规网格吸附) ---
            if (!snappedToSlot) {
                if (targetItem) {
                    targetItem.parentId = undefined;
                    targetItem.parentSlotIndex = undefined;
                }
                let offsetX = this.dragOffset.x;
                let offsetY = this.dragOffset.y;
                if (!this.isDragging && isPlacing) { offsetX = w/2; offsetY = h/2; }

                if (this.snapToGrid) {
                    finalX = Math.round((worldX - offsetX) / this.gridSize) * this.gridSize;
                    finalY = Math.round((worldY - offsetY) / this.gridSize) * this.gridSize;
                } else {
                    finalX = worldX - offsetX;
                    finalY = worldY - offsetY;
                }
            }
        }

        // --- (D. 边界限制) ---
        if (this.activePlotId) {
            const plot = GameStore.worldLayout.find(p => p.id === this.activePlotId);
            if (plot) {
                const minX = plot.x;
                const minY = plot.y;
                const maxX = plot.x + (plot.width || 288) - w;
                const maxY = plot.y + (plot.height || 288) - h;
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
                const pw = plot.width || 288;
                const ph = plot.height || 288;
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
                const pw = plot.width || 288;
                const ph = plot.height || 288;
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
        
        // 检查是否有变动
        if (x === startPos.x && y === startPos.y) {
            this.isDragging = false;
            this.interactionState = 'idle';
            this.previewPos = null;
            return;
        }

        // 🟢 记录移动操作
        this.recordAction({
            type: 'move',
            entityType,
            data: { id, x, y },     // 移动后的新位置
            prevData: { id, ...startPos } // 移动前的旧位置
        });
        
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
            if (f) { 
                // A. 计算位移差值
                const dx = x - f.x;
                const dy = y - f.y;

                // B. 更新父物体位置
                f.x = x; 
                f.y = y; 

                // C. ✨[新增] 级联移动：找到所有放在我上面的子物体，同步移动
                const children = GameStore.furniture.filter(child => child.parentId === id);
                children.forEach(child => {
                    child.x += dx;
                    child.y += dy;
                });

                GameStore.triggerMapUpdate(); 
            }
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

    recordAction(action: any) {
        this.history.push(action);
        this.redoStack = []; // 新操作会清空重做栈
        if (this.history.length > 50) this.history.shift(); // 限制步数
    }

    undo() {
        if (this.history.length === 0) return;
        const action = this.history.pop();
        if (!action) return;

        this.redoStack.push(action);

        // 执行反向操作
        switch (action.type) {
            case 'place_furniture':
                // 撤销放置 -> 删除
                if (action.data) this.removeFurniture(action.data.id);
                break;
            case 'delete_furniture':
                // 撤销删除 -> 恢复
                if (action.data) {
                    GameStore.furniture.push(action.data);
                    GameStore.initIndex();
                    GameStore.triggerMapUpdate();
                }
                break;
            case 'place_plot':
                if (action.data) this.removePlot(action.data.id);
                break;
            case 'delete_plot':
                if (action.data) {
                    GameStore.worldLayout.push(action.data);
                    GameStore.instantiatePlot(action.data);
                    GameStore.initIndex();
                    GameStore.triggerMapUpdate();
                }
                break;
            case 'move':
                // 撤销移动 -> 回到旧位置
                // 🟢 [修复] 检查 entityType 和 prevData 是否存在
                if (action.entityType && action.prevData) {
                    this.applyMove(action.entityType, action.prevData.id, action.prevData.x, action.prevData.y);
                }
                break;
        }
        GameStore.notify();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const action = this.redoStack.pop();
        if (!action) return;

        this.history.push(action);

        // 执行正向操作
        switch (action.type) {
            case 'place_furniture':
                GameStore.furniture.push(action.data);
                GameStore.initIndex();
                GameStore.triggerMapUpdate();
                break;
            case 'delete_furniture':
                this.removeFurniture(action.data.id);
                break;
            case 'place_plot':
                GameStore.worldLayout.push(action.data);
                GameStore.instantiatePlot(action.data);
                GameStore.initIndex();
                GameStore.triggerMapUpdate();
                break;
            case 'delete_plot':
                this.removePlot(action.data.id);
                break;
            case 'move':
                if (action.entityType && action.prevData) {
                    this.applyMove(action.entityType, action.prevData.id, action.prevData.x, action.prevData.y);
                }
                break;
        }
        GameStore.notify();
    }

    // 辅助函数：应用移动 (Undo/Redo 时调用)
    private applyMove(type: string, id: string, x: number, y: number) {
        if (type === 'furniture') {
            const f = GameStore.furniture.find(i => i.id === id);
            if (f) { 
                // ✨ 1. 计算位移差值 (目标位置 - 当前位置)
                // 这一点很重要，因为 Undo 传进来的是“绝对坐标 x,y”，
                // 我们需要算出它相对于当前位置移动了多少，才能应用给子物体
                const dx = x - f.x;
                const dy = y - f.y;

                // 2. 移动父物体
                f.x = x; 
                f.y = y; 

                // ✨ 3. 级联移动子物体
                // 找到所有认这个家具为父级的东西，让它们也移动同样的距离
                const children = GameStore.furniture.filter(child => child.parentId === id);
                children.forEach(child => {
                    child.x += dx;
                    child.y += dy;
                });
            }
        } else if (type === 'plot') {
            // 地皮移动需要特殊处理（重建关联物体）
            const plot = GameStore.worldLayout.find(p => p.id === id);
            if (plot) {
                plot.x = x; plot.y = y;
                // 清理并重建
                GameStore.rooms = GameStore.rooms.filter(r => !r.id.startsWith(`${id}_`));
                GameStore.furniture = GameStore.furniture.filter(f => !f.id.startsWith(`${id}_`));
                GameStore.housingUnits = GameStore.housingUnits.filter(h => !h.id.startsWith(`${id}_`));
                GameStore.instantiatePlot(plot);
            }
        }
        
        GameStore.initIndex();
        GameStore.refreshFurnitureOwnership();
        GameStore.triggerMapUpdate();
    }
    
}