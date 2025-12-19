import React from 'react';

// [修改] 优化进度条显示逻辑，val >= 1 即显示第一格 (Math.ceil)
// 之前是 Math.floor(val / 20)，导致 0-19 都是 0 格，缺乏反馈
export const SkillBar: React.FC<{ val: number }> = ({ val }) => (
    <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
            <div 
                key={i} 
                className={`w-3 h-3 rounded-sm border border-black/20 transition-colors duration-300 ${
                    i <= Math.ceil(val / 20) ? 'bg-accent shadow-[0_0_5px_rgba(162,155,254,0.4)]' : 'bg-white/5'
                }`} 
                title={`Level ${i*20}`}
            />
        ))}
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