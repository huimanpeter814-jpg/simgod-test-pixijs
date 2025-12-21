import React, { useState, useRef, useEffect } from 'react';
import { GameStore } from '../utils/simulation';
import { SimInitConfig } from '../utils/logic/SimInitializer';
import { CONFIG, ASSET_CONFIG, MBTI_TYPES, LIFE_GOALS, AGE_CONFIG, SURNAMES, GIVEN_NAMES, TRAIT_POOL, ZODIACS, ORIENTATIONS } from '../constants';
import { AgeStage, SimAppearance } from '../types';
import { getAsset } from '../utils/assetLoader';

interface CreateSimModalProps {
    onClose: () => void;
}

interface ExtendedSimConfig extends Omit<SimInitConfig, 'appearance'> {
    appearance: SimAppearance;
    hairStyleIndex: number; 
    relationshipToHead?: 'spouse' | 'child' | 'parent' | 'sibling' | 'roommate'; 
    name: string;
}

const createEmptySimConfig = (isHead: boolean = false): ExtendedSimConfig => ({
    name: '新市民',
    gender: 'M',
    ageStage: AgeStage.Adult,
    mbti: 'ISTJ',
    lifeGoal: LIFE_GOALS[0],
    orientation: 'hetero',
    zodiac: ZODIACS[0],
    iq: 50, eq: 50, constitution: 50, appearanceScore: 50, luck: 50, morality: 50, creativity: 50,
    height: 175, weight: 65, money: 2000, hairStyleIndex: 0, traits: [],
    skinColor: CONFIG.COLORS.skin[0],
    hairColor: CONFIG.COLORS.hair[0],
    clothesColor: CONFIG.COLORS.clothes[0],
    pantsColor: CONFIG.COLORS.pants[0],
    appearance: {
        body: ASSET_CONFIG.bodies?.[0] || '',
        outfit: ASSET_CONFIG.outfits?.[0] || '',
        hair: ASSET_CONFIG.hairs?.[0] || '',
        face: '', clothes: '', pants: ''
    }
});

