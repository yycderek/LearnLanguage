import type { CoursePack, CourseStep, Exercise, KnowledgeItem, LocalizedText, Utterance } from "@learn-language/protocol";
import { spanishA1Extension } from "./spanish-a1-extension.ts";

const l = (zh: string, en: string): LocalizedText => ({ "zh-CN": zh, en });
const target = (value: string): LocalizedText => ({ "zh-CN": value, en: value, native: value });
const reading = (value: string) => ({ latin: value });

type Plan = {
  id: string;
  title: LocalizedText;
  goalRef: string;
  goal: LocalizedText;
  knowledgeRefs: string[];
  utteranceRefs: string[];
  recognition: string;
  guided: string;
  task: string;
  reading?: string;
  diagnostic?: boolean;
  capstone?: { title: LocalizedText; exerciseRef: string; knowledgeRefs: string[]; utteranceRefs: string[] };
};

function steps(plan: Plan): CourseStep[] {
  const result: CourseStep[] = [
    { id: "diagnose", phase: "diagnostic", title: l("检查已有知识", "Check what you already know"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [plan.recognition], next: ["preteach", "diagnostic-skip"], diagnostic: { learnNextStepId: "preteach", passNextStepId: "diagnostic-skip" } },
    { id: "preteach", phase: "preteach", title: l("学习本课核心表达", "Learn the essential expressions"), supportLevel: "full", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [], next: ["supported-input"] },
    { id: "supported-input", phase: "supported-input", title: l("带翻译理解场景", "Understand the scene with translation"), supportLevel: "full", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [], next: ["target-input"] },
    { id: "target-input", phase: "supported-input", title: l("只看西班牙语材料", "Read only the Spanish material"), supportLevel: "target-language-only", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [], next: [plan.reading ? "reading-comprehension" : "independent-input"] },
    ...(plan.reading ? [{ id: "reading-comprehension", phase: "comprehension" as const, title: l("阅读短文并提取信息", "Read a short text and extract information"), supportLevel: "none" as const, knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs.filter((id) => id.includes("reading-")), exerciseRefs: [plan.reading], next: ["independent-input"] }] : []),
    { id: "independent-input", phase: "comprehension", title: l("独立理解关键信息", "Understand the key information"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [plan.recognition], next: ["guided-output"] },
    { id: "guided-output", phase: "guided-output", title: l("重组本课表达", "Rebuild the lesson expression"), supportLevel: "target-language-only", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [plan.guided], next: ["independent-task"] },
    { id: "independent-task", phase: "independent-task", title: l("独立完成场景任务", "Complete the scene independently"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [plan.task], next: ["feedback-retry"] },
    { id: "feedback-retry", phase: "feedback-retry", title: l("根据反馈重新表达", "Retry with feedback"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [plan.task], next: ["delayed-transfer"] },
    { id: "delayed-transfer", phase: "delayed-transfer", title: l("迁移到相似场景", "Transfer to a similar scene"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [plan.task], next: plan.capstone ? ["integrated-capstone"] : [] },
    { id: "diagnostic-skip", phase: "diagnostic", title: plan.capstone ? l("检查通过：进入阶段综合任务", "Diagnostic passed: continue to the stage checkpoint") : l("检查通过：完成本课", "Diagnostic passed: complete the lesson"), supportLevel: "none", knowledgeRefs: [], utteranceRefs: [], exerciseRefs: [], next: plan.capstone ? ["integrated-capstone"] : [] },
  ];
  if (plan.capstone) result.push({ id: "integrated-capstone", phase: "delayed-transfer", title: plan.capstone.title, supportLevel: "none", knowledgeRefs: plan.capstone.knowledgeRefs, utteranceRefs: plan.capstone.utteranceRefs, exerciseRefs: [plan.capstone.exerciseRef], next: [] });
  if (!plan.diagnostic) {
    result.splice(result.findIndex((step) => step.id === "diagnostic-skip"), 1);
    const diagnostic = result[0]!;
    diagnostic.exerciseRefs = [];
    diagnostic.next = ["preteach"];
    delete diagnostic.diagnostic;
  }
  return result;
}

function k(id: string, kind: KnowledgeItem["kind"], form: string, zh: string, en: string, usageZh: string, usageEn: string, tags: string[] = []): KnowledgeItem {
  return { id, kind, form, reading: reading(form), meaning: l(zh, en), usage: l(usageZh, usageEn), tags };
}

function u(id: string, text: string, zh: string, en: string, refs: string[]): Utterance {
  return { id, text, translation: l(zh, en), reading: reading(text), knowledgeRefs: refs };
}

function single(id: string, zh: string, en: string, options: LocalizedText[], answer: number, guidanceZh: string, guidanceEn: string, knowledgeRefs: string[], utteranceRefs: string[]): Exercise {
  return { id, kind: "single-choice", prompt: l(zh, en), options, correctOptionIndex: answer, guidance: l(guidanceZh, guidanceEn), knowledgeRefs, utteranceRefs };
}

function multiple(id: string, zh: string, en: string, options: LocalizedText[], answers: number[], guidanceZh: string, guidanceEn: string, knowledgeRefs: string[], utteranceRefs: string[]): Exercise {
  return { id, kind: "multiple-choice", prompt: l(zh, en), options, correctOptionIndices: answers, guidance: l(guidanceZh, guidanceEn), knowledgeRefs, utteranceRefs };
}

function ordering(id: string, zh: string, en: string, parts: string[], order: number[], guidanceZh: string, guidanceEn: string, knowledgeRefs: string[], utteranceRefs: string[]): Exercise {
  return { id, kind: "ordering", prompt: l(zh, en), options: parts.map(target), correctOrder: order, guidance: l(guidanceZh, guidanceEn), knowledgeRefs, utteranceRefs };
}

function shortInput(id: string, zh: string, en: string, answers: string[], guidanceZh: string, guidanceEn: string, knowledgeRefs: string[], utteranceRefs: string[]): Exercise {
  return { id, kind: "short-input", prompt: l(zh, en), acceptedAnswers: answers, guidance: l(guidanceZh, guidanceEn), knowledgeRefs, utteranceRefs, evaluationSources: ["deterministic"] };
}

function role(id: string, zh: string, en: string, guidanceZh: string, guidanceEn: string, knowledgeRefs: string[], utteranceRefs: string[] = []): Exercise {
  return { id, kind: "role-play", prompt: l(zh, en), guidance: l(guidanceZh, guidanceEn), knowledgeRefs, utteranceRefs, rubricRef: "cafe-task-rubric", requiredCapabilities: ["token-comparison"], capabilityFallback: "self-assessment", evaluationSources: ["self", "ai-assisted"] };
}

export function spanishStarterCourse(): CoursePack {
  const knowledge: KnowledgeItem[] = [
    k("es-alphabet", "script", "A–Z, ñ", "西班牙语字母表", "the Spanish alphabet", "使用拉丁字母；ñ是独立字母。", "Spanish uses the Latin alphabet, and ñ is a distinct letter.", ["foundation", "writing-system", "alphabet"]),
    k("es-vowels", "script", "a, e, i, o, u", "五个元音字母", "the five vowel letters", "先识别书面元音；本课不进行发音评分。", "Recognize the written vowels; this course does not score pronunciation.", ["foundation", "writing-system", "alphabet"]),
    k("es-accent-marks", "script", "á, é, í, ó, ú, ü", "重音符号和分音符", "accent marks and diaeresis", "重音符号属于拼写的一部分；ü表示字母u在特定组合中需要读出。", "Accent marks are part of spelling; ü marks a pronounced u in specific combinations.", ["foundation", "writing-system", "accent"]),
    k("es-inverted-signs", "script", "¿...? / ¡...!", "倒置问号与感叹号", "opening question and exclamation marks", "直接疑问句和感叹句使用开头与结尾成对符号。", "Direct questions and exclamations use paired opening and closing marks.", ["foundation", "writing-system", "punctuation"]),
    k("es-capitalization", "script", "España / español", "专名大写与语言名小写", "capitalized names and lowercase language names", "国家和人名大写；语言名称通常小写。", "Countries and personal names are capitalized; language names are normally lowercase.", ["foundation", "writing-system", "capitalization"]),

    k("es-subject-pronouns", "grammar", "yo / tú / él / ella / usted", "基础主语代词", "basic subject pronouns", "动词形式常已显示人称，因此主语代词可省略；本课保留它们帮助识别。", "Verb forms often identify the subject, so pronouns may be omitted; this lesson keeps them visible for recognition.", ["foundation", "grammar"]),
    k("es-ser", "grammar", "soy / eres / es", "ser的基础变位", "basic forms of ser", "用ser说明名字、身份、国籍等较稳定信息。", "Use ser for names, identity, nationality, and other identifying information.", ["foundation", "grammar"]),
    k("es-ser-negative", "grammar", "no soy / no eres / no es", "ser的基础否定", "basic negation with ser", "把no放在变位动词前。", "Put no before the conjugated verb.", ["foundation", "grammar"]),
    k("es-indefinite-articles", "grammar", "un / una", "不定冠词", "indefinite articles", "un常配阳性单数名词，una常配阴性单数名词。", "Un commonly accompanies masculine singular nouns; una commonly accompanies feminine singular nouns.", ["foundation", "grammar"]),
    k("es-professions", "lexeme", "estudiante / profesor / profesora", "学生／教师", "student / teacher", "职业名词用于说明身份；部分形式随性别变化。", "Profession nouns state identity; some forms vary with gender.", ["foundation", "identity", "reading"]),

    k("es-noun-gender", "grammar", "libro / mesa", "名词的语法性别", "grammatical gender of nouns", "词尾能提供线索，但不能可靠决定所有名词的性别，应连同冠词学习。", "Endings provide clues but do not determine every noun's gender; learn nouns with their articles.", ["foundation", "grammar"]),
    k("es-definite-articles", "grammar", "el / la / los / las", "定冠词", "definite articles", "冠词与名词在性和数上保持一致。", "Articles agree with nouns in gender and number.", ["foundation", "grammar"]),
    k("es-plurals", "grammar", "libro / libros; papel / papeles", "基础复数", "basic plurals", "元音结尾常加-s，许多辅音结尾词加-es。", "Vowel-final nouns commonly add -s; many consonant-final nouns add -es.", ["foundation", "grammar"]),
    k("es-adjective-agreement", "grammar", "libro rojo / mesa roja", "形容词性数一致", "adjective agreement", "可变形容词通常与所修饰名词保持性和数一致。", "Variable adjectives normally agree with the noun in gender and number.", ["foundation", "grammar"]),
    k("es-basic-order", "grammar", "artículo + nombre + adjetivo", "基础名词短语词序", "basic noun-phrase order", "基础描述中形容词常放在名词后。", "In basic descriptions, adjectives commonly follow the noun.", ["foundation", "grammar"]),

    k("es-greetings", "pragmatics", "Hola / Buenos días / Buenas tardes", "问候语", "greetings", "根据场合和时间选择基础问候。", "Choose a basic greeting according to context and time.", ["foundation", "greeting", "reading"]),
    k("es-name-pattern", "grammar", "Me llamo... / Soy...", "我叫……／我是……", "state your name", "两种形式都可用于自我介绍。", "Both forms can introduce your name.", ["foundation", "identity", "reading"]),
    k("es-ask-name", "grammar", "¿Cómo te llamas?", "你叫什么名字？", "ask someone's name", "用于非正式场合询问名字。", "Use this to ask someone's name in an informal context.", ["foundation", "identity"]),
    k("es-origin", "grammar", "¿De dónde eres? / Soy de...", "询问并说明来自哪里", "ask and state origin", "de后接城市或国家。", "Put a city or country after de.", ["foundation", "identity", "reading"]),
    k("es-nationalities", "lexeme", "mexicano/a, español/a, chino/a", "国籍形容词", "nationality adjectives", "国籍形容词通常小写，并按所指对象变化。", "Nationality adjectives are normally lowercase and often agree with the person described.", ["foundation", "identity", "reading"]),

    k("es-numbers", "lexeme", "cero–veinte", "零到二十", "zero through twenty", "用于时间、日期、价格和数量。", "Used for time, dates, prices, and quantities.", ["a1-core", "reading"]),
    k("es-ask-time", "grammar", "¿Qué hora es?", "几点了？", "ask the time", "询问当前时间。", "Ask for the current time.", ["a1-core"]),
    k("es-tell-time", "grammar", "Es la una / Son las tres", "说明整点时间", "tell the hour", "一点使用单数，其他整点通常使用复数。", "One o'clock uses the singular form; other hours normally use the plural.", ["a1-core", "reading"]),
    k("es-days-dates", "lexeme", "hoy / lunes / martes", "今天与星期", "today and weekdays", "用于说明日期、开放日和行程。", "Used for dates, opening days, and schedules.", ["a1-core", "reading"]),
    k("es-opening-hours", "grammar", "abre a... / cierra a...", "开门与关门时间", "opening and closing times", "告示中用于说明营业时间。", "Used on notices to state opening and closing times.", ["a1-core", "reading"]),

    k("es-estar", "grammar", "estoy / estás / está", "estar的基础变位", "basic forms of estar", "用estar说明人或事物的位置。", "Use estar to state the location of people and things.", ["a1-core", "grammar", "reading"]),
    k("es-where", "grammar", "¿Dónde está...?", "……在哪里？", "ask where something is", "把要找的单数地点或事物放在está后。", "Put the singular place or thing being sought after está.", ["a1-core"]),
    k("es-here-there", "lexeme", "aquí / allí", "这里／那里", "here / there", "用于指出近处或较远处的位置。", "Used to indicate a nearby or more distant location.", ["a1-core", "reading"]),
    k("es-location-negative", "grammar", "No está aquí.", "它不在这里", "it is not here", "no放在está前构成基础否定。", "Put no before está to form the basic negative.", ["a1-core", "grammar"]),
    k("es-place-words", "lexeme", "baño / estación / salida", "洗手间／车站／出口", "restroom / station / exit", "基础问路和公共空间词汇。", "Basic vocabulary for directions and public places.", ["a1-core", "reading"]),

    k("es-demonstratives", "grammar", "este / esta", "这个／这个（阴性）", "this in masculine and feminine forms", "与所指单数名词的语法性别保持一致。", "Agree with the grammatical gender of the singular noun.", ["a1-core", "grammar", "reading"]),
    k("es-price-question", "grammar", "¿Cuánto cuesta?", "多少钱？", "ask a price", "用于询问一个物品的价格。", "Use this to ask the price of one item.", ["a1-core", "reading"]),
    k("es-euros", "lexeme", "euro / euros", "欧元", "euro / euros", "数字后用euro或euros表示价格。", "Use euro or euros after a number to state a price.", ["a1-core", "reading"]),
    k("es-shopping-items", "lexeme", "agua / pan / café", "水／面包／咖啡", "water / bread / coffee", "商店和价格表中的基础商品词。", "Basic items in shops and price lists.", ["a1-core", "reading"]),
    k("es-want", "grammar", "Quiero...", "我想要……", "I want...", "后接所需商品或服务；礼貌场景可加por favor。", "Follow with the wanted item or service; add por favor in polite contexts.", ["a1-core", "grammar"]),

    k("es-excuse-me", "pragmatics", "Perdón / Disculpe", "不好意思／劳驾", "excuse me", "问路或引起注意时使用；Disculpe较正式。", "Use this to get attention or ask directions; Disculpe is more formal.", ["a1-core"]),
    k("es-how-get", "grammar", "¿Cómo llego a...?", "我怎么去……？", "ask how to reach a place", "a后接目的地。", "Put the destination after a.", ["a1-core", "reading"]),
    k("es-go-to", "grammar", "va a...", "去……", "goes to...", "用于确认交通工具的目的地。", "Used to confirm a transport destination.", ["a1-core", "reading"]),
    k("es-transport", "lexeme", "autobús / tren / aeropuerto", "公交车／列车／机场", "bus / train / airport", "基础交通工具和目的地词汇。", "Basic transport and destination vocabulary.", ["a1-core", "reading"]),
    k("es-directions", "lexeme", "derecha / izquierda / todo recto", "右边／左边／一直走", "right / left / straight ahead", "用于简短路线说明。", "Used in short route directions.", ["a1-core", "reading"]),

    k("es-help", "pragmatics", "¿Puede ayudarme?", "您能帮我吗？", "can you help me?", "礼貌请求帮助。", "A polite request for help.", ["a1-core"]),
    k("es-not-understand", "grammar", "No entiendo.", "我不明白", "I do not understand", "no放在动词前表示否定。", "Put no before the verb to negate it.", ["a1-core", "grammar"]),
    k("es-repeat", "pragmatics", "Repita, por favor.", "请再说一遍", "please repeat", "正式或陌生人场景中请求重复。", "Ask for repetition in a formal or unfamiliar interaction.", ["a1-core"]),
    k("es-slowly", "pragmatics", "Más despacio, por favor.", "请慢一点", "more slowly, please", "请求对方放慢速度。", "Ask the other person to speak more slowly.", ["a1-core"]),

    k("es-polite-order", "grammar", "Quisiera...", "我想要……", "I would like...", "用于较礼貌地点单或提出请求。", "Use this to order or request something politely.", ["a1-core"]),
    k("es-drinks", "lexeme", "café / té / agua", "咖啡／茶／水", "coffee / tea / water", "菜单中的基础饮料词。", "Basic drink words on a menu.", ["a1-core", "reading"]),
    k("es-please", "pragmatics", "por favor", "请", "please", "放在请求中表示礼貌。", "Adds politeness to a request.", ["a1-core"]),
    k("es-menu", "lexeme", "menú", "菜单", "menu", "用于查看可选食品和饮料。", "Used to view available food and drinks.", ["a1-core", "reading"]),

    k("es-quantity", "grammar", "un café / dos cafés", "一个／两个", "one / two items", "数量词与名词搭配，多个时名词使用复数。", "Quantity words combine with nouns; plural nouns are used for more than one.", ["a1-core", "grammar"]),
    k("es-size-agreement", "grammar", "pequeño/a / grande", "小／大", "small / large", "pequeño随名词性别变化，grande在这些单数形式中不变。", "Pequeño varies with gender; grande keeps the same form in these singular examples.", ["a1-core", "grammar"]),
    k("es-with-without", "grammar", "con / sin", "加／不加", "with / without", "说明配料或附加内容。", "Specify an ingredient or its absence.", ["a1-core", "grammar"]),
    k("es-temperature", "grammar", "caliente / frío / fría", "热／冷", "hot / cold", "frío随所修饰名词变化；caliente在这些单数形式中不变。", "Frío varies with the noun; caliente keeps the same form in these singular examples.", ["a1-core", "grammar"]),
    k("es-preference", "grammar", "Prefiero...", "我更喜欢……", "I prefer...", "用于在两个选项之间表达偏好。", "Use this to express a preference between options.", ["a1-core"]),

    k("es-here-takeaway", "pragmatics", "para aquí / para llevar", "堂食／外带", "for here / to take away", "用于餐饮服务场景说明用餐方式；地区可能有其他常用表达。", "Used to state dining mode; other expressions are common in different regions.", ["a1-core"]),
    k("es-anything-else", "pragmatics", "¿Algo más?", "还需要别的吗？", "anything else?", "服务人员确认是否继续点单。", "A service worker checks whether the order continues.", ["a1-core"]),
    k("es-nothing-else", "pragmatics", "Nada más.", "没有别的了", "nothing else", "用于结束点单。", "Use this to finish an order.", ["a1-core"]),
    k("es-thanks", "pragmatics", "Gracias.", "谢谢", "thank you", "在完成请求或交易时表示感谢。", "Express thanks after a request or transaction.", ["a1-core"]),
  ];

  const utterances: Utterance[] = [
    u("es-vowel-line", "a, e, i, o, u", "五个元音字母", "the five vowel letters", ["es-vowels"]),
    u("es-spelling-question", "¿Cómo se escribe?", "怎么拼写？", "How is it spelled?", ["es-inverted-signs", "es-accent-marks"]),
    u("es-i-student", "Yo soy estudiante.", "我是学生。", "I am a student.", ["es-subject-pronouns", "es-ser", "es-professions"]),
    u("es-she-teacher", "Ella es profesora.", "她是教师。", "She is a teacher.", ["es-subject-pronouns", "es-ser", "es-professions"]),
    u("es-not-teacher", "No soy profesor.", "我不是教师。", "I am not a teacher.", ["es-ser-negative", "es-professions"]),
    u("es-red-book", "El libro rojo.", "红色的书。", "The red book.", ["es-definite-articles", "es-adjective-agreement", "es-basic-order"]),
    u("es-red-table", "La mesa roja.", "红色的桌子。", "The red table.", ["es-definite-articles", "es-adjective-agreement", "es-basic-order"]),
    u("es-two-books", "Dos libros rojos.", "两本红色的书。", "Two red books.", ["es-plurals", "es-adjective-agreement"]),
    u("es-introduction", "Hola. Me llamo Ana. Soy estudiante.", "你好，我叫安娜，是学生。", "Hello. My name is Ana. I am a student.", ["es-greetings", "es-name-pattern", "es-professions"]),
    u("es-ask-origin", "¿De dónde eres?", "你来自哪里？", "Where are you from?", ["es-origin", "es-inverted-signs"]),
    u("es-reading-profile", "Hola. Me llamo Ana. Soy estudiante y soy de México.", "你好，我叫安娜，是学生，来自墨西哥。", "Hello. My name is Ana. I am a student and I am from Mexico.", ["es-greetings", "es-name-pattern", "es-professions", "es-origin"]),
    u("es-time-three", "Son las tres.", "现在三点。", "It is three o'clock.", ["es-tell-time", "es-numbers"]),
    u("es-time-question", "¿Qué hora es?", "几点了？", "What time is it?", ["es-ask-time", "es-inverted-signs"]),
    u("es-reading-hours", "La biblioteca abre a las nueve y cierra a las cinco. Hoy es lunes.", "图书馆九点开门、五点关门。今天是星期一。", "The library opens at nine and closes at five. Today is Monday.", ["es-opening-hours", "es-tell-time", "es-days-dates"]),
    u("es-ask-restroom", "¿Dónde está el baño?", "洗手间在哪里？", "Where is the restroom?", ["es-where", "es-place-words", "es-definite-articles"]),
    u("es-station-there", "La estación está allí.", "车站在那里。", "The station is there.", ["es-estar", "es-place-words", "es-here-there"]),
    u("es-not-here", "No está aquí.", "它不在这里。", "It is not here.", ["es-location-negative", "es-here-there"]),
    u("es-ask-price", "¿Cuánto cuesta este pan?", "这个面包多少钱？", "How much does this bread cost?", ["es-price-question", "es-demonstratives", "es-shopping-items"]),
    u("es-want-water", "Quiero agua, por favor.", "我想要水，谢谢。", "I want water, please.", ["es-want", "es-shopping-items", "es-please"]),
    u("es-reading-prices", "Agua: dos euros. Pan: tres euros. Café: cuatro euros.", "水两欧元，面包三欧元，咖啡四欧元。", "Water: two euros. Bread: three euros. Coffee: four euros.", ["es-shopping-items", "es-euros", "es-numbers"]),
    u("es-ask-airport", "Perdón, ¿cómo llego al aeropuerto?", "劳驾，我怎么去机场？", "Excuse me, how do I get to the airport?", ["es-excuse-me", "es-how-get", "es-transport"]),
    u("es-bus-destination", "Este autobús va a la estación.", "这辆公交车去车站。", "This bus goes to the station.", ["es-go-to", "es-transport", "es-demonstratives"]),
    u("es-reading-route", "El autobús va al aeropuerto. La parada está a la derecha.", "公交车去机场。车站在右边。", "The bus goes to the airport. The stop is on the right.", ["es-go-to", "es-transport", "es-directions", "es-estar"]),
    u("es-request-help", "¿Puede ayudarme?", "您能帮我吗？", "Can you help me?", ["es-help", "es-inverted-signs"]),
    u("es-say-not-understand", "No entiendo.", "我不明白。", "I do not understand.", ["es-not-understand"]),
    u("es-repeat-slowly", "Repita más despacio, por favor.", "请慢一点再说一遍。", "Please repeat more slowly.", ["es-repeat", "es-slowly", "es-please"]),
    u("es-order-coffee", "Quisiera un café, por favor.", "我想要一杯咖啡。", "I would like a coffee, please.", ["es-polite-order", "es-drinks", "es-indefinite-articles", "es-please"]),
    u("es-order-tea", "Quisiera un té, por favor.", "我想要一杯茶。", "I would like a tea, please.", ["es-polite-order", "es-drinks", "es-indefinite-articles", "es-please"]),
    u("es-ask-menu", "El menú, por favor.", "请给我菜单。", "The menu, please.", ["es-menu", "es-please"]),
    u("es-two-coffees", "Dos cafés pequeños.", "两杯小咖啡。", "Two small coffees.", ["es-quantity", "es-size-agreement", "es-drinks"]),
    u("es-no-sugar", "Un café caliente sin azúcar.", "一杯不加糖的热咖啡。", "A hot coffee without sugar.", ["es-temperature", "es-with-without", "es-drinks"]),
    u("es-prefer-water", "Prefiero agua fría.", "我更喜欢冷水。", "I prefer cold water.", ["es-preference", "es-temperature", "es-drinks"]),
    u("es-here-or-away", "¿Para aquí o para llevar?", "堂食还是外带？", "For here or to take away?", ["es-here-takeaway", "es-inverted-signs"]),
    u("es-choose-away", "Para llevar, por favor.", "请外带。", "To take away, please.", ["es-here-takeaway", "es-please"]),
    u("es-finish-order", "Nada más, gracias.", "没有别的了，谢谢。", "Nothing else, thank you.", ["es-nothing-else", "es-thanks"]),
  ];

  const exercises: Exercise[] = [
    single("es-recognize-opening-question", "哪一种写法是完整的直接问句？", "Which form is a complete direct question?", [target("Cómo se escribe?"), target("¿Cómo se escribe?"), target("¡Cómo se escribe!")], 1, "西班牙语直接问句使用成对的¿和?。", "Spanish direct questions use paired ¿ and ? marks.", ["es-inverted-signs"], ["es-spelling-question"]),
    multiple("es-select-accented-letters", "选择所有包含重音或分音符的字母。", "Select every letter with an accent or diaeresis.", [target("á"), target("n"), target("ü"), target("o")], [0, 2], "á带重音符，ü带分音符。", "á has an accent mark and ü has a diaeresis.", ["es-accent-marks"], ["es-vowel-line"]),
    shortInput("es-type-question", "输入“怎么拼写？”，包含开头和结尾问号。", "Type 'How is it spelled?' with both question marks.", ["¿Cómo se escribe?"], "答案是¿Cómo se escribe?，Cómo保留重音符。", "The answer is ¿Cómo se escribe?, with the accent in Cómo.", ["es-inverted-signs", "es-accent-marks"], ["es-spelling-question"]),

    single("es-recognize-ser", "哪一句表示“我是学生”？", "Which sentence means 'I am a student'?", [target("Yo soy estudiante."), target("Ella es profesora."), target("No soy profesor.")], 0, "yo与soy搭配。", "Yo pairs with soy.", ["es-subject-pronouns", "es-ser", "es-professions"], ["es-i-student"]),
    ordering("es-order-teacher", "把词块排成“她是教师”。", "Order the chunks to say 'She is a teacher.'", ["profesora.", "Ella", "es"], [1, 2, 0], "顺序是主语＋变位动词＋身份。", "Use subject + conjugated verb + identity.", ["es-subject-pronouns", "es-ser", "es-professions"], ["es-she-teacher"]),
    shortInput("es-type-not-teacher", "输入“我不是教师”。", "Type 'I am not a teacher.'", ["No soy profesor.", "No soy profesor", "No soy profesora.", "No soy profesora"], "把no放在soy前。", "Put no before soy.", ["es-ser-negative", "es-professions"], ["es-not-teacher"]),

    single("es-recognize-article", "mesa应该使用哪个定冠词？", "Which definite article goes with mesa?", [target("el"), target("la"), target("los")], 1, "mesa是阴性单数名词，使用la。", "Mesa is feminine singular, so use la.", ["es-noun-gender", "es-definite-articles"], ["es-red-table"]),
    ordering("es-order-red-book", "把词块排成“红色的书”。", "Order the chunks to form 'the red book.'", ["rojo", "el", "libro"], [1, 2, 0], "基础描述常用冠词＋名词＋形容词。", "A basic description commonly uses article + noun + adjective.", ["es-definite-articles", "es-adjective-agreement", "es-basic-order"], ["es-red-book"]),
    shortInput("es-type-red-tables", "输入“红色的桌子”（复数）。", "Type 'the red tables.'", ["Las mesas rojas.", "Las mesas rojas"], "冠词、名词和形容词都使用阴性复数。", "The article, noun, and adjective all use feminine plural forms.", ["es-definite-articles", "es-plurals", "es-adjective-agreement"], ["es-red-table"]),

    single("es-recognize-name", "哪一句是在询问名字？", "Which sentence asks someone's name?", [target("¿Cómo te llamas?"), target("¿De dónde eres?"), target("Me llamo Ana.")], 0, "¿Cómo te llamas?用于询问名字。", "¿Cómo te llamas? asks someone's name.", ["es-ask-name"], ["es-introduction"]),
    ordering("es-order-introduction", "把词块排成“我叫安娜”。", "Order the chunks to say 'My name is Ana.'", ["Ana.", "Me", "llamo"], [1, 2, 0], "使用Me llamo＋名字。", "Use Me llamo + name.", ["es-name-pattern"], ["es-introduction"]),
    role("es-role-introduction", "向新同学问候，说明名字、身份和来自哪里。", "Greet a new classmate and state your name, identity, and origin.", "至少使用一个问候、Me llamo或Soy，以及Soy de。", "Use a greeting, Me llamo or Soy, and Soy de.", ["es-greetings", "es-name-pattern", "es-ser", "es-origin"], ["es-introduction", "es-ask-origin"]),
    single("es-read-profile", "阅读个人资料：安娜来自哪里？", "Read the profile: Where is Ana from?", [l("西班牙", "Spain"), l("墨西哥", "Mexico"), l("中国", "China")], 1, "短文最后写着soy de México。", "The profile ends with soy de México.", ["es-origin", "es-nationalities"], ["es-reading-profile"]),
    shortInput("es-capstone-foundation", "基础阶段综合：用西班牙语写“你好，我叫安娜，我是学生”。", "Foundation checkpoint: Write 'Hello, my name is Ana, and I am a student' in Spanish.", ["Hola. Me llamo Ana. Soy estudiante.", "Hola, me llamo Ana. Soy estudiante."], "组合Hola、Me llamo Ana和Soy estudiante。", "Combine Hola, Me llamo Ana, and Soy estudiante.", ["es-greetings", "es-name-pattern", "es-ser", "es-professions", "es-inverted-signs"], ["es-introduction"]),

    single("es-recognize-time", "Son las tres表示几点？", "What time is Son las tres?", [l("一点", "One o'clock"), l("三点", "Three o'clock"), l("五点", "Five o'clock")], 1, "tres表示三。", "Tres means three.", ["es-numbers", "es-tell-time"], ["es-time-three"]),
    ordering("es-order-time-question", "把词块排成“几点了？”。", "Order the chunks to ask the time.", ["hora", "¿Qué", "es?"], [1, 0, 2], "完整问句是¿Qué hora es?", "The full question is ¿Qué hora es?", ["es-ask-time", "es-inverted-signs"], ["es-time-question"]),
    shortInput("es-type-three", "输入“现在三点”。", "Type 'It is three o'clock.'", ["Son las tres.", "Son las tres"], "三点使用复数Son las。", "Three o'clock uses the plural Son las.", ["es-tell-time", "es-numbers"], ["es-time-three"]),
    single("es-read-hours", "阅读营业时间：图书馆几点关门？", "Read the hours: When does the library close?", [l("三点", "At three"), l("五点", "At five"), l("九点", "At nine")], 1, "cierra a las cinco表示五点关门。", "Cierra a las cinco means it closes at five.", ["es-opening-hours", "es-tell-time"], ["es-reading-hours"]),

    single("es-recognize-where", "哪个词表示“哪里”？", "Which word means 'where'?", [target("dónde"), target("aquí"), target("allí")], 0, "dónde用于询问地点。", "Dónde asks about a location.", ["es-where"], ["es-ask-restroom"]),
    ordering("es-order-restroom", "把词块排成“洗手间在哪里？”。", "Order the chunks to ask where the restroom is.", ["el baño?", "¿Dónde", "está"], [1, 2, 0], "使用¿Dónde está＋地点?", "Use ¿Dónde está + place?", ["es-where", "es-estar", "es-place-words"], ["es-ask-restroom"]),
    shortInput("es-type-not-here", "输入“它不在这里”。", "Type 'It is not here.'", ["No está aquí.", "No está aquí"], "no放在está前。", "Put no before está.", ["es-location-negative", "es-here-there"], ["es-not-here"]),

    single("es-recognize-price", "哪一句是在询问价格？", "Which sentence asks the price?", [target("¿Cuánto cuesta este pan?"), target("¿Dónde está el pan?"), target("Quiero pan.")], 0, "¿Cuánto cuesta...?询问价格。", "¿Cuánto cuesta...? asks a price.", ["es-price-question", "es-demonstratives"], ["es-ask-price"]),
    ordering("es-order-price-question", "把词块排成“这个面包多少钱？”。", "Order the chunks to ask how much this bread costs.", ["este pan?", "¿Cuánto", "cuesta"], [1, 2, 0], "使用¿Cuánto cuesta＋物品?", "Use ¿Cuánto cuesta + item?", ["es-price-question", "es-demonstratives", "es-shopping-items"], ["es-ask-price"]),
    shortInput("es-type-want-water", "输入“我想要水，谢谢”。", "Type 'I want water, please.'", ["Quiero agua, por favor.", "Quiero agua por favor."], "使用Quiero＋物品＋por favor。", "Use Quiero + item + por favor.", ["es-want", "es-shopping-items", "es-please"], ["es-want-water"]),
    single("es-read-prices", "阅读价格表：咖啡多少钱？", "Read the price list: How much is the coffee?", [l("两欧元", "Two euros"), l("三欧元", "Three euros"), l("四欧元", "Four euros")], 2, "价格表写着Café: cuatro euros。", "The list says Café: cuatro euros.", ["es-shopping-items", "es-euros", "es-numbers"], ["es-reading-prices"]),

    single("es-recognize-airport", "aeropuerto表示什么？", "What does aeropuerto mean?", [l("机场", "Airport"), l("车站", "Station"), l("出口", "Exit")], 0, "aeropuerto表示机场。", "Aeropuerto means airport.", ["es-transport"], ["es-ask-airport"]),
    ordering("es-order-route-question", "把词块排成“我怎么去机场？”。", "Order the chunks to ask how to reach the airport.", ["al aeropuerto?", "¿Cómo", "llego"], [1, 2, 0], "使用¿Cómo llego a...?", "Use ¿Cómo llego a...?", ["es-how-get", "es-transport"], ["es-ask-airport"]),
    role("es-role-directions", "礼貌询问如何去机场，并确认公交车目的地。", "Politely ask how to reach the airport and confirm the bus destination.", "使用Perdón、¿Cómo llego al aeropuerto?和va a。", "Use Perdón, ¿Cómo llego al aeropuerto?, and va a.", ["es-excuse-me", "es-how-get", "es-go-to", "es-transport"], ["es-ask-airport", "es-bus-destination"]),
    single("es-read-route", "阅读线路说明：车站在哪一边？", "Read the route information: Which side is the stop on?", [l("右边", "On the right"), l("左边", "On the left"), l("一直走", "Straight ahead")], 0, "a la derecha表示在右边。", "A la derecha means on the right.", ["es-directions", "es-estar"], ["es-reading-route"]),
    role("es-capstone-daily-life", "日常生活阶段综合：询问时间、商品价格和前往机场的路线。", "Daily-life checkpoint: Ask the time, an item's price, and the route to the airport.", "依次使用¿Qué hora es?、¿Cuánto cuesta...?和¿Cómo llego al aeropuerto?", "Use ¿Qué hora es?, ¿Cuánto cuesta...?, and ¿Cómo llego al aeropuerto?", ["es-ask-time", "es-price-question", "es-how-get", "es-transport", "es-shopping-items"], ["es-time-question", "es-ask-price", "es-ask-airport"]),

    single("es-recognize-help", "哪一句表示“我不明白”？", "Which sentence means 'I do not understand'?", [target("No entiendo."), target("¿Puede ayudarme?"), target("Gracias.")], 0, "No entiendo表示不明白。", "No entiendo means that you do not understand.", ["es-not-understand"], ["es-say-not-understand"]),
    ordering("es-order-repeat", "把词块排成“请慢一点再说一遍”。", "Order the chunks to ask for a slower repetition.", ["por favor.", "Repita", "más despacio,"], [1, 2, 0], "先说Repita，再说明más despacio并加por favor。", "Start with Repita, add más despacio, then por favor.", ["es-repeat", "es-slowly", "es-please"], ["es-repeat-slowly"]),
    role("es-role-clarify", "说明没有听懂，请对方慢一点重复。", "Say you did not understand and ask for a slower repetition.", "使用No entiendo和Repita más despacio, por favor。", "Use No entiendo and Repita más despacio, por favor.", ["es-not-understand", "es-repeat", "es-slowly", "es-please"], ["es-say-not-understand", "es-repeat-slowly"]),

    single("es-recognize-order", "哪一句是礼貌点咖啡？", "Which sentence politely orders coffee?", [target("Quisiera un café, por favor."), target("¿Cuánto cuesta el café?"), target("El café está allí.")], 0, "Quisiera...por favor是礼貌请求。", "Quisiera...por favor is a polite request.", ["es-polite-order", "es-please", "es-drinks"], ["es-order-coffee"]),
    ordering("es-order-coffee-request", "把词块排成“我想要一杯咖啡，谢谢”。", "Order the chunks to request a coffee politely.", ["un café,", "Quisiera", "por favor."], [1, 0, 2], "使用Quisiera＋物品＋por favor。", "Use Quisiera + item + por favor.", ["es-polite-order", "es-drinks", "es-please"], ["es-order-coffee"]),
    role("es-role-order", "查看菜单并礼貌地点一杯茶。", "Read the menu and politely order a tea.", "使用Quisiera un té, por favor。", "Use Quisiera un té, por favor.", ["es-polite-order", "es-drinks", "es-menu", "es-please"], ["es-order-tea", "es-ask-menu"]),

    single("es-recognize-details", "哪一句表示“两杯小咖啡”？", "Which phrase means 'two small coffees'?", [target("Dos cafés pequeños."), target("Un café grande."), target("Dos aguas frías.")], 0, "dos要求复数cafés和pequeños。", "Dos requires plural cafés and pequeños.", ["es-quantity", "es-size-agreement"], ["es-two-coffees"]),
    ordering("es-order-no-sugar", "把词块排成“一杯不加糖的热咖啡”。", "Order the chunks to form 'a hot coffee without sugar.'", ["sin azúcar.", "Un café", "caliente"], [1, 2, 0], "名词后放caliente，再用sin说明不加糖。", "Put caliente after the noun, then use sin for no sugar.", ["es-temperature", "es-with-without", "es-drinks"], ["es-no-sugar"]),
    role("es-role-details", "点两杯小咖啡，其中一杯不加糖。", "Order two small coffees, with one without sugar.", "说明数量、尺寸，并使用sin azúcar。", "State the quantity and size, and use sin azúcar.", ["es-quantity", "es-size-agreement", "es-with-without", "es-drinks"], ["es-two-coffees", "es-no-sugar"]),

    single("es-recognize-here-away", "Para llevar表示什么？", "What does Para llevar mean?", [l("堂食", "For here"), l("外带", "To take away"), l("还要别的吗", "Anything else")], 1, "Para llevar表示外带。", "Para llevar means to take away.", ["es-here-takeaway"], ["es-choose-away"]),
    ordering("es-order-takeaway", "把词块排成“请外带”。", "Order the chunks to say 'To take away, please.'", ["por favor.", "Para", "llevar,"], [1, 2, 0], "使用Para llevar, por favor。", "Use Para llevar, por favor.", ["es-here-takeaway", "es-please"], ["es-choose-away"]),
    role("es-role-finish", "选择外带，说明没有别的，并表示感谢。", "Choose takeaway, say there is nothing else, and give thanks.", "使用Para llevar、Nada más和Gracias。", "Use Para llevar, Nada más, and Gracias.", ["es-here-takeaway", "es-nothing-else", "es-thanks"], ["es-choose-away", "es-finish-order"]),
    role("es-capstone-course", "课程结业综合：完成问路、请求澄清和咖啡店外带点单。", "Course completion capstone: Ask directions, request clarification, and complete a takeaway café order.", "组合问路、No entiendo、慢速重复请求、饮料细节和Para llevar。", "Combine directions, No entiendo, a slower repetition request, drink details, and Para llevar.", ["es-how-get", "es-not-understand", "es-repeat", "es-slowly", "es-polite-order", "es-quantity", "es-with-without", "es-here-takeaway", "es-thanks"], ["es-ask-airport", "es-repeat-slowly", "es-order-coffee", "es-no-sugar", "es-choose-away", "es-finish-order"]),
  ];

  const plans: Plan[] = [
    { id: "alphabet-and-signs", title: l("第一课：字母、重音和标点", "Lesson 1: Letters, accents, and punctuation"), goalRef: "recognize-spanish-writing", goal: l("能够识别西班牙语字母、重音符号和成对问号。", "Can recognize Spanish letters, accent marks, and paired question marks."), knowledgeRefs: ["es-alphabet", "es-vowels", "es-accent-marks", "es-inverted-signs", "es-capitalization"], utteranceRefs: ["es-vowel-line", "es-spelling-question"], recognition: "es-recognize-opening-question", guided: "es-select-accented-letters", task: "es-type-question", diagnostic: true },
    { id: "pronouns-and-ser", title: l("第二课：主语代词和ser", "Lesson 2: Subject pronouns and ser"), goalRef: "state-identity-with-ser", goal: l("能够用ser说明或否定基础身份。", "Can use ser to state or negate a basic identity."), knowledgeRefs: ["es-subject-pronouns", "es-ser", "es-ser-negative", "es-indefinite-articles", "es-professions"], utteranceRefs: ["es-i-student", "es-she-teacher", "es-not-teacher"], recognition: "es-recognize-ser", guided: "es-order-teacher", task: "es-type-not-teacher", diagnostic: true },
    { id: "gender-number-and-articles", title: l("第三课：名词性别、复数和冠词", "Lesson 3: Noun gender, plurals, and articles"), goalRef: "build-agreeing-noun-phrases", goal: l("能够识别并构成基础性数一致名词短语。", "Can recognize and build basic noun phrases with gender and number agreement."), knowledgeRefs: ["es-noun-gender", "es-definite-articles", "es-plurals", "es-adjective-agreement", "es-basic-order"], utteranceRefs: ["es-red-book", "es-red-table", "es-two-books"], recognition: "es-recognize-article", guided: "es-order-red-book", task: "es-type-red-tables", diagnostic: true },
    { id: "greeting-and-identity", title: l("第四课：问候、名字和身份", "Lesson 4: Greetings, names, and identity"), goalRef: "introduce-in-spanish", goal: l("能够问候、介绍名字和身份，并从个人资料中提取来源信息。", "Can greet, state a name and identity, and extract origin information from a profile."), knowledgeRefs: ["es-greetings", "es-name-pattern", "es-ask-name", "es-origin", "es-nationalities", "es-ser", "es-professions"], utteranceRefs: ["es-introduction", "es-ask-origin", "es-reading-profile"], recognition: "es-recognize-name", guided: "es-order-introduction", task: "es-role-introduction", reading: "es-read-profile", diagnostic: true, capstone: { title: l("基础阶段综合任务", "Foundation stage checkpoint"), exerciseRef: "es-capstone-foundation", knowledgeRefs: ["es-alphabet", "es-inverted-signs", "es-ser", "es-professions", "es-name-pattern", "es-origin"], utteranceRefs: ["es-spelling-question", "es-introduction", "es-ask-origin"] } },
    { id: "numbers-time-and-dates", title: l("第五课：数字、时间和营业告示", "Lesson 5: Numbers, time, and opening-hour notices"), goalRef: "tell-time-in-spanish", goal: l("能够询问和说明时间，并读取基础营业告示。", "Can ask and state the time and read a basic opening-hours notice."), knowledgeRefs: ["es-numbers", "es-ask-time", "es-tell-time", "es-days-dates", "es-opening-hours"], utteranceRefs: ["es-time-three", "es-time-question", "es-reading-hours"], recognition: "es-recognize-time", guided: "es-order-time-question", task: "es-type-three", reading: "es-read-hours" },
    { id: "estar-location-and-negation", title: l("第六课：estar、位置和基础否定", "Lesson 6: Estar, location, and basic negation"), goalRef: "ask-location-in-spanish", goal: l("能够询问地点、指出位置并说明某物不在这里。", "Can ask for a place, indicate a location, and say something is not here."), knowledgeRefs: ["es-estar", "es-where", "es-here-there", "es-location-negative", "es-place-words"], utteranceRefs: ["es-ask-restroom", "es-station-there", "es-not-here"], recognition: "es-recognize-where", guided: "es-order-restroom", task: "es-type-not-here" },
    { id: "shopping-and-prices", title: l("第七课：指物、购物和价格", "Lesson 7: Pointing, shopping, and prices"), goalRef: "ask-price-in-spanish", goal: l("能够询问价格、提出购买需求并读取价格表。", "Can ask a price, request an item, and read a price list."), knowledgeRefs: ["es-demonstratives", "es-price-question", "es-euros", "es-shopping-items", "es-want", "es-please"], utteranceRefs: ["es-ask-price", "es-want-water", "es-reading-prices"], recognition: "es-recognize-price", guided: "es-order-price-question", task: "es-type-want-water", reading: "es-read-prices" },
    { id: "transport-and-directions", title: l("第八课：交通、地点和问路", "Lesson 8: Transport, places, and directions"), goalRef: "ask-transport-in-spanish", goal: l("能够礼貌问路，并从简短线路说明中提取目的地和方向。", "Can ask directions politely and extract destinations and directions from short route information."), knowledgeRefs: ["es-excuse-me", "es-how-get", "es-go-to", "es-transport", "es-directions", "es-estar"], utteranceRefs: ["es-ask-airport", "es-bus-destination", "es-reading-route"], recognition: "es-recognize-airport", guided: "es-order-route-question", task: "es-role-directions", reading: "es-read-route", capstone: { title: l("日常生活阶段综合任务", "Daily-life stage checkpoint"), exerciseRef: "es-capstone-daily-life", knowledgeRefs: ["es-ask-time", "es-price-question", "es-how-get", "es-transport", "es-shopping-items"], utteranceRefs: ["es-time-question", "es-ask-price", "es-ask-airport"] } },
    { id: "help-and-clarification", title: l("第九课：求助、听不懂和请求重复", "Lesson 9: Help, non-understanding, and repetition"), goalRef: "request-help-in-spanish", goal: l("能够请求帮助、说明不理解并请对方慢一点重复。", "Can ask for help, say something was not understood, and request a slower repetition."), knowledgeRefs: ["es-help", "es-not-understand", "es-repeat", "es-slowly", "es-please"], utteranceRefs: ["es-request-help", "es-say-not-understand", "es-repeat-slowly"], recognition: "es-recognize-help", guided: "es-order-repeat", task: "es-role-clarify" },
    { id: "basic-order", title: l("第十课：礼貌点一杯饮料", "Lesson 10: Order a drink politely"), goalRef: "order-drink-in-spanish", goal: l("能够查看菜单并礼貌地点一杯饮料。", "Can read a menu and politely order a drink."), knowledgeRefs: ["es-polite-order", "es-drinks", "es-please", "es-menu", "es-indefinite-articles"], utteranceRefs: ["es-order-coffee", "es-order-tea", "es-ask-menu"], recognition: "es-recognize-order", guided: "es-order-coffee-request", task: "es-role-order" },
    { id: "quantity-preference-and-agreement", title: l("第十一课：数量、偏好和形容词一致", "Lesson 11: Quantity, preferences, and adjective agreement"), goalRef: "specify-order-in-spanish", goal: l("能够说明数量、尺寸、冷热和配料偏好。", "Can specify quantity, size, temperature, and ingredient preferences."), knowledgeRefs: ["es-quantity", "es-size-agreement", "es-with-without", "es-temperature", "es-preference", "es-drinks"], utteranceRefs: ["es-two-coffees", "es-no-sugar", "es-prefer-water"], recognition: "es-recognize-details", guided: "es-order-no-sugar", task: "es-role-details" },
    { id: "dine-in-takeaway-and-service", title: l("第十二课：堂食、外带和服务场景", "Lesson 12: Dine-in, takeaway, and service encounters"), goalRef: "finish-order-in-spanish", goal: l("能够选择堂食或外带、结束点单并表示感谢。", "Can choose dine-in or takeaway, finish an order, and give thanks."), knowledgeRefs: ["es-here-takeaway", "es-anything-else", "es-nothing-else", "es-thanks", "es-please"], utteranceRefs: ["es-here-or-away", "es-choose-away", "es-finish-order"], recognition: "es-recognize-here-away", guided: "es-order-takeaway", task: "es-role-finish", capstone: { title: l("服务场景结业综合任务", "Service-stage course completion capstone"), exerciseRef: "es-capstone-course", knowledgeRefs: ["es-how-get", "es-not-understand", "es-repeat", "es-slowly", "es-polite-order", "es-quantity", "es-with-without", "es-here-takeaway", "es-thanks"], utteranceRefs: ["es-ask-airport", "es-repeat-slowly", "es-order-coffee", "es-no-sugar", "es-choose-away", "es-finish-order"] } },
  ];

  const extension = spanishA1Extension();
  knowledge.push(...extension.knowledge);
  utterances.push(...extension.utterances);
  exercises.push(...extension.exercises);
  plans.push(...extension.plans);

  return {
    schemaVersion: 2,
    manifest: {
      id: "private.es.cafe-request",
      version: "0.7.0",
      languageId: "es",
      title: l("西班牙语零基础入门", "Spanish Zero Beginner"),
      description: l("从字母、重音与基础语法开始，学习问候、身份、时间、位置、购物、交通、服务、日常作息、家庭、见面安排和健康求助中的 CEFR Can-do A1 核心书面表达。", "Start with letters, accents, and basic grammar, then build CEFR Can-do A1 core written expressions for greetings, identity, time, places, shopping, transport, service, routines, family, meeting arrangements, and basic health help."),
      author: { id: "learn-language", displayName: "LearnLanguage" },
      visibility: "private",
      status: "draft",
      source: { kind: "original" },
      languageAdapter: { id: "core.generic", version: "1.0.0" },
    },
    goals: plans.map((plan) => ({ id: plan.goalRef, description: plan.goal, framework: { name: "CEFR Can-do", level: "A1" } })),
    knowledge,
    utterances,
    exercises,
    rubrics: [{ id: "cafe-task-rubric", dimensions: ["task-completion", "comprehensibility", "target-language", "prompt-dependence"], retryRequired: true }],
    lessons: plans.map((plan) => ({ id: plan.id, title: plan.title, canDoGoalRefs: [plan.goalRef], entryStepId: "diagnose", steps: steps(plan) })),
  };
}
