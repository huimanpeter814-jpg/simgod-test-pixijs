import React, { useState, useEffect, useRef } from 'react';
import { GameStore } from '../../utils/simulation';
import { LogEntry } from '../../types';

// [分类优化] 细化的分类
// 🆕 更新：新增 'career' (生涯) 分类，更名 'sys' 为系统(重要)
type TabType = 'all' | 'life' | 'chat' | 'rel' | 'career' | 'sys';

const LogPanel: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [isMinimized, setIsMinimized] = useState(false);

    // Dragging State
    const [position, setPosition] = useState({ x: 80, y: window.innerHeight - 320 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsub = GameStore.subscribe(() => setLogs([...GameStore.logs]));
        return unsub;
    }, []);

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

    // [分类优化] 过滤逻辑
    const filteredLogs = logs.filter(l => {
        if (activeTab === 'all') return true;
        // 确保 simulation.ts 中的 addLog 已经正确映射了这些 category
        return l.category === activeTab;
    });

    return (
        <div
            ref={panelRef}
            style={{
                left: position.x,
                top: position.y,
                height: isMinimized ? 'auto' : '300px'
            }}
            className="fixed w-[420px] flex flex-col pointer-events-auto z-50 transition-height duration-200"
        >
            {/* Header / Drag Handle */}
            <div
                onMouseDown={startDrag}
                className="h-8 bg-[#2d3436] border border-white/20 rounded-t-lg flex items-center justify-between px-3 cursor-move select-none shadow-lg"
            >
                <span className="text-[10px] font-pixel text-gray-300">SYSTEM.LOG</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="text-gray-400 hover:text-white"
                    >
                        {isMinimized ? '□' : '_'}
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <div className="flex-1 flex flex-col bg-[#121212]/90 backdrop-blur-md border-x border-b border-white/10 rounded-b-lg shadow-xl overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-white/10 overflow-x-auto no-scrollbar">
                        {[
                            { id: 'all', label: '全部' },
                            { id: 'sys', label: '❗️ 系统' },
                            { id: 'career', label: '💼 生涯' },
                            { id: 'rel', label: '❤️ 情感' },
                            { id: 'chat', label: '💬 社交' },
                            { id: 'life', label: '🌱 生活' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`flex-1 py-1.5 px-2 text-[10px] font-bold whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-white/10 text-white border-b-2 border-white' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Log Content */}
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar flex flex-col-reverse gap-1">
                        {filteredLogs.map(log => {
                            let colorClass = 'text-gray-400';
                            if (log.category === 'rel') colorClass = 'text-love';
                            if (log.category === 'chat') colorClass = 'text-chat';
                            if (log.category === 'career') colorClass = 'text-warning';
                            if (log.type === 'bad') colorClass = 'text-danger';
                            if (log.type === 'jealous') colorClass = 'text-danger font-bold';
                            if (log.isAI) colorClass = 'text-ai';
                            if (log.category === 'sys') colorClass = 'text-red-400 font-bold border-l-2 border-red-500 pl-1'; // 突出系统消息

                            return (
                                <div key={log.id} className="text-[11px] leading-snug hover:bg-white/5 px-1 rounded flex gap-2">
                                    <span className="opacity-30 text-[9px] font-mono shrink-0 w-16">
                                        {log.time.split('|')[1]}
                                    </span>
                                    <div className="flex-1 break-words">
                                        {log.simName && log.simName !== '系统' && (
                                            <span
                                                className="font-bold text-gray-300 mr-1 cursor-pointer hover:underline hover:text-white"
                                                onClick={() => {
                                                    const s = GameStore.sims.find(sim => sim.name === log.simName);
                                                    if (s) { GameStore.selectedSimId = s.id; GameStore.notify(); }
                                                }}
                                            >
                                                [{log.simName}]
                                            </span>
                                        )}
                                        <span className={colorClass}>
                                            {log.text}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredLogs.length === 0 && <div className="text-center text-[10px] text-gray-600 mt-10">- 暂无记录 -</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LogPanel;