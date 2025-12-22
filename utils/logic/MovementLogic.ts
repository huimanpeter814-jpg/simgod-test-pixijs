import { Sim } from '../Sim';
import { GameStore } from '../simulation';
import { AgeStage } from '../../types';

export const MovementLogic = {
    /**
     * 严格路径跟随移动
     * 解决漂移问题的核心：不直接飞向终点，而是逐个节点走，并且到达节点时强制吸附
     */
    moveTowardsTarget(sim: Sim, dt: number): boolean {
        // 1. 安全性检查
        if (!sim.target || isNaN(sim.target.x) || isNaN(sim.target.y)) {
            sim.target = null;
            sim.path = [];
            return true; // 视为结束
        }

        // 2. 路径生成 (如果没有路径或者目标变了)
        // 这里的判断比较简单，实际项目中可以加 targetId 版本号来判断目标是否改变
        if (sim.path.length === 0) {
            // 如果已经在目标附近 (5px内)，直接吸附并结束
            const distSq = (sim.target.x - sim.pos.x) ** 2 + (sim.target.y - sim.pos.y) ** 2;
            if (distSq < 25) {
                sim.pos.x = sim.target.x;
                sim.pos.y = sim.target.y;
                return true;
            }

            // 生成路径
            sim.path = GameStore.pathFinder.findPath(sim.pos.x, sim.pos.y, sim.target.x, sim.target.y);
            sim.currentPathIndex = 0;

            // 寻路失败处理
            if (sim.path.length === 0) {
                // 如果距离很近但没路（可能在同一格内），尝试直线
                if (distSq < 2500) { 
                    sim.path.push({ x: sim.target.x, y: sim.target.y });
                } else {
                    // 彻底失败，放弃任务，避免原地鬼畜
                    // console.warn(`${sim.name} 寻路失败，放弃目标`);
                    sim.target = null;
                    return true;
                }
            }
        }

        // 3. 沿路径移动
        let distanceToMove = sim.speed * (dt * 0.15); // 时间步长调整
        
        // 速度修正
        if (sim.ageStage === AgeStage.Infant) distanceToMove *= 0.2;
        else if (sim.ageStage === AgeStage.Toddler) distanceToMove *= 0.4;
        else if (sim.ageStage === AgeStage.Elder) distanceToMove *= 0.6;
        if (sim.isPregnant) distanceToMove *= 0.5;

        // 循环消耗移动距离，直到距离耗尽或到达终点
        while (distanceToMove > 0 && sim.currentPathIndex < sim.path.length) {
            const nextNode = sim.path[sim.currentPathIndex];
            
            const dx = nextNode.x - sim.pos.x;
            const dy = nextNode.y - sim.pos.y;
            const distToNode = Math.sqrt(dx * dx + dy * dy);

            if (distToNode <= distanceToMove) {
                // 本帧可以到达该节点：
                // 1. 强制吸附到节点坐标 (消除漂移的关键!)
                sim.pos.x = nextNode.x;
                sim.pos.y = nextNode.y;
                
                // 2. 扣除消耗，准备去下一个节点
                distanceToMove -= distToNode;
                sim.currentPathIndex++;
            } else {
                // 本帧无法到达，只能走一部分
                const ratio = distanceToMove / distToNode;
                sim.pos.x += dx * ratio;
                sim.pos.y += dy * ratio;
                distanceToMove = 0;
            }
        }

        // 4. 终点检查
        if (sim.currentPathIndex >= sim.path.length) {
            // 确保最后精准落在 target 上
            if (sim.target) {
                sim.pos.x = sim.target.x;
                sim.pos.y = sim.target.y;
            }
            sim.path = [];
            sim.target = null;
            return true; // 到达
        }

        return false; // 还在路上
    }
};