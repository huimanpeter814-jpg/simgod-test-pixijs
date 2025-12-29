// Re-export assets
export * from './config/assets';

// Re-export gameplay configurations
export * from './config/gameplay';

export * from './config/gameConstants';

// Keep this re-export here for scene data
export { PALETTES } from './data/scene';

// 🆕 新增：在 Constants 里导出 Skill Perks 描述 (可选，主要用于UI显示，逻辑在 SkillLogic)
// 为了避免循环依赖，这里只做简单的类型定义或空导出，具体数据在 SkillLogic 中维护
// 如果需要在 UI 显示，建议直接从 SkillLogic 导入 SKILL_PERKS
// 1. 动作映射表：将字符串动作映射为整数，因为 SharedArrayBuffer 只能存数字
// 注意：保持 0 为 idle，顺序随意，但必须两端一致
export const ACTION_CODE = {
    idle: 0,
    walking: 1,
    working: 2,
    interacting: 3,
    sleeping: 4,
    // ... 后续可以根据 SimAction 枚举继续补充
};

// 2. 内存布局配置
export const SAB_CONFIG = {
    MAX_SIMS: 2000,     // 最大支持人口 (固定分配内存)
    STRUCT_SIZE: 6,     // 每个 Sim 占用 6 个 Float32 (4字节 x 6 = 24字节)
    
    // 字段偏移量 (Offset)
    // 假如一个 Sim 的数据从 index 100 开始：
    OFFSET_X: 0,        // view[100 + 0] = x
    OFFSET_Y: 1,        // view[100 + 1] = y
    OFFSET_ACTION: 2,   // view[100 + 2] = action code
    OFFSET_DIR: 3,      // view[100 + 3] = direction (0=left, 1=right)
    OFFSET_SKIN: 4,     // view[100 + 4] = skinColor (存 hex 转换后的 int，或者预设索引)
    OFFSET_VISIBLE: 5   // view[100 + 5] = isVisible (1=显示, 0=隐藏/在室内)
};

// 计算总缓冲区大小 (字节)
export const SAB_BYTE_LENGTH = SAB_CONFIG.MAX_SIMS * SAB_CONFIG.STRUCT_SIZE * 4;