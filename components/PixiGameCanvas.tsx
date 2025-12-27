
import React, { useEffect, useRef, useState } from 'react';
import { Application, Container, Sprite, TextureStyle, Graphics, Text } from 'pixi.js';
import { ASSET_CONFIG, CONFIG } from '../constants';
import { loadGameAssets } from '../utils/assetLoader';
import { GameStore } from '../utils/GameStore';
import { PixiSimView } from '../utils/render/PixiSimView';
import { PixiWorldBuilder } from '../utils/render/PixiWorldBuilder';
import { PLOTS } from '../data/plots'; 
import { Furniture } from '../types';

// 全局设置：像素风格缩放 (防止图片模糊)
TextureStyle.defaultOptions.scaleMode = 'nearest';

const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

const PixiGameCanvasComponent: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const worldContainerRef = useRef<Container | null>(null);
    const simLayerRef = useRef<Container | null>(null);
    const editorLayerRef = useRef<Graphics | null>(null);
    const previewLayerRef = useRef<Container | null>(null);
    // [新增] 聚光灯遮罩层
    const spotlightLayerRef = useRef<Graphics | null>(null);
    
    const appRef = useRef<Application | null>(null);
    
    // 缓存引用
    const simViewsRef = useRef<Map<string, PixiSimView>>(new Map());
    const furnViewsRef = useRef<Map<string, Container>>(new Map());
    const roomViewsRef = useRef<Map<string, any>>(new Map());

    // 交互状态
    const isDraggingCamera = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const dragStartMousePos = useRef({ x: 0, y: 0 });
    const dragStartPos = useRef({ x: 0, y: 0 });
    const isCameraLocked = useRef(false);
    const hoveredTarget = useRef<any>(null);

    const isDraggingObject = useRef(false);
    const isStickyDragging = useRef(false);
    const isResizing = useRef(false);
    const activeResizeHandle = useRef<string | null>(null);
    const resizeStartRect = useRef({ x: 0, y: 0, w: 0, h: 0 });

    const [loading, setLoading] = useState(true);
    const [editorRefresh, setEditorRefresh] = useState(0);
    const lastMapVersion = useRef(GameStore.mapVersion || 0);

    const gridLayerRef = useRef<Graphics | null>(null);
    const isSpacePressed = useRef(false);

    // [新增] 专门用于记录地表绘制状态的 ref
    const isPaintingSurface = useRef(false);

    // 绘制缩放手柄辅助函数
    const drawResizeHandles = (g: Graphics, x: number, y: number, w: number, h: number) => {
        const size = 10;
        const half = size / 2;
        g.fillStyle = 0xffffff;
        g.strokeStyle = { width: 1, color: 0x000000 };
        
        const coords = [
            { x: x - half, y: y - half },
            { x: x + w - half, y: y - half },
            { x: x - half, y: y + h - half },
            { x: x + w - half, y: y + h - half }
        ];
        coords.forEach(c => g.rect(c.x, c.y, size, size).fill().stroke());
    };

    // === A. 重建场景 (仅在地图结构变化时) ===
    const refreshWorld = () => {
        if (!worldContainerRef.current) return;
        const world = worldContainerRef.current;

        // 1. 清理旧对象
        furnViewsRef.current.forEach(v => { world.removeChild(v); v.destroy({ children: true }); });
        furnViewsRef.current.clear();
        roomViewsRef.current.forEach(v => { world.removeChild(v); v.destroy(); });
        roomViewsRef.current.clear();

        // 绘制房间
        GameStore.rooms.forEach(room => {
            // 拖拽时隐藏本体
            if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId === room.id && isDraggingObject.current) return;
            // Plot 移动时隐藏内部
            if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId && isDraggingObject.current && room.id.startsWith(GameStore.editor.selectedPlotId)) return;

            const g = PixiWorldBuilder.createRoom(room);
            g.zIndex = -100;
            world.addChild(g);
            roomViewsRef.current.set(room.id, g);
        });

        // 绘制家具
        GameStore.furniture.forEach(furn => {
            if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId === furn.id && isDraggingObject.current) return;
            if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId && furn.id.startsWith(GameStore.editor.selectedPlotId) && isDraggingObject.current) return;

            const c = PixiWorldBuilder.createFurniture(furn);
            c.zIndex = furn.y + furn.h; 
            world.addChild(c);
            furnViewsRef.current.set(furn.id, c);
        });

        world.sortChildren();
    };
    // 绘制 activePlot 的网格
    const drawActivePlotGrid = (g: Graphics, scale: number) => {
        g.clear();
        const activeId = GameStore.editor.activePlotId;
        if (!activeId || !GameStore.editor.showGrid) return;

        const plot = GameStore.worldLayout.find(p => p.id === activeId);
        if (!plot) return;

        const w = plot.width || 300;
        const h = plot.height || 300;
        const gridSize = GameStore.editor.gridSize || 20;

        g.strokeStyle = { width: 1 / scale, color: 0xffffff, alpha: 0.2 }; 
        for (let x = 0; x <= w; x += gridSize) g.moveTo(plot.x + x, plot.y).lineTo(plot.x + x, plot.y + h).stroke();
        for (let y = 0; y <= h; y += gridSize) g.moveTo(plot.x, plot.y + y).lineTo(plot.x + w, plot.y + y).stroke();
        
        // 边界高亮
        g.strokeStyle = { width: 2 / scale, color: 0xffff00, alpha: 0.8 };
        g.rect(plot.x, plot.y, w, h).stroke();
    };

    // === 辅助：绘制网格背景 ===
    const drawGrid = (g: Graphics, width: number, height: number, scale: number) => {
        g.clear();
        if (GameStore.editor.mode === 'none' || !GameStore.editor.showGrid) return;
        
        const gridSize = GameStore.editor.gridSize || 50;
        const alpha = 0.15; // 网格透明度

        const rawStartX = -2000;
        const rawStartY = -2000;
        const endX = CONFIG.CANVAS_W + 1000;
        const endY = CONFIG.CANVAS_H + 1000;
        
        // 优化：只绘制屏幕可见区域的网格，或者绘制一个覆盖全图的大网格
        // 这里为了简单，假设绘制一个足够大的区域
        const startX = Math.floor(rawStartX / gridSize) * gridSize;
        const startY = Math.floor(rawStartY / gridSize) * gridSize;


        g.strokeStyle = { width: 1 / scale, color: 0xffffff, alpha: alpha }; // 线条随缩放变细

        for (let x = startX; x <= endX; x += gridSize) {
            g.moveTo(x, startY).lineTo(x, endY).stroke();
        }
        for (let y = startY; y <= endY; y += gridSize) {
            g.moveTo(startX, y).lineTo(endX, y).stroke();
        }
    };

    // 监听刷新
    useEffect(() => {
        if (!loading && worldContainerRef.current) refreshWorld();
    }, [editorRefresh, loading]);

    // === Web Worker 驱动逻辑 ===
    useEffect(() => {
        
        const worker = new Worker(new URL('../utils/simulationWorker.ts', import.meta.url), { type: 'module' });
        GameStore.worker = worker;
        // 1. ✅ [关键修复] 初始化/重置共享内存 (主线程)
        // 即使 GameStore.sharedBuffer 已经存在(比如React热重载后)，
        // 我们也要调用 initSharedMemory 来重置 availableIndices (索引分配器)，
        // 这样主线程的分配状态才能和新创建的 Worker 保持一致 (Worker 也是刚初始化的)。
        GameStore.initSharedMemory(GameStore.sharedBuffer);

        // 2. ✅ [关键修复] 握手：必须先把内存发给 Worker！
        // 只有 Worker 收到了内存并初始化了 availableIndices，才能开始造人。
        worker.postMessage({ 
            type: 'INIT_SAB', 
            payload: { buffer: GameStore.sharedBuffer } 
        });
        // 3. ✅ [关键修复] 只有在发完内存后，才启动游戏流程
        // initGameFlow 会发送 START_NEW_GAME 或 LOAD_GAME 指令。
        // 由于 postMessage 是有序的，Worker 一定会先处理 INIT_SAB，再处理 START。
        GameStore.initGameFlow();

        // 4. 启动循环
        worker.postMessage({ type: 'START' });

        worker.onmessage = (e) => {
                const { type, payload } = e.data;
                
                if (type === 'SYNC') {
                    // [同步逻辑]
                    // Worker 现在只发送非高频数据 (时间、日志、Sim列表元数据)
                    GameStore.time = payload.time;
                    // ✅ 将数据灌入主线程的 Store
                    GameStore.handleWorkerSync(payload);
                    // 处理日志 (防止日志跳变，可选优化)
                    if (payload.logs && payload.logs.length > GameStore.logs.length) {
                        GameStore.logs = payload.logs;
                    }
                    // 通知 UI 更新
                    GameStore.notify();
                }
                // ✅ [新增] 必须把其他消息（如存档数据）转发给 GameStore 处理！
                else {
                    GameStore.handleWorkerMessage(type, payload);
                }
        };
        // 把 worker 挂载到 Store 上
        GameStore.worker = worker;
        return () => {
            // 🛑 必须清理 GameStore 的状态，防止残留数据污染下一次会话
            GameStore.worker = null;
            GameStore.sims = []; 
            GameStore.simIndexMap.clear(); 
            GameStore.availableIndices = []; // 重置 SAB 索引池
            // 如果有必要，甚至应该清空 worldLayout，因为新 Worker 会重新发一遍
            worker.terminate();
        };
    }, []);

    // === B. 初始化 & 循环 ===
    useEffect(() => {
        let isCancelled = false;
        let appInstance: Application | null = null;

        const initGame = async () => {
            if (!containerRef.current) return;

            const app = new Application();
            await app.init({
                background: '#121212',
                resizeTo: containerRef.current,
                antialias: false,
                roundPixels: true,
                preference: 'webgl',
            });

            if (isCancelled) { await app.destroy(); return; }

            containerRef.current.innerHTML = '';
            containerRef.current.appendChild(app.canvas);
            appRef.current = app;
            appInstance = app;

            // 在 worldContainer 下建立层级
            const worldContainer = new Container();
            worldContainer.sortableChildren = true;
            app.stage.addChild(worldContainer);
            worldContainerRef.current = worldContainer;

            // 1. 地板/建筑层 (z: -100)
            // 2. 网格层 (z: 0) -> [新增]
            const gridGraphics = new Graphics();
            gridGraphics.zIndex = 0;
            worldContainer.addChild(gridGraphics);
            gridLayerRef.current = gridGraphics;

            // 3. 家具/人物层 (z: y坐标)
            const simLayer = new Container();
            simLayer.sortableChildren = true;
            simLayer.zIndex = 10000;
            worldContainer.addChild(simLayer);
            simLayerRef.current = simLayer;

            // [新增] 聚光灯遮罩层 (放在 Editor UI 之下，但在物体之上)
            const spotlightGraphics = new Graphics();
            spotlightGraphics.zIndex = 50000; 
            worldContainer.addChild(spotlightGraphics);
            spotlightLayerRef.current = spotlightGraphics;

            // 5. 编辑器 UI 层 (框选线) (z: 99999)
            const editorGraphics = new Graphics();
            editorGraphics.zIndex = 99999;
            worldContainer.addChild(editorGraphics);
            editorLayerRef.current = editorGraphics;

            // 4. 预览/Ghost层 (z: 90000) -> [新增]
            const previewLayer = new Container();
            previewLayer.zIndex = 100000;
            worldContainer.addChild(previewLayer);
            previewLayerRef.current = previewLayer;

            // UI Layer (Tooltip)
            // const uiLayer = new Container();
            // uiLayer.zIndex = 999999; // 最高层
            // app.stage.addChild(uiLayer);
            // const tooltipContainer = new Container();
            // const tooltipBg = new Graphics();
            // const tooltipText = new Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 12, fill: 0xffffff } });
            // tooltipContainer.addChild(tooltipBg, tooltipText);
            // tooltipContainer.visible = false;
            // uiLayer.addChild(tooltipContainer);

            // 4. 加载资源
            console.log("📥 Loading assets...");
            await loadGameAssets([
                ...(ASSET_CONFIG.bg || []),
                ...ASSET_CONFIG.atlases,
                ...ASSET_CONFIG.adult.bodies,
                ...ASSET_CONFIG.adult.outfits,
                ...ASSET_CONFIG.adult.hairs,
                ...ASSET_CONFIG.child.bodies,
                ...ASSET_CONFIG.child.outfits,
                ...ASSET_CONFIG.child.hairs,
                ...ASSET_CONFIG.infant.bodies,
                ...ASSET_CONFIG.infant.outfits,
                ...ASSET_CONFIG.infant.hairs,
                ...(ASSET_CONFIG.face || []),
                ...ASSET_CONFIG.furniture,
                ...ASSET_CONFIG.world
            ]);
            setLoading(false);

            // 5. 背景图
            const bgPath = ASSET_CONFIG.bg?.[0];
            if (bgPath) {
                const bg = Sprite.from(bgPath);
                bg.zIndex = -99999;
                bg.width = CONFIG.CANVAS_W || 3280;
                bg.height = CONFIG.CANVAS_H || 2200;
                worldContainer.addChild(bg);
            }

            refreshWorld();

            // 初始相机聚焦
            const centerX = CONFIG.CANVAS_W / 2;
            const centerY = CONFIG.CANVAS_H / 2;
            worldContainer.x = (app.screen.width / 2) - centerX;
            worldContainer.y = (app.screen.height / 2) - centerY;

            // 6. 渲染循环
            app.ticker.add(() => {
                // 1. 绘制编辑器 UI (选中框、Ghost、手柄)
                editorGraphics.clear();
                
                const activeId = GameStore.editor.activePlotId;
                
                // === 1. 聚光灯效果 (Dimming) ===
                if (activeId) {
                    spotlightGraphics.clear();
                    const plot = GameStore.worldLayout.find(p => p.id === activeId);
                    if (plot) {
                        const w = plot.width || 300;
                        const h = plot.height || 300;
                        spotlightGraphics.fillStyle = { color: 0x000000, alpha: 0.6 }; // 变暗
                        spotlightGraphics.rect(-20000, -20000, 40000, 20000 + plot.y).fill(); // Top
                        spotlightGraphics.rect(-20000, plot.y + h, 40000, 20000).fill();      // Bottom
                        spotlightGraphics.rect(-20000, plot.y, 20000 + plot.x, h).fill();     // Left
                        spotlightGraphics.rect(plot.x + w, plot.y, 20000, h).fill();          // Right
                    }
                } else {
                    spotlightGraphics.clear();
                }
                // === 2. 网格绘制 (修复：增加全局网格绘制) ===
                if (gridLayerRef.current) {
                    const activeId = GameStore.editor.activePlotId;
                    if (activeId) {
                        drawActivePlotGrid(gridLayerRef.current, worldContainer.scale.x);
                    } else if (GameStore.editor.mode === 'plot') {
                        // ✅ 新增：在世界编辑模式下绘制全局网格
                        drawGrid(gridLayerRef.current, CONFIG.CANVAS_W, CONFIG.CANVAS_H, worldContainer.scale.x);
                    } else {
                        gridLayerRef.current.clear();
                    }
                }

                // === 3. 拖拽预览 (Ghost) (修复：支持已有物体的拖拽预览) ===
                while (previewLayer.children.length > 0) previewLayer.children[0].destroy();

                // 只要处于拖拽状态，或者有放置模板，就显示 Ghost
                if (GameStore.editor.previewPos && (isDraggingObject.current || isStickyDragging.current || GameStore.editor.placingFurniture || GameStore.editor.placingTemplateId)) {
                    const { x, y } = GameStore.editor.previewPos;
                    let ghost: Container | null = null;
                    
                    // Case A: 正在放置新家具
                    if (GameStore.editor.placingFurniture) {
                         ghost = PixiWorldBuilder.createFurniture({ ...GameStore.editor.placingFurniture, x: 0, y: 0, id: 'ghost' } as any);
                    }
                    // Case B: 正在移动已有家具 (新增)
                    else if (GameStore.editor.selectedFurnitureId && GameStore.editor.mode === 'furniture') {
                         const original = GameStore.furniture.find(f => f.id === GameStore.editor.selectedFurnitureId);
                         if (original) ghost = PixiWorldBuilder.createFurniture({ ...original, x: 0, y: 0, id: 'ghost' });
                    }
                    // Case C: 正在放置新地皮
                    else if (GameStore.editor.placingTemplateId) {
                        let w = 300, h = 300;
                        if (GameStore.editor.placingSize) {
                            w = GameStore.editor.placingSize.w;
                            h = GameStore.editor.placingSize.h;
                        } else {
                            const tpl = PLOTS[GameStore.editor.placingTemplateId];
                            if (tpl) { w = tpl.width; h = tpl.height; }
                        }
                        const g = new Graphics();
                        g.rect(0, 0, w, h).stroke({ width: 2, color: 0xffffff }); // 绘制白色边框
                        g.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0.1 }); // 填充淡白色
                        ghost = new Container();
                        ghost.addChild(g);
                    }
                    // Case D: 正在移动已有地皮 (新增)
                    else if (GameStore.editor.selectedPlotId && GameStore.editor.mode === 'plot') {
                        const p = GameStore.worldLayout.find(x => x.id === GameStore.editor.selectedPlotId);
                        if (p) {
                            const w = p.width || 300;
                            const h = p.height || 300;
                            const g = new Graphics();
                            g.rect(0, 0, w, h).stroke({ width: 2, color: 0x00ffff }); // 选中时用青色
                            g.rect(0, 0, w, h).fill({ color: 0x00ffff, alpha: 0.1 });
                            ghost = new Container();
                            ghost.addChild(g);
                        }
                    }
                    if (ghost) {
                        ghost.x = x; 
                        ghost.y = y; 
                        ghost.alpha = 0.6; // 半透明
                        const tint = GameStore.editor.isValidPlacement ? 0x00ff00 : 0xff0000;
                        // 尝试给子对象染色
                        ghost.children.forEach(c => { 
                            if ((c as any).tint !== undefined) (c as any).tint = tint; 
                            // Graphics 染色比较麻烦，这里简化处理，主要靠 alpha
                        });
                        previewLayer.addChild(ghost);
                    }
                }
                // === 4. 编辑器框线 ===
                if (GameStore.editor.mode !== 'none') {
                    // 绘制选中框
                    let selectedRect: { x: number, y: number, w: number, h: number } | null = null;
                    if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
                        const p = GameStore.worldLayout.find(x => x.id === GameStore.editor.selectedPlotId);
                        if (p) selectedRect = { x: p.x, y: p.y, w: p.width || 300, h: p.height || 300 };
                    } else if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId) {
                        const f = GameStore.furniture.find(x => x.id === GameStore.editor.selectedFurnitureId);
                        if (f) selectedRect = { x: f.x, y: f.y, w: f.w, h: f.h };
                    } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                        const r = GameStore.rooms.find(x => x.id === GameStore.editor.selectedRoomId);
                        if (r) selectedRect = { x: r.x, y: r.y, w: r.w, h: r.h };
                    }

                    if (selectedRect) {
                        editorGraphics.strokeStyle = { width: 2, color: 0x00ffff };
                        editorGraphics.rect(selectedRect.x, selectedRect.y, selectedRect.w, selectedRect.h).stroke();
                        if (GameStore.editor.activeTool !== 'camera') {
                            drawResizeHandles(editorGraphics, selectedRect.x, selectedRect.y, selectedRect.w, selectedRect.h);
                        }
                    }

                    // 绘制框选 (Drawing)
                    const drawing = GameStore.editor.drawingFloor || GameStore.editor.drawingPlot;
                    if (drawing && isDraggingObject.current) {
                        const x = Math.min(drawing.startX, drawing.currX);
                        const y = Math.min(drawing.startY, drawing.currY);
                        const w = Math.abs(drawing.currX - drawing.startX);
                        const h = Math.abs(drawing.currY - drawing.startY);
                        editorGraphics.strokeStyle = { width: 1, color: 0xffff00 };
                        editorGraphics.rect(x, y, w, h).stroke();
                    }
                }

                // === 5. Sim 渲染 (保持不变) ===
                if (simLayerRef.current) {
                    const activeIds = new Set<string>();
                    GameStore.sims.forEach(sim => {
                        if (isNaN(sim.pos.x) || isNaN(sim.pos.y)) return;
                        activeIds.add(sim.id);
                        let view = simViewsRef.current.get(sim.id);
                        if (!view) {
                            view = new PixiSimView(sim);
                            simLayerRef.current!.addChild(view.container as any);
                            simViewsRef.current.set(sim.id, view);
                        }
                        (view.container as any).zIndex = sim.pos.y;
                        view.updatePosition(sim);
                        view.showSelectionRing(GameStore.selectedSimId === sim.id);
                    });
                    if (simViewsRef.current.size > 0) {
                        simViewsRef.current.forEach((v, id) => { 
                            if (!activeIds.has(id)) { simLayerRef.current!.removeChild(v.container as any); v.destroy(); simViewsRef.current.delete(id); }
                        });
                    }
                    simLayerRef.current.sortChildren();
                }
                // === 6. 镜头跟随逻辑 (Camera Follow) ===
                // 只有当：选中了 Sim 且 并没有正在拖拽镜头 时，才自动跟随
                if (GameStore.selectedSimId && !isDraggingCamera.current && !activeResizeHandle.current && worldContainerRef.current) {
                    const sim = GameStore.sims.find(s => s.id === GameStore.selectedSimId);
                    
                    // 确保 Sim 存在且坐标有效
                    if (sim && !isNaN(sim.pos.x) && !isNaN(sim.pos.y)) {
                        const world = worldContainerRef.current;
                        const screenCenter = { x: app.screen.width / 2, y: app.screen.height / 2 };
                        
                        // 目标世界坐标
                        const targetWorldX = sim.pos.x;
                        const targetWorldY = sim.pos.y; // 你可以选择是否减去 sim.height/2 让头部居中
                        
                        // 计算目标容器位置：
                        // Container.x = ScreenCenter.x - (TargetWorld.x * Scale)
                        const targetContainerX = screenCenter.x - targetWorldX * world.scale.x;
                        const targetContainerY = screenCenter.y - targetWorldY * world.scale.y;

                        // 平滑移动 (Lerp)
                        // factor 0.1 表示每帧移动 10% 的距离，制造平滑感
                        // 如果觉得太慢可以改大，如果太抖可以改小
                        const lerpFactor = 0.1;
                        world.x = world.x + (targetContainerX - world.x) * lerpFactor;
                        world.y = world.y + (targetContainerY - world.y) * lerpFactor;
                    }
                }
            });
        };
        initGame();
        return () => { isCancelled = true; if (appInstance) appInstance.destroy({ removeView: true }); };
    }, []);

    // 智能更新订阅
    useEffect(() => {
        const unsub = GameStore.subscribe(() => {
            if (GameStore.mapVersion !== lastMapVersion.current) {
                lastMapVersion.current = GameStore.mapVersion;
                setEditorRefresh(v => v + 1);
            }
        });
        return unsub;
    }, []);

    // === 交互事件处理 (核心修改) ===

    const handleMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        // 🛑 修复：更严格的 UI 穿透检测
        // 如果点击的目标不是 canvas 所在的 div，也不是 canvas 本身，说明点击了覆盖在上面的 UI
        // 只有当 pointer-events: none 的时候，UI 下方的点击才会透传给 div，此时 e.target 可能是 div
        // 如果 e.target 是 UI 按钮元素，说明 UI 拦截了点击，我们应该忽略
        const isCanvas = target === containerRef.current || target.tagName === 'CANVAS';
        if (!isCanvas) {
            // 点击了 UI，直接忽略，不执行任何 Canvas 选中/取消选中逻辑
            return;
        }
        if (!worldContainerRef.current) return;
        const world = worldContainerRef.current;
        const rect = containerRef.current!.getBoundingClientRect();
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - world.x) / world.scale.x;
        const worldY = (mouseY - world.y) / world.scale.y;

        lastMousePos.current = { x: e.clientX, y: e.clientY };
        dragStartMousePos.current = { x: e.clientX, y: e.clientY };

        const isNormalMode = (GameStore.editor.mode as string) === 'none';
        const isCameraAction = e.button === 2 || (e.button === 0 && (isSpacePressed.current || isNormalMode));
        if (isCameraAction) {
            isDraggingCamera.current = true;
            GameStore.selectSim(null);
            if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
            return;
        }

        if (e.button === 0 && GameStore.editor.mode !== 'none') {
            // 🆕 [新增/修改] 针对 Surface 类型的特殊处理
            const isSurfaceMode = GameStore.editor.placingType === 'surface' || 
                                  (GameStore.editor.placingTemplateId && GameStore.editor.placingTemplateId.startsWith('surface_'));

            if (isSurfaceMode) {
                // 开启画笔模式
                isPaintingSurface.current = true;
                // 立即画下第一笔
                GameStore.editor.tryPaintPlotAt(worldX, worldY);
                // 刷新视图
                refreshWorld();
                // 阻止进入后续的普通拖拽逻辑
                return; 
            }
            // A. 放置模式
            const isPlacing = isStickyDragging.current || GameStore.editor.placingFurniture || GameStore.editor.placingTemplateId;
            if (isPlacing) {
                if (!GameStore.editor.isValidPlacement) {
                    GameStore.showToast("⚠️ 此处无法放置 (超出地皮边界或重叠)");
                    return;
                }
                const finalPos = GameStore.editor.previewPos || {x: 0, y: 0};
                if (GameStore.editor.placingTemplateId) GameStore.placePlot(finalPos.x, finalPos.y);
                else if (GameStore.editor.placingFurniture) GameStore.editor.placeFurniture(finalPos.x, finalPos.y, e.shiftKey);
                else if (GameStore.editor.selectedFurnitureId) GameStore.finalizeMove('furniture', GameStore.editor.selectedFurnitureId, dragStartPos.current);
                else if (GameStore.editor.selectedPlotId) GameStore.finalizeMove('plot', GameStore.editor.selectedPlotId, dragStartPos.current);
                else if (GameStore.editor.selectedRoomId) GameStore.finalizeMove('room', GameStore.editor.selectedRoomId, dragStartPos.current);
                
                if (!e.shiftKey && !GameStore.editor.drawingFloor && !GameStore.editor.drawingPlot) {
                    isStickyDragging.current = false;
                    isDraggingObject.current = false;
                    GameStore.editor.previewPos = null;
                }
                refreshWorld();
                return;
            }

            // B. 绘制模式 (略，保持逻辑，但会受到 EditorManager 的 activePlot 限制)
            if (GameStore.editor.drawingFloor || GameStore.editor.drawingPlot) {
                isDraggingObject.current = true;
                const gs = GameStore.editor.gridSize || 20;
                const sx = Math.round(worldX / gs) * gs;
                const sy = Math.round(worldY / gs) * gs;
                if (GameStore.editor.drawingFloor) { GameStore.editor.drawingFloor.startX = sx; GameStore.editor.drawingFloor.startY = sy; GameStore.editor.drawingFloor.currX = sx; GameStore.editor.drawingFloor.currY = sy; }
                if (GameStore.editor.drawingPlot) { GameStore.editor.drawingPlot.startX = sx; GameStore.editor.drawingPlot.startY = sy; GameStore.editor.drawingPlot.currX = sx; GameStore.editor.drawingPlot.currY = sy; }
                return;
            }

            // C. 核心：点击选择 (区分 World Mode 和 Build Mode)
            const activeId = GameStore.editor.activePlotId;
            
            // 1. 检测缩放手柄 (通用)
            let resizeTarget: { x: number, y: number, w: number, h: number } | null = null;
            if (GameStore.editor.selectedPlotId) {
                const p = GameStore.worldLayout.find(x => x.id === GameStore.editor.selectedPlotId);
                if (p) resizeTarget = { x: p.x, y: p.y, w: p.width || 300, h: p.height || 300 };
            } else if (GameStore.editor.selectedRoomId) {
                const r = GameStore.rooms.find(x => x.id === GameStore.editor.selectedRoomId);
                if (r) resizeTarget = { x: r.x, y: r.y, w: r.w, h: r.h };
            }

            if (resizeTarget) {
                const { x, y, w, h } = resizeTarget;
                const half = 10 / world.scale.x;
                if (Math.abs(worldX - x) < half && Math.abs(worldY - y) < half) activeResizeHandle.current = 'nw';
                else if (Math.abs(worldX - (x + w)) < half && Math.abs(worldY - y) < half) activeResizeHandle.current = 'ne';
                else if (Math.abs(worldX - x) < half && Math.abs(worldY - (y + h)) < half) activeResizeHandle.current = 'sw';
                else if (Math.abs(worldX - (x + w)) < half && Math.abs(worldY - (y + h)) < half) activeResizeHandle.current = 'se';

                if (activeResizeHandle.current) {
                    isResizing.current = true;
                    resizeStartRect.current = { x, y, w, h };
                    return;
                }
            }

            // 2. 物体命中检测
            let hitObj: any = null;
            let hitType = '';

            // [建筑模式]：只能选当前 activePlotId 内的东西
            if (activeId) {
                // 家具
                if (GameStore.editor.mode === 'furniture') {
                    hitObj = [...GameStore.furniture].reverse().find(f => {
                        return f.id.startsWith(activeId) && worldX >= f.x && worldX <= f.x + f.w && worldY >= f.y && worldY <= f.y + f.h;
                    });
                    if (hitObj) hitType = 'furniture';
                }
                // 地板/房间
                else if (GameStore.editor.mode === 'floor') {
                    hitObj = [...GameStore.rooms].reverse().find(r => {
                        return r.id.startsWith(activeId) && worldX >= r.x && worldX <= r.x + r.w && worldY >= r.y && worldY <= r.y + r.h;
                    });
                    if (hitObj) hitType = 'floor';
                }
            } 
            // 🟢 [修复] 世界模式：既能选家具(街道设施)，也能选地皮
            // 注意：这里去掉了 else if (mode === 'plot') 的限制，只要不是建筑模式，都能选
            else {
                 // 1. 优先检测家具 (街道设施/World Props)
                 // 我们反向遍历(从上层到下层)，优先选中最上面的
                 const hitFurn = [...GameStore.furniture].reverse().find(f => {
                    return worldX >= f.x && worldX <= f.x + f.w && worldY >= f.y && worldY <= f.y + f.h;
                 });

                 if (hitFurn) {
                     hitObj = hitFurn;
                     hitType = 'furniture';
                     // ✨ 关键：选中家具时，自动把模式切为 furniture，这样后续的拖拽/预览逻辑才能正常工作
                     GameStore.editor.mode = 'furniture';
                 }
                 // 2. 如果没点中家具，再检测地皮
                 else {
                     const plot = GameStore.worldLayout.find(p => {
                        const w = p.width || 300; const h = p.height || 300;
                        return worldX >= p.x && worldX <= p.x + w && worldY >= p.y && worldY <= p.y + h;
                     });
                     if (plot) { 
                         hitObj = plot; 
                         hitType = 'plot'; 
                         // ✨ 关键：选中地皮时，自动把模式切为 plot
                         GameStore.editor.mode = 'plot';
                     }
                 }
            }

            if (hitObj) {
                // 选中了物体
                if (hitType === 'plot') GameStore.editor.selectedPlotId = hitObj.id;
                else if (hitType === 'furniture') GameStore.editor.selectedFurnitureId = hitObj.id;
                else if (hitType === 'floor') GameStore.editor.selectedRoomId = hitObj.id;

                // 开启普通拖拽 (按住不放)
                GameStore.editor.isDragging = true;
                isDraggingObject.current = true;
                GameStore.editor.dragOffset = { x: worldX - hitObj.x, y: worldY - hitObj.y };
                GameStore.editor.previewPos = { x: hitObj.x, y: hitObj.y }; // 立即更新 Ghost 位置
                GameStore.editor.updatePreviewPos(worldX, worldY);
            } else {
                // 点击空白处取消选中
                if (!activeResizeHandle.current) {
                    GameStore.editor.selectedPlotId = null;
                    GameStore.editor.selectedFurnitureId = null;
                    GameStore.editor.selectedRoomId = null;
                }
            }
            GameStore.notify();
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!worldContainerRef.current) return;
        const world = worldContainerRef.current;
        const rect = containerRef.current!.getBoundingClientRect();
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - world.x) / world.scale.x;
        const worldY = (mouseY - world.y) / world.scale.y;

        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };

        if (isDraggingCamera.current) {
            world.x += dx; world.y += dy;
            return;
        }

        // 🆕 [新增] 持续涂抹检测
        if (isPaintingSurface.current) {
            // 只要鼠标没松开，移动到哪里就画到哪里
            GameStore.editor.tryPaintPlotAt(worldX, worldY);
            // 这里不调用 notify，因为 tryPaintPlotAt 内部已经 triggerMapUpdate 了
            // 但为了让画面（如新添加的 Sprite）立即显示，可以调用局部刷新
            // 注意：频繁 refreshWorld 开销较大，实际项目中可以用 Object Pool 或增量添加，
            // 但考虑到是编辑器模式，直接 refreshWorld 逻辑最稳健。
            refreshWorld(); 
            return;
        }

        if (GameStore.editor.mode !== 'none') {
            // A. 放置预览
            if (GameStore.editor.placingTemplateId || GameStore.editor.placingFurniture || GameStore.editor.isDragging) {
                GameStore.editor.updatePreviewPos(worldX, worldY);
                GameStore.notify(); 
            }
            // B. 绘制
            if (isDraggingObject.current && (GameStore.editor.drawingFloor || GameStore.editor.drawingPlot)) {
                const gs = GameStore.editor.gridSize || 20;
                const sx = Math.round(worldX / gs) * gs;
                const sy = Math.round(worldY / gs) * gs;
                if (GameStore.editor.drawingFloor) { GameStore.editor.drawingFloor.currX = sx; GameStore.editor.drawingFloor.currY = sy; }
                if (GameStore.editor.drawingPlot) { GameStore.editor.drawingPlot.currX = sx; GameStore.editor.drawingPlot.currY = sy; }
                GameStore.notify();
            }
            // C. 缩放
            if (isResizing.current && activeResizeHandle.current) {
                const startR = resizeStartRect.current;
                let newRect = { ...startR };
                if (activeResizeHandle.current === 'se') {
                    newRect.w = Math.max(50, worldX - startR.x);
                    newRect.h = Math.max(50, worldY - startR.y);
                }
                newRect.w = Math.round(newRect.w / 20) * 20;
                newRect.h = Math.round(newRect.h / 20) * 20;
                
                if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
                    const p = GameStore.worldLayout.find(x => x.id === GameStore.editor.selectedPlotId);
                    if (p) { p.width = newRect.w; p.height = newRect.h; }
                } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                    const r = GameStore.rooms.find(x => x.id === GameStore.editor.selectedRoomId);
                    if (r) { r.w = newRect.w; r.h = newRect.h; }
                }
                return;
            }
        }
    };
    
    
    const handleMouseUp = (e: React.MouseEvent) => {
        const dragDist = Math.sqrt(Math.pow(e.clientX - dragStartMousePos.current.x, 2) + Math.pow(e.clientY - dragStartMousePos.current.y, 2));
        const isClick = dragDist < 5;

        // 结束镜头拖拽
        if (e.button === 2 || isDraggingCamera.current) {
            isDraggingCamera.current = false;
            if (containerRef.current) containerRef.current.style.cursor = 'default';
        }
        
        // 结束调整大小
        if (isResizing.current) {
            isResizing.current = false;
            activeResizeHandle.current = null;
            GameStore.triggerMapUpdate();
            return;
        }
        // 核心修复：处理绘制结束 (New Plot / New Room)
        if (isDraggingObject.current) {
            // 1. 提交绘制的房间
            if (GameStore.editor.drawingFloor) {
                const d = GameStore.editor.drawingFloor;
                const x = Math.min(d.startX, d.currX); const y = Math.min(d.startY, d.currY);
                const w = Math.abs(d.currX - d.startX); const h = Math.abs(d.currY - d.startY);
                if (w > 0 && h > 0) GameStore.createCustomRoom({x, y, w, h}, d.pattern, d.color, d.label, d.hasWall);
                GameStore.editor.drawingFloor = null;
                isDraggingObject.current = false;
                refreshWorld();
                return;
            }
            // 2. 提交绘制的地皮
            if (GameStore.editor.drawingPlot) {
                const d = GameStore.editor.drawingPlot;
                const x = Math.min(d.startX, d.currX); const y = Math.min(d.startY, d.currY);
                const w = Math.abs(d.currX - d.startX); const h = Math.abs(d.currY - d.startY);
                if (w > 0 && h > 0) GameStore.createCustomPlot({x, y, w, h}, d.templateId);
                GameStore.editor.drawingPlot = null;
                isDraggingObject.current = false;
                refreshWorld();
                return;
            }
        }
        // 🆕 [新增] 结束涂抹
        if (isPaintingSurface.current) {
            isPaintingSurface.current = false;
            // 关键点：这里不要重置 GameStore.editor.placingTemplateId
            // 这样用户松开鼠标后，依然处于“手中拿着地砖”的状态，可以去别的地方再次点击开始涂抹
            return; 
        }

        // Sticky Drag Mode Logic
        if (GameStore.editor.mode !== 'none' && GameStore.editor.isDragging) {
            // 如果是点击 (没有拖动距离)
            if (isClick) {
                // 1. 如果正在放置新物品 (模板/家具库)，点击一次后进入连续放置或吸附模式 (保持原样)
                if (GameStore.editor.placingTemplateId || GameStore.editor.placingFurniture) {
                     if (!isStickyDragging.current) {
                         isStickyDragging.current = true;
                         return;
                     }
                }
                // 2. 🛑 如果是已存在的物体 (Selecting)，点击只负责选中，不应该进入 Sticky Drag
                // 这样用户选中后，可以通过 UI 点击 "进入装修"，而不会被物体粘在鼠标上卡住
                else {
                    // 纯选中，结束拖拽状态
                    GameStore.editor.isDragging = false;
                    isDraggingObject.current = false;
                    GameStore.editor.previewPos = null;
                    refreshWorld();
                    return; 
                }
            }
            
            // 如果是真正的拖拽后松开 (Drop)
            if (!isClick && !isStickyDragging.current) {
                GameStore.editor.isDragging = false;
                // 执行移动结算
                if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId) {
                    GameStore.finalizeMove('furniture', GameStore.editor.selectedFurnitureId, dragStartPos.current);
                } else if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
                    GameStore.finalizeMove('plot', GameStore.editor.selectedPlotId, dragStartPos.current);
                } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                    GameStore.finalizeMove('room', GameStore.editor.selectedRoomId, dragStartPos.current);
                }
                isDraggingObject.current = false;
                refreshWorld();
            }
        }
        if (GameStore.editor.isDragging && !isStickyDragging.current) {
            if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId) GameStore.finalizeMove('furniture', GameStore.editor.selectedFurnitureId, dragStartPos.current);
            else if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) GameStore.finalizeMove('plot', GameStore.editor.selectedPlotId, dragStartPos.current);
            else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) GameStore.finalizeMove('room', GameStore.editor.selectedRoomId, dragStartPos.current);
            
            GameStore.editor.isDragging = false;
            isDraggingObject.current = false;
            GameStore.editor.previewPos = null;
            refreshWorld();
        }

        if (isClick && GameStore.editor.mode === 'none' && worldContainerRef.current) {
            const world = worldContainerRef.current;
            const rect = containerRef.current!.getBoundingClientRect();
            const worldX = (e.clientX - rect.left - world.x) / world.scale.x;
            const worldY = (e.clientY - rect.top - world.y) / world.scale.y;

            let hitSimId: string | null = null;
            for (let i = GameStore.sims.length - 1; i >= 0; i--) {
                const s = GameStore.sims[i];
                if (Math.abs(worldX - s.pos.x) < 25 && Math.abs(worldY - (s.pos.y - 20)) < 40) {
                    hitSimId = s.id;
                    break;
                }
            }
            GameStore.selectedSimId = hitSimId;
            if (hitSimId) isCameraLocked.current = true;
            GameStore.notify();
        }
    };

    // [新增] 监听键盘事件 (Esc 取消, R 旋转)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // 1. 记录空格键状态
            if (e.code === 'Space') {
                isSpacePressed.current = true;
                // 可选：防止空格导致页面滚动
                e.preventDefault(); 
            }
            if (GameStore.editor.mode === 'none') return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                GameStore.deleteSelection(); // 调用刚才在 Manager 里加的方法
            }
            if (e.key === 'Escape') {
                // 取消当前操作
                if (isStickyDragging.current || GameStore.editor.placingFurniture) {
                    GameStore.resetEditorState();
                    isStickyDragging.current = false;
                    isDraggingObject.current = false;
                    GameStore.triggerMapUpdate();
                }
            }
            if (e.key === 'r' || e.key === 'R') {
                // 旋转
                GameStore.editor.rotateSelection();
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            // 2. 空格松开
            if (e.code === 'Space') {
                isSpacePressed.current = false;
                
                // 如果此时正在通过空格拖拽镜头，建议在这里也结束拖拽，体验更好
                if (isDraggingCamera.current && containerRef.current) {
                    isDraggingCamera.current = false;
                    containerRef.current.style.cursor = 'default';
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const handleWheel = (e: React.WheelEvent) => {
        if (!worldContainerRef.current) return;
        const world = worldContainerRef.current;
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(world.scale.x * scaleFactor, 4.0));
        
        const rect = containerRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldPos = { x: (mouseX - world.x) / world.scale.x, y: (mouseY - world.y) / world.scale.y };

        world.scale.set(newScale);
        world.x = mouseX - worldPos.x * newScale;
        world.y = mouseY - worldPos.y * newScale;
    };

    return (
        <div className="relative w-full h-full overflow-hidden bg-[#111]">
            <div ref={containerRef} className="w-full h-full" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel} onContextMenu={e => e.preventDefault()} />
            <div className={`absolute inset-0 flex items-center justify-center text-white bg-black/80 z-50 transition-opacity duration-500 ${loading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>LOADING...</div>
        </div>
    );
};

export default React.memo(PixiGameCanvasComponent);
