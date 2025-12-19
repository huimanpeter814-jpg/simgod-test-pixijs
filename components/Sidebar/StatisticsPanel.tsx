import React, { useEffect, useState } from 'react';
import { GameStore, Sim } from '../../utils/simulation';
import { JobType, NeedType, AgeStage } from '../../types';
import { BUFFS, MBTI_TYPES, ORIENTATIONS } from '../../constants';

interface StatsPanelProps {
    onClose: () => void;
}

// 简单的详情列表项
const SimListItem: React.FC<{ name: string, sub?: string, id: string }> = ({ name, sub, id }) => (
    <div 
        className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/5 px-2 rounded transition-colors"
        onClick={() => {
            GameStore.selectedSimId = id;
            GameStore.notify();
        }}
    >
        <span className="text-[11px] text-gray-200 font-bold">{name}</span>
        {sub && <span className="text-[10px] text-gray-500">{sub}</span>}
    </div>
);

// 统计行组件 (支持点击)
const StatRow: React.FC<{ label: string, value: number, color?: string, onClick?: () => void }> = ({ label, value, color = 'text-white', onClick }) => (
    <div 
        className={`flex justify-between items-center py-1 border-b border-white/5 last:border-0 ${onClick && value > 0 ? 'cursor-pointer group' : ''}`}
        onClick={value > 0 ? onClick : undefined}
    >
        <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors">{label}</span>
        <div className="flex items-center gap-1">
            <span className={`text-[11px] font-bold font-mono ${color}`}>{value}</span>
            {onClick && value > 0 && <span className="text-[9px] text-gray-600 group-hover:text-gray-400">▶</span>}
        </div>
    </div>
);

const StatisticsPanel: React.FC<StatsPanelProps> = ({ onClose }) => {
    const [sims, setSims] = useState<Sim[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'social' | 'traits'>('overview');
    
    // [新增] 详情视图状态
    const [detailView, setDetailView] = useState<{ title: string, list: {name: string, sub?: string, id: string}[] } | null>(null);

    useEffect(() => {
        setSims([...GameStore.sims]);
        const unsub = GameStore.subscribe(() => setSims([...GameStore.sims]));
        return unsub;
    }, []);

    // --- 统计数据计算 ---

    // 1. 职业统计 [优化：遍历所有 JobType]
    const jobStats: Record<string, {count: number, sims: any[]}> = {};
    Object.values(JobType).forEach(type => jobStats[type] = {count: 0, sims: []}); // 初始化所有类型
    
    sims.forEach(s => {
        const type = s.job.companyType || '其他';
        if (!jobStats[type]) jobStats[type] = {count: 0, sims: []};
        jobStats[type].count++;
        jobStats[type].sims.push({ name: s.name, sub: s.job.title, id: s.id });
    });

    // 2. 人口属性统计 (年龄/性别/MBTI/星座)
    const ageStats: Record<string, any[]> = {};
    const mbtiStats: Record<string, any[]> = {};
    const zodiacStats: Record<string, any[]> = {};
    const genderStats: Record<string, number> = { 'M': 0, 'F': 0 };
    const orientationStats: Record<string, any[]> = {};

    // 3. 状态与特征
    const traitStats: Record<string, any[]> = {};
    const homelessSims: any[] = [];
    const criticalHealthSims: any[] = []; // 病危

    // 4. 情感状态
    const relStatusStats = {
        single: [] as any[],
        dating: [] as any[],
        married: [] as any[],
        divorced: [] as any[], // 需要结合 buff 判断
    };

    sims.forEach(s => {
        // Age
        if (!ageStats[s.ageStage]) ageStats[s.ageStage] = [];
        ageStats[s.ageStage].push({ name: s.name, sub: `${Math.floor(s.age)}岁`, id: s.id });

        // MBTI
        const mbtiKey = s.mbti;
        if (!mbtiStats[mbtiKey]) mbtiStats[mbtiKey] = [];
        mbtiStats[mbtiKey].push({ name: s.name, id: s.id });

        // Zodiac
        const zName = s.zodiac.name;
        if (!zodiacStats[zName]) zodiacStats[zName] = [];
        zodiacStats[zName].push({ name: s.name, id: s.id });

        // Gender
        genderStats[s.gender]++;

        // Orientation
        const orient = s.orientation;
        if (!orientationStats[orient]) orientationStats[orient] = [];
        orientationStats[orient].push({ name: s.name, id: s.id });

        // Traits
        s.traits.forEach(t => {
            if (!traitStats[t]) traitStats[t] = [];
            traitStats[t].push({ name: s.name, id: s.id });
        });

        // Housing
        if (!s.homeId) homelessSims.push({ name: s.name, sub: '流浪中', id: s.id });

        // Health
        if (s.health < 30) criticalHealthSims.push({ name: s.name, sub: `HP: ${Math.floor(s.health)}`, id: s.id });

        // Relationship Status logic
        if (s.partnerId) {
            const rel = s.relationships[s.partnerId];
            if (rel && rel.isSpouse) {
                relStatusStats.married.push({ name: s.name, sub: '已婚', id: s.id });
            } else {
                relStatusStats.dating.push({ name: s.name, sub: '恋爱中', id: s.id });
            }
        } else {
            if (s.hasBuff('divorced')) { // 简单判断，实际可能需要更复杂逻辑
                 relStatusStats.divorced.push({ name: s.name, sub: '离异', id: s.id });
            } else {
                 relStatusStats.single.push({ name: s.name, sub: '单身', id: s.id });
            }
        }
    });

    // 5. 关系统计 (Couple List)
    const lovers: {name: string, sub: string, id: string}[] = [];
    const processedPairs = new Set<string>();
    
    sims.forEach(s => {
        Object.keys(s.relationships).forEach(targetId => {
            const key = [s.id, targetId].sort().join('-');
            if (processedPairs.has(key)) return;
            
            const target = sims.find(t => t.id === targetId);
            if (!target) return;
            const rel = s.relationships[targetId];
            
            if (rel.isLover) {
                processedPairs.add(key);
                const pairName = `${s.name} & ${target.name}`;
                lovers.push({ name: pairName, sub: `热度: ${Math.floor(rel.romance)}`, id: s.id });
            }
        });
    });

    // 辅助函数
    const showList = (title: string, list: any[]) => {
        setDetailView({ title, list });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out] pointer-events-auto">
            <div className="w-full max-w-2xl bg-[#1e222e] border border-white/20 rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-white/10 shrink-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        {detailView ? (
                            <button onClick={() => setDetailView(null)} className="hover:text-accent mr-2">← 返回</button>
                        ) : '📊 城镇数据中心'}
                        {detailView && <span className="text-gray-400 text-sm">/ {detailView.title}</span>}
                    </h2>
                    <div className="flex items-center gap-4">
                        {!detailView && <span className="text-xs font-mono text-gray-500 bg-white/10 px-2 py-1 rounded">POPULATION: {sims.length}</span>}
                        <button 
                            onClick={onClose} 
                            className="text-gray-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Tabs (Main View Only) */}
                {!detailView && (
                    <div className="flex border-b border-white/10 bg-black/20 shrink-0">
                        {['overview', 'social', 'traits'].map(t => (
                            <button 
                                key={t}
                                onClick={() => setActiveTab(t as any)}
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === t ? 'text-accent border-b-2 border-accent bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                {{'overview': '概览 & 职业', 'social': '社交 & 情感', 'traits': '特征 & 个性'}[t]}
                            </button>
                        ))}
                    </div>
                )}
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#121212]/50">
                    
                    {/* View: List Details */}
                    {detailView ? (
                        <div className="grid grid-cols-2 gap-2">
                            {detailView.list.length > 0 ? (
                                detailView.list.map((item, idx) => (
                                    <div key={idx} className="bg-white/5 rounded px-2">
                                        <SimListItem name={item.name} sub={item.sub} id={item.id} />
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-2 text-center text-gray-500 py-10">暂无数据</div>
                            )}
                        </div>
                    ) : (
                        // View: Dashboard Tabs
                        <div className="flex flex-col gap-6">
                            
                            {/* --- TAB: OVERVIEW --- */}
                            {activeTab === 'overview' && (
                                <>
                                    {/* 关键指标 */}
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="bg-white/5 p-3 rounded border border-white/5 flex flex-col items-center cursor-pointer hover:bg-white/10" onClick={() => showList('无家可归名单', homelessSims)}>
                                            <div className="text-2xl mb-1">⛺</div>
                                            <div className="text-[10px] text-gray-400">流浪人口</div>
                                            <div className={`text-xl font-bold font-mono ${homelessSims.length > 0 ? 'text-danger' : 'text-gray-500'}`}>{homelessSims.length}</div>
                                        </div>
                                        <div className="bg-white/5 p-3 rounded border border-white/5 flex flex-col items-center cursor-pointer hover:bg-white/10" onClick={() => showList('病危名单 (HP<30)', criticalHealthSims)}>
                                            <div className="text-2xl mb-1">🚑</div>
                                            <div className="text-[10px] text-gray-400">健康危急</div>
                                            <div className={`text-xl font-bold font-mono ${criticalHealthSims.length > 0 ? 'text-danger' : 'text-success'}`}>{criticalHealthSims.length}</div>
                                        </div>
                                        <div className="bg-white/5 p-3 rounded border border-white/5 flex flex-col items-center">
                                            <div className="text-2xl mb-1">👫</div>
                                            <div className="text-[10px] text-gray-400">性别比例</div>
                                            <div className="text-xs font-bold font-mono text-blue-300">M:{genderStats.M} <span className="text-pink-300">F:{genderStats.F}</span></div>
                                        </div>
                                        <div className="bg-white/5 p-3 rounded border border-white/5 flex flex-col items-center">
                                            <div className="text-2xl mb-1">💰</div>
                                            <div className="text-[10px] text-gray-400">平均资产</div>
                                            <div className="text-lg font-bold font-mono text-warning">${Math.floor(sims.reduce((a,b)=>a+b.money,0)/Math.max(1, sims.length))}</div>
                                        </div>
                                    </div>

                                    {/* 职业分布 (全职业) */}
                                    <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">职业分布</div>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                            {Object.entries(jobStats)
                                                .sort(([,a], [,b]) => b.count - a.count)
                                                .map(([type, data]) => {
                                                    // Mapping english types to chinese for display if possible
                                                    const displayType = {
                                                        [JobType.Unemployed]: '无业/自由',
                                                        [JobType.Internet]: '互联网',
                                                        [JobType.Design]: '设计艺术',
                                                        [JobType.Business]: '商业金融',
                                                        [JobType.Store]: '零售服务',
                                                        [JobType.Restaurant]: '餐饮美食',
                                                        [JobType.Library]: '图书管理',
                                                        [JobType.School]: '教育行业',
                                                        [JobType.Nightlife]: '娱乐夜场',
                                                        [JobType.Hospital]: '医疗卫生',
                                                        [JobType.ElderCare]: '养老护理'
                                                    }[type] || type;

                                                    return (
                                                        <StatRow 
                                                            key={type}
                                                            label={displayType}
                                                            value={data.count}
                                                            color={data.count > 0 ? 'text-blue-300' : 'text-gray-600'}
                                                            onClick={() => showList(`${displayType} 从业者`, data.sims)}
                                                        />
                                                    );
                                                })
                                            }
                                        </div>
                                    </div>

                                    {/* 年龄分布 */}
                                    <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">年龄结构</div>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                            {Object.values(AgeStage).map(stage => {
                                                const list = ageStats[stage] || [];
                                                return (
                                                    <StatRow 
                                                        key={stage}
                                                        label={stage} 
                                                        value={list.length} 
                                                        color="text-purple-300" 
                                                        onClick={() => showList(`${stage} 名单`, list)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* --- TAB: SOCIAL --- */}
                            {activeTab === 'social' && (
                                <>
                                    <div className="grid grid-cols-2 gap-6">
                                        {/* 情感状态 */}
                                        <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                                            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">情感状态</div>
                                            <div className="flex flex-col gap-1">
                                                <StatRow label="💍 已婚" value={relStatusStats.married.length} color="text-love" onClick={() => showList('已婚名单', relStatusStats.married)} />
                                                <StatRow label="💕 恋爱中" value={relStatusStats.dating.length} color="text-pink-400" onClick={() => showList('恋爱名单', relStatusStats.dating)} />
                                                <StatRow label="🦅 单身" value={relStatusStats.single.length} color="text-gray-300" onClick={() => showList('单身名单', relStatusStats.single)} />
                                                {relStatusStats.divorced.length > 0 && <StatRow label="💔 离异" value={relStatusStats.divorced.length} color="text-gray-500" onClick={() => showList('离异名单', relStatusStats.divorced)} />}
                                            </div>
                                        </div>

                                        {/* 性取向 */}
                                        <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                                            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">性取向分布</div>
                                            <div className="flex flex-col gap-1">
                                                {ORIENTATIONS.map(o => (
                                                    <StatRow 
                                                        key={o.type}
                                                        label={o.label} 
                                                        value={orientationStats[o.type]?.length || 0} 
                                                        color="text-indigo-300"
                                                        onClick={() => showList(`${o.label} 名单`, orientationStats[o.type] || [])}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 现存情侣 */}
                                    <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">当前情侣/伴侣 ({lovers.length} 对)</div>
                                        <div className="max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                            {lovers.length > 0 ? lovers.map((l, i) => (
                                                <div key={i} className="flex justify-between text-xs py-1 border-b border-white/5 last:border-0">
                                                    <span className="text-pink-200">{l.name}</span>
                                                    <span className="text-gray-500 scale-90">{l.sub}</span>
                                                </div>
                                            )) : <div className="text-gray-500 text-xs italic">暂无情侣</div>}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* --- TAB: TRAITS --- */}
                            {activeTab === 'traits' && (
                                <>
                                    {/* MBTI 分布 */}
                                    <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">MBTI 人格分布</div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {MBTI_TYPES.map(type => {
                                                const count = mbtiStats[type]?.length || 0;
                                                return (
                                                    <div 
                                                        key={type} 
                                                        className={`text-center p-1 rounded border ${count > 0 ? 'bg-accent/10 border-accent/30 cursor-pointer hover:bg-accent/20' : 'bg-transparent border-white/5 opacity-50'}`}
                                                        onClick={count > 0 ? () => showList(`${type} 人群`, mbtiStats[type]) : undefined}
                                                    >
                                                        <div className="text-[10px] font-bold text-gray-300">{type}</div>
                                                        <div className="text-xs font-mono text-accent">{count}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        {/* 性格特质 Top 10 */}
                                        <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                                            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">热门性格特质</div>
                                            <div className="flex flex-col gap-1">
                                                {Object.entries(traitStats)
                                                    .sort(([,a], [,b]) => b.length - a.length)
                                                    .slice(0, 8)
                                                    .map(([trait, list]) => (
                                                        <StatRow 
                                                            key={trait} 
                                                            label={trait} 
                                                            value={list.length} 
                                                            color="text-yellow-200" 
                                                            onClick={() => showList(`具有 [${trait}] 的市民`, list)}
                                                        />
                                                    ))
                                                }
                                            </div>
                                        </div>

                                        {/* 星座分布 */}
                                        <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                                            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">星座分布</div>
                                            <div className="flex flex-col gap-1">
                                                {Object.entries(zodiacStats)
                                                    .sort(([,a], [,b]) => b.length - a.length)
                                                    .map(([z, list]) => (
                                                        <StatRow 
                                                            key={z} 
                                                            label={z} 
                                                            value={list.length} 
                                                            color="text-purple-300"
                                                            onClick={() => showList(`${z} 市民`, list)}
                                                        />
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatisticsPanel;