import React from 'react';
import { Sim, GameStore } from '../../../../utils/simulation';
import { SKILLS, HAIR_STYLE_NAMES } from '../../../../constants';
import { AgeStage } from '../../../../types';
import { SkillBar } from '../Shared';

export const AttrTab: React.FC<{ sim: Sim }> = ({ sim }) => {
    const hairName = HAIR_STYLE_NAMES[(sim.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 17)] || '未知发型';
    const jobTitle = sim.ageStage === AgeStage.Infant ? '吃奶' : (sim.ageStage === AgeStage.Toddler ? '幼儿园' : (sim.ageStage === AgeStage.Child ? '小学生' : (sim.ageStage === AgeStage.Teen ? '中学生' : sim.job.title)));
    const homeUnit = GameStore.housingUnits.find(u => u.id === sim.homeId);
    
    // [新增] 职业时间与表现计算
    const workTimeStr = sim.job.id === 'unemployed' ? '自由' : `${sim.job.startHour}:00 - ${sim.job.endHour}:00`;
    const performance = Math.floor(sim.workPerformance);
    // 表现进度条颜色
    const perfColor = performance > 80 ? 'bg-success' : (performance < 0 ? 'bg-danger' : 'bg-blue-400');
    // 表现进度条宽度 (映射 -100~200 到 0~100)
    const perfPercent = Math.max(0, Math.min(100, (performance + 50) / 1.5)); 

    return (
        <>
            {/* 个人特征 */}
            <div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">个人特征</div>
                <div className="bg-white/5 rounded-lg p-2 border border-white/5 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex flex-col gap-0.5 col-span-2 pb-2 mb-2 border-b border-white/5">
                        <span className="text-gray-500 text-[9px]">家庭住址</span>
                        <div className="flex justify-between items-center">
                            <span className={`${sim.homeId ? 'text-gray-200' : 'text-gray-500 italic'}`}>{homeUnit ? homeUnit.name : '无家可归'}</span>
                            {!sim.homeId && <button onClick={() => GameStore.assignRandomHome(sim)} className="text-[9px] bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 transition-colors">分配住址</button>}
                        </div>
                    </div>
                    
                    {/* Character Traits */}
                    <div className="flex flex-col gap-1 col-span-2 pb-2 mb-2 border-b border-white/5">
                        <span className="text-gray-500 text-[9px]">性格特质 (Traits)</span>
                        <div className="flex flex-wrap gap-1">
                            {sim.traits && sim.traits.length > 0 ? (
                                sim.traits.map(t => (
                                    <span key={t} className="text-[10px] bg-white/10 text-gray-200 px-1.5 py-0.5 rounded border border-white/10">{t}</span>
                                ))
                            ) : (
                                <span className="text-gray-600 text-[10px] italic">无明显特质</span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-0.5"><span className="text-gray-500 text-[9px]">姓氏</span><span className="text-gray-200 font-bold">{sim.surname}</span></div>
                    <div className="flex flex-col gap-0.5"><span className="text-gray-500 text-[9px]">发型 / 色值</span><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border border-white/20 shrink-0" style={{background: sim.hairColor}}></div><div className="flex flex-col leading-none justify-center"><span className="text-gray-200 font-bold text-[10px]">{hairName}</span><span className="text-gray-500 font-mono text-[8px] scale-90 origin-left">{sim.hairColor}</span></div></div></div>
                    <div className="flex flex-col gap-0.5"><span className="text-gray-500 text-[9px]">身高</span><span className="text-gray-200 font-mono">{sim.height} cm</span></div>
                    <div className="flex flex-col gap-0.5"><span className="text-gray-500 text-[9px]">体重</span><span className="text-gray-200 font-mono">{sim.weight} kg</span></div>
                    {[
                        { l: '魅力值', v: sim.appearanceScore, c: 'bg-gradient-to-r from-blue-400 to-pink-400', txt: sim.appearanceScore > 80 ? 'text-love' : 'text-gray-300' },
                        { l: '幸运', v: sim.luck, c: 'bg-gradient-to-r from-yellow-300 to-orange-400', txt: sim.luck > 80 ? 'text-warning' : 'text-gray-300' },
                        { l: '体质', v: sim.constitution, c: 'bg-gradient-to-r from-emerald-400 to-green-500', txt: sim.constitution > 80 ? 'text-success' : 'text-gray-300' },
                        { l: '智商', v: sim.iq, c: 'bg-gradient-to-r from-indigo-400 to-purple-500', txt: sim.iq > 80 ? 'text-purple-300' : 'text-gray-300' },
                        { l: '情商', v: sim.eq, c: 'bg-gradient-to-r from-cyan-400 to-blue-500', txt: sim.eq > 80 ? 'text-blue-400' : 'text-gray-300' },
                    ].map(attr => (
                        <div key={attr.l} className="flex flex-col gap-0.5 col-span-2 mt-1 pt-1 border-t border-white/5">
                            <div className="flex justify-between items-center"><span className="text-gray-500 text-[9px]">{attr.l}</span><span className={`font-bold ${attr.txt}`}>{attr.v}/100</span></div>
                            <div className="h-1.5 bg-black/30 rounded-full overflow-hidden mt-1"><div className={`h-full ${attr.c}`} style={{width: `${attr.v}%`}}></div></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 职业详情 - [修改] 移除了财务，扩展了职业详情 */}
            <div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">职业生涯</div>
                <div className="bg-white/5 rounded-lg p-2 border border-white/5 flex flex-col gap-2">
                    {/* Header: Title & Level */}
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-gray-500">当前职位</span>
                            <span className="text-xs font-bold text-gray-200">{jobTitle}</span>
                        </div>
                        {sim.job.id !== 'unemployed' && (
                            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 font-bold">Lv.{sim.job.level}</span>
                        )}
                    </div>

                    {sim.job.id !== 'unemployed' ? (
                        <>
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div className="bg-black/20 rounded p-1.5 border border-white/5">
                                    <span className="text-gray-500 block mb-0.5">薪资待遇</span>
                                    <span className="text-warning font-mono font-bold">${sim.job.salary}<span className="text-[8px] text-gray-500">/天</span></span>
                                </div>
                                <div className="bg-black/20 rounded p-1.5 border border-white/5">
                                    <span className="text-gray-500 block mb-0.5">工作时间</span>
                                    <span className="text-gray-300 font-mono">{workTimeStr}</span>
                                </div>
                            </div>
                            
                            {/* Performance Bar */}
                            <div className="mt-1 bg-black/20 rounded p-2 border border-white/5">
                                <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                                    <span>工作表现 (KPI)</span>
                                    <span className={perfColor.replace('bg-', 'text-')}>{performance > 0 ? '+' : ''}{performance}</span>
                                </div>
                                <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                                    {/* 中线 */}
                                    <div className="absolute left-[33%] top-0 bottom-0 w-px bg-white/20 z-10"></div>
                                    <div 
                                        className={`h-full transition-all duration-500 ${perfColor}`} 
                                        style={{ width: `${perfPercent}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-[8px] text-gray-600 mt-1 px-1">
                                    <span>被开除</span>
                                    <span>晋升</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-[10px] text-gray-600 italic text-center py-2">
                            暂无正式工作，享受自由时光
                        </div>
                    )}
                </div>
            </div>

            {/* 技能等级 */}
            <div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">技能等级</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {Object.entries(sim.skills).map(([key, val]) => {
                        const skillVal = val as number;
                        if (skillVal < 1) return null; // [修改] 显示所有 > 0 的技能，配合 SkillBar 修改
                        const label = SKILLS.find(s => s.id === key)?.label || key;
                        return (
                            <div key={key} className="flex justify-between items-center bg-white/5 px-2 py-1.5 rounded border border-white/5 transition-colors hover:bg-white/10">
                                <span className="text-[10px] text-gray-300">{label}</span>
                                <SkillBar val={skillVal} />
                            </div>
                        );
                    })}
                    {Object.values(sim.skills).every(v => (v as number) < 1) && <span className="text-[10px] text-gray-600 italic col-span-2 text-center py-2">暂无习得技能</span>}
                </div>
            </div>
        </>
    );
};