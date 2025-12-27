import React, { useState, useEffect } from 'react';
import Roster from './Roster';
import LogPanel from './LogPanel';
import Inspector from './Inspector';
import StatisticsPanel from './StatisticsPanel';
import EditorPanel from './EditorPanel'; 
import CreateSimModal from '../CreateSimModal'; // 🆕 引入捏人模态框
import { Sim } from '../../utils/simulation';
import { GameStore } from '../../utils/GameStore';

// Full Screen Overlay managing HUD elements
const GameOverlay: React.FC = () => {
    const [sims, setSims] = useState<Sim[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showStats, setShowStats] = useState(false);
    const [showEditor, setShowEditor] = useState(false); 
    const [showCreateSim, setShowCreateSim] = useState(false); // 🆕 捏人界面状态
    
    useEffect(() => {
        // Initial fetch
        setSims([...GameStore.sims]);
        setSelectedId(GameStore.selectedSimId);

        const unsub = GameStore.subscribe(() => {
            setSims([...GameStore.sims]);
            setSelectedId(GameStore.selectedSimId);
        });

        return () => {
            unsub();
        };
    }, []);

    const handleSpawnFamily = () => {
        GameStore.sendSpawnFamily();// Random family (2+)
    };

    const handleSpawnSingle = () => {
        GameStore.sendSpawnSingle(); // Solo Sim
    };

    // Toggle Editor Logic
    const toggleEditor = () => {
        const newState = !showEditor;
        setShowEditor(newState);
        
        if (newState) {
            // 🟢 [修复] 必须调用 enterEditorMode()！
            // 这样才能触发：暂停游戏、创建快照、重置状态
            GameStore.enterEditorMode();
        } else {
            // 🟢 [修复] 退出时调用 cancel 或 confirm
            // 如果用户直接点击该按钮关闭（而不是通过面板内的保存/取消），
            // 我们默认视为“取消”或者只关闭 UI（视你的需求而定）。
            // 这里建议调用 cancel 以确保清理干净
            GameStore.cancelEditorChanges();
        }
        // GameStore.notify(); // enterEditorMode 内部已经 notify 了，这里可以省去
    };

    return (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">

            {/* Left Strip: Roster */}
            {!showEditor && (
                <div className="absolute left-4 top-20 bottom-24 w-[80px] pointer-events-auto flex flex-col gap-2 animate-[fadeIn_0.3s_ease-out]">
                    <Roster sims={sims} selectedId={selectedId} />
                </div>
            )}

            {/* Right Panel: Inspector */}
            {selectedId && !showEditor && (
                <Inspector selectedId={selectedId} sims={sims} />
            )}

            {/* Editor Panel */}
            {showEditor && (
                <EditorPanel onClose={toggleEditor} />
            )}

            {/* Create Sim Modal (CAS) */}
            {showCreateSim && (
                <div className="pointer-events-auto">
                    <CreateSimModal onClose={() => setShowCreateSim(false)} />
                </div>
            )}

            {/* Floating Log Panel */}
            {!showEditor && <LogPanel />}

            {/* Statistics Modal */}
            {showStats && <StatisticsPanel onClose={() => setShowStats(false)} />}

            {/* Bottom Right: Unified Controls Bar */}
            <div className="absolute right-8 bottom-8 pointer-events-auto flex items-center gap-6">
                
                {/* Tools Group (Editor & Stats) */}
                <div className="flex gap-3">
                     {/* Editor Button */}
                    <button
                        onClick={toggleEditor}
                        className={`
                            group flex items-center justify-center
                            w-12 h-12 rounded-full
                            shadow-lg border-2 
                            transition-all duration-300 transform hover:scale-110 active:scale-95
                            ${showEditor 
                                ? 'bg-warning text-black border-white shadow-[0_0_20px_rgba(253,203,110,0.6)]' 
                                : 'bg-purple-600 hover:bg-purple-500 text-white border-white/20 hover:border-white'
                            }
                        `}
                        title="建筑模式"
                    >
                        <span className="text-xl">🛠️</span>
                    </button>

                    {/* Statistics Button */}
                    <button
                        onClick={() => setShowStats(true)}
                        className="
                            group flex items-center justify-center
                            bg-[#0984e3] hover:bg-[#74b9ff] text-white
                            w-12 h-12 rounded-full
                            shadow-[0_0_20px_rgba(9,132,227,0.6)] hover:shadow-[0_0_30px_rgba(116,185,255,0.8)]
                            border-2 border-white/20 hover:border-white
                            transition-all duration-300 transform hover:scale-110 active:scale-95
                        "
                        title="查看统计"
                    >
                        <span className="text-xl">📊</span>
                    </button>
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-white/20"></div>

                {/* Spawn Buttons Group */}
                <div className="flex gap-3">
                    {/* 🆕 Create Custom Sim Button */}
                    <button
                        onClick={() => setShowCreateSim(true)}
                        className="
                            group flex items-center justify-center
                            bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white 
                            w-12 h-12 rounded-full 
                            shadow-lg hover:shadow-[0_0_20px_rgba(244,63,94,0.6)]
                            border-2 border-[#fff]/20 hover:border-white
                            transition-all duration-300 transform hover:scale-110 active:scale-95
                        "
                        title="捏人 (创建自定义市民)"
                    >
                        <span className="text-xl">🎨</span>
                    </button>

                    {/* Spawn Single Button (Random) */}
                    <button
                        onClick={handleSpawnSingle}
                        className="
                            group flex items-center gap-2 
                            bg-[#00b894] hover:bg-[#55efc4] text-[#121212] 
                            pl-4 pr-5 py-3 rounded-full 
                            shadow-lg hover:shadow-[0_0_20px_rgba(85,239,196,0.5)]
                            border-2 border-[#fff]/20 hover:border-white
                            transition-all duration-300 transform hover:scale-105 active:scale-95
                        "
                        title="快速生成单人 (随机)"
                    >
                        <span className="text-xl">👤</span>
                        <span className="font-bold text-xs">随机</span>
                    </button>

                    {/* Spawn Family Button (Random) */}
                    <button
                        onClick={handleSpawnFamily}
                        className="
                            group flex items-center gap-2 
                            bg-[#e17055] hover:bg-[#ff7675] text-white
                            pl-4 pr-5 py-3 rounded-full 
                            shadow-lg hover:shadow-[0_0_20px_rgba(225,112,85,0.5)]
                            border-2 border-[#fff]/20 hover:border-white
                            transition-all duration-300 transform hover:scale-105 active:scale-95
                        "
                        title="快速生成家庭 (随机)"
                    >
                        <span className="text-xl">👨‍👩‍👧</span>
                        <span className="font-bold text-xs">家庭</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameOverlay;