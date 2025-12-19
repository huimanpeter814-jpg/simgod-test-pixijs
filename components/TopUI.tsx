import React, { useState, useEffect, useRef } from 'react';
import { GameStore } from '../utils/simulation';
import { SaveMetadata } from '../types';
import { HOLIDAYS } from '../constants';
import HelpModal from './HelpModal';

const SaveLoadModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [slots, setSlots] = useState<(SaveMetadata | null)[]>([]);

    useEffect(() => {
        setSlots(GameStore.getSaveSlots());
    }, []);

    const handleSave = (index: number) => {
        GameStore.saveGame(index);
        setSlots(GameStore.getSaveSlots());
    };

    const handleLoad = (index: number) => {
        if (slots[index - 1]) {
            GameStore.loadGame(index);
            onClose();
        }
    };

    const handleDelete = (index: number) => {
        if (confirm(`确定要删除存档 ${index} 吗？`)) {
            GameStore.deleteSave(index);
            setSlots(GameStore.getSaveSlots());
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
            <div className="bg-[#1e222e] w-[500px] rounded-xl border border-white/20 shadow-2xl p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">💾 存档管理</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>
                
                <div className="flex flex-col gap-3">
                    {slots.map((slot, i) => {
                        const idx = i + 1;
                        return (
                            <div key={idx} className="flex items-center gap-4 bg-black/20 p-3 rounded-lg border border-white/5 hover:border-white/20 transition-all group">
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-pixel text-xs text-gray-400">
                                    {idx}
                                </div>
                                <div className="flex-1">
                                    {slot ? (
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-warning">{slot.timeLabel}</span>
                                                <span className="text-xs text-gray-400">人口: {slot.pop}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-500">{slot.realTime}</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-gray-600 italic">空存档位</span>
                                    )}
                                </div>
                                
                                <div className="flex gap-2 opacity-80 group-hover:opacity-100">
                                    <button 
                                        onClick={() => handleSave(idx)}
                                        className="px-3 py-1 bg-white/10 hover:bg-success hover:text-black rounded text-xs font-bold transition-colors"
                                    >
                                        覆盖
                                    </button>
                                    {slot && (
                                        <>
                                            <button 
                                                onClick={() => handleLoad(idx)}
                                                className="px-3 py-1 bg-white/10 hover:bg-accent hover:text-black rounded text-xs font-bold transition-colors"
                                            >
                                                读取
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(idx)}
                                                className="px-2 py-1 bg-transparent hover:bg-danger/20 text-danger rounded text-xs transition-colors"
                                                title="删除"
                                            >
                                                ✕
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const TopUI: React.FC = () => {
  const [time, setTime] = useState({ ...GameStore.time });
  const [pop, setPop] = useState(0);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  
  // FPS Logic
  const [fps, setFps] = useState(60);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    // 1. GameStore listener
    const unsub = GameStore.subscribe(() => {
        setTime({ ...GameStore.time });
        setPop(GameStore.sims.length);
        setToast(GameStore.toastMessage);
    });

    // 2. FPS Calculation loop
    const calcFps = () => {
        const now = performance.now();
        frameCountRef.current++;
        if (now - lastTimeRef.current >= 1000) {
            setFps(frameCountRef.current);
            frameCountRef.current = 0;
            lastTimeRef.current = now;
        }
        rafRef.current = requestAnimationFrame(calcFps);
    };
    calcFps();

    return () => {
        unsub();
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const setSpeed = (s: number) => {
    GameStore.time.speed = s;
    GameStore.notify(); 
  };

  const holiday = HOLIDAYS[time.month];

  return (
    <>
        <div className="absolute top-4 left-0 right-0 flex justify-between px-6 z-30 pointer-events-none">
        {/* Time & Speed Control */}
        <div className="flex gap-4 items-center">
            <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-6 pointer-events-auto shadow-lg">
                <div className="flex flex-col items-end leading-none gap-1 min-w-[80px]">
                    <div className="font-pixel text-[10px] text-gray-400">
                        YEAR {time.year}
                    </div>
                    <div className="font-bold text-xs text-white flex items-center gap-2">
                        <span>{time.month} 月</span>
                        {holiday && <span className="text-[10px] bg-red-500/20 text-red-300 px-1 rounded border border-red-500/30">{holiday.name}</span>}
                    </div>
                </div>
                
                <div className="text-xl font-bold text-warning drop-shadow-[0_0_5px_rgba(253,203,110,0.5)]">
                {String(time.hour).padStart(2,'0')}:{String(time.minute).padStart(2,'0')}
                </div>

                <div className="h-6 w-px bg-white/20"></div>
                
                <div className="flex gap-1">
                    {[
                        { l: 'II', s: 0 }, { l: '▶', s: 1 }, { l: '▶▶', s: 50 }, { l: '>>>', s: 200 }
                    ].map(btn => (
                        <button 
                            key={btn.s}
                            onClick={() => setSpeed(btn.s)}
                            className={`
                                bg-transparent border-none cursor-pointer font-inter text-[10px] font-bold px-2 py-0.5 rounded transition-all
                                ${time.speed === btn.s ? 'bg-success text-black' : 'text-gray-400 hover:text-white hover:bg-white/10'}
                            `}
                        >
                            {btn.l}
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Side Controls */}
            <div className="flex gap-2 pointer-events-auto">
                {/* FPS Counter */}
                <div className="bg-black/40 backdrop-blur-sm px-2 h-9 rounded-full border border-white/5 flex items-center justify-center min-w-[50px]">
                    <span className={`text-[10px] font-mono font-bold ${fps < 30 ? 'text-red-400' : 'text-green-400'}`}>
                        {fps} FPS
                    </span>
                </div>

                <button 
                    onClick={() => setShowSaveModal(true)}
                    className="bg-black/60 backdrop-blur-md px-3 h-9 rounded-full border border-white/10 flex items-center gap-2 text-xs font-bold text-gray-300 hover:text-white hover:border-white/30 transition-all active:scale-95"
                >
                    <span>💾 存档</span>
                </button>

                <button
                    onClick={() => setShowHelpModal(true)}
                    className="bg-black/60 backdrop-blur-md w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-sm font-bold text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/30 transition-all active:scale-95"
                    title="玩法说明"
                >
                    ?
                </button>
            </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 pointer-events-auto">
            <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 text-xs text-gray-300 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                Pop: {pop}
            </div>
        </div>
        </div>

        {/* Toast Notification */}
        {toast && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-white/20 text-white px-6 py-2 rounded-full shadow-2xl z-50 animate-[fadeIn_0.3s_ease-out]">
                {toast}
            </div>
        )}

        {/* Modals */}
        {showSaveModal && <SaveLoadModal onClose={() => setShowSaveModal(false)} />}
        {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}
    </>
  );
};

export default TopUI;