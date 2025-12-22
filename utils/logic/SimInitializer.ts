import { Sim } from '../Sim';
import { SimData, AgeStage, NeedType, SimAppearance } from '../../types';
import { CONFIG, AGE_CONFIG, SURNAMES, GIVEN_NAMES, ASSET_CONFIG, MBTI_TYPES, ZODIACS, LIFE_GOALS, JOBS, BASE_DECAY } from '../../constants';

// 🆕 辅助函数：根据年龄获取资源池
export const getAssetPool = (stage: AgeStage) => {
    if (stage === AgeStage.Infant) return ASSET_CONFIG.infant;
    if (stage === AgeStage.Toddler || stage === AgeStage.Child) return ASSET_CONFIG.child;
    return ASSET_CONFIG.adult; // Teen, Adult, Elder
};

// [修改] 扩充配置接口，支持属性传入（用于遗传和自定义捏人）
export interface SimInitConfig {
    x?: number;
    y?: number;
    name?: string; // 🆕 支持直接传入全名
    surname?: string;
    familyId?: string;
    ageStage?: AgeStage;
    gender?: 'M' | 'F';
    partnerId?: string;
    fatherId?: string;
    motherId?: string;
    orientation?: string;
    homeId?: string | null;
    money?: number; 
    traits?: string[]; 
    familyLore?: string; 
    workplaceId?: string; 
    
    // 🆕 外观自定义支持
    skinColor?: string;
    hairColor?: string;
    clothesColor?: string;
    pantsColor?: string;
    appearance?: SimAppearance;
    
    // 🆕 属性自定义支持
    mbti?: string;
    lifeGoal?: string;
    zodiac?: any; // 虽然通常随机，但允许覆盖

    // 属性字段
    iq?: number;
    eq?: number;
    constitution?: number;
    appearanceScore?: number;
    luck?: number;
    creativity?: number;
    morality?: number;
    
    // 🆕 身高体重自定义
    height?: number;
    weight?: number;
}

