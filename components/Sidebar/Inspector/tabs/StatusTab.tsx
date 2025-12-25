import React from 'react';
import { Sim } from '../../../../utils/simulation';
import { GameStore } from '../../../../utils/simulation';
import { SimAction, NeedType, SimIntent } from '../../../../types';
import { RelBar } from '../Shared';

// 状态映射表
const STATUS_MAP: Record<string, string> = {
    [SimAction.Idle]: '发呆', 
    [SimAction.Moving]: '移动中', 
    [SimAction.Commuting]: '通勤中', 
    [SimAction.Wandering]: '闲逛',
    [SimAction.Working]: '打工', 
    [SimAction.Sleeping]: '睡觉', 
    [SimAction.Eating]: '进食', 
    [SimAction.Talking]: '聊天',
    [SimAction.Using]: '忙碌', 
    [SimAction.WatchingMovie]: '看电影', 
    [SimAction.Phone]: '玩手机',
    [SimAction.CommutingSchool]: '上学路上',
    [SimAction.Schooling]: '在校学习',
    [SimAction.PickingUp]: '接送中',
    [SimAction.Escorting]: '护送中',
    [SimAction.BeingEscorted]: '被护送',
    [SimAction.Waiting]: '等待中'
};

// 新增：高层意图的中文映射
const INTENT_MAP: Record<string, string> = {
    [SimIntent.IDLE]: '发呆/待机',
    [SimIntent.SATISFY_HUNGER]: '寻找食物',
    [SimIntent.SLEEP]: '准备睡觉',
    [SimIntent.WORK]: '去工作',
    [SimIntent.SOCIALIZE]: '社交互动',
    [SimIntent.FUN]: '寻找乐子',
    [SimIntent.WANDER]: '四处游荡',
    [SimIntent.SURVIVE]: '紧急求生',
    [SimIntent.FULFILL_NEED]: '满足生理需求'
};