const CreateSimModal: React.FC<CreateSimModalProps> = ({ onClose }) => {
    const [familyMembers, setFamilyMembers] = useState<ExtendedSimConfig[]>([createEmptySimConfig(true)]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    // 强制刷新标记，确保图片加载后重绘
    const [tick, setTick] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const currentSim = familyMembers[selectedIndex];

    const updateCurrentSim = (changes: Partial<ExtendedSimConfig>) => {
        if (!currentSim) return;
        const updated = [...familyMembers];
        updated[selectedIndex] = { ...updated[selectedIndex], ...changes };
        if (changes.appearance) {
            updated[selectedIndex].appearance = { ...familyMembers[selectedIndex].appearance, ...changes.appearance };
        }
        setFamilyMembers(updated);
    };

    const toggleTrait = (trait: string) => {
        if (!currentSim) return;
        const currentTraits = currentSim.traits || [];
        if (currentTraits.includes(trait)) {
            updateCurrentSim({ traits: currentTraits.filter(t => t !== trait) });
        } else if (currentTraits.length < 3) {
            updateCurrentSim({ traits: [...currentTraits, trait] });
        }
    };

    const cycleAsset = (type: 'body' | 'outfit' | 'hair', dir: number) => {
        if (!currentSim) return;
        const configKey = type === 'body' ? 'bodies' : (type === 'outfit' ? 'outfits' : 'hairs');
        const list = ASSET_CONFIG[configKey];
        if (!list || list.length === 0) return;
        const currentVal = currentSim.appearance ? currentSim.appearance[type] : '';
        let idx = list.indexOf(currentVal || '');
        if (idx === -1) idx = 0;
        const newIdx = (idx + dir + list.length) % list.length;
        updateCurrentSim({ appearance: { ...(currentSim.appearance), [type]: list[newIdx] } });
    };

    const randomizeVisuals = () => {
        if (!currentSim) return;
        const randomAsset = (list: string[]) => list && list.length > 0 ? list[Math.floor(Math.random() * list.length)] : '';
        updateCurrentSim({
            name: SURNAMES[Math.floor(Math.random() * SURNAMES.length)] + GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)],
            gender: Math.random() > 0.5 ? 'M' : 'F' as any,
            orientation: Math.random() < 0.7 ? 'hetero' : (Math.random() < 0.85 ? 'homo' : 'bi'),
            zodiac: ZODIACS[Math.floor(Math.random() * ZODIACS.length)],
            appearance: {
                body: randomAsset(ASSET_CONFIG.bodies),
                outfit: randomAsset(ASSET_CONFIG.outfits),
                hair: randomAsset(ASSET_CONFIG.hairs),
                face: '', clothes: '', pants: ''
            },
            skinColor: CONFIG.COLORS.skin[Math.floor(Math.random() * CONFIG.COLORS.skin.length)],
            hairColor: CONFIG.COLORS.hair[Math.floor(Math.random() * CONFIG.COLORS.hair.length)],
        });
    };

    const addMember = () => {
        if (familyMembers.length >= 8) return;
        const newSim = createEmptySimConfig(false);
        newSim.name = (currentSim ? currentSim.name.substring(0, 1) : SURNAMES[0]) + GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)];
        newSim.relationshipToHead = 'roommate';
        setFamilyMembers([...familyMembers, newSim]);
        setSelectedIndex(familyMembers.length);
    };

    const removeMember = (index: number) => {
        if (familyMembers.length <= 1) return;
        setFamilyMembers(familyMembers.filter((_, i) => i !== index));
        setSelectedIndex(Math.max(0, index - 1));
    };

    const handleCreateFamily = () => {
        GameStore.spawnCustomFamily(familyMembers);
        onClose();
    };

    // === [核心修复] 预加载与重绘机制 ===
    // 替代原有的加载检查逻辑
    useEffect(() => {
        let isActive = true;
        const paths = [
            currentSim?.appearance?.body, 
            currentSim?.appearance?.outfit, 
            currentSim?.appearance?.hair
        ].filter(Boolean) as string[];

        const checkAndTrigger = () => {
            if (!isActive) return;
            // 检查是否所有图片都已加载完成
            const allLoaded = paths.every(p => {
                const img = getAsset(p);
                return img && img.complete && img.naturalWidth > 0;
            });

            if (allLoaded) {
                setTick(t => t + 1); // 触发重绘
            } else {
                // 如果没加载完，等待 100ms 再查，而不是用 requestAnimationFrame
                setTimeout(checkAndTrigger, 100); 
            }
        };

        checkAndTrigger();
        return () => { isActive = false; };
    }, [currentSim?.appearance]);

    // === [核心修复] 绘制全身 ===
