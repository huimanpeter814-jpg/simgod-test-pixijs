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

// [修改] 接受 dt (delta time) 参数，默认值为 1
export const gameLoopStep = (dt: number = 1) => {
    // 游戏暂停时不运行
    if (GameStore.time.speed <= 0) return;

    // A. 高频逻辑 (移动)
    // ------------------------------------------------
    // 直接把 dt 传给 update，让移动距离和帧时间完美挂钩
    // 这样 60帧时每次走1步，120帧时每次走0.5步，视觉效果完全一致且顺滑
    GameStore.sims.forEach(s => s.update(dt * GameStore.time.speed, false));


    // B. 处理时间流逝 (Time)
    // ------------------------------------------------
    GameStore.timeAccumulator += dt * GameStore.time.speed;
    
    const ticksPerMin = TIME_CONFIG?.TICKS_PER_MINUTE || 120;

    while (GameStore.timeAccumulator >= ticksPerMin) {
        GameStore.timeAccumulator -= ticksPerMin;
        GameStore.time.minute++;

        // 低频逻辑 (状态更新)
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

    // C. UI 通知限流
    // ------------------------------------------------
    tickCount++;
    if (tickCount % 10 === 0) {
        GameStore.notify();
    }
};