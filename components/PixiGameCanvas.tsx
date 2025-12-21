import React, { useEffect, useRef, useState } from 'react';
import { Application, Container, Sprite, TextureStyle } from 'pixi.js';
import { ASSET_CONFIG, CONFIG } from '../constants';
import { loadGameAssets } from '../utils/assetLoader';
import { GameStore } from '../utils/GameStore';
import { PixiSimView } from '../utils/render/PixiSimView';
import { PixiWorldBuilder } from '../utils/render/PixiWorldBuilder';
import { gameLoopStep } from '../utils/GameLoop';

// 全局设置
TextureStyle.defaultOptions.scaleMode = 'nearest';

const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

const PixiGameCanvasComponent: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const worldContainerRef = useRef<Container | null>(null);
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

    const [loading, setLoading] = useState(true);
    const [editorRefresh, setEditorRefresh] = useState(0);
    const lastMapVersion = useRef(GameStore.mapVersion || 0);

    // === A. 重建场景 ===
    const refreshWorld = () => {
        if (!worldContainerRef.current) return;
        const world = worldContainerRef.current;

        // 1. 清理
        furnViewsRef.current.forEach(v => { world.removeChild(v); v.destroy({ children: true }); });
        furnViewsRef.current.clear();
        roomViewsRef.current.forEach(v => { world.removeChild(v); v.destroy(); });
        roomViewsRef.current.clear();

        // 2. 地板
        GameStore.rooms.forEach(room => {
            const g = PixiWorldBuilder.createRoom(room);
            g.zIndex = -100;
            world.addChild(g);
            roomViewsRef.current.set(room.id, g);
        });

        // 3. 家具 (使用 PixiWorldBuilder 调用 pixelArt)
        GameStore.furniture.forEach(furn => {
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

            // 安全挂载 Canvas
            // 注意：这里不要清空 innerHTML，避免破坏 React 的 DOM 结构
            // 如果容器里已经有 canvas (React 18 双次调用)，先移除旧的
            if (containerRef.current.querySelector('canvas')) {
                containerRef.current.innerHTML = '';
            }
            containerRef.current.appendChild(app.canvas);
            
            appRef.current = app;
            appInstance = app;

            const worldContainer = new Container();
            worldContainer.sortableChildren = true;
            app.stage.addChild(worldContainer);
            worldContainerRef.current = worldContainer;

            // 加载资源
            await loadGameAssets([...ASSET_CONFIG.bg, ...ASSET_CONFIG.bodies]); 
            setLoading(false);

            // 背景图
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
            if (GameStore.furniture.length > 0) {
                const target = GameStore.furniture[0];
                worldContainer.x = (app.screen.width / 2) - target.x;
                worldContainer.y = (app.screen.height / 2) - target.y;
            }

            // 游戏循环
            app.ticker.add((ticker) => {
                const dt = ticker.deltaTime;
                gameLoopStep(dt);

                // 镜头跟随
                if (GameStore.selectedSimId && !isDraggingCamera.current && GameStore.editor.mode === 'none') {
                    const sim = GameStore.sims.find(s => s.id === GameStore.selectedSimId);
                    if (sim) {
                        const scale = worldContainer.scale.x;
                        const targetX = app.screen.width / 2 - sim.pos.x * scale;
                        const targetY = app.screen.height / 2 - sim.pos.y * scale;
                        worldContainer.x = lerp(worldContainer.x, targetX, 0.1);
                        worldContainer.y = lerp(worldContainer.y, targetY, 0.1);
                    }
                }

                // Sim 渲染
                const activeIds = new Set<string>();
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
                    view.container.zIndex = 50000 + sim.pos.y; 
                });

                simViewsRef.current.forEach((v, id) => { 
                    if (!activeIds.has(id)) { 
                        worldContainer.removeChild(v.container as any); 
                        v.destroy(); 
                        simViewsRef.current.delete(id); 
                    }
                });
            });
        };

        initGame();

        return () => {
            isCancelled = true;
            if (appInstance) appInstance.destroy({ removeView: true });
        };
    }, []);

    // 智能更新
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
        if (isDraggingCamera.current && worldContainerRef.current) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            worldContainerRef.current.x += dx;
            worldContainerRef.current.y += dy;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            isCameraLocked.current = false;
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const dist = Math.sqrt(Math.pow(e.clientX - dragStartMousePos.current.x, 2) + Math.pow(e.clientY - dragStartMousePos.current.y, 2));
        const isClick = dist < 5;

        if (isDraggingCamera.current) {
            isDraggingCamera.current = false;
            if (containerRef.current) containerRef.current.style.cursor = 'default';
        }

        // 点击选择小人
        if (isClick && GameStore.editor.mode === 'none' && worldContainerRef.current && appRef.current) {
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
            {/* 修复：使用 opacity 控制显隐，而不是条件渲染，防止 React 移除节点导致崩溃 */}
            <div className={`absolute inset-0 flex items-center justify-center text-white bg-black/80 z-50 transition-opacity duration-500 ${loading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                LOADING...
            </div>
        </div>
    );
};

export default React.memo(PixiGameCanvasComponent);