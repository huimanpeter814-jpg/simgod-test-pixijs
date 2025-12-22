import { CONFIG } from '../constants';

interface Node {
    x: number;
    y: number;
    g: number;
    h: number;
    f: number;
    parent: Node | null;
}

export class PathFinder {
    grid: number[][]; 
    cellSize: number;
    cols: number;
    rows: number;

    constructor(width: number, height: number, cellSize: number = 20) {
        this.cellSize = cellSize;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        this.grid = [];
        this.clear();
    }

    clear() {
        this.grid = Array(this.rows).fill(0).map(() => Array(this.cols).fill(0));
    }

    setObstacle(x: number, y: number, w: number, h: number) {
        const startCol = Math.max(0, Math.floor(x / this.cellSize));
        const endCol = Math.min(this.cols - 1, Math.floor((x + w) / this.cellSize));
        const startRow = Math.max(0, Math.floor(y / this.cellSize));
        const endRow = Math.min(this.rows - 1, Math.floor((y + h) / this.cellSize));

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                this.grid[r][c] = 1;
            }
        }
    }

    toGrid(val: number) { return Math.floor(val / this.cellSize); }
    toWorld(gridIdx: number) { return gridIdx * this.cellSize + this.cellSize / 2; }

    // Bresenham-based Line of Sight check
    // 检测两点之间是否有障碍物，用于路径平滑 (String Pulling)
    isLineClear(x0: number, y0: number, x1: number, y1: number): boolean {
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        let x = x0;
        let y = y0;

        let loops = 0;
        const maxLoops = 1000; // 防止极端情况死循环

        while (true) {
            if (loops++ > maxLoops) return false;

            // 检查当前格子是否是障碍物
            if (x < 0 || x >= this.cols || y < 0 || y >= this.rows || this.grid[y][x] === 1) {
                return false;
            }

            if (x === x1 && y === y1) break;

            let e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
        return true;
    }

    findPath(startX: number, startY: number, endX: number, endY: number): { x: number, y: number }[] {
        const startNode: Node = { 
            x: this.toGrid(startX), y: this.toGrid(startY), 
            g: 0, h: 0, f: 0, parent: null 
        };
        const endNode = { x: this.toGrid(endX), y: this.toGrid(endY) };

        if (startNode.x < 0 || startNode.x >= this.cols || startNode.y < 0 || startNode.y >= this.rows) return [];
        
        // 钳制终点到地图范围内
        endNode.x = Math.max(0, Math.min(this.cols - 1, endNode.x));
        endNode.y = Math.max(0, Math.min(this.rows - 1, endNode.y));

        // 如果终点是障碍物，搜索附近的可用点
        if (this.grid[endNode.y][endNode.x] === 1) {
            let found = false;
            for (let r = 1; r <= 5; r++) {
                for (let dy = -r; dy <= r; dy++) {
                    for (let dx = -r; dx <= r; dx++) {
                        const nx = endNode.x + dx;
                        const ny = endNode.y + dy;
                        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows && this.grid[ny][nx] === 0) {
                            endNode.x = nx; endNode.y = ny;
                            found = true; break;
                        }
                    }
                    if (found) break;
                }
                if (found) break;
            }
            if (!found) return []; 
        }

        const openList: Node[] = [startNode];
        const closedSet = new Int8Array(this.cols * this.rows);
        let ops = 0;
        const MAX_OPS = 5000;

        let finalNode: Node | null = null;

        while (openList.length > 0) {
            ops++;
            if (ops > MAX_OPS) return []; 

            // 简单的优先队列查找
            let lowestIdx = 0;
            for (let i = 1; i < openList.length; i++) {
                if (openList[i].f < openList[lowestIdx].f) {
                    lowestIdx = i;
                }
            }
            
            const current = openList[lowestIdx];
            openList[lowestIdx] = openList[openList.length - 1];
            openList.pop();

            const gridIdx = current.y * this.cols + current.x;
            if (closedSet[gridIdx]) continue;
            closedSet[gridIdx] = 1;

            if (current.x === endNode.x && current.y === endNode.y) {
                finalNode = current;
                break; 
            }

            const neighbors = [
                { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
                { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
            ];

            for (let i = 0; i < neighbors.length; i++) {
                const nx = current.x + neighbors[i].x;
                const ny = current.y + neighbors[i].y;

                if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue;
                if (this.grid[ny][nx] === 1) continue;
                if (closedSet[ny * this.cols + nx]) continue;

                // 避免穿墙 (斜向移动时，如果两侧都是墙则不能通过)
                const isDiag = neighbors[i].x !== 0 && neighbors[i].y !== 0;
                if (isDiag) {
                    if (this.grid[current.y][nx] === 1 || this.grid[ny][current.x] === 1) continue;
                }

                const gScore = current.g + (isDiag ? 1.414 : 1);
                const existing = openList.find(n => n.x === nx && n.y === ny);

                if (!existing) {
                    const h = Math.abs(nx - endNode.x) + Math.abs(ny - endNode.y);
                    openList.push({ x: nx, y: ny, g: gScore, h: h, f: gScore + h, parent: current });
                } else if (gScore < existing.g) {
                    existing.g = gScore;
                    existing.f = gScore + existing.h;
                    existing.parent = current;
                }
            }
        }

        if (!finalNode) return [];

        // === 核心优化：基于视线的路径平滑 (String Pulling / Line-of-Sight Smoothing) ===
        // 1. 重构完整路径 (Grid Nodes)
        const fullGridPath: Node[] = [];
        let curr: Node | null = finalNode;
        while (curr) {
            fullGridPath.push(curr);
            curr = curr.parent;
        }
        fullGridPath.reverse(); // Start -> Goal

        if (fullGridPath.length <= 2) {
            return [{ x: this.toWorld(fullGridPath[fullGridPath.length-1].x), y: this.toWorld(fullGridPath[fullGridPath.length-1].y) }];
        }

        // 2. 视线检查平滑 (Greedy String Pulling)
        const smoothedGridNodes: Node[] = [fullGridPath[0]];
        let checkNode = fullGridPath[0];
        let currentIdx = 0;

        // 贪心算法：从当前点开始，尽量连接到最远的可见点
        while (currentIdx < fullGridPath.length - 1) {
            let furthestVisibleIdx = currentIdx + 1;
            
            // 向后查找最远可见节点
            for (let i = currentIdx + 2; i < fullGridPath.length; i++) {
                const targetNode = fullGridPath[i];
                // 如果两点之间无障碍，则可以直达
                if (this.isLineClear(checkNode.x, checkNode.y, targetNode.x, targetNode.y)) {
                    furthestVisibleIdx = i;
                } else {
                    // 一旦被阻挡，后面的即使在直线上也没用（因为中间有断点）
                    // 除非路径绕回来了，但简单贪心通常只看连续性
                    // 对于网格路径，一旦视线被挡，就可以停止向后搜索了
                    break;
                }
            }

            const nextNode = fullGridPath[furthestVisibleIdx];
            smoothedGridNodes.push(nextNode);
            
            checkNode = nextNode;
            currentIdx = furthestVisibleIdx;
        }

        // 3. 转换为世界坐标 (去掉起点，因为 Sim 已经在起点)
        // 返回的是剩下的路径点队列
        return smoothedGridNodes.slice(1).map(n => ({
            x: this.toWorld(n.x),
            y: this.toWorld(n.y)
        }));
    }
}