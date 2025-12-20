/// <reference types="vite/client" />

// 1. 资源加载
// 使用 Vite 的 Glob 导入功能批量获取资源路径
const bodyFiles = import.meta.glob('/src/assets/bodies/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
const outfitFiles = import.meta.glob('/src/assets/outfits/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
const hairFiles = import.meta.glob('/src/assets/hairs/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
const bgFiles = import.meta.glob('/src/assets/bg/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });

// 保留旧的 face 以防万一，但主要逻辑将切换到新的三层结构
const faceFiles = import.meta.glob('/src/assets/face/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });

function getValues(globResult: Record<string, unknown>): string[] {
    return Object.values(globResult) as string[];
}

export const ASSET_CONFIG = {
    bodies: getValues(bodyFiles),
    outfits: getValues(outfitFiles),
    hairs: getValues(hairFiles),
    bg: getValues(bgFiles),
    // 兼容旧字段，防止报错，但在新逻辑中可能不再主要使用
    face: getValues(faceFiles), 
    clothes: [],
    pants: []
};