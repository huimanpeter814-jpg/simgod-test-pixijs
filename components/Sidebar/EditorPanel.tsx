import React, { useState, useEffect, useRef } from 'react';
import { GameStore } from '../../utils/simulation';
import { PLOTS } from '../../data/plots';
import { Furniture } from '../../types';

interface EditorPanelProps {
    onClose: () => void; 
}

const COLORS = [
    '#ff7675', '#74b9ff', '#55efc4', '#fdcb6e', '#a29bfe', 
    '#e17055', '#0984e3', '#00b894', '#6c5ce7', '#d63031',
    '#2d3436', '#636e72', '#b2bec3', '#dfe6e9', '#ffffff',
    '#8b4513', '#cd84f1', '#ffcccc', '#182C61', '#2C3A47',
    '#8cb393', '#5a8fff', '#303952', '#f7d794', '#ea8685'
];

const PLOT_NAMES: Record<string, string> = {
    'default_empty': '自定义空地',
    'tech_hq': '科技园区',
    'finance_center': '金融中心',
    'creative_park': '创意工坊',
    'kindergarten': '向日葵幼儿园',
    'elementary': '实验小学',
    'high_school': '第一中学',
    'hospital_l': '综合医院',
    'gym_center': '健身中心',
    'library': '市图书馆',
    'apt_luxury': '豪华公寓',
    'villa_wide': '半山别墅',
    'elder_home': '养老社区',
    'restaurant': '美食餐厅',
    'cafe': '咖啡厅',
    'super_l': '大型超市',
    'cinema': '电影院',
    'nightclub': '不夜城Club',
    'netcafe': '极速网咖',
    'park_center': '中央公园'
};

