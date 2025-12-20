import type { Sim } from '../Sim'; 
import { GameStore } from '../simulation';
import { SOCIAL_TYPES, BUFFS, ELE_COMP, AGE_CONFIG } from '../../constants';
import { DIALOGUE_TEMPLATES } from '../../data/dialogues';
import { AgeStage } from '../../types';

type SocialType = typeof SOCIAL_TYPES[number];

export const SocialLogic = {
    getCurrentPlaceName(sim: Sim) {
        const room = GameStore.rooms.find(r => 
            sim.pos.x >= r.x && sim.pos.x <= r.x + r.w &&
            sim.pos.y >= r.y && sim.pos.y <= r.y + r.h
        );
        return room ? room.label.split(' ')[0] : '户外';
    },

    getDialogue(sim: Sim, typeId: string, target: Sim): string {
        // 🆕 婴幼儿强制使用 Baby Talk
        if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
            const templates = DIALOGUE_TEMPLATES['baby_talk'];
            return templates.default[Math.floor(Math.random() * templates.default.length)];
        }

        // 🆕 对婴幼儿的特殊对话
        if ([AgeStage.Infant, AgeStage.Toddler].includes(target.ageStage)) {
            const templates = DIALOGUE_TEMPLATES['tease_baby'];
            return templates.default[Math.floor(Math.random() * templates.default.length)];
        }

        const templates = DIALOGUE_TEMPLATES[typeId] || { default: ["..."] };
        let candidates = [...(templates.default || [])];

        if (sim.mbti.includes('E') && templates.E) candidates.push(...templates.E);
        if (sim.mbti.includes('I') && templates.I) candidates.push(...templates.I);
        if (sim.mbti.includes('F') && templates.F) candidates.push(...templates.F);
        if (sim.mbti.includes('T') && templates.T) candidates.push(...templates.T);

        if (templates[sim.mbti]) candidates.push(...templates[sim.mbti]);

        if (sim.relationships[target.id]?.isLover && templates.lover) candidates.push(...templates.lover);
        
        const relVal = sim.relationships[target.id]?.friendship || 0;
        if (relVal < -50 && templates.enemy) candidates.push(...templates.enemy);

        if (candidates.length === 0) candidates = ["..."];

        let template = candidates[Math.floor(Math.random() * candidates.length)];

        template = template.replace(/{A}/g, sim.name);
        template = template.replace(/{B}/g, target.name);
        template = template.replace(/{Place}/g, SocialLogic.getCurrentPlaceName(sim));

        return template;
    },

    getCompatibility(sim: Sim, partner: Sim) {
        let score = 0;
        for (let i = 0; i < 4; i++) if (sim.mbti[i] === partner.mbti[i]) score++;
        
        if (sim.zodiac.element === partner.zodiac.element) score += 2;
        else if (ELE_COMP[sim.zodiac.element].includes(partner.zodiac.element)) score += 1;
        else score -= 1;

        return Math.max(0, score);
    },

    getLifeGoalCompatibility(sim: Sim, partner: Sim) {
        if (sim.lifeGoal === partner.lifeGoal) return 25;

        const groups = {
            money: ['富翁', '大亨', '上市', '财富', '敲钟', '金牌'],
            fame: ['万人迷', '爆红', '领袖', '明星', '政坛', '声望'],
            chill: ['隐居', '极简', '躺平', '睡个好觉', '岁月静好'],
            art: ['作家', '制作人', '艺术', '设计', '美'],
            tech: ['黑客', '大牛', '诺贝尔', '全网'],
            fun: ['派对', '游戏', '环游', '美食']
        };

        // @ts-ignore
        const getGroup = (goal: string) => Object.keys(groups).find(k => groups[k as keyof typeof groups].some(word => goal.includes(word)));

        const g1 = getGroup(sim.lifeGoal);
        const g2 = getGroup(partner.lifeGoal);

        if (g1 && g1 === g2) return 15; 

        if ((g1 === 'money' && g2 === 'chill') || (g1 === 'chill' && g2 === 'money')) return -15; 
        if ((g1 === 'tech' && g2 === 'party')) return -5; 

        return 0;
    },

    checkSexualOrientation(sim: Sim, partner: Sim) {
        if (sim.orientation === 'bi') return true;
        if (sim.orientation === 'hetero') return sim.gender !== partner.gender;
        if (sim.orientation === 'homo') return sim.gender === partner.gender;
        return false;
    },

    hasOtherPartner(sim: Sim, partner: Sim) {
        for (let id in sim.relationships) {
            if (id !== partner.id && sim.relationships[id].romance > 80 && sim.relationships[id].isLover) return true;
        }
        return false;
    },

    getRelLabel(rel: any) {
        if (rel.kinship === 'spouse') return '配偶';
        if (rel.kinship === 'parent') return '父母';
        if (rel.kinship === 'child') return '子女';
        if (rel.kinship === 'sibling') return '手足';
        
        let r = rel.romance || 0;
        if (rel.isLover) return '恋人';
        if (r > 80) return '爱慕';
        if (r > 60) return '喜欢';
        if (r > 40) return '暧昧';
        if (r > 20) return '好感';
        if (r > 10) return '心动';
        if (r >= 0) return '无感';
        if (r > -30) return '不吸引';
        if (r > -60) return '嫌弃';
        return '厌恶';
    },
    
    setKinship(sim: Sim, target: Sim, type: 'parent' | 'child' | 'sibling' | 'spouse') {
        if (!sim.relationships[target.id]) sim.relationships[target.id] = { friendship: 50, romance: 0, isLover: false, isSpouse: false, hasRomance: false };
        sim.relationships[target.id].kinship = type;
        sim.relationships[target.id].friendship = 80; 
        if (type === 'spouse') {
            sim.relationships[target.id].isSpouse = true;
            sim.relationships[target.id].isLover = true;
            sim.relationships[target.id].romance = 80;
        }
    },

    marry(sim: Sim, partner: Sim, silent = false) {
        SocialLogic.setKinship(sim, partner, 'spouse');
        SocialLogic.setKinship(partner, sim, 'spouse');
        
        sim.partnerId = partner.id;
        partner.partnerId = sim.id;
        partner.familyId = sim.familyId;

        if (!silent) {
            sim.addBuff(BUFFS.married);
            partner.addBuff(BUFFS.married);
            GameStore.addLog(sim, `与 ${partner.name} 喜结连理！💒`, 'family');
            sim.addMemory(`与 ${partner.name} 结婚了，这是我人生中最幸福的一天。`, 'family', partner.id);
            partner.addMemory(`与 ${sim.name} 结婚了，我们将携手共度余生。`, 'family', sim.id);
        }
    },

    divorce(sim: Sim, partner: Sim) {
        sim.relationships[partner.id].kinship = 'none';
        sim.relationships[partner.id].isSpouse = false;
        sim.relationships[partner.id].isLover = false;
        sim.relationships[partner.id].romance = -50;
        
        partner.relationships[sim.id].kinship = 'none';
        partner.relationships[sim.id].isSpouse = false;
        partner.relationships[sim.id].isLover = false;
        partner.relationships[sim.id].romance = -50;

        sim.partnerId = null;
        partner.partnerId = null;
        partner.familyId = partner.id; 

        sim.addBuff(BUFFS.divorced);
        partner.addBuff(BUFFS.divorced);
        
        GameStore.addLog(sim, `与 ${partner.name} 离婚了，家庭破碎... 💔`, 'family');
        sim.addMemory(`与 ${partner.name} 离婚了，一段关系走到了尽头。`, 'bad', partner.id);
    },


    checkRelChange(sim: Sim, partner: Sim, oldLabel: string) {
        let newLabel = SocialLogic.getRelLabel(sim.relationships[partner.id] || {});
        const newFriendship = sim.relationships[partner.id]?.friendship || 0;
        
        if (oldLabel !== newLabel) {
            if (newLabel === '恋人' || newLabel === '爱慕') {
                GameStore.addLog(sim, `与 ${partner.name} 的关系变成了 ${newLabel}`, 'rel_event');
            }
            if (newLabel === '厌恶' && oldLabel !== '厌恶') {
                sim.addMemory(`受不了 ${partner.name} 了，简直是死对头！`, 'social', partner.id);
                GameStore.addLog(sim, `视 ${partner.name} 为死对头！`, 'bad');
            }
        }

        if (newFriendship > 60 && !sim.memories.some(m => m.type === 'social' && m.relatedSimId === partner.id && m.text.includes('好朋友'))) {
             sim.addMemory(`和 ${partner.name} 成为了好朋友。`, 'social', partner.id);
        }
    },

    updateRelationship(sim: Sim, target: Sim, type: string, delta: number) {
        if (!sim.relationships[target.id]) sim.relationships[target.id] = { friendship: 0, romance: 0, isLover: false, isSpouse: false, hasRomance: false };
        let rel = sim.relationships[target.id];
        
        let modifier = 1.0;
        if (delta > 0) {
            modifier += (sim.eq - 50) * 0.01; 
        } else {
            modifier -= (sim.eq - 50) * 0.005; 
        }

        if (type === 'romance' && delta > 0) {
            modifier += (sim.appearanceScore - 50) * 0.01;
        }

        if (rel.kinship && type === 'friendship' && delta < 0) modifier *= 0.5;

        const finalDelta = delta * modifier;

        if (type === 'friendship') {
            rel.friendship = Math.max(-100, Math.min(100, rel.friendship + finalDelta));
        } else if (type === 'romance') {
            rel.romance = Math.max(-100, Math.min(100, rel.romance + finalDelta));
            rel.friendship = Math.max(-100, Math.min(100, rel.friendship + finalDelta * 0.3));
        }
    },

    triggerJealousy(sim: Sim, actor: Sim, target: Sim) {
        // [修复] 防止自己吃自己的醋 (Sims shouldn't get jealous of themselves being the target)
        if (sim.id === target.id) return;
        // 观察者不应该是事件的参与者
        if (sim.id === actor.id) return;

        let sensitivity = 50; 
        
        if (sim.mbti.includes('F')) sensitivity -= 10; 
        if (sim.mbti.includes('P')) sensitivity += 10; 
        if (['water', 'fire'].includes(sim.zodiac.element)) sensitivity -= 10; 
        if (sim.eq > 70) sensitivity += 15; 
        if (sim.faithfulness < 30) sensitivity += 20; 

        let relActor = sim.relationships[actor.id]?.romance || 0;
        let isLover = sim.relationships[actor.id]?.isLover;

        if (isLover && sim.faithfulness > 40) sensitivity = 20;

        if (relActor > sensitivity) {
            
            let baseImpact = -30;
            const faithFactor = sim.faithfulness / 50; 
            const eqFactor = Math.max(0.5, (100 - sim.eq) / 50); 

            let finalImpact = baseImpact * faithFactor * eqFactor;

            if (!isLover) finalImpact *= 0.5;

            SocialLogic.updateRelationship(sim, actor, 'romance', finalImpact);
            SocialLogic.updateRelationship(sim, actor, 'friendship', finalImpact * 0.5);
            // 迁怒于第三者
            SocialLogic.updateRelationship(sim, target, 'friendship', finalImpact * 0.8);

            let oldLabelA = SocialLogic.getRelLabel(sim.relationships[actor.id] || {});
            
            if (finalImpact < -25) {
                sim.say("💢 怎么可以这样...", 'bad');
                GameStore.addLog(sim, `目睹 ${actor.name} 出轨，心碎了一地！(好感大幅下降)`, 'jealous');
                sim.addMemory(`看见 ${actor.name} 和别人亲密，我感到被背叛了。`, 'bad', actor.id);
                sim.addBuff(BUFFS.cheated);
                sim.buffs = sim.buffs.filter(b => b.id !== 'in_love');
                
                if (isLover && sim.mbti.includes('J') && sim.relationships[actor.id].romance < 0) {
                    sim.relationships[actor.id].isLover = false;
                    actor.relationships[sim.id].isLover = false; 
                    GameStore.addLog(sim, `因无法忍受背叛，与 ${actor.name} 分手了。`, 'rel_event');
                }

            } else {
                sim.say("哼... 😒", 'bad');
                GameStore.addLog(sim, `看到 ${actor.name} 和别人在一起，心里有点酸。(轻微吃醋)`, 'jealous');
                sim.addBuff(BUFFS.jealous);
            }

            SocialLogic.checkRelChange(sim, actor, oldLabelA);
        }
    },

    determinePregnantSim(simA: Sim, simB: Sim): Sim | null {
        const getScore = (s: Sim) => s.constitution * 0.4 + s.health * 0.4 + s.luck * 0.2;
        
        const scoreA = getScore(simA);
        const scoreB = getScore(simB);
        
        if (simA.health < 40 && simB.health < 40) return null;

        const totalScore = scoreA + scoreB;
        if (totalScore === 0) return Math.random() > 0.5 ? simA : simB;

        const chanceA = scoreA / totalScore;
        return Math.random() < chanceA ? simA : simB;
    },

    performSocial(sim: Sim, partner: Sim) {
        const goalComp = SocialLogic.getLifeGoalCompatibility(sim, partner); 
        const charmDiff = sim.appearanceScore - partner.appearanceScore; 
        const isIncest = sim.relationships[partner.id]?.kinship && sim.relationships[partner.id]?.kinship !== 'spouse' && sim.relationships[partner.id]?.kinship !== 'none';
        if (isIncest) return; 
        
        if (!sim.relationships[partner.id]) sim.relationships[partner.id] = { friendship: 0, romance: 0, isLover: false, isSpouse: false, hasRomance: false };
        if (!partner.relationships[sim.id]) partner.relationships[sim.id] = { friendship: 0, romance: 0, isLover: false, isSpouse: false, hasRomance: false };

        let rel = sim.relationships[partner.id];
        let oldLabel = SocialLogic.getRelLabel(rel);

        const minors = [AgeStage.Infant, AgeStage.Toddler, AgeStage.Child];
        const isSimMinor = minors.includes(sim.ageStage);
        const isPartnerMinor = minors.includes(partner.ageStage);
        const isSimTeen = sim.ageStage === AgeStage.Teen;
        const isPartnerTeen = partner.ageStage === AgeStage.Teen;

        let allowRomance = true;
        if (isSimMinor || isPartnerMinor) allowRomance = false; 
        if (isSimTeen && !isPartnerTeen) allowRomance = false; 
        if (!isSimTeen && isPartnerTeen) allowRomance = false; 

        // 🆕 对婴幼儿互动的特殊限制
        let availableActions: SocialType[] = [];
        const isTargetBaby = [AgeStage.Infant, AgeStage.Toddler].includes(partner.ageStage);

        if (isTargetBaby) {
            // 对宝宝只能做特定的事
            availableActions = [
                { id: 'chat', label: '逗弄', val: 5, type: 'friendship', minVal: -100, maxVal: 100, logType: 'chat' },
                { id: 'hug', label: '抱抱', val: 10, type: 'friendship', minVal: -100, maxVal: 100, logType: 'love', special: 'hug' }
            ];
        } else {
            availableActions = SOCIAL_TYPES.filter(type => {
                if (type.type === 'friendship') {
                    return rel.friendship >= type.minVal && rel.friendship <= type.maxVal;
                } else if (type.type === 'romance') {
                    if (!allowRomance) return false;

                    let romantic = rel.romance >= type.minVal && rel.romance <= type.maxVal;
                    if (type.special === 'confess') return !rel.isLover && rel.romance >= 40;
                    if (type.special === 'breakup') return rel.isLover && rel.romance < -60;
                    if (type.special === 'pickup') return !rel.hasRomance && rel.romance < 20;
                    if (!rel.hasRomance && type.special !== 'pickup') return false;
                    return romantic;
                }
                return false;
            });
        }

        let canBeRomantic = SocialLogic.checkSexualOrientation(sim, partner);
        if (canBeRomantic && sim.faithfulness > 70 && SocialLogic.hasOtherPartner(sim, partner)) {
            canBeRomantic = false;
        }
        else if (canBeRomantic && sim.faithfulness < 40 && SocialLogic.hasOtherPartner(sim, partner)) {
            if (Math.random() > 0.4) canBeRomantic = false;
        }

        if (!canBeRomantic) {
            availableActions = availableActions.filter(t => t.type !== 'romance');
        }

        if (availableActions.length === 0) availableActions = [SOCIAL_TYPES[0]];

        let romanceActions = availableActions.filter(t => t.type === 'romance');
        let finalType: SocialType = availableActions[0];

        let romanticProb = 0.4;
        if (sim.mbti.includes('F')) romanticProb += 0.2;
        if (sim.faithfulness < 40) romanticProb += 0.2;
        if (sim.hasBuff('in_love')) romanticProb += 0.3;
        if (goalComp > 10) romanticProb += 0.2;

        if (romanceActions.length > 0 && Math.random() < romanticProb) {
            finalType = romanceActions[Math.floor(Math.random() * romanceActions.length)];
        } else {
            finalType = availableActions[Math.floor(Math.random() * availableActions.length)];
        }

        let success = true;
        
        if (finalType.type === 'romance') {
            if (partner.faithfulness > 70 && SocialLogic.hasOtherPartner(partner, sim)) success = false;
            
            let charmThreshold = -30;
            if (sim.money > 5000) charmThreshold = -50; 
            if (sim.iq > 80 && partner.mbti.includes('N')) charmThreshold = -40; 

            if (charmDiff < charmThreshold) success = Math.random() > 0.8; 

            if (goalComp < -10) success = Math.random() > 0.7; 

            if (finalType.minVal > partner.relationships[sim.id].romance + 15) success = false;
            
            if (finalType.special === 'breakup') success = true;
        }

        if (success) {
            if (finalType.type === 'romance') {
                if (finalType.special === 'pickup') {
                    sim.addBuff(BUFFS.crush);
                    partner.addBuff(BUFFS.crush);
                } else if (!finalType.special && rel.isLover) {
                    if (Math.random() > 0.7) {
                        sim.addBuff(BUFFS.sweet_date);
                        partner.addBuff(BUFFS.sweet_date);
                    }
                }
            }

            if (finalType.special === 'confess') {
                if (partner.relationships[sim.id].romance > 40 && goalComp >= -5) {
                    rel.isLover = true;
                    partner.relationships[sim.id].isLover = true;
                    GameStore.addLog(sim, `向 ${partner.name} 表白成功！两人成为了恋人 ❤️`, 'rel_event');
                    GameStore.spawnHeart(sim.pos.x, sim.pos.y);
                    sim.addBuff(BUFFS.in_love);
                    partner.addBuff(BUFFS.in_love);
                    sim.addMemory(`向 ${partner.name} 表白成功，我们在一起了！❤️`, 'life', partner.id);
                    partner.addMemory(`接受了 ${sim.name} 的表白，我们在一起了！❤️`, 'life', sim.id);
                } else {
                    success = false;
                    let reason = goalComp < -5 ? "（觉得性格不合）" : "";
                    GameStore.addLog(sim, `向 ${partner.name} 表白被拒绝了... ${reason}`, 'rel_event');
                    SocialLogic.updateRelationship(sim, partner, 'romance', -10);
                    sim.addMemory(`向 ${partner.name} 表白被拒绝，好难过...`, 'bad', partner.id);
                    sim.addBuff(BUFFS.rejected);
                }
            } else if (finalType.special === 'breakup') {
                rel.isLover = false;
                partner.relationships[sim.id].isLover = false;
                GameStore.addLog(sim, `和 ${partner.name} 分手了... 💔`, 'rel_event');
                sim.addBuff(BUFFS.heartbroken);
                partner.addBuff(BUFFS.heartbroken);
                sim.addMemory(`和 ${partner.name} 分手了，往事随风。`, 'bad', partner.id);
                partner.addMemory(`被 ${sim.name} 甩了... 💔`, 'bad', sim.id);
            } else if (finalType.special === 'propose') {
                 let proposeThreshold = 90;
                 if (goalComp > 10) proposeThreshold = 80; 
                 
                 if (partner.relationships[sim.id].romance > proposeThreshold) {
                     GameStore.addLog(sim, `向 ${partner.name} 求婚成功！💍`, 'rel_event');
                     sim.addMemory(`向 ${partner.name} 求婚成功！我们将共度余生。`, 'life', partner.id);
                     partner.addMemory(`答应了 ${sim.name} 的求婚！💍`, 'life', sim.id);
                     sim.say("嫁给我吧！", 'love');
                     partner.say("我愿意！", 'love');
                 } else {
                     sim.say("我们结婚吧...", 'love');
                     partner.say("还没准备好...", 'normal');
                     GameStore.addLog(sim, `向 ${partner.name} 求婚被委婉拒绝了。`, 'rel_event');
                     sim.addMemory(`向 ${partner.name} 求婚被拒，可能太着急了。`, 'bad', partner.id);
                     sim.addBuff(BUFFS.rejected);
                 }
            } else if (finalType.special === 'marriage') {
                SocialLogic.marry(sim, partner);
            }
            else if (finalType.special === 'divorce') {
                SocialLogic.divorce(sim, partner);
            }
            else if (finalType.special === 'try_baby') {
                const bothWant = sim.mood > 50 && partner.mood > 50 && sim.money > 500;
                if (bothWant) {
                    let prob = (sim.constitution + sim.luck + partner.constitution + partner.luck) / 400;
                    if (Math.random() < prob) {
                        const carrier = SocialLogic.determinePregnantSim(sim, partner);
                        
                        if (carrier) {
                            carrier.isPregnant = true;
                            carrier.pregnancyTimer = 1440; 
                            carrier.partnerForBabyId = (carrier === sim) ? partner.id : sim.id;
                            carrier.addBuff(BUFFS.pregnant);
                            
                            GameStore.addLog(sim, `与 ${partner.name} 备孕成功！期待新生命的降临 👶`, 'family');
                            carrier.say("我要有宝宝了！", 'love');
                            if (carrier !== sim) sim.say("我要当爸爸/妈妈了！", 'love');
                            else partner.say("我要当爸爸/妈妈了！", 'love');
                        } else {
                            sim.say("身体状况不太好...", 'bad');
                        }
                    } else {
                        sim.say("好像没怀上...", 'normal');
                    }
                } else {
                    sim.say("现在不是时候...", 'bad');
                }
            }
            else if (finalType.special === 'woohoo') {
                const isSafe = Math.random() > 0.3; 
                sim.say("WooHoo! 💕", 'love');
                partner.say("💕", 'love');
                sim.needs.fun = 100;
                partner.needs.fun = 100;
                
                if (!isSafe && Math.random() < 0.2) { 
                     const carrier = SocialLogic.determinePregnantSim(sim, partner);
                     if (carrier && !carrier.isPregnant) {
                         carrier.isPregnant = true;
                         carrier.pregnancyTimer = 1440;
                         carrier.partnerForBabyId = (carrier === sim) ? partner.id : sim.id;
                         carrier.addBuff(BUFFS.pregnant);
                         GameStore.addLog(carrier, `糟糕，意外怀孕了...`, 'family');
                     }
                }
            } else {
                let val = finalType.val;
                
                val += goalComp * 0.5; 

                if (finalType.type === 'romance') {
                    rel.hasRomance = true;
                    partner.relationships[sim.id].hasRomance = true;
                }

                if (finalType.id === 'argue' && rel.romance > 60) {
                    SocialLogic.updateRelationship(sim, partner, 'romance', -15);
                    SocialLogic.updateRelationship(partner, sim, 'romance', -15);
                }

                SocialLogic.updateRelationship(sim, partner, finalType.type, val * sim.socialModifier);
                SocialLogic.updateRelationship(partner, sim, finalType.type, val * partner.socialModifier);

                if (finalType.logType === 'love') {
                    GameStore.spawnHeart(sim.pos.x, sim.pos.y);
                    GameStore.sims.forEach(s => {
                        if (s.id !== sim.id && s.id !== partner.id) {
                            const dist = Math.sqrt(Math.pow(sim.pos.x - s.pos.x, 2) + Math.pow(sim.pos.y - s.pos.y, 2));
                            if (dist < 150) SocialLogic.triggerJealousy(s, sim, partner);
                        }
                    });
                }

                // 智能对话生成 (婴幼儿处理)
                let text = SocialLogic.getDialogue(sim, finalType.id, partner);
                sim.say(text, finalType.logType === 'love' ? 'love' : (finalType.logType === 'bad' ? 'bad' : 'normal'));
                
                setTimeout(() => {
                    let replyType = finalType.id;
                    if (finalType.id === 'pickup') replyType = 'greet'; 
                    if (finalType.id === 'confess') replyType = 'flirt';

                    if (finalType.id === 'joke') {
                        // 婴幼儿不会笑
                        partner.say([AgeStage.Infant, AgeStage.Toddler].includes(partner.ageStage) ? "👶" : "哈哈哈哈！", 'normal');
                    } else {
                        const replyText = SocialLogic.getDialogue(partner, replyType, sim);
                        partner.say(replyText, finalType.logType === 'love' ? 'love' : (finalType.logType === 'bad' ? 'bad' : 'normal'));
                    }
                }, 800);

                let sign = val > 0 ? '+' : '';
                let labelStr = finalType.type === 'romance' ? '浪漫' : '友谊';
                if (finalType.special !== 'confess' && finalType.special !== 'breakup' && finalType.special !== 'propose') {
                    GameStore.addLog(sim, `与 ${partner.name} ${finalType.label} (${labelStr} ${sign}${Math.floor(val)})`, finalType.logType);
                }
            }
        } else {
            sim.say("...", 'bad');
            setTimeout(() => partner.say("不要...", 'bad'), 800);
            
            SocialLogic.updateRelationship(sim, partner, finalType.type, -5);
            GameStore.addLog(sim, `想对 ${partner.name} ${finalType.label} 但被拒绝了。`, 'bad');
            
            if (finalType.type === 'romance') {
                sim.addBuff(BUFFS.rejected);
            }
        }

        SocialLogic.checkRelChange(sim, partner, oldLabel);
    }
};