import React, { useEffect, useRef, useState } from 'react';
import { Application, Container, Sprite, Graphics } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { ASSET_CONFIG, CONFIG } from '../constants';
import { loadGameAssets } from '../utils/assetLoader';
import { GameStore } from '../utils/GameStore';
import { PixiSimView } from '../utils/render/PixiSimView';
import { PixiWorldBuilder } from '../utils/render/PixiWorldBuilder';
import { gameLoopStep } from '../utils/GameLoop';
import { PLOTS } from '../data/plots';

// 简单的线性插值
const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

const PixiGameCanvas: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const viewportRef = useRef<Viewport | null>(null);
    
    // --- 图层引用 ---
    const floorLayerRef = useRef<Container | null>(null);
    const objectLayerRef = useRef<Container | null>(null);
    const gridLayerRef = useRef<Graphics | null>(null); // [优化] 网格层独立
    
    // --- 实体缓存 ---
    const simViewsRef = useRef<Map<string, PixiSimView>>(new Map());
    const furnViewsRef = useRef<Map<string, Container>>(new Map());
    const roomViewsRef = useRef<Map<string, Graphics>>(new Map());

    // --- UI/Ghost ---
    const uiLayerRef = useRef<Container | null>(null);
    const ghostLayerRef = useRef<Container | null>(null);

    // --- 交互状态 ---
    const lastMousePos = useRef({ x: 0, y: 0 });
    const dragStartMousePos = useRef({ x: 0, y: 0 });
    const dragStartPos = useRef({ x: 0, y: 0 });
    const isDraggingObject = useRef(false);
    const isStickyDragging = useRef(false);
    const isResizing = useRef(false);
    const activeResizeHandle = useRef<string | null>(null);
    const resizeStartRect = useRef({ x: 0, y: 0, w: 0, h: 0 });

    const [loading, setLoading] = useState(true);
    const [showInstructions, setShowInstructions] = useState(false);
    const prevModeRef = useRef(GameStore.editor.mode);
    
    const lastMapVersionRef = useRef(GameStore.mapVersion);
    const [, forceUpdate] = useState(0);

    // --- 1. 核心修复：绘制静态网格 (只执行一次) ---
    const drawGrid = (graphics: Graphics) => {
        graphics.clear();
        graphics.strokeStyle = { width: 1, color: 0xffffff, alpha: 0.08 }; // 很淡的线
        const w = CONFIG.CANVAS_W; 
        const h = CONFIG.CANVAS_H;
        const step = 50;
        
        // 一次性绘制所有线条
        for (let x = 0; x <= w; x += step) { graphics.moveTo(x, 0); graphics.lineTo(x, h); }
        for (let y = 0; y <= h; y += step) { graphics.moveTo(0, y); graphics.lineTo(w, y); }
        graphics.stroke();
    };

    // --- 2. 刷新世界 (仅在地图变化时调用) ---
    const refreshWorld = () => {
        if (!floorLayerRef.current || !objectLayerRef.current) return;
        const floorLayer = floorLayerRef.current;
        const objectLayer = objectLayerRef.current;

        // 清理旧对象
        furnViewsRef.current.forEach(v => v.destroy({ children: true })); furnViewsRef.current.clear();
        roomViewsRef.current.forEach(v => v.destroy()); roomViewsRef.current.clear();
        
        // 重建地板 (Z-Index -100, 不排序)
        GameStore.rooms.forEach(room => {
            const g = PixiWorldBuilder.createRoom(room);
            floorLayer.addChild(g);
            roomViewsRef.current.set(room.id, g);
        });

        // 重建家具 (Z-Index 0, 开启排序)
        GameStore.furniture.forEach(furn => {
            const c = PixiWorldBuilder.createFurniture(furn);
            c.zIndex = furn.y + (furn.h || 0);
            objectLayer.addChild(c);
            furnViewsRef.current.set(furn.id, c);
        });

        objectLayer.sortChildren();
    };

    // 监听 Store 变化触发刷新
    useEffect(() => {
        if (lastMapVersionRef.current !== GameStore.mapVersion) {
            lastMapVersionRef.current = GameStore.mapVersion;
            refreshWorld();
        }
    });

    // --- 3. 实时 UI 更新 (每一帧调用，但只画简单的框) ---
    const updateEditorVisuals = () => {
        if (!uiLayerRef.current || !ghostLayerRef.current || !appRef.current || !viewportRef.current) return;
        const ui = uiLayerRef.current;
        const ghost = ghostLayerRef.current;

        // 清空上一帧的 UI (注意：不再清空 GridLayer)
        ui.removeChildren(); 
        ghost.removeChildren();

        if (GameStore.editor.mode === 'none') {
            setShowInstructions(false);
            return;
        }

        const zoom = viewportRef.current.scaled || 1;
        
        // 控制网格可见性 (缩放太小时隐藏)
        if (gridLayerRef.current) {
            gridLayerRef.current.visible = zoom > 0.4;
        }

        // 绘制选中框 (轻量级)
        const drawBox = (x: number, y: number, w: number, h: number, color: number) => {
            const g = new Graphics();
            g.rect(x, y, w, h).stroke({ width: 2/zoom, color });
            ui.addChild(g);
            // 只有 plot 和 room 模式显示手柄
            if (['plot', 'floor'].includes(GameStore.editor.mode)) {
                const s = 10 / zoom, half = s/2;
                [{x:x-half,y:y-half}, {x:x+w-half,y:y-half}, {x:x-half,y:y+h-half}, {x:x+w-half,y:y+h-half}].forEach(p => {
                    const hG = new Graphics().rect(p.x, p.y, s, s).fill(0xffffff).stroke({width:1/zoom, color:0});
                    ui.addChild(hG);
                });
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

        // 绘制 Ghost / 拖拽预览
        if (GameStore.editor.previewPos) {
            const { x, y } = GameStore.editor.previewPos;
            let w = 100, h = 100;
            if (GameStore.editor.mode === 'furniture') {
                const f = GameStore.furniture.find(i => i.id === GameStore.editor.selectedFurnitureId) || GameStore.editor.placingFurniture;
                if (f) { 
                    w = f.w || 50; h = f.h || 50; 
                    if(GameStore.editor.placingFurniture) {
                        const container = PixiWorldBuilder.createFurniture({ ...GameStore.editor.placingFurniture, x: 0, y: 0 } as any);
                        container.x = x; container.y = y; container.alpha = 0.5;
                        ghost.addChild(container);
                    }
                }
            } else if (GameStore.editor.mode === 'plot') {
                const p = GameStore.worldLayout.find(i => i.id === GameStore.editor.selectedPlotId);
                const tplId = p ? p.templateId : GameStore.editor.placingTemplateId;
                if (tplId) { const tpl = PLOTS[tplId]; if (tpl) { w = tpl.width; h = tpl.height; } } 
                else if (p) { w = p.width || 300; h = p.height || 300; }
            } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                const r = GameStore.rooms.find(i => i.id === GameStore.editor.selectedRoomId);
                if (r) { w = r.w; h = r.h; }
            }

            if (!GameStore.editor.placingFurniture) {
                const g = new Graphics().rect(x, y, w, h).fill({ color: 0xffffff, alpha: 0.2 }).stroke({ width: 2, color: 0xffff00 });
                ghost.addChild(g);
            }
        }
    };

    useEffect(() => {
        const initGame = async () => {
            if (!containerRef.current) return;
            const app = new Application();
            await app.init({
                background: '#121212', 
                resizeTo: containerRef.current, 
                antialias: true,
                resolution: window.devicePixelRatio || 1, 
                autoDensity: true, 
                preference: 'webgl',
            });
            containerRef.current.appendChild(app.canvas);
            appRef.current = app;

            await loadGameAssets([...ASSET_CONFIG.bg, ...ASSET_CONFIG.face, ...ASSET_CONFIG.hair, ...ASSET_CONFIG.clothes, ...ASSET_CONFIG.pants]);
            setLoading(false);

            // [核心修复] Viewport 允许左键拖拽 (mouseButtons: 'left')
            const viewport = new Viewport({
                screenWidth: app.screen.width, 
                screenHeight: app.screen.height,
                worldWidth: CONFIG.CANVAS_W, 
                worldHeight: CONFIG.CANVAS_H,
                events: app.renderer.events, // 必须传递 events
                ticker: app.ticker,
            });
            app.stage.addChild(viewport);
            viewportRef.current = viewport;
            
            // 启用左键拖拽 ('left')，同时启用滚轮缩放
            viewport
                .drag({ mouseButtons: 'left' }) 
                .pinch()
                .wheel()
                .decelerate()
                .clampZoom({ minScale: 0.1, maxScale: 4.0 });
            
            viewport.sortableChildren = true; 

            // --- 1. 背景层 ---
            const bgPath = ASSET_CONFIG.bg[0];
            if (bgPath) {
                const bg = Sprite.from(bgPath);
                bg.width = CONFIG.CANVAS_W; bg.height = CONFIG.CANVAS_H; bg.zIndex = -999; bg.eventMode = 'none';
                viewport.addChild(bg);
            }
            
            // --- 2. 地板层 ---
            const floorLayer = new Container();
            floorLayer.zIndex = -100;
            floorLayer.sortableChildren = false; // 关闭排序，极大提升FPS
            viewport.addChild(floorLayer);
            floorLayerRef.current = floorLayer;

            // --- 3. 网格层 (静态) ---
            const gridL = new Graphics(); 
            gridL.zIndex = -50; // 在地板之上，物体之下
            drawGrid(gridL);    // [优化] 只绘制一次
            viewport.addChild(gridL); 
            gridLayerRef.current = gridL;

            // --- 4. 物体层 (开启排序) ---
            const objectLayer = new Container();
            objectLayer.zIndex = 0;
            objectLayer.sortableChildren = true; 
            viewport.addChild(objectLayer);
            objectLayerRef.current = objectLayer;

            // --- 5. UI层 ---
            const ghostL = new Container(); ghostL.zIndex = 1000; viewport.addChild(ghostL); ghostLayerRef.current = ghostL;
            const uiL = new Container(); uiL.zIndex = 1001; viewport.addChild(uiL); uiLayerRef.current = uiL;

            refreshWorld(); 
            viewport.moveCenter(CONFIG.CANVAS_W / 2, CONFIG.CANVAS_H / 2);
            viewport.setZoom(0.8);

            // --- Ticker ---
            app.ticker.add((ticker) => {
                const dt = ticker.deltaTime;
                
                // 限制逻辑更新频率，防止过热 (可选)
                gameLoopStep(dt); 

                // 镜头跟随
                if (GameStore.selectedSimId && GameStore.editor.mode === 'none' && !isDraggingObject.current) {
                    const sim = GameStore.sims.find(s => s.id === GameStore.selectedSimId);
                    if (sim) {
                        const cur = viewport.center;
                        viewport.moveCenter(lerp(cur.x, sim.pos.x, 0.1), lerp(cur.y, sim.pos.y, 0.1));
                    }
                }

                // 同步 Sims
                const activeIds = new Set<string>();
                GameStore.sims.forEach(sim => {
                    activeIds.add(sim.id);
                    let view = simViewsRef.current.get(sim.id);
                    if (!view) {
                        view = new PixiSimView(sim);
                        objectLayer.addChild(view.container);
                        simViewsRef.current.set(sim.id, view);
                    }
                    view.updatePosition(sim);
                    
                    // 仅当 Z 轴发生大变化时才更新 zIndex，减少排序压力
                    const newZ = sim.pos.y;
                    if (Math.abs(view.container.zIndex - newZ) > 1) {
                         view.container.zIndex = newZ;
                    }

                    if (GameStore.selectedSimId === sim.id) {
                        view.container.alpha = 1; view.container.scale.set(1.1); view.showSelectionRing(true);
                        view.container.zIndex = newZ + 2; // 选中时稍微前置
                    } else {
                        view.container.alpha = 1; view.container.scale.set(1.0); view.showSelectionRing(false);
                    }
                });
                
                simViewsRef.current.forEach((v, id) => { 
                    if(!activeIds.has(id)) { 
                        if (objectLayerRef.current) objectLayerRef.current.removeChild(v.container);
                        v.destroy(); 
                        simViewsRef.current.delete(id); 
                    }
                });

                // 这里不再重绘 Grid，只更新简单的选框
                updateEditorVisuals();
            });
        };
        initGame();
        return () => { if (appRef.current) { appRef.current.destroy({ removeView: true }); appRef.current = null; } };
    }, []);

    useEffect(() => {
        const unsub = GameStore.subscribe(() => {
            if (prevModeRef.current === 'none' && GameStore.editor.mode !== 'none') setShowInstructions(true);
            prevModeRef.current = GameStore.editor.mode;
            
            if (lastMapVersionRef.current !== GameStore.mapVersion) {
                forceUpdate(n => n + 1);
            }
        });
        return unsub;
    }, []);

    // --- 交互处理 (关键修改) ---
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!viewportRef.current || e.button !== 0) return; // 只处理左键
        const pt = viewportRef.current.toWorld(e.clientX, e.clientY);
        const wX = pt.x, wY = pt.y;
        
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        dragStartMousePos.current = { x: e.clientX, y: e.clientY };
        
        // 1. 特殊模式：放置、吸附 (优先级最高)
        const isPlacing = !!(GameStore.editor.placingTemplateId || GameStore.editor.placingFurniture);
        if (isStickyDragging.current || isPlacing) {
            GameStore.editor.isDragging = false;
            const p = GameStore.editor.previewPos || {x:0, y:0};
            // 执行放置
            if (GameStore.editor.placingTemplateId) GameStore.placePlot(p.x, p.y);
            else if (GameStore.editor.placingFurniture) GameStore.placeFurniture(p.x, p.y);
            else if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) GameStore.finalizeMove('plot', GameStore.editor.selectedPlotId, dragStartPos.current);
            else if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId) GameStore.finalizeMove('furniture', GameStore.editor.selectedFurnitureId, dragStartPos.current);
            else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) GameStore.finalizeMove('room', GameStore.editor.selectedRoomId, dragStartPos.current);
            
            isStickyDragging.current = false; 
            isDraggingObject.current = false;
            // 放置后，恢复 Viewport 拖拽
            viewportRef.current.plugins.resume('drag');
            GameStore.notify(); 
            return;
        }

        // 2. 选择 Sim (None 模式)
        if (GameStore.editor.mode === 'none') {
            const sim = GameStore.sims.find(s => Math.abs(s.pos.x - wX) < 30 && Math.abs(s.pos.y - wY) < 50);
            GameStore.selectedSimId = sim ? sim.id : null;
            
            // 如果点到了 Sim，暂停拖拽镜头；否则继续允许拖拽镜头(Pan)
            if (sim) viewportRef.current.plugins.pause('drag');
            else viewportRef.current.plugins.resume('drag');
            
            GameStore.notify();
            return;
        }

        // 3. 画框模式 (Drawing)
        if (GameStore.editor.drawingFloor || GameStore.editor.drawingPlot) {
            viewportRef.current.plugins.pause('drag'); // 必须暂停镜头
            isDraggingObject.current = true;
            const gridX = Math.round(wX / 50) * 50; 
            const gridY = Math.round(wY / 50) * 50;
            if(GameStore.editor.drawingFloor) Object.assign(GameStore.editor.drawingFloor, { startX: gridX, startY: gridY, currX: gridX, currY: gridY });
            if(GameStore.editor.drawingPlot) Object.assign(GameStore.editor.drawingPlot, { startX: gridX, startY: gridY, currX: gridX, currY: gridY });
            return;
        }

        // 4. 调整大小 (Resize)
        let resizeTarget: { x: number, y: number, w: number, h: number } | null = null;
        if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
            const p = GameStore.worldLayout.find(i => i.id === GameStore.editor.selectedPlotId);
            if (p) resizeTarget = { x: p.x, y: p.y, w: p.width || 300, h: p.height || 300 };
        } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
            const r = GameStore.rooms.find(i => i.id === GameStore.editor.selectedRoomId);
            if (r) resizeTarget = { x: r.x, y: r.y, w: r.w, h: r.h };
        }

        if (resizeTarget) {
            const zoom = viewportRef.current.scaled;
            const handleSize = 10 / zoom;
            const half = handleSize; 
            const { x, y, w, h } = resizeTarget;
            activeResizeHandle.current = null;
            // 简单的手柄判定
            if (Math.abs(wX - x) < half && Math.abs(wY - y) < half) activeResizeHandle.current = 'nw';
            else if (Math.abs(wX - (x+w)) < half && Math.abs(wY - y) < half) activeResizeHandle.current = 'ne';
            else if (Math.abs(wX - x) < half && Math.abs(wY - (y+h)) < half) activeResizeHandle.current = 'sw';
            else if (Math.abs(wX - (x+w)) < half && Math.abs(wY - (y+h)) < half) activeResizeHandle.current = 'se';

            if (activeResizeHandle.current) {
                viewportRef.current.plugins.pause('drag'); // 暂停镜头
                isResizing.current = true; 
                isDraggingObject.current = true; 
                resizeStartRect.current = { ...resizeTarget };
                return;
            }
        }

        // 5. 点击命中检测 (Hit Test)
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
            // 选中了物体 -> 暂停镜头拖拽，开始拖拽物体
            viewportRef.current.plugins.pause('drag');
            
            if (hitType === 'plot') GameStore.editor.selectedPlotId = hitObj.id;
            else if (hitType === 'furniture') GameStore.editor.selectedFurnitureId = hitObj.id;
            else if (hitType === 'room') GameStore.editor.selectedRoomId = hitObj.id;
            
            GameStore.editor.isDragging = true; 
            isDraggingObject.current = true;
            GameStore.editor.dragOffset = { x: wX - hitObj.x, y: wY - hitObj.y };
            GameStore.editor.previewPos = { x: hitObj.x, y: hitObj.y };
            dragStartPos.current = { x: hitObj.x, y: hitObj.y };
        } else {
            // 没点中任何东西 -> 取消选择，并恢复镜头拖拽 (允许 Pan)
            GameStore.editor.selectedPlotId = null; 
            GameStore.editor.selectedFurnitureId = null; 
            GameStore.editor.selectedRoomId = null;
            viewportRef.current.plugins.resume('drag');
        }
        GameStore.notify();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!viewportRef.current) return;
        const pt = viewportRef.current.toWorld(e.clientX, e.clientY);
        const wX = pt.x, wY = pt.y;

        if (isResizing.current && activeResizeHandle.current) {
            const snap = 50;
            const start = resizeStartRect.current;
            let newRect = { ...start };
            
            if (activeResizeHandle.current.includes('e')) newRect.w = Math.max(50, wX - start.x);
            if (activeResizeHandle.current.includes('s')) newRect.h = Math.max(50, wY - start.y);
            if (activeResizeHandle.current.includes('w')) {
                const diff = wX - start.x;
                if (start.w - diff >= 50) { newRect.x = wX; newRect.w = start.w - diff; }
            }
            if (activeResizeHandle.current.includes('n')) {
                const diff = wY - start.y;
                if (start.h - diff >= 50) { newRect.y = wY; newRect.h = start.h - diff; }
            }

            // Snap
            newRect.x = Math.round(newRect.x / snap) * snap;
            newRect.y = Math.round(newRect.y / snap) * snap;
            newRect.w = Math.round(newRect.w / snap) * snap;
            newRect.h = Math.round(newRect.h / snap) * snap;

            if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) GameStore.resizeEntity('plot', GameStore.editor.selectedPlotId, newRect);
            else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) GameStore.resizeEntity('room', GameStore.editor.selectedRoomId, newRect);
            return;
        }

        if (isDraggingObject.current) {
            const gridX = Math.round(wX / 50) * 50; 
            const gridY = Math.round(wY / 50) * 50;
            if (GameStore.editor.drawingFloor) { GameStore.editor.drawingFloor.currX = gridX; GameStore.editor.drawingFloor.currY = gridY; }
            else if (GameStore.editor.drawingPlot) { GameStore.editor.drawingPlot.currX = gridX; GameStore.editor.drawingPlot.currY = gridY; }
        }

        if (GameStore.editor.mode !== 'none' && (GameStore.editor.isDragging || isStickyDragging.current)) {
            const gridSize = 10;
            const rx = wX - GameStore.editor.dragOffset.x; 
            const ry = wY - GameStore.editor.dragOffset.y;
            GameStore.editor.previewPos = { x: Math.round(rx/gridSize)*gridSize, y: Math.round(ry/gridSize)*gridSize };
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (!viewportRef.current) return;
        const dist = Math.sqrt(Math.pow(e.clientX - dragStartMousePos.current.x, 2) + Math.pow(e.clientY - dragStartMousePos.current.y, 2));
        const isClick = dist < 10;
        
        isDraggingObject.current = false; 
        isResizing.current = false; 
        activeResizeHandle.current = null;
        
        // 鼠标抬起时，如果不在做特殊操作，通常恢复镜头拖拽
        if (!isStickyDragging.current) {
            viewportRef.current.plugins.resume('drag');
        }

        if (GameStore.editor.mode !== 'none' && GameStore.editor.isDragging && isClick && !isStickyDragging.current && !GameStore.editor.placingTemplateId) {
            isStickyDragging.current = true; // 拿起物体
            viewportRef.current.plugins.pause('drag'); // 拿起时暂停镜头
            return;
        }

        if (GameStore.editor.drawingFloor || GameStore.editor.drawingPlot) {
            if (GameStore.editor.drawingFloor) {
                const { startX, startY, currX, currY, pattern, color, label, hasWall } = GameStore.editor.drawingFloor;
                const w = Math.abs(currX - startX); const h = Math.abs(currY - startY);
                if (w >= 50 && h >= 50) GameStore.createCustomRoom({x: Math.min(startX, currX), y: Math.min(startY, currY), w, h}, pattern, color, label, hasWall);
                GameStore.editor.drawingFloor = null;
            } else if (GameStore.editor.drawingPlot) {
                const { startX, startY, currX, currY, templateId } = GameStore.editor.drawingPlot;
                const w = Math.abs(currX - startX); const h = Math.abs(currY - startY);
                if (w >= 50 && h >= 50) GameStore.createCustomPlot({x: Math.min(startX, currX), y: Math.min(startY, currY), w, h}, templateId);
                GameStore.editor.drawingPlot = null;
            }
            GameStore.notify(); return;
        }
    };

    return (
        <div ref={containerRef} className="relative w-full h-full overflow-hidden" 
             onMouseDown={handleMouseDown} 
             onMouseMove={handleMouseMove} 
             onMouseUp={handleMouseUp} 
             onContextMenu={e => e.preventDefault()}
        >
            {loading && <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80">LOADING...</div>}
            {GameStore.editor.mode !== 'none' && showInstructions && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none bg-black/60 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-lg z-20">
                    <button onClick={() => setShowInstructions(false)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full pointer-events-auto">✕</button>
                    <div className="font-bold text-center mb-1">编辑模式</div>
                    <div>🖱️ 单击: 拿起/放置 | 🔄 R键: 旋转 | ⌨️ Del: 删除</div>
                </div>
            )}
        </div>
    );
};

export default PixiGameCanvas;