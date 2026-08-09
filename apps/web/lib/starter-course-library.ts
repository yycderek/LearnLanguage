import type {
  CoursePack,
  CourseStep,
  Exercise,
  KnowledgeItem,
  LocalizedText,
  Utterance,
} from "@learn-language/protocol";

const l = (chinese: string, english: string): LocalizedText => ({ "zh-CN": chinese, en: english });
const target = (value: string): LocalizedText => ({ "zh-CN": value, en: value, native: value });

type LessonPlan = {
  id: string;
  title: LocalizedText;
  goalRef: string;
  knowledgeRefs: string[];
  utteranceRefs: string[];
  recognitionExerciseRef: string;
  guidedExerciseRef: string;
  taskExerciseRef: string;
};

function lessonSteps(plan: LessonPlan): CourseStep[] {
  const definitions: Array<Omit<CourseStep, "next">> = [
    { id: "diagnose", phase: "diagnostic", title: l("检查已有知识", "Check what you already know"), supportLevel: "full", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [] },
    { id: "preteach", phase: "preteach", title: l("学习本课核心表达", "Learn the essential expressions"), supportLevel: "full", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [] },
    { id: "supported-input", phase: "supported-input", title: l("带翻译理解场景", "Understand the scene with translation"), supportLevel: "full", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [] },
    { id: "target-input", phase: "supported-input", title: l("只看目标语言", "Read only the target language"), supportLevel: "target-language-only", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [] },
    { id: "independent-input", phase: "comprehension", title: l("独立理解关键信息", "Understand the key information"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [plan.recognitionExerciseRef] },
    { id: "guided-output", phase: "guided-output", title: l("重组本课表达", "Rebuild the lesson expression"), supportLevel: "target-language-only", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [plan.guidedExerciseRef] },
    { id: "independent-task", phase: "independent-task", title: l("独立完成场景任务", "Complete the scene independently"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [plan.taskExerciseRef] },
    { id: "feedback-retry", phase: "feedback-retry", title: l("根据反馈重新表达", "Retry with feedback"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [plan.taskExerciseRef] },
    { id: "delayed-transfer", phase: "delayed-transfer", title: l("迁移到相似场景", "Transfer to a similar scene"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [plan.taskExerciseRef] },
  ];
  return definitions.map((step, index) => ({ ...step, next: index < definitions.length - 1 ? [definitions[index + 1]!.id] : [] }));
}

function baseCourse({
  languageId,
  adapterId,
  targetName,
  englishTargetName,
  knowledge,
  utterances,
  exercises,
  lessons,
}: {
  languageId: string;
  adapterId: string;
  targetName: string;
  englishTargetName: string;
  knowledge: KnowledgeItem[];
  utterances: Utterance[];
  exercises: Exercise[];
  lessons: LessonPlan[];
}): CoursePack {
  return {
    schemaVersion: 2,
    manifest: {
      id: `private.${languageId}.cafe-request`,
      version: "0.2.0",
      languageId,
      title: l(`${targetName}咖啡店入门`, `${englishTargetName} Café Starter`),
      description: l("用三个递进课节掌握点单、规格数量和堂食外带表达。", "Build café-ordering skills across three progressive lessons: ordering, details, and dine-in or takeaway."),
      author: { id: "learn-language", displayName: "LearnLanguage" },
      visibility: "private",
      status: "draft",
      source: { kind: "original" },
      languageAdapter: { id: adapterId, version: "1.0.0" },
    },
    goals: lessons.map((lesson, index) => ({
      id: lesson.goalRef,
      description: index === 0
        ? l("能够礼貌地点一杯饮料。", "Can politely order a drink.")
        : index === 1
          ? l("能够说明饮料的冷热、种类和数量。", "Can specify a drink's temperature, type, and quantity.")
          : l("能够回答堂食或外带问题并确认选择。", "Can answer a dine-in or takeaway question and confirm the choice."),
      framework: { name: "LearnLanguage Starter", level: "A1" },
    })),
    knowledge,
    utterances,
    exercises,
    rubrics: [{ id: "cafe-task-rubric", dimensions: ["task-completion", "comprehensibility", "target-language", "prompt-dependence"], retryRequired: true }],
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      canDoGoalRefs: [lesson.goalRef],
      entryStepId: "diagnose",
      steps: lessonSteps(lesson),
    })),
  };
}

function japaneseCourse(): CoursePack {
  const knowledge: KnowledgeItem[] = [
    { id: "ja-coffee", kind: "lexeme", form: "コーヒー", reading: { kana: "コーヒー", hepburn: "kōhī" }, meaning: l("咖啡", "coffee"), usage: l("饮料名称，可直接放在请求表达前。", "A drink name that can come directly before a request expression.") },
    { id: "ja-tea", kind: "lexeme", form: "紅茶", reading: { kana: "こうちゃ", hepburn: "kōcha" }, meaning: l("红茶", "black tea"), usage: l("在咖啡店常见的另一种饮料选择。", "Another common café drink option.") },
    { id: "ja-request", kind: "grammar", form: "〜、お願いします", reading: { kana: "〜、おねがいします", hepburn: "onegai shimasu" }, meaning: l("请给我……", "..., please"), usage: l("把想要的物品放在前面，用于礼貌点单。", "Place the item you want first to make a polite order.") },
    { id: "ja-hot", kind: "lexeme", form: "ホット", reading: { kana: "ホット", hepburn: "hotto" }, meaning: l("热饮", "hot"), usage: l("回答店员询问饮料冷热时使用。", "Used when answering whether a drink should be hot or iced.") },
    { id: "ja-iced", kind: "lexeme", form: "アイス", reading: { kana: "アイス", hepburn: "aisu" }, meaning: l("冰饮", "iced"), usage: l("可放在饮料名称前，如アイスコーヒー。", "Can come before a drink name, as in iced coffee.") },
    { id: "ja-two", kind: "lexeme", form: "二つ", reading: { kana: "ふたつ", hepburn: "futatsu" }, meaning: l("两个／两份", "two items"), usage: l("用于计算一般物品或点单份数。", "A general counter form for two items or servings.") },
    { id: "ja-inside", kind: "lexeme", form: "店内", reading: { kana: "てんない", hepburn: "tennai" }, meaning: l("店内／堂食", "in the shop / dine in"), usage: l("店员可能用它确认是否在店内饮用。", "Staff may use it when confirming whether you will drink inside.") },
    { id: "ja-takeaway", kind: "lexeme", form: "持ち帰り", reading: { kana: "もちかえり", hepburn: "mochikaeri" }, meaning: l("外带", "takeaway"), usage: l("说明要把饮料带走。", "Indicates that you want to take the drink away.") },
    { id: "ja-choice", kind: "grammar", form: "〜でお願いします", reading: { kana: "〜でおねがいします", hepburn: "de onegai shimasu" }, meaning: l("请选择……／就要……", "I'll have ..."), usage: l("在店员给出选项后确认自己的选择。", "Confirms your choice after staff offer alternatives.") },
  ];
  const utterances: Utterance[] = [
    { id: "ja-order-coffee", text: "コーヒー、お願いします。", translation: l("请给我咖啡。", "Coffee, please."), reading: { kana: "コーヒー、おねがいします。", hepburn: "kōhī, onegai shimasu." }, knowledgeRefs: ["ja-coffee", "ja-request"] },
    { id: "ja-order-tea", text: "紅茶、お願いします。", translation: l("请给我红茶。", "Black tea, please."), reading: { kana: "こうちゃ、おねがいします。", hepburn: "kōcha, onegai shimasu." }, knowledgeRefs: ["ja-tea", "ja-request"] },
    { id: "ja-ask-temperature", text: "ホットですか？ アイスですか？", translation: l("要热的还是冰的？", "Hot or iced?"), reading: { kana: "ホットですか？ アイスですか？", hepburn: "hotto desu ka? aisu desu ka?" }, knowledgeRefs: ["ja-hot", "ja-iced"] },
    { id: "ja-order-two-iced", text: "アイスコーヒーを二つ、お願いします。", translation: l("请给我两杯冰咖啡。", "Two iced coffees, please."), reading: { kana: "アイスコーヒーをふたつ、おねがいします。", hepburn: "aisu kōhī o futatsu, onegai shimasu." }, knowledgeRefs: ["ja-iced", "ja-coffee", "ja-two", "ja-request"] },
    { id: "ja-ask-location", text: "店内ですか？ 持ち帰りですか？", translation: l("堂食还是外带？", "For here or takeaway?"), reading: { kana: "てんないですか？ もちかえりですか？", hepburn: "tennai desu ka? mochikaeri desu ka?" }, knowledgeRefs: ["ja-inside", "ja-takeaway"] },
    { id: "ja-choose-takeaway", text: "持ち帰りでお願いします。", translation: l("请帮我做成外带。", "Takeaway, please."), reading: { kana: "もちかえりでおねがいします。", hepburn: "mochikaeri de onegai shimasu." }, knowledgeRefs: ["ja-takeaway", "ja-choice"] },
  ];
  const exercises: Exercise[] = [
    { id: "ja-recognize-drink", kind: "single-choice", prompt: l("顾客点了什么？", "What did the customer order?"), options: [l("咖啡", "Coffee"), l("红茶", "Black tea"), l("果汁", "Juice")], correctOptionIndex: 0, guidance: l("找出句子开头的饮料名称。", "Look for the drink name at the start."), knowledgeRefs: ["ja-coffee"], utteranceRefs: ["ja-order-coffee"] },
    { id: "ja-build-request", kind: "ordering", prompt: l("把词块排成礼貌的咖啡点单表达。", "Put the chunks into a polite coffee order."), options: [target("コーヒー、"), target("お願いします。")], correctOrder: [0, 1], guidance: l("先说想要的物品，再说礼貌请求。", "Name the item first, then add the polite request."), knowledgeRefs: ["ja-coffee", "ja-request"], utteranceRefs: ["ja-order-coffee"] },
    { id: "ja-role-basic", kind: "role-play", prompt: l("店员正在等你点单，请点一杯红茶。", "The server is ready. Order a black tea."), guidance: l("使用紅茶和お願いします。", "Use 紅茶 and お願いします."), knowledgeRefs: ["ja-tea", "ja-request"], utteranceRefs: ["ja-order-tea"], rubricRef: "cafe-task-rubric", requiredCapabilities: ["token-comparison"], capabilityFallback: "self-assessment" },
    { id: "ja-recognize-temperature", kind: "single-choice", prompt: l("店员正在确认什么？", "What is the server confirming?"), options: [l("饮料冷热", "Hot or iced"), l("堂食外带", "For here or takeaway"), l("付款方式", "Payment method")], correctOptionIndex: 0, guidance: l("留意ホット和アイス。", "Notice ホット and アイス."), knowledgeRefs: ["ja-hot", "ja-iced"], utteranceRefs: ["ja-ask-temperature"] },
    { id: "ja-select-details", kind: "multiple-choice", prompt: l("顾客明确说出了哪些信息？选择全部正确项。", "Which details did the customer state? Choose all that apply."), options: [l("冰的", "Iced"), l("咖啡", "Coffee"), l("两杯", "Two"), l("外带", "Takeaway")], correctOptionIndices: [0, 1, 2], guidance: l("逐一对应アイス、コーヒー和二つ。", "Match アイス, コーヒー, and 二つ."), knowledgeRefs: ["ja-iced", "ja-coffee", "ja-two"], utteranceRefs: ["ja-order-two-iced"] },
    { id: "ja-role-details", kind: "role-play", prompt: l("点两杯热红茶。", "Order two hot black teas."), guidance: l("先说明冷热和饮料，再加数量与礼貌请求。", "Give the temperature and drink, then quantity and the polite request."), knowledgeRefs: ["ja-hot", "ja-tea", "ja-two", "ja-request"], utteranceRefs: [], rubricRef: "cafe-task-rubric", requiredCapabilities: ["token-comparison"], capabilityFallback: "self-assessment" },
    { id: "ja-recognize-location", kind: "single-choice", prompt: l("店员给了顾客哪两个选择？", "Which two choices did the server offer?"), options: [l("堂食或外带", "For here or takeaway"), l("热或冰", "Hot or iced"), l("咖啡或茶", "Coffee or tea")], correctOptionIndex: 0, guidance: l("识别店内和持ち帰り。", "Identify 店内 and 持ち帰り."), knowledgeRefs: ["ja-inside", "ja-takeaway"], utteranceRefs: ["ja-ask-location"] },
    { id: "ja-build-takeaway", kind: "ordering", prompt: l("把词块排成“请外带”的回答。", "Put the chunks into a takeaway response."), options: [target("持ち帰り"), target("で"), target("お願いします。")], correctOrder: [0, 1, 2], guidance: l("选择项后接でお願いします。", "Put でお願いします after the selected option."), knowledgeRefs: ["ja-takeaway", "ja-choice"], utteranceRefs: ["ja-choose-takeaway"] },
    { id: "ja-role-transfer", kind: "role-play", prompt: l("店员问堂食还是外带。回答外带，并重新确认一杯冰咖啡。", "The server asks for here or takeaway. Choose takeaway and reconfirm one iced coffee."), guidance: l("先回答持ち帰り，再补充饮料请求。", "Answer 持ち帰り first, then add the drink request."), knowledgeRefs: ["ja-takeaway", "ja-choice", "ja-iced", "ja-coffee"], utteranceRefs: ["ja-choose-takeaway"], rubricRef: "cafe-task-rubric", requiredCapabilities: ["token-comparison"], capabilityFallback: "self-assessment" },
  ];
  const lessons: LessonPlan[] = [
    { id: "basic-order", title: l("第一课：礼貌点一杯饮料", "Lesson 1: Order a drink politely"), goalRef: "order-drink", knowledgeRefs: ["ja-coffee", "ja-tea", "ja-request"], utteranceRefs: ["ja-order-coffee", "ja-order-tea"], recognitionExerciseRef: "ja-recognize-drink", guidedExerciseRef: "ja-build-request", taskExerciseRef: "ja-role-basic" },
    { id: "drink-details", title: l("第二课：说明冷热和数量", "Lesson 2: Specify temperature and quantity"), goalRef: "specify-drink", knowledgeRefs: ["ja-hot", "ja-iced", "ja-two", "ja-request"], utteranceRefs: ["ja-ask-temperature", "ja-order-two-iced"], recognitionExerciseRef: "ja-recognize-temperature", guidedExerciseRef: "ja-select-details", taskExerciseRef: "ja-role-details" },
    { id: "dine-or-takeaway", title: l("第三课：选择堂食或外带", "Lesson 3: Choose dine-in or takeaway"), goalRef: "choose-location", knowledgeRefs: ["ja-inside", "ja-takeaway", "ja-choice"], utteranceRefs: ["ja-ask-location", "ja-choose-takeaway"], recognitionExerciseRef: "ja-recognize-location", guidedExerciseRef: "ja-build-takeaway", taskExerciseRef: "ja-role-transfer" },
  ];
  return baseCourse({ languageId: "ja", adapterId: "core.japanese", targetName: "日语", englishTargetName: "Japanese", knowledge, utterances, exercises, lessons });
}

function cantoneseCourse(): CoursePack {
  const knowledge: KnowledgeItem[] = [
    { id: "yue-coffee", kind: "lexeme", form: "咖啡", reading: { jyutping: "gaa3 fe1" }, meaning: l("咖啡", "coffee"), usage: l("常见饮料名称。", "A common drink name.") },
    { id: "yue-tea", kind: "lexeme", form: "奶茶", reading: { jyutping: "naai5 caa4" }, meaning: l("奶茶", "milk tea"), usage: l("香港茶餐厅常见饮料。", "A common drink in Hong Kong-style cafés.") },
    { id: "yue-request", kind: "grammar", form: "唔該，我想要〜", reading: { jyutping: "m4 goi1, ngo5 soeng2 jiu3" }, meaning: l("麻烦，我想要……", "Excuse me, I would like ..."), usage: l("在服务场景中提出请求；也可用物品名称加唔該简洁点单。", "Makes a service request; an item name plus 唔該 can also form a concise order.") },
    { id: "yue-hot", kind: "lexeme", form: "熱", reading: { jyutping: "jit6" }, meaning: l("热的", "hot"), usage: l("说明饮料温度。", "Specifies a drink's temperature.") },
    { id: "yue-iced", kind: "lexeme", form: "凍", reading: { jyutping: "dung3" }, meaning: l("冰的／冻的", "iced / cold"), usage: l("常放在饮料名称前，如凍奶茶。", "Often comes before a drink name, as in iced milk tea.") },
    { id: "yue-two-cups", kind: "lexeme", form: "兩杯", reading: { jyutping: "loeng5 bui1" }, meaning: l("两杯", "two cups"), usage: l("兩表示数量二，杯是饮料量词。", "兩 gives the quantity two and 杯 is the classifier for cups.") },
    { id: "yue-here", kind: "lexeme", form: "喺度食", reading: { jyutping: "hai2 dou6 sik6" }, meaning: l("在这里吃／堂食", "eat here / dine in"), usage: l("回答餐厅询问堂食或外带。", "Answers whether an order is for dining in.") },
    { id: "yue-takeaway", kind: "lexeme", form: "拎走", reading: { jyutping: "ling1 zau2" }, meaning: l("拿走／外带", "take away"), usage: l("说明把食物或饮料带走。", "Indicates taking food or drink away.") },
    { id: "yue-or", kind: "grammar", form: "〜定〜？", reading: { jyutping: "ding6" }, meaning: l("……还是……？", "... or ...?"), usage: l("在两个明确选项之间提问。", "Asks someone to choose between two stated alternatives.") },
  ];
  const utterances: Utterance[] = [
    { id: "yue-order-coffee", text: "唔該，我想要一杯咖啡。", translation: l("麻烦，我想要一杯咖啡。", "Excuse me, I would like a coffee."), reading: { jyutping: "m4 goi1, ngo5 soeng2 jiu3 jat1 bui1 gaa3 fe1." }, knowledgeRefs: ["yue-coffee", "yue-request"] },
    { id: "yue-order-tea", text: "一杯奶茶，唔該。", translation: l("请给我一杯奶茶。", "A milk tea, please."), reading: { jyutping: "jat1 bui1 naai5 caa4, m4 goi1." }, knowledgeRefs: ["yue-tea", "yue-request"] },
    { id: "yue-ask-temperature", text: "凍定熱呀？", translation: l("要冰的还是热的？", "Iced or hot?"), reading: { jyutping: "dung3 ding6 jit6 aa3?" }, knowledgeRefs: ["yue-iced", "yue-hot", "yue-or"] },
    { id: "yue-order-two-iced", text: "兩杯凍奶茶，唔該。", translation: l("请给我两杯冰奶茶。", "Two iced milk teas, please."), reading: { jyutping: "loeng5 bui1 dung3 naai5 caa4, m4 goi1." }, knowledgeRefs: ["yue-two-cups", "yue-iced", "yue-tea", "yue-request"] },
    { id: "yue-ask-location", text: "喺度食定拎走？", translation: l("堂食还是外带？", "Eat here or take away?"), reading: { jyutping: "hai2 dou6 sik6 ding6 ling1 zau2?" }, knowledgeRefs: ["yue-here", "yue-takeaway", "yue-or"] },
    { id: "yue-choose-takeaway", text: "拎走，唔該。", translation: l("外带，谢谢。", "Takeaway, please."), reading: { jyutping: "ling1 zau2, m4 goi1." }, knowledgeRefs: ["yue-takeaway", "yue-request"] },
  ];
  const exercises: Exercise[] = [
    { id: "yue-recognize-drink", kind: "single-choice", prompt: l("顾客点了什么？", "What did the customer order?"), options: [l("咖啡", "Coffee"), l("奶茶", "Milk tea"), l("果汁", "Juice")], correctOptionIndex: 0, guidance: l("留意句尾的饮料名称。", "Notice the drink name near the end."), knowledgeRefs: ["yue-coffee"], utteranceRefs: ["yue-order-coffee"] },
    { id: "yue-build-request", kind: "ordering", prompt: l("把词块排成礼貌的咖啡点单表达。", "Put the chunks into a polite coffee order."), options: [target("唔該，"), target("我想要"), target("一杯咖啡。")], correctOrder: [0, 1, 2], guidance: l("先用唔該引起注意，再说我想要和物品。", "Start with 唔該, then say 我想要 and the item."), knowledgeRefs: ["yue-coffee", "yue-request"], utteranceRefs: ["yue-order-coffee"] },
    { id: "yue-role-basic", kind: "role-play", prompt: l("店员正在等你点单，请点一杯奶茶。", "The server is ready. Order a milk tea."), guidance: l("可以使用一杯奶茶，唔該。", "You can use 一杯奶茶，唔該."), knowledgeRefs: ["yue-tea", "yue-request"], utteranceRefs: ["yue-order-tea"], rubricRef: "cafe-task-rubric", requiredCapabilities: ["token-comparison"], capabilityFallback: "self-assessment" },
    { id: "yue-recognize-temperature", kind: "single-choice", prompt: l("店员正在确认什么？", "What is the server confirming?"), options: [l("饮料冷热", "Hot or iced"), l("堂食外带", "Dine in or takeaway"), l("饮料数量", "Quantity")], correctOptionIndex: 0, guidance: l("识别凍和熱。", "Identify 凍 and 熱."), knowledgeRefs: ["yue-iced", "yue-hot"], utteranceRefs: ["yue-ask-temperature"] },
    { id: "yue-select-details", kind: "multiple-choice", prompt: l("顾客明确说出了哪些信息？选择全部正确项。", "Which details did the customer state? Choose all that apply."), options: [l("两杯", "Two cups"), l("冰的", "Iced"), l("奶茶", "Milk tea"), l("堂食", "Dine in")], correctOptionIndices: [0, 1, 2], guidance: l("逐一对应兩杯、凍和奶茶。", "Match 兩杯, 凍, and 奶茶."), knowledgeRefs: ["yue-two-cups", "yue-iced", "yue-tea"], utteranceRefs: ["yue-order-two-iced"] },
    { id: "yue-role-details", kind: "role-play", prompt: l("点两杯热咖啡。", "Order two hot coffees."), guidance: l("组合数量、冷热、饮料和唔該。", "Combine quantity, temperature, drink, and 唔該."), knowledgeRefs: ["yue-two-cups", "yue-hot", "yue-coffee", "yue-request"], utteranceRefs: [], rubricRef: "cafe-task-rubric", requiredCapabilities: ["token-comparison"], capabilityFallback: "self-assessment" },
    { id: "yue-recognize-location", kind: "single-choice", prompt: l("店员给了顾客哪两个选择？", "Which two choices did the server offer?"), options: [l("堂食或外带", "Dine in or takeaway"), l("冰或热", "Iced or hot"), l("咖啡或奶茶", "Coffee or milk tea")], correctOptionIndex: 0, guidance: l("识别喺度食和拎走。", "Identify 喺度食 and 拎走."), knowledgeRefs: ["yue-here", "yue-takeaway"], utteranceRefs: ["yue-ask-location"] },
    { id: "yue-build-takeaway", kind: "ordering", prompt: l("把词块排成“外带，谢谢”的回答。", "Put the chunks into a takeaway response."), options: [target("拎走，"), target("唔該。")], correctOrder: [0, 1], guidance: l("先说选择，再加唔該。", "State the choice, then add 唔該."), knowledgeRefs: ["yue-takeaway", "yue-request"], utteranceRefs: ["yue-choose-takeaway"] },
    { id: "yue-role-transfer", kind: "role-play", prompt: l("店员问堂食还是外带。回答外带，并重新确认一杯冰奶茶。", "The server asks dine in or takeaway. Choose takeaway and reconfirm one iced milk tea."), guidance: l("先回答拎走，再补充饮料请求。", "Answer 拎走 first, then add the drink request."), knowledgeRefs: ["yue-takeaway", "yue-iced", "yue-tea", "yue-request"], utteranceRefs: ["yue-choose-takeaway"], rubricRef: "cafe-task-rubric", requiredCapabilities: ["token-comparison"], capabilityFallback: "self-assessment" },
  ];
  const lessons: LessonPlan[] = [
    { id: "basic-order", title: l("第一课：礼貌点一杯饮料", "Lesson 1: Order a drink politely"), goalRef: "order-drink", knowledgeRefs: ["yue-coffee", "yue-tea", "yue-request"], utteranceRefs: ["yue-order-coffee", "yue-order-tea"], recognitionExerciseRef: "yue-recognize-drink", guidedExerciseRef: "yue-build-request", taskExerciseRef: "yue-role-basic" },
    { id: "drink-details", title: l("第二课：说明冷热和数量", "Lesson 2: Specify temperature and quantity"), goalRef: "specify-drink", knowledgeRefs: ["yue-hot", "yue-iced", "yue-two-cups", "yue-or"], utteranceRefs: ["yue-ask-temperature", "yue-order-two-iced"], recognitionExerciseRef: "yue-recognize-temperature", guidedExerciseRef: "yue-select-details", taskExerciseRef: "yue-role-details" },
    { id: "dine-or-takeaway", title: l("第三课：选择堂食或外带", "Lesson 3: Choose dine-in or takeaway"), goalRef: "choose-location", knowledgeRefs: ["yue-here", "yue-takeaway", "yue-or"], utteranceRefs: ["yue-ask-location", "yue-choose-takeaway"], recognitionExerciseRef: "yue-recognize-location", guidedExerciseRef: "yue-build-takeaway", taskExerciseRef: "yue-role-transfer" },
  ];
  return baseCourse({ languageId: "yue-Hant-HK", adapterId: "core.cantonese", targetName: "粤语", englishTargetName: "Cantonese", knowledge, utterances, exercises, lessons });
}

export const bundledStarterLanguageIds = ["ja", "yue-Hant-HK"] as const;

export function bundledStarterCourse(languageId: string): CoursePack | undefined {
  if (languageId === "ja") return japaneseCourse();
  if (languageId === "yue-Hant-HK") return cantoneseCourse();
  return undefined;
}

export function bundledStarterCourses() {
  return bundledStarterLanguageIds.map((languageId) => bundledStarterCourse(languageId)!);
}
