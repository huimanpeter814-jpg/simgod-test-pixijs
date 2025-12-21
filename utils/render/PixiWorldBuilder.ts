import { Container, Graphics, Sprite, Assets } from 'pixi.js';
import { Furniture, RoomDef } from '../../types';
import { drawPixiFurniture } from './pixelArt'; // 确保这里引入了 pixelArt

export class PixiWorldBuilder {
    
    static createRoom(room: RoomDef): Graphics {
        const g = new Graphics();
        const w = room.w || 100;
        const h = room.h || 100;

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

        g.x = room.x;
        g.y = room.y;
        return g;
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

        // 优先使用图片，如果没有则使用 PixelArt 绘制
        if (f.imagePath && Assets.cache.has(f.imagePath)) {
            const sprite = Sprite.from(f.imagePath);
            sprite.width = w;
            sprite.height = h;
            container.addChild(sprite);
        } else {
            const g = new Graphics();
            // 调用 pixelArt.ts 中的逻辑，绘制真正的家具图案
            drawPixiFurniture(g, w, h, f);
            container.addChild(g);
        }

        return container;
    }
}