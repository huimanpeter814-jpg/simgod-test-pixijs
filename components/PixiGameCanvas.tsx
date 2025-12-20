import React, { useEffect, useRef, useState } from 'react';
import { Application, Container, Sprite, Graphics, TextureStyle } from 'pixi.js';
import { ASSET_CONFIG, CONFIG } from '../constants';
import { loadGameAssets } from '../utils/assetLoader';
import { GameStore } from '../utils/GameStore';
import { PixiSimView } from '../utils/render/PixiSimView';
import { PixiWorldBuilder } from '../utils/render/PixiWorldBuilder';
import { gameLoopStep } from '../utils/GameLoop';
import { PLOTS } from '../data/plots';

// 全局设置：像素风格
TextureStyle.defaultOptions.scaleMode = 'nearest';

const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

// --- 辅助：绘制4个角的缩放手柄 (Pixi Graphics 版本) ---
const drawPixiResizeHandles = (g: Graphics, x: number, y: number, w: number, h: number, zoom: number) => {
    const handleSize = 10 / zoom;
    const half = handleSize / 2;

    const corners = [
        { x: x - half, y: y - half }, // NW
        { x: x + w - half, y: y - half }, // NE
        { x: x - half, y: y + h - half }, // SW
        { x: x + w - half, y: y + h - half } // SE
    ];

    corners.forEach(c => {
        g.rect(c.x, c.y, handleSize, handleSize);
        
        // [修改] 在绘制命令中直接指定样式
        g.fill('white'); 
        g.stroke({ width: 1 / zoom, color: 'black' });
    });
};

