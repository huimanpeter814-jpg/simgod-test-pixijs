import { SaveMetadata, GameTime, LogEntry, SimData, WorldPlot, RoomDef, Furniture } from '../types';

// 定义完整的存档数据结构
export interface GameSaveData {
    version: number;
    timestamp: number;
    time: GameTime;
    logs: LogEntry[];
    sims: SimData[]; // 存储序列化后的 Sim 数据
    worldLayout: WorldPlot[];
    rooms: RoomDef[];
    customFurniture: Furniture[];
}

// 定义地图导出数据结构
export interface MapData {
    version: string;
    timestamp: number;
    worldLayout: WorldPlot[];
    rooms: RoomDef[];
    customFurniture: Furniture[];
}

export class SaveManager {
    private static STORAGE_PREFIX = 'simgod_save_';

    /**
     * 获取所有存档位的元数据
     */
    static getSaveSlots(): (SaveMetadata | null)[] {
        const slots: (SaveMetadata | null)[] = [];
        for (let i = 1; i <= 5; i++) {
            try {
                const json = localStorage.getItem(`${this.STORAGE_PREFIX}${i}`);
                if (json) {
                    const data = JSON.parse(json);
                    // 简单的完整性检查
                    if (data.timestamp && data.time) {
                        slots.push({
                            slot: i,
                            timestamp: data.timestamp,
                            timeLabel: `Y${data.time.year || 1} M${data.time.month || 1}`,
                            pop: data.sims?.length || 0,
                            realTime: new Date(data.timestamp).toLocaleString()
                        });
                    } else {
                        slots.push(null);
                    }
                } else {
                    slots.push(null);
                }
            } catch (e) {
                console.warn(`[SaveManager] Failed to read slot ${i}`, e);
                slots.push(null);
            }
        }
        return slots;
    }

    /**
     * 保存游戏到指定槽位
     */
    static saveToSlot(slotIndex: number, data: GameSaveData): boolean {
        try {
            const json = JSON.stringify(data);
            localStorage.setItem(`${this.STORAGE_PREFIX}${slotIndex}`, json);
            console.log(`[SaveManager] Saved to slot ${slotIndex}, size: ${(json.length / 1024).toFixed(2)} KB`);
            return true;
        } catch (e) {
            console.error("[SaveManager] Save failed:", e);
            return false;
        }
    }

    /**
     * 从指定槽位加载游戏数据
     * @returns 解析后的数据对象，如果失败则返回 null
     */
    static loadFromSlot(slotIndex: number): GameSaveData | null {
        try {
            const json = localStorage.getItem(`${this.STORAGE_PREFIX}${slotIndex}`);
            if (!json) return null;
            
            const data = JSON.parse(json) as GameSaveData;
            
            // 基础数据校验
            if (!data.worldLayout || !data.sims || !data.time) {
                console.error("[SaveManager] Save file is corrupted (missing critical fields)");
                return null;
            }

            return data;
        } catch (e) {
            console.error("[SaveManager] Load failed:", e);
            return null;
        }
    }

    /**
     * 删除存档
     */
    static deleteSlot(slotIndex: number): void {
        localStorage.removeItem(`${this.STORAGE_PREFIX}${slotIndex}`);
    }

    /**
     * 验证并解析导入的地图数据
     */
    static parseMapData(json: any): MapData | null {
        // 宽松检查：只要有 worldLayout 数组即可视为有效
        if (!json || typeof json !== 'object' || !Array.isArray(json.worldLayout)) {
            console.error("[SaveManager] Invalid map data format");
            return null;
        }

        return {
            version: json.version || "1.0",
            timestamp: json.timestamp || Date.now(),
            worldLayout: json.worldLayout,
            rooms: Array.isArray(json.rooms) ? json.rooms : [],
            customFurniture: Array.isArray(json.customFurniture) ? json.customFurniture : []
        };
    }
}