export const SimInitializer = {
    initialize(sim: Sim, config: SimInitConfig) {
        sim.id = Math.random().toString(36).substring(2, 11);
        sim.familyId = config.familyId || sim.id;
        sim.homeId = config.homeId || null;
        sim.workplaceId = config.workplaceId; 

        sim.pos = {
            x: config.x ?? (50 + Math.random() * (CONFIG.CANVAS_W - 100)),
            y: config.y ?? (50 + Math.random() * (CONFIG.CANVAS_H - 100))
        };
        sim.prevPos = { ...sim.pos }; 
        
        sim.speed = (1.5 + Math.random() * 1.0) * 1.5;

        sim.gender = config.gender || (Math.random() > 0.5 ? 'M' : 'F');

        // 年龄与体型
        sim.ageStage = config.ageStage || AgeStage.Adult;
        const stageConfig = AGE_CONFIG[sim.ageStage];
        sim.age = stageConfig.min + Math.floor(Math.random() * (stageConfig.max - stageConfig.min));

        // [修复] 优先使用 Config 中的身高体重，否则随机生成
        if (config.height !== undefined && config.weight !== undefined) {
            sim.height = config.height;
            sim.weight = config.weight;
        } else {
            if (sim.ageStage === AgeStage.Infant) { sim.height = 50 + Math.random() * 25; sim.weight = 3 + Math.random() * 7; } 
            else if (sim.ageStage === AgeStage.Toddler) { sim.height = 80 + Math.random() * 20; sim.weight = 10 + Math.random() * 6; } 
            else if (sim.ageStage === AgeStage.Child) { sim.height = 110 + Math.random() * 30; sim.weight = 20 + Math.random() * 15; } 
            else if (sim.ageStage === AgeStage.Teen) { sim.height = 150 + Math.random() * 25; sim.weight = 40 + Math.random() * 25; } 
            else {
                const baseHeight = sim.gender === 'M' ? 175 : 163;
                sim.height = baseHeight + Math.floor((Math.random() - 0.5) * 20); 
                const bmi = 18 + Math.random() * 8; 
                sim.weight = Math.floor((sim.height / 100) * (sim.height / 100) * bmi);
            }
        }
        sim.height = Math.floor(sim.height);
        sim.weight = Math.floor(sim.weight);
        
        // 属性初始化
        const rand = (Math.random() + Math.random() + Math.random()) / 3;
        sim.appearanceScore = config.appearanceScore ?? Math.floor(rand * 100);
        sim.luck = config.luck ?? Math.floor(Math.random() * 100);
        const constRand = (Math.random() + Math.random()) / 2;
        sim.constitution = config.constitution ?? Math.floor(constRand * 100);
        sim.eq = config.eq ?? Math.floor(Math.random() * 100);
        const iqRand = (Math.random() + Math.random() + Math.random()) / 3;
        sim.iq = config.iq ?? Math.floor(iqRand * 100);
        sim.reputation = Math.floor(Math.random() * 40); 
        sim.morality = config.morality ?? Math.floor(Math.random() * 100);
        sim.creativity = config.creativity ?? Math.floor(Math.random() * 100);
        
        if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
            sim.constitution = Math.min(sim.constitution, 60); 
        }

        // 身份 (支持自定义姓名)
        if (config.name) {
            sim.name = config.name;
            sim.surname = config.surname || sim.name.substring(0, 1); // 简单猜测姓氏
        } else {
            sim.surname = config.surname || SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
            sim.name = sim.surname + GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)];
        }
        
        // 外观 (支持自定义颜色配置) - 仍然保留颜色字段以备不时之需（例如 UI 文字颜色）
        sim.skinColor = config.skinColor || CONFIG.COLORS.skin[Math.floor(Math.random() * CONFIG.COLORS.skin.length)];
        // 🆕 修改：发色初始化逻辑
        if (config.hairColor) {
            sim.hairColor = config.hairColor;
        } else {
            if (sim.ageStage === AgeStage.Elder) {
                // 老年人强制灰白发系
                const greyTones = ['#dcdde1', '#b2bec3', '#7f8fa6', '#f5f6fa', '#dfe4ea'];
                sim.hairColor = greyTones[Math.floor(Math.random() * greyTones.length)];
            } else {
                // 其他年龄段随机
                sim.hairColor = CONFIG.COLORS.hair[Math.floor(Math.random() * CONFIG.COLORS.hair.length)];
            }
        }
        sim.clothesColor = config.clothesColor || CONFIG.COLORS.clothes[Math.floor(Math.random() * CONFIG.COLORS.clothes.length)];
        sim.pantsColor = config.pantsColor || CONFIG.COLORS.pants[Math.floor(Math.random() * CONFIG.COLORS.pants.length)];

        // 🆕 核心修改：初始化三层图片资源
        if (config.appearance) {
            sim.appearance = config.appearance;
        } else {
            // 根据年龄获取对应的资源池
            const pool = getAssetPool(sim.ageStage);
            
            const pick = (list: string[]) => list.length > 0 ? list[Math.floor(Math.random() * list.length)] : '';
            
            sim.appearance = {
                body: pick(pool.bodies),
                outfit: pick(pool.outfits),
                hair: pick(pool.hairs),
                face: '', clothes: '', pants: ''
            };
        }

        // 性格
        sim.mbti = config.mbti || MBTI_TYPES[Math.floor(Math.random() * MBTI_TYPES.length)];
        sim.zodiac = config.zodiac || ZODIACS[Math.floor(Math.random() * ZODIACS.length)];
        sim.traits = config.traits || [];
        sim.familyLore = config.familyLore;

        sim.health = 90 + Math.random() * 10; 
        sim.lifeGoal = config.lifeGoal || LIFE_GOALS[Math.floor(Math.random() * LIFE_GOALS.length)];

        // 关系
        sim.partnerId = config.partnerId || null;
        sim.fatherId = config.fatherId || null;
        sim.motherId = config.motherId || null;

        if (config.orientation) { sim.orientation = config.orientation; } 
        else { const r = Math.random(); sim.orientation = r < 0.7 ? 'hetero' : (r < 0.85 ? 'homo' : 'bi'); }

        let baseFaith = sim.mbti.includes('J') ? 70 : 40;
        sim.faithfulness = Math.min(100, Math.max(0, baseFaith + (Math.random() * 40 - 20)));

        // 需求
        const randNeed = () => 60 + Math.floor(Math.random() * 40);
        sim.needs = { 
            [NeedType.Hunger]: randNeed(), 
            [NeedType.Energy]: randNeed(), 
            [NeedType.Fun]: randNeed(), 
            [NeedType.Social]: randNeed(), 
            [NeedType.Bladder]: randNeed(), 
            [NeedType.Hygiene]: randNeed(),
            [NeedType.Comfort]: 100
        };

        // 技能初始化
        sim.skills = { cooking: 0, athletics: 0, music: 0, dancing: 0, logic: 0, creativity: 0, gardening: 0, fishing: 0, charisma: 0 };

        if (![AgeStage.Infant, AgeStage.Toddler, AgeStage.Child].includes(sim.ageStage)) {
            const skillBonus = sim.ageStage === AgeStage.Elder ? 45 : (sim.ageStage === AgeStage.MiddleAged ? 30 : 15);
            Object.keys(sim.skills).forEach(key => {
                if (Math.random() < 0.3) {
                    let val = Math.floor(Math.random() * skillBonus);
                    if (sim.mbti.includes('N') && ['logic', 'creativity'].includes(key)) val += 10;
                    if (sim.mbti.includes('S') && ['athletics', 'cooking'].includes(key)) val += 10;
                    if (sim.mbti.includes('E') && ['charisma', 'dancing'].includes(key)) val += 10;
                    if (sim.constitution > 80 && key === 'athletics') val += 15;
                    sim.skills[key] = Math.min(100, val);
                }
            });
        }
        
        sim.relationships = {};

        // 经济
        if (config.money !== undefined) { sim.money = config.money; } 
        else { sim.money = 500 + Math.floor(Math.random() * 1000); }
        
        if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) { 
            sim.money = 0; 
        } else if ([AgeStage.Child, AgeStage.Teen].includes(sim.ageStage)) {
            sim.money = 50 + Math.floor(Math.random() * 50); 
        }

        // 初始化修饰符
        sim.metabolism = {};
        for (let key in BASE_DECAY) sim.metabolism[key] = 1.0;
        if ([AgeStage.Infant, AgeStage.Toddler].includes(sim.ageStage)) {
            sim.metabolism[NeedType.Hunger] = 1.5;
            sim.metabolism[NeedType.Energy] = 1.3;
        }

        sim.skillModifiers = {};
        for (let key in sim.skills) sim.skillModifiers[key] = 1.0;
        sim.socialModifier = 1.0;

        sim.buffs = []; sim.mood = 80;

        // 应用特质影响
        sim.applyTraits();

        // 职业分配
        sim.job = JOBS.find(j => j.id === 'unemployed')!;
        
        sim.dailyExpense = 0; sim.dailyIncome = 0; sim.dailyBudget = 0; sim.workPerformance = 0;
        sim.actionTimer = 0;
    }
};