const PixiGameCanvasComponent: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const worldContainerRef = useRef<Container | null>(null); // 替代 Viewport
    
    // 实体管理 (Pixi 对象缓存)
    const simViewsRef = useRef<Map<string, PixiSimView>>(new Map());
    const furnViewsRef = useRef<Map<string, Container>>(new Map());
    const roomViewsRef = useRef<Map<string, Graphics>>(new Map());

    // 编辑器图层 (Pixi Graphics)
    const gridLayerRef = useRef<Graphics | null>(null);
    const uiLayerRef = useRef<Container | null>(null);
    const ghostLayerRef = useRef<Container | null>(null);

    // 交互状态
    const lastMousePos = useRef({ x: 0, y: 0 });
    const dragStartMousePos = useRef({ x: 0, y: 0 });
    const dragStartPos = useRef({ x: 0, y: 0 });
    const isDraggingObject = useRef(false);
    const isStickyDragging = useRef(false);
    const isResizing = useRef(false);
    const isPanning = useRef(false); // 手动漫游状态
    const activeResizeHandle = useRef<string | null>(null);
    const resizeStartRect = useRef({ x: 0, y: 0, w: 0, h: 0 });
    const panStartPos = useRef({ x: 0, y: 0 }); // 漫游起始位置

    const [loading, setLoading] = useState(true);
    const [showInstructions, setShowInstructions] = useState(false);
    const prevModeRef = useRef(GameStore.editor.mode);
    
    const [editorRefresh, setEditorRefresh] = useState(() => GameStore.mapVersion);

    // === 辅助：坐标转换 (屏幕 -> 世界) ===
    const screenToWorld = (x: number, y: number) => {
        if (!worldContainerRef.current) return { x: 0, y: 0 };
        const world = worldContainerRef.current;
        return {
            x: (x - world.x) / world.scale.x,
            y: (y - world.y) / world.scale.y
        };
    };

    // === 核心：世界重建 (当建筑/家具变化时) ===
    const refreshWorld = () => {
        if (!worldContainerRef.current) return;
        const world = worldContainerRef.current;

        // 1. 清理旧对象
        furnViewsRef.current.forEach(v => { world.removeChild(v); v.destroy({ children: true }); }); 
        furnViewsRef.current.clear();
        
        roomViewsRef.current.forEach(v => { world.removeChild(v); v.destroy(); }); 
        roomViewsRef.current.clear();
        
        // 2. 重绘房间 (层级 -100)
        GameStore.rooms.forEach(room => {
            const g = PixiWorldBuilder.createRoom(room);
            g.zIndex = -100; // 地板永远在最下层
            world.addChild(g);
            roomViewsRef.current.set(room.id, g);
        });

        // 3. 重绘家具 (层级 0 ~ 10000，基于 Y 轴)
        GameStore.furniture.forEach(furn => {
            const c = PixiWorldBuilder.createFurniture(furn);
            // 确保家具层级正确：Y 越大层级越高
            c.zIndex = furn.y + furn.h; 
            world.addChild(c);
            furnViewsRef.current.set(furn.id, c);
        });
        
        world.sortChildren();
    };

    // 监听外部触发的编辑器刷新
    useEffect(() => {
        if (!loading && worldContainerRef.current) {
            refreshWorld();
        }
    }, [editorRefresh, loading]);

    // === 核心：编辑器 UI 更新 (Grid, Ghost, SelectionBox) ===
    const updateEditorVisuals = () => {
        if (!gridLayerRef.current || !uiLayerRef.current || !ghostLayerRef.current || !worldContainerRef.current) return;
        const grid = gridLayerRef.current;
        const ui = uiLayerRef.current;
        const ghost = ghostLayerRef.current;

        grid.clear(); 
        ui.removeChildren(); 
        ghost.removeChildren();

        if (GameStore.editor.mode === 'none') {
            setShowInstructions(false);
            return;
        }

        const zoom = worldContainerRef.current.scale.x;
        
        // 1. 绘制网格
        if (zoom > 0.4) {
            const w = CONFIG.CANVAS_W; 
            const h = CONFIG.CANVAS_H;
            
            // 构建路径
            for (let x = 0; x <= w; x += 50) { grid.moveTo(x, 0); grid.lineTo(x, h); }
            for (let y = 0; y <= h; y += 50) { grid.moveTo(0, y); grid.lineTo(w, y); }
            
            // [修改] 在 stroke 中传入样式对象
            grid.stroke({ 
                width: 1 / zoom, 
                color: 'rgba(255, 255, 255, 0.1)' 
            });
        }

        // 2. 绘制选中框 (Selection Box)
        const drawBox = (x: number, y: number, w: number, h: number, color: number) => {
            const g = new Graphics();
            g.rect(x, y, w, h).stroke({ width: 2 / zoom, color });
            ui.addChild(g);
            
            // 如果不是相机工具，绘制调整手柄
            // @ts-ignore
            if (GameStore.editor.activeTool !== 'camera') {
                drawPixiResizeHandles(g, x, y, w, h, zoom);
            }
        };

        if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
            const p = GameStore.worldLayout.find(i => i.id === GameStore.editor.selectedPlotId);
            if (p) {
                const w = p.width || (PLOTS[p.templateId]?.width || 300);
                const h = p.height || (PLOTS[p.templateId]?.height || 300);
                drawBox(p.x, p.y, w, h, 0x00ffff);
            }
        } else if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId) {
            const f = GameStore.furniture.find(i => i.id === GameStore.editor.selectedFurnitureId);
            if (f) drawBox(f.x, f.y, f.w || 50, f.h || 50, 0xffff00);
        } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
            const r = GameStore.rooms.find(i => i.id === GameStore.editor.selectedRoomId);
            if (r) drawBox(r.x, r.y, r.w, r.h, 0x39ff14);
        }

        // 3. 绘制预览幽灵 (Ghost / Placement Preview)
        const isPlacing = !!(GameStore.editor.placingTemplateId || GameStore.editor.placingFurniture);
        
        if (GameStore.editor.previewPos && (isDraggingObject.current || isStickyDragging.current || isPlacing)) {
            const { x, y } = GameStore.editor.previewPos;
            let w = 100, h = 100;
            
            if (GameStore.editor.mode === 'furniture') {
                const f = GameStore.editor.placingFurniture || GameStore.furniture.find(i => i.id === GameStore.editor.selectedFurnitureId);
                if (f) { w = f.w || 50; h = f.h || 50; }
            } else if (GameStore.editor.mode === 'plot') {
                if (GameStore.editor.placingTemplateId) {
                    const tpl = PLOTS[GameStore.editor.placingTemplateId];
                    if (tpl) { w = tpl.width; h = tpl.height; }
                } else if (GameStore.editor.selectedPlotId) {
                    const p = GameStore.worldLayout.find(i => i.id === GameStore.editor.selectedPlotId);
                    if (p) { w = p.width || 300; h = p.height || 300; }
                }
            } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                const r = GameStore.rooms.find(i => i.id === GameStore.editor.selectedRoomId);
                if (r) { w = r.w; h = r.h; }
            }

            const g = new Graphics();
            g.rect(x, y, w, h).fill({ color: 0xffffff, alpha: 0.3 }).stroke({ width: 2, color: 0xffff00 });
            
            if (isPlacing) {
                g.circle(x + w/2, y + h/2, 4).fill(0xff0000);
            }
            
            ghost.addChild(g);
        }
        
        // 4. 绘制框选预览 (Drawing Box)
        if (isDraggingObject.current) {
            let drawRect: { x1: number; y1: number; x2: number; y2: number } | null = null;
            if (GameStore.editor.drawingFloor) {
                const d = GameStore.editor.drawingFloor;
                drawRect = { x1: d.startX, y1: d.startY, x2: d.currX, y2: d.currY };
            } else if (GameStore.editor.drawingPlot) {
                const d = GameStore.editor.drawingPlot;
                drawRect = { x1: d.startX, y1: d.startY, x2: d.currX, y2: d.currY };
            }

            if (drawRect) {
                const x = Math.min(drawRect.x1, drawRect.x2);
                const y = Math.min(drawRect.y1, drawRect.y2);
                const w = Math.abs(drawRect.x2 - drawRect.x1);
                const h = Math.abs(drawRect.y2 - drawRect.y1);
                
                const g = new Graphics();
                g.rect(x, y, w, h).fill({ color: 0xffffff, alpha: 0.2 }).stroke({ width: 2, color: 0xffff00 });
                ghost.addChild(g);
            }
        }
    };

    // === 核心：初始化与游戏循环 ===
    useEffect(() => {
        const initGameLoop = async () => {
            if (!containerRef.current) return;
            
            // 1. 初始化 Pixi App
            const app = new Application();
            await app.init({
                background: '#121212', 
                resizeTo: containerRef.current, 
                antialias: false, 
                roundPixels: true,
                resolution: 1, 
                autoDensity: true,
                preference: 'webgl',
            });
            containerRef.current.appendChild(app.canvas);
            appRef.current = app;

            // 2. 创建世界容器 (World Container) - 替代 pixi-viewport
            const worldContainer = new Container();
            worldContainer.sortableChildren = true;
            app.stage.addChild(worldContainer);
            worldContainerRef.current = worldContainer;
            
            // 3. 加载资源
            await loadGameAssets([
                ...ASSET_CONFIG.bg,
                ...ASSET_CONFIG.bodies,
                ...ASSET_CONFIG.outfits,
                ...ASSET_CONFIG.hairs,
                ...(ASSET_CONFIG.face || []),
                ...(ASSET_CONFIG.clothes || []),
                ...(ASSET_CONFIG.pants || [])
            ]);
            
            setLoading(false);

            // 4. 静态背景
            const bgPath = ASSET_CONFIG.bg[0];
            if (bgPath) {
                const bg = Sprite.from(bgPath);
                bg.width = CONFIG.CANVAS_W; 
                bg.height = CONFIG.CANVAS_H; 
                bg.zIndex = -99999; 
                bg.eventMode = 'none';
                worldContainer.addChild(bg);
            }
            
            // 5. 编辑器图层
            const gridL = new Graphics(); gridL.zIndex = 999999; worldContainer.addChild(gridL); gridLayerRef.current = gridL;
            const ghostL = new Container(); ghostL.zIndex = 999999; worldContainer.addChild(ghostL); ghostLayerRef.current = ghostL;
            const uiL = new Container(); uiL.zIndex = 999999; worldContainer.addChild(uiL); uiLayerRef.current = uiL;

            // 6. 初始世界渲染
            refreshWorld();
            // 初始居中
            const initialScale = 0.8;
            worldContainer.scale.set(initialScale);
            worldContainer.x = (app.screen.width - CONFIG.CANVAS_W * initialScale) / 2;
            worldContainer.y = (app.screen.height - CONFIG.CANVAS_H * initialScale) / 2;

            // 7. 启动游戏循环
            app.ticker.add((ticker) => {
                const dt = ticker.deltaTime;
                
                // A. 逻辑步进
                gameLoopStep(dt);

                // B. 摄像机跟随 (当没有操作且有选中市民时)
                if (GameStore.selectedSimId && GameStore.editor.mode === 'none' && !isDraggingObject.current && !isPanning.current) {
                    const sim = GameStore.sims.find(s => s.id === GameStore.selectedSimId);
                    if (sim) {
                        const scale = worldContainer.scale.x;
                        const targetX = app.screen.width / 2 - sim.pos.x * scale;
                        const targetY = app.screen.height / 2 - sim.pos.y * scale;
                        
                        worldContainer.x = lerp(worldContainer.x, targetX, 0.1);
                        worldContainer.y = lerp(worldContainer.y, targetY, 0.1);
                    }
                }

                // C. 市民渲染
                const activeIds = new Set<string>();
                const SIM_LAYER_OFFSET = 50000;

                GameStore.sims.forEach(sim => {
                    activeIds.add(sim.id);
                    let view = simViewsRef.current.get(sim.id);
                    
                    if (!view) {
                        view = new PixiSimView(sim);
                        worldContainer.addChild(view.container as any); 
                        simViewsRef.current.set(sim.id, view);
                    }
                    
                    view.updatePosition(sim);
                    view.showSelectionRing(GameStore.selectedSimId === sim.id);
                    
                    if (GameStore.selectedSimId === sim.id) {
                        view.container.alpha = 1; 
                        view.container.scale.set(1.0); 
                        view.container.zIndex = SIM_LAYER_OFFSET + 99999; 
                    } else {
                        view.container.alpha = 1; 
                        view.container.scale.set(0.8); 
                        view.container.zIndex = SIM_LAYER_OFFSET + sim.pos.y; 
                    }
                });

                simViewsRef.current.forEach((v, id) => { 
                    if (!activeIds.has(id)) { 
                        worldContainer.removeChild(v.container as any); 
                        v.destroy(); 
                        simViewsRef.current.delete(id); 
                    }
                });

                updateEditorVisuals();
            });
        };

        initGameLoop();

        return () => { 
            if (appRef.current) { 
                appRef.current.destroy({ removeView: true }); 
                appRef.current = null; 
            } 
        };
    }, []);

    // 监听 GameStore 变化
    useEffect(() => {
        if (GameStore.mapVersion !== editorRefresh) {
            setEditorRefresh(GameStore.mapVersion);
        }

        const unsub = GameStore.subscribe(() => {
            if (prevModeRef.current === 'none' && GameStore.editor.mode !== 'none') {
                setShowInstructions(true);
            }
            prevModeRef.current = GameStore.editor.mode;
            
            if (GameStore.mapVersion !== editorRefresh) {
                setEditorRefresh(GameStore.mapVersion);
            }
        });
        return unsub;
    }, [editorRefresh]);

    // === 手动交互事件处理 ===
    const handleWheel = (e: React.WheelEvent) => {
        if (!worldContainerRef.current) return;
        const world = worldContainerRef.current;
        
        const scaleFactor = 1.1;
        const direction = e.deltaY > 0 ? 1 / scaleFactor : scaleFactor;
        
        // 计算缩放前的鼠标在世界中的位置
        const mouseX = e.clientX - containerRef.current!.getBoundingClientRect().left;
        const mouseY = e.clientY - containerRef.current!.getBoundingClientRect().top;
        
        const worldMouseX = (mouseX - world.x) / world.scale.x;
        const worldMouseY = (mouseY - world.y) / world.scale.y;
        
        // 应用新的缩放
        let newScale = world.scale.x * direction;
        newScale = Math.max(0.1, Math.min(newScale, 4.0)); // 限制缩放范围
        world.scale.set(newScale);
        
        // 调整位置以保持鼠标下的点不变
        world.x = mouseX - worldMouseX * newScale;
        world.y = mouseY - worldMouseY * newScale;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!worldContainerRef.current || e.button !== 0) return;
        
        const rect = containerRef.current!.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        const pt = screenToWorld(clientX, clientY);
        const wX = pt.x, wY = pt.y;
        
        lastMousePos.current = { x: clientX, y: clientY };
        dragStartMousePos.current = { x: clientX, y: clientY };
        
        // 1. 检查是否在放置模式
        const isPlacing = !!(GameStore.editor.placingTemplateId || GameStore.editor.placingFurniture);

        if (isStickyDragging.current || isPlacing) {
            GameStore.editor.isDragging = false;
            const p = GameStore.editor.previewPos || {x:0, y:0};
            
            if (GameStore.editor.placingTemplateId) GameStore.placePlot(p.x, p.y);
            else if (GameStore.editor.placingFurniture) GameStore.placeFurniture(p.x, p.y);
            else if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) GameStore.finalizeMove('plot', GameStore.editor.selectedPlotId, dragStartPos.current);
            else if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId) GameStore.finalizeMove('furniture', GameStore.editor.selectedFurnitureId, dragStartPos.current);
            else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) GameStore.finalizeMove('room', GameStore.editor.selectedRoomId, dragStartPos.current);
            
            isStickyDragging.current = false; 
            isDraggingObject.current = false;
            GameStore.notify();
            return;
        }

        // 2. Play Mode: Select Sim
        if (GameStore.editor.mode === 'none') {
            const sim = GameStore.sims.find(s => 
                Math.abs(s.pos.x - wX) < 20 && 
                Math.abs(s.pos.y - 20 - wY) < 30
            );
            
            // 如果点到了 Sim，选中它，否则开始漫游
            if (sim) {
                GameStore.selectedSimId = sim.id;
                GameStore.notify();
            } else {
                isPanning.current = true;
                panStartPos.current = { x: worldContainerRef.current.x, y: worldContainerRef.current.y };
            }
            return;
        }

        // 3. 编辑模式：检查缩放手柄或对象点击
        let resizeTarget: { x: number, y: number, w: number, h: number } | null = null;
        if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
            const plot = GameStore.worldLayout.find(p => p.id === GameStore.editor.selectedPlotId);
            if (plot) resizeTarget = { x: plot.x, y: plot.y, w: plot.width || 300, h: plot.height || 300 };
        } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
            const room = GameStore.rooms.find(r => r.id === GameStore.editor.selectedRoomId);
            if (room) resizeTarget = { x: room.x, y: room.y, w: room.w, h: room.h };
        }

        if (resizeTarget) {
            const handleSize = 15 / worldContainerRef.current.scale.x;
            const { x, y, w, h } = resizeTarget;
            if (Math.abs(wX - x) < handleSize && Math.abs(wY - y) < handleSize) activeResizeHandle.current = 'nw';
            else if (Math.abs(wX - (x+w)) < handleSize && Math.abs(wY - y) < handleSize) activeResizeHandle.current = 'ne';
            else if (Math.abs(wX - x) < handleSize && Math.abs(wY - (y+h)) < handleSize) activeResizeHandle.current = 'sw';
            else if (Math.abs(wX - (x+w)) < handleSize && Math.abs(wY - (y+h)) < handleSize) activeResizeHandle.current = 'se';
            
            if (activeResizeHandle.current) {
                isResizing.current = true; 
                resizeStartRect.current = { x, y, w, h }; 
                isDraggingObject.current = true;
                return;
            }
        }

        if (GameStore.editor.drawingFloor || GameStore.editor.drawingPlot) {
            isDraggingObject.current = true;
            const gridX = Math.round(wX / 50) * 50; 
            const gridY = Math.round(wY / 50) * 50;
            if(GameStore.editor.drawingFloor) { GameStore.editor.drawingFloor.startX = gridX; GameStore.editor.drawingFloor.startY = gridY; }
            if(GameStore.editor.drawingPlot) { GameStore.editor.drawingPlot.startX = gridX; GameStore.editor.drawingPlot.startY = gridY; }
            return;
        }

        let hitObj: any = null, hitType = '';
        if (GameStore.editor.mode === 'furniture') {
            hitObj = [...GameStore.furniture].reverse().find(f => wX >= f.x && wX <= f.x+f.w && wY >= f.y && wY <= f.y+f.h);
            hitType = 'furniture';
        } else if (GameStore.editor.mode === 'plot') {
             const r = [...GameStore.rooms].find(r => wX >= r.x && wX <= r.x+r.w && wY >= r.y && wY <= r.y+r.h);
             if (r) { hitObj = GameStore.worldLayout.find(p => r.id.startsWith(p.id)); hitType = 'plot'; }
        } else if (GameStore.editor.mode === 'floor') {
            hitObj = [...GameStore.rooms].reverse().find(r => wX >= r.x && wX <= r.x+r.w && wY >= r.y && wY <= r.y+r.h);
            hitType = 'room';
        }

        if (hitObj) {
            if (hitType === 'plot') GameStore.editor.selectedPlotId = hitObj.id;
            else if (hitType === 'furniture') GameStore.editor.selectedFurnitureId = hitObj.id;
            else if (hitType === 'room') GameStore.editor.selectedRoomId = hitObj.id;
            
            GameStore.editor.isDragging = true; 
            isDraggingObject.current = true;
            GameStore.editor.dragOffset = { x: wX - hitObj.x, y: wY - hitObj.y };
            GameStore.editor.previewPos = { x: hitObj.x, y: hitObj.y };
            dragStartPos.current = { x: hitObj.x, y: hitObj.y };
        } else {
            // 没有点到物体，开始漫游
            if (GameStore.editor.activeTool === 'camera' || !hitObj) {
                isPanning.current = true;
                panStartPos.current = { x: worldContainerRef.current.x, y: worldContainerRef.current.y };
            }
            
            GameStore.editor.selectedPlotId = null; 
            GameStore.editor.selectedFurnitureId = null; 
            GameStore.editor.selectedRoomId = null;
        }
        GameStore.notify();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!worldContainerRef.current) return;
        
        const rect = containerRef.current!.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        const pt = screenToWorld(clientX, clientY);
        const wX = pt.x, wY = pt.y;

        // 处理漫游
        if (isPanning.current) {
            const dx = clientX - lastMousePos.current.x;
            const dy = clientY - lastMousePos.current.y;
            worldContainerRef.current.x += dx;
            worldContainerRef.current.y += dy;
            lastMousePos.current = { x: clientX, y: clientY };
            return;
        }

        if (isResizing.current && activeResizeHandle.current) {
            const startR = resizeStartRect.current; const snap = 50; let newRect = { ...startR };
            if (activeResizeHandle.current.includes('e')) newRect.w = Math.max(50, Math.round((wX - startR.x)/snap)*snap);
            if (activeResizeHandle.current.includes('s')) newRect.h = Math.max(50, Math.round((wY - startR.y)/snap)*snap);
            if (activeResizeHandle.current.includes('w')) {
                const right = startR.x + startR.w;
                const newX = Math.round(wX/snap)*snap;
                newRect.w = Math.max(50, right - newX);
                newRect.x = right - newRect.w;
            }
            if (activeResizeHandle.current.includes('n')) {
                const bottom = startR.y + startR.h;
                const newY = Math.round(wY/snap)*snap;
                newRect.h = Math.max(50, bottom - newY);
                newRect.y = bottom - newRect.h;
            }

            if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
                GameStore.resizeEntity('plot', GameStore.editor.selectedPlotId, newRect);
            } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                GameStore.resizeEntity('room', GameStore.editor.selectedRoomId, newRect);
            }
            return;
        }

        if (isDraggingObject.current && (GameStore.editor.drawingFloor || GameStore.editor.drawingPlot)) {
            const gridX = Math.round(wX / 50) * 50; const gridY = Math.round(wY / 50) * 50;
            if(GameStore.editor.drawingFloor) { GameStore.editor.drawingFloor.currX = gridX; GameStore.editor.drawingFloor.currY = gridY; }
            if(GameStore.editor.drawingPlot) { GameStore.editor.drawingPlot.currX = gridX; GameStore.editor.drawingPlot.currY = gridY; }
            return;
        }

        if (GameStore.editor.mode !== 'none' && (GameStore.editor.isDragging || isStickyDragging.current)) {
            const gridSize = 10;
            const rx = wX - GameStore.editor.dragOffset.x; const ry = wY - GameStore.editor.dragOffset.y;
            GameStore.editor.previewPos = { x: Math.round(rx/gridSize)*gridSize, y: Math.round(ry/gridSize)*gridSize };
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (!worldContainerRef.current) return;
        const rect = containerRef.current!.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        const dist = Math.sqrt(Math.pow(clientX - dragStartMousePos.current.x, 2) + Math.pow(clientY - dragStartMousePos.current.y, 2));
        const isClick = dist < 10;
        
        isDraggingObject.current = false; 
        isResizing.current = false; 
        isPanning.current = false;
        activeResizeHandle.current = null;

        if (GameStore.editor.drawingFloor || GameStore.editor.drawingPlot) {
             if (GameStore.editor.drawingFloor) {
                 const d = GameStore.editor.drawingFloor;
                 const x = Math.min(d.startX, d.currX), y = Math.min(d.startY, d.currY);
                 const w = Math.abs(d.currX - d.startX), h = Math.abs(d.currY - d.startY);
                 if (w>=50 && h>=50) GameStore.createCustomRoom({x,y,w,h}, d.pattern, d.color, d.label, d.hasWall);
                 GameStore.editor.drawingFloor = null;
             }
             if (GameStore.editor.drawingPlot) {
                 const d = GameStore.editor.drawingPlot;
                 const x = Math.min(d.startX, d.currX), y = Math.min(d.startY, d.currY);
                 const w = Math.abs(d.currX - d.startX), h = Math.abs(d.currY - d.startY);
                 if (w>=50 && h>=50) GameStore.createCustomPlot({x,y,w,h}, d.templateId);
                 GameStore.editor.drawingPlot = null;
             }
             refreshWorld(); return;
        }

        if (GameStore.editor.mode !== 'none' && GameStore.editor.isDragging) {
            if (isClick && !isStickyDragging.current && !GameStore.editor.placingTemplateId && !GameStore.editor.placingFurniture) {
                isStickyDragging.current = true; 
                return;
            }
            if (!isClick && !isStickyDragging.current) {
                GameStore.editor.isDragging = false;
                const p = GameStore.editor.previewPos || {x:0,y:0};
                if (GameStore.editor.selectedFurnitureId) GameStore.finalizeMove('furniture', GameStore.editor.selectedFurnitureId, dragStartPos.current);
                if (GameStore.editor.selectedPlotId) GameStore.finalizeMove('plot', GameStore.editor.selectedPlotId, dragStartPos.current);
                if (GameStore.editor.selectedRoomId) GameStore.finalizeMove('room', GameStore.editor.selectedRoomId, dragStartPos.current);
                refreshWorld();
            }
        }
    };

    return (
        <div 
            ref={containerRef} 
            className="relative w-full h-full overflow-hidden bg-[#121212]" 
            onWheel={handleWheel}
            onMouseDown={handleMouseDown} 
            onMouseMove={handleMouseMove} 
            onMouseUp={handleMouseUp} 
            onMouseLeave={() => { isDraggingObject.current = false; isPanning.current = false; }}
            onContextMenu={e => e.preventDefault()}
        >
            {loading && <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80 z-50">LOADING ASSETS...</div>}
            
            {GameStore.editor.mode !== 'none' && showInstructions && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none bg-black/60 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-lg z-20 border border-white/10">
                    <button 
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => setShowInstructions(false)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] pointer-events-auto shadow-md transition-colors border border-white/20 z-30 cursor-pointer"
                        title="关闭指引"
                    >
                        ✕
                    </button>
                    <div className="font-bold text-warning border-b border-white/20 pb-1 mb-1 w-full text-center">
                        编辑模式指引
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10px]">
                        <div className="flex items-center gap-2"><span className="text-xl">🖱️</span> <span>单击物体: 拿起 / 再次点击放置</span></div>
                        <div className="flex items-center gap-2"><span className="text-xl">🔄</span> <span>R 键: 旋转物体</span></div>
                        <div className="flex items-center gap-2"><span className="text-xl">✋</span> <span>漫游: 拖拽移动视角</span></div>
                        <div className="flex items-center gap-2"><span className="text-xl">⌨️</span> <span>Delete键: 删除选中物体</span></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(PixiGameCanvasComponent);