
import { Container, Graphics, Sprite, Assets, Text } from 'pixi.js';
import { Furniture, RoomDef } from '../../types';
import { drawPixiFurniture } from './pixelArt'; 
import { getSlicedTexture } from '../assetLoader';

export class PixiWorldBuilder {
    
    static createRoom(room: RoomDef): Container {
        const container = new Container();
        // 容器定位
        container.x = room.x;
        container.y = room.y;

        const g = new Graphics();
        const w = room.w || 100;
        const h = room.h || 100;

        if (room.sheetPath) {
        // 1. 获取纹理
        const texture = getSlicedTexture(
            room.sheetPath, 
            room.tileX || 0, 
            room.tileY || 0,
            room.tileW || 48,
            room.tileH || 48
        );
        
        // 2. 创建 Sprite
        const sprite = new Sprite(texture);
        
        // 3. 设置尺寸 (直接拉伸填满地块)
        sprite.width = w;
        sprite.height = h;
        
        // 4. (可选) 如果你想用平铺模式而不是拉伸，可以用 TilingSprite
        // import { TilingSprite } from 'pixi.js';
        // const sprite = new TilingSprite(texture, w, h);
        
        container.addChild(sprite);
        } 
        else {

            // 绘制地板
            g.rect(0, 0, w, h).fill(room.color || '#cccccc');

            const pattern = room.pixelPattern || '';
            if (pattern.includes('wood')) {
                for (let i = 20; i < w; i += 20) g.moveTo(i, 0).lineTo(i, h).stroke({ width: 1, color: 'rgba(0,0,0,0.05)' });
            } else if (pattern.includes('tile')) {
                for (let i = 0; i < w; i += 30) g.moveTo(i, 0).lineTo(i, h).stroke({ width: 1, color: 'rgba(255,255,255,0.15)' });
                for (let j = 0; j < h; j += 30) g.moveTo(0, j).lineTo(w, j).stroke({ width: 1, color: 'rgba(255,255,255,0.15)' });
            }

            if (room.hasWall) {
                g.rect(0, 0, w, h).stroke({ width: 4, color: 0x5a6572 });
            }

            // 将图形添加到容器
            container.addChild(g);
        }

        // ✨ 新增：显示地块名称
        if (room.label && !room.label.startsWith('空地')) {
            const text = new Text({
                text: room.label,
                style: {
                    fontFamily: '"Microsoft YaHei", sans-serif',
                    fontSize: 14,
                    fill: 0xffffff,
                    align: 'center',
                    stroke: { color: 0x000000, width: 3 }, // 描边增加可读性
                    fontWeight: 'bold',
                }
            });
            text.anchor.set(0.5); // 中心对齐
            text.x = w / 2;
            text.y = h / 2;
            text.alpha = 0.6; //稍微透明一点，不抢眼
            container.addChild(text);
        }

        return container;
    }

    static createFurniture(f: Furniture): Container {
        const container = new Container();
        container.x = f.x;
        container.y = f.y;
        const w = f.w || 50;
        const h = f.h || 50;

        if (f.rotation) {
            container.pivot.set(w / 2, h / 2); 
            container.rotation = (f.rotation * 90 * Math.PI) / 180;
            container.x += w / 2;
            container.y += h / 2;
        }

        // 🆕 逻辑：优先检查是否是 SpriteSheet 切片
        if (f.sheetPath) {
            // 使用 assetLoader 中的切片函数
            // 默认尺寸设为 48 (符合你的素材规格)
            const texture = getSlicedTexture(
                f.sheetPath, 
                f.tileX || 0, 
                f.tileY || 0, 
                f.tileW || 48, 
                f.tileH || 48
            );
            
            const sprite = new Sprite(texture);
            sprite.width = w;   // 拉伸到家具实际在游戏里的显示大小
            sprite.height = h;
            container.addChild(sprite);
        }
        // 旧逻辑：检查单张大图
        else if (f.imagePath && Assets.cache.has(f.imagePath)) {
            const sprite = Sprite.from(f.imagePath);
            sprite.width = w;
            sprite.height = h;
            container.addChild(sprite);
        } 
        // 兜底：像素画绘制
        else {
            const g = new Graphics();
            drawPixiFurniture(g, w, h, f);
            container.addChild(g);
        }

        return container;
    }
}
