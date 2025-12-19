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

    findPath(startX: number, startY: number, endX: number, endY: number): { x: number, y: number }[] {
        const startNode: Node = { 
            x: this.toGrid(startX), y: this.toGrid(startY), 
            g: 0, h: 0, f: 0, parent: null 
        };
        const endNode = { x: this.toGrid(endX), y: this.toGrid(endY) };

        if (startNode.x < 0 || startNode.x >= this.cols || startNode.y < 0 || startNode.y >= this.rows) return [];
        if (endNode.x < 0 || endNode.x >= this.cols || endNode.y < 0 || endNode.y >= this.rows) return [];

        if (this.grid[endNode.y][endNode.x] === 1) {
            let found = false;
            for (let r = 1; r <= 3; r++) {
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
        const MAX_OPS = 3000;

        let finalNode: Node | null = null;

        while (openList.length > 0) {
            ops++;
            if (ops > MAX_OPS) {
                // 超时降级
                return [{x: endX, y: endY}]; 
            }

            // O(N) 查找最小值
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

        // --- 核心优化：路径平滑 (Path Smoothing) ---
        // 原始路径包含了每一个经过的格子，导致走起来像机器人
        // 我们只保留拐点，去掉中间的直线点
        const rawPath: { x: number, y: number }[] = [];
        let curr: Node | null = finalNode;
        while (curr) {
            rawPath.push({ x: this.toWorld(curr.x), y: this.toWorld(curr.y) });
            curr = curr.parent;
        }
        
        // 如果路径太短，直接返回
        if (rawPath.length <= 2) return rawPath.reverse().slice(1);

        // 简化路径：只保留方向改变的点
        // 注意：rawPath 是从终点到起点的，所以我们反向处理
        const smoothPath: { x: number, y: number }[] = [];
        smoothPath.push(rawPath[0]); // 终点必须保留

        // 从倒数第二个点开始遍历到起点前一个点
        let lastDirX = rawPath[0].x - rawPath[1].x;
        let lastDirY = rawPath[0].y - rawPath[1].y;

        for (let i = 1; i < rawPath.length - 1; i++) {
            const nextNode = rawPath[i+1];
            const currNode = rawPath[i];
            
            const dirX = currNode.x - nextNode.x;
            const dirY = currNode.y - nextNode.y;

            // 如果方向变了，说明这个点是拐点，必须保留
            // 简单的浮点数比较可能不准，但这里坐标都是整数倍，直接比较即可
            if (dirX !== lastDirX || dirY !== lastDirY) {
                smoothPath.push(currNode);
                lastDirX = dirX;
                lastDirY = dirY;
            }
        }
        
        // 此时 smoothPath 还是反向的（终点 -> 拐点 -> ...）
        // 我们不需要把起点加进去，因为 Sim 已经在起点了
        // 直接反转并返回
        return smoothPath.reverse();
    }
}