// 扩充后的家具目录
const FURNITURE_CATALOG: Record<string, { label: string, items: Partial<Furniture>[] }> = {
    'skills': {
        label: '技能/爱好',
        items: [
            // 健身
            { label: '跑步机', w: 40, h: 70, color: '#2d3436', utility: 'run', pixelPattern: 'treadmill', tags: ['gym'] },
            { label: '举重床', w: 50, h: 80, color: '#2d3436', utility: 'lift', pixelPattern: 'weights_rack', tags: ['gym'] },
            { label: '瑜伽垫', w: 30, h: 70, color: '#ff7aa8', utility: 'stretch', pixelPattern: 'yoga_mat', tags: ['gym'] },
            // 音乐
            { label: '钢琴', w: 60, h: 50, color: '#1e1e1e', utility: 'play_instrument', pixelPattern: 'piano', tags: ['piano', 'instrument'] },
            { label: '吉他架', w: 30, h: 30, color: '#e17055', utility: 'play_instrument', pixelPattern: 'easel', tags: ['instrument'] },
            // 逻辑
            { label: '国际象棋', w: 40, h: 40, color: '#dfe6e9', utility: 'play_chess', pixelPattern: 'chess_table', tags: ['desk', 'game'] },
            { label: '编程工作站', w: 60, h: 40, color: '#74b9ff', utility: 'work', pixelPattern: 'desk_pixel', tags: ['computer', 'desk'] },
            // 艺术
            { label: '画架', w: 40, h: 50, color: '#a29bfe', utility: 'paint', pixelPattern: 'easel', tags: ['easel', 'art'] },
            // 园艺
            { label: '种植箱', w: 40, h: 40, color: '#55efc4', utility: 'gardening', pixelPattern: 'bush', tags: ['plant'] },
            { label: '玫瑰花丛', w: 40, h: 40, color: '#ff7675', utility: 'gardening', pixelPattern: 'flower_rose', tags: ['plant'] },
            // 钓鱼
            { label: '私人鱼塘', w: 100, h: 80, color: '#74b9ff', utility: 'fishing', pixelPattern: 'water', tags: ['decor'] },
            // 魅力
            { label: '演讲台', w: 40, h: 30, color: '#a29bfe', utility: 'practice_speech', pixelPattern: 'desk_simple', tags: ['desk'] },
            { label: '落地镜', w: 20, h: 60, color: '#81ecec', utility: 'practice_speech', pixelPattern: 'closet', tags: ['mirror'] },
        ]
    },
    'career': {
        label: '职业设施', 
        items: [
            // IT / 商务
            { label: '标准工位', w: 50, h: 40, color: '#dfe6e9', utility: 'work', pixelPattern: 'desk_pixel', tags: ['computer', 'desk'] },
            { label: '老板班台', w: 80, h: 50, color: '#8b4513', utility: 'work', pixelPattern: 'desk_wood', tags: ['desk', 'boss_desk'] },
            { label: '会议桌', w: 120, h: 60, color: '#f5f6fa', utility: 'work', pixelPattern: 'table_dining', tags: ['meeting'] },
            { label: '服务器', w: 40, h: 60, color: '#1e1e1e', utility: 'work', pixelPattern: 'server', tags: ['server'] },
            // 医疗
            { label: '医疗床', w: 50, h: 80, color: '#fff', utility: 'healing', pixelPattern: 'medical_bed', tags: ['medical_bed', 'bed'] },
            { label: 'CT扫描仪', w: 60, h: 80, color: '#b2bec3', utility: 'none', pixelPattern: 'scanner', tags: ['medical_device'] },
            { label: '护士站', w: 80, h: 40, color: '#fff', utility: 'work', pixelPattern: 'reception', tags: ['desk'] },
            // 餐饮 / 零售
            { label: '收银台', w: 60, h: 40, color: '#2c3e50', utility: 'work', pixelPattern: 'cashier', tags: ['cashier', 'desk'] },
            { label: '大灶台', w: 80, h: 40, color: '#636e72', utility: 'cooking', pixelPattern: 'kitchen', tags: ['stove'] },
            { label: '货架(食品)', w: 50, h: 100, color: '#fdcb6e', utility: 'buy_item', pixelPattern: 'shelf_food', tags: ['shelf'] },
            // 教育
            { label: '黑板', w: 100, h: 10, color: '#2d3436', utility: 'none', tags: ['blackboard'] },
            { label: '课桌', w: 40, h: 30, color: '#fdcb6e', utility: 'study', pixelPattern: 'desk_school', tags: ['desk', 'study'] },
        ]
    },
    'home': {
        label: '家具家电',
        items: [
            { label: '双人床', w: 80, h: 100, color: '#ff7675', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed', 'sleep'] },
            { label: '单人床', w: 50, h: 80, color: '#74b9ff', utility: 'energy', pixelPattern: 'bed_king', tags: ['bed', 'sleep'] },
            { label: '婴儿床', w: 40, h: 40, color: '#ff9ff3', utility: 'nap_crib', pixelPattern: 'bed_crib', tags: ['bed', 'baby'] },
            { label: '真皮沙发', w: 100, h: 40, color: '#a29bfe', utility: 'comfort', pixelPattern: 'sofa_vip', tags: ['sofa', 'seat'] },
            { label: '懒人沙发', w: 40, h: 40, color: '#ff7aa8', utility: 'comfort', pixelPattern: 'sofa_pixel', tags: ['sofa', 'seat'] },
            { label: '餐桌', w: 60, h: 60, color: '#fab1a0', utility: 'hunger', pixelPattern: 'table_dining', tags: ['table'] },
            { label: '冰箱', w: 40, h: 40, color: '#fff', utility: 'hunger', pixelPattern: 'fridge', tags: ['kitchen'] },
            { label: '橱柜', w: 80, h: 40, color: '#b2bec3', utility: 'cooking', pixelPattern: 'kitchen', tags: ['kitchen', 'stove'] },
            { label: '马桶', w: 30, h: 30, color: '#fff', utility: 'bladder', pixelPattern: 'toilet', tags: ['toilet'] },
            { label: '淋浴间', w: 40, h: 40, color: '#81ecec', utility: 'hygiene', pixelPattern: 'shower_stall', tags: ['shower'] },
            { label: '浴缸', w: 70, h: 40, color: '#fff', utility: 'hygiene', pixelPattern: 'bath_tub', tags: ['bath'] },
        ]
    },
    'decor': {
        label: '装饰环境',
        items: [
            { label: '公园长椅', w: 60, h: 20, color: '#e17055', utility: 'comfort', pixelPattern: 'bench_park', tags: ['seat'] },
            { label: '大树', w: 50, h: 50, color: '#27ae60', utility: 'none', pixelPattern: 'tree_pixel', tags: ['tree'] },
            { label: '灌木', w: 30, h: 30, color: '#2ecc71', utility: 'none', pixelPattern: 'bush', tags: ['plant'] },
            { label: '喷泉', w: 100, h: 100, color: '#74b9ff', utility: 'none', pixelPattern: 'water', tags: ['decor'] },
            { label: '自动贩卖机', w: 40, h: 30, color: '#ff5252', utility: 'buy_drink', pixelPattern: 'vending', tags: ['shop'] },
            { label: '垃圾桶', w: 20, h: 20, color: '#636e72', utility: 'none', pixelPattern: 'trash', tags: ['decor'] },
            { label: '地毯(大)', w: 120, h: 80, color: '#ff9c8a', utility: 'none', pixelPattern: 'rug_art', tags: ['decor'] },
        ]
    }
};

const SURFACE_TYPES = [
    { label: '草地', color: '#8cb393', pattern: 'grass' },
    { label: '柏油路', color: '#3d404b', pattern: 'stripes' },
    { label: '斑马线', color: 'rgba(255,255,255,0.2)', pattern: 'zebra' },
    { label: '水池', color: '#5a8fff', pattern: 'water' },
];

const FLOOR_PATTERNS = [
    { label: '基础', pattern: 'simple' },
    { label: '木地板', pattern: 'wood' },
    { label: '瓷砖', pattern: 'tile' },
    { label: '地砖', pattern: 'pave_fancy' },
    { label: '商场', pattern: 'mall' },
    { label: '网格', pattern: 'grid' },
];

const EditorPanel: React.FC<EditorPanelProps> = ({ onClose }) => {
    const [mode, setMode] = useState<'plot' | 'furniture' | 'floor'>('plot');
    const [category, setCategory] = useState('skills');
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [selectedFurniture, setSelectedFurniture] = useState<Furniture | null>(null);
    const [activeTool, setActiveTool] = useState<'camera' | 'select'>('select');

    // 拖拽相关逻辑可移除，因为现在是底部通栏布局
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        GameStore.enterEditorMode();
        // @ts-ignore
        GameStore.editor.setTool('select');
        
        const updateState = () => {
            setCanUndo(GameStore.history.length > 0);
            setCanRedo(GameStore.redoStack.length > 0);
            // @ts-ignore
            if (GameStore.editor.activeTool) setActiveTool(GameStore.editor.activeTool);
            if (GameStore.editor.selectedFurnitureId) {
                const f = GameStore.furniture.find(i => i.id === GameStore.editor.selectedFurnitureId);
                setSelectedFurniture(f || null);
            } else {
                setSelectedFurniture(null);
            }
        };
        const unsub = GameStore.subscribe(updateState);
        updateState();
        return unsub;
    }, []);

    const handleToolChange = (tool: 'camera' | 'select') => {
        GameStore.editor.setTool(tool);
        setActiveTool(tool);
    };

    const handleSetMode = (m: 'plot' | 'furniture' | 'floor') => {
        setMode(m);
        GameStore.editor.mode = m;
        GameStore.resetEditorState();
        GameStore.editor.mode = m;
        GameStore.notify();
    };

    const handleStartPlacingPlot = (templateId: string) => GameStore.startPlacingPlot(templateId);
    const handleStartDrawingPlot = () => GameStore.startDrawingPlot('default_empty');
    const handleStartDrawingRoom = () => GameStore.startDrawingFloor('simple', '#ffffff', '房间', true);
    
    const handleStartPlacingFurniture = (tpl: Partial<Furniture>) => {
        const initialColor = selectedColor || tpl.color || '#ffffff';
        GameStore.startPlacingFurniture({ ...tpl, id: '', x: 0, y: 0, color: initialColor });
    };

    const handleStartDrawingFloor = (type: any) => {
        GameStore.startDrawingFloor(type.pattern, selectedColor || type.color, type.label, false);
    };

    const handleDelete = () => {
        if (GameStore.editor.selectedPlotId) GameStore.removePlot(GameStore.editor.selectedPlotId);
        else if (GameStore.editor.selectedFurnitureId) GameStore.removeFurniture(GameStore.editor.selectedFurnitureId);
        else if (GameStore.editor.selectedRoomId) GameStore.removeRoom(GameStore.editor.selectedRoomId);
    };

    const handleRotate = () => {
        GameStore.editor.rotateSelection();
    };

    const handleColorChange = (color: string) => {
        setSelectedColor(color);
        if (GameStore.editor.placingFurniture) {
            GameStore.editor.placingFurniture.color = color;
            GameStore.notify();
        } else if (GameStore.editor.selectedFurnitureId) {
            const f = GameStore.furniture.find(i => i.id === GameStore.editor.selectedFurnitureId);
            if (f) { f.color = color; GameStore.notify(); }
        } else if (GameStore.editor.selectedRoomId) {
            const r = GameStore.rooms.find(rm => rm.id === GameStore.editor.selectedRoomId);
            if (r) { r.color = color; GameStore.notify(); }
        }
    };

    const handlePatternChange = (pattern: string) => {
        if (GameStore.editor.selectedRoomId) {
            const r = GameStore.rooms.find(rm => rm.id === GameStore.editor.selectedRoomId);
            if (r) { r.pixelPattern = pattern; GameStore.notify(); }
        }
    };

    const handleSave = () => { GameStore.confirmEditorChanges(); onClose(); };
    const handleCancel = () => { GameStore.cancelEditorChanges(); onClose(); };
    const handleImportClick = () => fileInputRef.current?.click();
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                GameStore.importMapData(JSON.parse(event.target?.result as string));
            } catch (err) { alert("❌ 文件无效"); }
        };
        reader.readAsText(file);
        e.target.value = '';
    };
    const handleExport = () => {
        const blob = new Blob([JSON.stringify(GameStore.getMapData(), null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `simgod_map_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Components ---

    const renderTools = () => (
        <div className="flex flex-col gap-2 p-2 border-r border-white/10 bg-[#1e222e]">
            {/* 压缩工具栏按钮尺寸 w-8 h-8 (32px) */}
            <button onClick={() => handleToolChange('select')} className={`w-8 h-8 rounded flex items-center justify-center text-sm ${activeTool === 'select' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`} title="选择 (V)">👆</button>
            <div className="h-px bg-white/10 my-0.5"></div>
            <button onClick={handleRotate} className="w-8 h-8 rounded flex items-center justify-center text-sm bg-white/5 text-gray-400 hover:text-warning hover:bg-white/10" title="旋转 (R)">🔄</button>
            <button onClick={handleDelete} className="w-8 h-8 rounded flex items-center justify-center text-sm bg-white/5 text-gray-400 hover:text-danger hover:bg-white/10" title="删除 (Del)">🗑️</button>
            <div className="h-px bg-white/10 my-0.5"></div>
            <button onClick={() => GameStore.undo()} disabled={!canUndo} className={`w-8 h-8 rounded flex items-center justify-center text-sm ${canUndo ? 'bg-white/5 text-gray-200 hover:bg-white/10' : 'bg-transparent text-gray-700'}`} title="撤销 (Ctrl+Z)">↩</button>
            <button onClick={() => GameStore.redo()} disabled={!canRedo} className={`w-8 h-8 rounded flex items-center justify-center text-sm ${canRedo ? 'bg-white/5 text-gray-200 hover:bg-white/10' : 'bg-transparent text-gray-700'}`} title="重做 (Ctrl+Y)">↪</button>
        </div>
    );

    const renderCategoryTabs = () => (
        <div className="flex flex-col gap-1 w-20 bg-[#1e222e] border-r border-white/10 p-1">
            {[
                { id: 'plot', icon: '🗺️', label: '地皮' },
                { id: 'floor', icon: '🏗️', label: '建筑' },
                { id: 'furniture', icon: '🪑', label: '家具' }
            ].map(m => (
                <button 
                    key={m.id}
                    onClick={() => handleSetMode(m.id as any)}
                    className={`
                        flex flex-col items-center justify-center py-2 rounded transition-all
                        ${mode === m.id ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}
                    `}
                >
                    <span className="text-lg mb-0.5">{m.icon}</span>
                    <span className="text-[10px] font-bold">{m.label}</span>
                </button>
            ))}
        </div>
    );

    const renderContent = () => (
        <div className="flex-1 bg-[#2d3436] p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
            {/* Header: Sub-Categories or Controls */}
            {mode === 'furniture' && (
                <div className="flex gap-2 pb-2 border-b border-white/10 overflow-x-auto no-scrollbar shrink-0">
                    {Object.keys(FURNITURE_CATALOG).map(k => (
                        <button 
                            key={k} 
                            onClick={() => setCategory(k)} 
                            className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors ${category === k ? 'bg-accent text-black' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                        >
                            {FURNITURE_CATALOG[k].label}
                        </button>
                    ))}
                </div>
            )}

            {/* Grid Area */}
            <div className="flex-1 overflow-y-auto">
                {/* --- PLOT MODE --- */}
                {mode === 'plot' && (
                    <div className="space-y-3">
                        <div>
                            <div className="text-[10px] text-gray-400 font-bold mb-1">基础工具</div>
                            <div className="grid grid-cols-8 gap-2">
                                <button onClick={handleStartDrawingPlot} className="aspect-square bg-white/5 hover:bg-white/10 rounded flex flex-col items-center justify-center gap-1 border border-white/10 transition-colors">
                                    <span className="text-xl">⬜</span>
                                    <span className="text-[9px] scale-90">自定义</span>
                                </button>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-400 font-bold mb-1">地形笔刷</div>
                            <div className="grid grid-cols-8 gap-2">
                                {SURFACE_TYPES.map(t => (
                                    <button key={t.pattern} onClick={() => handleStartDrawingFloor(t)} className="aspect-square bg-white/5 hover:bg-white/10 rounded flex flex-col items-center justify-center gap-1 border border-white/10 transition-colors group">
                                        <div className="w-5 h-5 rounded" style={{background: t.color}}></div>
                                        <span className="text-[9px] text-gray-400 group-hover:text-white scale-90">{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-400 font-bold mb-1">预设蓝图</div>
                            <div className="grid grid-cols-4 gap-2">
                                {Object.keys(PLOTS).filter(k => !k.startsWith('road') && k!=='default_empty').map(key => (
                                    <button key={key} onClick={() => handleStartPlacingPlot(key)} className="bg-white/5 hover:bg-white/10 p-1.5 rounded flex items-center gap-2 border border-white/10 transition-colors text-left overflow-hidden">
                                        <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center text-blue-300 font-bold text-[9px] shrink-0">{PLOTS[key].width/100}x</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-bold text-gray-200 truncate">{PLOT_NAMES[key] || key}</div>
                                            <div className="text-[8px] text-gray-500">{PLOTS[key].width}x{PLOTS[key].height}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- FLOOR MODE --- */}
                {mode === 'floor' && (
                    <div className="space-y-3">
                        <button onClick={handleStartDrawingRoom} className="w-full bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded p-2 flex items-center justify-center gap-2 group transition-all">
                            <span className="text-xl group-hover:scale-110 transition-transform">🏗️</span>
                            <span className="font-bold text-blue-100 text-xs">新建房间 (拖拽框选)</span>
                        </button>
                        
                        <div>
                            <div className="text-[10px] text-gray-400 font-bold mb-1">地板材质</div>
                            <div className="grid grid-cols-8 gap-2">
                                {FLOOR_PATTERNS.map(fp => (
                                    <button key={fp.pattern} onClick={() => handlePatternChange(fp.pattern)} className="aspect-square bg-white/5 hover:bg-white/10 rounded flex flex-col items-center justify-center gap-1 border border-white/10 transition-colors">
                                        <div className={`w-5 h-5 border border-white/20 bg-gray-600`}></div>
                                        <span className="text-[8px] text-gray-400 scale-90">{fp.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- FURNITURE MODE (高密度布局 12列) --- */}
                {mode === 'furniture' && (
                    <div className="grid grid-cols-12 gap-1.5">
                        {FURNITURE_CATALOG[category].items.map((item, idx) => (
                            <button 
                                key={idx} 
                                onClick={() => handleStartPlacingFurniture(item)} 
                                className="bg-white/5 hover:bg-white/10 rounded flex flex-col items-center justify-center p-1 border border-white/10 transition-all hover:scale-110 hover:border-white/30 group relative overflow-hidden h-12"
                                title={`${item.label} (${item.w}x${item.h})`}
                            >
                                <div className="w-5 h-5 rounded mb-0.5 shadow-sm" style={{background: item.color}}></div>
                                <span className="text-[8px] text-gray-400 group-hover:text-white text-center leading-none truncate w-full">{item.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Colors Palette (Bottom) */}
            {(mode === 'furniture' || mode === 'floor') && (
                <div className="pt-2 border-t border-white/10 shrink-0">
                    <div className="flex flex-wrap gap-1 justify-center">
                        {COLORS.map(c => (
                            <button 
                                key={c} 
                                onClick={() => handleColorChange(c)} 
                                className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 ${selectedColor === c ? 'border-white scale-110 shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'border-white/10'}`} 
                                style={{background: c}} 
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderStatusBar = () => (
        <div className="w-[180px] bg-[#1e222e] border-l border-white/10 p-2 flex flex-col gap-2">
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
            
            <div className="flex-1 bg-black/20 rounded p-2 text-[10px] text-gray-400 font-mono overflow-hidden">
                {GameStore.editor.selectedPlotId ? (
                    <div>SEL: PLOT<br/>{GameStore.editor.selectedPlotId}</div>
                ) : GameStore.editor.selectedFurnitureId ? (
                    <div>SEL: OBJ<br/>{selectedFurniture?.label || 'Unknown'}</div>
                ) : (
                    <div>READY</div>
                )}
                {/* 状态指示 */}
                <div className="mt-1 text-warning truncate">
                    {GameStore.editor.interactionState === 'carrying' ? '>> PLACING' : ''}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
                <button onClick={handleSave} className="bg-success hover:bg-green-400 text-black py-1.5 rounded text-[10px] font-bold transition-colors shadow-lg shadow-green-900/20">✔ 应用</button>
                <button onClick={handleCancel} className="bg-white/10 hover:bg-white/20 text-white py-1.5 rounded text-[10px] font-bold transition-colors">✕ 取消</button>
                <button onClick={handleImportClick} className="bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 py-1 rounded text-[9px]">导入</button>
                <button onClick={handleExport} className="bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 py-1 rounded text-[9px]">导出</button>
            </div>
            
            <button onClick={() => GameStore.clearMap()} className="w-full mt-1 border border-danger/20 text-danger hover:bg-danger/10 py-1 rounded text-[9px]">⚠️ 清空地图</button>
        </div>
    );

    return (
        <div 
            onMouseDown={(e) => e.stopPropagation()}
            className="fixed bottom-0 left-0 right-0 h-[220px] bg-[#121212] border-t border-white/20 shadow-[0_-5px_30px_rgba(0,0,0,0.5)] z-50 flex animate-[slideUp_0.3s_ease-out] pointer-events-auto"
        >
            {/* 1. Tools Strip */}
            {renderTools()}

            {/* 2. Category Tabs */}
            {renderCategoryTabs()}

            {/* 3. Main Content (Catalog/Grid) */}
            {renderContent()}

            {/* 4. Right Status & Actions */}
            {renderStatusBar()}
        </div>
    );
};

export default EditorPanel;