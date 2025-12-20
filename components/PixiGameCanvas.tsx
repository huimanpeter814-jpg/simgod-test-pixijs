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
    
    // 实体管理
    const simViewsRef = useRef<Map<string, PixiSimView>>(new Map());
    const furnViewsRef = useRef<Map<string, Container>>(new Map());
    const roomViewsRef = useRef<Map<string, Graphics>>(new Map());

    // 编辑器图层
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
    const [editorRefresh, setEditorRefresh] = useState(0);

    const refreshWorld = () => {
        if (!viewportRef.current) return;
        const viewport = viewportRef.current;

        furnViewsRef.current.forEach(v => v.destroy()); furnViewsRef.current.clear();
        roomViewsRef.current.forEach(v => v.destroy()); roomViewsRef.current.clear();
        
        GameStore.rooms.forEach(room => {
            const g = PixiWorldBuilder.createRoom(room);
            g.zIndex = -100; 
            viewport.addChild(g);
            roomViewsRef.current.set(room.id, g);
        });

        GameStore.furniture.forEach(furn => {
            const c = PixiWorldBuilder.createFurniture(furn);
            // 家具的层级通常是 Y 坐标 (0 ~ 3000左右)
            viewport.addChild(c);
            furnViewsRef.current.set(furn.id, c);
        });
        
        viewport.sortChildren();
    };

    useEffect(() => {
        refreshWorld();
    }, [editorRefresh]);

    const updateEditorVisuals = () => {
        if (!gridLayerRef.current || !uiLayerRef.current || !ghostLayerRef.current || !appRef.current) return;
        const grid = gridLayerRef.current;
        const ui = uiLayerRef.current;
        const ghost = ghostLayerRef.current;

        grid.clear(); ui.removeChildren(); ghost.removeChildren();

        if (GameStore.editor.mode === 'none') {
            setShowInstructions(false);
            return;
        }

        const zoom = viewportRef.current?.scaled || 1;
        if (zoom > 0.4) {
            grid.strokeStyle = { width: 1 / zoom, color: 0xffffff, alpha: 0.1 };
            const w = CONFIG.CANVAS_W; const h = CONFIG.CANVAS_H;
            for (let x = 0; x <= w; x += 50) { grid.moveTo(x, 0); grid.lineTo(x, h); }
            for (let y = 0; y <= h; y += 50) { grid.moveTo(0, y); grid.lineTo(w, y); }
            grid.stroke();
        }

        const drawBox = (x: number, y: number, w: number, h: number, color: number) => {
            const g = new Graphics();
            g.rect(x, y, w, h).stroke({ width: 2 / zoom, color });
            ui.addChild(g);
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

        if (GameStore.editor.previewPos) {
            const { x, y } = GameStore.editor.previewPos;
            let w = 100, h = 100;
            if (GameStore.editor.mode === 'furniture') {
                const f = GameStore.furniture.find(i => i.id === GameStore.editor.selectedFurnitureId) || GameStore.editor.placingFurniture;
                if (f) { w = f.w || 50; h = f.h || 50; }
            }
            const g = new Graphics().rect(x, y, w, h).fill({ color: 0xffffff, alpha: 0.3 }).stroke({ width: 2, color: 0xffff00 });
            ghost.addChild(g);
        }
    };

    useEffect(() => {
        const initGame = async () => {
            if (!containerRef.current) return;
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

            await loadGameAssets([...ASSET_CONFIG.bg, ...ASSET_CONFIG.face, ...ASSET_CONFIG.hair, ...ASSET_CONFIG.clothes, ...ASSET_CONFIG.pants]);
            setLoading(false);

            const viewport = new Viewport({
                screenWidth: app.screen.width, screenHeight: app.screen.height,
                worldWidth: CONFIG.CANVAS_W, worldHeight: CONFIG.CANVAS_H,
                events: app.renderer.events, ticker: app.ticker,
            });
            app.stage.addChild(viewport);
            viewportRef.current = viewport;
            
            viewport.drag().pinch().wheel().decelerate().clampZoom({ minScale: 0.1, maxScale: 8.0 }).sortableChildren = true;

            const bgPath = ASSET_CONFIG.bg[0];
            if (bgPath) {
                const bg = Sprite.from(bgPath);
                bg.width = CONFIG.CANVAS_W; bg.height = CONFIG.CANVAS_H; bg.zIndex = -99999; bg.eventMode = 'none';
                bg.texture.source.scaleMode = 'nearest'; 
                viewport.addChild(bg);
            }
            
            const gridL = new Graphics(); gridL.zIndex = 999999; viewport.addChild(gridL); gridLayerRef.current = gridL;
            const ghostL = new Container(); ghostL.zIndex = 999999; viewport.addChild(ghostL); ghostLayerRef.current = ghostL;
            const uiL = new Container(); uiL.zIndex = 999999; viewport.addChild(uiL); uiLayerRef.current = uiL;

            refreshWorld();
            viewport.moveCenter(CONFIG.CANVAS_W / 2, CONFIG.CANVAS_H / 2);
            viewport.setZoom(1.0);

            app.ticker.add((ticker) => {
                const dt = ticker.deltaTime;
                gameLoopStep(dt);

                // 数据查岗
                if (GameStore.furniture.length > 0 && furnViewsRef.current.size === 0) {
                    refreshWorld();
                }
                if (GameStore.rooms.length > 0 && roomViewsRef.current.size === 0) {
                    refreshWorld();
                }

                if (GameStore.selectedSimId && GameStore.editor.mode === 'none' && !isDraggingObject.current) {
                    const sim = GameStore.sims.find(s => s.id === GameStore.selectedSimId);
                    if (sim) {
                        const cur = viewport.center;
                        viewport.moveCenter(lerp(cur.x, sim.pos.x, 0.1), lerp(cur.y, sim.pos.y, 0.1));
                    }
                }

                const activeIds = new Set<string>();
                
                // [关键修改] 小人图层基础偏移量
                // 让所有小人都加上 50000 的层级，这样他们就永远浮在家具上面了
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
                    
                    if (GameStore.selectedSimId === sim.id) {
                        view.container.alpha = 1; view.container.scale.set(1.1); 
                        // 选中者最高
                        view.container.zIndex = SIM_LAYER_OFFSET + 99999; 
                    } else {
                        view.container.alpha = 1; view.container.scale.set(1.0); 
                        // 普通小人在 50000 层之上，但根据 Y 轴互相排序
                        view.container.zIndex = SIM_LAYER_OFFSET + sim.pos.y; 
                    }
                });
                simViewsRef.current.forEach((v, id) => { if(!activeIds.has(id)) { viewport.removeChild(v.container); v.destroy(); simViewsRef.current.delete(id); }});

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
            setEditorRefresh(n => n + 1);
        });
        return unsub;
    }, []);

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
            
            isStickyDragging.current = false; isDraggingObject.current = false;
            GameStore.notify();
            return;
        }

        if (GameStore.editor.mode === 'none') return;
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
                isResizing.current = true; resizeStartRect.current = { x, y, w, h }; isDraggingObject.current = true;
                return;
            }
        }

        if (GameStore.editor.drawingFloor || GameStore.editor.drawingPlot) {
            isDraggingObject.current = true;
            const gridX = Math.round(wX / 50) * 50; const gridY = Math.round(wY / 50) * 50;
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
            
            GameStore.editor.isDragging = true; isDraggingObject.current = true;
            GameStore.editor.dragOffset = { x: wX - hitObj.x, y: wY - hitObj.y };
            GameStore.editor.previewPos = { x: hitObj.x, y: hitObj.y };
            dragStartPos.current = { x: hitObj.x, y: hitObj.y };
        } else {
            GameStore.editor.selectedPlotId = null; GameStore.editor.selectedFurnitureId = null; GameStore.editor.selectedRoomId = null;
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
            if (activeResizeHandle.current === 'se') {
                newRect.w = Math.max(50, Math.round((wX - startR.x)/snap)*snap);
                newRect.h = Math.max(50, Math.round((wY - startR.y)/snap)*snap);
            } 
            if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
                const p = GameStore.worldLayout.find(i => i.id === GameStore.editor.selectedPlotId);
                if (p) { p.width = newRect.w; p.height = newRect.h; }
            } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                const r = GameStore.rooms.find(i => i.id === GameStore.editor.selectedRoomId);
                if (r) { r.w = newRect.w; r.h = newRect.h; }
            }
            refreshWorld(); return;
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
        
        isDraggingObject.current = false; isResizing.current = false; activeResizeHandle.current = null;
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
                isStickyDragging.current = true; return;
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

        if (GameStore.editor.mode === 'none' && isClick && e.button === 0) {
            const pt = viewportRef.current.toWorld(e.clientX, e.clientY);
            const sim = GameStore.sims.find(s => Math.abs(s.pos.x - pt.x) < 30 && Math.abs(s.pos.y - pt.y) < 50);
            GameStore.selectedSimId = sim ? sim.id : null;
            GameStore.notify();
        }
    };

    return (
        <div ref={containerRef} className="relative w-full h-full overflow-hidden" 
             onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onContextMenu={e => e.preventDefault()}>
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

export default React.memo(PixiGameCanvasComponent);