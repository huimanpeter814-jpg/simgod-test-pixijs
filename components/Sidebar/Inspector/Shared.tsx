import React from 'react';

// [修改] 优化进度条显示逻辑 - 三态显示法
// 1. val >= 20*i : 全亮 (里程碑达成)
// 2. val > 20*(i-1) : 半亮 (当前正在修习该阶段)
// 3. 其他 : 暗色 (未解锁)
export const SkillBar: React.FC<{ val: number }> = ({ val }) => (
    <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => {
            const targetLevel = i * 20;
            const prevLevel = (i - 1) * 20;
            
            let styleClass = 'bg-white/5 border-white/10'; // 默认: 未解锁 (暗)

            if (val >= targetLevel) {
                // 状态1: 已达成里程碑 (全亮 + 发光)
                styleClass = 'bg-accent border-accent shadow-[0_0_5px_rgba(162,155,254,0.6)]';
            } else if (val > prevLevel) {
                // 状态2: 正在进行中 (半亮 / 半透明)
                // 让你看到虽然没满，但已经有点东西了
                styleClass = 'bg-accent/40 border-accent/60'; 
            }

            return (
                <div 
                    key={i} 
                    className={`w-3 h-3 rounded-sm border transition-all duration-300 ${styleClass}`} 
                    title={`Level ${prevLevel} - ${targetLevel}`}
                />
            );
        })}
    </div>
);

export const RelBar: React.FC<{ val: number, type: 'friend' | 'romance' }> = ({ val, type }) => {
    const widthPercent = Math.min(50, (Math.abs(val) / 100) * 50);
    const isPositive = val >= 0;
    const leftPercent = isPositive ? 50 : 50 - widthPercent;
    let color = isPositive ? (type === 'friend' ? 'bg-success' : 'bg-love') : 'bg-danger';

    return (
        <div className="flex items-center gap-2 text-[9px] text-gray-500 w-full">
            <span className="w-3 text-center">{type === 'friend' ? '友' : '爱'}</span>
            <div className="flex-1 h-2 bg-black/40 rounded-full relative overflow-hidden border border-white/5">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30 z-10"></div>
                <div className={`absolute top-0 bottom-0 ${color} transition-all duration-300`} style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}></div>
            </div>
            <span className={`w-6 text-right font-mono ${val < 0 ? 'text-danger' : 'text-gray-400'}`}>{Math.floor(val)}</span>
        </div>
    );
};