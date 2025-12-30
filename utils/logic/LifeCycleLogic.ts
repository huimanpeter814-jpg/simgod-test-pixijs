import { Sim } from '../Sim';
import { GameStore } from '../GameStore';
import { AGE_CONFIG, JOBS, BUFFS, SURNAMES, MBTI_TYPES } from '../../constants';
import { SocialLogic } from './social';
import { CareerLogic } from './career';
import { AgeStage } from '../../types';
import { getAssetPool } from './SimInitializer';

// 🧬 遗传算法辅助函数
export const mixTrait = (val1: number, val2: number, mutationRange: number = 15) => {
    // 父母平均值
    const base = (val1 + val2) / 2;
    // 基因突变 (-mutationRange ~ +mutationRange)
    const mutation = (Math.random() - 0.5) * 2 * mutationRange;
    return Math.max(0, Math.min(100, Math.floor(base + mutation)));
};

// MBTI 遗传：随机组合父母的性格特征
export const mixMBTI = (mbti1: string, mbti2: string) => {
    // 10% 几率完全基因突变
    if (Math.random() < 0.1) return MBTI_TYPES[Math.floor(Math.random() * MBTI_TYPES.length)];
    
    // 45% 几率继承父亲，45% 继承母亲
    const rand = Math.random();
    if (rand < 0.55) return mbti1;
    if (rand < 1.0) return mbti2;
    
    return mbti1; // Fallback
};

