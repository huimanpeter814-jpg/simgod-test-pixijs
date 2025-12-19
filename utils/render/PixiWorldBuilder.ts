import { Container, Graphics, Sprite, Texture, Assets } from 'pixi.js';
import { Furniture, RoomDef } from '../../types';
import { drawPixelProp } from './pixelArt'; // 复用原来的绘图逻辑

export class PixiWorldBuilder {
    
    // 缓存生成的家具纹理，避免重复绘制
    private static textureCache = new Map<string, Texture>();

    // --- A. 创建地板 ---
    static createRoom(room: RoomDef): Graphics {
        const g = new Graphics();
        // 确保 w, h 有值
        const w = room.w || 100;
        const h = room.h || 100;

        g.rect(0, 0, w, h);
        g.fill({ color: room.color || '#cccccc' });

        // 简单的纹理效果 (原本在 GameCanvas 里的逻辑)
        if (room.pixelPattern?.includes('wood')) {
            g.stroke({ width: 1, color: 0x000000, alpha: 0.1 });
            for (let i = 0; i < w; i += 20) {
                g.moveTo(i, 0).lineTo(i, h).stroke({ width: 1, color: 0x000000, alpha: 0.05 });
            }
        } else if (room.pixelPattern?.includes('tile')) {
            g.rect(0, 0, w, h).stroke({ width: 1, color: 0xffffff, alpha: 0.2 });
            for (let i = 0; i < w; i += 30) g.moveTo(i, 0).lineTo(i, h).stroke({ width: 1, color: 0xffffff, alpha: 0.1 });
            for (let j = 0; j < h; j += 30) g.moveTo(0, j).lineTo(w, j).stroke({ width: 1, color: 0xffffff, alpha: 0.1 });
        }

        // 墙壁
        if (room.hasWall) {
            g.rect(0, 0, w, h).stroke({ width: 4, color: 0x5a6572 });
        }

        g.x = room.x;
        g.y = room.y;
        return g;
    }

    // --- B. 创建家具 (高保真还原) ---
    static createFurniture(f: Furniture): Container {
        const container = new Container();
        container.x = f.x;
        container.y = f.y;
        const w = f.w || 50;
        const h = f.h || 50;

        // 支持旋转
        if (f.rotation) {
            const cx = w / 2;
            const cy = h / 2;
            container.pivot.set(cx, cy); // 围绕中心旋转
            container.rotation = (f.rotation * 90 * Math.PI) / 180;
            // 修正位置补偿 (因为 pivot 改变了)
            container.x += cx;
            container.y += cy;
        }

        // 1. 尝试使用图片资源
        if (f.imagePath && Assets.cache.has(f.imagePath)) {
            const sprite = Sprite.from(f.imagePath);
            sprite.width = w;
            sprite.height = h;
            container.addChild(sprite);
        } 
        // 2. [核心修复] 使用离屏 Canvas 绘制像素画，找回原来的细节！
        else {
            // 生成一个唯一的缓存 Key (包含所有可能影响外观的属性)
            const cacheKey = `${f.utility}_${f.pixelPattern}_${f.color}_${w}x${h}_${f.label}`;
            let texture = this.textureCache.get(cacheKey);

            if (!texture) {
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    const dummyPalette = { furniture_shadow: 'rgba(0,0,0,0.2)' };
                    // 临时对象，x/y 设为 0 以便在小画布上绘制
                    const tempF = { ...f, x: 0, y: 0, w, h, rotation: 0 }; // 旋转由 Pixi Container 处理，这里设为0
                    try {
                        drawPixelProp(ctx, tempF, dummyPalette as any);
                        texture = Texture.from(canvas);
                        this.textureCache.set(cacheKey, texture);
                    } catch (e) {
                        console.warn("Pixel draw failed", e);
                    }
                }
            }

            if (texture) {
                const sprite = new Sprite(texture);
                container.addChild(sprite);
            } else {
                // 兜底：纯色块
                const g = new Graphics();
                g.rect(0, 0, w, h).fill({ color: f.color || '#999' });
                container.addChild(g);
            }
        }

        container.zIndex = f.y + h; // Y-Sorting 深度排序
        return container;
    }
}