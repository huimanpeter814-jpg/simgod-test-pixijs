import React from 'react';
import { Sim, GameStore } from '../../../../utils/simulation';
import { SimData } from '../../../../types';
import { InspectorFace } from '../InspectorFace';

// [修复] 扩充 sim 的类型定义，允许 Sim 类和 undefined
const TreeNode: React.FC<{ 
    sim: SimData | Sim | null | undefined, 
    label: string, 
    isSelf?: boolean,
    size?: number,
    onClick?: (id: string) => void 
}> = ({ sim, label, isSelf, size = 40, onClick }) => {
    if (!sim) {
        return (
            <div className="flex flex-col items-center gap-1 opacity-30">
                <div style={{ width: size, height: size }} className="rounded-full border border-dashed border-white/30 bg-white/5 flex items-center justify-center">
                    <span className="text-[10px] text-gray-500">?</span>
                </div>
                <span className="text-[9px] text-gray-500">{label}</span>
            </div>
        );
    }

    return (
        <div 
            className={`flex flex-col items-center gap-1 group cursor-pointer ${isSelf ? 'scale-110 z-20' : 'z-10'}`}
            onClick={() => onClick && onClick(sim.id)}
        >
            <div 
                style={{ width: size, height: size }}
                className={`
                rounded-full border-2 overflow-hidden bg-black/40 relative transition-all group-hover:border-white
                ${isSelf ? 'border-accent shadow-[0_0_10px_rgba(162,155,254,0.5)]' : 'border-white/20'}
            `}>
                {/* [修复] 强制类型转换为 SimData 以兼容 InspectorFace */}
                <InspectorFace sim={sim as SimData} size={size} />
            </div>
            <div className="flex flex-col items-center leading-none">
                <span className={`text-[9px] font-bold truncate max-w-[60px] ${isSelf ? 'text-accent' : 'text-gray-300 group-hover:text-white'}`}>
                    {sim.name}
                </span>
                <span className="text-[8px] text-gray-500">{label}</span>
            </div>
        </div>
    );
};

