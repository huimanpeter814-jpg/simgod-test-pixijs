import { Sim } from '../Sim';
import { GameStore } from '../simulation';
import { AgeStage, SimAction } from '../../types';

export const MovementLogic = {
    /**
     * 平滑移动逻辑 (无预算限制版)
     */
    moveTowardsTarget(sim: Sim, dt: number): boolean {
        if (!sim.target) return true;

        // 1. 终点判定
        const dx = sim.target.x - sim.pos.x;
        const dy = sim.target.y - sim.pos.y;
        const distSq = dx * dx + dy * dy;
        
        if (distSq <= 225) { 
            sim.pos = { ...sim.target };
            sim.target = null;
            sim.path = [];
            sim.currentPathIndex = 0;
            return true;
        }

        // 2. 路径生成
        if (sim.path.length === 0) {
            // [优化] 寻路非常消耗性能，如果找不到路径，不要每一帧都重试
            sim.path = GameStore.pathFinder.findPath(sim.pos.x, sim.pos.y, sim.target.x, sim.target.y);
            sim.currentPathIndex = 0;
            
            // 兜底：如果没有路径
            if (sim.path.length === 0) {
                if (distSq < 10000) { 
                     // 距离很近，直接走直线尝试
                     sim.path.push({ x: sim.target.x, y: sim.target.y });
                } else {
                    // 距离太远且无路径，放弃移动
                    sim.decisionTimer = 60; 
                    // [关键修复] 返回 true 强制结束移动状态，防止下一帧继续寻路导致 FPS 暴跌
                    sim.target = null;
                    return true; 
                }
            }
        }

        // 3. 核心移动 (平滑插值)
        let speedMod = 1.0;
        if (sim.ageStage === AgeStage.Infant) speedMod = 0.3;
        else if (sim.ageStage === AgeStage.Toddler) speedMod = 0.5;
        else if (sim.ageStage === AgeStage.Elder) speedMod = 0.7;
        if (sim.isPregnant) speedMod *= 0.6;
        
        let distToTravel = sim.speed * speedMod * (dt * 0.15); 

        // 只要还有移动力，就一直走
        while (distToTravel > 0 && sim.currentPathIndex < sim.path.length) {
            const nextNode = sim.path[sim.currentPathIndex];
            const ndx = nextNode.x - sim.pos.x;
            const ndy = nextNode.y - sim.pos.y;
            const distToNext = Math.sqrt(ndx * ndx + ndy * ndy);

            // 防止除以0
            if (distToNext < 0.1) {
                sim.pos = { x: nextNode.x, y: nextNode.y };
                sim.currentPathIndex++;
                continue;
            }

            if (distToNext <= distToTravel) {
                // 直接走到下一个节点
                sim.pos = { x: nextNode.x, y: nextNode.y }; 
                distToTravel -= distToNext; 
                sim.currentPathIndex++;     
            } else {
                // 走到两点之间
                const ratio = distToTravel / distToNext;
                sim.pos.x += ndx * ratio;
                sim.pos.y += ndy * ratio;
                distToTravel = 0; 
            }
        }

        if (sim.currentPathIndex >= sim.path.length) {
             sim.path = []; 
        }

        return false;
    }
};