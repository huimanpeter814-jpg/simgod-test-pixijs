import { Sim } from '../Sim';
import { CONFIG, SURNAMES, MBTI_TYPES, TRAIT_POOL, TRAIT_CONFLICTS, FAMILY_LORE_TEMPLATES } from '../../constants';
import { SocialLogic } from './social';
import { mixTrait, mixMBTI } from './LifeCycleLogic'; // 复用生命周期中的遗传辅助函数
import { HousingUnit, AgeStage } from '../../types';

// 定义一个包含绝对坐标的类型，与 GameStore.housingUnits 保持一致
type HousingUnitWithPos = HousingUnit & { x: number; y: number };

type FamilyType = 'Standard' | 'MultiGenerational' | 'SingleParent' | 'DINK';

// 生成家庭的逻辑
export const FamilyGenerator = {
    /**
     * 🆕 核心算法：生成性格特质
     * @param parents 父母数组 (0-2人)
     */
    generatePersonality(parents: Sim[]): string[] {
        const traits: string[] = [];
        const MAX_TRAITS = 3;

        // 辅助函数：检查冲突和重复
        const canAdd = (t: string) => {
            if (traits.includes(t)) return false;
            if (traits.length >= MAX_TRAITS) return false;
            const conflicts = TRAIT_CONFLICTS[t];
            if (conflicts && conflicts.some(c => traits.includes(c))) return false;
            return true;
        };

        // 展平所有可用性格池
        const allTraits = [...TRAIT_POOL.social, ...TRAIT_POOL.lifestyle, ...TRAIT_POOL.mental];

        // Case 0: 初代生成 (无父母) -> 纯随机
        if (parents.length === 0) {
            while (traits.length < MAX_TRAITS) {
                const t = allTraits[Math.floor(Math.random() * allTraits.length)];
                if (canAdd(t)) traits.push(t);
            }
            return traits;
        }

        const p1 = parents[0];
        const p2 = parents.length > 1 ? parents[1] : null;

        const p1Traits = p1.traits || [];
        const p2Traits = p2 ? (p2.traits || []) : [];

        // 1. 强遗传 (Strong Inheritance): 父母双方都有
        if (p2) {
            const shared = p1Traits.filter(t => p2Traits.includes(t));
            shared.forEach(t => {
                // 80% 概率继承
                if (Math.random() < 0.8 && canAdd(t)) {
                    traits.push(t);
                }
            });
        }

        // 2. 普通遗传 (Normal Inheritance): 父母任一方有
        // 合并父母特质池，去重
        const parentPool = [...new Set([...p1Traits, ...p2Traits])];
        
        // 随机打乱池子顺序，避免偏向前几个特质
        parentPool.sort(() => Math.random() - 0.5);

        parentPool.forEach(t => {
            // 如果还没被添加 (强遗传步骤可能已经加了)，则 50% 概率
            if (!traits.includes(t)) {
                if (Math.random() < 0.5 && canAdd(t)) {
                    traits.push(t);
                }
            }
        });

        // 3. 变异 (Mutation): 20% 概率产生新性格
        // 要求：必须保留产生一个父母都没有的性格的机会
        if (traits.length < MAX_TRAITS && Math.random() < 0.2) {
            // 排除掉父母池中的性格
            const mutationPool = allTraits.filter(t => !parentPool.includes(t));
            if (mutationPool.length > 0) {
                const t = mutationPool[Math.floor(Math.random() * mutationPool.length)];
                if (canAdd(t)) {
                    traits.push(t);
                }
            }
        }

        // 4. 兜底填充 (Optional): 如果性格太少，随机补全?
        if (traits.length === 0) {
             const t = allTraits[Math.floor(Math.random() * allTraits.length)];
             if (canAdd(t)) traits.push(t);
        }

        return traits;
    },

    /**
     * 🆕 核心算法：生成家庭背景故事
     */
    generateFamilyLore(surname: string, wealth: 'poor' | 'middle' | 'rich', type: FamilyType): string {
        const templates = FAMILY_LORE_TEMPLATES[wealth];
        
        const origin = templates.origins[Math.floor(Math.random() * templates.origins.length)];
        const event = templates.events[Math.floor(Math.random() * templates.events.length)];
        const vibe = templates.vibes[Math.floor(Math.random() * templates.vibes.length)];

        let lore = `${origin} ${event} 如今，这个家庭的氛围${vibe}`;

        // 追加特定类型的描述
        if (type === 'SingleParent') {
            lore += " 独自抚养孩子很辛苦，但爱让一切值得。";
        } else if (type === 'DINK') {
            lore += " 享受二人世界，追求自由与梦想。";
        } else if (type === 'MultiGenerational') {
            lore += " 四世同堂，传承着古老的家风。";
        }

        return lore;
    },

    /**
     * 动态年龄逻辑：根据父母的年龄阶段决定孩子的年龄阶段
     */
    determineChildStage(parentStage: AgeStage): AgeStage {
        const r = Math.random();
        
        if (parentStage === AgeStage.Adult) {
            // 成年父母：主要是婴幼儿
            return r > 0.5 ? AgeStage.Infant : AgeStage.Toddler;
        }
        
        if (parentStage === AgeStage.MiddleAged) {
            // 中年父母：主要是儿童或青少年
            return r > 0.6 ? AgeStage.Child : AgeStage.Teen;
        }
        
        if (parentStage === AgeStage.Elder) {
            // 老年父母：
            // 5% 概率“老来得子” (模拟领养或晚育)
            if (r < 0.05) return r < 0.5 ? AgeStage.Infant : AgeStage.Toddler;
            // 主要是成年子女或青少年
            return r > 0.6 ? AgeStage.Adult : AgeStage.Teen;
        }

        // 默认 fallback (如果是青少年父母等极端情况)
        return AgeStage.Infant;
    },

    /**
     * 辅助函数：生成 Sim 的配置对象，包含遗传逻辑
     */
    generateSimConfig(
        x: number, 
        y: number, 
        surname: string, 
        familyId: string, 
        ageStage: AgeStage, 
        homeId: string | null,
        baseMoney: number,
        parents: Sim[] = []
    ): any {
        const config: any = {
            x, y, surname, familyId, ageStage, homeId, money: baseMoney
        };

        // 性别随机
        config.gender = Math.random() > 0.5 ? 'M' : 'F';

        // === 🧬 遗传机制 (Genetics) ===
        if (parents.length > 0) {
            const p1 = parents[0];
            const p2 = parents.length > 1 ? parents[1] : p1; // 如果是单亲，则只有 p1

            // 1. 外观遗传 (Visuals)
            config.skinColor = Math.random() > 0.5 ? p1.skinColor : (p2 ? p2.skinColor : p1.skinColor);
            config.hairColor = Math.random() > 0.5 ? p1.hairColor : (p2 ? p2.hairColor : p1.hairColor);
            
            // 2. 属性遗传 (Attributes)
            config.iq = mixTrait(p1.iq, p2.iq);
            config.eq = mixTrait(p1.eq, p2.eq);
            config.constitution = mixTrait(p1.constitution, p2.constitution);
            config.appearanceScore = mixTrait(p1.appearanceScore, p2.appearanceScore);
            
            // 3. MBTI 遗传
            config.mbti = mixMBTI(p1.mbti, p2.mbti);

            // 4. [修复] 显式设置父母 ID
            const father = parents.find(p => p.gender === 'M');
            const mother = parents.find(p => p.gender === 'F');
            if (father) config.fatherId = father.id;
            if (mother) config.motherId = mother.id;
        }

        // 🆕 5. 性格特质遗传 (Personality Traits)
        config.traits = FamilyGenerator.generatePersonality(parents);

        return config;
    },

    generate(count: number, housingUnits: HousingUnitWithPos[], allSims: Sim[]): Sim[] {
        const familyId = Math.random().toString(36).substring(2, 8);
        const r = Math.random();
        let wealthClass: 'poor' | 'middle' | 'rich';
        let baseMoney = 0;

        // 1. 决定阶级 & 家庭总资金
        if (r < 0.15) { wealthClass = 'rich'; baseMoney = 20000 + Math.floor(Math.random() * 30000); } 
        else if (r < 0.7) { wealthClass = 'middle'; baseMoney = 5000 + Math.floor(Math.random() * 10000); } 
        else { wealthClass = 'poor'; baseMoney = 1000 + Math.floor(Math.random() * 2000); }

        // 2. 寻找合适的住所
        let targetHomeTypes: string[] = wealthClass === 'rich' ? ['villa', 'apartment'] : (wealthClass === 'middle' ? ['apartment', 'public_housing'] : ['public_housing']); 

        const availableHomes = housingUnits.filter(unit => {
            const occupants = allSims.filter(s => s.homeId === unit.id).length;
            return targetHomeTypes.includes(unit.type) && (occupants + count <= unit.capacity);
        });

        availableHomes.sort((a, b) => targetHomeTypes.indexOf(a.type) - targetHomeTypes.indexOf(b.type));

        let homeId: string | null = null;
        let homeX = 100 + Math.random() * (CONFIG.CANVAS_W - 200);
        let homeY = 400 + Math.random() * (CONFIG.CANVAS_H - 500);

        if (availableHomes.length > 0) {
            const bestType = availableHomes[0].type;
            const bestHomes = availableHomes.filter(h => h.type === bestType);
            const home = bestHomes[Math.floor(Math.random() * bestHomes.length)];
            homeId = home.id;
            homeX = home.x + home.area.w / 2;
            homeY = home.y + home.area.h / 2;
        }

        const members: Sim[] = [];
        const familySurname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
        
        // 🆕 处理单身家庭 (Solo household)
        if (count === 1) {
            const stages = [AgeStage.Adult, AgeStage.MiddleAged, AgeStage.Teen];
            const stage = stages[Math.floor(Math.random() * stages.length)];
            const singleMoney = Math.floor(baseMoney / 2);
            
            const lore = FamilyGenerator.generateFamilyLore(familySurname, wealthClass, 'Standard');
            
            let config = FamilyGenerator.generateSimConfig(
                homeX, homeY, familySurname, familyId, stage, homeId, singleMoney
            );

            config.familyLore = lore + " 独自在这个城市打拼。";
            
            const sim = new Sim(config);
            sim.addMemory(`[背景] ${config.familyLore}`, 'family');
            console.log(`[Genetics] Generated Solo Sim: ${sim.name}`);
            return [sim];
        }

        // 🆕 生成家庭背景故事
        // 3. 决定家庭类型 (FamilyType)
        let familyType: FamilyType = 'Standard';
        const rType = Math.random();

        if (count === 2 && rType < 0.2) familyType = 'DINK'; // 2人时有概率丁克
        else if (count >= 3 && rType < 0.2) familyType = 'MultiGenerational'; // 3人以上概率三代同堂
        else if (rType < 0.3) familyType = 'SingleParent'; // 单亲家庭概率
        // 默认为 Standard

        // 根据类型调整人数约束
        if (familyType === 'DINK') count = 2;
        if (familyType === 'MultiGenerational' && count < 3) count = 3; // 至少要3人才能三代

        const familyLore = FamilyGenerator.generateFamilyLore(familySurname, wealthClass, familyType);

        // 辅助：根据人数计算每个成年人的初始资金
        const adultCount = familyType === 'DINK' ? 2 : (familyType === 'SingleParent' ? 1 : 2);
        const moneyPerAdult = Math.floor(baseMoney / Math.max(1, adultCount));

        // 辅助：为成员附加 lore 的函数
        const attachLore = (config: any) => {
            config.familyLore = familyLore;
            return config;
        };

        // === 生成逻辑分支 ===

        if (familyType === 'MultiGenerational') {
            // 三代同堂：祖父母(1-2) -> 父母(1-2) -> 孙辈
            const grandParentCount = Math.random() > 0.5 ? 2 : 1;
            const grandParents: Sim[] = [];
            
            // 1. 生成祖父母 (Elder)
            for (let i = 0; i < grandParentCount; i++) {
                let config = FamilyGenerator.generateSimConfig(
                    homeX + i * 20, homeY, familySurname, familyId, AgeStage.Elder, homeId, moneyPerAdult
                );
                config = attachLore(config);
                const gp = new Sim(config);
                grandParents.push(gp);
                members.push(gp);
            }
            if (grandParents.length === 2) SocialLogic.marry(grandParents[0], grandParents[1], true);

            // 2. 生成父母 (Middle/Adult) - 是祖父母的孩子
            const parentCount = Math.min(2, Math.max(1, count - grandParentCount - 1)); // 留至少1个位置给孙辈
            const parents: Sim[] = [];
            
            for (let i = 0; i < parentCount; i++) {
                // 父母的年龄段
                const pStage = Math.random() > 0.5 ? AgeStage.MiddleAged : AgeStage.Adult;
                // 继承祖父母基因
                let config = FamilyGenerator.generateSimConfig(
                    homeX + 40 + i * 20, homeY + 20, familySurname, familyId, pStage, homeId, moneyPerAdult, grandParents
                );
                config = attachLore(config);
                
                const parent = new Sim(config);
                parents.push(parent);
                members.push(parent);

                // 建立祖父母 -> 父母 亲属关系
                grandParents.forEach(gp => {
                    SocialLogic.setKinship(gp, parent, 'child');
                    SocialLogic.setKinship(parent, gp, 'parent');
                    gp.childrenIds.push(parent.id);
                });
            }
            if (parents.length === 2) SocialLogic.marry(parents[0], parents[1], true);

            // 3. 生成孙辈 (Children)
            const childCount = Math.max(1, count - grandParentCount - parentCount);
            for (let i = 0; i < childCount; i++) {
                // 根据父母年龄决定孩子年龄
                const childStage = FamilyGenerator.determineChildStage(parents[0].ageStage);
                
                // 继承父母基因
                let config = FamilyGenerator.generateSimConfig(
                    homeX + i * 20, homeY + 40, familySurname, familyId, childStage, homeId, 0, parents
                );
                config = attachLore(config);
                
                const child = new Sim(config);
                members.push(child);

                // 建立 父母 -> 孩子 关系
                parents.forEach(p => {
                    SocialLogic.setKinship(p, child, 'child');
                    SocialLogic.setKinship(child, p, 'parent');
                    p.childrenIds.push(child.id);
                });
            }

        } else if (familyType === 'DINK') {
            // 丁克：两位伴侣，无子女
            let c1 = FamilyGenerator.generateSimConfig(homeX, homeY, familySurname, familyId, AgeStage.Adult, homeId, moneyPerAdult);
            let c2 = FamilyGenerator.generateSimConfig(homeX + 20, homeY, familySurname, familyId, AgeStage.Adult, homeId, moneyPerAdult);
            c1 = attachLore(c1);
            c2 = attachLore(c2);

            const p1 = new Sim(c1);
            const p2 = new Sim(c2);
            
            // 确保异性或同性伴侣
            if (Math.random() > 0.3) p2.gender = p1.gender === 'M' ? 'F' : 'M';
            
            SocialLogic.marry(p1, p2, true);
            members.push(p1, p2);

        } else {
            // Standard (标准) 或 SingleParent (单亲)
            const isSingle = familyType === 'SingleParent';
            const parentCount = isSingle ? 1 : 2;
            const parents: Sim[] = [];

            // 1. 生成父母
            for (let i = 0; i < parentCount; i++) {
                // 父母年龄可以是 Adult 或 MiddleAged
                const pStage = Math.random() > 0.3 ? AgeStage.Adult : AgeStage.MiddleAged;
                let config = FamilyGenerator.generateSimConfig(
                    homeX + i * 20, homeY, familySurname, familyId, pStage, homeId, moneyPerAdult
                );
                // 强制第二位异性 (如果是标准家庭)
                if (i === 1 && parents.length > 0) {
                    config.gender = parents[0].gender === 'M' ? 'F' : 'M';
                }
                config = attachLore(config);
                
                const p = new Sim(config);
                parents.push(p);
                members.push(p);
            }

            if (parentCount === 2) SocialLogic.marry(parents[0], parents[1], true);

            // 2. 生成子女
            const childCount = Math.max(1, count - parentCount);
            // 基于父母年龄决定孩子基准年龄
            const baseParentStage = parents[0].ageStage;

            for (let i = 0; i < childCount; i++) {
                const childStage = FamilyGenerator.determineChildStage(baseParentStage);
                
                let config = FamilyGenerator.generateSimConfig(
                    homeX + i * 20, homeY + 30, familySurname, familyId, childStage, homeId, 0, parents
                );
                config = attachLore(config);
                
                const child = new Sim(config);
                members.push(child);

                // 建立关系
                parents.forEach(p => {
                    SocialLogic.setKinship(p, child, 'child');
                    SocialLogic.setKinship(child, p, 'parent');
                    p.childrenIds.push(child.id);
                });
            }
        }

        // 处理兄弟姐妹关系 (所有同辈孩子之间)
        const children = members.filter(m => 
            [AgeStage.Infant, AgeStage.Toddler, AgeStage.Child, AgeStage.Teen, AgeStage.Adult].includes(m.ageStage) &&
            members.some(parent => parent.childrenIds.includes(m.id))
        );

        for (let i = 0; i < children.length; i++) {
            for (let j = i + 1; j < children.length; j++) {
                SocialLogic.setKinship(children[i], children[j], 'sibling');
                SocialLogic.setKinship(children[j], children[i], 'sibling');
            }
        }

        // 为所有成员添加初始记忆
        members.forEach(m => {
            if (m.familyLore) {
                m.addMemory(`[家庭背景] ${m.familyLore}`, 'family');
            }
        });

        console.log(`[Genetics] Generated family (${familyType}): ${members.length} members. Lore: ${familyLore}`);
        return members;
    }
};