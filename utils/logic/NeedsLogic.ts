import { Sim } from '../Sim';
import { NeedType, Buff } from '../../types';
import { BASE_DECAY, BUFFS } from '../../constants';

export const NeedsLogic = {
    /**
     * 需求自然衰减
     */
    decayNeeds(sim: Sim, dt: number, exclude: NeedType[] = []) {
        // 🆕 [需求] 如果是NPC或保姆，需求值不衰减
        if (sim.isNPC || sim.job.id === 'nanny') return;

        const f = 0.00015 * dt; // 时间流逝系数

        if (!exclude.includes(NeedType.Energy)) 
            sim.needs[NeedType.Energy] -= BASE_DECAY[NeedType.Energy] * sim.metabolism.energy * f;
        
        if (!exclude.includes(NeedType.Hunger)) 
            sim.needs[NeedType.Hunger] -= BASE_DECAY[NeedType.Hunger] * sim.metabolism.hunger * f;
        
        if (!exclude.includes(NeedType.Fun)) 
            sim.needs[NeedType.Fun] -= BASE_DECAY[NeedType.Fun] * sim.metabolism.fun * f;
        
        if (!exclude.includes(NeedType.Bladder)) 
            sim.needs[NeedType.Bladder] -= BASE_DECAY[NeedType.Bladder] * sim.metabolism.bladder * f;
        
        if (!exclude.includes(NeedType.Hygiene)) 
            sim.needs[NeedType.Hygiene] -= BASE_DECAY[NeedType.Hygiene] * sim.metabolism.hygiene * f;
        
        if (!exclude.includes(NeedType.Social)) 
            sim.needs[NeedType.Social] -= BASE_DECAY[NeedType.Social] * sim.metabolism.social * f;

        // 钳制数值在 0-100
        (Object.keys(sim.needs) as NeedType[]).forEach(k => {
            sim.needs[k] = Math.max(0, Math.min(100, sim.needs[k]));
        });
    },

    /**
     * 更新 Buff 持续时间
     */
    updateBuffs(sim: Sim, minutesPassed: number) {
        sim.buffs.forEach(b => {
            b.duration -= minutesPassed;
        });
        sim.buffs = sim.buffs.filter(b => b.duration > 0);
    },

    /**
     * 添加 Buff
     */
    addBuff(sim: Sim, buffDef: any) {
        if (NeedsLogic.hasBuff(sim, buffDef.id)) {
            // 刷新持续时间
            const b = sim.buffs.find(b => b.id === buffDef.id);
            if (b) b.duration = buffDef.duration;
        } else {
            sim.buffs.push({ ...buffDef, source: 'system' });
        }
    },

    hasBuff(sim: Sim, id: string): boolean {
        return sim.buffs.some(b => b.id === id);
    },

    removeBuff(sim: Sim, id: string) {
        sim.buffs = sim.buffs.filter(b => b.id !== id);
    },

    /**
     * 计算综合心情
     */
    updateMood(sim: Sim) {
        let total = 0;
        let count = 0;
        (Object.keys(sim.needs) as NeedType[]).forEach(k => {
            total += sim.needs[k];
            count++;
        });
        
        let base = total / count;

        // Buff 修正
        sim.buffs.forEach(b => {
            if (b.type === 'good') base += 15;
            if (b.type === 'bad') base -= 15;
        });

        sim.mood = Math.max(0, Math.min(100, base));
    },

    /**
     * 极端状态检查 (健康扣除)
     */
    checkHealth(sim: Sim, dt: number) {
        // NPC 无敌
        if (sim.isNPC) return;

        const f = 0.0008 * dt;
        
        // 1. 扣血逻辑
        if (sim.needs[NeedType.Energy] <= 0 || sim.needs[NeedType.Hunger] <= 0) {
            sim.health -= 0.05 * f * 10;
            
            // [修复] 增加濒死打断逻辑：如果正在扣血，且还在工作/上学/睡觉，强制停止！
            if (sim.health < 60) { // 健康开始受损时
                // 定义需要被打断的长时状态
                const longActions = ['working', 'sleeping', 'studying', 'school'];
                // 简单的状态判断（你需要根据你的 SimAction 枚举调整）
                const isBusy = sim.actionTimer > 0; 
                
                if (isBusy) {
                    if (Math.random() < 0.1) { // 避免每一帧都触发说话
                        sim.say("不行了...撑不住了...", 'bad');
                    }
                    
                    // 强制结束当前行为，进入空闲状态，以便 decideAction 能接管并寻找食物/床
                    sim.finishAction(); 
                }
            }

            if (Math.random() > 0.99) sim.say("感觉快不行了...", 'bad'); // 降低说话频率
        } else if (sim.health < 100 && sim.needs[NeedType.Energy] > 80 && sim.needs[NeedType.Hunger] > 80) {
            sim.health += 0.01 * f;
        }
    }
};