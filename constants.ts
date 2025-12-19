// Re-export assets
export * from './config/assets';

// Re-export gameplay configurations
export * from './config/gameplay';

// Keep this re-export here for scene data
export { PALETTES } from './data/scene';

// 🆕 新增：在 Constants 里导出 Skill Perks 描述 (可选，主要用于UI显示，逻辑在 SkillLogic)
// 为了避免循环依赖，这里只做简单的类型定义或空导出，具体数据在 SkillLogic 中维护
// 如果需要在 UI 显示，建议直接从 SkillLogic 导入 SKILL_PERKS