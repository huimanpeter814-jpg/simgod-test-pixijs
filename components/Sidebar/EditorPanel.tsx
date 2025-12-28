import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GameStore } from '../../utils/GameStore';
import { PLOTS } from '../../data/plots';
import { Furniture } from '../../types';
import { FURNITURE_CATALOG, WORLD_DECOR_ITEMS, WORLD_SURFACE_ITEMS } from '../../data/furnitureData';
import { Texture } from 'pixi.js';
import { getTexture } from '../../utils/assetLoader';

interface EditorPanelProps {
    onClose: () => void; 
}

// 🎨 Sprite缩略图组件：利用 CSS 裁剪显示你在 data 里定义好的切片
const ItemThumbnail = ({ item, size = 32 }: { item: any, size?: number }) => {
    
    // ====================================================
    // 🟢 模式 A: TexturePacker 智能缩略图 (frameName)
    // ====================================================
    if (item.frameName) {
        const texture = getTexture(item.frameName);
        
        // 确保纹理已加载且有效
        if (texture && texture !== Texture.EMPTY) {
            // 尝试获取大图的 URL
            // (Pixi v7/v8 兼容写法: 优先取 source.label，其次取 resource.src)
            const base = texture.baseTexture || (texture as any).source;
            const imageUrl = base.label || base.resource?.src || base.resource?.url;

            if (imageUrl) {
                // 核心：直接从 Pixi Texture 获取裁剪区域
                const { x, y, width, height } = texture.frame;
                
                // 计算缩放比例 (让长条形家具也能塞进正方形格子里)
                const scale = Math.min(size / width, size / height);

                return (
                    <div style={{ width: size, height: size, position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                            width: width,
                            height: height,
                            // 设置大图背景
                            backgroundImage: `url(${imageUrl})`,
                            // ✨ 核心魔法：使用负坐标偏移，精准露出家具
                            backgroundPosition: `-${x}px -${y}px`, 
                            backgroundRepeat: 'no-repeat',
                            // 缩放适应 UI
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                            // 居中显示
                            position: 'absolute',
                            left: (size - width * scale) / 2,
                            top: (size - height * scale) / 2,
                            // 保持像素清晰度
                            imageRendering: 'pixelated'
                        }} />
                    </div>
                );
            }
        }
    }

    // ====================================================
    // 🟢 模式 B: 旧版网格切片 (tileSheet + tilePos)
    // ====================================================
    const sheet = item.tileSheet || item.sheetPath;
    if (sheet && item.tilePos) {
        const gridSize = 48; 
        const bgX = -(item.tilePos.x * gridSize);
        const bgY = -(item.tilePos.y * gridSize);
        
        // 兼容旧数据的尺寸定义
        const itemW = item.tileSize?.w || item.w || gridSize;
        const itemH = item.tileSize?.h || item.h || gridSize;
        const scale = Math.min(size / itemW, size / itemH);

        return (
            <div style={{ width: size, height: size, position: 'relative', overflow: 'hidden', pointerEvents: 'none' }}>
                <div 
                    style={{
                        width: itemW,
                        height: itemH,
                        backgroundImage: `url(${sheet})`,
                        backgroundPosition: `${bgX}px ${bgY}px`,
                        backgroundRepeat: 'no-repeat',
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        position: 'absolute',
                        left: (size - itemW * scale) / 2,
                        top: (size - itemH * scale) / 2,
                        imageRendering: 'pixelated'
                    }}
                />
            </div>
        );
    }

    // ====================================================
    // 🟢 模式 C: 兜底色块 (防止没图时一片空白)
    // ====================================================
    return (
        <div style={{ 
            width: size, 
            height: size, 
            background: item.color || '#444', 
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.5
        }}>
            <span style={{ fontSize: 10, color: '#fff' }}>?</span>
        </div>
    );
};

// ==========================================
// 🎨 常量定义 (颜色、家具目录等)
// ==========================================

