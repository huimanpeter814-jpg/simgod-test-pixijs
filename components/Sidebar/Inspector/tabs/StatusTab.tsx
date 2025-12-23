import React from 'react';
import { Sim } from '../../../../utils/simulation';
import { GameStore } from '../../../../utils/simulation';
import { SimAction, NeedType } from '../../../../types';
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

export const StatusTab: React.FC<{ sim: Sim }> = ({ sim }) => {
    let statusText = STATUS_MAP[sim.action] || sim.action;
    if (sim.action === SimAction.Using && sim.interactionTarget) statusText = `使用 ${sim.interactionTarget.label}`;
    const displayStatus = (sim.bubble?.type === 'act' && sim.bubble?.text && sim.bubble?.timer > 0) ? sim.bubble.text : statusText;

    return (
        <>
            {/* 1. 资产状况 (保留并增强) */}
            <div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">资产状况</div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    {/* ... (保留总资产和预算的显示代码) ... */}
                    <div className="bg-white/5 p-2 rounded border border-white/5">
                        <div className="text-[10px] text-gray-400">总资产</div>
                        <div className="text-lg font-bold text-warning">${sim.money}</div>
                    </div>
                    <div className="bg-white/5 p-2 rounded border border-white/5">
                        <div className="text-[10px] text-gray-400">今日预算</div>
                        <div className="text-sm font-bold text-gray-300">${sim.dailyBudget}</div>
                    </div>
                </div>

                {/* 🟢 [新增] 收支明细列表 */}
                <div className="bg-black/20 rounded border border-white/5 overflow-hidden">
                    <div className="flex justify-between items-center px-2 py-1.5 bg-white/5 border-b border-white/5">
                        <span className="text-[10px] text-gray-400">今日明细</span>
                        <div className="flex gap-2 text-[9px]">
                            <span className="text-success">In: ${sim.dailyIncome}</span>
                            <span className="text-gray-600">|</span>
                            <span className="text-danger">Out: ${sim.dailyExpense}</span>
                        </div>
                    </div>
                    <div className="max-h-[120px] overflow-y-auto custom-scrollbar p-1">
                        {sim.dailyTransactions && sim.dailyTransactions.length > 0 ? (
                            sim.dailyTransactions.map((t, idx) => (
                                <div key={idx} className="flex justify-between items-center text-[10px] py-1 px-1 border-b border-white/5 last:border-0 hover:bg-white/5">
                                    <div className="flex gap-2">
                                        <span className="font-mono text-gray-500">{t.time}</span>
                                        <span className="text-gray-300">{t.reason}</span>
                                    </div>
                                    <span className={`font-mono font-bold ${t.type === 'income' ? 'text-success' : 'text-danger'}`}>
                                        {t.type === 'income' ? '+' : '-'}${t.amount}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="text-[10px] text-gray-600 text-center py-4 italic">今日暂无收支</div>
                        )}
                    </div>
                </div>
            </div>

            {/* 当前状态 */}
            <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">当前状态</div>
                <div className="bg-black/30 rounded px-3 py-2 flex items-center justify-between border border-white/5 shadow-inner">
                    <span className="text-sm text-act font-bold flex items-center gap-2 truncate max-w-[200px]">{displayStatus}</span>
                    <span className="text-xs text-gray-400">Mood: {Math.floor(sim.mood)}</span>
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