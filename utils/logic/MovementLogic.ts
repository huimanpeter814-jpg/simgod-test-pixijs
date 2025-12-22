import { Sim } from '../Sim';
import { GameStore } from '../simulation';
import { AgeStage } from '../../types';

export const MovementLogic = {
    /**
     * 平滑移动逻辑 (防卡死优化版)
     */
    moveTowardsTarget(sim: Sim, dt: number): boolean {
        if (!sim.target) return true;

        // [修复] 防止目标坐标非法
        if (isNaN(sim.target.x) || isNaN(sim.target.y)) {
            // console.warn(`[Movement] Invalid target for ${sim.name}:`, sim.target);
            sim.target = null;
            return true; // 视为任务结束
        }

        // 1. 终点判定 (到达检查)
        // [优化] 放宽判定范围 (从 4px -> 100px^2 即 10px)，防止在终点附近反复摩擦
        const dx = sim.target.x - sim.pos.x;
        const dy = sim.target.y - sim.pos.y;
        const distSq = dx * dx + dy * dy;
        
        if (distSq <= 100) { 
            sim.pos = { ...sim.target };
            sim.target = null;
            sim.path = [];
            sim.currentPathIndex = 0;
            return true; // 到达
        }

        // 2. 路径生成 (如果当前没有路径)
        if (sim.path.length === 0) {
            // [优化] 如果之前寻路失败进入了冷却，不要死等，直接放弃本次移动任务
            // 让 Sim 回到 Idle 状态重新思考，比卡在 Moving 状态更好
            if (sim.decisionTimer > 0) {
                sim.target = null;
                return true; // 放弃移动，视为结束
            }

            // 尝试寻路
            sim.path = GameStore.pathFinder.findPath(sim.pos.x, sim.pos.y, sim.target.x, sim.target.y);
            sim.currentPathIndex = 0;

            // 如果依然找不到路径 (A* 失败/被围住)
            if (sim.path.length === 0) {
                // 如果距离很近 (150px内)，且中间没有明显大障碍，尝试直线强行移动 (穿墙容错)
                if (distSq < 22500) { 
                     sim.path.push({ x: sim.target.x, y: sim.target.y });
                } else {
                    // [核心修复] 找不到路且距离远：直接放弃任务！
                    // 不要返回 false (这会让 Sim 留在 Moving 状态直到超时)
                    // 返回 true 会让 SimStates 认为动作结束，从而切回 Idle
                    if (Math.random() < 0.05) sim.say("过不去...", "bad");
                    sim.target = null;
                    return true; // 放弃，结束移动
                }
            }
        }

        // 3. 核心移动 (平滑插值)
        let speedMod = 1.0;
        if (sim.ageStage === AgeStage.Infant) speedMod = 0.3;
        else if (sim.ageStage === AgeStage.Toddler) speedMod = 0.5;
        else if (sim.ageStage === AgeStage.Elder) speedMod = 0.7;
        if (sim.isPregnant) speedMod *= 0.6;
        
        // 计算本帧移动距离
        let distToTravel = sim.speed * speedMod * (dt * 0.15); 

        // 只要还有移动力，就沿着路径点一直走
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
                // 如果能直接走到下一个节点，就走过去，并扣除移动力
                sim.pos = { x: nextNode.x, y: nextNode.y }; 
                distToTravel -= distToNext; 
                sim.currentPathIndex++;     
            } else {
                // 只能走到两点之间
                const ratio = distToTravel / distToNext;
                sim.pos.x += ndx * ratio;
                sim.pos.y += ndy * ratio;
                distToTravel = 0; 
            }
        }

        // 如果走完了所有路径点，清空路径
        if (sim.currentPathIndex >= sim.path.length) {
             sim.path = []; 
        }

        return false; // 本次 update 尚未到达终点 (继续下一帧)
    }
};