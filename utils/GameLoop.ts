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
    // 限制 dt 最大值，防止从后台切换回来时 dt 过大导致位移崩溃
    const safeDt = Math.min(dt, 5);

    if (GameStore.time.speed <= 0) return;

    // A. 移动逻辑 (保持流畅)
    // 注意：这里我们让移动速度也稍微适配一下慢节奏，防止人走得太快像瞬移
    // 如果觉得人走得太慢，可以把 * 1.0 改成 * 1.5 或更高
    GameStore.sims.forEach(s => {
        // [修复] 记录移动前的位置，用于 NaN 恢复
        const backupX = s.pos.x;
        const backupY = s.pos.y;
        // 🟢 [修改] 增加移动速度倍率
        // 这里的 1.5 表示市民移动速度是原来的 1.5 倍
        // 你可以根据手感调整为 2.0 或更高
        const moveSpeedMultiplier = 1.5;

        // 这里调用 Sim.update -> State.update -> IdleState -> DecisionLogic
        s.update(safeDt * GameStore.time.speed* moveSpeedMultiplier, false);

        // [修复] 如果更新后坐标变成了 NaN，回滚到更新前
        if (isNaN(s.pos.x) || isNaN(s.pos.y)) {
            console.warn(`[GameLoop] Recovered ${s.name} from NaN void.`);
            s.pos.x = isNaN(backupX) ? 100 : backupX; 
            s.pos.y = isNaN(backupY) ? 100 : backupY;
            
            // [新增] 既然位置重置了，必须清除当前的路径和状态，防止逻辑错乱
            s.path = [];
            s.target = null;
            s.action = 'idle';
        }
    });
    // ====== [新增代码 START] ======
    // 修复：更新并清理粒子，防止无限增长
    if (GameStore.particles.length > 0) {
        // 减少生命值 (0.05 是衰减速度，你可以根据需要调整)
        GameStore.particles.forEach(p => p.life -= safeDt * 0.05);
        // 移除已经死亡的粒子
        GameStore.particles = GameStore.particles.filter(p => p.life > 0);
    }

    // B. 时间流速控制
    GameStore.timeAccumulator += dt * GameStore.time.speed;
    
    // [核心调整]
    // 60 = 1秒1分钟 (太快)
    // 120 = 2秒1分钟 (标准)
    // 180 = 3秒1分钟 (悠闲) <-- 我们用这个
    const ticksPerMin = 60; 

    while (GameStore.timeAccumulator >= ticksPerMin) {
        GameStore.timeAccumulator -= ticksPerMin;
        GameStore.time.minute++;

        // 每分钟触发一次的逻辑 (Update with minuteChanged = true)
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
                    s.dailyTransactions = []; // <--- 强制清空今日账单，防止内存爆炸
                    s.payRent(); 
                    s.calculateDailyBudget(); 
                    s.applyMonthlyEffects(currentMonth, holiday);
                    // ====== [新增：版税结算逻辑] ======
                    // 将 Sim.ts 里的逻辑移到这里
                    if (s.royalty && s.royalty.amount > 0) {
                        // 发钱
                        s.money += s.royalty.amount;
                        s.dailyIncome += s.royalty.amount; // 计入今日收入
                        
                        // 记录日志和冒气泡
                        GameStore.addLog(s, `收到作品版税 +$${s.royalty.amount}`, 'money');
                        s.say("版税到账 💰", 'money');
                        
                        // 扣除剩余天数
                        s.royalty.daysLeft--;
                        if (s.royalty.daysLeft <= 0) {
                            s.royalty.amount = 0;
                            s.say("版税停了，该写新书了...", 'sys');
                        }
                    }
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