export const FamilyTab: React.FC<{ sim: Sim, sims: Sim[] }> = ({ sim, sims }) => {
    const getSim = (id: string | null | undefined) => sims.find(s => s.id === id);
    
    // 🔍 智能查找父母 (支持 ID 查找和关系表回溯)
    const findParent = (currentSim: SimData | Sim | null | undefined, gender: 'M' | 'F'): Sim | undefined => {
        if (!currentSim) return undefined;
        
        // 1. 优先尝试直接 ID (最准确)
        if (gender === 'M' && currentSim.fatherId) return getSim(currentSim.fatherId);
        if (gender === 'F' && currentSim.motherId) return getSim(currentSim.motherId);

        // 2. 回退：从关系表中查找 Kinship 为 'parent' 的人
        if (currentSim.relationships) {
            const parentId = Object.keys(currentSim.relationships).find(id => {
                const rel = currentSim.relationships[id];
                if (rel.kinship !== 'parent') return false;
                const target = getSim(id);
                // 确保性别匹配 (父亲必须是男，母亲必须是女)
                return target && target.gender === gender;
            });
            if (parentId) return getSim(parentId);
        }
        return undefined;
    };

    // 1. 直系亲属
    const partner = getSim(sim.partnerId);
    const father = findParent(sim, 'M');
    const mother = findParent(sim, 'F');
    const children = sim.childrenIds.map(id => getSim(id)).filter(Boolean) as Sim[];

    // 2. 祖辈 (Grandparents) - 基于找到的父母继续向上查找
    const paternalGrandfather = findParent(father, 'M');
    const paternalGrandmother = findParent(father, 'F');
    const maternalGrandfather = findParent(mother, 'M');
    const maternalGrandmother = findParent(mother, 'F');
    
    const hasGrandparents = paternalGrandfather || paternalGrandmother || maternalGrandfather || maternalGrandmother;

    // 3. 兄弟姐妹 (Siblings)
    const siblings = sims.filter(s => 
        s.id !== sim.id && 
        (
            // 只要有一个父母相同就算手足
            (father && s.relationships[father.id]?.kinship === 'parent') || 
            (mother && s.relationships[mother.id]?.kinship === 'parent') ||
            (s.fatherId && sim.fatherId && s.fatherId === sim.fatherId) || 
            (s.motherId && sim.motherId && s.motherId === sim.motherId)
        )
    );

    const handleSelect = (id: string) => {
        GameStore.selectSim(id);
    };

    return (
        <div className="flex flex-col gap-4 w-full">
            {/* Family Lore */}
            {sim.familyLore && (
                <div className="p-3 rounded bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-500/20 text-[11px] shadow-sm">
                    <div className="text-[9px] text-yellow-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <span>📜 家庭历史</span>
                    </div>
                    <div className="leading-snug text-gray-300 italic">
                        "{sim.familyLore}"
                    </div>
                </div>
            )}

            {/* Tree Container */}
            <div className="flex flex-col items-center py-2 relative">
                
                {/* === Generation -2: Grandparents === */}
                {hasGrandparents && (
                    <div className="flex justify-center gap-16 mb-4 relative scale-90 origin-bottom">
                        {/* Paternal Side */}
                        <div className="flex flex-col items-center relative">
                            <div className="flex gap-2">
                                <TreeNode sim={paternalGrandfather} label="祖父" size={30} onClick={handleSelect} />
                                <TreeNode sim={paternalGrandmother} label="祖母" size={30} onClick={handleSelect} />
                            </div>
                            {/* Connect to Father */}
                            {father && (
                                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-px h-4 bg-white/10"></div>
                            )}
                        </div>

                        {/* Maternal Side */}
                        <div className="flex flex-col items-center relative">
                            <div className="flex gap-2">
                                <TreeNode sim={maternalGrandfather} label="外祖父" size={30} onClick={handleSelect} />
                                <TreeNode sim={maternalGrandmother} label="外祖母" size={30} onClick={handleSelect} />
                            </div>
                            {/* Connect to Mother */}
                            {mother && (
                                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-px h-4 bg-white/10"></div>
                            )}
                        </div>
                    </div>
                )}

                {/* === Generation -1: Parents === */}
                <div className="flex justify-center gap-12 relative z-10 mb-8">
                    {/* Father Node */}
                    <div className="relative">
                        <TreeNode sim={father} label="父亲" onClick={handleSelect} />
                    </div>
                    {/* Mother Node */}
                    <div className="relative">
                        <TreeNode sim={mother} label="母亲" onClick={handleSelect} />
                    </div>
                    
                    {/* Parent Connector Bracket */}
                    {(father || mother) && (
                        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-16 h-6 pointer-events-none">
                            {/* Horizontal Line connecting parents */}
                            <div className="w-full h-full border-b border-white/20 rounded-b-xl"></div>
                            {/* Vertical Line down to Self */}
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-px h-4 bg-white/20"></div>
                        </div>
                    )}
                </div>

                {/* === Generation 0: Self & Partner & Siblings === */}
                <div className="flex items-center justify-center relative z-10 mb-8 w-full">
                    
                    {/* Siblings List (Left Side) */}
                    {siblings.length > 0 && (
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 items-end pr-4 border-r border-white/10">
                            <span className="text-[8px] text-gray-500 mb-1">手足 ({siblings.length})</span>
                            <div className="flex flex-col gap-1 max-h-[100px] overflow-y-auto no-scrollbar py-1">
                                {siblings.map(sib => (
                                    <TreeNode key={sib.id} sim={sib} label="" size={28} onClick={handleSelect} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Self Center */}
                    <div className="relative mx-4">
                        {/* Line from Parents above */}
                        {(father || mother) && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-px h-8 bg-white/20"></div>
                        )}
                        
                        <TreeNode sim={sim} label="我" isSelf size={50} onClick={handleSelect} />

                        {/* Line to Children below */}
                        {children.length > 0 && (
                            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-px h-8 bg-white/20"></div>
                        )}
                    </div>

                    {/* Partner (Right Side) */}
                    {partner && (
                        <div className="relative ml-4 flex items-center">
                            {/* Marriage Line */}
                            <div className="w-8 h-px bg-pink-500/40 relative">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] text-pink-300">❤</div>
                            </div>
                            <TreeNode sim={partner} label="配偶" onClick={handleSelect} />
                        </div>
                    )}
                </div>

                {/* === Generation +1: Children === */}
                {children.length > 0 && (
                    <div className="w-full flex flex-col items-center relative">
                        {/* Bracket spanning all children */}
                        {children.length > 1 && (
                            <div className="w-[80%] h-4 border-t border-white/20 absolute top-0"></div>
                        )}

                        <div className="flex justify-center gap-3 flex-wrap pt-4">
                            {children.map(child => (
                                <div key={child.id} className="relative flex flex-col items-center">
                                    {/* Line up to bracket */}
                                    <div className="w-px h-4 bg-white/20 absolute -top-4"></div>
                                    <TreeNode 
                                        sim={child} 
                                        label="子女" 
                                        size={36}
                                        onClick={handleSelect}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {children.length === 0 && (
                    <div className="text-[10px] text-gray-600 italic mt-2">- 暂无后代 -</div>
                )}
            </div>
        </div>
    );
};