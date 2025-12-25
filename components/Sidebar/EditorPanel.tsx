import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GameStore } from '../../utils/simulation';
import { PLOTS } from '../../data/plots';
import { Furniture } from '../../types';

interface EditorPanelProps {
    onClose: () => void; 
}

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

// 家具目录
const FURNITURE_CATALOG: Record<string, { label: string, items: Partial<Furniture>[] }> = {
    'skills': {
        label: '技能设施',
        items: [
            { label: '跑步机', w: 40, h: 70, color: '#2d3436', utility: 'run', pixelPattern: 'treadmill', tags: ['gym'] },
            { label: '举重床', w: 50, h: 80, color: '#2d3436', utility: 'lift', pixelPattern: 'weights_rack', tags: ['gym'] },
            { label: '钢琴', w: 60, h: 50, color: '#1e1e1e', utility: 'play_instrument', pixelPattern: 'piano', tags: ['piano', 'instrument'] },
            { label: '国际象棋', w: 40, h: 40, color: '#dfe6e9', utility: 'play_chess', pixelPattern: 'chess_table', tags: ['desk', 'game'] },
            { label: '画架', w: 40, h: 50, color: '#a29bfe', utility: 'paint', pixelPattern: 'easel', tags: ['easel', 'art'] },
            { label: '种植箱', w: 40, h: 40, color: '#55efc4', utility: 'gardening', pixelPattern: 'bush', tags: ['plant'] },
            { label: '演讲台', w: 40, h: 30, color: '#a29bfe', utility: 'practice_speech', pixelPattern: 'desk_simple', tags: ['desk'] },
            { label: '编程电脑', w: 60, h: 40, color: '#74b9ff', utility: 'work', pixelPattern: 'desk_pixel', tags: ['computer', 'desk'] },
        ]
    },
    'home': {
        label: '生活家居',
        items: [
            { label: '双人床', w: 80, h: 100, color: '#ff7675', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed', 'sleep'] },
            { label: '单人床', w: 50, h: 80, color: '#74b9ff', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed', 'sleep'] },
            { label: '沙发', w: 100, h: 40, color: '#a29bfe', utility: 'comfort', pixelPattern: 'sofa_vip', tags: ['sofa', 'seat'] },
            { label: '餐桌', w: 60, h: 60, color: '#fab1a0', utility: 'hunger', pixelPattern: 'table_dining', tags: ['table'] },
            { label: '冰箱', w: 40, h: 40, color: '#fff', utility: 'hunger', pixelPattern: 'fridge', tags: ['kitchen'] },
            { label: '马桶', w: 30, h: 30, color: '#fff', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
            { label: '淋浴间', w: 40, h: 40, color: '#81ecec', utility: 'hygiene', pixelPattern: 'shower_stall', tags: ['shower'] },
        ]
    },
    'work': {
        label: '办公商业',
        items: [
            { label: '工位', w: 50, h: 40, color: '#dfe6e9', utility: 'work', pixelPattern: 'desk_pixel', tags: ['computer', 'desk'] },
            { label: '老板桌', w: 80, h: 50, color: '#8b4513', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk'] },
            { label: '会议桌', w: 120, h: 60, color: '#f5f6fa', utility: 'work', pixelPattern: 'table_dining', tags: ['meeting'] },
            { label: '收银台', w: 60, h: 40, color: '#2c3e50', utility: 'work', pixelPattern: 'cashier', tags: ['cashier'] },
            { label: '货架', w: 50, h: 100, color: '#fdcb6e', utility: 'buy_item', pixelPattern: 'shelf_food', tags: ['shelf'] },
        ]
    },
    'decor': {
        label: '装饰环境',
        items: [
            { label: '长椅', w: 60, h: 20, color: '#e17055', utility: 'comfort', pixelPattern: 'bench_park', tags: ['seat'] },
            { label: '树木', w: 50, h: 50, color: '#27ae60', utility: 'none', pixelPattern: 'tree_pixel', tags: ['tree'] },
            { label: '灌木', w: 30, h: 30, color: '#2ecc71', utility: 'none', pixelPattern: 'bush', tags: ['plant'] },
            { label: '贩卖机', w: 40, h: 30, color: '#ff5252', utility: 'buy_drink', pixelPattern: 'vending', tags: ['shop'] },
            { label: '垃圾桶', w: 20, h: 20, color: '#636e72', utility: 'none', pixelPattern: 'trash', tags: ['decor'] },
        ]
    }
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
        <div className="flex flex-col gap-2 p-2 border-r border-white/10 bg-[#1e222e] items-center">
            {/* 模式切换 / 返回按钮 */}
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
            <button onClick={() => GameStore.editor.rotateSelection()} className="w-8 h-8 rounded flex items-center justify-center bg-white/5 text-gray-400 hover:text-white" title="旋转 (R)">🔄</button>
            <button onClick={() => GameStore.editor.deleteCurrentSelection()} className="w-8 h-8 rounded flex items-center justify-center bg-white/5 text-gray-400 hover:text-red-400" title="删除 (Del)">🗑️</button>
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
            {/* World Mode: Plot List */}
            {!isBuildMode && currentMode === 'plot' && (
                <div className="grid grid-cols-4 gap-2 overflow-y-auto custom-scrollbar content-start">
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
                    <div className="grid grid-cols-8 gap-2 overflow-y-auto custom-scrollbar content-start">
                        {FURNITURE_CATALOG[furnCategory]?.items.map((item, i) => (
                            <button 
                                key={i} 
                                onClick={() => {
                                    const c = selectedColor || item.color || '#ffffff';
                                    GameStore.startPlacingFurniture({ ...item, color: c });
                                }}
                                className="aspect-square bg-white/5 border border-white/10 hover:border-white/40 hover:bg-white/10 rounded flex flex-col items-center justify-center p-1"
                                title={item.label}
                            >
                                <div className="w-6 h-6 rounded mb-1 shadow-sm" style={{background: item.color}}></div>
                                <span className="text-[9px] text-gray-400 scale-90 truncate w-full text-center">{item.label}</span>
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
    const renderStatus = () => (
        <div className="w-[200px] bg-[#1e222e] border-l border-white/10 p-3 flex flex-col gap-3">
            {/* 状态信息卡片 */}
            <div className={`rounded p-3 border ${activePlotId ? 'bg-blue-900/20 border-blue-500/50' : 'bg-black/30 border-white/10'}`}>
                {activePlotId ? (
                    <>
                        <div className="flex items-center gap-2 mb-2 text-blue-400 font-bold border-b border-blue-500/30 pb-1">
                            <span className="text-xl">🏗️</span>
                            <span>装修进行中</span>
                        </div>
                        <div className="text-[10px] text-gray-400">当前地块 ID:</div>
                        <div className="text-xs font-mono text-white mb-2">{activePlotId.slice(-8)}</div>
                        
                        {selectedFurnitureId ? (
                            <div className="text-yellow-400 text-[10px] animate-pulse">
                                ⚡ 已选中家具
                            </div>
                        ) : (
                            <div className="text-gray-500 text-[10px]">可拖拽家具或修改地板</div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2 mb-2 text-green-400 font-bold border-b border-green-500/30 pb-1">
                            <span className="text-xl">🌍</span>
                            <span>世界视图</span>
                        </div>
                        {selectedPlotId ? (
                            <>
                                <div className="text-[10px] text-gray-400">已选中地皮:</div>
                                <div className="text-xs font-mono text-white mb-2">{selectedPlotId.slice(-8)}</div>
                                
                                {/* 醒目的进入按钮 */}
                                <button 
                                    onClick={() => GameStore.editor.enterBuildMode(selectedPlotId)}
                                    className="w-full mt-2 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all border border-white/20"
                                >
                                    <span>🔨 进入装修</span>
                                </button>
                            </>
                        ) : (
                            <div className="text-gray-500 italic text-[10px] py-4 text-center">
                                请在地图上点击选择一块地皮<br/>以开始建造
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

    return (
        <div 
            onMouseDown={(e) => e.stopPropagation()} // 阻止事件冒泡 (保持原有逻辑)
            // ✅ 修改：在 className 末尾添加 pointer-events-auto
            className="fixed bottom-0 left-0 right-0 h-[260px] flex z-50 shadow-2xl animate-[slideUp_0.2s_ease-out] select-none pointer-events-auto"
        >
            {renderTools()}
            {renderTabs()}
            {renderContent()}
            {renderStatus()}
        </div>
    );
};

export default EditorPanel;