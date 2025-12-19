import { Sim } from '../Sim';
import { HOLIDAYS, BUFFS } from '../../constants';
import { batchGenerateDiaries } from '../../services/geminiService';
import { GameTime } from '../../types';

export const NarrativeSystem = {
    async handleDailyDiaries(sims: Sim[], time: GameTime, logCallback: (msg: string) => void) {
        const monthIndex = time.totalDays;
        
        // 准备数据
        const allSimsData = sims.map(sim => sim.getDaySummary(monthIndex));
        const currentMonth = time.month;
        const holiday = HOLIDAYS[currentMonth];
        
        // 构建上下文
        let contextStr = `现在的季节是 ${currentMonth}月。`;
        if (holiday) contextStr += ` 本月是【${holiday.name}】(${holiday.type})，全城都在过节！`;
        
        // 批量请求
        const BATCH_SIZE = 5;
        for (let i = 0; i < allSimsData.length; i += BATCH_SIZE) {
            const batch = allSimsData.slice(i, i + BATCH_SIZE);
            try {
                const diariesMap = await batchGenerateDiaries(batch, contextStr);
                
                Object.entries(diariesMap).forEach(([simId, diaryContent]) => {
                    const sim = sims.find(s => s.id === simId);
                    if (sim) sim.addDiary(diaryContent);
                });
            } catch (error) { 
                console.error("[AI] 批次生成失败:", error); 
            }
        }
        
        logCallback(`第 ${monthIndex} 月的市民日记已生成完毕。`);
    }
};