export const LifeCycleLogic = {
    checkAgeStage(sim: Sim) {
        const currentStageConf = AGE_CONFIG[sim.ageStage];
        if (sim.age > currentStageConf.max) {
            const stages: AgeStage[] = [AgeStage.Infant, AgeStage.Toddler, AgeStage.Child, AgeStage.Teen, AgeStage.Adult, AgeStage.MiddleAged, AgeStage.Elder];
            const idx = stages.indexOf(sim.ageStage);
            
            if (idx < stages.length - 1) {
                const oldStage = sim.ageStage;
                const newStage = stages[idx + 1];
                
                sim.ageStage = newStage;
                sim.say(`我长大了！(${AGE_CONFIG[newStage].label})`, 'sys');
                sim.addMemory(`成长为了 ${AGE_CONFIG[newStage].label}。`, 'life');

                // 🆕 关键修改：检测是否跨越了资源组（例如 婴儿->幼儿，儿童->青少年）
                // 1. Infant -> Toddler (换 Child 资源)
                // 2. Child -> Teen (换 Adult 资源)
                const isInfantToChild = oldStage === AgeStage.Infant && newStage === AgeStage.Toddler;
                const isChildToAdult = oldStage === AgeStage.Child && newStage === AgeStage.Teen;

                if (isInfantToChild || isChildToAdult) {
                    const pool = getAssetPool(newStage);
                    const pick = (list: string[]) => list.length > 0 ? list[Math.floor(Math.random() * list.length)] : '';
                    
                    // 重新随机分配对应年龄段的外观
                    sim.appearance.body = pick(pool.bodies);
                    sim.appearance.outfit = pick(pool.outfits);
                    sim.appearance.hair = pick(pool.hairs);
                    
                    // 如果有需要，这里也可以根据性别做更细致的筛选（如果你的文件名包含 gender 标记）
                }
                if (sim.ageStage === AgeStage.Toddler) { sim.height += 30; sim.weight += 7; }
                else if (sim.ageStage === AgeStage.Child) { sim.height += 30; sim.weight += 15; }
                else if (sim.ageStage === AgeStage.Teen) { sim.height += 30; sim.weight += 20; }
                else if (sim.ageStage === AgeStage.Adult) { sim.height += 5; sim.weight += 5; }

                if (sim.ageStage === AgeStage.Adult && sim.job.id === 'unemployed') {
                    CareerLogic.assignJob(sim);
                    sim.say("该找份工作养活自己了！", 'sys');
                }
                // 🆕 新增：步入老年，发色变白
                if (sim.ageStage === AgeStage.Elder) {
                    const greyTones = ['#dcdde1', '#b2bec3', '#7f8fa6', '#f5f6fa', '#dfe4ea'];
                    sim.hairColor = greyTones[Math.floor(Math.random() * greyTones.length)];
                    
                    sim.say("头发变白了...", 'sys');
                    sim.addMemory("发现自己头发全白了，不得不感叹岁月的流逝。", "life");
                }
            }
        }
    },

    checkDeath(sim: Sim, dt: number) {
        if (sim.health <= 0) {
            LifeCycleLogic.die(sim, "健康耗尽");
            return;
        }
        if (sim.ageStage === AgeStage.Elder) {
            let deathProb = 0.00001 * (sim.age - 60) * dt; 
            deathProb *= (1.5 - sim.constitution / 100);
            deathProb *= (1.5 - sim.luck / 100);

            if (Math.random() < deathProb) {
                LifeCycleLogic.die(sim, "寿终正寝");
            }
        }
    },

    die(sim: Sim, cause: string) {
        GameStore.addLog(sim, `[讣告] ${sim.name} 因 ${cause} 离世了，享年 ${Math.floor(sim.age)} 岁。`, 'bad');
        
        // === ⚱️ 遗产分配逻辑 (Heritage) ===
        if (sim.money > 0) {
            LifeCycleLogic.handleInheritance(sim);
        }
        // === 遗产逻辑结束 ===

        GameStore.sims.forEach(s => {
            if (s.id === sim.id) return;
            const rel = s.relationships[sim.id];
            if ((rel && rel.friendship > 60) || sim.familyId === s.familyId) {
                s.addBuff(BUFFS.mourning);
                s.addMemory(`${sim.name} 离开了我们... R.I.P.`, 'family');
                s.say("R.I.P...", 'bad');
            }
            // 清理关系引用
            delete s.relationships[sim.id];
        });
        GameStore.removeSim(sim.id);
    },

    // 💰 处理遗产分配
    handleInheritance(sim: Sim) {
        const totalAsset = sim.money;
        let heirs: Sim[] = [];
        let heirType = '';

        // 1. 第一顺位：配偶 (Spouse)
        if (sim.partnerId) {
            const spouse = GameStore.sims.find(s => s.id === sim.partnerId);
            // 必须是已婚配偶，且仍然存活
            if (spouse && sim.relationships[spouse.id]?.isSpouse) {
                heirs = [spouse];
                heirType = '配偶';
            }
        }

        // 2. 第二顺位：子女 (Children)
        if (heirs.length === 0 && sim.childrenIds.length > 0) {
            // 查找所有存活的子女
            const children = GameStore.sims.filter(s => sim.childrenIds.includes(s.id));
            if (children.length > 0) {
                heirs = children;
                heirType = '子女';
            }
        }

        // 3. 第三顺位：父母 (Parents)
        if (heirs.length === 0) {
            const parents = GameStore.sims.filter(s => s.id === sim.fatherId || s.id === sim.motherId);
            if (parents.length > 0) {
                heirs = parents;
                heirType = '父母';
            }
        }

        // 执行分配
        if (heirs.length > 0) {
            const share = Math.floor(totalAsset / heirs.length);
            heirs.forEach(heir => {
                heir.money += share;
                // 计入今日收入，可能会触发“暴富幻觉” Buff
                heir.dailyIncome += share; 
                
                GameStore.addLog(heir, `继承了 ${sim.name} 的遗产 $${share}`, 'money');
                heir.addMemory(`继承了 ${sim.name} 的遗产，心中五味杂陈。`, 'family', sim.id);
                heir.say("我会珍惜这笔遗产的...", 'sys');
                
                // 如果金额巨大，添加 Buff
                if (share > 5000) heir.addBuff(BUFFS.rich_feel);
            });
            GameStore.addLog(null, `[遗产分配] ${sim.name} 的 $${totalAsset} 遗产已由 ${heirType} 继承。`, 'sys');
        } else {
            GameStore.addLog(null, `[遗产充公] ${sim.name} 无合法继承人，遗产 $${totalAsset} 捐赠给市政厅。`, 'sys');
        }
    },

    giveBirth(sim: Sim) {
        sim.isPregnant = false;
        sim.pregnancyTimer = 0;
        sim.removeBuff('pregnant');
        sim.addBuff(BUFFS.new_parent);

        // 获取父亲信息
        const father = GameStore.sims.find(s => s.id === sim.partnerForBabyId);
        
        const gender: 'M' | 'F' = Math.random() > 0.5 ? 'M' : 'F';
        
        // 随父姓概率大，但也可能随母姓
        let babySurname = sim.surname;
        if (father && Math.random() > 0.5) {
            babySurname = father.surname;
        }

        const baby = new Sim({
            x: sim.pos.x + 20,
            y: sim.pos.y + 20,
            surname: babySurname, 
            familyId: sim.familyId,
            ageStage: AgeStage.Infant,
            gender: gender,
            motherId: sim.id, 
            fatherId: sim.partnerForBabyId || undefined,
            homeId: sim.homeId, 
        });

        // === 🧬 遗传算法开始 (Genetics) ===
        if (father) {
            // 1. 外观遗传
            baby.skinColor = Math.random() > 0.5 ? sim.skinColor : father.skinColor;
            baby.hairColor = Math.random() > 0.5 ? sim.hairColor : father.hairColor;

            // 2. 属性遗传 (取平均值 + 变异)
            baby.iq = mixTrait(sim.iq, father.iq, 15);
            baby.eq = mixTrait(sim.eq, father.eq, 15);
            baby.constitution = mixTrait(sim.constitution, father.constitution, 10);
            baby.appearanceScore = mixTrait(sim.appearanceScore, father.appearanceScore, 10); // 颜值遗传
            baby.luck = mixTrait(sim.luck, father.luck, 20); // 运气波动较大
            baby.creativity = mixTrait(sim.creativity, father.creativity, 15);

            // 3. 性格遗传
            baby.mbti = mixMBTI(sim.mbti, father.mbti);
            
            // console.log(`[Genetics] Baby ${baby.name}: IQ(${baby.iq}) from ${sim.name}(${sim.iq})&${father.name}(${father.iq})`);
        } else {
            // 如果没有父亲（领养/单亲），主要随母亲，但变异更大
            baby.skinColor = sim.skinColor;
            baby.hairColor = sim.hairColor;
            baby.iq = mixTrait(sim.iq, sim.iq, 20);
            baby.eq = mixTrait(sim.eq, sim.eq, 20);
            baby.constitution = mixTrait(sim.constitution, 50, 20); // 回归平均
            baby.appearanceScore = mixTrait(sim.appearanceScore, 50, 20);
        }
        // === 遗传算法结束 ===

        GameStore.sims.push(baby);
        sim.childrenIds.push(baby.id);

        if (father) {
            father.childrenIds.push(baby.id);
            father.addBuff(BUFFS.new_parent);
            father.addMemory(`我们有孩子了！取名叫 ${baby.name}`, 'family', baby.id);
            
            SocialLogic.setKinship(father, baby, 'child');
            SocialLogic.setKinship(baby, father, 'parent');
        }

        SocialLogic.setKinship(sim, baby, 'child');
        SocialLogic.setKinship(baby, sim, 'parent');

        GameStore.addLog(sim, `生下了一个健康的${gender==='M'?'男':'女'}婴：${baby.name}！👶 (继承了父母的基因)`, 'family');
        sim.addMemory(`我的孩子 ${baby.name} 出生了！`, 'family', baby.id);
        sim.say("是个可爱的宝宝！", 'love');
    }
};