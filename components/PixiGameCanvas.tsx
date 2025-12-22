
import React, { useEffect, useRef, useState } from 'react';
import { Application, Container, Sprite, TextureStyle, Graphics, Text } from 'pixi.js';
import { ASSET_CONFIG, CONFIG } from '../constants';
import { loadGameAssets } from '../utils/assetLoader';
import { GameStore } from '../utils/GameStore';
import { PixiSimView } from '../utils/render/PixiSimView';
import { PixiWorldBuilder } from '../utils/render/PixiWorldBuilder';
import { gameLoopStep } from '../utils/GameLoop';

// 全局设置：像素风格缩放 (防止图片模糊)
TextureStyle.defaultOptions.scaleMode = 'nearest';

const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

const PixiGameCanvasComponent: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const worldContainerRef = useRef<Container | null>(null);
    const simLayerRef = useRef<Container | null>(null);
    const appRef = useRef<Application | null>(null);
    
    // 实体缓存
    const simViewsRef = useRef<Map<string, PixiSimView>>(new Map());
    const furnViewsRef = useRef<Map<string, Container>>(new Map());
    const roomViewsRef = useRef<Map<string, any>>(new Map());

    // 交互状态
    const isDraggingCamera = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const dragStartMousePos = useRef({ x: 0, y: 0 });
    const isCameraLocked = useRef(false);
    
    // 鼠标悬停目标 (用于 Tooltip)
    const hoveredTarget = useRef<any>(null);

    const [loading, setLoading] = useState(true);
    const [editorRefresh, setEditorRefresh] = useState(0);
    const lastMapVersion = useRef(GameStore.mapVersion || 0);

    // === A. 重建场景 (仅在地图结构变化时) ===
    const refreshWorld = () => {
        if (!worldContainerRef.current) return;
        const world = worldContainerRef.current;

        // 1. 清理旧对象
        furnViewsRef.current.forEach(v => { world.removeChild(v); v.destroy({ children: true }); });
        furnViewsRef.current.clear();
        roomViewsRef.current.forEach(v => { world.removeChild(v); v.destroy(); });
        roomViewsRef.current.clear();

        // 2. 绘制地板 (Room 现在是 Container，内含文字)
        GameStore.rooms.forEach(room => {
            const g = PixiWorldBuilder.createRoom(room);
            g.zIndex = -100;
            world.addChild(g);
            roomViewsRef.current.set(room.id, g);
        });

        // 3. 绘制家具
        GameStore.furniture.forEach(furn => {
            const c = PixiWorldBuilder.createFurniture(furn);
            c.zIndex = furn.y + furn.h; 
            world.addChild(c);
            furnViewsRef.current.set(furn.id, c);
        });

        world.sortChildren();
        console.log(`✅ 场景更新完成`);
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

            if (containerRef.current.querySelector('canvas')) {
                containerRef.current.innerHTML = '';
            }
            containerRef.current.appendChild(app.canvas);
            
            appRef.current = app;
            appInstance = app;

            // 1. 世界主容器
            const worldContainer = new Container();
            worldContainer.sortableChildren = true;
            app.stage.addChild(worldContainer);
            worldContainerRef.current = worldContainer;

            // 2. 人物图层
            const simLayer = new Container();
            simLayer.sortableChildren = true;
            simLayer.zIndex = 10000;
            worldContainer.addChild(simLayer);
            simLayerRef.current = simLayer;

            // ✨ 3. UI 图层 (用于悬停提示)
            const uiLayer = new Container();
            uiLayer.zIndex = 99999;
            app.stage.addChild(uiLayer);

            // 创建 Tooltip 组件
            const tooltipContainer = new Container();
            tooltipContainer.visible = false;
            uiLayer.addChild(tooltipContainer);

            const tooltipBg = new Graphics();
            tooltipContainer.addChild(tooltipBg);

            const tooltipText = new Text({
                text: '',
                style: {
                    fontFamily: '"Microsoft YaHei", sans-serif',
                    fontSize: 12,
                    fill: 0xffffff,
                }
            });
            tooltipContainer.addChild(tooltipText);

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
                // A. Tooltip 更新逻辑
                if (hoveredTarget.current && hoveredTarget.current.label) {
                    tooltipContainer.visible = true;
                    tooltipText.text = hoveredTarget.current.label;
                    
                    // 计算 tooltip 位置 (跟随鼠标)
                    // 需要将鼠标的 Client 坐标转换为相对于 Canvas 的坐标
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) {
                        // lastMousePos 记录的是 clientX/Y
                        const mouseX = lastMousePos.current.x - rect.left;
                        const mouseY = lastMousePos.current.y - rect.top;
                        
                        tooltipContainer.x = mouseX + 15;
                        tooltipContainer.y = mouseY + 15;

                        // 绘制背景框
                        tooltipBg.clear();
                        tooltipBg.rect(0, 0, tooltipText.width + 10, tooltipText.height + 6).fill({ color: 0x000000, alpha: 0.7 });
                        tooltipText.x = 5;
                        tooltipText.y = 3;
                    }
                } else {
                    tooltipContainer.visible = false;
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
        if (e.button === 0 && GameStore.editor.mode === 'none') {
            isDraggingCamera.current = true;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            dragStartMousePos.current = { x: e.clientX, y: e.clientY };
            if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        lastMousePos.current = { x: e.clientX, y: e.clientY }; // 始终更新鼠标位置

        if (isDraggingCamera.current && worldContainerRef.current) {
            const dx = e.clientX - lastMousePos.current.x; // 这里有问题，lastMousePos 刚被更新为当前位置，dx 会是 0
            // 修正：使用上一次的位置
            // 这里为了简单，我们不使用 lastMousePos 来计算 delta，而是用 React 的 e.movementX (如果有)
            // 或者修正逻辑：先计算 delta，再更新 lastMousePos
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
        if (e.button !== 0) return;
        const dist = Math.sqrt(Math.pow(e.clientX - dragStartMousePos.current.x, 2) + Math.pow(e.clientY - dragStartMousePos.current.y, 2));
        const isClick = dist < 5;

        if (isDraggingCamera.current) {
            isDraggingCamera.current = false;
            if (containerRef.current) containerRef.current.style.cursor = 'default';
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
                onMouseMove={onMouseMove} // 使用修正后的处理函数
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
