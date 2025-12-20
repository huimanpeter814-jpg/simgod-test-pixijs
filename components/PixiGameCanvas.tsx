import React, { useEffect, useRef, useState } from 'react';
import { Application, Container, Sprite, Graphics, TextureStyle } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { ASSET_CONFIG, CONFIG } from '../constants';
import { loadGameAssets } from '../utils/assetLoader';
import { GameStore } from '../utils/simulation';
import { PixiSimView } from '../utils/render/PixiSimView';
import { PixiWorldBuilder } from '../utils/render/PixiWorldBuilder';
import { gameLoopStep } from '../utils/GameLoop';
import { PLOTS } from '../data/plots';

// 全局设置：像素风格
TextureStyle.defaultOptions.scaleMode = 'nearest';

const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

const PixiGameCanvasComponent: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const viewportRef = useRef<Viewport | null>(null);
    
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
    const activeResizeHandle = useRef<string | null>(null);
    const resizeStartRect = useRef({ x: 0, y: 0, w: 0, h: 0 });

    const [loading, setLoading] = useState(true);
    const [showInstructions, setShowInstructions] = useState(false);
    const prevModeRef = useRef(GameStore.editor.mode);
    
    // [修复] 初始化时直接获取 Store 的当前版本，防止错过 initGame 的更新通知
    const [editorRefresh, setEditorRefresh] = useState(() => GameStore.mapVersion);

    // === 核心：世界重建 (当建筑/家具变化时) ===
    const refreshWorld = () => {
        if (!viewportRef.current) return;
        const viewport = viewportRef.current;

        // 1. 清理旧对象
        furnViewsRef.current.forEach(v => { viewport.removeChild(v); v.destroy({ children: true }); }); 
        furnViewsRef.current.clear();
        
        roomViewsRef.current.forEach(v => { viewport.removeChild(v); v.destroy(); }); 
        roomViewsRef.current.clear();
        
        // 2. 重绘房间 (层级 -100)
        GameStore.rooms.forEach(room => {
            const g = PixiWorldBuilder.createRoom(room);
            g.zIndex = -100; // 地板永远在最下层
            viewport.addChild(g);
            roomViewsRef.current.set(room.id, g);
        });

        // 3. 重绘家具 (层级 0 ~ 10000，基于 Y 轴)
        GameStore.furniture.forEach(furn => {
            const c = PixiWorldBuilder.createFurniture(furn);
            // 确保家具层级正确：Y 越大层级越高，但永远小于市民层级
            c.zIndex = furn.y + furn.h; 
            viewport.addChild(c);
            furnViewsRef.current.set(furn.id, c);
        });
        
        viewport.sortChildren();
    };

    // 监听外部触发的编辑器刷新
    useEffect(() => {
        if (!loading && viewportRef.current) {
            refreshWorld();
        }
    }, [editorRefresh, loading]);

    // === 核心：编辑器 UI 更新 (Grid, Ghost, SelectionBox) ===
    const updateEditorVisuals = () => {
        if (!gridLayerRef.current || !uiLayerRef.current || !ghostLayerRef.current || !viewportRef.current) return;
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

        const zoom = viewportRef.current.scaled;
        
        // 1. 绘制网格
        if (zoom > 0.4) {
            grid.strokeStyle = { width: 1 / zoom, color: 0xffffff, alpha: 0.1 };
            const w = CONFIG.CANVAS_W; 
            const h = CONFIG.CANVAS_H;
            for (let x = 0; x <= w; x += 50) { grid.moveTo(x, 0); grid.lineTo(x, h); }
            for (let y = 0; y <= h; y += 50) { grid.moveTo(0, y); grid.lineTo(w, y); }
            grid.stroke();
        }

        // 2. 绘制选中框 (Selection Box)
        const drawBox = (x: number, y: number, w: number, h: number, color: number) => {
            const g = new Graphics();
            g.rect(x, y, w, h).stroke({ width: 2 / zoom, color });
            ui.addChild(g);
            
            if (['plot', 'floor'].includes(GameStore.editor.mode)) {
                const s = 10 / zoom, half = s/2;
                const handles = [
                    {x: x - half, y: y - half},         // NW
                    {x: x + w - half, y: y - half},     // NE
                    {x: x - half, y: y + h - half},     // SW
                    {x: x + w - half, y: y + h - half}  // SE
                ];
                handles.forEach(p => {
                    const hG = new Graphics();
                    hG.rect(p.x, p.y, s, s).fill(0xffffff).stroke({width: 1/zoom, color: 0x000000});
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

            // ==========================================
            // 🚨 关键修改：Viewport 创建必须提前！
            // 原来是在 loadGameAssets 之后，现在移到这里
            // ==========================================
            
            // 2. 创建 Viewport
            const viewport = new Viewport({
                screenWidth: app.screen.width, screenHeight: app.screen.height,
                worldWidth: CONFIG.CANVAS_W, worldHeight: CONFIG.CANVAS_H,
                events: app.renderer.events, ticker: app.ticker,
            });
            app.stage.addChild(viewport);
            viewportRef.current = viewport; // ✅ 立即赋值，确保后续任何时机的重绘都能找到它
            
            viewport.drag().pinch().wheel().decelerate().clampZoom({ minScale: 0.1, maxScale: 4.0 });
            viewport.sortableChildren = true;

            // ==========================================

            // 3. 加载资源 (现在可以放心地 await 了)
            await loadGameAssets([
                ...ASSET_CONFIG.bg,
                ...ASSET_CONFIG.bodies,
                ...ASSET_CONFIG.outfits,
                ...ASSET_CONFIG.hairs,
                ...(ASSET_CONFIG.face || []),
                ...(ASSET_CONFIG.clothes || []),
                ...(ASSET_CONFIG.pants || [])
            ]);
            
            // 4. 资源加载完毕，解除 Loading 状态
            // 此时 viewportRef.current 绝对有值，useEffect 中的 refreshWorld() 将被正确触发
            setLoading(false);

            // 4. 静态背景
            const bgPath = ASSET_CONFIG.bg[0];
            if (bgPath) {
                const bg = Sprite.from(bgPath);
                bg.width = CONFIG.CANVAS_W; 
                bg.height = CONFIG.CANVAS_H; 
                bg.zIndex = -99999; 
                bg.eventMode = 'none';
                viewport.addChild(bg);
            }
            
            // 5. 编辑器图层
            const gridL = new Graphics(); gridL.zIndex = 999999; viewport.addChild(gridL); gridLayerRef.current = gridL;
            const ghostL = new Container(); ghostL.zIndex = 999999; viewport.addChild(ghostL); ghostLayerRef.current = ghostL;
            const uiL = new Container(); uiL.zIndex = 999999; viewport.addChild(uiL); uiLayerRef.current = uiL;

            // 6. 初始世界渲染
            refreshWorld();
            viewport.moveCenter(CONFIG.CANVAS_W / 2, CONFIG.CANVAS_H / 2);
            viewport.setZoom(1.0);

            // 7. 启动游戏循环
            app.ticker.add((ticker) => {
                const dt = ticker.deltaTime;
                
                // A. 逻辑步进
                gameLoopStep(dt);

                // B. 摄像机跟随
                if (GameStore.selectedSimId && GameStore.editor.mode === 'none' && !isDraggingObject.current) {
                    const sim = GameStore.sims.find(s => s.id === GameStore.selectedSimId);
                    if (sim) {
                        const cur = viewport.center;
                        viewport.moveCenter(lerp(cur.x, sim.pos.x, 0.1), lerp(cur.y, sim.pos.y, 0.1));
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
                        viewport.addChild(view.container);
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
                        viewport.removeChild(v.container); 
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

    // === 交互事件处理 ===
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!viewportRef.current || e.button !== 0) return;
        
        const pt = viewportRef.current.toWorld(e.clientX, e.clientY);
        const wX = pt.x, wY = pt.y;
        
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        dragStartMousePos.current = { x: e.clientX, y: e.clientY };
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

        if (GameStore.editor.mode === 'none') {
            const sim = GameStore.sims.find(s => 
                Math.abs(s.pos.x - wX) < 20 && 
                Math.abs(s.pos.y - 20 - wY) < 30
            );
            GameStore.selectedSimId = sim ? sim.id : null;
            GameStore.notify();
            return;
        }

        viewportRef.current.plugins.pause('drag');

        let resizeTarget: { x: number, y: number, w: number, h: number } | null = null;
        if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
            const plot = GameStore.worldLayout.find(p => p.id === GameStore.editor.selectedPlotId);
            if (plot) resizeTarget = { x: plot.x, y: plot.y, w: plot.width || 300, h: plot.height || 300 };
        } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
            const room = GameStore.rooms.find(r => r.id === GameStore.editor.selectedRoomId);
            if (room) resizeTarget = { x: room.x, y: room.y, w: room.w, h: room.h };
        }

        if (resizeTarget) {
            const handleSize = 15 / viewportRef.current.scaled;
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
        if (!viewportRef.current) return;
        const dist = Math.sqrt(Math.pow(e.clientX - dragStartMousePos.current.x, 2) + Math.pow(e.clientY - dragStartMousePos.current.y, 2));
        const isClick = dist < 10;
        
        isDraggingObject.current = false; 
        isResizing.current = false; 
        activeResizeHandle.current = null;
        viewportRef.current.plugins.resume('drag');

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
        <div ref={containerRef} className="relative w-full h-full overflow-hidden" 
             onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onContextMenu={e => e.preventDefault()}>
            
            {loading && <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80 z-50">LOADING ASSETS...</div>}
            
            {GameStore.editor.mode !== 'none' && showInstructions && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none bg-black/60 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-lg z-20 border border-white/10">
                    <button onClick={() => setShowInstructions(false)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full pointer-events-auto flex items-center justify-center transition-colors">✕</button>
                    <div className="font-bold text-center mb-1 text-warning">编辑模式</div>
                    <div>🖱️ 单击: 拿起/放置 | 🔄 R键: 旋转 | ⌨️ Del: 删除</div>
                </div>
            )}
        </div>
    );
};

export default React.memo(PixiGameCanvasComponent);