export const StatusTab: React.FC<{ sim: Sim }> = ({ sim }) => {
    let statusText = STATUS_MAP[sim.action] || sim.action;
    if (sim.action === SimAction.Using && sim.interactionTarget) statusText = `使用 ${sim.interactionTarget.label}`;
    const displayStatus = (sim.bubble?.type === 'act' && sim.bubble?.text && sim.bubble?.timer > 0) ? sim.bubble.text : statusText;

    return (
        <>
            

            {/* 当前状态 */}
            <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">当前状态</div>
                <div className="bg-black/30 rounded px-3 py-2 flex items-center justify-between border border-white/5 shadow-inner">
                    <span className="text-sm text-act font-bold flex items-center gap-2 truncate max-w-[200px]">{displayStatus}</span>
                    <span className="text-xs text-gray-400">Mood: {Math.floor(sim.mood)}</span>
                </div>
            </div>

            {/* 🟢 [新增] AI 决策与行为队列 */}
            <div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 flex justify-between items-center">
                    <span>AI 决策大脑</span>
                    {sim.actionQueue.length > 0 && (
                        <span className="text-[9px] bg-accent/20 text-accent px-1.5 rounded">
                            {sim.actionQueue.length} 步待办
                        </span>
                    )}
                </div>
                
                <div className="bg-black/20 rounded border border-white/5 p-2 flex flex-col gap-2">
                    {/* 1. 当前的高层意图 (Goal) */}
                    <div className="flex flex-col gap-1 pb-2 border-b border-white/5">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-400">当前意图</span>
                            <span className="text-[11px] font-bold text-accent flex items-center gap-1">
                                <span className="text-[10px]">🎯</span>
                                {INTENT_MAP[sim.currentIntent] || sim.currentIntent}
                            </span>
                        </div>
                        {/* 🆕 显示决策原因 (Why) */}
                        {sim.lastDecisionReason && (
                            <div className="bg-white/5 p-1.5 rounded text-[10px] text-gray-300 font-mono leading-tight">
                                <span className="text-gray-500 mr-1">Reason:</span>
                                {sim.lastDecisionReason}
                            </div>
                        )}
                    </div>
                    {/* 2. 战术策略 (Strategy) */}
                    {sim.currentPlanDescription && (
                        <div className="text-[10px] text-gray-400 italic px-1">
                            "<span className="text-gray-300">{sim.currentPlanDescription}</span>"
                        </div>
                    )}

                    {/* 3. 行为执行流 (Pipeline) */}
                    <div className="flex flex-col gap-1.5">
                        
                        {/* 当前正在执行的动作 (Active) */}
                        <div className="relative">
                            <div className="absolute left-[7px] top-3 bottom-[-10px] w-0.5 bg-white/10 z-0"></div>
                            <div className="flex items-center gap-2 relative z-10">
                                <div className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center text-[8px] text-green-400 shadow-[0_0_8px_rgba(72,187,120,0.3)]">
                                    ▶
                                </div>
                                <div className="flex-1 bg-white/10 px-2 py-1.5 rounded border border-white/10 text-[10px] text-white flex justify-between items-center">
                                    <span className="font-bold">{STATUS_MAP[sim.action] || sim.action}</span>
                                    <span className="text-[9px] text-gray-400 italic">正在执行</span>
                                </div>
                            </div>
                        </div>

                        {/* 队列中的后续动作 (Queue) */}
                        {sim.actionQueue.length > 0 ? (
                            sim.actionQueue.map((action, idx) => (
                                <div key={idx} className="flex items-center gap-2 relative z-10 opacity-80">
                                    <div className="w-4 flex justify-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
                                    </div>
                                    <div className="flex-1 bg-black/20 px-2 py-1 rounded border border-white/5 text-[10px] text-gray-300">
                                        {/* 优先显示 action.desc (调试描述)，如果没有则显示类型 */}
                                        <span className="mr-2 text-accent/70 font-mono">[{action.type}]</span>
                                        <span>{action.desc || action.interactionKey || '...'}</span>
                                        {action.targetId && <span className="text-gray-500 ml-1">→ {action.targetId.slice(0,4)}</span>}
                                    </div>
                                </div>
                            ))
                        ) : (
                            // 如果队列为空
                            <div className="flex items-center gap-2 relative z-10 opacity-40">
                                <div className="w-4 flex justify-center"><div className="w-1 h-1 rounded-full bg-gray-700"></div></div>
                                <span className="text-[9px] text-gray-600 italic">后续队列为空</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 基本需求 */}
            <div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">基本需求</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {[
                        { l: '饥饿', v: sim.needs[NeedType.Hunger], c: '#e17055' }, 
                        { l: '精力', v: sim.needs[NeedType.Energy], c: '#6c5ce7' },
                        { l: '社交', v: sim.needs[NeedType.Social], c: '#00b894' }, 
                        { l: '娱乐', v: sim.needs[NeedType.Fun], c: '#fdcb6e' },
                        { l: '卫生', v: sim.needs[NeedType.Hygiene], c: '#74b9ff' }, 
                        { l: '如厕', v: sim.needs[NeedType.Bladder], c: '#fab1a0' },
                    ].map(s => (
                        <div key={s.l}>
                            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5"><span>{s.l}</span></div>
                            <div className="h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                                <div className="h-full transition-all duration-500" style={{ width: `${s.v}%`, background: s.c }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Buffs */}
            <div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">状态 (Buffs)</div>
                {sim.buffs.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {sim.buffs.map(b => (
                            <span key={b.id} className={`text-[10px] px-2 py-1 rounded border ${b.type === 'good' ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'}`}>{b.label}</span>
                        ))}
                    </div>
                ) : <span className="text-[10px] text-gray-600 italic">无特殊状态</span>}
            </div>

            {/* 人际关系 */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">人际关系</div>
                    <div className={`text-[10px] font-mono flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/5 ${sim.faithfulness > 80 ? 'text-success' : 'text-gray-300'}`}>
                        <span>❤️ 专一: {Math.floor(sim.faithfulness)}</span>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    {Object.keys(sim.relationships).sort((a, b) => {
                        const rA = sim.relationships[a], rB = sim.relationships[b];
                        const isFamA = rA.kinship && rA.kinship !== 'none' ? 1 : 0, isFamB = rB.kinship && rB.kinship !== 'none' ? 1 : 0;
                        if (isFamA !== isFamB) return isFamB - isFamA;
                        return (Math.abs(rB.friendship) + Math.abs(rB.romance)) - (Math.abs(rA.friendship) + Math.abs(rA.romance));
                    }).map(targetId => {
                        const targetSim = GameStore.sims.find(s => s.id === targetId);
                        if (!targetSim) return null;
                        const rel = sim.relationships[targetId];
                        const label = sim.getRelLabel(rel);
                        const isFamily = rel.kinship && rel.kinship !== 'none';
                        return (
                            <div key={targetId} className={`p-2 rounded border transition-colors hover:bg-white/10 ${isFamily ? 'bg-blue-900/10 border-blue-500/20' : 'bg-white/5 border-white/5'}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-2 cursor-pointer group" onClick={(e) => { e.stopPropagation(); GameStore.selectedSimId = targetSim.id; GameStore.notify(); }}>
                                        <div className="w-4 h-4 rounded-full" style={{ background: targetSim.skinColor }}></div>
                                        <span className="text-[11px] font-bold text-gray-200 group-hover:text-white group-hover:underline transition-all">{targetSim.name} 🔗</span>
                                    </div>
                                    <span className={`text-[9px] px-1.5 rounded ${isFamily ? 'bg-blue-500/20 text-blue-300' : (rel.isLover ? 'bg-love/20 text-love' : 'bg-black/30 text-gray-400')}`}>{label}</span>
                                </div>
                                <div className="flex flex-col gap-1 mt-1">
                                    <RelBar val={rel.friendship} type="friend" />
                                    {(rel.hasRomance || rel.romance !== 0 || rel.isSpouse) && <RelBar val={rel.romance} type="romance" />}
                                </div>
                            </div>
                        );
                    })}
                    {Object.keys(sim.relationships).length === 0 && <span className="text-[11px] text-gray-600 italic text-center py-2">还未认识任何人...</span>}
                </div>
            </div>
        </>
    );
};