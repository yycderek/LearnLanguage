import type { CoursePack, CourseStep, Exercise, KnowledgeItem, LocalizedText, Utterance } from "@learn-language/protocol";

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
  diagnostic?: string;
  reading?: string;
  capstone?: { title: LocalizedText; exerciseRef: string; knowledgeRefs: string[]; utteranceRefs: string[] };
};

function steps(plan: Plan): CourseStep[] {
  const result: CourseStep[] = [
    { id: "diagnose", phase: "diagnostic", title: l("检查已有知识", "Check what you already know"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: plan.diagnostic ? [plan.diagnostic] : [], next: ["preteach"] },
    { id: "preteach", phase: "preteach", title: l("学习本课核心表达", "Learn the essential expressions"), supportLevel: "full", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [], next: ["supported-input"] },
    { id: "supported-input", phase: "supported-input", title: l("带翻译理解场景", "Understand the scene with translation"), supportLevel: "full", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [], next: ["target-input"] },
    { id: "target-input", phase: "supported-input", title: l("只看英语材料", "Read only the English material"), supportLevel: "target-language-only", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [], next: [plan.reading ? "reading-comprehension" : "independent-input"] },
    ...(plan.reading ? [{ id: "reading-comprehension", phase: "comprehension" as const, title: l("阅读短文并提取信息", "Read a short text and extract information"), supportLevel: "none" as const, knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs.filter((id) => id.includes("reading-")), exerciseRefs: [plan.reading], next: ["independent-input"] }] : []),
    { id: "independent-input", phase: "comprehension", title: l("独立理解关键信息", "Understand the key information"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [plan.recognition], next: ["guided-output"] },
    { id: "guided-output", phase: "guided-output", title: l("重组本课表达", "Rebuild the lesson expression"), supportLevel: "target-language-only", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [plan.guided], next: ["independent-task"] },
    { id: "independent-task", phase: "independent-task", title: l("独立完成场景任务", "Complete the scene independently"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [plan.task], next: ["feedback-retry"] },
    { id: "feedback-retry", phase: "feedback-retry", title: l("根据反馈重新表达", "Retry with feedback"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [plan.task], next: ["delayed-transfer"] },
    { id: "delayed-transfer", phase: "delayed-transfer", title: l("迁移到相似场景", "Transfer to a similar scene"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [plan.task], next: plan.capstone ? ["integrated-capstone"] : [] },
  ];
  if (plan.capstone) result.push({ id: "integrated-capstone", phase: "delayed-transfer", title: plan.capstone.title, supportLevel: "none", knowledgeRefs: plan.capstone.knowledgeRefs, utteranceRefs: plan.capstone.utteranceRefs, exerciseRefs: [plan.capstone.exerciseRef], next: [] });
  if (plan.diagnostic) {
    result[0]!.next = ["preteach", "diagnostic-skip"];
    result[0]!.diagnostic = { learnNextStepId: "preteach", passNextStepId: "diagnostic-skip" };
    result.push({ id: "diagnostic-skip", phase: "diagnostic", title: plan.capstone ? l("检查通过：进入阶段综合任务", "Diagnostic passed: continue to the stage checkpoint") : l("检查通过：完成本课", "Diagnostic passed: complete the lesson"), supportLevel: "none", knowledgeRefs: [], utteranceRefs: [], exerciseRefs: [], next: plan.capstone ? ["integrated-capstone"] : [] });
  }
  return result;
}

function k(id: string, kind: KnowledgeItem["kind"], form: string, zh: string, en: string, usageZh: string, usageEn: string, tags: string[] = []): KnowledgeItem {
  return { id, kind, form, reading: reading(form), meaning: l(zh, en), usage: l(usageZh, usageEn), tags };
}

function u(id: string, text: string, zh: string, refs: string[]): Utterance {
  return { id, text, translation: l(zh, text), reading: reading(text), knowledgeRefs: refs };
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

export function englishStarterCourse(): CoursePack {
  const knowledge: KnowledgeItem[] = [
    k("en-alphabet", "script", "A–Z / a–z", "英语字母表", "the English alphabet", "英语使用26个拉丁字母，每个字母有大写和小写。", "English uses 26 Latin letters, each with uppercase and lowercase forms.", ["foundation", "writing-system", "alphabet"]),
    k("en-uppercase", "script", "A B C / a b c", "大写与小写", "uppercase and lowercase", "句首和专有名称通常以大写字母开始。", "Sentences and proper names normally begin with a capital letter.", ["foundation", "writing-system", "capitalization"]),
    k("en-vowels", "script", "a e i o u", "五个元音字母", "the five vowel letters", "先识别书面元音字母；本课不进行发音评分。", "Recognize the written vowel letters; this lesson does not score pronunciation.", ["foundation", "alphabet"]),
    k("en-consonants", "script", "b c d f g ...", "辅音字母", "consonant letters", "除a、e、i、o、u外，其余字母在基础分类中视为辅音字母。", "In the basic written classification, letters other than a, e, i, o, and u are consonants.", ["foundation", "alphabet"]),
    k("en-spell-name", "grammar", "How do you spell your name?", "你的名字怎么拼写？", "ask how a name is spelled", "用于请求对方逐字母写出或拼出名字。", "Use this to ask someone to give the letters in their name.", ["foundation", "spelling"]),

    k("en-pronouns", "grammar", "I / you / he / she / we / they", "人称代词", "subject pronouns", "放在句首表示谁处于某种状态或做某事。", "Place a subject pronoun before a state or action.", ["foundation", "grammar"]),
    k("en-be", "grammar", "I am / you are / she is", "be动词的基础形式", "basic forms of be", "am跟I，is跟he/she/it，are跟you/we/they。", "Use am with I, is with he/she/it, and are with you/we/they.", ["foundation", "grammar"]),
    k("en-be-negative", "grammar", "am not / isn't / aren't", "be动词否定", "negative forms of be", "在be后加not；is not和are not常缩写。", "Add not after be; is not and are not are often contracted.", ["foundation", "grammar"]),
    k("en-contractions", "grammar", "I'm / you're / she's / we're", "常见缩写", "common contractions", "缩写常用于日常书写；撇号表示省略的字母。", "Contractions are common in everyday writing; the apostrophe marks omitted letters.", ["foundation", "grammar"]),
    k("en-indefinite-article", "grammar", "a / an", "一个", "the indefinite articles a and an", "单数可数名词前使用；基础规则中元音字母开头的词常用an。", "Use before a singular count noun; as a basic rule, use an before many vowel-initial words.", ["foundation", "grammar"]),
    k("en-student-teacher", "lexeme", "student / teacher", "学生／教师", "student / teacher", "用于说明学习或工作身份。", "Use these words to state a study or work identity.", ["foundation", "identity", "reading"]),

    k("en-svo", "grammar", "subject + verb + object", "主语＋动词＋宾语", "subject + verb + object", "英语基础陈述句通常先说谁，再说动作和对象。", "A basic English statement usually names who, then the action and object.", ["foundation", "grammar", "word-order"]),
    k("en-like", "grammar", "I like ...", "我喜欢……", "I like ...", "like后接喜欢的事物。", "Put the thing you like after like.", ["foundation", "grammar"]),
    k("en-do-question", "grammar", "Do you ...?", "你……吗？", "Do you ...?", "一般现在时基础疑问句可用Do you开头。", "A basic present-simple question can begin with Do you.", ["foundation", "grammar"]),
    k("en-do-answer", "grammar", "Yes, I do. / No, I don't.", "是的／不是", "short answers with do", "用do或don't简短回答Do you开头的问题。", "Use do or don't in a short answer to a Do you question.", ["foundation", "grammar"]),
    k("en-plural", "grammar", "book / books", "基础复数-s", "basic plural -s", "许多可数名词表示多个时在词尾加-s。", "Many count nouns add -s when there is more than one.", ["foundation", "grammar"]),
    k("en-question-mark", "script", "?", "问号", "question mark", "直接问句结尾使用问号。", "End a direct question with a question mark.", ["foundation", "writing-system"]),

    k("en-hello", "pragmatics", "Hello / Hi", "你好", "hello / hi", "Hello较通用，Hi较口语。", "Hello is broadly useful; Hi is more informal.", ["foundation", "greeting"]),
    k("en-name-pattern", "grammar", "My name is ... / I'm ...", "我叫……／我是……", "state your name", "两种表达都可用于自我介绍。", "Both patterns can introduce your name.", ["foundation", "identity", "reading"]),
    k("en-ask-name", "grammar", "What's your name?", "你叫什么名字？", "ask someone's name", "用于初次见面询问名字。", "Use this when meeting someone and asking their name.", ["foundation", "identity"]),
    k("en-from", "grammar", "I'm from ...", "我来自……", "state where you are from", "from后接国家或城市。", "Put a country or city after from.", ["foundation", "identity", "reading"]),
    k("en-live", "grammar", "I live in ...", "我住在……", "state where you live", "in后接城市、国家或地区。", "Put a city, country, or area after in.", ["foundation", "identity", "reading"]),
    k("en-city-country", "lexeme", "city / country", "城市／国家", "city / country", "阅读个人资料和地址时常见。", "Common in profiles and addresses.", ["reading", "identity"]),
    k("en-nice-meet", "pragmatics", "Nice to meet you.", "很高兴认识你。", "nice to meet you", "初次介绍后使用的礼貌回应。", "A polite response after a first introduction.", ["foundation", "greeting"]),

    k("en-numbers", "lexeme", "one–twenty", "一到二十", "one through twenty", "用于时间、价格、数量和编号。", "Used for time, prices, quantities, and numbers.", ["a1-core"]),
    k("en-clock", "grammar", "It's three o'clock.", "现在三点。", "tell the hour", "使用It's加数字和o'clock表示整点。", "Use It's plus a number and o'clock for the hour.", ["a1-core", "reading"]),
    k("en-what-time", "grammar", "What time is it?", "几点了？", "ask the time", "询问当前时间。", "Ask for the current time.", ["a1-core"]),
    k("en-today", "lexeme", "today", "今天", "today", "营业告示和日程中的高频词。", "A frequent word in notices and schedules.", ["a1-core", "reading"]),
    k("en-morning-afternoon", "lexeme", "morning / afternoon", "上午／下午", "morning / afternoon", "用于区分一天中的时段。", "Used to distinguish parts of the day.", ["a1-core", "reading"]),
    k("en-from-to", "grammar", "from ... to ...", "从……到……", "from ... to ...", "用于营业时间和行程时段。", "Used for opening hours and time ranges.", ["a1-core", "reading"]),
    k("en-open", "lexeme", "open", "营业／开放", "open", "告示中表示可以进入或营业。", "On a notice, this says a place is available or operating.", ["a1-core", "reading"]),
    k("en-closed", "lexeme", "closed", "关闭／不营业", "closed", "告示中表示当天或当前不开放。", "On a notice, this says a place is not open.", ["a1-core", "reading"]),

    k("en-where", "grammar", "Where is ...?", "……在哪里？", "ask where something is", "把要找的地点放在is后。", "Put the place being sought after is.", ["a1-core"]),
    k("en-here-there", "lexeme", "here / there", "这里／那里", "here / there", "用于指出近处或较远处的位置。", "Used to point to a nearby or more distant place.", ["a1-core"]),
    k("en-there-is", "grammar", "There is ...", "有……", "there is", "用于说明某处存在一个事物或地点。", "Use this to say that one thing or place exists.", ["a1-core"]),
    k("en-not-here", "grammar", "It isn't here.", "它不在这里。", "say something is not here", "isn't是is not的缩写。", "Isn't is the contraction of is not.", ["a1-core"]),
    k("en-restroom-station", "lexeme", "restroom / station", "洗手间／车站", "restroom / station", "问路场景中的基础地点词。", "Basic place words for asking directions.", ["a1-core"]),
    k("en-left-right", "lexeme", "left / right", "左边／右边", "left / right", "用于基础方向说明。", "Used in basic directions.", ["a1-core", "reading"]),

    k("en-this-that", "grammar", "this / that", "这个／那个", "this / that", "this指较近物品，that指较远物品。", "This points to something nearer; that points to something farther away.", ["a1-core", "reading"]),
    k("en-how-much", "grammar", "How much is this?", "这个多少钱？", "ask a price", "用于询问单个物品价格。", "Use this to ask the price of one item.", ["a1-core", "reading"]),
    k("en-dollar", "lexeme", "dollar / dollars", "美元／元", "dollar / dollars", "数字后用dollars表示多个货币单位。", "Use dollars after most numbers greater than one.", ["a1-core", "reading"]),
    k("en-cost", "grammar", "It costs ...", "它要价……", "state a price", "costs后接价格。", "Put the price after costs.", ["a1-core", "reading"]),
    k("en-water", "lexeme", "water", "水", "water", "菜单和价格表中的基础商品词。", "A basic item on menus and price lists.", ["a1-core", "reading"]),
    k("en-bread", "lexeme", "bread", "面包", "bread", "商店和咖啡店中的常见食品词。", "A common food word in shops and cafés.", ["a1-core", "reading"]),
    k("en-coffee-item", "lexeme", "coffee", "咖啡", "coffee", "菜单中的常见饮料。", "A common drink on a menu.", ["a1-core", "reading"]),

    k("en-excuse-me", "pragmatics", "Excuse me.", "劳驾／不好意思", "excuse me", "问路或引起注意时使用。", "Use this to get attention or ask directions.", ["a1-core"]),
    k("en-go-to", "grammar", "Does this go to ...?", "这个去……吗？", "ask whether transport goes somewhere", "交通工具后用go to加目的地。", "Use go to plus a destination for transport.", ["a1-core"]),
    k("en-bus-train", "lexeme", "bus / train", "公交车／列车", "bus / train", "基础公共交通词。", "Basic public-transport words.", ["a1-core", "reading"]),
    k("en-airport", "lexeme", "airport", "机场", "airport", "交通目的地中的高频词。", "A frequent transport destination.", ["a1-core", "reading"]),
    k("en-how-get", "grammar", "How do I get to ...?", "我怎么去……？", "ask how to reach a place", "to后接目的地。", "Put the destination after to.", ["a1-core", "reading"]),
    k("en-stop-exit", "lexeme", "stop / exit", "站点／出口", "stop / exit", "线路和车站说明中的常见词。", "Common in route and station information.", ["a1-core", "reading"]),
    k("en-straight", "lexeme", "straight ahead", "直走", "straight ahead", "用于简单方向说明。", "Used in simple directions.", ["a1-core", "reading"]),

    k("en-help", "pragmatics", "Can you help me?", "你能帮我吗？", "ask for help", "礼貌请求帮助。", "A polite request for help.", ["a1-core"]),
    k("en-not-understand", "grammar", "I don't understand.", "我不明白。", "say you do not understand", "don't放在动词understand前。", "Put don't before the verb understand.", ["a1-core", "grammar"]),
    k("en-repeat", "pragmatics", "Please repeat that.", "请再说一遍。", "ask someone to repeat", "没有听懂或看清时请求重复。", "Ask for repetition when something was not understood.", ["a1-core"]),
    k("en-slowly", "pragmatics", "More slowly, please.", "请说慢一点。", "ask for slower language", "请求对方降低表达速度。", "Ask the other person to communicate more slowly.", ["a1-core"]),
    k("en-can-you", "grammar", "Can you ...?", "你能……吗？", "make a polite request", "Can you后接动词原形。", "Put the base form of a verb after Can you.", ["a1-core", "grammar"]),
    k("en-dont", "grammar", "don't + verb", "不做……", "negative with don't", "一般现在时中用don't放在动词前构成基础否定。", "In a basic present-simple negative, put don't before the verb.", ["a1-core", "grammar"]),

    k("en-would-like", "grammar", "I'd like ...", "我想要……", "I'd like ...", "服务场景中较礼貌的请求方式。", "A polite request in a service encounter.", ["a1-core"]),
    k("en-please", "pragmatics", "please", "请", "please", "放在请求中增加礼貌程度。", "Add this to make a request more polite.", ["a1-core"]),
    k("en-coffee-tea", "lexeme", "coffee / tea", "咖啡／茶", "coffee / tea", "基础饮料名称。", "Basic drink names.", ["a1-core"]),
    k("en-cup", "lexeme", "a cup of ...", "一杯……", "a cup of ...", "用于表达一杯饮料。", "Used to express one cup of a drink.", ["a1-core"]),
    k("en-menu", "lexeme", "menu", "菜单", "menu", "点单前查看的食品和饮料列表。", "A list of food and drinks used before ordering.", ["a1-core"]),

    k("en-hot-iced", "lexeme", "hot / iced", "热的／冰的", "hot / iced", "说明饮料温度。", "Specifies a drink's temperature.", ["a1-core"]),
    k("en-two-cups", "grammar", "two cups of ...", "两杯……", "two cups of ...", "数量大于一时cup使用复数cups。", "Use plural cups for a quantity greater than one.", ["a1-core"]),
    k("en-with-without", "grammar", "with / without", "加／不加", "with / without", "说明是否包含糖、奶等配料。", "States whether an ingredient such as sugar or milk is included.", ["a1-core"]),
    k("en-or", "grammar", "... or ...?", "……还是……？", "offer two choices with or", "用or连接两个选择。", "Use or to connect two choices.", ["a1-core"]),
    k("en-small-large", "lexeme", "small / large", "小杯／大杯", "small / large", "说明饮料尺寸。", "Specifies a drink size.", ["a1-core"]),
    k("en-sugar-milk", "lexeme", "sugar / milk", "糖／奶", "sugar / milk", "常见饮料配料。", "Common drink additions.", ["a1-core"]),

    k("en-here-go", "pragmatics", "For here or to go?", "堂食还是外带？", "for here or to go", "店员询问就餐地点时使用。", "A server uses this to ask where the order will be consumed.", ["a1-core"]),
    k("en-to-go", "pragmatics", "To go, please.", "外带，谢谢。", "to go, please", "回答选择外带。", "Use this to choose takeaway.", ["a1-core"]),
    k("en-thats-all", "pragmatics", "That's all, thank you.", "就这些，谢谢。", "finish an order", "表示点单完成。", "Use this to say the order is complete.", ["a1-core"]),
    k("en-thank-you", "pragmatics", "Thank you.", "谢谢。", "thank you", "对帮助或服务表示感谢。", "Use this to thank someone for help or service.", ["a1-core"]),
  ];

  const utterances: Utterance[] = [
    u("en-alphabet-line", "A B C D E F G", "A B C D E F G", ["en-alphabet", "en-uppercase"]),
    u("en-vowel-line", "a e i o u", "a e i o u", ["en-vowels"]),
    u("en-ask-spelling", "How do you spell your name?", "你的名字怎么拼写？", ["en-spell-name", "en-question-mark"]),
    u("en-i-student", "I am a student.", "我是学生。", ["en-pronouns", "en-be", "en-student-teacher"]),
    u("en-she-teacher", "She is a teacher.", "她是教师。", ["en-pronouns", "en-be", "en-indefinite-article", "en-student-teacher"]),
    u("en-we-ready", "We're ready.", "我们准备好了。", ["en-pronouns", "en-be", "en-contractions"]),
    u("en-like-coffee", "I like coffee.", "我喜欢咖啡。", ["en-svo", "en-like"]),
    u("en-ask-like-tea", "Do you like tea?", "你喜欢茶吗？", ["en-do-question", "en-question-mark"]),
    u("en-answer-like", "Yes, I do.", "是的，我喜欢。", ["en-do-answer"]),
    u("en-introduce", "Hello. My name is Maya.", "你好，我叫Maya。", ["en-hello", "en-name-pattern"]),
    u("en-ask-name-line", "What's your name?", "你叫什么名字？", ["en-ask-name"]),
    u("en-reading-profile", "Maya is a student. She is from Canada. She lives in London.", "Maya是一名学生。她来自加拿大，住在伦敦。", ["en-name-pattern", "en-student-teacher", "en-from", "en-live", "en-city-country"]),
    u("en-time-three", "It's three o'clock.", "现在三点。", ["en-numbers", "en-clock"]),
    u("en-ask-time", "What time is it?", "几点了？", ["en-what-time"]),
    u("en-reading-hours", "The library is open from nine in the morning to five in the afternoon. It is closed today.", "图书馆从上午九点开放到下午五点。今天不营业。", ["en-today", "en-morning-afternoon", "en-from-to", "en-open", "en-closed"]),
    u("en-ask-restroom", "Where is the restroom?", "洗手间在哪里？", ["en-where", "en-restroom-station"]),
    u("en-station-left", "The station is on the left.", "车站在左边。", ["en-restroom-station", "en-left-right"]),
    u("en-not-here-line", "It isn't here.", "它不在这里。", ["en-not-here", "en-here-there"]),
    u("en-ask-price", "How much is this?", "这个多少钱？", ["en-this-that", "en-how-much"]),
    u("en-cost-five", "It costs five dollars.", "它五美元。", ["en-cost", "en-dollar", "en-numbers"]),
    u("en-reading-price-list", "Water: two dollars. Bread: three dollars. Coffee: four dollars.", "水两美元，面包三美元，咖啡四美元。", ["en-water", "en-bread", "en-coffee-item", "en-dollar"]),
    u("en-airport-bus", "Does this bus go to the airport?", "这辆公交车去机场吗？", ["en-go-to", "en-bus-train", "en-airport"]),
    u("en-ask-route", "How do I get to the station?", "我怎么去车站？", ["en-how-get", "en-restroom-station"]),
    u("en-reading-route", "Take bus 12 to the station. The airport bus does not stop here. The exit is straight ahead.", "乘12路公交到车站。机场巴士不停靠这里。出口在前方。", ["en-bus-train", "en-airport", "en-stop-exit", "en-straight"]),
    u("en-request-help", "Excuse me. Can you help me?", "劳驾，你能帮我吗？", ["en-excuse-me", "en-help", "en-can-you"]),
    u("en-dont-understand", "I don't understand.", "我不明白。", ["en-not-understand", "en-dont"]),
    u("en-repeat-slowly", "Please repeat that more slowly.", "请慢一点再说一遍。", ["en-repeat", "en-slowly", "en-please"]),
    u("en-order-coffee", "I'd like a cup of coffee, please.", "我想要一杯咖啡。", ["en-would-like", "en-cup", "en-coffee-tea", "en-please"]),
    u("en-order-tea", "A cup of tea, please.", "请给我一杯茶。", ["en-cup", "en-coffee-tea", "en-please"]),
    u("en-ask-menu", "Can I see the menu, please?", "可以给我看看菜单吗？", ["en-menu", "en-please"]),
    u("en-ask-temperature", "Hot or iced?", "热的还是冰的？", ["en-hot-iced", "en-or"]),
    u("en-two-iced", "Two large iced coffees, please.", "请给我两杯大杯冰咖啡。", ["en-two-cups", "en-small-large", "en-hot-iced", "en-coffee-tea", "en-please"]),
    u("en-no-sugar", "Without sugar, please.", "请不要糖。", ["en-with-without", "en-sugar-milk", "en-please"]),
    u("en-here-or-go", "For here or to go?", "堂食还是外带？", ["en-here-go", "en-or"]),
    u("en-choose-go", "To go, please.", "外带，谢谢。", ["en-to-go", "en-please"]),
    u("en-finish-order", "That's all, thank you.", "就这些，谢谢。", ["en-thats-all", "en-thank-you"]),
  ];

  const exercises: Exercise[] = [
    single("en-recognize-vowel", "哪个是元音字母？", "Which one is a vowel letter?", [target("b"), target("e"), target("t")], 1, "e属于a、e、i、o、u。", "E is one of a, e, i, o, and u.", ["en-vowels", "en-consonants"], ["en-vowel-line"]),
    ordering("en-order-alphabet", "按字母表顺序排列。", "Put the letters in alphabetical order.", ["C", "A", "B"], [1, 2, 0], "顺序是A、B、C。", "The order is A, B, C.", ["en-alphabet", "en-uppercase"], ["en-alphabet-line"]),
    shortInput("en-type-name-question", "输入“你的名字怎么拼写？”。", "Type 'How do you spell your name?'", ["How do you spell your name?", "How do you spell your name"], "注意句首大写和问号。", "Use a capital letter and a question mark.", ["en-spell-name", "en-uppercase", "en-question-mark"], ["en-ask-spelling"]),
    single("en-recognize-am", "I后面使用哪个be动词？", "Which form of be follows I?", [target("am"), target("is"), target("are")], 0, "I和am搭配。", "I pairs with am.", ["en-pronouns", "en-be"], ["en-i-student"]),
    ordering("en-order-student", "排成“我是学生”。", "Build 'I am a student.'", ["a student.", "am", "I"], [2, 1, 0], "主语I＋am＋身份。", "Use subject I + am + identity.", ["en-pronouns", "en-be", "en-indefinite-article", "en-student-teacher"], ["en-i-student"]),
    shortInput("en-type-contraction", "把“We are”写成缩写。", "Write the contraction of 'We are'.", ["We're", "we're"], "省略a并使用撇号。", "Omit the a and use an apostrophe.", ["en-contractions", "en-be"], ["en-we-ready"]),
    single("en-recognize-question", "哪一句是一般疑问句？", "Which sentence is a yes/no question?", [target("I like coffee."), target("Do you like tea?"), target("Yes, I do.")], 1, "Do you开头并以问号结尾。", "It begins with Do you and ends with a question mark.", ["en-do-question", "en-question-mark"], ["en-ask-like-tea"]),
    ordering("en-order-like-coffee", "排成“我喜欢咖啡”。", "Build 'I like coffee.'", ["coffee.", "I", "like"], [1, 2, 0], "顺序是主语＋动词＋宾语。", "Use subject + verb + object.", ["en-svo", "en-like"], ["en-like-coffee"]),
    shortInput("en-type-do-question", "输入“你喜欢茶吗？”。", "Type 'Do you like tea?'", ["Do you like tea?", "Do you like tea"], "Do you后接动词原形like。", "Put the base verb like after Do you.", ["en-do-question", "en-question-mark"], ["en-ask-like-tea"]),
    single("en-recognize-name", "哪一句是在询问名字？", "Which sentence asks a name?", [target("Hello."), target("What's your name?"), target("Nice to meet you.")], 1, "What's your name?用于询问名字。", "What's your name? asks for a name.", ["en-ask-name"], ["en-ask-name-line"]),
    ordering("en-order-introduction", "排成完整自我介绍。", "Build a complete introduction.", ["Maya.", "name is", "My"], [2, 1, 0], "My name is后接名字。", "Put the name after My name is.", ["en-name-pattern"], ["en-introduce"]),
    role("en-role-introduction", "第一次见面：问候、介绍名字并说很高兴认识对方。", "First meeting: greet the person, give your name, and say it is nice to meet them.", "至少使用Hello、My name is或I'm，以及Nice to meet you。", "Use Hello, My name is or I'm, and Nice to meet you.", ["en-hello", "en-name-pattern", "en-nice-meet"], ["en-introduce"]),
    single("en-read-profile", "阅读个人资料：Maya住在哪里？", "Read the profile: Where does Maya live?", [l("加拿大", "Canada"), l("伦敦", "London"), l("未说明", "Not stated")], 1, "短文最后一句说She lives in London。", "The final sentence says She lives in London.", ["en-live", "en-city-country"], ["en-reading-profile"]),
    shortInput("en-capstone-foundation", "基础阶段综合：输入“I am a student.”，注意大小写、be动词和词序。", "Foundation checkpoint: type 'I am a student.' with correct capitalization, be, and word order.", ["I am a student.", "I am a student"], "检查I大写、I和am搭配，以及a student。", "Check capital I, I + am, and a student.", ["en-uppercase", "en-pronouns", "en-be", "en-indefinite-article", "en-svo", "en-student-teacher"], ["en-i-student"]),
    single("en-recognize-time", "哪一句表示三点？", "Which sentence means three o'clock?", [target("It's three o'clock."), target("It's five o'clock."), target("It's thirteen dollars.")], 0, "three o'clock表示三点整。", "Three o'clock means exactly 3:00.", ["en-numbers", "en-clock"], ["en-time-three"]),
    ordering("en-order-time-question", "排成“几点了？”。", "Build 'What time is it?'", ["is it?", "What time"], [1, 0], "What time放在is it前。", "Put What time before is it.", ["en-what-time"], ["en-ask-time"]),
    shortInput("en-type-three", "输入“现在三点”。", "Type 'It's three o'clock.'", ["It's three o'clock.", "It's three o'clock"], "使用It's和o'clock。", "Use It's and o'clock.", ["en-clock", "en-numbers"], ["en-time-three"]),
    single("en-read-hours", "阅读营业告示：图书馆今天是什么状态？", "Read the notice: What is the library's status today?", [l("上午九点开放", "Open at nine"), l("今天不营业", "Closed today"), l("下午五点才开放", "Opens at five")], 1, "最后一句是It is closed today。", "The final sentence says It is closed today.", ["en-today", "en-closed"], ["en-reading-hours"]),
    single("en-recognize-where", "哪一句是在询问地点？", "Which sentence asks for a place?", [target("Where is the restroom?"), target("What time is it?"), target("How much is this?")], 0, "Where is用于询问位置。", "Where is asks for a location.", ["en-where", "en-restroom-station"], ["en-ask-restroom"]),
    ordering("en-order-restroom", "排成“洗手间在哪里？”。", "Build 'Where is the restroom?'", ["the restroom?", "Where is"], [1, 0], "Where is后接地点。", "Put the place after Where is.", ["en-where", "en-restroom-station"], ["en-ask-restroom"]),
    shortInput("en-type-not-here", "输入“它不在这里”。", "Type 'It isn't here.'", ["It isn't here.", "It isn't here", "It is not here.", "It is not here"], "可使用isn't或is not。", "Use either isn't or is not.", ["en-not-here", "en-here-there"], ["en-not-here-line"]),
    single("en-recognize-price", "哪一句是在问价格？", "Which sentence asks a price?", [target("How much is this?"), target("Where is this?"), target("What time is it?")], 0, "How much询问价格。", "How much asks about price.", ["en-how-much", "en-this-that"], ["en-ask-price"]),
    ordering("en-order-cost", "排成“它五美元”。", "Build 'It costs five dollars.'", ["five dollars.", "It", "costs"], [1, 2, 0], "It＋costs＋价格。", "Use It + costs + price.", ["en-cost", "en-dollar", "en-numbers"], ["en-cost-five"]),
    shortInput("en-type-how-much", "输入“这个多少钱？”。", "Type 'How much is this?'", ["How much is this?", "How much is this"], "How much is this以问号结束。", "End How much is this with a question mark.", ["en-how-much", "en-this-that"], ["en-ask-price"]),
    single("en-read-price-list", "阅读价格表：面包多少钱？", "Read the price list: How much is the bread?", [l("两美元", "Two dollars"), l("三美元", "Three dollars"), l("四美元", "Four dollars")], 1, "价格表写着Bread: three dollars。", "The list says Bread: three dollars.", ["en-bread", "en-dollar"], ["en-reading-price-list"]),
    single("en-recognize-airport", "哪一句是在问机场巴士？", "Which sentence asks about an airport bus?", [target("Does this bus go to the airport?"), target("Where is the restroom?"), target("How much is the bus?")], 0, "go to the airport表示前往机场。", "Go to the airport means travel to the airport.", ["en-go-to", "en-bus-train", "en-airport"], ["en-airport-bus"]),
    ordering("en-order-route-question", "排成“我怎么去车站？”。", "Build 'How do I get to the station?'", ["the station?", "get to", "How do I"], [2, 1, 0], "How do I＋get to＋地点。", "Use How do I + get to + place.", ["en-how-get", "en-restroom-station"], ["en-ask-route"]),
    role("en-role-route", "你在街上找车站。礼貌引起注意并询问怎么去。", "You are looking for the station. Politely get someone's attention and ask how to get there.", "使用Excuse me和How do I get to the station?", "Use Excuse me and How do I get to the station?", ["en-excuse-me", "en-how-get", "en-restroom-station"], ["en-ask-route"]),
    single("en-read-route", "阅读线路说明：哪辆车不停靠这里？", "Read the route: Which service does not stop here?", [l("12路公交", "Bus 12"), l("机场巴士", "The airport bus"), l("列车", "The train")], 1, "短文写着The airport bus does not stop here。", "The text says the airport bus does not stop here.", ["en-airport", "en-stop-exit"], ["en-reading-route"]),
    role("en-capstone-daily-life", "日常生活阶段综合：先询问时间和面包价格，再询问如何去机场。", "Daily-life checkpoint: ask the time and the price of bread, then ask how to get to the airport.", "完成标准：包含What time、How much和How do I get to三类问题。", "Include a What time, How much, and How do I get to question.", ["en-what-time", "en-how-much", "en-how-get", "en-bread", "en-airport"], ["en-ask-time", "en-ask-price", "en-ask-route"]),
    single("en-recognize-help", "哪一句是在请求帮助？", "Which sentence asks for help?", [target("Can you help me?"), target("I like coffee."), target("It costs five dollars.")], 0, "Can you help me?是礼貌求助。", "Can you help me? is a polite request for help.", ["en-help", "en-can-you"], ["en-request-help"]),
    ordering("en-order-understand", "排成“我不明白”。", "Build 'I don't understand.'", ["understand.", "don't", "I"], [2, 1, 0], "I＋don't＋动词。", "Use I + don't + verb.", ["en-not-understand", "en-dont"], ["en-dont-understand"]),
    role("en-role-clarify", "你没有听懂。说明不理解，并请对方慢一点重复。", "You did not understand. Say so and ask the person to repeat more slowly.", "依次使用I don't understand、Please repeat和more slowly。", "Use I don't understand, Please repeat, and more slowly.", ["en-not-understand", "en-repeat", "en-slowly"], ["en-dont-understand", "en-repeat-slowly"]),
    single("en-recognize-order", "顾客点了什么？", "What did the customer order?", [l("一杯咖啡", "A cup of coffee"), l("两杯茶", "Two teas"), l("一杯水", "A cup of water")], 0, "句子包含a cup of coffee。", "The sentence contains a cup of coffee.", ["en-cup", "en-coffee-tea"], ["en-order-coffee"]),
    ordering("en-order-coffee-request", "排成礼貌的咖啡点单。", "Build a polite coffee order.", ["please.", "a cup of coffee,", "I'd like"], [2, 1, 0], "I'd like＋物品＋please。", "Use I'd like + item + please.", ["en-would-like", "en-cup", "en-coffee-tea", "en-please"], ["en-order-coffee"]),
    role("en-role-order", "向店员点一杯茶，并礼貌结束请求。", "Order a cup of tea from the server and end the request politely.", "可使用I'd like a cup of tea, please。", "You can say I'd like a cup of tea, please.", ["en-would-like", "en-cup", "en-coffee-tea", "en-please"], ["en-order-tea"]),
    multiple("en-recognize-details", "顾客明确说了哪些信息？选择全部正确项。", "Which details did the customer state? Choose all that apply.", [l("两杯", "Two cups"), l("大杯", "Large"), l("冰的", "Iced"), l("茶", "Tea")], [0, 1, 2], "句子是Two large iced coffees。", "The sentence says Two large iced coffees.", ["en-two-cups", "en-small-large", "en-hot-iced"], ["en-two-iced"]),
    ordering("en-order-no-sugar", "排成“请不要糖”。", "Build 'Without sugar, please.'", ["please.", "sugar,", "Without"], [2, 1, 0], "Without＋配料＋please。", "Use Without + ingredient + please.", ["en-with-without", "en-sugar-milk", "en-please"], ["en-no-sugar"]),
    role("en-role-details", "点两杯小杯热茶，不加奶。", "Order two small hot teas without milk.", "组合数量、尺寸、温度、饮料和without milk。", "Combine quantity, size, temperature, drink, and without milk.", ["en-two-cups", "en-small-large", "en-hot-iced", "en-coffee-tea", "en-with-without", "en-sugar-milk"], []),
    single("en-recognize-here-go", "店员给了哪两个选择？", "Which two choices did the server offer?", [l("堂食或外带", "For here or to go"), l("热的或冰的", "Hot or iced"), l("小杯或大杯", "Small or large")], 0, "For here or to go询问堂食或外带。", "For here or to go asks where the order will be consumed.", ["en-here-go"], ["en-here-or-go"]),
    ordering("en-order-to-go", "排成“外带，谢谢”。", "Build 'To go, please.'", ["please.", "To go,"], [1, 0], "先说To go，再加please。", "Say To go, then add please.", ["en-to-go", "en-please"], ["en-choose-go"]),
    role("en-role-finish", "选择外带，并告诉店员点单完成后表示感谢。", "Choose takeaway, say the order is complete, and thank the server.", "使用To go, please和That's all, thank you。", "Use To go, please and That's all, thank you.", ["en-to-go", "en-thats-all", "en-thank-you"], ["en-choose-go", "en-finish-order"]),
    role("en-capstone-course", "结业综合：先问去机场的路线，听不懂时请求慢一点重复；到咖啡店后点两杯大杯冰咖啡、不加糖并选择外带。", "Course capstone: ask how to get to the airport and request a slower repetition if needed; then order two large iced coffees without sugar and choose takeaway.", "完成标准：依次包含机场路线、澄清请求、数量/尺寸/冷热、without sugar和to go。意思清楚即可，不要求逐字复现。", "Include the airport route, a clarification request, quantity/size/temperature, without sugar, and to go. Clear meaning is enough; exact wording is not required.", ["en-airport", "en-how-get", "en-repeat", "en-slowly", "en-two-cups", "en-small-large", "en-hot-iced", "en-with-without", "en-sugar-milk", "en-to-go"], ["en-ask-route", "en-repeat-slowly", "en-two-iced", "en-no-sugar", "en-choose-go"]),
  ];

  const plans: Plan[] = [
    { id: "alphabet-and-case", title: l("第一课：字母、大小写和书面拼写", "Lesson 1: Alphabet, case, and written spelling"), goalRef: "recognize-english-alphabet", goal: l("能够识别英语字母、大小写和书面拼写问题。", "Can recognize English letters, case, and a written spelling question."), knowledgeRefs: ["en-alphabet", "en-uppercase", "en-vowels", "en-consonants", "en-spell-name", "en-question-mark"], utteranceRefs: ["en-alphabet-line", "en-vowel-line", "en-ask-spelling"], recognition: "en-recognize-vowel", guided: "en-order-alphabet", task: "en-type-name-question", diagnostic: "en-recognize-vowel" },
    { id: "pronouns-and-be", title: l("第二课：人称代词和be动词", "Lesson 2: Pronouns and be"), goalRef: "use-pronouns-and-be", goal: l("能够用人称代词和be动词写出基础身份句。", "Can write basic identity statements with subject pronouns and be."), knowledgeRefs: ["en-pronouns", "en-be", "en-be-negative", "en-contractions", "en-indefinite-article", "en-student-teacher"], utteranceRefs: ["en-i-student", "en-she-teacher", "en-we-ready"], recognition: "en-recognize-am", guided: "en-order-student", task: "en-type-contraction", diagnostic: "en-recognize-am" },
    { id: "basic-word-order", title: l("第三课：基础词序和一般疑问句", "Lesson 3: Basic word order and yes/no questions"), goalRef: "build-basic-english-sentences", goal: l("能够按基础词序写陈述句，并使用Do you构成简单问题。", "Can build a basic statement and form a simple Do you question."), knowledgeRefs: ["en-svo", "en-like", "en-do-question", "en-do-answer", "en-plural", "en-question-mark"], utteranceRefs: ["en-like-coffee", "en-ask-like-tea", "en-answer-like"], recognition: "en-recognize-question", guided: "en-order-like-coffee", task: "en-type-do-question", diagnostic: "en-recognize-question" },
    { id: "greeting-and-identity", title: l("第四课：问候、名字和个人资料", "Lesson 4: Greetings, names, and profiles"), goalRef: "introduce-in-english", goal: l("能够问候、介绍名字，并从简短个人资料中提取身份和居住地。", "Can greet, give a name, and extract identity and residence from a short profile."), knowledgeRefs: ["en-hello", "en-name-pattern", "en-ask-name", "en-from", "en-live", "en-city-country", "en-nice-meet", "en-student-teacher"], utteranceRefs: ["en-introduce", "en-ask-name-line", "en-reading-profile"], recognition: "en-recognize-name", guided: "en-order-introduction", task: "en-role-introduction", diagnostic: "en-recognize-name", reading: "en-read-profile", capstone: { title: l("基础阶段综合任务", "Foundation stage checkpoint"), exerciseRef: "en-capstone-foundation", knowledgeRefs: ["en-uppercase", "en-pronouns", "en-be", "en-indefinite-article", "en-svo", "en-student-teacher"], utteranceRefs: ["en-i-student", "en-introduce"] } },
    { id: "numbers-and-time", title: l("第五课：数字、时间和营业告示", "Lesson 5: Numbers, time, and opening-hour notices"), goalRef: "tell-time-in-english", goal: l("能够询问时间，并从简短营业告示中提取时间和开放状态。", "Can ask the time and extract hours and opening status from a short notice."), knowledgeRefs: ["en-numbers", "en-clock", "en-what-time", "en-today", "en-morning-afternoon", "en-from-to", "en-open", "en-closed"], utteranceRefs: ["en-time-three", "en-ask-time", "en-reading-hours"], recognition: "en-recognize-time", guided: "en-order-time-question", task: "en-type-three", reading: "en-read-hours" },
    { id: "places-and-questions", title: l("第六课：询问地点和基础否定", "Lesson 6: Ask locations and use basic negation"), goalRef: "ask-location-in-english", goal: l("能够询问地点、理解左右方向并说明某物不在这里。", "Can ask for a place, understand left and right, and say something is not here."), knowledgeRefs: ["en-where", "en-here-there", "en-there-is", "en-not-here", "en-restroom-station", "en-left-right"], utteranceRefs: ["en-ask-restroom", "en-station-left", "en-not-here-line"], recognition: "en-recognize-where", guided: "en-order-restroom", task: "en-type-not-here" },
    { id: "shopping-and-prices", title: l("第七课：指物、询价和读取价格表", "Lesson 7: Point, ask prices, and read a price list"), goalRef: "ask-price-in-english", goal: l("能够询问价格，并从简短价格表中找到商品信息。", "Can ask a price and find item information in a short price list."), knowledgeRefs: ["en-this-that", "en-how-much", "en-dollar", "en-cost", "en-water", "en-bread", "en-coffee-item", "en-numbers"], utteranceRefs: ["en-ask-price", "en-cost-five", "en-reading-price-list"], recognition: "en-recognize-price", guided: "en-order-cost", task: "en-type-how-much", reading: "en-read-price-list" },
    { id: "transport-and-directions", title: l("第八课：交通、问路和线路信息", "Lesson 8: Transport, directions, and route information"), goalRef: "ask-transport-in-english", goal: l("能够询问交通和路线，并从简短线路说明中提取目的地信息。", "Can ask about transport and routes and extract destination information from a short notice."), knowledgeRefs: ["en-excuse-me", "en-go-to", "en-bus-train", "en-airport", "en-how-get", "en-stop-exit", "en-straight", "en-restroom-station"], utteranceRefs: ["en-airport-bus", "en-ask-route", "en-reading-route"], recognition: "en-recognize-airport", guided: "en-order-route-question", task: "en-role-route", reading: "en-read-route", capstone: { title: l("日常生活阶段综合任务", "Daily-life stage checkpoint"), exerciseRef: "en-capstone-daily-life", knowledgeRefs: ["en-what-time", "en-how-much", "en-how-get", "en-bread", "en-airport"], utteranceRefs: ["en-ask-time", "en-ask-price", "en-ask-route"] } },
    { id: "help-and-clarification", title: l("第九课：求助、否定和澄清", "Lesson 9: Help, negation, and clarification"), goalRef: "request-help-in-english", goal: l("能够请求帮助、说明不理解，并请对方慢一点重复。", "Can ask for help, say something was not understood, and request a slower repetition."), knowledgeRefs: ["en-help", "en-not-understand", "en-repeat", "en-slowly", "en-can-you", "en-dont", "en-excuse-me"], utteranceRefs: ["en-request-help", "en-dont-understand", "en-repeat-slowly"], recognition: "en-recognize-help", guided: "en-order-understand", task: "en-role-clarify" },
    { id: "basic-order", title: l("第十课：礼貌点一杯饮料", "Lesson 10: Order a drink politely"), goalRef: "order-drink-in-english", goal: l("能够查看菜单并礼貌地点一杯饮料。", "Can view a menu and politely order one drink."), knowledgeRefs: ["en-would-like", "en-please", "en-coffee-tea", "en-cup", "en-menu"], utteranceRefs: ["en-order-coffee", "en-order-tea", "en-ask-menu"], recognition: "en-recognize-order", guided: "en-order-coffee-request", task: "en-role-order" },
    { id: "drink-details", title: l("第十一课：数量、尺寸和饮料偏好", "Lesson 11: Quantity, size, and drink preferences"), goalRef: "specify-drink-in-english", goal: l("能够说明饮料数量、尺寸、冷热和配料偏好。", "Can specify drink quantity, size, temperature, and ingredient preferences."), knowledgeRefs: ["en-hot-iced", "en-two-cups", "en-with-without", "en-or", "en-small-large", "en-sugar-milk", "en-coffee-tea"], utteranceRefs: ["en-ask-temperature", "en-two-iced", "en-no-sugar"], recognition: "en-recognize-details", guided: "en-order-no-sugar", task: "en-role-details" },
    { id: "dine-or-takeaway", title: l("第十二课：选择堂食或外带并结束点单", "Lesson 12: Choose dine-in or takeaway and finish an order"), goalRef: "finish-order-in-english", goal: l("能够选择堂食或外带、结束点单并表示感谢。", "Can choose dine-in or takeaway, finish an order, and give thanks."), knowledgeRefs: ["en-here-go", "en-to-go", "en-thats-all", "en-thank-you", "en-or", "en-please"], utteranceRefs: ["en-here-or-go", "en-choose-go", "en-finish-order"], recognition: "en-recognize-here-go", guided: "en-order-to-go", task: "en-role-finish", capstone: { title: l("课程结业综合任务", "Course completion capstone"), exerciseRef: "en-capstone-course", knowledgeRefs: ["en-airport", "en-how-get", "en-repeat", "en-slowly", "en-two-cups", "en-small-large", "en-hot-iced", "en-with-without", "en-sugar-milk", "en-to-go"], utteranceRefs: ["en-ask-route", "en-repeat-slowly", "en-two-iced", "en-no-sugar", "en-choose-go"] } },
  ];

  return {
    schemaVersion: 2,
    manifest: {
      id: "private.en.cafe-request",
      version: "0.6.0",
      languageId: "en",
      title: l("英语零基础入门", "English Zero Beginner"),
      description: l("从字母、大小写和基础句序开始，学习问候、时间、位置、购物、交通、求助与服务场景中的英语 A1 核心表达。课程仅使用文字练习，不包含发音评分。", "Start with letters, capitalization, and basic word order, then build English A1 core expressions for greetings, time, places, shopping, transport, help, and service encounters. The course uses text activities only and does not score pronunciation."),
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
