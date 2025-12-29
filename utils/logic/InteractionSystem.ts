import { Sim } from '../Sim';
import { SimAction } from '../../types'; // 注意：NeedType 现在从 gameConstants 引入
import { InteractionType, ItemTag, NeedType } from '../../config/gameConstants';
import { Furniture } from '../../types';
import { 
    IdleState, 
    InteractionState, 
    TransitionState, 
    FetchingFoodState, 
    OrderingState, 
    BrowsingState 
} from './SimStates';
import { getInteractionPos, minutes } from '../simulationHelpers';

export const InteractionSystem = {
    /**
     * 🏁 开始交互 (入口函数)
     * @param intentOverride 可选：强制指定要进行的交互类型（例如玩家手动点击了“睡觉”）
     */
    startInteraction(sim: Sim, intentOverride?: InteractionType) {
        if (!sim.interactionTarget || sim.interactionTarget.type !== 'furniture') {
            sim.changeState(new IdleState());
            return;
        }

        const furniture = sim.interactionTarget as Furniture;

        // 1. 位置检查与平滑移动 (保持原有逻辑)
        const { interact } = getInteractionPos(furniture);
        const dist = Math.sqrt(Math.pow(sim.pos.x - interact.x, 2) + Math.pow(sim.pos.y - interact.y, 2));
        
        if (dist > 5) {
            sim.changeState(new TransitionState(interact, () => {
                InteractionSystem.performInteractionLogic(sim, furniture, intentOverride);
                return sim.state;
            }));
            return;
        }

        // 2. 到达位置，执行逻辑
        InteractionSystem.performInteractionLogic(sim, furniture, intentOverride);
    },

    /**
     * 🧠 核心逻辑：根据 InteractionType 分发行为
     */
    performInteractionLogic(sim: Sim, obj: Furniture, intentOverride?: InteractionType) {
        // 如果家具没有配置任何交互，直接退出
        if (!obj.interactions) {
            console.warn(`Furniture ${obj.label} has no interactions config!`);
            InteractionSystem.finishAction(sim);
            return;
        }

        // 1. 确定交互类型 (优先使用传入的意图，否则尝试智能匹配)
        let type = intentOverride || InteractionSystem.determineBestInteraction(sim, obj);

        if (!type || !obj.interactions[type]) {
            console.warn(`Sim ${sim.name} cannot perform ${type} on ${obj.label}`);
            InteractionSystem.finishAction(sim);
            return;
        }

        // 2. 获取具体配置参数 (这就是我们在 furnitureData 里写的那些数据！)
        const config = obj.interactions[type];

        // 3. 分发处理逻辑 (Router)
        switch (type) {
            // === 生理需求类 ===
            case InteractionType.Sit:
            case InteractionType.Sleep:
                InteractionSystem.handleRest(sim, obj, type, config);
                break;

            // === 饮食类 ===
            case InteractionType.OpenStorage:
            case InteractionType.Cook:
                // 冰箱/炉灶通常触发“找食物”流程
                sim.changeState(new FetchingFoodState(obj));
                break;
            
            case InteractionType.Eat:
                // 已经在桌子上吃了
                InteractionSystem.handleRest(sim, obj, type, { restoreNeed: NeedType.Hunger, restoreRate: 5 });
                break;

            case InteractionType.OrderFood:
                sim.changeState(new OrderingState(obj));
                break;

            // === 工作/学习类 ===
            case InteractionType.Work:
                InteractionSystem.handleWork(sim, obj, config);
                break;

            // === 购物类 ===
            case InteractionType.BuyItem:
                sim.changeState(new BrowsingState(obj));
                break;

            // === 默认处理 ===
            default:
                console.log(`Generic interaction: ${type}`);
                InteractionSystem.handleGeneric(sim, obj, type, config);
                break;
        }
    },

    /**
     * 🤖 辅助：如果没指定意图，Sim 该对这个家具做什么？
     */
    /**
     * 🤖 辅助：如果没指定意图，Sim 该对这个家具做什么？
     */
    determineBestInteraction(sim: Sim, obj: Furniture): InteractionType | null {
        // 🛡️ 安全检查：如果家具没有任何交互配置，直接返回 null
        if (!obj.interactions) return null;

        // 简单策略：返回第一个可用的交互
        // (Object.keys 现在的参数肯定不是 undefined 了)
        const available = Object.keys(obj.interactions) as InteractionType[];
        
        if (available.length > 0) return available[0];
        return null;
    },

    // ==========================================
    // 👇 具体处理函数 (Handlers)
    // ==========================================

    /**
     * 处理 坐下/睡觉/休息
     * 特点：持续一段时间，持续恢复某项需求
     */
    handleRest(sim: Sim, obj: Furniture, type: InteractionType, config: any) {
        // 1. 设置动作状态
        let action = SimAction.Using;
        if (type === InteractionType.Sleep) action = SimAction.Sleeping;
        else if (type === InteractionType.Sit) action = SimAction.Idle; // 或者是 Sitting

        // 2. 计算持续时间 (动态计算：直到补满为止)
        let duration = 30; // 保底 30分钟
        const needKey = config.restoreNeed || (type === InteractionType.Sleep ? NeedType.Energy : null);
        
        if (needKey && sim.needs[needKey] !== undefined) {
            const missing = 100 - sim.needs[needKey];
            const rate = config.restoreRate || 1; // 读配置！
            if (rate > 0) {
                duration = missing / rate;
            }
        }
        
        // 3. 设置 Sim 状态
        sim.actionTimer = minutes(duration);
        sim.changeState(new InteractionState(action));

        // 4. (可选) 立即应用一些效果，或者把 config 挂载到 State 里让 State 每帧更新时读取
        // 为了简单，我们这里只是开启状态，具体的数值回复通常在 State 的 update() 里或者 finishAction 里
        // *建议*：让 SimState 支持读取 config.restoreRate，这样回血速度才不一样
    },

    /**
     * 处理 工作
     */
    handleWork(sim: Sim, obj: Furniture, config: any) {
        // config.efficiency 可以影响工作产出
        sim.actionTimer = minutes(60); // 默认工作一小时循环
        // 可以在这里根据 config.jobType 检查 Sim 职业是否匹配
        sim.changeState(new InteractionState(SimAction.Working));
    },

    /**
     * 通用处理
     */
    handleGeneric(sim: Sim, obj: Furniture, type: InteractionType, config: any) {
        sim.actionTimer = minutes(30);
        sim.changeState(new InteractionState(SimAction.Using));
        sim.say("正在使用...", 'act');
    },

    /**
     * 🛑 结束交互 (清理与结算)
     */
    finishAction(sim: Sim) {
        // 1. 简单的兜底补满逻辑 (为了防止死循环)
        // 在更完善的系统中，应该是在 Update 每一帧根据 restoreRate 慢慢加
        if (sim.action === SimAction.Sleeping) {
            sim.needs[NeedType.Energy] = 100;
            sim.addBuff('well_rested'); // 这里应该引用常量
        }
        
        // 2. 清理引用
        sim.interactionTarget = null;
        sim.target = null;
        
        // 3. 回归空闲
        sim.changeState(new IdleState());
    }
};