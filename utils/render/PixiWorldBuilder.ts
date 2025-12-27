
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

        return container;
    }

    static createFurniture(f: Furniture): Container {
        const container = new Container();
        container.x = f.x;
        container.y = f.y;
        const w = f.w || 48;
        const h = f.h || 48;

        if (f.rotation) {
            container.pivot.set(w / 2, h / 2); 
            container.rotation = (f.rotation * 90 * Math.PI) / 180;
            container.x += w / 2;
            container.y += h / 2;
        }

        if (f.tileSheet && f.tilePos) {
            // [新增] 1. 图集切片渲染逻辑
            
            // 确定要从素材图中切多大 (默认 48x48，如果是 2x2 家具则是 96x96)
            const sliceW = f.tileSize?.w || 48;
            const sliceH = f.tileSize?.h || 48;
            
            // 素材图的基础网格步长 (用于计算 tilePos 对应的像素坐标)
            const GRID_BASE = 48; 

            // 调用 assetLoader 中的切片函数
            const texture = getSlicedTexture(
                f.tileSheet, 
                f.tilePos.x, 
                f.tilePos.y, 
                sliceW, 
                sliceH,
                GRID_BASE
            );
            
            const sprite = new Sprite(texture);
            
            // ✨ 自动缩放：将切片素材 (如 96px) 缩放到游戏物体大小 (如 100px)
            sprite.width = w;
            sprite.height = h;
            
            container.addChild(sprite);

        } else if (f.imagePath && Assets.cache.has(f.imagePath)) {
            // [原有] 2. 单张图片渲染逻辑
            const sprite = Sprite.from(f.imagePath);
            sprite.width = w;
            sprite.height = h;
            container.addChild(sprite);

        } else {
            // [原有] 3. 程序化像素绘制 (兜底)
            const g = new Graphics();
            // 调用 pixelArt.ts 中的逻辑，绘制占位符或程序化图案
            drawPixiFurniture(g, w, h, f);
            container.addChild(g);
        }

        return container;
    }
}
