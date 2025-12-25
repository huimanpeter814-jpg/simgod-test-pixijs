
import React, { useEffect, useRef, useState } from 'react';
import { Application, Container, Sprite, TextureStyle, Graphics, Text } from 'pixi.js';
import { ASSET_CONFIG, CONFIG } from '../constants';
import { loadGameAssets } from '../utils/assetLoader';
import { GameStore } from '../utils/GameStore';
import { PixiSimView } from '../utils/render/PixiSimView';
import { PixiWorldBuilder } from '../utils/render/PixiWorldBuilder';
import { PLOTS } from '../data/plots'; 
import { SAB_CONFIG } from '../constants'; 
import { SaveManager } from '../managers/SaveManager'; 
import { Sim } from '../utils/Sim'; // ✅ 新增这一行
import { Furniture } from '../types';

// 全局设置：像素风格缩放 (防止图片模糊)
TextureStyle.defaultOptions.scaleMode = 'nearest';

const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

const PixiGameCanvasComponent: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const worldContainerRef = useRef<Container | null>(null);
    const simLayerRef = useRef<Container | null>(null);
    const editorLayerRef = useRef<Graphics | null>(null); // [新增] 编辑器UI层
    const appRef = useRef<Application | null>(null);
    
    // 实体缓存
    const simViewsRef = useRef<Map<string, PixiSimView>>(new Map());
    const furnViewsRef = useRef<Map<string, Container>>(new Map());
    const roomViewsRef = useRef<Map<string, any>>(new Map());

    // --- [移植] 编辑器交互状态 ---
    const isDraggingCamera = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const dragStartMousePos = useRef({ x: 0, y: 0 });
    const dragStartPos = useRef({ x: 0, y: 0 }); // 物体拖拽起始位置
    const isCameraLocked = useRef(false);
    const hoveredTarget = useRef<any>(null);

    // 编辑器特有状态
    const isDraggingObject = useRef(false);
    const isStickyDragging = useRef(false); // 点击后粘在鼠标上
    const isResizing = useRef(false);
    const activeResizeHandle = useRef<string | null>(null);
    const resizeStartRect = useRef({ x: 0, y: 0, w: 0, h: 0 });

    const [loading, setLoading] = useState(true);
    const [editorRefresh, setEditorRefresh] = useState(0);
    const lastMapVersion = useRef(GameStore.mapVersion || 0);

    const gridLayerRef = useRef<Graphics | null>(null); // [新增] 网格层
    const isSpacePressed = useRef(false);

    // [新增] 拖拽预览层（专门用于显示半透明物体）
    const previewLayerRef = useRef<Container | null>(null); 
    const dragGhostRef = useRef<Container | null>(null);

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

        coords.forEach(c => {
            g.rect(c.x, c.y, size, size).fill().stroke();
        });
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
            // 在拖拽 plot 时临时隐藏其子元素
            if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId && isDraggingObject.current && room.id.startsWith(GameStore.editor.selectedPlotId)) return;
            // 拖拽 room 时隐藏本体
            if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId === room.id && isDraggingObject.current) return;

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

    // === 辅助：绘制网格背景 ===
    const drawGrid = (g: Graphics, width: number, height: number, scale: number) => {
        g.clear();
        if (GameStore.editor.mode === 'none' || !GameStore.editor.showGrid) return;
        
        const gridSize = GameStore.editor.gridSize || 50;
        const alpha = 0.15; // 网格透明度
        
        // 优化：只绘制屏幕可见区域的网格，或者绘制一个覆盖全图的大网格
        // 这里为了简单，假设绘制一个足够大的区域
        const startX = -2000;
        const startY = -2000;
        const endX = CONFIG.CANVAS_W + 1000; // 确保覆盖全图
        const endY = CONFIG.CANVAS_H + 1000;

        g.strokeStyle = { width: 1 / scale, color: 0xffffff, alpha: alpha }; // 线条随缩放变细

        for (let x = startX; x <= endX; x += gridSize) {
            g.moveTo(x, startY).lineTo(x, endY).stroke();
        }
        for (let y = startY; y <= endY; y += gridSize) {
            g.moveTo(startX, y).lineTo(endX, y).stroke();
        }
    };

    // === 核心逻辑：绘制网格 ===
    // 只在 activePlot 范围内绘制网格
    const drawActivePlotGrid = (g: Graphics, scale: number) => {
        g.clear();
        const activeId = GameStore.editor.activePlotId;
        if (!activeId || !GameStore.editor.showGrid) return;

        const plot = GameStore.worldLayout.find(p => p.id === activeId);
        if (!plot) return;

        // 获取地皮尺寸
        const tpl = PLOTS[plot.templateId];
        const w = plot.width ?? tpl?.width ?? 300;
        const h = plot.height ?? tpl?.height ?? 300;
        const gridSize = GameStore.editor.gridSize || 20;

        g.strokeStyle = { width: 1 / scale, color: 0xffffff, alpha: 0.2 }; 

        // 绘制垂直线
        for (let x = 0; x <= w; x += gridSize) {
            g.moveTo(plot.x + x, plot.y).lineTo(plot.x + x, plot.y + h).stroke();
        }
        // 绘制水平线
        for (let y = 0; y <= h; y += gridSize) {
            g.moveTo(plot.x, plot.y + y).lineTo(plot.x + w, plot.y + y).stroke();
        }
        
        // 绘制地皮边界高亮
        g.strokeStyle = { width: 2 / scale, color: 0xffff00, alpha: 0.5 };
        g.rect(plot.x, plot.y, w, h).stroke();
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

            // 4. 预览/Ghost层 (z: 90000) -> [新增]
            const previewLayer = new Container();
            previewLayer.zIndex = 90000;
            worldContainer.addChild(previewLayer);
            previewLayerRef.current = previewLayer;

            // 5. 编辑器 UI 层 (框选线) (z: 99999)
            const editorGraphics = new Graphics();
            editorGraphics.zIndex = 99999;
            worldContainer.addChild(editorGraphics);
            editorLayerRef.current = editorGraphics;

            // UI Layer (Tooltip)
            const uiLayer = new Container();
            uiLayer.zIndex = 999999; // 最高层
            app.stage.addChild(uiLayer);
            const tooltipContainer = new Container();
            const tooltipBg = new Graphics();
            const tooltipText = new Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 12, fill: 0xffffff } });
            tooltipContainer.addChild(tooltipBg, tooltipText);
            tooltipContainer.visible = false;
            uiLayer.addChild(tooltipContainer);

            // 4. 加载资源
            console.log("📥 Loading assets...");
            await loadGameAssets([
                ...(ASSET_CONFIG.bg || []),
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
                const mode = GameStore.editor.mode;
                // --- A. 视觉压暗 (Dimming) ---
                // 遍历所有家具和房间，如果不属于当前地皮，则变暗
                if (activeId) {
                    furnViewsRef.current.forEach((container, id) => {
                        // 如果不属于当前 activeId，透明度设为 0.2
                        container.alpha = id.startsWith(activeId) ? 1.0 : 0.2;
                        // 且禁止交互(可选)
                    });
                    roomViewsRef.current.forEach((container, id) => {
                        container.alpha = id.startsWith(activeId) ? 1.0 : 0.2;
                    });
                } else {
                    // 恢复正常
                    furnViewsRef.current.forEach(c => c.alpha = 1.0);
                    roomViewsRef.current.forEach(c => c.alpha = 1.0);
                }
                // --- B. 绘制网格 ---
                if (gridLayerRef.current && activeId) {
                    drawActivePlotGrid(gridLayerRef.current, worldContainer.scale.x);
                } else if (gridLayerRef.current) {
                    gridLayerRef.current.clear();
                }

                // --- C. 拖拽预览 (Ghost) ---
                // 清理旧 Ghost
                while (previewLayer.children.length > 0) {
                    previewLayer.children[0].destroy();
                }
                // 如果正在拖拽或放置，生成半透明预览
                if (GameStore.editor.previewPos && (isDraggingObject.current || isStickyDragging.current || GameStore.editor.placingFurniture)) {
                    const { x, y } = GameStore.editor.previewPos;
                    let ghost: Container | null = null;
                    
                    // 1. 获取要渲染的物体数据
                    let targetFurniture: Partial<Furniture> | null = GameStore.editor.placingFurniture;
                    if (!targetFurniture && GameStore.editor.selectedFurnitureId) {
                         const found = GameStore.furniture.find(f => f.id === GameStore.editor.selectedFurnitureId);
                         targetFurniture = found || null; 
                    }

                    if (targetFurniture) {
                        // 使用 WorldBuilder 快速创建一个临时的 Container
                        // 注意：这里需要深拷贝或确保 createFurniture 不副作用
                        ghost = PixiWorldBuilder.createFurniture({ 
                            ...targetFurniture, 
                            x: 0, y: 0, // 局部坐标归零，由 container 决定位置
                            id: 'ghost',
                        } as any);
                    }

                    if (ghost) {
                        ghost.x = x;
                        ghost.y = y;
                        ghost.alpha = 0.6; // ✅ 半透明
                        // 变色提示：合法绿色，非法红色
                        const tintColor = GameStore.editor.isValidPlacement ? 0x00ff00 : 0xff0000;
                        
                        // 简单的染色逻辑 (给 Graphics 子对象染色)
                        ghost.children.forEach(c => {
                            if (c instanceof Sprite) c.tint = tintColor;
                            else if (c instanceof Graphics) c.tint = tintColor;
                        });
                        
                        previewLayer.addChild(ghost);
                    } else {
                        // 如果生成失败（比如是地皮），退化为线框
                        // ... (保留之前的 rect 逻辑)
                    }
                }
                
                if ((GameStore.editor.mode as string) !== 'none') {
                    // 绘制网格 (可选，稍微影响性能)
                    // editorGraphics.strokeStyle = { width: 1, color: 0xffffff, alpha: 0.1 };
                    // ... grid loop

                    // 绘制选中框
                    let selectedRect: { x: number, y: number, w: number, h: number } | null = null;
                    let strokeColor = 0x00ffff;

                    if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
                        const p = GameStore.worldLayout.find(x => x.id === GameStore.editor.selectedPlotId);
                        if (p) {
                            // 显式获取模板，并强制断言为 number，彻底消除 undefined 可能性
                            const tpl = PLOTS[p.templateId];
                            const w = (p.width ?? tpl?.width ?? 300) as number;
                            const h = (p.height ?? tpl?.height ?? 300) as number;
                            
                            selectedRect = { x: p.x, y: p.y, w, h };
                            strokeColor = 0x00ffff;
                        }
                    }else if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId) {
                        const f = GameStore.furniture.find(x => x.id === GameStore.editor.selectedFurnitureId);
                        if (f) { selectedRect = { x: f.x, y: f.y, w: f.w, h: f.h }; strokeColor = 0xffff00; }
                    } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                        const r = GameStore.rooms.find(x => x.id === GameStore.editor.selectedRoomId);
                        if (r) { selectedRect = { x: r.x, y: r.y, w: r.w, h: r.h }; strokeColor = 0x39ff14; }
                    }

                    if (selectedRect) {
                        editorGraphics.strokeStyle = { width: 2, color: strokeColor };
                        editorGraphics.rect(selectedRect.x, selectedRect.y, selectedRect.w, selectedRect.h).stroke();
                        // 绘制手柄
                        // @ts-ignore
                        if (GameStore.editor.activeTool !== 'camera') {
                            drawResizeHandles(editorGraphics, selectedRect.x, selectedRect.y, selectedRect.w, selectedRect.h);
                        }
                    }

                    // 绘制拖拽预览 (Ghost)
                    if (GameStore.editor.previewPos && (isDraggingObject.current || isStickyDragging.current)) {
                        const { x, y } = GameStore.editor.previewPos;
                        editorGraphics.strokeStyle = { width: 2, color: 0xffff00 };
                        
                        let w = 100, h = 100;
                        if (GameStore.editor.mode === 'furniture') {
                            const f = GameStore.furniture.find(i => i.id === GameStore.editor.selectedFurnitureId) || GameStore.editor.placingFurniture;
                            if (f) { w = f.w ?? 100; h = f.h ?? 100; }
                        } else if (GameStore.editor.mode === 'plot') {
                            const p = GameStore.worldLayout.find(i => i.id === GameStore.editor.selectedPlotId);
                            if (p) { 
                                w = p.width ?? PLOTS[p.templateId]?.width ?? 300;
                                h = p.height ?? PLOTS[p.templateId]?.height ?? 300;
                            } else if (GameStore.editor.placingTemplateId) {
                                const t = PLOTS[GameStore.editor.placingTemplateId];
                                if (t) { w = t.width; h = t.height; }
                            }
                        }
                        
                        editorGraphics.rect(x, y, w, h).stroke();
                        editorGraphics.fillStyle = 0xffffff;
                        editorGraphics.fill({ alpha: 0.2 });
                    }
                    
                    // 绘制框选 (Drawing)
                    const drawing = GameStore.editor.drawingFloor || GameStore.editor.drawingPlot;
                    if (drawing && isDraggingObject.current) {
                        const x = Math.min(drawing.startX, drawing.currX);
                        const y = Math.min(drawing.startY, drawing.currY);
                        const w = Math.abs(drawing.currX - drawing.startX);
                        const h = Math.abs(drawing.currY - drawing.startY);
                        editorGraphics.strokeStyle = { width: 1, color: 0xffff00 }; // dashed not easy in pixi, use solid
                        editorGraphics.rect(x, y, w, h).stroke();
                        editorGraphics.fillStyle = 0xffffff;
                        editorGraphics.fill({ alpha: 0.3 });
                    }
                }

                // B. Sim 渲染逻辑
                const currentSimLayer = simLayerRef.current;
                if (!currentSimLayer) return;

                if (GameStore.selectedSimId && !isDraggingCamera.current && GameStore.editor.mode === 'none') {
                    const sim = GameStore.sims.find(s => s.id === GameStore.selectedSimId);
                    if (sim && !isNaN(sim.pos.x)) {
                        const scale = worldContainer.scale.x;
                        const targetX = app.screen.width / 2 - sim.pos.x * scale;
                        const targetY = app.screen.height / 2 - sim.pos.y * scale;
                        worldContainer.x = lerp(worldContainer.x, targetX, 0.1);
                        worldContainer.y = lerp(worldContainer.y, targetY, 0.1);
                    }
                }

                const activeIds = new Set<string>();
                GameStore.sims.forEach(sim => {
                    if (isNaN(sim.pos.x) || isNaN(sim.pos.y)) return;

                    activeIds.add(sim.id);
                    let view = simViewsRef.current.get(sim.id);
                    
                    if (!view) {
                        view = new PixiSimView(sim);
                        currentSimLayer.addChild(view.container as any); 
                        simViewsRef.current.set(sim.id, view);
                    }

                    (view.container as any).zIndex = sim.pos.y;
                    view.updatePosition(sim);
                    view.showSelectionRing(GameStore.selectedSimId === sim.id);
                });

                // [修复后] 直接对 View 缓存进行检查，无论 Sim 数组是否为空
                if (simViewsRef.current.size > 0) {
                    simViewsRef.current.forEach((v, id) => { 
                        if (!activeIds.has(id)) { 
                            currentSimLayer.removeChild(v.container as any); 
                            v.destroy(); 
                            simViewsRef.current.delete(id); 
                        }
                    });
                }
                currentSimLayer.sortChildren();
                

                // 3. Tooltip 跟随
                if (hoveredTarget.current && hoveredTarget.current.label) {
                    tooltipContainer.visible = true;
                    tooltipText.text = hoveredTarget.current.label;
                    tooltipBg.clear().rect(0, 0, tooltipText.width + 10, tooltipText.height + 6).fill({ color: 0x000000, alpha: 0.7 });
                    tooltipText.x = 5; tooltipText.y = 3;
                    
                    // 坐标转换
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) {
                        tooltipContainer.x = lastMousePos.current.x - rect.left + 15;
                        tooltipContainer.y = lastMousePos.current.y - rect.top + 15;
                    }
                } else {
                    tooltipContainer.visible = false;
                }
            });
        };
        initGame();

        return () => {
            isCancelled = true;
            if (appInstance) appInstance.destroy({ removeView: true });
        };
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

    // === 交互事件 ===
    // === 完整版 handleMouseDown ===
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!worldContainerRef.current) return;
        const world = worldContainerRef.current;
        const rect = containerRef.current!.getBoundingClientRect();
        
        // 1. 计算世界坐标
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - world.x) / world.scale.x;
        const worldY = (mouseY - world.y) / world.scale.y;

        // 保存鼠标位置用于计算拖拽距离
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        dragStartMousePos.current = { x: e.clientX, y: e.clientY };

        // 2. 镜头操作：
        // A. 右键 (button 2) -> 始终允许拖拽
        // B. Space 键 + 左键 -> 始终允许拖拽
        // C. [修复] 普通模式(mode='none') -> 允许左键直接拖拽 (恢复原习惯)
        const isNormalMode = (GameStore.editor.mode as string) === 'none';
        const isCameraAction = e.button === 2 || (e.button === 0 && (isSpacePressed.current || isNormalMode));
        if (isCameraAction) {
            isDraggingCamera.current = true;
            if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
            return; // 镜头操作时，阻断后续的编辑逻辑
        }
        // [核心修复] 交互隔离
        if (e.button === 0 && GameStore.editor.mode !== 'none') {
            
            // --- A. 放置模式 ---
            const isPlacing = isStickyDragging.current || GameStore.editor.placingFurniture || GameStore.editor.placingTemplateId;
            
            if (isPlacing) {
                // 检查位置合法性
                if (!GameStore.editor.isValidPlacement) {
                    GameStore.showToast("⚠️ 红色区域无法放置！");
                    return;
                }

                const finalPos = GameStore.editor.previewPos || {x: 0, y: 0};
                const isShiftHeld = e.shiftKey; 

                if (GameStore.editor.placingTemplateId) {
                    GameStore.placePlot(finalPos.x, finalPos.y);
                } 
                else if (GameStore.editor.placingFurniture) {
                    GameStore.editor.placeFurniture(finalPos.x, finalPos.y, isShiftHeld);
                } 
                else if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId) {
                    GameStore.finalizeMove('furniture', GameStore.editor.selectedFurnitureId, dragStartPos.current);
                }
                else if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
                     GameStore.finalizeMove('plot', GameStore.editor.selectedPlotId, dragStartPos.current);
                }
                else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                     GameStore.finalizeMove('room', GameStore.editor.selectedRoomId, dragStartPos.current);
                }
                
                if (!isShiftHeld && !GameStore.editor.drawingFloor && !GameStore.editor.drawingPlot) {
                    isStickyDragging.current = false;
                    isDraggingObject.current = false;
                    GameStore.editor.previewPos = null;
                }
                
                refreshWorld();
                return;
            }

            // --- B. 绘制模式 ---
            if (GameStore.editor.drawingFloor || GameStore.editor.drawingPlot) {
                isDraggingObject.current = true;
                const gridSize = GameStore.editor.gridSize || 50;
                const gridSnapX = Math.round(worldX / gridSize) * gridSize;
                const gridSnapY = Math.round(worldY / gridSize) * gridSize;

                if (GameStore.editor.drawingFloor) {
                    GameStore.editor.drawingFloor.startX = gridSnapX;
                    GameStore.editor.drawingFloor.startY = gridSnapY;
                    GameStore.editor.drawingFloor.currX = gridSnapX;
                    GameStore.editor.drawingFloor.currY = gridSnapY;
                }
                if (GameStore.editor.drawingPlot) {
                    GameStore.editor.drawingPlot.startX = gridSnapX;
                    GameStore.editor.drawingPlot.startY = gridSnapY;
                    GameStore.editor.drawingPlot.currX = gridSnapX;
                    GameStore.editor.drawingPlot.currY = gridSnapY;
                }
                return;
            }

            // --- C. 选择模式 (Select Mode) - 仅在非放置模式下触发 ---
            if ((GameStore.editor.mode as string) !== 'none') {
                
                // ==========================
                // 1. 检测 Resize Handle (调整大小手柄)
                // ==========================
                let resizeTarget: { x: number, y: number, w: number, h: number } | null = null;
                
                // 获取当前选中物体的边界框 (只有 Plot 和 Floor 支持缩放)
                if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
                    const p = GameStore.worldLayout.find(x => x.id === GameStore.editor.selectedPlotId);
                    if (p) {
                        const tpl = PLOTS[p.templateId];
                        // 确保宽高有默认值，防止 TS 报错
                        const w = (p.width ?? tpl?.width ?? 300) as number;
                        const h = (p.height ?? tpl?.height ?? 300) as number;
                        resizeTarget = { x: p.x, y: p.y, w, h };
                    }
                } 
                else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                    const r = GameStore.rooms.find(x => x.id === GameStore.editor.selectedRoomId);
                    if (r) {
                        resizeTarget = { x: r.x, y: r.y, w: r.w, h: r.h };
                    }
                }

                // 如果有选中目标，检测是否点中了四个角的手柄
                if (resizeTarget) {
                    const { x, y, w, h } = resizeTarget;
                    const size = 20 / world.scale.x; // 手柄大小随缩放调整，保持视觉一致
                    const half = size / 2;

                    // 检查四个角 (NW, NE, SW, SE)
                    if (Math.abs(worldX - x) < half && Math.abs(worldY - y) < half) activeResizeHandle.current = 'nw';
                    else if (Math.abs(worldX - (x + w)) < half && Math.abs(worldY - y) < half) activeResizeHandle.current = 'ne';
                    else if (Math.abs(worldX - x) < half && Math.abs(worldY - (y + h)) < half) activeResizeHandle.current = 'sw';
                    else if (Math.abs(worldX - (x + w)) < half && Math.abs(worldY - (y + h)) < half) activeResizeHandle.current = 'se';

                    if (activeResizeHandle.current) {
                        isResizing.current = true;
                        resizeStartRect.current = { x, y, w, h };
                        // 阻止后续的选中逻辑
                        return;
                    }
                }

                // ==========================
                // 2. 物体命中检测 (Hit Test)
                // ==========================
                let hitObj: any = null;
                let hitType = '';
                // 如果处于建筑模式，强制只检测当前地皮内的物体
                const activeId = GameStore.editor.activePlotId;

                // 家具检测
                if (GameStore.editor.mode === 'furniture') {
                    hitObj = [...GameStore.furniture].reverse().find(f => {
                        // ✅ 过滤：如果 activeId 存在，必须匹配前缀
                        if (activeId && !f.id.startsWith(activeId)) return false;
                        return worldX >= f.x && worldX <= f.x + f.w && worldY >= f.y && worldY <= f.y + f.h;
                    });
                    if (hitObj) hitType = 'furniture';
                }
                // 地皮检测 (Build Mode 下通常禁止选其他地皮)
                else if (GameStore.editor.mode === 'plot') {
                    // 如果在装修模式，禁止点选其他地皮，只能选当前地皮(通常没必要，除非要改大小)
                    // 这里我们假设装修模式下不能选地皮本身，只能选 activePlot
                    if (activeId) {
                         // do nothing or select active plot
                    } else {
                        // 如果没点中 Room，检查是否点中了 Plot 基础底板
                         const plot = GameStore.worldLayout.find(p => {
                            const tpl = PLOTS[p.templateId];
                            const w = p.width ?? tpl?.width ?? 300;
                            const h = p.height ?? tpl?.height ?? 300;
                            return worldX >= p.x && worldX <= p.x + w && worldY >= p.y && worldY <= p.y + h;
                         });
                         if (plot) { hitObj = plot; hitType = 'plot'; }
                    }
                } 
                else if (GameStore.editor.mode === 'floor') {
                    // 选中房间/地板
                    hitObj = [...GameStore.rooms].reverse().find(r => 
                        worldX >= r.x && worldX <= r.x + r.w && worldY >= r.y && worldY <= r.y + r.h
                    );
                    if (hitObj) hitType = 'floor';
                }

                // ==========================
                // 3. 处理选中结果与拖拽初始化
                // ==========================
                if (hitObj) {
                    // 更新 Store 中的选中 ID
                    if (hitType === 'plot') GameStore.editor.selectedPlotId = hitObj.id;
                    else if (hitType === 'furniture') GameStore.editor.selectedFurnitureId = hitObj.id;
                    else if (hitType === 'floor') GameStore.editor.selectedRoomId = hitObj.id;
                    
                    // 准备拖拽 (点击即拿起的逻辑)
                    GameStore.editor.isDragging = true;
                    isDraggingObject.current = true;
                    
                    // 计算点击点相对于物体左上角的偏移，防止物体跳动 (保持相对位置)
                    GameStore.editor.dragOffset = { x: worldX - hitObj.x, y: worldY - hitObj.y };
                    
                    // 初始化预览位置
                    GameStore.editor.previewPos = { x: hitObj.x, y: hitObj.y };
                    dragStartPos.current = { x: hitObj.x, y: hitObj.y };

                    // 立即更新一次 Ghost 位置，让它状态同步
                    GameStore.editor.updatePreviewPos(worldX, worldY);

                } else {
                    // 点击空白处，取消所有选中
                    GameStore.editor.selectedPlotId = null;
                    GameStore.editor.selectedFurnitureId = null;
                    GameStore.editor.selectedRoomId = null;
                }
                
                // 通知 UI 更新 (选中框需要重绘)
                GameStore.notify(); 
            }
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

        // 1. Camera Pan
        if (isDraggingCamera.current) {
            // 如果拖动距离超过 1px，则视为有意拖动，取消当前选中
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                if (GameStore.selectedSimId) {
                    GameStore.selectedSimId = null;
                    GameStore.notify();
                }
            }
            world.x += dx;
            world.y += dy;
            return;
        }

        // 2. 编辑模式逻辑
        if (GameStore.editor.mode !== 'none') {
            
            // A. 放置模式预览 (Sticky Preview)
            // 只要有待放置的物体，无论是否按下鼠标，都更新位置
            if (GameStore.editor.placingTemplateId || GameStore.editor.placingFurniture || GameStore.editor.isDragging) {
                GameStore.editor.updatePreviewPos(worldX, worldY);
                // 强制触发 UI 重绘以显示 Ghost
                GameStore.notify(); 
            }

            // B. 绘制模式 (拉框)
            if (isDraggingObject.current && (GameStore.editor.drawingFloor || GameStore.editor.drawingPlot)) {
                const gridSize = GameStore.editor.gridSize || 50;
                // 绘制时强制吸附网格
                const snapX = Math.round(worldX / gridSize) * gridSize;
                const snapY = Math.round(worldY / gridSize) * gridSize;

                if (GameStore.editor.drawingFloor) {
                    GameStore.editor.drawingFloor.currX = snapX;
                    GameStore.editor.drawingFloor.currY = snapY;
                }
                if (GameStore.editor.drawingPlot) {
                    GameStore.editor.drawingPlot.currX = snapX;
                    GameStore.editor.drawingPlot.currY = snapY;
                }
                // 通知重绘虚线框
                GameStore.notify();
            }

            // C. 调整大小 (Resizing)
            if (isResizing.current && activeResizeHandle.current) {
                const startR = resizeStartRect.current;
                let newRect = { ...startR };
                // 简单实现：仅支持右下角拖动
                if (activeResizeHandle.current === 'se') {
                    newRect.w = Math.max(50, worldX - startR.x);
                    newRect.h = Math.max(50, worldY - startR.y);
                }
                // Snap
                newRect.w = Math.round(newRect.w / 50) * 50;
                newRect.h = Math.round(newRect.h / 50) * 50;
                
                // Apply
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

       

        // 4. Hover Check (Cursor)
        if (GameStore.editor.mode === 'none') {
            const hit = GameStore.worldGrid.queryHit(worldX, worldY);
            if (hit && hit.type === 'furniture') {
                hoveredTarget.current = hit.ref;
                if(containerRef.current) containerRef.current.style.cursor = 'pointer';
            } else {
                hoveredTarget.current = null;
                if(containerRef.current) containerRef.current.style.cursor = 'default';
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
                // 计算标准化矩形 (处理负宽高)
                const x = Math.min(d.startX, d.currX);
                const y = Math.min(d.startY, d.currY);
                const w = Math.abs(d.currX - d.startX);
                const h = Math.abs(d.currY - d.startY);

                if (w > 0 && h > 0) {
                    GameStore.createCustomRoom({x, y, w, h}, d.pattern, d.color, d.label, d.hasWall);
                }
                GameStore.editor.drawingFloor = null; // 重置状态
                isDraggingObject.current = false;
                refreshWorld();
                return;
            }

            // 2. 提交绘制的地皮
            if (GameStore.editor.drawingPlot) {
                const d = GameStore.editor.drawingPlot;
                const x = Math.min(d.startX, d.currX);
                const y = Math.min(d.startY, d.currY);
                const w = Math.abs(d.currX - d.startX);
                const h = Math.abs(d.currY - d.startY);

                if (w > 0 && h > 0) {
                    GameStore.createCustomPlot({x, y, w, h}, d.templateId);
                }
                GameStore.editor.drawingPlot = null;
                isDraggingObject.current = false;
                refreshWorld();
                return;
            }
        }

        // Sticky Drag Mode Logic
        if (GameStore.editor.mode !== 'none' && GameStore.editor.isDragging) {
            if (isClick && !isStickyDragging.current && !GameStore.editor.placingTemplateId && !GameStore.editor.placingFurniture) {
                isStickyDragging.current = true; // 进入“粘鼠”模式
                return;
            }
            
            if (!isClick && !isStickyDragging.current) {
                // 拖拽结束
                GameStore.editor.isDragging = false;
                const finalPos = GameStore.editor.previewPos || {x: 0, y: 0};
                if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId) {
                    GameStore.finalizeMove('furniture', GameStore.editor.selectedFurnitureId, dragStartPos.current);
                } else if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
                    GameStore.finalizeMove('plot', GameStore.editor.selectedPlotId, dragStartPos.current);
                }
                isDraggingObject.current = false;
                refreshWorld();
            }
        }
        if (GameStore.editor.isDragging && !isStickyDragging.current) {
            // 拖拽结束，确认移动
             if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId) {
                GameStore.finalizeMove('furniture', GameStore.editor.selectedFurnitureId, dragStartPos.current);
            } else if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
                GameStore.finalizeMove('plot', GameStore.editor.selectedPlotId, dragStartPos.current);
            } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                GameStore.finalizeMove('room', GameStore.editor.selectedRoomId, dragStartPos.current);
            }
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
            <div 
                ref={containerRef} 
                className="w-full h-full"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
                onContextMenu={e => e.preventDefault()}
            />
            <div className={`absolute inset-0 flex items-center justify-center text-white bg-black/80 z-50 transition-opacity duration-500 ${loading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                LOADING...
            </div>
        </div>
    );
};

export default React.memo(PixiGameCanvasComponent);
