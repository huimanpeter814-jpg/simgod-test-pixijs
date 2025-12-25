import React, { useState } from 'react';
import { Sim, GameStore } from '../../../../utils/simulation';
import { SKILLS, JOBS } from '../../../../constants';
import { AgeStage } from '../../../../types';
import { SkillBar } from '../Shared';

export const CareerTab: React.FC<{ sim: Sim }> = ({ sim }) => {
    const [showJobDetail, setShowJobDetail] = useState(false);
    
    // 职业相关计算
    const isStudent = [AgeStage.Child, AgeStage.Teen].includes(sim.ageStage);
    const isUnemployed = sim.job.id === 'unemployed';
    const performance = Math.floor(sim.workPerformance);
    const perfColor = performance > 80 ? 'bg-success' : (performance < 0 ? 'bg-danger' : 'bg-blue-400');
    const perfPercent = Math.max(0, Math.min(100, (performance + 50) / 1.5));
    
    const careerPath = JOBS.filter(j => j.companyType === sim.job.companyType).sort((a, b) => a.level - b.level);

    // [新增] 预算使用百分比 (支出 / 预算)
    const budgetPercent = sim.dailyBudget > 0 ? Math.min(100, (sim.dailyExpense / sim.dailyBudget) * 100) : 0;
    const budgetColor = budgetPercent > 100 ? 'bg-red-500' : (budgetPercent > 80 ? 'bg-orange-400' : 'bg-green-500');

    return (
        <div className="flex flex-col gap-6 animate-[fadeIn_0.2s_ease-out]">
            
            {/* 1. 资产与预算 (Assets & Budget) - [修改] 增加了预算和布局调整 */}
            <div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">资产管理</div>
                <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-lg p-3 border border-white/10 flex flex-col gap-3">
                    {/* 现金余额 */}
                    <div className="flex justify-between items-end border-b border-white/10 pb-2">
                        <span className="text-gray-400 text-[10px]">现金余额</span>
                        <span className="text-xl font-bold text-warning font-mono">${sim.money.toLocaleString()}</span>
                    </div>

                    {/* 收支概览 */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-black/20 rounded p-1.5 flex flex-col gap-1">
                            <span className="text-gray-500 text-[9px]">今日收入</span>
                            <span className="text-green-400 font-mono font-bold">+${sim.dailyIncome}</span>
                        </div>
                        <div className="bg-black/20 rounded p-1.5 flex flex-col gap-1">
                            <span className="text-gray-500 text-[9px]">今日支出</span>
                            <span className="text-red-400 font-mono font-bold">-${sim.dailyExpense}</span>
                        </div>
                    </div>

                    {/* 每日预算条 */}
                    <div className="flex flex-col gap-1 mt-1">
                        <div className="flex justify-between text-[9px] text-gray-400">
                            <span>每日预算 (${sim.dailyBudget})</span>
                            <span className={sim.dailyExpense > sim.dailyBudget ? 'text-red-400' : 'text-gray-400'}>
                                {Math.floor(budgetPercent)}%
                            </span>
                        </div>
                        <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-500 ${budgetColor}`} style={{ width: `${budgetPercent}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 收支明细 (Transactions) - [新增] 显示 sim.dailyTransactions */}
            <div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">今日账单</div>
                <div className="bg-white/5 rounded-lg border border-white/5 p-2 max-h-[120px] overflow-y-auto custom-scrollbar">
                    {sim.dailyTransactions && sim.dailyTransactions.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                            {sim.dailyTransactions.map((t, idx) => (
                                <div key={idx} className="flex justify-between items-center text-[10px] border-b border-white/5 last:border-0 pb-1 last:pb-0">
                                    <div className="flex gap-2 items-center">
                                        <span className="text-gray-500 font-mono text-[9px]">{t.time}</span>
                                        <span className="text-gray-300 truncate max-w-[120px]" title={t.reason}>{t.reason}</span>
                                    </div>
                                    <span className={`font-mono ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                                        {t.type === 'income' ? '+' : '-'}${t.amount}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-[10px] text-gray-600 italic py-4">
                            今日暂无收支记录
                        </div>
                    )}
                </div>
            </div>

            {/* 3. 职业生涯 (Career) - 保持之前的逻辑 */}
            <div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">职业概览</div>
                
                {isUnemployed && !isStudent ? (
                    <div className="bg-white/5 rounded-lg p-4 text-center border border-white/5">
                        <span className="text-gray-500 text-[11px] block mb-2">当前处于无业状态</span>
                        <button className="text-[10px] bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-1 rounded border border-blue-500/30 transition-colors">
                            前往人才市场
                        </button>
                    </div>
                ) : (
                    <div className="bg-white/5 rounded-lg border border-white/5 overflow-hidden">
                        {/* 职业头部 & 详情折叠 (代码同上一次，保持不变) */}
                        <div 
                            className="p-3 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors flex justify-between items-center group"
                            onClick={() => setShowJobDetail(!showJobDetail)}
                        >
                            <div>
                                <div className="text-[9px] text-gray-500 mb-0.5">{isStudent ? '学校' : '当前职位 (点击查看详情)'}</div>
                                <div className="text-sm font-bold text-blue-200 group-hover:text-white transition-colors flex items-center gap-2">
                                    {sim.job.title}
                                    <span className="text-[9px] font-normal text-gray-500 opacity-50 group-hover:opacity-100">ⓘ</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 font-bold">
                                    Lv.{sim.job.level}
                                </span>
                            </div>
                        </div>

                        {showJobDetail && !isStudent && (
                            <div className="px-3 py-3 bg-black/20 border-t border-white/5">
                                <div className="text-[9px] text-gray-500 mb-2">晋升路线 (当前: {sim.job.companyType})</div>
                                <div className="flex flex-col gap-2 relative pl-2 border-l border-white/10">
                                    {careerPath.map(job => {
                                        const isCurrent = job.id === sim.job.id;
                                        const isPast = job.level < sim.job.level;
                                        return (
                                            <div key={job.id} className={`relative flex items-center justify-between text-[10px] ${isCurrent ? 'text-blue-300 font-bold' : (isPast ? 'text-gray-500' : 'text-gray-400')}`}>
                                                <div className={`absolute -left-[13px] w-2 h-2 rounded-full border ${isCurrent ? 'bg-blue-500 border-blue-300' : 'bg-[#121212] border-white/20'}`}></div>
                                                <span>{job.title}</span>
                                                <span className="font-mono opacity-50">Lv.{job.level}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="p-3 grid grid-cols-2 gap-2 text-[10px] border-t border-white/5">
                            <div><span className="text-gray-500 block">薪资</span><span className="text-warning font-mono">${sim.job.salary}/月</span></div>
                            <div><span className="text-gray-500 block">工时</span><span className="text-gray-300 font-mono">{sim.job.startHour}:00 - {sim.job.endHour}:00</span></div>
                        </div>

                        <div className="p-3 border-t border-white/5 bg-black/20">
                            <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                                <span>累计表现 (KPI)</span>
                                <span className={perfColor.replace('bg-', 'text-')}>{performance > 0 ? '+' : ''}{performance}</span>
                            </div>
                            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5 relative mb-3">
                                <div className="absolute left-[33%] top-0 bottom-0 w-px bg-white/20 z-10"></div>
                                <div className={`h-full transition-all duration-500 ${perfColor}`} style={{ width: `${perfPercent}%` }}></div>
                            </div>

                            <div className="bg-white/5 rounded p-2">
                                <span className="text-[9px] text-gray-500 block mb-1">📅 考评日志:</span>
                                {sim.dailyWorkLog && sim.dailyWorkLog.length > 0 ? (
                                    <div className="flex flex-col gap-1">
                                        {sim.dailyWorkLog.map((log, idx) => (
                                            <div key={idx} className="flex justify-between text-[10px] border-b border-white/5 last:border-0 pb-0.5 last:pb-0">
                                                <span className="text-gray-300">{log.factor}</span>
                                                <span className={`font-mono ${log.score > 0 ? 'text-green-400' : 'text-red-400'}`}>{log.score > 0 ? '+' : ''}{log.score}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className="text-[10px] text-gray-600 italic">暂无考评数据</div>}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 4. 技能 (Skills) - 保持不变 */}
            <div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">职业技能</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {Object.entries(sim.skills).map(([key, val]) => {
                        const skillVal = val as number;
                        if (skillVal < 1) return null;
                        const label = SKILLS.find(s => s.id === key)?.label || key;
                        return (
                            <div key={key} className="flex justify-between items-center bg-white/5 px-2 py-1.5 rounded border border-white/5">
                                <span className="text-[10px] text-gray-300">{label}</span>
                                <SkillBar val={skillVal} />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};