import React, { useRef, useEffect, useState } from 'react';
import { CONFIG, AGE_CONFIG, ASSET_CONFIG } from '../constants';
import { GameStore, gameLoopStep, getActivePalette } from '../utils/simulation';
import { getAsset } from '../utils/assetLoader';
import { drawAvatarHead, drawPixelProp } from '../utils/render/pixelArt';
import { PLOTS } from '../data/plots';

// 地皮选项映射
const PLOT_OPTIONS = [
    { id: 'tech', label: '科技园区' },
    { id: 'finance', label: '金融中心' },
    { id: 'design', label: '创意园区' },
    { id: 'kindergarten', label: '幼儿园' },
    { id: 'elementary', label: '小学' },
    { id: 'high_school', label: '中学' },
    { id: 'dorm', label: '公寓/宿舍' },
    { id: 'villa', label: '别墅区' },
    { id: 'park', label: '公园' },
    { id: 'commercial', label: '商业街' },
    { id: 'nightlife', label: '娱乐区' },
    { id: 'gallery', label: '文化设施' },
];

const SIMPLE_COLORS = [
    '#dcdcdc', '#8cb393', '#3d404b', '#5a8fff', '#ff7675', '#fdcb6e', '#ffffff'
];

// 兼容性更好的圆角矩形绘制函数
const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
};

const createWorker = () => {
    const blob = new Blob([`
        let interval = null;
        self.onmessage = function(e) {
            if (e.data === 'start') {
                if (interval) clearInterval(interval);
                interval = setInterval(() => {
                    self.postMessage('tick');
                }, 1000 / 30);
            } else if (e.data === 'stop') {
                if (interval) clearInterval(interval);
            }
        };
    `], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
};

const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
};

// --- 新增：绘制4个角的缩放手柄 ---
const drawResizeHandles = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    const handleSize = 10;
    const half = handleSize / 2;
    
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;

    // Defines corners: TL, TR, BL, BR
    const corners = [
        { x: x - half, y: y - half }, // NW
        { x: x + w - half, y: y - half }, // NE
        { x: x - half, y: y + h - half }, // SW
        { x: x + w - half, y: y + h - half } // SE
    ];

    corners.forEach(c => {
        ctx.beginPath();
        ctx.rect(c.x, c.y, handleSize, handleSize);
        ctx.fill();
        ctx.stroke();
    });

    ctx.restore();
};

const GameCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);

    const cameraRef = useRef({ 
        x: 1800 - window.innerWidth / 2, 
        y: 800 - window.innerHeight / 2, 
        zoom: 0.8 
    });

    // Refs
    const hoveredTarget = useRef<any>(null);
    const isCameraLocked = useRef(false); 
    const lastSelectedId = useRef<string | null>(null);
    
    // 交互状态
    const isDraggingCamera = useRef(false);
    
    // [New] Sticky Drag State (Click to Pickup)
    const isStickyDragging = useRef(false);
    
    const isResizing = useRef(false);
    const activeResizeHandle = useRef<string | null>(null); // 'nw', 'ne', 'sw', 'se'
    const resizeStartRect = useRef({ x: 0, y: 0, w: 0, h: 0 }); // Snapshot for resizing

    const isDraggingObject = useRef(false);
    
    const lastMousePos = useRef({ x: 0, y: 0 });
    const dragStartMousePos = useRef({ x: 0, y: 0 });
    const dragStartPos = useRef({ x: 0, y: 0 }); 

    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [editorRefresh, setEditorRefresh] = useState(0);
    // [新增] 指引显示状态控制
    const [showInstructions, setShowInstructions] = useState(true);
    const prevModeRef = useRef(GameStore.editor.mode);

    // [新增] 监听模式切换，重新进入编辑模式时重置指引显示
    useEffect(() => {
        if (prevModeRef.current === 'none' && GameStore.editor.mode !== 'none') {
            setShowInstructions(true);
        }
        prevModeRef.current = GameStore.editor.mode;
    }, [editorRefresh]);

    // 限制相机边界
    const clampCamera = (targetX: number, targetY: number, currentZoom: number) => {
        const padding = 200;
        const minX = -padding;
        const maxX = CONFIG.CANVAS_W - (window.innerWidth / currentZoom) + padding;
        const minY = -padding;
        const maxY = CONFIG.CANVAS_H - (window.innerHeight / currentZoom) + padding;
        const clampedX = Math.max(Math.min(minX, maxX), Math.min(targetX, Math.max(minX, maxX)));
        const clampedY = Math.max(Math.min(minY, maxY), Math.min(targetY, Math.max(minY, maxY)));
        return { x: clampedX, y: clampedY };
    };

    useEffect(() => {
        const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        if (cameraRef.current.x === 0 && cameraRef.current.y === 0) {
             cameraRef.current.x = 1800 - window.innerWidth / 2;
             cameraRef.current.y = 800 - window.innerHeight / 2;
        }
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (GameStore.editor.selectedPlotId) GameStore.removePlot(GameStore.editor.selectedPlotId);
                else if (GameStore.editor.selectedFurnitureId) GameStore.removeFurniture(GameStore.editor.selectedFurnitureId);
                else if (GameStore.editor.selectedRoomId) GameStore.removeRoom(GameStore.editor.selectedRoomId);
            }
            // 🆕 旋转快捷键
            if (e.key === 'r' || e.key === 'R') {
                if (GameStore.editor.mode !== 'none') {
                    GameStore.editor.rotateSelection();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const unsub = GameStore.subscribe(() => {
            setEditorRefresh(prev => prev + 1);
        });
        return unsub;
    }, []);

    const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const lastTimePaletteRef = useRef<string>('');
    const lastStaticUpdateRef = useRef<number>(0); 

    // 渲染静态层 (背景/地板/家具)
    const renderStaticLayer = () => {
        if (!staticCanvasRef.current) {
            staticCanvasRef.current = document.createElement('canvas');
            staticCanvasRef.current.width = CONFIG.CANVAS_W;
            staticCanvasRef.current.height = CONFIG.CANVAS_H;
        }
        const ctx = staticCanvasRef.current.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        const p = getActivePalette();
        
        // 背景
        const bgPath = ASSET_CONFIG.bg?.find(path => path.includes('bg_img')) || ASSET_CONFIG.bg?.[0];
        const bgImg = getAsset(bgPath);
        if (bgImg) ctx.drawImage(bgImg, 0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
        else { ctx.fillStyle = p.bg; ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H); }

        // 绘制所有房间
        const allRooms = [...GameStore.rooms.filter(r => !r.isCustom), ...GameStore.rooms.filter(r => r.isCustom)];
        allRooms.forEach((r: any) => {
            if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId && isDraggingObject.current && r.id.startsWith(`${GameStore.editor.selectedPlotId}_`)) return;
            if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId === r.id && isDraggingObject.current) return;
            
            if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId === r.id) ctx.globalAlpha = 0.6;

            if (r.color !== 'transparent' && !r.isCustom) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(r.x + 6, r.y + 6, r.w, r.h); }
            if (r.color === 'transparent' || !r.label.startsWith('空地')) { ctx.strokeStyle = p.wall; ctx.lineWidth = 1; ctx.strokeRect(r.x, r.y, r.w, r.h); }
            
            const floorImg = getAsset((r as any).imagePath);
            if (floorImg) { ctx.drawImage(floorImg, r.x, r.y, r.w, r.h); } 
            else { ctx.fillStyle = r.color; ctx.fillRect(r.x, r.y, r.w, r.h); }
            
            if (r.hasWall) { ctx.strokeStyle = p.wall || '#5a6572'; ctx.lineWidth = 4; ctx.strokeRect(r.x, r.y, r.w, r.h); }
            
            if (r.label && !r.id.startsWith('road')) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(r.label, r.x + 10, r.y + 20); }
            ctx.globalAlpha = 1.0;
        });

        // 绘制家具
        GameStore.furniture.forEach((f: any) => {
            if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId === f.id && isDraggingObject.current) return;
            if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId && f.id.startsWith(`${GameStore.editor.selectedPlotId}_`) && isDraggingObject.current) return;
            
            if (f.pixelPattern !== 'zebra') { ctx.fillStyle = p.furniture_shadow || 'rgba(0,0,0,0.2)'; ctx.fillRect(f.x + 4, f.y + 4, f.w, f.h); }
            const furnImg = getAsset(f.imagePath);
            if (furnImg) ctx.drawImage(furnImg, f.x, f.y, f.w, f.h);
            else drawPixelProp(ctx, f, p); 
        });
        lastStaticUpdateRef.current = Date.now();
    };

    // 动态层绘制 (UI, 选中框, Sims)
    const draw = (ctx: CanvasRenderingContext2D) => {
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.save();
        const zoom = cameraRef.current.zoom;
        const camX = Math.floor(cameraRef.current.x);
        const camY = Math.floor(cameraRef.current.y);
        ctx.scale(zoom, zoom);
        ctx.translate(-camX, -camY);

        const p = getActivePalette();
        const paletteKey = JSON.stringify(p);
        if (paletteKey !== lastTimePaletteRef.current || !staticCanvasRef.current) { renderStaticLayer(); lastTimePaletteRef.current = paletteKey; }
        if (staticCanvasRef.current) ctx.drawImage(staticCanvasRef.current, 0, 0);

        // --- 编辑模式 UI ---
        if (GameStore.editor.mode !== 'none') {
            // 网格
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.lineWidth = 1;
            const gridSize = 50;
            const startX = Math.floor(camX / gridSize) * gridSize; const startY = Math.floor(camY / gridSize) * gridSize;
            const endX = startX + (ctx.canvas.width / zoom); const endY = startY + (ctx.canvas.height / zoom);
            ctx.beginPath();
            for (let x = startX; x < endX; x += gridSize) { ctx.moveTo(x, startY); ctx.lineTo(x, endY); }
            for (let y = startY; y < endY; y += gridSize) { ctx.moveTo(startX, y); ctx.lineTo(endX, y); }
            ctx.stroke();

            // 选中框绘制 (地皮/房间/家具)
            if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
                const plot = GameStore.worldLayout.find(p => p.id === GameStore.editor.selectedPlotId);
                // [修复] 如果 plot.width 未定义，尝试从 template 获取，否则 fallback 300
                const w = plot?.width || (plot ? PLOTS[plot.templateId]?.width : 300) || 300;
                const h = plot?.height || (plot ? PLOTS[plot.templateId]?.height : 300) || 300;
                
                if (plot) {
                    ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2; ctx.strokeRect(plot.x, plot.y, w, h);
                    // @ts-ignore
                    if (GameStore.editor.activeTool !== 'camera') drawResizeHandles(ctx, plot.x, plot.y, w, h);
                }
            }
            if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                const room = GameStore.rooms.find(r => r.id === GameStore.editor.selectedRoomId);
                if (room) {
                    ctx.strokeStyle = '#39ff14'; ctx.lineWidth = 2; ctx.strokeRect(room.x, room.y, room.w, room.h);
                    // @ts-ignore
                    if (GameStore.editor.activeTool !== 'camera') drawResizeHandles(ctx, room.x, room.y, room.w, room.h);
                }
            }
            if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId) {
                const furn = GameStore.furniture.find(f => f.id === GameStore.editor.selectedFurnitureId);
                if (furn) { ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 2; ctx.strokeRect(furn.x, furn.y, furn.w, furn.h); }
            }

            // 预览框 (Ghost)
            if (GameStore.editor.previewPos) {
                const { x, y } = GameStore.editor.previewPos;
                ctx.save(); ctx.globalAlpha = 0.8;
                if (GameStore.editor.mode === 'furniture' && (GameStore.editor.selectedFurnitureId || GameStore.editor.placingFurniture)) {
                    let f = GameStore.furniture.find(i => i.id === GameStore.editor.selectedFurnitureId) || GameStore.editor.placingFurniture;
                    if (f) { const previewF = { ...f, x, y }; drawPixelProp(ctx, previewF, p); ctx.strokeStyle = '#ffff00'; ctx.strokeRect(x, y, f.w||0, f.h||0); }
                } else if (GameStore.editor.mode === 'plot') {
                    let w = 300, h = 300;
                    if (GameStore.editor.selectedPlotId) { 
                        const plot = GameStore.worldLayout.find(p => p.id === GameStore.editor.selectedPlotId); 
                        // [修复] 拖拽现有地皮时的 Ghost 尺寸修正
                        if(plot) {
                            w = plot.width || PLOTS[plot.templateId]?.width || 300;
                            h = plot.height || PLOTS[plot.templateId]?.height || 300;
                        } 
                    }
                    else if (GameStore.editor.placingTemplateId) { 
                        const tpl = PLOTS[GameStore.editor.placingTemplateId]; 
                        if(tpl){ w=tpl.width; h=tpl.height; } 
                    }
                    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#ffff00'; ctx.strokeRect(x, y, w, h);
                } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                    const room = GameStore.rooms.find(r => r.id === GameStore.editor.selectedRoomId);
                    if (room) { ctx.fillStyle = 'rgba(57, 255, 20, 0.2)'; ctx.fillRect(x, y, room.w, room.h); ctx.strokeStyle = '#39ff14'; ctx.strokeRect(x, y, room.w, room.h); }
                }
                ctx.restore();
            }
            // 框选预览
            if ((GameStore.editor.drawingFloor || GameStore.editor.drawingPlot) && isDraggingObject.current) {
                const d = GameStore.editor.drawingFloor || GameStore.editor.drawingPlot;
                if (d) {
                    const x = Math.min(d.startX, d.currX); const y = Math.min(d.startY, d.currY);
                    const w = Math.abs(d.currX - d.startX); const h = Math.abs(d.currY - d.startY);
                    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x, y, w, h);
                    ctx.strokeStyle = '#ffff00'; ctx.setLineDash([5, 5]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
                    ctx.fillStyle = '#fff'; ctx.fillText(`${w} x ${h}`, x + w/2 - 20, y + h/2);
                }
            }
        }

        // Sims 绘制
        const renderSims = [...GameStore.sims].sort((a, b) => {
            if (a.carryingSimId === b.id) return -1;
            if (b.carryingSimId === a.id) return 1;
            return a.pos.y - b.pos.y;
        });
        
        renderSims.forEach(sim => {
            const renderX = Math.floor(sim.pos.x); 
            const renderY = Math.floor(sim.pos.y);
            
            ctx.save();
            ctx.translate(renderX, renderY);
            
            // 选中特效
            if (GameStore.selectedSimId === sim.id) {
                ctx.fillStyle = '#39ff14';
                ctx.beginPath(); ctx.ellipse(0, 5, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
                const rippleScale = (Date.now() % 1000) / 1000;
                ctx.globalAlpha = (1 - rippleScale) * 0.6; ctx.strokeStyle = '#39ff14'; ctx.lineWidth = 3 / zoom;
                ctx.beginPath(); ctx.ellipse(0, 5, 10 + rippleScale * 15, 5 + rippleScale * 7, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = 1.0;
                const floatY = -65 + Math.sin(Date.now() / 150) * 4;
                ctx.fillStyle = '#39ff14'; ctx.beginPath(); ctx.moveTo(0, floatY); ctx.lineTo(-10, floatY - 12); ctx.lineTo(10, floatY - 12); ctx.closePath(); ctx.fill();
            } else {
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath(); ctx.ellipse(0, 5, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
            }
            // @ts-ignore
            const ageConfig = AGE_CONFIG[sim.ageStage] || AGE_CONFIG.Adult;
            const w = ageConfig.width || 20; const h = ageConfig.height || 42; const headSize = ageConfig.headSize || 13; const headY = -h + (headSize * 0.4);
            
            drawAvatarHead(ctx, 0, headY, headSize, sim, 'back');
            
            if (sim.ageStage === 'Infant' || sim.ageStage === 'Toddler') {
                ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(-w / 2 + 1, -h * 0.45, w - 2, h * 0.45, 4); ctx.fill();
                ctx.fillStyle = sim.clothesColor; ctx.fillRect(-w / 2, -h + (headSize * 1), w, h * 0.4);
            } else {
                ctx.fillStyle = sim.pantsColor || '#455A64'; ctx.fillRect(-w / 2, -h * 0.45, w, h * 0.45);
                const shoulderY = -h + (headSize * 0.6); const shirtBottomY = -h * 0.25;
                ctx.fillStyle = sim.clothesColor; ctx.fillRect(-w / 2, shoulderY, w, shirtBottomY - shoulderY); 
            }
            
            drawAvatarHead(ctx, 0, headY, headSize, sim, 'front');

            if (sim.action === 'phone') {
                ctx.fillStyle = '#ECEFF1'; ctx.fillRect(w/2 - 2, -h * 0.4 + 5, 6, 9);
                ctx.fillStyle = '#81D4FA'; ctx.fillRect(w/2 - 1, -h * 0.4 + 6, 4, 7);
            }

            if (sim.bubble.timer > 0 && sim.bubble.text) {
                ctx.font = 'bold 10px "Microsoft YaHei", sans-serif';
                let width = ctx.measureText(sim.bubble.text).width + 12;
                let bg = '#fff', border='#2d3436', textC='#2d3436';
                if (sim.bubble.type === 'love') { bg = '#fd79a8'; border = '#e84393'; textC = '#fff'; }
                else if (sim.bubble.type === 'bad') { bg = '#ff7675'; border = '#d63031'; textC = '#fff'; }
                else if (sim.bubble.type === 'money') { bg = '#ffeaa7'; border = '#fdcb6e'; textC = '#d35400'; }

                ctx.fillStyle = border;
                ctx.beginPath(); ctx.moveTo(0, -h - 5); ctx.lineTo(-4, -h - 15); ctx.lineTo(4, -h - 15); ctx.fill();
                ctx.fillStyle = bg; ctx.strokeStyle = border; ctx.lineWidth = 1.5 / zoom;
                ctx.beginPath(); ctx.roundRect(-width / 2, -h - 38, width, 24, 4); ctx.fill(); ctx.stroke();
                ctx.fillStyle = textC; ctx.textAlign = 'center';
                ctx.fillText(sim.bubble.text, 0, -h - 22);
                ctx.textAlign = 'left';
            }
            ctx.restore();
        });

        // 悬停提示
        if (hoveredTarget.current && GameStore.editor.mode === 'none') {
            const t = hoveredTarget.current;
            if (t.label) {
                const cx = t.x + t.w / 2; const topY = t.y - 12;
                ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(cx - 30, topY - 20, 60, 20);
                ctx.fillStyle = '#fff'; ctx.fillText(t.label, cx - 15, topY - 5);
                ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.strokeRect(t.x, t.y, t.w, t.h);
            }
        }
        ctx.restore();
    };

    const renderLoop = (timestamp: number) => {
        if (GameStore.selectedSimId !== lastSelectedId.current) {
            lastSelectedId.current = GameStore.selectedSimId;
            if (GameStore.selectedSimId) isCameraLocked.current = true;
        }
        if (GameStore.selectedSimId && isCameraLocked.current && !isDraggingCamera.current && GameStore.editor.mode === 'none') {
            const selectedSim = GameStore.sims.find(s => s.id === GameStore.selectedSimId);
            if (selectedSim) {
                const zoom = cameraRef.current.zoom;
                cameraRef.current.x = lerp(cameraRef.current.x, selectedSim.pos.x - (window.innerWidth/2)/zoom, 0.05);
                cameraRef.current.y = lerp(cameraRef.current.y, selectedSim.pos.y - (window.innerHeight/2)/zoom, 0.05);
            }
        }
        if (canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); if (ctx) draw(ctx); }
        requestRef.current = requestAnimationFrame(renderLoop);
    };

    useEffect(() => {
        const worker = createWorker();
        worker.onmessage = (e) => { if (e.data === 'tick') gameLoopStep(); };
        worker.postMessage('start');
        requestRef.current = requestAnimationFrame(renderLoop);
        renderStaticLayer();
        const unsub = GameStore.subscribe(() => { if (GameStore.editor.mode !== 'none' || (!isDraggingObject.current && !isDraggingCamera.current)) renderStaticLayer(); });
        return () => { worker.postMessage('stop'); worker.terminate(); if (requestRef.current) cancelAnimationFrame(requestRef.current); unsub(); };
    }, []);

    // === 核心交互逻辑 ===
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const zoom = cameraRef.current.zoom;
        const worldX = e.clientX / zoom + cameraRef.current.x;
        const worldY = e.clientY / zoom + cameraRef.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        dragStartMousePos.current = { x: e.clientX, y: e.clientY };

        // [修复] 判断是否处于放置新物品的状态
        const isPlacingNew = !!(GameStore.editor.placingTemplateId || GameStore.editor.placingFurniture);

        // [New] 如果正处于 "PickUp" 状态 (吸附拖拽中)，这次点击意味着"放置"
        if (isStickyDragging.current || isPlacingNew) {
            GameStore.editor.isDragging = false;
            const finalPos = GameStore.editor.previewPos || {x:0, y:0};

            // 执行放置逻辑
            if (GameStore.editor.placingTemplateId) GameStore.placePlot(finalPos.x, finalPos.y);
            else if (GameStore.editor.placingFurniture) GameStore.placeFurniture(finalPos.x, finalPos.y);
            else if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) GameStore.finalizeMove('plot', GameStore.editor.selectedPlotId, dragStartPos.current);
            else if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId) GameStore.finalizeMove('furniture', GameStore.editor.selectedFurnitureId, dragStartPos.current);
            else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) GameStore.finalizeMove('room', GameStore.editor.selectedRoomId, dragStartPos.current);
            
            isStickyDragging.current = false;
            isDraggingObject.current = false;
            renderStaticLayer();
            return;
        }

        if (GameStore.editor.mode === 'none') {
            isDraggingCamera.current = true;
            if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
            return;
        }

        // @ts-ignore
        const activeTool = GameStore.editor.activeTool || 'select';

        if (GameStore.editor.placingTemplateId || GameStore.editor.placingFurniture || GameStore.editor.drawingFloor || GameStore.editor.drawingPlot) {
            isDraggingObject.current = true;
            if (GameStore.editor.drawingFloor || GameStore.editor.drawingPlot) {
                const gridSnapX = Math.round(worldX / 50) * 50; const gridSnapY = Math.round(worldY / 50) * 50;
                if(GameStore.editor.drawingFloor) { GameStore.editor.drawingFloor.startX = gridSnapX; GameStore.editor.drawingFloor.startY = gridSnapY; GameStore.editor.drawingFloor.currX = gridSnapX; GameStore.editor.drawingFloor.currY = gridSnapY; }
                if(GameStore.editor.drawingPlot) { GameStore.editor.drawingPlot.startX = gridSnapX; GameStore.editor.drawingPlot.startY = gridSnapY; GameStore.editor.drawingPlot.currX = gridSnapX; GameStore.editor.drawingPlot.currY = gridSnapY; }
            }
            return;
        }

        if (activeTool === 'camera') {
            isDraggingCamera.current = true;
            if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
            return;
        }

        if (activeTool === 'select') {
            const handleSize = 20 / zoom; 
            
            // Check Resize Handles first (4 corners)
            // [Fix] Explicitly typing resizeTarget to resolve TS error
            let resizeTarget: { x: number, y: number, w: number, h: number } | null = null;
            if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
                const plot = GameStore.worldLayout.find(p => p.id === GameStore.editor.selectedPlotId);
                // [修复] 正确获取尺寸，如果未定义则回退
                if (plot) {
                    const w = plot.width || PLOTS[plot.templateId]?.width || 300;
                    const h = plot.height || PLOTS[plot.templateId]?.height || 300;
                    resizeTarget = { x: plot.x, y: plot.y, w, h };
                }
            } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                const room = GameStore.rooms.find(r => r.id === GameStore.editor.selectedRoomId);
                if (room) resizeTarget = { x: room.x, y: room.y, w: room.w, h: room.h };
            }

            if (resizeTarget) {
                const { x, y, w, h } = resizeTarget;
                const half = handleSize / 2;
                // Check 4 corners
                if (Math.abs(worldX - (x)) < half && Math.abs(worldY - (y)) < half) activeResizeHandle.current = 'nw';
                else if (Math.abs(worldX - (x + w)) < half && Math.abs(worldY - (y)) < half) activeResizeHandle.current = 'ne';
                else if (Math.abs(worldX - (x)) < half && Math.abs(worldY - (y + h)) < half) activeResizeHandle.current = 'sw';
                else if (Math.abs(worldX - (x + w)) < half && Math.abs(worldY - (y + h)) < half) activeResizeHandle.current = 'se';

                if (activeResizeHandle.current) {
                    isResizing.current = true;
                    resizeStartRect.current = { x, y, w, h };
                    isDraggingObject.current = true;
                    return;
                }
            }

            // Hit Test for Selection
            let hitFound = false;
            let hitObj: any = null;
            let hitType = '';

            if (GameStore.editor.mode === 'plot') {
                const clickedRoom = GameStore.rooms.find(r => worldX >= r.x && worldX <= r.x + r.w && worldY >= r.y && worldY <= r.y + r.h);
                if (clickedRoom) {
                    const plot = GameStore.worldLayout.find(p => clickedRoom.id.startsWith(p.id + '_'));
                    if (plot) { hitObj = plot; hitType = 'plot'; }
                }
            } else if (GameStore.editor.mode === 'furniture') {
                const clickedFurn = [...GameStore.furniture].reverse().find(f => worldX >= f.x && worldX <= f.x + f.w && worldY >= f.y && worldY <= f.y + f.h);
                if (clickedFurn) { hitObj = clickedFurn; hitType = 'furniture'; }
            } else if (GameStore.editor.mode === 'floor') {
                const clickedRoom = [...GameStore.rooms].reverse().find(r => worldX >= r.x && worldX <= r.x + r.w && worldY >= r.y && worldY <= r.y + r.h);
                if (clickedRoom) { hitObj = clickedRoom; hitType = 'room'; }
            }

            if (hitObj) {
                // Select Logic
                if (hitType === 'plot') GameStore.editor.selectedPlotId = hitObj.id;
                else if (hitType === 'furniture') GameStore.editor.selectedFurnitureId = hitObj.id;
                else if (hitType === 'room') GameStore.editor.selectedRoomId = hitObj.id;
                
                // Initialize Dragging State (for "Pickup" or standard drag)
                GameStore.editor.isDragging = true;
                isDraggingObject.current = true;
                GameStore.editor.dragOffset = { x: worldX - hitObj.x, y: worldY - hitObj.y };
                GameStore.editor.previewPos = { x: hitObj.x, y: hitObj.y };
                dragStartPos.current = { x: hitObj.x, y: hitObj.y };
                
                // Note: We don't set isStickyDragging here yet. 
                // We decide if it's sticky (click) or drag (hold) in MouseUp.
                hitFound = true;
            } else {
                GameStore.editor.selectedPlotId = null; GameStore.editor.selectedFurnitureId = null; GameStore.editor.selectedRoomId = null;
            }
            GameStore.notify();
            return;
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const zoom = cameraRef.current.zoom;
        const dx = (e.clientX - lastMousePos.current.x) / zoom;
        const dy = (e.clientY - lastMousePos.current.y) / zoom;
        const mouseX = e.clientX / zoom + cameraRef.current.x;
        const mouseY = e.clientY / zoom + cameraRef.current.y;

        // 1. Camera Pan
        if (isDraggingCamera.current) {
            isCameraLocked.current = false;
            const targetX = cameraRef.current.x - dx;
            const targetY = cameraRef.current.y - dy;
            const clamped = clampCamera(targetX, targetY, zoom);
            cameraRef.current.x = clamped.x; cameraRef.current.y = clamped.y;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        // 2. Resize Logic (4 Corners)
        if (isResizing.current && activeResizeHandle.current) {
            const snapSize = 50;
            const startR = resizeStartRect.current;
            let newRect = { ...startR };
            
            // Calculate total delta from start
            const totalDx = mouseX - (dragStartMousePos.current.x / zoom + cameraRef.current.x);
            const totalDy = mouseY - (dragStartMousePos.current.y / zoom + cameraRef.current.y);
            // Wait, simpler to just use current mouseX relative to object start
            
            // Based on handle, update rect
            if (activeResizeHandle.current === 'se') {
                newRect.w = Math.max(50, mouseX - startR.x);
                newRect.h = Math.max(50, mouseY - startR.y);
            } else if (activeResizeHandle.current === 'sw') {
                newRect.w = Math.max(50, (startR.x + startR.w) - mouseX);
                newRect.h = Math.max(50, mouseY - startR.y);
                newRect.x = startR.x + startR.w - newRect.w;
            } else if (activeResizeHandle.current === 'ne') {
                newRect.w = Math.max(50, mouseX - startR.x);
                newRect.h = Math.max(50, (startR.y + startR.h) - mouseY);
                newRect.y = startR.y + startR.h - newRect.h;
            } else if (activeResizeHandle.current === 'nw') {
                newRect.w = Math.max(50, (startR.x + startR.w) - mouseX);
                newRect.h = Math.max(50, (startR.y + startR.h) - mouseY);
                newRect.x = startR.x + startR.w - newRect.w;
                newRect.y = startR.y + startR.h - newRect.h;
            }

            // Snap
            newRect.w = Math.round(newRect.w / snapSize) * snapSize;
            newRect.h = Math.round(newRect.h / snapSize) * snapSize;
            if (activeResizeHandle.current.includes('w')) newRect.x = startR.x + startR.w - newRect.w;
            if (activeResizeHandle.current.includes('n')) newRect.y = startR.y + startR.h - newRect.h;

            // Apply Change
            if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
                const plot = GameStore.worldLayout.find(p => p.id === GameStore.editor.selectedPlotId);
                if (plot) { 
                    plot.x = newRect.x; plot.y = newRect.y; plot.width = newRect.w; plot.height = newRect.h; 
                    // Update linked base room size if exists
                    const baseRoom = GameStore.rooms.find(r => r.id === `${plot.id}_base`);
                    if (baseRoom) { baseRoom.x = newRect.x; baseRoom.y = newRect.y; baseRoom.w = newRect.w; baseRoom.h = newRect.h; }
                }
            } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                const room = GameStore.rooms.find(r => r.id === GameStore.editor.selectedRoomId);
                if (room) { room.x = newRect.x; room.y = newRect.y; room.w = newRect.w; room.h = newRect.h; }
            }
            
            GameStore.initIndex(); GameStore.notify();
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        // 3. Drawing Box (Floor/Plot)
        if (GameStore.editor.mode === 'floor' && GameStore.editor.drawingFloor && isDraggingObject.current) {
            const gridX = Math.round(mouseX / 50) * 50; const gridY = Math.round(mouseY / 50) * 50;
            GameStore.editor.drawingFloor.currX = gridX; GameStore.editor.drawingFloor.currY = gridY;
        } else if (GameStore.editor.mode === 'plot' && GameStore.editor.drawingPlot && isDraggingObject.current) {
            const gridX = Math.round(mouseX / 50) * 50; const gridY = Math.round(mouseY / 50) * 50;
            GameStore.editor.drawingPlot.currX = gridX; GameStore.editor.drawingPlot.currY = gridY;
        } 
        
        // 4. Moving Object (Drag or Sticky)
        else if (GameStore.editor.mode !== 'none' && (GameStore.editor.isDragging || isStickyDragging.current)) {
            const gridSize = 10; 
            const rawX = mouseX - GameStore.editor.dragOffset.x; const rawY = mouseY - GameStore.editor.dragOffset.y;
            const newX = Math.round(rawX / gridSize) * gridSize; const newY = Math.round(rawY / gridSize) * gridSize;
            GameStore.editor.previewPos = { x: newX, y: newY };
        } 
        
        // 5. Hover Effects (Editor Mode)
        else if (GameStore.editor.mode !== 'none' && !isDraggingObject.current) {
            const handleSize = 15 / zoom;
            // [Fix] Explicitly typing resizeTarget to resolve TS error
            let resizeTarget: { x: number, y: number, w: number, h: number } | null = null;
            if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) {
                const plot = GameStore.worldLayout.find(p => p.id === GameStore.editor.selectedPlotId);
                // [修复] 悬停检测时也需要正确尺寸回退
                if (plot) {
                    const w = plot.width || PLOTS[plot.templateId]?.width || 300;
                    const h = plot.height || PLOTS[plot.templateId]?.height || 300;
                    resizeTarget = { x: plot.x, y: plot.y, w, h };
                }
            } else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) {
                const room = GameStore.rooms.find(r => r.id === GameStore.editor.selectedRoomId);
                if (room) resizeTarget = { x: room.x, y: room.y, w: room.w, h: room.h };
            }

            if (resizeTarget && canvasRef.current) {
                const { x, y, w, h } = resizeTarget;
                const half = handleSize;
                // Cursor Logic
                if ((Math.abs(mouseX - x) < half && Math.abs(mouseY - y) < half) || (Math.abs(mouseX - (x + w)) < half && Math.abs(mouseY - (y + h)) < half)) {
                    canvasRef.current.style.cursor = 'nwse-resize';
                } else if ((Math.abs(mouseX - (x + w)) < half && Math.abs(mouseY - y) < half) || (Math.abs(mouseX - x) < half && Math.abs(mouseY - (y + h)) < half)) {
                    canvasRef.current.style.cursor = 'nesw-resize';
                } else {
                    canvasRef.current.style.cursor = 'default';
                }
            } else if (canvasRef.current) {
                canvasRef.current.style.cursor = 'default';
            }
        }
        
        // 6. Hover Effects (Play Mode)
        else if (GameStore.editor.mode === 'none') {
            const hit = GameStore.worldGrid.queryHit(mouseX, mouseY);
            if (hit && hit.type === 'furniture') { hoveredTarget.current = hit.ref; if(canvasRef.current) canvasRef.current.style.cursor = 'pointer'; } 
            else { hoveredTarget.current = null; if(canvasRef.current) canvasRef.current.style.cursor = 'default'; }
        }
        
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        isDraggingObject.current = false;
        
        const dragDist = Math.sqrt(Math.pow(e.clientX - dragStartMousePos.current.x, 2) + Math.pow(e.clientY - dragStartMousePos.current.y, 2));
        const isClick = dragDist < 10;

        // Camera Drag End
        if (isDraggingCamera.current) {
            isDraggingCamera.current = false;
            if (canvasRef.current) canvasRef.current.style.cursor = 'default';
            if (!isClick) return; 
        }

        // Resize End
        if (isResizing.current) {
            isResizing.current = false;
            activeResizeHandle.current = null;
            // @ts-ignore
            GameStore.editor.finalizeResize();
            return;
        }

        // Drawing Box End
        if (GameStore.editor.mode !== 'none' && (GameStore.editor.drawingFloor || GameStore.editor.drawingPlot)) {
            if (GameStore.editor.mode === 'floor' && GameStore.editor.drawingFloor) {
                const { startX, startY, currX, currY, pattern, color, label, hasWall } = GameStore.editor.drawingFloor;
                const x = Math.min(startX, currX); const y = Math.min(startY, currY);
                const w = Math.abs(currX - startX); const h = Math.abs(currY - startY);
                if (w >= 50 && h >= 50) GameStore.createCustomRoom({x, y, w, h}, pattern, color, label, hasWall);
                GameStore.editor.drawingFloor = null;
            }
            if (GameStore.editor.mode === 'plot' && GameStore.editor.drawingPlot) {
                const { startX, startY, currX, currY, templateId } = GameStore.editor.drawingPlot;
                const x = Math.min(startX, currX); const y = Math.min(startY, currY);
                const w = Math.abs(currX - startX); const h = Math.abs(currY - startY);
                if (w >= 50 && h >= 50) GameStore.createCustomPlot({x, y, w, h}, templateId);
                GameStore.editor.drawingPlot = null; 
            }
            GameStore.notify(); renderStaticLayer();
            return;
        }

        // [New] Sticky Drag Logic
        if (GameStore.editor.mode !== 'none' && GameStore.editor.isDragging) {
            // Case 1: Just clicked (Selection -> Pickup)
            // If it was a clean click on an object, we ENTER sticky drag mode
            if (isClick && !isStickyDragging.current && !GameStore.editor.placingTemplateId && !GameStore.editor.placingFurniture) {
                isStickyDragging.current = true;
                // Keep GameStore.editor.isDragging = true
                return; 
            }

            // Case 2: Held drag release
            // If we were holding mouse (not a click), we finish move immediately
            if (!isClick && !isStickyDragging.current) {
                GameStore.editor.isDragging = false;
                const finalPos = GameStore.editor.previewPos || {x:0, y:0};
                
                if (GameStore.editor.placingTemplateId) GameStore.placePlot(finalPos.x, finalPos.y);
                else if (GameStore.editor.placingFurniture) GameStore.placeFurniture(finalPos.x, finalPos.y);
                else if (GameStore.editor.mode === 'plot' && GameStore.editor.selectedPlotId) GameStore.finalizeMove('plot', GameStore.editor.selectedPlotId, dragStartPos.current);
                else if (GameStore.editor.mode === 'furniture' && GameStore.editor.selectedFurnitureId) GameStore.finalizeMove('furniture', GameStore.editor.selectedFurnitureId, dragStartPos.current);
                else if (GameStore.editor.mode === 'floor' && GameStore.editor.selectedRoomId) GameStore.finalizeMove('room', GameStore.editor.selectedRoomId, dragStartPos.current);
                
                renderStaticLayer();
            }
            return;
        }

        // Play Mode: Select Sim
        if (e.button === 0 && isClick && GameStore.editor.mode === 'none') {
            const zoom = cameraRef.current.zoom;
            const worldX = e.clientX / zoom + cameraRef.current.x;
            const worldY = e.clientY / zoom + cameraRef.current.y;
            let hitSim: string | null = null; 
            for (let i = GameStore.sims.length - 1; i >= 0; i--) {
                let s = GameStore.sims[i];
                if (Math.abs(worldX - s.pos.x) < 40 && Math.abs(worldY - (s.pos.y - 20)) < 50) { hitSim = s.id; break; }
            }
            if (hitSim) { 
                if (GameStore.selectedSimId === hitSim) isCameraLocked.current = true; 
                else GameStore.selectedSimId = hitSim; 
            } 
            else { GameStore.selectedSimId = null; }
            GameStore.notify();
        }
        
        if (canvasRef.current) canvasRef.current.style.cursor = 'default';
    };

    const handleWheel = (e: React.WheelEvent) => {
        const zoomSpeed = 0.001;
        const oldZoom = cameraRef.current.zoom;
        const minZoom = Math.max(0.2, Math.min(window.innerWidth / CONFIG.CANVAS_W, window.innerHeight / CONFIG.CANVAS_H) * 0.95);
        const maxZoom = 4;
        const newZoom = Math.min(Math.max(oldZoom - e.deltaY * zoomSpeed, minZoom), maxZoom);
        
        const rect = canvasRef.current!.getBoundingClientRect();
        let mouseX, mouseY;

        if (GameStore.selectedSimId && isCameraLocked.current) {
            mouseX = rect.width / 2;
            mouseY = rect.height / 2;
        } else {
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        }
        
        const worldX = mouseX / oldZoom + cameraRef.current.x;
        const worldY = mouseY / oldZoom + cameraRef.current.y;
        
        let targetCamX = worldX - mouseX / newZoom;
        let targetCamY = worldY - mouseY / newZoom;
        const clamped = clampCamera(targetCamX, targetCamY, newZoom);

        cameraRef.current.zoom = newZoom;
        cameraRef.current.x = clamped.x;
        cameraRef.current.y = clamped.y;
    };

    return (
        <div className="relative flex-1 h-full overflow-hidden">
            <canvas
                ref={canvasRef}
                width={windowSize.width}   
                height={windowSize.height}
                className="block"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => { isDraggingObject.current = false; }}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
            />
            {/* Editor Instruction Overlay */}
            {GameStore.editor.mode !== 'none' && showInstructions && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none bg-black/60 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-lg border border-white/10 shadow-xl flex flex-col items-center gap-1 z-20">
                    {/* [新增] 关闭按钮 */}
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

export default GameCanvas;