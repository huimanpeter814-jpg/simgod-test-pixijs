import React, { useRef, useEffect, useState } from 'react';
import { GameStore, Sim } from '../../../utils/simulation';
import { ORIENTATIONS, AGE_CONFIG } from '../../../constants';
import { AgeStage } from '../../../types';

import { InspectorFace } from './InspectorFace';
import { StatusTab } from './tabs/StatusTab';
import { FamilyTab } from './tabs/FamilyTab';
import { AttrTab } from './tabs/AttrTab';
import { CareerTab } from './tabs/CareerTab';

interface InspectorProps {
    selectedId: string | null;
    sims: Sim[];
}

const Inspector: React.FC<InspectorProps> = ({ selectedId, sims }) => {
    const [tab, setTab] = useState<'status' | 'attr' | 'memories' | 'family' | 'career'>('status');
    // 拖拽相关状态
    const panelRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: window.innerWidth - 360, y: 80 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const sim = sims.find(s => s.id === selectedId);
    
    useEffect(() => { 
        setTab('status'); 
    }, [selectedId]);

    // 全局拖拽事件监听
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y
                });
            }
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    // 开始拖拽处理
    const startDrag = (e: React.MouseEvent) => {
        if (panelRef.current) {
            setIsDragging(true);
            const rect = panelRef.current.getBoundingClientRect();
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
        }
    };

    if (!sim) return null;

    let moodColor = sim.mood > 80 ? '#00b894' : (sim.mood < 40 ? '#ff7675' : '#b2bec3');
    const genderIcon = sim.gender === 'M' ? '♂' : '♀';
    const genderColor = sim.gender === 'M' ? 'text-blue-400' : 'text-pink-400';
    const ageInfo = AGE_CONFIG[sim.ageStage];
    let relStatus = '单身', relStatusClass = 'bg-white/5 border-white/10 text-gray-400';
    if (sim.partnerId) {
        const rel = sim.relationships[sim.partnerId];
        if (rel && rel.isSpouse) { relStatus = '已婚'; relStatusClass = 'bg-love/10 border-love/30 text-love font-bold'; }
        else { relStatus = '恋爱中'; relStatusClass = 'bg-pink-500/10 border-pink-500/30 text-pink-300'; }
    }
    const jobTitle = sim.ageStage === AgeStage.Infant ? '吃奶' : (sim.ageStage === AgeStage.Toddler ? '幼儿园' : (sim.ageStage === AgeStage.Child ? '小学生' : (sim.ageStage === AgeStage.Teen ? '中学生' : sim.job.title)));

    return (
        <div 
            ref={panelRef}
            style={{ left: position.x, top: position.y }}
            className="fixed w-[340px] max-h-[calc(100vh-160px)] flex flex-col bg-[#121212]/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl pointer-events-auto animate-[fadeIn_0.2s_ease-out] text-[#e0e0e0] z-40"
        >
            {/* Header */}
            <div 
                onMouseDown={startDrag}
                className="flex gap-4 p-4 border-b border-white/10 shrink-0 bg-white/5 cursor-move select-none rounded-t-xl"
            >
                <div className="w-16 h-16 bg-black/40 rounded-lg border border-white/10 flex items-center justify-center overflow-hidden shrink-0 relative pointer-events-none">
                    <InspectorFace sim={sim} />
                    <div className="absolute bottom-1 right-1 w-3 h-3 rounded-full border-2 border-[#121212]" style={{ background: moodColor }}></div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex justify-between items-start">
                        <h2 className="text-xl font-bold truncate tracking-tight flex items-center gap-2">{sim.name}<span className={`text-sm font-bold ${genderColor}`}>{genderIcon}</span></h2>
                        <button 
                            onMouseDown={(e) => e.stopPropagation()} 
                            onClick={() => { GameStore.selectSim(null); }}
                            className="text-white/30 hover:text-white transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2 pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
                        <span className="text-[10px] px-2 py-0.5 rounded border" style={{ color: ageInfo.color, borderColor: ageInfo.color + '40', background: ageInfo.color + '20' }}>{ageInfo.label} ({Math.floor(sim.age)}岁)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30" title="星座">{sim.zodiac.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-pink-500/20 text-pink-200 border border-pink-500/30" title="性取向">{ORIENTATIONS.find(o => o.type === sim.orientation)?.label}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${relStatusClass}`} title="情感状态">{relStatus}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-accent/20 text-accent font-bold border border-accent/20" title="MBTI">{sim.mbti}</span>
                        {sim.isPregnant && <span className="text-[10px] px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 animate-pulse">🤰 孕期</span>}
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${sim.health > 80 ? 'border-green-500/30 text-green-300' : (sim.health < 30 ? 'border-red-500/30 text-red-300' : 'border-white/10 text-gray-300')}`}>HP: {Math.floor(sim.health)}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-500/30" title="职业">{jobTitle}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-warning/10 text-warning border border-warning/20" title="人生目标">🎯 {sim.lifeGoal}</span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
                {[
                    { id: 'status', label: '状态' }, 
                    { id: 'attr', label: '档案' }, // 改个名字更好听
                    { id: 'career', label: '生涯' }, // 新增 Tab
                    { id: 'family', label: '族谱' }, 
                    { id: 'memories', label: `记忆 (${sim.memories.length})` }
                ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id as any)} className={`flex-1 py-2 text-[10px] font-bold transition-colors uppercase ${tab === t.id ? 'bg-white/10 text-white border-b-2 border-accent' : 'text-gray-500 hover:text-gray-300'}`}>{t.label}</button>
                ))}
            </div>

            {/* Content */}
            <div 
                className="overflow-y-auto p-4 custom-scrollbar flex flex-col gap-6"
                onMouseDown={(e) => e.stopPropagation()} 
            >
                {tab === 'status' && <StatusTab sim={sim} />}
                {tab === 'family' && <FamilyTab sim={sim} sims={sims} />}
                {tab === 'attr' && <AttrTab sim={sim} />}
                {tab === 'career' && <CareerTab sim={sim} />}
                {tab === 'memories' && (
                    <div className="flex flex-col gap-2">
                        {sim.memories.length > 0 ? sim.memories.map(mem => (
                            <div key={mem.id} className={`p-2 rounded bg-white/5 border text-[11px] flex flex-col gap-1 ${mem.type === 'job' ? 'border-blue-500/30' : (mem.type === 'social' ? 'border-green-500/30' : (mem.type === 'life' ? 'border-pink-500/30 text-pink-100' : (mem.type === 'bad' ? 'border-red-500/30 text-red-200' : (mem.type === 'family' ? 'border-yellow-500/30 text-yellow-100' : 'border-white/10 text-gray-300'))))}`}>
                                <div className="flex justify-between items-center opacity-50 text-[9px]"><span className="font-mono">{mem.time}</span><span>{mem.type === 'job' ? '💼' : (mem.type === 'social' ? '💬' : (mem.type === 'life' ? '❤️' : (mem.type === 'bad' ? '💔' : (mem.type === 'family' ? '👨‍👩‍👧' : '📝'))))}</span></div>
                                <div className="leading-snug">{mem.text}</div>
                            </div>
                        )) : <div className="text-center py-10 opacity-30 flex flex-col items-center gap-2"><span className="text-2xl">🍃</span><span className="text-[10px]">平平淡淡才是真</span></div>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Inspector;