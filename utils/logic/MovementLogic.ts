import { Sim } from '../Sim';
import { GameStore } from '../simulation';
import { AgeStage } from '../../types';

export const MovementLogic = {
    /**
     * 平滑移动逻辑 (带冷却优化版)
     */
    moveTowardsTarget(sim: Sim, dt: number): boolean {
        // [修复] 严格检查目标是否存在且合法
        if (!sim.target || typeof sim.target.x !== 'number' || typeof sim.target.y !== 'number' || isNaN(sim.target.x) || isNaN(sim.target.y)) {
            // console.warn(`[Movement] Invalid target for ${sim.name}, cancelling move.`);
            sim.target = null;
            sim.path = [];
            return true; // 视为到达（停止移动）
        }

        // [修复] 自身坐标合法性检查
        if (isNaN(sim.pos.x) || isNaN(sim.pos.y)) {
             // 如果当前位置坏了，尝试恢复到上一个有效位置，或者重置到目标
             sim.pos.x = sim.target.x;
             sim.pos.y = sim.target.y;
             return true;
        }

        // 1. 终点判定 (到达检查)
        const dx = sim.target.x - sim.pos.x;
        const dy = sim.target.y - sim.pos.y;
        const distSq = dx * dx + dy * dy;
        
        if (distSq <= 9) { // 15px 范围内视为到达
            sim.pos = { ...sim.target };
            sim.target = null;
            sim.path = [];
            sim.currentPathIndex = 0;
            return true;
        }

        // 2. 路径生成 (如果当前没有路径)
        if (sim.path.length === 0) {
            if (sim.decisionTimer > 0) {
                sim.decisionTimer -= dt;
                return false; 
            }

            // 尝试寻路
             sim.path = GameStore.pathFinder.findPath(sim.pos.x, sim.pos.y, sim.target.x, sim.target.y);
            sim.currentPathIndex = 0;

            // 如果依然找不到路径 (A* 失败/被围住)
             if (sim.path.length === 0) {
                // 如果距离很近 (100px内)，尝试直线强行移动
                if (distSq < 10000) { 
                     sim.path.push({ x: sim.target.x, y: sim.target.y });
                } else {
                    sim.decisionTimer = 120; 
                    return false; 
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

        // [安全锁] 防止单帧移动过大 (例如切后台回来 dt 很大时)
        if (distToTravel > 20) distToTravel = 20;

         while (distToTravel > 0 && sim.currentPathIndex < sim.path.length) {
            const nextNode = sim.path[sim.currentPathIndex];
            
            // [修复] 防止路径点出现 NaN
            if (isNaN(nextNode.x) || isNaN(nextNode.y)) {
                sim.path = []; // 路径坏了，丢弃
                return false;
            }

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
                sim.pos = { x: nextNode.x, y: nextNode.y }; 
                distToTravel -= distToNext; 
                sim.currentPathIndex++;     
            } else {
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

        return false; // 本次 update 尚未到达终点
    }
};