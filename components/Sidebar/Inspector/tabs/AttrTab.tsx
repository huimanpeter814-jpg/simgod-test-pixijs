import React from 'react';
import { Sim, GameStore } from '../../../../utils/simulation';
import { HAIR_STYLE_NAMES } from '../../../../constants';
import { AgeStage } from '../../../../types';

export const AttrTab: React.FC<{ sim: Sim }> = ({ sim }) => {
    const hairName = HAIR_STYLE_NAMES[(sim.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 17)] || '未知发型';
    const homeUnit = GameStore.housingUnits.find(u => u.id === sim.homeId);
    
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
                            {!sim.homeId && <button onClick={() => GameStore.sendAssignHome(sim.id)} className="text-[9px] bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 transition-colors">分配住址</button>}
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

            
        </>
    );
};