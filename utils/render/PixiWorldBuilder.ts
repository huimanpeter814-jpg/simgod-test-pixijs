import { Container, Graphics, Sprite, Texture, Assets } from 'pixi.js';
import { Furniture, RoomDef } from '../../types';
import { drawPixelProp } from './pixelArt'; 

export class PixiWorldBuilder {
    
    private static textureCache = new Map<string, Texture>();

    // --- A. 创建地板 ---
    static createRoom(room: RoomDef): Graphics {
        const g = new Graphics();
        const w = room.w || 100;
        const h = room.h || 100;

        // 基础颜色填充
        g.rect(0, 0, w, h);
        g.fill({ color: room.color || '#cccccc' });

        // 简单的纹理效果 (优化版)
        if (room.pixelPattern?.includes('wood')) {
            // 横线条纹
            for (let i = 0; i < w; i += 20) {
                g.moveTo(i, 0).lineTo(i, h).stroke({ width: 1, color: 0x000000, alpha: 0.05 });
            }
        } else if (room.pixelPattern?.includes('tile')) {
            // 瓷砖网格
            for (let i = 0; i < w; i += 30) g.moveTo(i, 0).lineTo(i, h).stroke({ width: 1, color: 0xffffff, alpha: 0.15 });
            for (let j = 0; j < h; j += 30) g.moveTo(0, j).lineTo(w, j).stroke({ width: 1, color: 0xffffff, alpha: 0.15 });
        }

        if (room.hasWall) {
            g.rect(0, 0, w, h).stroke({ width: 4, color: 0x5a6572 });
        }

        g.x = room.x;
        g.y = room.y;
        return g;
    }

    // --- B. 创建家具 (带缓存的高性能渲染) ---
    static createFurniture(f: Furniture): Container {
        const container = new Container();
        container.x = f.x;
        container.y = f.y;
        const w = f.w || 50;
        const h = f.h || 50;

        // 旋转支持
        if (f.rotation) {
            const cx = w / 2;
            const cy = h / 2;
            container.pivot.set(cx, cy); 
            container.rotation = (f.rotation * 90 * Math.PI) / 180;
            // 旋转后由于Pivot变了，需要补偿坐标
            container.x += cx;
            container.y += cy;
        }

        // 1. 优先使用图片资源 (如果有且已加载)
        if (f.imagePath && Assets.cache.has(f.imagePath)) {
            const sprite = Sprite.from(f.imagePath);
            sprite.width = w;
            sprite.height = h;
            container.addChild(sprite);
        } 
        // 2. 否则使用程序化像素绘制 (Canvas -> Texture)
        else {
            // 缓存 Key 包含所有外观属性，防止复用错误
            const cacheKey = `${f.utility}_${f.pixelPattern}_${f.color}_${w}x${h}_${f.label}`;
            let texture = this.textureCache.get(cacheKey);

            if (!texture) {
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    const dummyPalette = { furniture_shadow: 'rgba(0,0,0,0.2)' };
                    // 临时对象用于绘制，位置设为0
                    const tempF = { ...f, x: 0, y: 0, w, h, rotation: 0 }; 
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
                // 极简兜底：色块
                const g = new Graphics();
                g.rect(0, 0, w, h).fill({ color: f.color || '#999' });
                container.addChild(g);
            }
        }

        // 注意：ZIndex 将在 PixiGameCanvas 中统一设置 (furn.y + furn.h)
        // 这里不需要设置 container.zIndex，交给外部排序逻辑
        return container;
    }
}