
import React, { useEffect, useRef, useState } from 'react';
import { Application, Container, Sprite, TextureStyle, Graphics, Text } from 'pixi.js';
import { ASSET_CONFIG, CONFIG } from '../constants';
import { loadGameAssets } from '../utils/assetLoader';
import { GameStore } from '../utils/GameStore';
import { PixiSimView } from '../utils/render/PixiSimView';
import { PixiWorldBuilder } from '../utils/render/PixiWorldBuilder';
import { gameLoopStep } from '../utils/GameLoop';
import { PLOTS } from '../data/plots'; // 需要导入

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

    // 监听刷新
    useEffect(() => {
        if (!loading && worldContainerRef.current) refreshWorld();
    }, [editorRefresh, loading]);

    // === Web Worker 驱动逻辑 ===
    useEffect(() => {
        
        const workerCode = `
            let lastTime = Date.now();
            setInterval(() => {
                const now = Date.now();
                const dt = (now - lastTime) / 16.66;
                lastTime = now;
                self.postMessage(dt);
            }, 16);
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));

        worker.onmessage = (e) => {
            const dt = e.data;
            if (GameStore.editor.mode === 'none') {
                gameLoopStep(dt);
            }
        };

        return () => worker.terminate();
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

            const worldContainer = new Container();
            worldContainer.sortableChildren = true;
            app.stage.addChild(worldContainer);
            worldContainerRef.current = worldContainer;

            // [新增] 编辑器 UI 层 (绘制选中框等)
            const editorGraphics = new Graphics();
            editorGraphics.zIndex = 99999;
            worldContainer.addChild(editorGraphics);
            editorLayerRef.current = editorGraphics;

            const simLayer = new Container();
            simLayer.sortableChildren = true;
            simLayer.zIndex = 10000;
            worldContainer.addChild(simLayer);
            simLayerRef.current = simLayer;

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
                if (GameStore.editor.mode !== 'none') {
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

                if (GameStore.sims.length > 0) {
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
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0 || !worldContainerRef.current) return;
        const world = worldContainerRef.current;
        const rect = containerRef.current!.getBoundingClientRect();
        
        // 转换坐标
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - world.x) / world.scale.x;
        const worldY = (mouseY - world.y) / world.scale.y;

        lastMousePos.current = { x: e.clientX, y: e.clientY };
        dragStartMousePos.current = { x: e.clientX, y: e.clientY };

        // 1. 处理放置新物体 (Sticky Drop)
        const isPlacingNew = !!(GameStore.editor.placingTemplateId || GameStore.editor.placingFurniture);
        if (isStickyDragging.current || isPlacingNew) {
            GameStore.editor.isDragging = false;
            const finalPos = GameStore.editor.previewPos || {x: 0, y: 0};
            
            if (GameStore.editor.placingTemplateId) GameStore.placePlot(finalPos.x, finalPos.y);
            else if (GameStore.editor.placingFurniture) GameStore.placeFurniture(finalPos.x, finalPos.y);
            else if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) GameStore.finalizeMove('plot', GameStore.editor.selectedPlotId, dragStartPos.current);
            else if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId) GameStore.finalizeMove('furniture', GameStore.editor.selectedFurnitureId, dragStartPos.current);
            else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) GameStore.finalizeMove('room', GameStore.editor.selectedRoomId, dragStartPos.current);

            isStickyDragging.current = false;
            isDraggingObject.current = false;
            refreshWorld(); // 强制刷新 Pixi 场景
            return;
        }

        // 2. 普通漫游
        if (GameStore.editor.mode === 'none' || (GameStore.editor.activeTool as any) === 'camera') {
            isDraggingCamera.current = true;
            if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
            return;
        }

        // 3. 编辑模式：绘制
        if (GameStore.editor.drawingFloor || GameStore.editor.drawingPlot) {
            isDraggingObject.current = true;
            const gridSnapX = Math.round(worldX / 50) * 50;
            const gridSnapY = Math.round(worldY / 50) * 50;
            if(GameStore.editor.drawingFloor) { GameStore.editor.drawingFloor.startX = gridSnapX; GameStore.editor.drawingFloor.startY = gridSnapY; GameStore.editor.drawingFloor.currX = gridSnapX; GameStore.editor.drawingFloor.currY = gridSnapY; }
            if(GameStore.editor.drawingPlot) { GameStore.editor.drawingPlot.startX = gridSnapX; GameStore.editor.drawingPlot.startY = gridSnapY; GameStore.editor.drawingPlot.currX = gridSnapX; GameStore.editor.drawingPlot.currY = gridSnapY; }
            return;
        }

        // 4. 编辑模式：选择与操作
        // 检测 Resize Handle
        // [修复] 显式定义类型，解决 'assignable to type null' 和 'Property does not exist on never'
        let resizeTarget: { x: number, y: number, w: number, h: number } | null = null;
        if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
            const p = GameStore.worldLayout.find(x => x.id === GameStore.editor.selectedPlotId);
            if(p) {
                // 同样显式修复这里的类型推断
                const tpl = PLOTS[p.templateId];
                const w = (p.width ?? tpl?.width ?? 300) as number;
                const h = (p.height ?? tpl?.height ?? 300) as number;
                
                resizeTarget = { x: p.x, y: p.y, w, h };
            }
        }else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
            const r = GameStore.rooms.find(x => x.id === GameStore.editor.selectedRoomId);
            if(r) resizeTarget = { x: r.x, y: r.y, w: r.w, h: r.h };
        }

        if (resizeTarget) {
            const { x, y, w, h } = resizeTarget;
            const size = 20 / world.scale.x; 
            const half = size / 2;
            if (Math.abs(worldX - x) < half && Math.abs(worldY - y) < half) activeResizeHandle.current = 'nw';
            else if (Math.abs(worldX - (x+w)) < half && Math.abs(worldY - y) < half) activeResizeHandle.current = 'ne';
            else if (Math.abs(worldX - x) < half && Math.abs(worldY - (y+h)) < half) activeResizeHandle.current = 'sw';
            else if (Math.abs(worldX - (x+w)) < half && Math.abs(worldY - (y+h)) < half) activeResizeHandle.current = 'se';
            
            if (activeResizeHandle.current) {
                isResizing.current = true;
                resizeStartRect.current = { x, y, w, h };
                isDraggingObject.current = true;
                return;
            }
        }

        // 选中物体 (Hit Test)
        let hitObj: any = null;
        let hitType = '';

        if (GameStore.editor.mode === 'furniture') {
            hitObj = [...GameStore.furniture].reverse().find(f => worldX >= f.x && worldX <= f.x + f.w && worldY >= f.y && worldY <= f.y + f.h);
            if (hitObj) hitType = 'furniture';
        } else if (GameStore.editor.mode === 'plot') {
            const room = GameStore.rooms.find(r => worldX >= r.x && worldX <= r.x + r.w && worldY >= r.y && worldY <= r.y + r.h);
            if (room) {
                const plot = GameStore.worldLayout.find(p => room.id.startsWith(p.id));
                if (plot) { hitObj = plot; hitType = 'plot'; }
            }
        } else if (GameStore.editor.mode === 'floor') {
            hitObj = [...GameStore.rooms].reverse().find(r => worldX >= r.x && worldX <= r.x + r.w && worldY >= r.y && worldY <= r.y + r.h);
            if (hitObj) hitType = 'floor';
        }

        if (hitObj) {
            if (hitType === 'plot') GameStore.editor.selectedPlotId = hitObj.id;
            else if (hitType === 'furniture') GameStore.editor.selectedFurnitureId = hitObj.id;
            else if (hitType === 'floor') GameStore.editor.selectedRoomId = hitObj.id;
            
            GameStore.editor.isDragging = true;
            isDraggingObject.current = true;
            GameStore.editor.dragOffset = { x: worldX - hitObj.x, y: worldY - hitObj.y };
            GameStore.editor.previewPos = { x: hitObj.x, y: hitObj.y };
            dragStartPos.current = { x: hitObj.x, y: hitObj.y };
        } else {
            GameStore.editor.selectedPlotId = null;
            GameStore.editor.selectedFurnitureId = null;
            GameStore.editor.selectedRoomId = null;
        }
        GameStore.notify();
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
            if (Math.abs(dx) > 0 || Math.abs(dy) > 0) isCameraLocked.current = false;
            world.x += dx;
            world.y += dy;
            return;
        }

        // 2. Resize Logic
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

        // 3. Move Logic
        if (GameStore.editor.mode !== 'none' && (GameStore.editor.isDragging || isStickyDragging.current)) {
            const gridSize = 10;
            const rawX = worldX - (isStickyDragging.current ? 0 : GameStore.editor.dragOffset.x);
            const rawY = worldY - (isStickyDragging.current ? 0 : GameStore.editor.dragOffset.y);
            const newX = Math.round(rawX / gridSize) * gridSize;
            const newY = Math.round(rawY / gridSize) * gridSize;
            GameStore.editor.previewPos = { x: newX, y: newY };
            return;
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
    
    // 修正后的 MouseMove 逻辑，包含悬停检测
    const onMouseMove = (e: React.MouseEvent) => {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        
        // 1. 镜头拖拽
        if (isDraggingCamera.current && worldContainerRef.current) {
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                if (GameStore.selectedSimId) {
                    GameStore.selectedSimId = null;
                    GameStore.notify();
                }
            }
            worldContainerRef.current.x += dx;
            worldContainerRef.current.y += dy;
        }

        // 2. ✨ 悬停检测 (Hover Check)
        if (GameStore.editor.mode === 'none' && worldContainerRef.current && containerRef.current) {
            const world = worldContainerRef.current;
            const rect = containerRef.current.getBoundingClientRect();
            // 将屏幕坐标转换为世界坐标
            const worldX = (e.clientX - rect.left - world.x) / world.scale.x;
            const worldY = (e.clientY - rect.top - world.y) / world.scale.y;

            // 使用空间哈希网格查询碰撞
            const hit = GameStore.worldGrid.queryHit(worldX, worldY);
            if (hit && hit.type === 'furniture') {
                hoveredTarget.current = hit.ref;
                if(containerRef.current) containerRef.current.style.cursor = 'pointer';
            } else {
                hoveredTarget.current = null;
                if(containerRef.current && !isDraggingCamera.current) containerRef.current.style.cursor = 'default';
            }
        }

        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };
    
    const handleMouseUp = (e: React.MouseEvent) => {
        const dragDist = Math.sqrt(Math.pow(e.clientX - dragStartMousePos.current.x, 2) + Math.pow(e.clientY - dragStartMousePos.current.y, 2));
        const isClick = dragDist < 5;

        if (isDraggingCamera.current) {
            isDraggingCamera.current = false;
            if (containerRef.current) containerRef.current.style.cursor = 'default';
        }
        
        if (isResizing.current) {
            isResizing.current = false;
            activeResizeHandle.current = null;
            // 触发更新
            GameStore.triggerMapUpdate();
            return;
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
