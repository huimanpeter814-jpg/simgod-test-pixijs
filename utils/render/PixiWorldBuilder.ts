import { Container, Graphics, Sprite, Assets, Texture } from 'pixi.js';
import { Furniture, RoomDef } from '../../types';
import { drawPixiFurniture } from './pixelArt'; 
import { getTexture, getSlicedTexture } from '../assetLoader';
import { GameStore } from '../GameStore';

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

        const fAny = f as any;

        // 使用 any 断言访问 types.ts 中新增的字段 (防止类型未更新导致报错)
        // 默认使用家具本体作为渲染配置
        let visualConfig = fAny;
        
        // 1. 获取当前激活的变体 ID (实例上的 > 默认的 > 第一个变体的)
        const activeVariantId = fAny.currentVariantId || fAny.defaultVariantId;

        // 2. 如果存在变体列表，尝试查找并合并数据
        if (fAny.variants && fAny.variants.length > 0 && activeVariantId) {
            const variant = fAny.variants.find((v: any) => v.id === activeVariantId);
            if (variant) {
                // ✨ 关键：用变体的数据覆盖本体的数据
                // 这样后续代码读取 visualConfig.tilePos 时，读到的就是变体的坐标
                visualConfig = { ...fAny, ...variant };
            }
        }
        
        const dir = f.rotation || 0;

        // ==========================================
        // ✨ [核心逻辑] 2.5D 层级与台面支持
        // ==========================================
        
        let zIndex = f.y + f.h; // 默认：地面物品按底部排序
        let elevationOffset = 0;

        // 2. 检查是否有明确的父子关系 (通过插槽吸附)
        if (fAny.parentId) {
            // 找到父物体
            const parent = GameStore.furniture.find(p => p.id === fAny.parentId);
            
            if (parent) {
                // A. 强制层级：子物体必须比父物体高
                zIndex = (parent.y + parent.h) + 1; 

                // B. 计算高度偏移 (Elevation)
                if (fAny.parentSlotIndex !== undefined && parent.slots && parent.slots[fAny.parentSlotIndex]) {
                    elevationOffset = parent.slots[fAny.parentSlotIndex].height;
                } 
                else if (parent.isSurface) {
                    elevationOffset = parent.surfaceHeight || 30;
                }
            }
        }
        // 3. 兼容旧逻辑：如果没有 parentId，但是是 'surface' 类型 (为了兼容还没重构的旧存档)
        else if (fAny.placementLayer === 'surface') {// 如果这个物品被标记为“放在台面上” (例如 placementLayer === 'surface')
            // 在所有家具中查找：谁在我的正下方，并且是桌子(isSurface)？
            const centerX = f.x + f.w / 2;
            const centerY = f.y + f.h / 2;

            // 这里的判断逻辑是：找到中心点重叠且属于 'isSurface' 的家具
            const supportItem = GameStore.furniture.find(other => 
                other.isSurface && 
                other.id !== f.id && 
                centerX >= other.x && centerX < other.x + other.w &&
                centerY >= other.y && centerY < other.y + other.h
            );
            if (supportItem) {
                // 1. 获取桌子的支撑高度 (如果没有配，默认给个 20)
                elevationOffset = supportItem.surfaceHeight || 20;
                
                // 2. [关键] 强制继承桌子的层级，并微调增加一点点
                // 这样无论桌子在哪，电脑永远会被渲染在桌子之后(之上)
                zIndex = (supportItem.y + supportItem.h) + 0.1;
            }
        }
        
        // 应用计算好的 Z-Index
        container.zIndex = zIndex;

        // ==========================================
        // 纹理处理与 Sprite 创建
        // ==========================================
        
        // 1. 确定最终要用的图片名 (优先使用方向映射)
        let targetFrameName = visualConfig.frameName;
        if (visualConfig.frameDirs && visualConfig.frameDirs[dir]) {
            targetFrameName = visualConfig.frameDirs[dir];
        }

        let sprite: Sprite | null = null;
        let visualHeight = f.h; // 默认视觉高度 = 逻辑高度

        // 🟢 分支 A: 使用 TexturePacker 图集 (Frame Name)
        if (targetFrameName) {
            const texture = getTexture(targetFrameName);
            if (texture && texture !== Texture.EMPTY) {
                sprite = new Sprite(texture);
                visualHeight = texture.height;
                sprite.width = texture.width;
                sprite.height = texture.height;
            }
        }
        
        // 🟢 分支 B: 使用 TileSheet 切片 (Tile Pos)
        if (!sprite) {
            let tileX = visualConfig.tilePos ? visualConfig.tilePos.x : 0;
            let tileY = visualConfig.tilePos ? visualConfig.tilePos.y : 0;
            let useTile = false;

            // 处理切片的方向偏移
            if (visualConfig.tilePosDir && visualConfig.tilePosDir[dir]) {
                tileX = visualConfig.tilePosDir[dir].x;
                tileY = visualConfig.tilePosDir[dir].y;
                useTile = true;
            } else if (visualConfig.hasDirectionalSprites && visualConfig.tilePos) {
                tileX += dir; 
                useTile = true;
            } else if (visualConfig.tilePos) {
                useTile = true;
            }

            if (visualConfig.tileSheet && useTile) {
                const sliceW = visualConfig.tileSize?.w || 48;
                const sliceH = visualConfig.tileSize?.h || 48; 
                
                visualHeight = visualConfig.textureHeight || f.h; 

                const texture = getSlicedTexture(visualConfig.tileSheet, tileX, tileY, sliceW, sliceH);
                sprite = new Sprite(texture);
                sprite.width = f.w; 
                sprite.height = visualHeight;
            }
        }

        // 🟢 分支 C: 兼容单张图片路径
        if (!sprite && visualConfig.imagePath && Assets.cache.has(visualConfig.imagePath)) {
            sprite = Sprite.from(visualConfig.imagePath);
            sprite.width = f.w;
            sprite.height = f.h;
            visualHeight = f.h;
        }

        // ==========================================
        // 最终组装：应用 Y 轴偏移
        // ==========================================
        if (sprite) {
            // 基础对齐偏移
            const alignmentOffset = f.h - visualHeight;
            sprite.y = alignmentOffset - elevationOffset;
            container.addChild(sprite);
        }
        else {
            // [兜底绘制] 纯色矩形
            const g = new Graphics();
            visualHeight = visualConfig.textureHeight || f.h;
            const yOffset = (f.h - visualHeight) - elevationOffset; 

            g.rect(0, yOffset, f.w, visualHeight);
            g.fill(f.color || 0xAAAAAA);
            g.stroke({ width: 2, color: 0x333333 });

            // 绘制方向箭头
            const cx = f.w / 2;
            const cy = yOffset + visualHeight / 2;
            g.beginPath();
            g.moveTo(cx, cy);
            if (dir === 0) g.lineTo(cx, cy + 15);      
            else if (dir === 1) g.lineTo(cx - 15, cy); 
            else if (dir === 2) g.lineTo(cx, cy - 15); 
            else if (dir === 3) g.lineTo(cx + 15, cy); 
            g.stroke({ width: 3, color: 0xFF5555 });

            container.addChild(g);
        }

        return container;
    }

}