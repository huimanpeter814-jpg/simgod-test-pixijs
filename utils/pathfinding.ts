import { CONFIG } from '../constants';
import { Furniture } from '../types';

interface Node {
    x: number;
    y: number;
    g: number;
    h: number;
    f: number;
    parent: Node | null;
}

export function isWalkable(x: number, y: number, furniture: Furniture[]): boolean {
    // 1. 检查是否有家具/墙体占据了这个坐标
    // 注意：这里只检查家具的“基座”范围
    for (const f of furniture) {
        // 简单的 AABB 碰撞
        if (x >= f.x && x < f.x + f.w &&
            y >= f.y && y < f.y + f.h) {
             
            // 如果是墙或者不可穿过的家具
            if (f.isWall || f.utility !== 'rug') { 
                return false; 
            }
        }
    }
    return true;
}

export class PathFinder {
    grid: Int8Array; // 使用一维数组优化性能
    cellSize: number;
    cols: number;
    rows: number;

    constructor(width: number, height: number, cellSize: number = 20) {
        this.cellSize = cellSize;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        this.grid = new Int8Array(this.cols * this.rows);
        this.clear();
    }

    clear() {
        this.grid.fill(0);
    }

    // 标记障碍物
    setObstacle(x: number, y: number, w: number, h: number) {
        const startCol = Math.max(0, Math.floor(x / this.cellSize));
        const endCol = Math.min(this.cols - 1, Math.floor((x + w) / this.cellSize));
        const startRow = Math.max(0, Math.floor(y / this.cellSize));
        const endRow = Math.min(this.rows - 1, Math.floor((y + h) / this.cellSize));

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                this.grid[r * this.cols + c] = 1;
            }
        }
    }

    // 坐标转换
    toGrid(val: number) { return Math.floor(val / this.cellSize); }
    toWorld(gridIdx: number) { return gridIdx * this.cellSize + this.cellSize / 2; }
    
    // 检查网格是否可行走
    isWalkable(c: number, r: number): boolean {
        if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return false;
        return this.grid[r * this.cols + c] === 0;
    }

    // 寻找最近的可行走节点 (用于处理起点/终点在障碍物内的情况)
    findNearestWalkable(x: number, y: number, range: number = 5): { x: number, y: number } | null {
        if (this.isWalkable(x, y)) return { x, y };

        // 螺旋搜索
        for (let r = 1; r <= range; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    // 只检查边框
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    
                    const nx = x + dx;
                    const ny = y + dy;
                    if (this.isWalkable(nx, ny)) return { x: nx, y: ny };
                }
            }
        }
        return null;
    }

    findPath(startX: number, startY: number, endX: number, endY: number): { x: number, y: number }[] {
        let gridStartX = this.toGrid(startX);
        let gridStartY = this.toGrid(startY);
        let gridEndX = this.toGrid(endX);
        let gridEndY = this.toGrid(endY);

        // 1. 修正起点和终点
        const validStart = this.findNearestWalkable(gridStartX, gridStartY);
        const validEnd = this.findNearestWalkable(gridEndX, gridEndY);

        if (!validStart || !validEnd) return []; // 彻底卡死

        gridStartX = validStart.x;
        gridStartY = validStart.y;
        gridEndX = validEnd.x;
        gridEndY = validEnd.y;

        // 如果已经在同一个格子里，直接返回直线
        if (gridStartX === gridEndX && gridStartY === gridEndY) {
            return [{ x: endX, y: endY }];
        }

        // A* 核心数据结构
        const openList: Node[] = [];
        const openMap = new Map<number, Node>(); // 快速查找
        const closedSet = new Set<number>();

        const startNode: Node = { x: gridStartX, y: gridStartY, g: 0, h: 0, f: 0, parent: null };
        openList.push(startNode);
        openMap.set(gridStartY * this.cols + gridStartX, startNode);

        // 曼哈顿距离启发函数
        const heuristic = (n1: {x:number, y:number}, n2: {x:number, y:number}) => {
            return Math.abs(n1.x - n2.x) + Math.abs(n1.y - n2.y);
        };

        const MAX_OPS = 15000; // 降低迭代上限，防止掉帧
        let ops = 0;

        let finalNode: Node | null = null;

        while (openList.length > 0) {
            ops++;
            if (ops > MAX_OPS) return []; // 寻路超时，返回空路径让AI重试

            // 简单的优先队列模拟 (寻找 f 最小)
            let lowestIdx = 0;
            for (let i = 1; i < openList.length; i++) {
                if (openList[i].f < openList[lowestIdx].f) lowestIdx = i;
            }
            
            const current = openList[lowestIdx];
            
            // 找到终点
            if (current.x === gridEndX && current.y === gridEndY) {
                finalNode = current;
                break;
            }

            // 移出 OpenList，加入 ClosedSet
            openList.splice(lowestIdx, 1);
            const currentKey = current.y * this.cols + current.x;
            openMap.delete(currentKey);
            closedSet.add(currentKey);

            // 邻居偏移 (八方向)
            const neighbors = [
                { x: 0, y: -1, cost: 1 }, { x: 0, y: 1, cost: 1 }, 
                { x: -1, y: 0, cost: 1 }, { x: 1, y: 0, cost: 1 },
                // 对角线代价稍微调高，鼓励走直线 (1.414 -> 1.5)
                { x: -1, y: -1, cost: 1.5 }, { x: 1, y: -1, cost: 1.5 }, 
                { x: -1, y: 1, cost: 1.5 }, { x: 1, y: 1, cost: 1.5 }
            ];

            for (const offset of neighbors) {
                const nx = current.x + offset.x;
                const ny = current.y + offset.y;
                const nKey = ny * this.cols + nx;

                if (!this.isWalkable(nx, ny)) continue;
                if (closedSet.has(nKey)) continue;

                // 防止穿墙 (如果对角线两边都是障碍物，则不能走对角)
                if (offset.x !== 0 && offset.y !== 0) {
                    if (!this.isWalkable(current.x + offset.x, current.y) || 
                        !this.isWalkable(current.x, current.y + offset.y)) {
                        continue;
                    }
                }

                const gScore = current.g + offset.cost;
                const existing = openMap.get(nKey);

                if (!existing) {
                    const h = heuristic({x: nx, y: ny}, {x: gridEndX, y: gridEndY});
                    const newNode: Node = { x: nx, y: ny, g: gScore, h: h, f: gScore + h, parent: current };
                    openList.push(newNode);
                    openMap.set(nKey, newNode);
                } else if (gScore < existing.g) {
                    existing.g = gScore;
                    existing.f = gScore + existing.h;
                    existing.parent = current;
                }
            }
        }

        if (!finalNode) return [];

        // 回溯路径
        const path: { x: number, y: number }[] = [];
        let curr: Node | null = finalNode;
        while (curr) {
            // 转换为世界坐标中心点
            path.push({ x: this.toWorld(curr.x), y: this.toWorld(curr.y) });
            curr = curr.parent;
        }

        // 反转并保留终点精确位置
        path.reverse();
        
        // 将最后一个节点替换为实际的 endX, endY (确保能点对点到达)
        path[path.length - 1] = { x: endX, y: endY };

        // 路径平滑 (仅移除共线点，不做激进优化以免穿墙)
        return this.smoothPath(path);
    }

    smoothPath(path: { x: number, y: number }[]): { x: number, y: number }[] {
        if (path.length <= 2) return path;

        const smoothed: { x: number, y: number }[] = [path[0]];
        let lastDirX = 0;
        let lastDirY = 0;

        for (let i = 1; i < path.length; i++) {
            const dx = path[i].x - path[i-1].x;
            const dy = path[i].y - path[i-1].y;

            // 简单的方向检查，如果方向改变了，就保留拐点
            if (i === 1 || Math.abs(dx - lastDirX) > 0.01 || Math.abs(dy - lastDirY) > 0.01) {
                smoothed.push(path[i-1]); // 保留上一个点作为拐点
            }
            
            lastDirX = dx;
            lastDirY = dy;
        }
        smoothed.push(path[path.length - 1]);
        
        // 去重
        return smoothed.filter((p, i) => i === 0 || p.x !== smoothed[i-1].x || p.y !== smoothed[i-1].y);
    }
}