// === [核心修复] 绘制全身（支持染色与正确层级） ===
useEffect(() => {
    if (!currentSim) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    // 1. 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false; 

    const scale = 6;      
    const centerX = canvas.width / 2;
    const groundY = canvas.height * 0.9; // 底部留出一点空间

    // 内部绘制函数：支持染色
    const drawLayer = (path: string, tintColor?: string) => {
        if (!path) return;
        const img = getAsset(path);
        if (!img || !img.complete || img.naturalWidth === 0) return;

        ctx.save();
        ctx.translate(centerX, groundY);
        ctx.scale(scale, scale);

        // 如果提供了颜色且不是透明，则进行“正片叠底”染色
        if (tintColor && tintColor !== 'transparent') {
            const offscreen = document.createElement('canvas');
            offscreen.width = 48;
            offscreen.height = 48;
            const oCtx = offscreen.getContext('2d');
            if (oCtx) {
                oCtx.imageSmoothingEnabled = false;
                // A. 绘制原始素材
                oCtx.drawImage(img, 0, 0, 48, 48);
                // B. 使用正片叠底模式染色
                oCtx.globalCompositeOperation = 'multiply';
                oCtx.fillStyle = tintColor;
                oCtx.fillRect(0, 0, 48, 48);
                // C. 保持原始透明度
                oCtx.globalCompositeOperation = 'destination-in';
                oCtx.drawImage(img, 0, 0, 48, 48);
                
                // 绘制染色后的结果
                ctx.drawImage(offscreen, -24, -48, 48, 48);
            }
        } else {
            // 无需染色直接绘制
            ctx.drawImage(img, 0, 0, 48, 48, -24, -48, 48, 48);
        }
        ctx.restore();
    };

    // 2. 绘制脚底阴影
    ctx.save();
    ctx.translate(centerX, groundY);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 15 * scale / 2, 4 * scale / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. 严格按层级绘制全身 (48x48)
    // 身体 (底层) -> 衣服 (中层) -> 头发 (顶层)
    drawLayer(currentSim.appearance.body, currentSim.skinColor); 
    drawLayer(currentSim.appearance.outfit, currentSim.clothesColor); // 修复点：传入衣服颜色
    drawLayer(currentSim.appearance.hair, currentSim.hairColor);     // 修复点：传入头发颜色

}, [currentSim, tick]);

    // 初始化随机
    useEffect(() => { if (!currentSim.appearance?.body) randomizeVisuals(); }, []);

    // UI 辅助函数
    const renderAssetCycler = (label: string, type: 'body' | 'outfit' | 'hair') => {
        const path = currentSim.appearance?.[type] || '';
        const fileName = path.split('/').pop() || 'None';
        return (
            <div className="bg-white/5 p-2 rounded border border-white/5 flex flex-col gap-1">
                <span className="text-[10px] text-gray-500">{label}</span>
                <div className="flex items-center justify-between gap-1">
                    <button onClick={() => cycleAsset(type, -1)} className="w-6 h-6 bg-black/20 hover:bg-white/10 rounded text-gray-300 text-xs">‹</button>
                    <span className="text-[9px] font-mono text-gray-300 truncate max-w-[80px]" title={fileName}>{fileName.length > 10 ? fileName.slice(0, 10) + '...' : fileName}</span>
                    <button onClick={() => cycleAsset(type, 1)} className="w-6 h-6 bg-black/20 hover:bg-white/10 rounded text-gray-300 text-xs">›</button>
                </div>
            </div>
        );
    };

    const renderSlider = (label: string, field: keyof ExtendedSimConfig, min=0, max=100) => (
        <div className="flex items-center gap-2 text-xs">
            <span className="w-16 text-gray-400 shrink-0">{label}</span>
            <input type="range" min={min} max={max} value={(currentSim[field] as number) || 50} onChange={(e) => updateCurrentSim({ [field]: parseInt(e.target.value) })} className="flex-1 accent-accent h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
            <span className="w-8 text-right font-mono text-gray-300">{(currentSim[field] as number)}</span>
        </div>
    );

    const renderColorPicker = (label: string, field: keyof ExtendedSimConfig, options: string[]) => (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500">{label}</span>
            <div className="flex flex-wrap gap-1">
                {options.map(c => (
                    <button key={c} onClick={() => updateCurrentSim({ [field]: c })} className={`w-4 h-4 rounded-full border ${currentSim[field] === c ? 'border-white scale-110' : 'border-white/10 hover:border-white/50'}`} style={{ background: c }} />
                ))}
            </div>
        </div>
    );

    const allTraits = [...TRAIT_POOL.social, ...TRAIT_POOL.lifestyle, ...TRAIT_POOL.mental];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="w-[95vw] max-w-[1100px] h-[90vh] max-h-[800px] bg-[#1e222e] border border-white/20 rounded-xl shadow-2xl flex overflow-hidden">
                {/* Left: List */}
                <div className="w-16 md:w-20 bg-black/30 border-r border-white/10 flex flex-col items-center py-4 gap-3 overflow-y-auto no-scrollbar shrink-0">
                    {familyMembers.map((sim, idx) => (
                        <div key={idx} className="relative group shrink-0">
                            <button onClick={() => setSelectedIndex(idx)} className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 bg-white/5 flex items-center justify-center ${selectedIndex === idx ? 'border-accent shadow-[0_0_10px_rgba(162,155,254,0.5)]' : 'border-white/10'}`}>
                                <span className="text-xs font-bold text-gray-400">{idx === 0 ? '户' : (sim.name ? sim.name.charAt(0) : '?')}</span>
                            </button>
                            {familyMembers.length > 1 && <button onClick={(e) => { e.stopPropagation(); removeMember(idx); }} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100">×</button>}
                        </div>
                    ))}
                    {familyMembers.length < 8 && <button onClick={addMember} className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-dashed border-white/20 text-white/20 hover:text-white">+</button>}
                </div>

                {/* Center: Preview */}
                <div className="w-[300px] md:w-[340px] bg-gradient-to-b from-[#2d3436] to-[#1e222e] relative flex flex-col border-r border-white/10 shrink-0">
                    <div className="p-4 z-10 bg-gradient-to-b from-black/50 to-transparent">
                        <input type="text" value={currentSim.name} onChange={(e) => updateCurrentSim({ name: e.target.value })} className="bg-transparent border-b border-white/20 text-xl font-bold text-white w-full outline-none" placeholder="输入姓名" />
                        <div className="flex gap-2 mt-2">
                            <select value={currentSim.gender} onChange={(e) => updateCurrentSim({ gender: e.target.value as any })} className="bg-black/20 text-xs text-gray-300 rounded px-1 py-0.5 border border-white/10 outline-none"><option value="M">♂ 男</option><option value="F">♀ 女</option></select>
                            <select value={currentSim.ageStage} onChange={(e) => updateCurrentSim({ ageStage: e.target.value as any })} className="bg-black/20 text-xs text-gray-300 rounded px-1 py-0.5 border border-white/10 outline-none">{Object.keys(AGE_CONFIG).map(s => <option key={s} value={s}>{AGE_CONFIG[s as AgeStage].label}</option>)}</select>
                        </div>
                        {selectedIndex > 0 && <div className="mt-2 flex items-center gap-2 bg-white/5 p-1 rounded"><span className="text-[10px] text-gray-400">关系:</span><select value={currentSim.relationshipToHead} onChange={(e) => updateCurrentSim({ relationshipToHead: e.target.value as any })} className="bg-black/20 text-xs text-accent font-bold rounded px-1 py-0.5 border border-white/10 outline-none flex-1"><option value="spouse">配偶</option><option value="child">子女</option><option value="parent">父母</option><option value="sibling">兄弟姐妹</option><option value="roommate">室友</option></select></div>}
                    </div>
                    <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.05),_transparent_70%)]"></div>
                        <canvas ref={canvasRef} width={300} height={400} className="relative z-0 object-contain max-h-full" />
                        <button onClick={randomizeVisuals} className="absolute bottom-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur border border-white/10 shadow-lg" title="随机">🎲</button>
                    </div>
                </div>

                {/* Right: Detailed */}
                <div className="flex-1 flex flex-col bg-[#121212] overflow-hidden min-w-[300px]">
                    <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center shrink-0">
                        <span className="text-sm font-bold text-gray-300 uppercase tracking-wider">详细设定</span>
                        <div className="text-xs text-gray-500">成员 {selectedIndex + 1} / {familyMembers.length}</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6 min-h-0">
                        <section className="space-y-3">
                            <h3 className="text-xs font-bold text-accent uppercase mb-2">外观素材</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {renderAssetCycler("头发 (Hair)", 'hair')}
                                {renderAssetCycler("服装 (Outfit)", 'outfit')}
                                {renderAssetCycler("身体 (Body)", 'body')}
                                <div className="flex flex-col justify-center space-y-2">{renderSlider("身高", 'height', 50, 220)}{renderSlider("体重", 'weight', 3, 150)}</div>
                            </div>
                        </section>
                        <section className="space-y-3">
                            <h3 className="text-xs font-bold text-accent uppercase mb-2">色彩偏好</h3>
                            <div className="grid grid-cols-4 gap-2">{renderColorPicker('皮肤', 'skinColor', CONFIG.COLORS.skin)}{renderColorPicker('头发', 'hairColor', CONFIG.COLORS.hair)}</div>
                        </section>
                        <section className="space-y-3">
                            <div className="flex justify-between items-center"><h3 className="text-xs font-bold text-accent uppercase">个性与资产</h3><div className="flex items-center gap-2 bg-black/20 rounded px-2 py-1 border border-white/5"><span className="text-[10px] text-gray-400">💰 初始资金</span><input type="number" value={currentSim.money} onChange={(e) => updateCurrentSim({ money: parseInt(e.target.value) })} className="w-16 bg-transparent text-right text-xs text-warning font-mono outline-none" /></div></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] text-gray-500 mb-1">MBTI</label><select value={currentSim.mbti} onChange={(e) => updateCurrentSim({ mbti: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white">{MBTI_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                <div><label className="block text-[10px] text-gray-500 mb-1">目标</label><select value={currentSim.lifeGoal} onChange={(e) => updateCurrentSim({ lifeGoal: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white">{LIFE_GOALS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                                <div><label className="block text-[10px] text-gray-500 mb-1">性取向</label><select value={currentSim.orientation} onChange={(e) => updateCurrentSim({ orientation: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white">{ORIENTATIONS.map(o => <option key={o.type} value={o.type}>{o.label}</option>)}</select></div>
                                <div><label className="block text-[10px] text-gray-500 mb-1">星座</label><select value={currentSim.zodiac?.name} onChange={(e) => updateCurrentSim({ zodiac: ZODIACS.find(i => i.name === e.target.value) })} className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white">{ZODIACS.map(z => <option key={z.name} value={z.name}>{z.icon} {z.name}</option>)}</select></div>
                            </div>
                            <div className="bg-white/5 p-2 rounded border border-white/5"><label className="block text-[10px] text-gray-500 mb-2">特质</label><div className="flex flex-wrap gap-1.5">{allTraits.map(trait => <button key={trait} onClick={() => toggleTrait(trait)} className={`text-[10px] px-2 py-1 rounded border ${currentSim.traits?.includes(trait) ? 'bg-accent text-black border-accent' : 'bg-black/20 text-gray-400 border-white/10'}`}>{trait}</button>)}</div></div>
                        </section>
                        <section className="space-y-2 pb-4">
                            <h3 className="text-xs font-bold text-accent uppercase mb-2">属性</h3>
                            <div className="space-y-2 bg-black/20 p-3 rounded border border-white/5">{renderSlider("智商", 'iq')}{renderSlider("情商", 'eq')}{renderSlider("体质", 'constitution')}{renderSlider("魅力", 'appearanceScore')}{renderSlider("幸运", 'luck')}</div>
                        </section>
                    </div>
                    <div className="p-4 border-t border-white/10 bg-black/20 flex justify-between items-center shrink-0">
                        <span className="text-[10px] text-gray-500 hidden md:inline">Total: {familyMembers.length} | ${familyMembers.reduce((a, b) => a + (b.money||0), 0)}</span>
                        <div className="flex gap-3 w-full md:w-auto justify-end"><button onClick={onClose} className="px-4 py-2 rounded text-xs font-bold text-gray-400 hover:text-white">取消</button><button onClick={handleCreateFamily} className="px-6 py-2 rounded bg-success text-black text-xs font-bold">✓ 创建</button></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateSimModal;