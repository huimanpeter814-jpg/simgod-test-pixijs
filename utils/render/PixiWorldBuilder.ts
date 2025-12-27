import { Container, Graphics, Sprite, Assets, Texture } from 'pixi.js';
import { Furniture, RoomDef } from '../../types';
import { drawPixiFurniture } from './pixelArt'; 
import { getTexture, getSlicedTexture } from '../assetLoader';

export class PixiWorldBuilder {
    
    /**
     * 创建房间/地板
     * 注意：地板通常应位于所有家具和角色的下方。
     * 建议在父级容器中将地板层单独置于底部，或者给予极低的 zIndex。
     */
    static createRoom(room: RoomDef): Container {
        const container = new Container();
        // 容器定位
        container.x = room.x;
        container.y = room.y;
        
        // ✨ 设置极低的 Z-Index，确保地板永远在家具和人下面
        // (前提是它们在同一个 sortableChildren = true 的父容器中)
        container.zIndex = -99999; 

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
            
            container.addChild(sprite);
        } 
        else {
            // 绘制程序化地板
            g.rect(0, 0, w, h).fill(room.color || '#cccccc');

            const pattern = room.pixelPattern || '';
            if (pattern.includes('wood')) {
                for (let i = 20; i < w; i += 20) g.moveTo(i, 0).lineTo(i, h).stroke({ width: 1, color: 'rgba(0,0,0,0.05)' });
            } else if (pattern.includes('tile')) {
                for (let i = 0; i < w; i += 30) g.moveTo(i, 0).lineTo(i, h).stroke({ width: 1, color: 'rgba(255,255,255,0.15)' });
                for (let j = 0; j < h; j += 30) g.moveTo(0, j).lineTo(w, j).stroke({ width: 1, color: 'rgba(255,255,255,0.15)' });
            }

            if (room.hasWall) {
                // 地板边缘线 (原来的墙体)，在2.5D中可能仅作为地基轮廓
                g.rect(0, 0, w, h).stroke({ width: 4, color: 0x5a6572 });
            }

            container.addChild(g);
        }

        return container;
    }

    /**
     * 创建家具 (包括墙体、装饰物等)
     * 支持 2.5D 遮挡排序和多方向贴图
     */
    static createFurniture(f: Furniture): Container {
        const container = new Container();
        
        // 1. 基础定位 (逻辑网格坐标)
        container.x = f.x;
        container.y = f.y;

        // ==========================================
        // ✨ 2.5D 核心：Y-Sorting (遮挡关系)
        // ==========================================
        // 物体的层级由“脚底”坐标决定。
        // f.y 是顶部，f.h 是高度，所以 f.y + f.h 是物体在地面上的基座位置。
        // 越靠下 (Y值越大) 的物体，zIndex 应该越大，从而遮挡后面的物体。
        const bottomY = f.y + f.h;
        container.zIndex = bottomY;

        // 3. 确定当前方向 (0:Front, 1:Left, 2:Back, 3:Right)
        const dir = f.rotation || 0;

        // 4. 计算图集坐标
        // 使用 any 断言访问 types.ts 中新增的字段，防止未更新类型定义导致的报错
        const fAny = f as any;

        // ==========================================
        // 🟢 分支 A: 使用 TexturePacker 图集
        // ==========================================
        
        // 1. 确定最终要用的图片名
        let targetFrameName = fAny.frameName;

        // ✨ 如果有方向映射配置，优先使用方向对应的名字
        if (fAny.frameDirs && fAny.frameDirs[dir]) {
            targetFrameName = fAny.frameDirs[dir];
        }

        // 2. 尝试获取纹理
        if (targetFrameName) {
            const texture = getTexture(targetFrameName);
            
            if (texture !== Texture.EMPTY) {
                const sprite = new Sprite(texture);

                // ... (尺寸和偏移逻辑同之前) ...
                const visualWidth = texture.width; 
                const visualHeight = texture.height;
                const yOffset = f.h - visualHeight;

                sprite.width = visualWidth;
                sprite.height = visualHeight;
                sprite.y = yOffset;

                // ✨ [进阶] 简单的镜像翻转处理
                // 如果你为了省资源，左右方向复用了同一张图 (比如 sofa_side.png)，
                // 你可以在这里判断 dir === 3 时设置 sprite.scale.x = -1 并调整 anchor 或 x 坐标。
                // 简单起见，建议初期先为每个方向打包独立的图片。

                container.addChild(sprite);
                return container;
            }
        }
        
        let tileX = f.tilePos ? f.tilePos.x : 0;
        let tileY = f.tilePos ? f.tilePos.y : 0;
        let useTile = false;

        // 优先级 A: 显式映射模式 (tilePosDir)
        // 适用于：不同方向的素材散落在图集的不同位置，不连续
        if (fAny.tilePosDir && fAny.tilePosDir[dir]) {
            tileX = fAny.tilePosDir[dir].x;
            tileY = fAny.tilePosDir[dir].y;
            useTile = true;
        } 
        // 优先级 B: 连续排列模式 (hasDirectionalSprites)
        // 适用于：图集里按 [正, 左, 后, 右] 顺序横向紧挨着排列
        else if (fAny.hasDirectionalSprites && f.tilePos) {
            tileX += dir; // 横向偏移
            useTile = true;
        } 
        // 优先级 C: 单图模式
        // 适用于：不随旋转改变样子的物体 (或者还没画其他方向)
        else if (f.tilePos) {
            useTile = true;
        }

        // ==========================================
        // 5. 渲染 Sprite
        // ==========================================
        if (f.tileSheet && useTile) {
            // 逻辑尺寸 (占地面积)
            const logicalW = f.w;
            const logicalH = f.h;

            // 视觉尺寸 (图片实际显示大小)
            // 如果定义了 textureHeight (如墙体、树木)，则使用它，否则默认等于占地高度
            const visualWidth = logicalW; 
            const visualHeight = fAny.textureHeight || logicalH;
            
            // ✨ 垂直偏移计算
            // 我们需要将 Sprite 向上移动，使得 Sprite 的底部边缘与 逻辑占地(h) 的底部重合。
            // 偏移量 = 逻辑高度 - 视觉高度
            // 例：树占地 48，高 96。偏移 = 48 - 96 = -48 (向上移一格)
            const yOffset = logicalH - visualHeight;

            // 获取切片
            // 注意：墙体素材的 tileSize.h 可能是 96，而 f.h 依然是 48
            const sliceW = f.tileSize?.w || 48;
            const sliceH = f.tileSize?.h || 48; 

            const texture = getSlicedTexture(
                f.tileSheet, 
                tileX, 
                tileY, 
                sliceW, 
                sliceH
            );
            
            const sprite = new Sprite(texture);
            
            // 设置显示大小
            sprite.width = visualWidth;
            sprite.height = visualHeight;
            
            // 应用垂直偏移，实现“站立”在格子上
            sprite.y = yOffset;
            
            container.addChild(sprite);

        } else if (f.imagePath && Assets.cache.has(f.imagePath)) {
            // [原有兼容] 单张图片渲染
            const sprite = Sprite.from(f.imagePath);
            sprite.width = f.w;
            sprite.height = f.h;
            container.addChild(sprite);

        } else {
            // [兜底] 调试用 / 程序化绘制
            const g = new Graphics();
            
            // 同样应用视觉高度逻辑
            const visualHeight = fAny.textureHeight || f.h;
            const yOffset = f.h - visualHeight;

            // 绘制主体矩形
            g.rect(0, yOffset, f.w, visualHeight);
            g.fill(f.color || 0xAAAAAA);
            g.stroke({ width: 2, color: 0x333333 });

            // 绘制方向箭头 (辅助调试)
            const cx = f.w / 2;
            const cy = yOffset + visualHeight / 2;
            
            g.beginPath();
            g.moveTo(cx, cy);
            if (dir === 0) g.lineTo(cx, cy + 15);      // 下 (前)
            else if (dir === 1) g.lineTo(cx - 15, cy); // 左
            else if (dir === 2) g.lineTo(cx, cy - 15); // 上 (后)
            else if (dir === 3) g.lineTo(cx + 15, cy); // 右
            g.stroke({ width: 3, color: 0xFF5555 });

            // (可选) 如果你还想保留程序化绘制逻辑，可以放开下面这行
            // drawPixiFurniture(g, f.w, f.h, f);

            container.addChild(g);
        }

        return container;
    }
}