const COLORS = [
    '#ff7675', '#74b9ff', '#55efc4', '#fdcb6e', '#a29bfe', 
    '#e17055', '#0984e3', '#00b894', '#6c5ce7', '#d63031',
    '#2d3436', '#636e72', '#b2bec3', '#dfe6e9', '#ffffff',
    '#8b4513', '#cd84f1', '#ffcccc', '#182C61', '#2C3A47',
    '#8cb393', '#5a8fff', '#303952', '#f7d794', '#ea8685'
];

const PLOT_NAMES: Record<string, string> = {
    'default_empty': '自定义空地',
    'apt_luxury_l': '豪华公寓(大)',
    'apt_luxury_s': '豪华公寓(小)',
    'apt_luxury_m': '豪华公寓(中)',
    'clothing_s': '服装店',
    'super_l': '大型超市',
    'convenience_l': '便利店(大)',
    'convenience_s': '便利店(小)',
    'bookstore_s': '书店',
    'restaurant_s': '餐厅',
    'elder_home_s': '养老院',
    'school_high_l': '高中(大)',
    'school_elem_s': '小学',
    'hospital_l': '医院',
    'cinema_s': '电影院',
    'cafe_l': '咖啡厅(大)',
    'cafe_s': '咖啡厅(小)',
    'business_l': '写字楼',
    'gallery_l': '画廊',
    'design_s': '设计室',
    'gym_center': '健身房',
    'nightclub_m': '夜店',
    'netcafe_s': '网吧',
    'villa_m': '别墅(中)',
    'villa_s': '别墅(小)',
    'library_s': '图书馆',
};


const SURFACE_TYPES = [
    { label: '草地', color: '#8cb393', pattern: 'grass' },
    { label: '柏油路', color: '#3d404b', pattern: 'stripes' },
    { label: '水池', color: '#5a8fff', pattern: 'water' },
];

const FLOOR_PATTERNS = [
    { label: '基础', pattern: 'simple' },
    { label: '木地板', pattern: 'wood' },
    { label: '瓷砖', pattern: 'tile' },
    { label: '网格', pattern: 'grid' },
];

