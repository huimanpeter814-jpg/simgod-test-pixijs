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
    // 🛑 核心修复：加锁！区分主线程和 Worker
    // 我们在 simulationWorker.ts 里写了 self.isWorker = true
    // @ts-ignore
    const isWorker = typeof self !== 'undefined' && self.isWorker === true;

    // === 情况 A：如果是主线程，直接结束，不跑 Sim 逻辑 ===
    if (!isWorker) {
        // 主线程只需要做一件事：定期通知 UI (React) 刷新面板
        tickCount++;
        if (tickCount % 10 === 0) {
            GameStore.notify();
        }
        // 🚨 关键：直接返回，不要执行下面的 Sim.update！
        return;
    }

    // === 情况 B：如果是 Worker，执行完整的游戏逻辑 (恢复之前的代码) ===
    
    // 限制 dt 最大值，防止从后台切换回来时 dt 过大导致位移崩溃
    const safeDt = Math.min(dt, 5);

    if (GameStore.time.speed <= 0) return;

    // A. 移动逻辑
    GameStore.sims.forEach(s => {
        const backupX = s.pos.x;
        const backupY = s.pos.y;
        const moveSpeedMultiplier = 2;

        s.update(safeDt * GameStore.time.speed * moveSpeedMultiplier, false);

        if (isNaN(s.pos.x) || isNaN(s.pos.y)) {
            // console.warn(`[GameLoop] Recovered ${s.name} from NaN void.`);
            s.pos.x = isNaN(backupX) ? 100 : backupX; 
            s.pos.y = isNaN(backupY) ? 100 : backupY;
            s.path = [];
            s.target = null;
            s.action = 'idle';
        }
    });

    // B. 粒子更新 (Worker 端也可以算，或者你决定只在主线程算粒子也可以，这里先保留)
    if (GameStore.particles.length > 0) {
        GameStore.particles.forEach(p => p.life -= safeDt * 0.05);
        GameStore.particles = GameStore.particles.filter(p => p.life > 0);
    }

    // C. 时间流速与逻辑
    GameStore.timeAccumulator += dt * GameStore.time.speed;
    const ticksPerMin = 180; // 3秒1分钟

    while (GameStore.timeAccumulator >= ticksPerMin) {
        GameStore.timeAccumulator -= ticksPerMin;
        GameStore.time.minute++;

        // 每分钟触发
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
                    s.dailyTransactions = [];
                    s.payRent(); 
                    s.calculateDailyBudget(); 
                    s.applyMonthlyEffects(currentMonth, holiday);
                    
                    if (s.royalty && s.royalty.amount > 0) {
                        s.money += s.royalty.amount;
                        s.dailyIncome += s.royalty.amount;
                        GameStore.addLog(s, `收到作品版税 +$${s.royalty.amount}`, 'money');
                        s.say("版税到账 💰", 'money');
                        s.royalty.daysLeft--;
                        if (s.royalty.daysLeft <= 0) {
                            s.royalty.amount = 0;
                            s.say("版税停了，该写新书了...", 'sys');
                        }
                    }
                });
                
                NarrativeSystem.handleDailyDiaries(GameStore.sims, GameStore.time, (msg: string) => GameStore.addLog(null, msg, 'sys', true));
                
                // Worker 里的保存逻辑通常通过 postMessage 触发，这里先保留原始逻辑，
                // 如果 GameStore.saveGame 内部没有做 Worker 检查，可能会报错，
                // 但通常 saveGame 是发消息给主线程，或者主线程负责存。
                // 暂时保留，如果不报错的话。
                // GameStore.saveGame(1); 
            }
        }
    }
    
    // Worker 端通常不需要 notify，因为它是通过 postMessage(SYNC) 通知的
    // 但保留这里的 tickCount 逻辑也无害
};