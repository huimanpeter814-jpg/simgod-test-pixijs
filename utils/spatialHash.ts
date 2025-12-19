import { CONFIG } from '../constants';

export interface SpatialItem {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    type: 'sim' | 'furniture' | 'room';
    ref: any; // 原始对象的引用
}

export class SpatialHashGrid {
    cellSize: number;
    cols: number;
    rows: number;
    buckets: Map<string, SpatialItem[]>;

    constructor(cellSize: number = 100) {
        this.cellSize = cellSize;
        this.cols = Math.ceil(CONFIG.CANVAS_W / cellSize);
        this.rows = Math.ceil(CONFIG.CANVAS_H / cellSize);
        this.buckets = new Map();
    }

    private getKey(col: number, row: number): string {
        return `${col},${row}`;
    }

    // 清空网格 (通常用于动态物体每帧重置)
    clear() {
        this.buckets.clear();
    }

    // 添加一个物体到网格 (一个物体可能跨越多个格子)
    insert(item: SpatialItem) {
        const startCol = Math.floor(item.x / this.cellSize);
        const endCol = Math.floor((item.x + item.w) / this.cellSize);
        const startRow = Math.floor(item.y / this.cellSize);
        const endRow = Math.floor((item.y + item.h) / this.cellSize);

        for (let c = startCol; c <= endCol; c++) {
            for (let r = startRow; r <= endRow; r++) {
                const key = this.getKey(c, r);
                if (!this.buckets.has(key)) {
                    this.buckets.set(key, []);
                }
                this.buckets.get(key)!.push(item);
            }
        }
    }

    // 查找特定点所在的格子里的所有物体
    query(x: number, y: number): SpatialItem[] {
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        const key = this.getKey(col, row);
        return this.buckets.get(key) || [];
    }

    // 查找一个矩形范围内的所有物体 (用于区域查询)
    queryRect(x: number, y: number, w: number, h: number): SpatialItem[] {
        const startCol = Math.floor(x / this.cellSize);
        const endCol = Math.floor((x + w) / this.cellSize);
        const startRow = Math.floor(y / this.cellSize);
        const endRow = Math.floor((y + h) / this.cellSize);

        const results = new Set<SpatialItem>(); // 使用 Set 去重

        for (let c = startCol; c <= endCol; c++) {
            for (let r = startRow; r <= endRow; r++) {
                const key = this.getKey(c, r);
                const items = this.buckets.get(key);
                if (items) {
                    items.forEach(item => results.add(item));
                }
            }
        }
        return Array.from(results);
    }
    
    // 专门用于鼠标点击检测 (精准碰撞)
    queryHit(x: number, y: number): SpatialItem | null {
        const nearby = this.query(x, y);
        // 在附近的物体中进行精确的矩形碰撞检测
        // 优先返回 Sims (覆盖在家具之上)
        
        // 1. Check Sims
        const hitSim = nearby.find(item => 
            item.type === 'sim' &&
            x >= item.x && x <= item.x + item.w &&
            y >= item.y && y <= item.y + item.h
        );
        if (hitSim) return hitSim;

        // 2. Check Furniture
        const hitFurn = nearby.find(item => 
            item.type === 'furniture' &&
            x >= item.x && x <= item.x + item.w &&
            y >= item.y && y <= item.y + item.h
        );
        return hitFurn || null;
    }
}