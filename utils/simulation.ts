// Simulation Module Entry Point
// Exports all sub-modules for backward compatibility

// Re-exports
export { Sim } from './Sim';
export { minutes, getJobCapacity, getInteractionPos, hasRequiredTags } from './simulationHelpers';
export { drawAvatarHead } from './render/pixelArt';

// New Split Modules
export * from './GameStore';
export * from './GameLoop';

// 3. 逻辑模块导出 (方便调试或外部触发)
export { DecisionLogic } from './logic/decision';
export { SocialLogic } from './logic/social';
export { CareerLogic } from './logic/career';
export { InteractionSystem } from './logic/InteractionSystem';
// 4. 类型导出 (可选，如果 types.ts 已经在别处引用则不需要，为了方便可以 re-export)
export * from '../types';