const EditorPanel: React.FC<EditorPanelProps> = ({ onClose }) => {
    // UI Local State
    const [currentMode, setCurrentMode] = useState<'plot' | 'furniture' | 'floor' | 'none'>('none');
    const [furnCategory, setFurnCategory] = useState('skills');
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [activeTool, setActiveTool] = useState<'camera' | 'select'>('select');
    
    // Synced State from GameStore
    const [activePlotId, setActivePlotId] = useState<string | null>(null);
    const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
    const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
    const [interactionState, setInteractionState] = useState<string>('idle');
    const [historyLen, setHistoryLen] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    // 🟢 [新增] 处理文件选择
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await GameStore.importMapFromFile(file);
            // 清空 value 允许重复导入同一个文件
            e.target.value = ''; 
        }
    };

    // 🟢 [新增] 地皮模式下的子分类状态
    const [plotCategory, setPlotCategory] = useState<'building' | 'decor' | 'surface' | 'props'>('building');
    
    // [新增] 本地状态用于编辑输入框 (防止输入卡顿)
    const [editName, setEditName] = useState('');
    const [editType, setEditType] = useState('');


    // [新增] 专门的进入装修处理函数
    const handleEnterBuildMode = () => {
        if (selectedPlotId) {
            // @ts-ignore
            GameStore.editor.enterBuildMode(selectedPlotId);
            // 强制刷新 UI 状态
            setCurrentMode('furniture'); 
        }
    };

    // 1. 初始化与订阅
    useEffect(() => {
        // 防止重复初始化导致状态重置
        if (GameStore.editor.mode === 'none' && !GameStore.editor.activePlotId) {
            GameStore.enterEditorMode();
        }

        const updateUI = () => {
            // 同步 Store 状态到 React 本地状态，避免渲染死循环
            // @ts-ignore
            const editor = GameStore.editor;
            
            setActivePlotId(editor.activePlotId);
            setSelectedPlotId(editor.selectedPlotId);
            setSelectedFurnitureId(editor.selectedFurnitureId);
            setInteractionState(editor.interactionState);
            setActiveTool(editor.activeTool);
            setCurrentMode(editor.mode); // 同步当前的工具模式
            setHistoryLen(editor.history?.length || 0);
        };

        const unsub = GameStore.subscribe(updateUI);
        updateUI(); // Initial sync

        return () => {
            unsub();
            // 注意：组件卸载时不自动 confirmChanges，防止误触，由用户点击“退出”决定
        };
    }, []);

    // 🟢 [新增] 当选中的地皮变化时，同步输入框的值
    useEffect(() => {
        if (selectedPlotId && !activePlotId) { // 仅在世界模式下
            const plot = GameStore.worldLayout.find(p => p.id === selectedPlotId);
            if (plot) {
                setEditName(plot.customName || PLOT_NAMES[plot.templateId] || '未命名');
                setEditType(plot.customType || 'default');
            }
        }
    }, [selectedPlotId, activePlotId]);

    // 2. 核心操作 Wrapper
    const handleSwitchMode = (targetMode: 'plot' | 'furniture' | 'floor') => {
        // 确保 UI 点击不会违规操作
        if (!isBuildMode && targetMode !== 'plot') return;
        if (isBuildMode && targetMode === 'plot') return;
        GameStore.editor.mode = targetMode;
        GameStore.notify();
    };


    const handleExitBuildMode = () => {
        // @ts-ignore
        if (GameStore.editor.exitBuildMode) {
            // @ts-ignore
            GameStore.editor.exitBuildMode();
        }
    };

    // 3. 工具栏操作
    const handleSave = () => { GameStore.confirmEditorChanges(); onClose(); };
    const handleCancel = () => { GameStore.cancelEditorChanges(); onClose(); };
    
    // 4. 内容渲染
    const isBuildMode = !!activePlotId;

    // 左侧工具栏
    const renderTools = () => (
        <div className="flex flex-col gap-2 p-2 border-r border-white/10 bg-[#1e222e] items-center overflow-y-auto custom-scrollbar">
            {/* 返回/退出按钮 */}
            {isBuildMode ? (
                <button 
                    onClick={() => GameStore.editor.exitBuildMode()}
                    className="w-10 h-10 mb-2 rounded bg-blue-600 hover:bg-blue-500 text-white flex flex-col items-center justify-center shadow-lg border border-white/20"
                    title="返回世界地图"
                >
                    <span className="text-xl">🔙</span>
                </button>
            ) : (
                <div className="w-10 h-10 mb-2 flex items-center justify-center text-2xl" title="世界编辑模式">
                    🌍
                </div>
            )}

            <div className="w-full h-px bg-white/10 my-1"></div>

            <button onClick={() => GameStore.editor.setTool('select')} className={`w-8 h-8 rounded flex items-center justify-center ${activeTool === 'select' ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400'}`} title="选择 (V)">👆</button>
            
            {/* 🟢 撤销/重做 按钮 */}
            <button onClick={() => GameStore.undo()} className="w-8 h-8 rounded flex items-center justify-center bg-white/5 text-gray-400 hover:text-white" title="撤销">
                ⬅️
            </button>
            <button onClick={() => GameStore.redo()} className="w-8 h-8 rounded flex items-center justify-center bg-white/5 text-gray-400 hover:text-white" title="重做">
                ➡️
            </button>
            
            <div className="w-full h-px bg-white/10 my-1"></div>

            <button onClick={() => GameStore.editor.rotateSelection()} className="w-8 h-8 rounded flex items-center justify-center bg-white/5 text-gray-400 hover:text-white" title="旋转 (R)">🔄</button>
            <button onClick={() => GameStore.editor.deleteCurrentSelection()} className="w-8 h-8 rounded flex items-center justify-center bg-white/5 text-gray-400 hover:text-red-400" title="删除 (Del)">🗑️</button>
            
            {/* 🟢 清空地图按钮 */}
            {!isBuildMode && (
                <button onClick={() => GameStore.clearMap()} className="w-8 h-8 mt-2 rounded flex items-center justify-center bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white border border-red-800/50" title="清空地图">
                    💣
                </button>
            )}
        </div>
    );

    // 中间 Tabs 选择器
    const renderTabs = () => (
        <div className="flex flex-col w-20 bg-[#1e222e] border-r border-white/10">
            {!isBuildMode && (
                <button onClick={() => handleSwitchMode('plot')} className={`flex-1 ... ${currentMode === 'plot' ? 'bg-white/10' : ''}`}>
                    <span className="text-xl">🗺️</span><span className="text-xs">地皮</span>
                </button>
            )}
            
            {isBuildMode && (
                <>
                    <button onClick={() => handleSwitchMode('furniture')} className={`flex-1 ... ${currentMode === 'furniture' ? 'bg-white/10' : ''}`}>
                        <span className="text-xl">🪑</span><span className="text-xs">家具</span>
                    </button>
                    <button onClick={() => handleSwitchMode('floor')} className={`flex-1 ... ${currentMode === 'floor' ? 'bg-white/10' : ''}`}>
                        <span className="text-xl">🧱</span><span className="text-xs">硬装</span>
                    </button>
                </>
            )}
        </div>
    );

    // 内容区域
    const renderContent = () => (
        <div className="flex-1 bg-[#2d3436] p-3 flex flex-col overflow-hidden">
            
            {/* World Mode Content */}
            {!isBuildMode && currentMode === 'plot' && (
                <div className="flex flex-col h-full">
                    {/* 子分类切换 Tabs */}
                    <div className="flex gap-2 pb-2 mb-2 border-b border-white/10 overflow-x-auto">
                        <button onClick={() => setPlotCategory('building')} className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${plotCategory === 'building' ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400'}`}>🏢 建筑</button>
                        <button onClick={() => setPlotCategory('surface')} className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${plotCategory === 'surface' ? 'bg-gray-500 text-white' : 'bg-white/10 text-gray-400'}`}>🧱 地表</button>
                        <button onClick={() => setPlotCategory('decor')} className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${plotCategory === 'decor' ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-400'}`}>🌳 景观</button>
                        {/* 🟢 新增：世界道具 Tab */}
                        <button onClick={() => setPlotCategory('props')} className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${plotCategory === 'props' ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-400'}`}>🚥 街道设施</button>
                    </div>

                    {/* 列表内容 */}
                    {/* 修改前: grid-cols-8 */}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(50px,1fr))] gap-1 overflow-y-auto custom-scrollbar content-start">
                 
                        {/* 1. 建筑列表 (原有逻辑) */}
                        {plotCategory === 'building' && (
                            <>
                                <button onClick={() => GameStore.startDrawingPlot('default_empty')} className="aspect-video bg-white/5 border border-white/10 hover:border-white/40 rounded flex flex-col items-center justify-center gap-1">
                                    <span className="text-lg">✏️</span>
                                    <span className="text-[10px] text-gray-300">自定义划区</span>
                                </button>
                                {Object.keys(PLOTS).filter(k => !k.startsWith('road') && k !== 'default_empty').map(key => (
                                    <button key={key} onClick={() => GameStore.startPlacingPlot(key)} className="aspect-video bg-white/5 border border-white/10 hover:border-white/40 rounded p-2 flex flex-col text-left group">
                                        <span className="text-[10px] font-bold text-gray-200 truncate group-hover:text-white">{PLOT_NAMES[key] || key}</span>
                                        <span className="text-[9px] text-gray-500">{PLOTS[key].width}x{PLOTS[key].height}</span>
                                    </button>
                                ))}
                            </>
                        )}

                        {/* 2. 地表 (使用新数据) */}
                        {plotCategory === 'surface' && WORLD_SURFACE_ITEMS.map(item => (
                            <button 
                                key={item.id} 
                                onClick={() => GameStore.editor.startPlacingPlot(
                                    item.id, 
                                    { w: item.w, h: item.h }, 
                                    'surface',
                                    item // 👈 ✨ [修改] 传递整个 item 作为第四个参数 (extraData)
                                )} 
                                className="aspect-video bg-white/5 border border-white/10 hover:border-gray-500/50 rounded p-1 flex flex-col items-center justify-between group"
                            >
                                {/* 🟢 使用 ItemThumbnail，尺寸设为 32 或更大 */}
                                <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
                                    <ItemThumbnail item={item} size={40} />
                                </div>
                                <span className="text-[10px] font-bold text-gray-300 group-hover:text-white">{item.label}</span>
                            </button>
                        ))}

                        {/* 3. 景观 (使用新数据) */}
                        {plotCategory === 'decor' && WORLD_DECOR_ITEMS.map(item => (
                            <button 
                                key={item.id} 
                                onClick={() => GameStore.editor.startPlacingPlot(item.id, { w: item.w, h: item.h }, 'decor')}
                                className="aspect-square bg-white/5 border border-white/10 hover:border-green-500/50 rounded p-2 flex flex-col items-center justify-center group"
                            >
                                <div className="w-8 h-8 rounded-full mb-1 shadow-sm" style={{ backgroundColor: item.color }}></div>
                                <span className="text-[10px] font-bold text-gray-300 group-hover:text-white">{item.label}</span>
                            </button>
                        ))}

                        {/* 4. 🟢 [新增] 街道设施 (直接调用 startPlacingFurniture) */}
                        {plotCategory === 'props' && (
                             // 我们把 FURNITURE_CATALOG 里的 'street' 和 'decor' 类目合并显示在这里
                             [...FURNITURE_CATALOG['street'].items, ...FURNITURE_CATALOG['decor']?.items || []].map((item, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => GameStore.startPlacingFurniture(item)}
                                    className="aspect-square bg-white/5 border border-white/10 hover:border-orange-500/50 rounded p-1 flex flex-col items-center justify-center group"
                                >
                                    <div className="mb-1">
                                        <ItemThumbnail item={item} size={40} />
                                    </div>
                                    <span className="text-[9px] font-bold text-gray-300 group-hover:text-white truncate w-full text-center">{item.label}</span>
                                </button>
                             ))
                        )}
                    </div>
                </div>
            )}

            {/* Build Mode: Furniture */}
            {isBuildMode && currentMode === 'furniture' && (
                <div className="flex flex-col h-full">
                    {/* Sub-Categories */}
                    <div className="flex gap-2 pb-2 mb-2 border-b border-white/10 overflow-x-auto shrink-0">
                        {Object.keys(FURNITURE_CATALOG).map(k => (
                            <button 
                                key={k} 
                                onClick={() => setFurnCategory(k)} 
                                className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors ${furnCategory === k ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                            >
                                {FURNITURE_CATALOG[k].label}
                            </button>
                        ))}
                    </div>
                    {/* Items Grid */}
                    {/* 🟢 修改：使用 auto-fill 智能排列，最小宽度 48px，间距缩小为 gap-1 */}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-1 overflow-y-auto custom-scrollbar content-start p-1">
                        {FURNITURE_CATALOG[furnCategory]?.items.map((item, i) => (
                            <button 
                                key={i} 
                                onClick={() => {
                                    const c = selectedColor || item.color || '#ffffff';
                                    GameStore.startPlacingFurniture({ ...item, color: c });
                                }}
                                // 🟢 修改：移除 aspect-square，改用固定高度或 min-h，避免字太长被挤压
                                // 当然，如果你喜欢正方形格子，保留 aspect-square 也没问题
                                className="aspect-square bg-white/5 border border-white/10 hover:border-white/40 hover:bg-white/10 rounded flex flex-col items-center justify-center p-0.5 group"
                                title={item.label}
                            >
                                <div className="mb-0.5">
                                    {/* 🟢 修改：稍微调大一点缩略图占比，因为格子变小了 */}
                                    <ItemThumbnail item={item} size={36} />
                                </div>
                                {/* 🟢 修改：字体进一步缩小，并且只在 hover 时显示全名(可选)，或者平时显示截断 */}
                                <span className="text-[8px] text-gray-500 group-hover:text-gray-300 scale-90 truncate w-full text-center leading-tight">
                                    {item.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Build Mode: Floor/Room */}
            {isBuildMode && currentMode === 'floor' && (
                <div className="flex flex-col gap-4 overflow-y-auto">
                    <div>
                        <div className="text-[10px] text-gray-400 font-bold mb-2">房间工具</div>
                        <button onClick={() => GameStore.startDrawingFloor('simple', '#ffffff', '房间', true)} className="w-full py-2 bg-blue-600/20 border border-blue-500/50 rounded flex items-center justify-center gap-2 hover:bg-blue-600/30">
                            <span>🏗️</span>
                            <span className="text-xs text-blue-100">绘制房间 (带墙)</span>
                        </button>
                    </div>
                    <div>
                        <div className="text-[10px] text-gray-400 font-bold mb-2">地板材质 (笔刷)</div>
                        <div className="grid grid-cols-8 gap-2">
                            {FLOOR_PATTERNS.map(fp => (
                                <button key={fp.pattern} onClick={() => GameStore.startDrawingFloor(fp.pattern, selectedColor || '#fff', '地面', false)} className="aspect-square bg-white/5 border border-white/10 rounded flex flex-col items-center justify-center hover:bg-white/10">
                                    <div className="w-4 h-4 bg-gray-500 mb-1"></div>
                                    <span className="text-[8px] text-gray-400">{fp.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Color Palette (Shared) */}
            {isBuildMode && (
                <div className="mt-auto pt-2 border-t border-white/10">
                     <div className="flex flex-wrap gap-1">
                        {COLORS.slice(0, 14).map(c => (
                            <button 
                                key={c} 
                                onClick={() => {
                                    setSelectedColor(c);
                                    // 实时更新选中物体的颜色
                                    if (selectedFurnitureId) {
                                        const f = GameStore.furniture.find(i => i.id === selectedFurnitureId);
                                        if (f) { f.color = c; GameStore.notify(); }
                                    }
                                }} 
                                className={`w-4 h-4 rounded-full border ${selectedColor === c ? 'border-white scale-110' : 'border-white/10'}`} 
                                style={{background: c}} 
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    // 右侧状态栏
    // 右侧状态栏
    const renderStatus = () => {
        // [新增] 判断当前编辑类型是否为特殊装饰类型
        const isSpecialType = editType === 'decor' || editType === 'surface';

        return (
            <div className="w-[200px] bg-[#1e222e] border-l border-white/10 p-3 flex flex-col gap-3">
                {/* 状态卡片 */}
                <div className={`rounded p-3 border ${activePlotId ? 'bg-blue-900/20 border-blue-500/50' : 'bg-black/30 border-white/10'}`}>
                    {activePlotId ? (
                        // 装修模式状态
                        <>
                            <div className="flex items-center gap-2 mb-2 text-blue-400 font-bold border-b border-blue-500/30 pb-1">
                                <span className="text-xl">🏗️</span>
                                <span>装修进行中</span>
                            </div>
                            <div className="text-[10px] text-gray-400">当前地块 ID:</div>
                            <div className="text-xs font-mono text-white mb-2">{activePlotId.slice(-8)}</div>
                            {selectedFurnitureId ? (
                                <div className="text-yellow-400 text-[10px] animate-pulse">⚡ 已选中家具</div>
                            ) : (
                                <div className="text-gray-500 text-[10px]">可拖拽家具或修改地板</div>
                            )}
                        </>
                    ) : (
                        // 世界模式状态
                        <>
                            <div className="flex items-center gap-2 mb-2 text-green-400 font-bold border-b border-green-500/30 pb-1">
                                <span className="text-xl">🌍</span>
                                <span>世界视图</span>
                            </div>
                            {/* 🟢 [新增] 地图导入导出区域 (仅在未选中任何物体时显示，或者始终显示在底部) */}
                            {!selectedPlotId && !selectedFurnitureId && (
                                <div className="flex flex-col gap-2 mb-2">
                                    <div className="text-[10px] text-gray-500 mb-1">地图数据管理</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            onClick={() => GameStore.exportCurrentMap()}
                                            className="bg-white/5 hover:bg-white/10 border border-white/20 text-white py-1.5 rounded text-[10px] flex items-center justify-center gap-1 transition-colors"
                                        >
                                            📤 导出地图
                                        </button>
                                        <button 
                                            onClick={handleImportClick}
                                            className="bg-white/5 hover:bg-white/10 border border-white/20 text-white py-1.5 rounded text-[10px] flex items-center justify-center gap-1 transition-colors"
                                        >
                                            📥 导入地图
                                        </button>
                                        {/* 隐藏的文件输入框 */}
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            accept=".json"
                                            onChange={handleFileChange}
                                        />
                                    </div>
                                    <div className="h-px bg-white/10 my-1"></div>
                                </div>
                            )}
                            {selectedPlotId ? (
                                <div className="flex flex-col gap-2">
                                    <div className="text-[10px] text-gray-400">已选中地皮: <span className="font-mono text-white">{selectedPlotId.slice(-8)}</span></div>
                                    
                                    {/* 名称编辑 (始终允许) */}
                                    <div>
                                        <label className="text-[10px] text-gray-500 block mb-1">地皮名称</label>
                                        <input 
                                            type="text" 
                                            value={editName}
                                            onChange={(e) => {
                                                setEditName(e.target.value);
                                                // 实时更新
                                                // @ts-ignore
                                                GameStore.editor.updatePlotMetadata(selectedPlotId, e.target.value, editType);
                                            }}
                                            className="w-full bg-black/50 border border-white/20 rounded px-2 py-1 text-xs text-white focus:border-green-500 outline-none"
                                        />
                                    </div>

                                    {/* [修改] 类型编辑区域 */}
                                    {isSpecialType ? (
                                        // 🟢 如果是装饰/地表，显示只读标签
                                        <div className="mt-1">
                                            <label className="text-[10px] text-gray-500 block mb-1">类型属性</label>
                                            <div className="w-full bg-white/5 border border-white/10 rounded px-2 py-2 flex items-center gap-2">
                                                <span className="text-lg">{editType === 'decor' ? '🌳' : '🧱'}</span>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-gray-300">
                                                        {editType === 'decor' ? '景观装饰' : '地形地表'}
                                                    </span>
                                                    <span className="text-[9px] text-gray-500">仅作装饰，不可经营</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // 🟢 如果是普通地皮，显示原本的 Select (移除 decor/surface 选项)
                                        <div>
                                            <label className="text-[10px] text-gray-500 block mb-1">用地类型</label>
                                            <select 
                                                value={editType}
                                                onChange={(e) => {
                                                    setEditType(e.target.value);
                                                    // 实时更新
                                                    // @ts-ignore
                                                    GameStore.editor.updatePlotMetadata(selectedPlotId, editName, e.target.value);
                                                }}
                                                className="w-full bg-black/50 border border-white/20 rounded px-1 py-1 text-xs text-white focus:border-green-500 outline-none"
                                            >
                                                <option value="residential">住宅用地</option>
                                                <option value="commercial">商业用地</option>
                                                <option value="public">公共设施</option>
                                            </select>
                                        </div>
                                    )}
                                    
                                    <div className="h-px bg-white/10 my-1"></div>

                                    {/* [修改] 只有非装饰类型才显示“进入装修”按钮 */}
                                    {!isSpecialType && (
                                        <button 
                                            onClick={handleEnterBuildMode}
                                            className="w-full py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all border border-white/20"
                                        >
                                            <span>🔨 进入装修</span>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="text-gray-500 italic text-[10px] py-4 text-center">
                                    请在地图上点击选择<br/>地皮、装饰或路面
                                </div>
                            )}
                        </>
                    )}
                </div>
                {/* 底部操作区 */}
                <div className="mt-auto grid grid-cols-2 gap-2">
                    <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white py-2 rounded font-bold text-xs shadow-lg">✔ 保存退出</button>
                    <button onClick={handleCancel} className="bg-white/10 hover:bg-white/20 text-white py-2 rounded font-bold text-xs">✕ 取消</button>
                </div>
            </div>
        );
    };

    return (
        <div 
            onMouseDown={(e) => e.stopPropagation()} 
            // 🟢 [修改] 样式：h-[260px] 改为 h-1/3 (屏幕三分之一)，并添加 max-h 限制
            className="fixed bottom-0 left-0 right-0 h-1/3 max-h-[500px] min-h-[260px] flex z-50 shadow-2xl animate-[slideUp_0.2s_ease-out] select-none pointer-events-auto"
        >
            {renderTools()}
            {renderTabs()}
            {renderContent()}
            {renderStatus()}
        </div>
    );
};

export default EditorPanel;