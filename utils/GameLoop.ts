import { GameStore } from './GameStore';
import { TIME_CONFIG, HOLIDAYS, PALETTES } from '../constants';
import { NarrativeSystem } from './logic/narrative';

export function getActivePalette() {
    const h = GameStore.time.hour;
    if (h >= 5 && h < 9) return PALETTES.earlyMorning;
    if (h >= 9 && h < 15) return PALETTES.noon;
    if (h >= 15 && h < 18) return PALETTES.afternoon;
    if (h >= 18 && h < 21) return PALETTES.dusk;
    if (h >= 21 || h < 0) return PALETTES.night;
    return PALETTES.lateNight;
}

let tickCount = 0;

export const gameLoopStep = (dt: number = 1) => {
    if (GameStore.time.speed <= 0) return;

    // A. 移动逻辑 (保持流畅)
    // 注意：这里我们让移动速度也稍微适配一下慢节奏，防止人走得太快像瞬移
    // 如果觉得人走得太慢，可以把 * 1.0 改成 * 1.5 或更高
    GameStore.sims.forEach(s => s.update(dt * GameStore.time.speed * 0.5, false));

    // B. 时间流速控制
    GameStore.timeAccumulator += dt * GameStore.time.speed;
    
    // [核心调整]
    // 60 = 1秒1分钟 (太快)
    // 120 = 2秒1分钟 (标准)
    // 180 = 3秒1分钟 (悠闲) <-- 我们用这个
    const ticksPerMin = 180; 

    while (GameStore.timeAccumulator >= ticksPerMin) {
        GameStore.timeAccumulator -= ticksPerMin;
        GameStore.time.minute++;

        // 低频逻辑
        GameStore.sims.forEach(s => s.update(0, true));

        if (GameStore.time.minute >= 60) {
            GameStore.time.minute = 0;
            GameStore.time.hour++;
            GameStore.sims.forEach(s => s.checkSpending());

            if (GameStore.time.hour >= 24) {
                GameStore.time.hour = 0;
                GameStore.time.totalDays++;
                GameStore.time.month++;
                
                if (GameStore.time.month > 12) {
                    GameStore.time.month = 1;
                    GameStore.time.year++;
                    GameStore.addLog(null, `🎆 新年快乐！进入第 ${GameStore.time.year} 年`, 'sys');
                }

                const currentMonth = GameStore.time.month;
                const holiday = HOLIDAYS[currentMonth];
                if (holiday) {
                    GameStore.addLog(null, `🎉 本月是: ${holiday.name}`, 'sys');
                }
                
                GameStore.sims.forEach(s => {
                    s.dailyExpense = 0; 
                    s.dailyIncome = 0; 
                    s.payRent(); 
                    s.calculateDailyBudget(); 
                    s.applyMonthlyEffects(currentMonth, holiday);
                });
                
                NarrativeSystem.handleDailyDiaries(GameStore.sims, GameStore.time, (msg: string) => GameStore.addLog(null, msg, 'sys', true));
                GameStore.saveGame(1);
            }
        }
    }

    // C. UI 通知
    tickCount++;
    if (tickCount % 10 === 0) {
        GameStore.notify();
    }
};