import React, { useState, useRef, useEffect } from 'react';
import { GameStore } from '../utils/simulation';
import { SimInitConfig } from '../utils/logic/SimInitializer';
import { CONFIG, ASSET_CONFIG, MBTI_TYPES, LIFE_GOALS, AGE_CONFIG, SURNAMES, GIVEN_NAMES, ZODIACS, ORIENTATIONS } from '../constants';
import { AgeStage, SimAppearance } from '../types';
import { drawAvatarHead } from '../utils/render/pixelArt';

interface CreateSimModalProps {
    onClose: () => void;
}

// 扩展配置接口以支持 UI 状态
// [修复] 强制 appearance 为必选，避免 UI 中频繁的可选检查报错
interface ExtendedSimConfig extends Omit<SimInitConfig, 'appearance'> {
    appearance: SimAppearance;
    hairStyleIndex: number; 
    relationshipToHead?: 'spouse' | 'child' | 'parent' | 'sibling' | 'roommate'; 
    name: string;
}

// 默认空配置工厂
const createEmptySimConfig = (isHead: boolean = false): ExtendedSimConfig => ({
    name: '新市民',
    gender: 'M',
    ageStage: AgeStage.Adult,
    mbti: 'ISTJ',
    lifeGoal: LIFE_GOALS[0],
    orientation: 'hetero',
    zodiac: ZODIACS[0],
    
    iq: 50,
    eq: 50,
    constitution: 50,
    appearanceScore: 50,
    luck: 50,
    morality: 50,
    creativity: 50,
    
    height: 175,
    weight: 65,
    money: 2000,
    hairStyleIndex: 0,
    traits: [],

    skinColor: CONFIG.COLORS.skin[0],
    hairColor: CONFIG.COLORS.hair[0],
    clothesColor: CONFIG.COLORS.clothes[0],
    pantsColor: CONFIG.COLORS.pants[0],
    
    // 🆕 初始化外观，防止 undefined
    appearance: {
        body: ASSET_CONFIG.bodies[0] || '',
        outfit: ASSET_CONFIG.outfits[0] || '',
        hair: ASSET_CONFIG.hairs[0] || '',
        face: '',
        clothes: '',
        pants: ''
    }
});

const CreateSimModal: React.FC<CreateSimModalProps> = ({ onClose }) => {
    const [familyMembers, setFamilyMembers] = useState<ExtendedSimConfig[]>([createEmptySimConfig(true)]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const currentSim = familyMembers[selectedIndex];

    const updateCurrentSim = (changes: Partial<ExtendedSimConfig>) => {
        if (!currentSim) return;
        const updated = [...familyMembers];
        updated[selectedIndex] = { ...updated[selectedIndex], ...changes };
        
        // 深度合并 appearance
        if (changes.appearance) {
            updated[selectedIndex].appearance = {
                ...familyMembers[selectedIndex].appearance,
                ...changes.appearance
            };
        }
        setFamilyMembers(updated);
    };

    const toggleTrait = (trait: string) => {
        if (!currentSim) return;
        const currentTraits = currentSim.traits || [];
        if (currentTraits.includes(trait)) {
            updateCurrentSim({ traits: currentTraits.filter(t => t !== trait) });
        } else {
            if (currentTraits.length < 3) {
                updateCurrentSim({ traits: [...currentTraits, trait] });
            }
        }
    };

    // 随机化
    const randomizeVisuals = () => {
        if (!currentSim) return;
        const gender = Math.random() > 0.5 ? 'M' : 'F';
        const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
        const name = surname + GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)];
        
        const randomAsset = (list: string[]) => list && list.length > 0 ? list[Math.floor(Math.random() * list.length)] : '';

        updateCurrentSim({
            name,
            gender: gender as any,
            appearance: {
                body: randomAsset(ASSET_CONFIG.bodies),
                outfit: randomAsset(ASSET_CONFIG.outfits),
                hair: randomAsset(ASSET_CONFIG.hairs),
                face: '', clothes: '', pants: ''
            }
        });
    };

    const addMember = () => {
        if (familyMembers.length >= 8) return;
        const newSim = createEmptySimConfig(false);
        const currentSurname = currentSim ? currentSim.name.substring(0, 1) : SURNAMES[0];
        newSim.name = currentSurname + GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)];
        newSim.relationshipToHead = 'roommate';
        setFamilyMembers([...familyMembers, newSim]);
        setSelectedIndex(familyMembers.length);
    };

    const removeMember = (index: number) => {
        if (familyMembers.length <= 1) return;
        const updated = familyMembers.filter((_, i) => i !== index);
        setFamilyMembers(updated);
        setSelectedIndex(Math.max(0, index - 1));
    };

    const handleCreateFamily = () => {
        GameStore.spawnCustomFamily(familyMembers);
        onClose();
    };

    // [修复] 资源循环辅助函数
    const cycleAsset = (type: 'body' | 'outfit' | 'hair', dir: number) => {
        if (!currentSim) return;
        
        // 映射 type 到 ASSET_CONFIG 的复数 key
        const configKey = type === 'body' ? 'bodies' : (type === 'outfit' ? 'outfits' : 'hairs');
        const list = ASSET_CONFIG[configKey];
        
        if (!list || list.length === 0) return;
        
        // 安全访问 appearance
        const currentVal = currentSim.appearance ? currentSim.appearance[type] : '';
        let idx = list.indexOf(currentVal || '');
        if (idx === -1) idx = 0;
        
        const newIdx = (idx + dir + list.length) % list.length;
        
        updateCurrentSim({
            appearance: {
                ...(currentSim.appearance || { body: '', outfit: '', hair: '', face: '', clothes: '', pants: '' }),
                [type]: list[newIdx]
            }
        });
    };

    // === 绘制预览 ===
    useEffect(() => {
        if (!currentSim) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, 300, 400);
        ctx.imageSmoothingEnabled = false;

        const centerX = 150;
        const centerY = 200; 
        const scale = 4; // 放大预览

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);

        // 使用更新后的 drawAvatarHead 绘制
        drawAvatarHead(ctx, 0, 0, 24, currentSim as any); 

        ctx.restore();

    }, [currentSim]);

    // 初始化随机一次
    useEffect(() => {
        // 如果初始没有资源，尝试随机化一下确保有图
        if (!currentSim.appearance?.body) {
            randomizeVisuals();
        }
    }, []);

    if (!currentSim) return null;

    // [修复] 渲染资源切换器，使用可选链
    const renderAssetCycler = (label: string, type: 'body' | 'outfit' | 'hair') => (
        <div className="bg-white/5 p-2 rounded border border-white/5">
            <span className="text-[10px] text-gray-500 block mb-1">{label}</span>
            <div className="flex items-center justify-between gap-1">
                <button onClick={() => cycleAsset(type, -1)} className="w-6 h-6 bg-black/20 hover:bg-white/10 rounded text-gray-300 text-xs">‹</button>
                <span className="text-[9px] font-mono text-gray-400 truncate max-w-[80px]">
                    {currentSim.appearance?.[type]?.split('/').pop() || 'None'}
                </span>
                <button onClick={() => cycleAsset(type, 1)} className="w-6 h-6 bg-black/20 hover:bg-white/10 rounded text-gray-300 text-xs">›</button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="w-[1000px] h-[750px] bg-[#1e222e] border border-white/20 rounded-xl shadow-2xl flex overflow-hidden">
                
                {/* 1. Left: List */}
                <div className="w-20 bg-black/30 border-r border-white/10 flex flex-col items-center py-4 gap-3 overflow-y-auto no-scrollbar">
                    {familyMembers.map((sim, idx) => (
                        <button 
                            key={idx}
                            onClick={() => setSelectedIndex(idx)}
                            className={`w-12 h-12 rounded-full border-2 bg-white/5 text-xs font-bold text-gray-400 flex items-center justify-center ${selectedIndex === idx ? 'border-accent shadow-lg' : 'border-white/10'}`}
                        >
                            {idx === 0 ? '户' : (sim.name ? sim.name.charAt(0) : '?')}
                        </button>
                    ))}
                    {familyMembers.length < 8 && <button onClick={addMember} className="w-10 h-10 rounded-full border border-dashed border-white/20 text-white/20 hover:text-white">+</button>}
                </div>

                {/* 2. Center: Preview */}
                <div className="w-[340px] bg-gradient-to-b from-[#2d3436] to-[#1e222e] relative flex flex-col border-r border-white/10">
                    <div className="p-4 z-10">
                        <input 
                            type="text" 
                            value={currentSim.name}
                            onChange={(e) => updateCurrentSim({ name: e.target.value })}
                            className="bg-transparent border-b border-white/20 text-xl font-bold text-white w-full outline-none"
                            placeholder="姓名"
                        />
                        <div className="flex gap-2 mt-2">
                            <button onClick={randomizeVisuals} className="text-xs bg-white/10 px-2 py-1 rounded text-white">🎲 随机外观</button>
                        </div>
                    </div>
                    <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.05),_transparent_70%)]"></div>
                        <canvas ref={canvasRef} width={300} height={400} className="relative z-0" />
                    </div>
                </div>

                {/* 3. Right: Controls */}
                <div className="flex-1 flex flex-col bg-[#121212] overflow-hidden">
                    <div className="p-4 border-b border-white/10 bg-white/5">
                        <span className="text-sm font-bold text-gray-300 uppercase">外观设定</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                        <section className="space-y-3">
                            <h3 className="text-xs font-bold text-accent uppercase mb-2">部件选择</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {renderAssetCycler("头发 (Hair)", 'hair')}
                                {renderAssetCycler("服装 (Outfit)", 'outfit')}
                                {renderAssetCycler("身体 (Body)", 'body')}
                            </div>
                        </section>

                         <section className="space-y-3">
                            <h3 className="text-xs font-bold text-accent uppercase mb-2">属性</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>性别</span>
                                    <select value={currentSim.gender} onChange={e => updateCurrentSim({gender: e.target.value as any})} className="bg-black border border-white/20 rounded">
                                        <option value="M">男</option>
                                        <option value="F">女</option>
                                    </select>
                                </div>
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>年龄段</span>
                                    <select value={currentSim.ageStage} onChange={e => updateCurrentSim({ageStage: e.target.value as any})} className="bg-black border border-white/20 rounded">
                                        {Object.keys(AGE_CONFIG).map(k => <option key={k} value={k}>{AGE_CONFIG[k as AgeStage].label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </section>
                    </div>
                    <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white">取消</button>
                        <button onClick={handleCreateFamily} className="px-6 py-2 rounded bg-success text-black text-xs font-bold">创建家庭</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateSimModal;