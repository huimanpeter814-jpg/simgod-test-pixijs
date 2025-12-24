import React, { useRef, useEffect, useMemo } from 'react';
import { GameStore, Sim } from '../../utils/simulation';
import { drawAvatarHead } from '../../utils/render/pixelArt';
import { SimData } from '../../types';

interface RosterProps {
    sims: Sim[];
    selectedId: string | null;
}

const AvatarCanvas: React.FC<{ sim: SimData }> = ({ sim }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // 🆕 新增：重绘触发器
    const [retry, setRetry] = React.useState(0);

    // 🆕 新增：检测机制
    // 刚加载时，每隔 300ms 强制重绘一次，尝试 5 次
    // 这能解决“组件渲染了但图片还没加载好”导致的空白问题
    useEffect(() => {
        if (retry < 5) {
            const timer = setTimeout(() => setRetry(r => r + 1), 300);
            return () => clearTimeout(timer);
        }
    }, [retry]);
    useEffect(() => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, 40, 40);
                drawAvatarHead(ctx, 20, 25, 12, sim);
            }
        }
    }, [sim, retry]); // 添加 retry 到依赖数组
    return <canvas ref={canvasRef} width={40} height={40} className="w-10 h-10 object-contain" />;
};

const Roster: React.FC<RosterProps> = ({ sims, selectedId }) => {
    // 🆕 按家庭ID分组
    const families = useMemo(() => {
        const groups: Record<string, Sim[]> = {};
        sims.forEach(sim => {
            if (!groups[sim.familyId]) {
                groups[sim.familyId] = [];
            }
            groups[sim.familyId].push(sim);
        });
        return groups;
    }, [sims]);

    return (
        <div className="flex flex-col gap-4 max-h-full overflow-y-auto no-scrollbar py-2 items-center w-full">
            {Object.entries(families).map(([familyId, members]) => {
                const surname = members[0]?.surname || '未知';
                return (
                    <div key={familyId} className="w-full flex flex-col gap-2">
                        {/* 家庭分割线/标题 */}
                        <div className="w-full text-center border-b border-white/10 pb-1 mt-1">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{surname}家</span>
                        </div>
                        
                        {/* 成员列表 */}
                        {members.map(sim => (
                            <div
                                key={sim.id}
                                onClick={() => { GameStore.selectSim(sim.id); }}
                                className={`
                                w-full shrink-0 bg-[#121212]/80 backdrop-blur-md rounded-lg border-2 cursor-pointer relative flex flex-col items-center justify-center py-1 transition-all hover:border-white group
                                ${selectedId === sim.id ? 'border-select shadow-[0_0_10px_rgba(57,255,20,0.3)] bg-white/10' : 'border-white/10'}
                            `}
                                title={sim.name}
                            >
                                <AvatarCanvas sim={sim} />
                                <span className={`text-[10px] mt-1 font-bold truncate max-w-[90%] ${selectedId === sim.id ? 'text-select' : 'text-gray-400 group-hover:text-white'}`}>
                                    {sim.name}
                                </span>

                                {/* Mood Dot */}
                                <div
                                    className={`absolute top-1 right-1 w-2 h-2 rounded-full border border-black/50 ${sim.mood > 80 ? 'bg-success' : sim.mood < 40 ? 'bg-danger' : 'bg-gray-400'}`}
                                />
                            </div>
                        ))}
                    </div>
                );
            })}
            
            {sims.length === 0 && (
                <div className="text-[10px] text-gray-600 italic">暂无居民</div>
            )}
        </div>
    );
};

export default Roster;