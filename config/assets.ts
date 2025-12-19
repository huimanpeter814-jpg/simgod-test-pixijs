/// <reference types="vite/client" />

// 1. 资源加载
// 使用 Vite 的 Glob 导入功能批量获取资源路径
const faceFiles = import.meta.glob('/src/assets/face/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
const hairFiles = import.meta.glob('/src/assets/hair/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
const clothesFiles = import.meta.glob('/src/assets/clothes/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
const pantsFiles = import.meta.glob('/src/assets/pants/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });
const bgFiles = import.meta.glob('/src/assets/bg/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' });

function getValues(globResult: Record<string, unknown>): string[] {
    return Object.values(globResult) as string[];
}

export const ASSET_CONFIG = {
    face: getValues(faceFiles),
    hair: getValues(hairFiles),
    clothes: getValues(clothesFiles),
    pants: getValues(pantsFiles),
    bg: getValues(bgFiles)
};