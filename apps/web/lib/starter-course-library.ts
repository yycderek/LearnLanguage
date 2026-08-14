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
  goalDescription: LocalizedText;
  knowledgeRefs: string[];
  utteranceRefs: string[];
  diagnosticExerciseRef?: string;
  recognitionExerciseRef: string;
  guidedExerciseRef: string;
  taskExerciseRef: string;
};

type CourseExtension = {
  knowledge: KnowledgeItem[];
  utterances: Utterance[];
  exercises: Exercise[];
  lessons: LessonPlan[];
};

function lessonSteps(plan: LessonPlan): CourseStep[] {
  const core: CourseStep[] = [
    { id: "diagnose", phase: "diagnostic", title: l("检查已有知识", "Check what you already know"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: plan.diagnosticExerciseRef ? [plan.diagnosticExerciseRef] : [], next: ["preteach"] },
    { id: "preteach", phase: "preteach", title: l("学习本课核心表达", "Learn the essential expressions"), supportLevel: "full", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [], next: ["supported-input"] },
    { id: "supported-input", phase: "supported-input", title: l("带翻译理解场景", "Understand the scene with translation"), supportLevel: "full", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [], next: ["target-input"] },
    { id: "target-input", phase: "supported-input", title: l("只看目标语言", "Read only the target language"), supportLevel: "target-language-only", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [], next: ["independent-input"] },
    { id: "independent-input", phase: "comprehension", title: l("独立理解关键信息", "Understand the key information"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [plan.recognitionExerciseRef], next: ["guided-output"] },
    { id: "guided-output", phase: "guided-output", title: l("重组本课表达", "Rebuild the lesson expression"), supportLevel: "target-language-only", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: plan.utteranceRefs, exerciseRefs: [plan.guidedExerciseRef], next: ["independent-task"] },
    { id: "independent-task", phase: "independent-task", title: l("独立完成场景任务", "Complete the scene independently"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [plan.taskExerciseRef], next: ["feedback-retry"] },
    { id: "feedback-retry", phase: "feedback-retry", title: l("根据反馈重新表达", "Retry with feedback"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [plan.taskExerciseRef], next: ["delayed-transfer"] },
    { id: "delayed-transfer", phase: "delayed-transfer", title: l("迁移到相似场景", "Transfer to a similar scene"), supportLevel: "none", knowledgeRefs: plan.knowledgeRefs, utteranceRefs: [], exerciseRefs: [plan.taskExerciseRef], next: [] },
  ];
  if (!plan.diagnosticExerciseRef) return core;
  core[0]!.next = ["preteach", "diagnostic-skip"];
  core[0]!.diagnostic = { learnNextStepId: "preteach", passNextStepId: "diagnostic-skip" };
  core.push({ id: "diagnostic-skip", phase: "diagnostic", title: l("检查通过：完成本课", "Diagnostic passed: complete the lesson"), supportLevel: "none", knowledgeRefs: [], utteranceRefs: [], exerciseRefs: [], next: [] });
  return core;
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
      version: "0.4.0",
      languageId,
      title: l(`${targetName}零基础入门`, `${englishTargetName} Zero Beginner`),
      description: l("从文字或标音基础开始，学习问候、时间、位置、购物、交通、求助和服务场景中的 A1 核心表达。", "Start with the writing or romanization system and build A1 core expressions for greetings, time, places, shopping, transport, help, and service encounters."),
      author: { id: "learn-language", displayName: "LearnLanguage" },
      visibility: "private",
      status: "draft",
      source: { kind: "original" },
      languageAdapter: { id: adapterId, version: "1.0.0" },
    },
    goals: lessons.map((lesson) => ({
      id: lesson.goalRef,
      description: lesson.goalDescription,
      framework: { name: "CEFR Can-do", level: "A1" },
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

function japaneseA1CoreExtension(): CourseExtension {
  return {
    knowledge: [
      { id: "ja-hello", kind: "pragmatics", form: "こんにちは", reading: { kana: "こんにちは", hepburn: "konnichiwa" }, meaning: l("你好", "hello"), usage: l("白天见面时使用的基础问候语。", "A basic daytime greeting."), tags: ["a1-core", "jlpt-n5-relevant"] },
      { id: "ja-self-introduction", kind: "grammar", form: "わたしは〜です", reading: { kana: "わたしは〜です", hepburn: "watashi wa ... desu" }, meaning: l("我是……", "I am ..."), usage: l("用助词は引出自己的名字、国籍或身份。", "Uses は to introduce a name, nationality, or identity."), tags: ["a1-core", "jlpt-n5-relevant"] },
      { id: "ja-question-ka", kind: "grammar", form: "〜ですか", reading: { kana: "〜ですか", hepburn: "... desu ka" }, meaning: l("……吗？", "Is it ...?"), usage: l("在礼貌句末加か构成疑问句。", "Adds か to the end of a polite sentence to make a question."), tags: ["a1-core", "jlpt-n5-relevant"] },
      { id: "ja-numbers", kind: "lexeme", form: "一・二・三・四・五・六・七・八・九・十", reading: { kana: "いち・に・さん・よん・ご・ろく・なな・はち・きゅう・じゅう", hepburn: "ichi, ni, san, yon, go, roku, nana, hachi, kyū, jū" }, meaning: l("一到十", "one through ten"), usage: l("用于时间、价格、数量和编号。", "Used for time, prices, quantities, and numbers."), tags: ["a1-core", "jlpt-n5-relevant"] },
      { id: "ja-clock-time", kind: "grammar", form: "〜時です", reading: { kana: "〜じです", hepburn: "... ji desu" }, meaning: l("现在……点", "It is ... o'clock"), usage: l("数字后接時表示整点；四時和七時有固定读法。", "Adds 時 after a number for the hour; four and seven have fixed readings."), tags: ["a1-core", "jlpt-n5-relevant"] },
      { id: "ja-what-time", kind: "grammar", form: "何時ですか", reading: { kana: "なんじですか", hepburn: "nanji desu ka" }, meaning: l("几点？", "What time is it?"), usage: l("询问当前时间或活动时间。", "Asks the current time or the time of an event."), tags: ["a1-core", "jlpt-n5-relevant"] },
      { id: "ja-where", kind: "grammar", form: "〜はどこですか", reading: { kana: "〜はどこですか", hepburn: "... wa doko desu ka" }, meaning: l("……在哪里？", "Where is ...?"), usage: l("把要找的地点放在は前。", "Places the location being sought before は."), tags: ["a1-core", "jlpt-n5-relevant"] },
      { id: "ja-place-words", kind: "lexeme", form: "ここ・そこ・あそこ", reading: { kana: "ここ・そこ・あそこ", hepburn: "koko, soko, asoko" }, meaning: l("这里、那里、那边", "here, there, over there"), usage: l("按地点与说话双方的距离选择。", "Selected according to the place's distance from speaker and listener."), tags: ["a1-core", "jlpt-n5-relevant"] },
      { id: "ja-not-exist", kind: "grammar", form: "ここにはありません", reading: { kana: "ここにはありません", hepburn: "koko ni wa arimasen" }, meaning: l("这里没有", "It is not here"), usage: l("あります的礼貌否定形式是ありません。", "ありません is the polite negative of あります."), tags: ["a1-core", "jlpt-n5-relevant"] },
      { id: "ja-demonstratives", kind: "grammar", form: "これ・それ・あれ", reading: { kana: "これ・それ・あれ", hepburn: "kore, sore, are" }, meaning: l("这个、那个、那边那个", "this, that, that over there"), usage: l("用于指代离说话双方距离不同的物品。", "Refers to objects at different distances from speaker and listener."), tags: ["a1-core", "jlpt-n5-relevant"] },
      { id: "ja-how-much", kind: "grammar", form: "いくらですか", reading: { kana: "いくらですか", hepburn: "ikura desu ka" }, meaning: l("多少钱？", "How much is it?"), usage: l("在商店询问物品价格。", "Asks an item's price in a shop."), tags: ["a1-core", "jlpt-n5-relevant"] },
      { id: "ja-yen", kind: "lexeme", form: "〜円", reading: { kana: "〜えん", hepburn: "... en" }, meaning: l("……日元", "... yen"), usage: l("数字后接円表示日元价格。", "Adds 円 after a number to state a price in yen."), tags: ["a1-core", "jlpt-n5-relevant"] },
      { id: "ja-excuse-me", kind: "pragmatics", form: "すみません", reading: { kana: "すみません", hepburn: "sumimasen" }, meaning: l("不好意思／劳驾", "excuse me"), usage: l("在问路、求助或引起注意时使用。", "Used to get attention, ask directions, or request help."), tags: ["a1-core", "jlpt-n5-relevant"] },
      { id: "ja-go-question", kind: "grammar", form: "〜に行きますか", reading: { kana: "〜にいきますか", hepburn: "... ni ikimasu ka" }, meaning: l("去……吗？", "Does it go to ...?"), usage: l("用地点加に询问车辆或人是否前往该处。", "Uses a place plus に to ask whether a vehicle or person goes there."), tags: ["a1-core", "jlpt-n5-relevant"] },
      { id: "ja-station-bus", kind: "lexeme", form: "駅・バス", reading: { kana: "えき・バス", hepburn: "eki, basu" }, meaning: l("车站、公交车", "station, bus"), usage: l("交通和问路场景中的基础词。", "Basic words for transport and directions."), tags: ["a1-core", "jlpt-n5-relevant"] },
    ],
    utterances: [
      { id: "ja-introduce", text: "こんにちは。わたしはリンです。", translation: l("你好，我是林。", "Hello. I am Lin."), reading: { kana: "こんにちは。わたしはリンです。", hepburn: "konnichiwa. watashi wa Rin desu." }, knowledgeRefs: ["ja-hello", "ja-self-introduction"] },
      { id: "ja-ask-identity", text: "学生ですか？", translation: l("你是学生吗？", "Are you a student?"), reading: { kana: "がくせいですか？", hepburn: "gakusei desu ka?" }, knowledgeRefs: ["ja-question-ka"] },
      { id: "ja-time-three", text: "今、三時です。", translation: l("现在三点。", "It is three o'clock now."), reading: { kana: "いま、さんじです。", hepburn: "ima, sanji desu." }, knowledgeRefs: ["ja-numbers", "ja-clock-time"] },
      { id: "ja-ask-time", text: "何時ですか？", translation: l("几点？", "What time is it?"), reading: { kana: "なんじですか？", hepburn: "nanji desu ka?" }, knowledgeRefs: ["ja-what-time"] },
      { id: "ja-ask-restroom", text: "トイレはどこですか？", translation: l("洗手间在哪里？", "Where is the restroom?"), reading: { kana: "トイレはどこですか？", hepburn: "toire wa doko desu ka?" }, knowledgeRefs: ["ja-where"] },
      { id: "ja-place-negative", text: "ここにはありません。", translation: l("这里没有。", "It is not here."), reading: { kana: "ここにはありません。", hepburn: "koko ni wa arimasen." }, knowledgeRefs: ["ja-place-words", "ja-not-exist"] },
      { id: "ja-ask-price", text: "これはいくらですか？", translation: l("这个多少钱？", "How much is this?"), reading: { kana: "これはいくらですか？", hepburn: "kore wa ikura desu ka?" }, knowledgeRefs: ["ja-demonstratives", "ja-how-much"] },
      { id: "ja-price-five-hundred", text: "五百円です。", translation: l("五百日元。", "It is 500 yen."), reading: { kana: "ごひゃくえんです。", hepburn: "gohyaku en desu." }, knowledgeRefs: ["ja-yen"] },
      { id: "ja-ask-bus", text: "すみません。このバスは駅に行きますか？", translation: l("不好意思，这辆公交车去车站吗？", "Excuse me. Does this bus go to the station?"), reading: { kana: "すみません。このバスはえきにいきますか？", hepburn: "sumimasen. kono basu wa eki ni ikimasu ka?" }, knowledgeRefs: ["ja-excuse-me", "ja-go-question", "ja-station-bus"] },
      { id: "ja-bus-negative", text: "いいえ、行きません。", translation: l("不，不去。", "No, it does not."), reading: { kana: "いいえ、いきません。", hepburn: "iie, ikimasen." }, knowledgeRefs: ["ja-go-question"] },
    ],
    exercises: [
      { id: "ja-recognize-introduction", kind: "single-choice", prompt: l("哪一句表示“我是林”？", "Which sentence means 'I am Lin'?"), options: [target("わたしはリンです。"), target("リンですか？"), target("こんにちは。")], correctOptionIndex: 0, guidance: l("わたしは〜です用于自我介绍。", "わたしは〜です introduces yourself."), knowledgeRefs: ["ja-self-introduction"], utteranceRefs: ["ja-introduce"] },
      { id: "ja-build-question", kind: "ordering", prompt: l("把词块排成“你是学生吗？”。", "Order the chunks to ask 'Are you a student?'") , options: [target("です"), target("学生"), target("か？")], correctOrder: [1, 0, 2], guidance: l("礼貌陈述后加か。", "Add か after the polite statement."), knowledgeRefs: ["ja-question-ka"], utteranceRefs: ["ja-ask-identity"] },
      { id: "ja-type-hello", kind: "short-input", prompt: l("输入本课的日间问候语。", "Type the daytime greeting from this lesson."), acceptedAnswers: ["こんにちは", "こんにちは。"], guidance: l("答案是こんにちは。", "The answer is こんにちは."), knowledgeRefs: ["ja-hello"], utteranceRefs: ["ja-introduce"] },
      { id: "ja-recognize-three", kind: "single-choice", prompt: l("三時表示几点？", "What time is 三時?"), options: [l("两点", "Two o'clock"), l("三点", "Three o'clock"), l("十点", "Ten o'clock")], correctOptionIndex: 1, guidance: l("三读作さん。", "三 is read さん."), knowledgeRefs: ["ja-numbers", "ja-clock-time"], utteranceRefs: ["ja-time-three"] },
      { id: "ja-build-time-question", kind: "ordering", prompt: l("把词块排成“几点？”。", "Order the chunks to ask the time."), options: [target("か？"), target("何時"), target("です")], correctOrder: [1, 2, 0], guidance: l("何時＋です＋か。", "Use 何時 + です + か."), knowledgeRefs: ["ja-what-time"], utteranceRefs: ["ja-ask-time"] },
      { id: "ja-type-three-oclock", kind: "short-input", prompt: l("用日语输入“三点”。", "Type 'three o'clock' in Japanese."), acceptedAnswers: ["三時", "三時です", "三時です。"], guidance: l("三后接時。", "Add 時 after 三."), knowledgeRefs: ["ja-numbers", "ja-clock-time"], utteranceRefs: ["ja-time-three"] },
      { id: "ja-recognize-where", kind: "single-choice", prompt: l("哪个词表示“哪里”？", "Which word means 'where'?"), options: [target("ここ"), target("どこ"), target("それ")], correctOptionIndex: 1, guidance: l("どこ用于询问地点。", "どこ asks about a place."), knowledgeRefs: ["ja-where"], utteranceRefs: ["ja-ask-restroom"] },
      { id: "ja-build-restroom-question", kind: "ordering", prompt: l("把词块排成“洗手间在哪里？”。", "Order the chunks to ask where the restroom is."), options: [target("どこですか？"), target("トイレ"), target("は")], correctOrder: [1, 2, 0], guidance: l("地点＋は＋どこですか。", "Use place + は + どこですか."), knowledgeRefs: ["ja-where"], utteranceRefs: ["ja-ask-restroom"] },
      { id: "ja-type-not-here", kind: "short-input", prompt: l("输入“这里没有”。", "Type 'It is not here.'"), acceptedAnswers: ["ここにはありません", "ここにはありません。"], guidance: l("使用ありません表示礼貌否定。", "Use ありません for the polite negative."), knowledgeRefs: ["ja-place-words", "ja-not-exist"], utteranceRefs: ["ja-place-negative"] },
      { id: "ja-recognize-price-question", kind: "single-choice", prompt: l("哪一句是在问价格？", "Which sentence asks the price?"), options: [target("これはいくらですか？"), target("これはどこですか？"), target("これをください。")], correctOptionIndex: 0, guidance: l("いくら表示“多少钱”。", "いくら means 'how much'."), knowledgeRefs: ["ja-how-much"], utteranceRefs: ["ja-ask-price"] },
      { id: "ja-build-price", kind: "ordering", prompt: l("把词块排成“五百日元”。", "Order the chunks to state 500 yen."), options: [target("です。"), target("五百"), target("円")], correctOrder: [1, 2, 0], guidance: l("数字后接円。", "Put 円 after the number."), knowledgeRefs: ["ja-yen"], utteranceRefs: ["ja-price-five-hundred"] },
      { id: "ja-type-how-much", kind: "short-input", prompt: l("输入“多少钱？”。", "Type 'How much is it?'") , acceptedAnswers: ["いくらですか", "いくらですか？"], guidance: l("使用いくらですか。", "Use いくらですか."), knowledgeRefs: ["ja-how-much"], utteranceRefs: ["ja-ask-price"] },
      { id: "ja-recognize-station", kind: "single-choice", prompt: l("駅表示什么？", "What does 駅 mean?"), options: [l("车站", "Station"), l("商店", "Shop"), l("洗手间", "Restroom")], correctOptionIndex: 0, guidance: l("駅读作えき。", "駅 is read えき."), knowledgeRefs: ["ja-station-bus"], utteranceRefs: ["ja-ask-bus"] },
      { id: "ja-build-bus-question", kind: "ordering", prompt: l("把词块排成“这辆公交车去车站吗？”。", "Order the chunks to ask whether this bus goes to the station."), options: [target("駅に"), target("このバスは"), target("行きますか？")], correctOrder: [1, 0, 2], guidance: l("主题＋目的地に＋行きますか。", "Use topic + destination に + 行きますか."), knowledgeRefs: ["ja-go-question", "ja-station-bus"], utteranceRefs: ["ja-ask-bus"] },
      { id: "ja-type-excuse-me", kind: "short-input", prompt: l("输入问路前的“不好意思”。", "Type 'excuse me' before asking directions."), acceptedAnswers: ["すみません"], guidance: l("答案是すみません。", "The answer is すみません."), knowledgeRefs: ["ja-excuse-me"], utteranceRefs: ["ja-ask-bus"] },
    ],
    lessons: [
      { id: "greeting-and-identity", title: l("第五课：问候和自我介绍", "Lesson 5: Greetings and self-introduction"), goalRef: "introduce-in-japanese", goalDescription: l("能够问候、自我介绍并提出简单的是非问句。", "Can greet, introduce oneself, and ask a simple yes/no question."), knowledgeRefs: ["ja-hello", "ja-self-introduction", "ja-question-ka"], utteranceRefs: ["ja-introduce", "ja-ask-identity"], recognitionExerciseRef: "ja-recognize-introduction", guidedExerciseRef: "ja-build-question", taskExerciseRef: "ja-type-hello" },
      { id: "numbers-and-time", title: l("第六课：数字和整点时间", "Lesson 6: Numbers and clock time"), goalRef: "tell-time-in-japanese", goalDescription: l("能够读一到十并询问和回答整点时间。", "Can read one through ten and ask and answer the hour."), knowledgeRefs: ["ja-numbers", "ja-clock-time", "ja-what-time"], utteranceRefs: ["ja-time-three", "ja-ask-time"], recognitionExerciseRef: "ja-recognize-three", guidedExerciseRef: "ja-build-time-question", taskExerciseRef: "ja-type-three-oclock" },
      { id: "places-and-questions", title: l("第七课：询问地点和使用否定", "Lesson 7: Ask locations and use negation"), goalRef: "ask-location-in-japanese", goalDescription: l("能够询问地点、指出位置并理解基础否定。", "Can ask for a place, indicate location, and understand basic negation."), knowledgeRefs: ["ja-where", "ja-place-words", "ja-not-exist"], utteranceRefs: ["ja-ask-restroom", "ja-place-negative"], recognitionExerciseRef: "ja-recognize-where", guidedExerciseRef: "ja-build-restroom-question", taskExerciseRef: "ja-type-not-here" },
      { id: "shopping-and-prices", title: l("第八课：指物和询问价格", "Lesson 8: Point to items and ask prices"), goalRef: "ask-price-in-japanese", goalDescription: l("能够指代物品并询问和理解基础价格。", "Can point to an item and ask and understand a basic price."), knowledgeRefs: ["ja-demonstratives", "ja-how-much", "ja-yen"], utteranceRefs: ["ja-ask-price", "ja-price-five-hundred"], recognitionExerciseRef: "ja-recognize-price-question", guidedExerciseRef: "ja-build-price", taskExerciseRef: "ja-type-how-much" },
      { id: "transport-and-help", title: l("第九课：交通询问和礼貌求助", "Lesson 9: Transport questions and polite help"), goalRef: "ask-transport-in-japanese", goalDescription: l("能够礼貌引起注意并确认公交车是否前往目的地。", "Can politely get attention and confirm whether a bus goes to a destination."), knowledgeRefs: ["ja-excuse-me", "ja-go-question", "ja-station-bus"], utteranceRefs: ["ja-ask-bus", "ja-bus-negative"], recognitionExerciseRef: "ja-recognize-station", guidedExerciseRef: "ja-build-bus-question", taskExerciseRef: "ja-type-excuse-me" },
    ],
  };
}

function japaneseCourse(): CoursePack {
  const knowledge: KnowledgeItem[] = [
    { id: "ja-writing-systems", kind: "script", form: "ひらがな・カタカナ・漢字", reading: { kana: "ひらがな・カタカナ・かんじ", hepburn: "hiragana / katakana / kanji" }, meaning: l("平假名、片假名和汉字", "hiragana, katakana, and kanji"), usage: l("日语混合使用三种文字；本课程先建立假名阅读能力。", "Japanese mixes three scripts; this course first builds kana reading skills."), tags: ["foundation", "writing-system"] },
    { id: "ja-hiragana-vowels", kind: "script", form: "あ い う え お", reading: { kana: "あ・い・う・え・お", hepburn: "a / i / u / e / o" }, meaning: l("平假名的五个基础元音", "the five basic hiragana vowels"), usage: l("假名表以这五个元音为基础排列。", "The kana chart is organized around these five vowels."), tags: ["foundation", "hiragana"] },
    { id: "ja-hiragana-k-s", kind: "script", form: "かきくけこ・さしすせそ", reading: { kana: "かきくけこ・さしすせそ", hepburn: "ka ki ku ke ko / sa shi su se so" }, meaning: l("平假名か行和さ行", "the hiragana K and S rows"), usage: l("用于阅读かお、すし等基础词。", "Used to read basic words such as かお and すし."), tags: ["foundation", "hiragana"] },
    { id: "ja-hiragana-t-n", kind: "script", form: "たちつてと・なにぬねの", reading: { kana: "たちつてと・なにぬねの", hepburn: "ta chi tsu te to / na ni nu ne no" }, meaning: l("平假名た行和な行", "the hiragana T and N rows"), usage: l("注意ち读作 chi，つ读作 tsu。", "Notice that ち is chi and つ is tsu."), tags: ["foundation", "hiragana"] },
    { id: "ja-hiragana-h-m", kind: "script", form: "はひふへほ・まみむめも", reading: { kana: "はひふへほ・まみむめも", hepburn: "ha hi fu he ho / ma mi mu me mo" }, meaning: l("平假名は行和ま行", "the hiragana H and M rows"), usage: l("注意ふ通常转写为 fu。", "Notice that ふ is commonly romanized as fu."), tags: ["foundation", "hiragana"] },
    { id: "ja-hiragana-y-r-w-n", kind: "script", form: "やゆよ・らりるれろ・わを・ん", reading: { kana: "やゆよ・らりるれろ・わを・ん", hepburn: "ya yu yo / ra ri ru re ro / wa o / n" }, meaning: l("平假名や行、ら行、わ行和ん", "the hiragana Y, R, W rows and ん"), usage: l("现代日语中を常作为助词读作 o，ん表示独立的一拍。", "In modern Japanese を is usually the particle o, while ん takes its own mora."), tags: ["foundation", "hiragana"] },
    { id: "ja-voiced-kana", kind: "script", form: "が・ざ・だ・ば・ぱ行", reading: { kana: "が・ざ・だ・ば・ぱぎょう", hepburn: "ga / za / da / ba / pa rows" }, meaning: l("浊音和半浊音", "voiced and semi-voiced kana"), usage: l("在基础假名上添加浊点或半浊点形成新的读音。", "Dakuten or handakuten added to basic kana create new readings."), tags: ["foundation", "kana-pattern"] },
    { id: "ja-contracted-kana", kind: "script", form: "きゃ・しゅ・ちょ", reading: { kana: "きゃ・しゅ・ちょ", hepburn: "kya / shu / cho" }, meaning: l("拗音", "contracted sounds"), usage: l("い段假名后接小写ゃ、ゅ、ょ，合成一个音拍。", "An i-row kana plus small ゃ, ゅ, or ょ forms one contracted mora."), tags: ["foundation", "kana-pattern"] },
    { id: "ja-small-tsu", kind: "script", form: "っ", reading: { kana: "ちいさいつ", hepburn: "small tsu" }, meaning: l("促音／小写っ", "the small っ / doubled consonant"), usage: l("表示后一个辅音前的短暂停顿，例如がっこう。", "Marks a brief closure before the next consonant, as in がっこう."), tags: ["foundation", "kana-pattern"] },
    { id: "ja-long-vowel", kind: "script", form: "おう・こう／ー", reading: { kana: "ちょうおん", hepburn: "long vowel" }, meaning: l("长音", "long vowels"), usage: l("平假名常用额外元音表示，片假名常用长音符号ー。", "Hiragana often uses an extra vowel; katakana commonly uses ー."), tags: ["foundation", "kana-pattern"] },
    { id: "ja-katakana-core", kind: "script", form: "アイウエオ・カサタナハマヤラワ行", reading: { kana: "カタカナのきほん", hepburn: "basic katakana rows" }, meaning: l("片假名基础表", "the basic katakana chart"), usage: l("片假名主要用于外来语、外国人名和强调。", "Katakana is commonly used for loanwords, foreign names, and emphasis."), tags: ["foundation", "katakana"] },
    { id: "ja-hotel", kind: "lexeme", form: "ホテル", reading: { kana: "ホテル", hepburn: "hoteru" }, meaning: l("酒店", "hotel"), usage: l("使用片假名书写的常见外来语。", "A common loanword written in katakana."), tags: ["foundation", "katakana"] },
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
    { id: "ja-word-blue", text: "あお", translation: l("蓝色", "blue"), reading: { kana: "あお", hepburn: "ao" }, knowledgeRefs: ["ja-hiragana-vowels"] },
    { id: "ja-word-house", text: "いえ", translation: l("房子／家", "house / home"), reading: { kana: "いえ", hepburn: "ie" }, knowledgeRefs: ["ja-hiragana-vowels"] },
    { id: "ja-word-sushi", text: "すし", translation: l("寿司", "sushi"), reading: { kana: "すし", hepburn: "sushi" }, knowledgeRefs: ["ja-hiragana-k-s"] },
    { id: "ja-word-cat", text: "ねこ", translation: l("猫", "cat"), reading: { kana: "ねこ", hepburn: "neko" }, knowledgeRefs: ["ja-hiragana-k-s", "ja-hiragana-t-n"] },
    { id: "ja-word-school", text: "がっこう", translation: l("学校", "school"), reading: { kana: "がっこう", hepburn: "gakkō" }, knowledgeRefs: ["ja-voiced-kana", "ja-small-tsu", "ja-long-vowel"] },
    { id: "ja-word-today", text: "きょう", translation: l("今天", "today"), reading: { kana: "きょう", hepburn: "kyō" }, knowledgeRefs: ["ja-contracted-kana", "ja-long-vowel"] },
    { id: "ja-word-hotel", text: "ホテル", translation: l("酒店", "hotel"), reading: { kana: "ホテル", hepburn: "hoteru" }, knowledgeRefs: ["ja-katakana-core", "ja-hotel"] },
    { id: "ja-word-katakana-coffee", text: "コーヒー", translation: l("咖啡", "coffee"), reading: { kana: "コーヒー", hepburn: "kōhī" }, knowledgeRefs: ["ja-katakana-core", "ja-long-vowel", "ja-coffee"] },
    { id: "ja-order-coffee", text: "コーヒー、お願いします。", translation: l("请给我咖啡。", "Coffee, please."), reading: { kana: "コーヒー、おねがいします。", hepburn: "kōhī, onegai shimasu." }, knowledgeRefs: ["ja-coffee", "ja-request"] },
    { id: "ja-order-tea", text: "紅茶、お願いします。", translation: l("请给我红茶。", "Black tea, please."), reading: { kana: "こうちゃ、おねがいします。", hepburn: "kōcha, onegai shimasu." }, knowledgeRefs: ["ja-tea", "ja-request"] },
    { id: "ja-ask-temperature", text: "ホットですか？ アイスですか？", translation: l("要热的还是冰的？", "Hot or iced?"), reading: { kana: "ホットですか？ アイスですか？", hepburn: "hotto desu ka? aisu desu ka?" }, knowledgeRefs: ["ja-hot", "ja-iced"] },
    { id: "ja-order-two-iced", text: "アイスコーヒーを二つ、お願いします。", translation: l("请给我两杯冰咖啡。", "Two iced coffees, please."), reading: { kana: "アイスコーヒーをふたつ、おねがいします。", hepburn: "aisu kōhī o futatsu, onegai shimasu." }, knowledgeRefs: ["ja-iced", "ja-coffee", "ja-two", "ja-request"] },
    { id: "ja-ask-location", text: "店内ですか？ 持ち帰りですか？", translation: l("堂食还是外带？", "For here or takeaway?"), reading: { kana: "てんないですか？ もちかえりですか？", hepburn: "tennai desu ka? mochikaeri desu ka?" }, knowledgeRefs: ["ja-inside", "ja-takeaway"] },
    { id: "ja-choose-takeaway", text: "持ち帰りでお願いします。", translation: l("请帮我做成外带。", "Takeaway, please."), reading: { kana: "もちかえりでおねがいします。", hepburn: "mochikaeri de onegai shimasu." }, knowledgeRefs: ["ja-takeaway", "ja-choice"] },
  ];
  const exercises: Exercise[] = [
    { id: "ja-recognize-vowel", kind: "single-choice", prompt: l("哪个假名读作 a？", "Which kana is read as a?"), options: [target("あ"), target("い"), target("お")], correctOptionIndex: 0, guidance: l("五十音从あ、い、う、え、お开始。", "The vowel row starts あ, い, う, え, お."), knowledgeRefs: ["ja-hiragana-vowels"], utteranceRefs: [] },
    { id: "ja-build-house", kind: "ordering", prompt: l("把假名排成“家／房子”。", "Put the kana in order to make 'house'."), options: [target("え"), target("い")], correctOrder: [1, 0], guidance: l("“家”读作いえ。", "House is read いえ."), knowledgeRefs: ["ja-hiragana-vowels"], utteranceRefs: ["ja-word-house"] },
    { id: "ja-type-blue", kind: "short-input", prompt: l("输入表示“蓝色”的两个平假名。", "Type the two hiragana for 'blue'."), acceptedAnswers: ["あお"], guidance: l("依次使用あ和お。", "Use あ followed by お."), knowledgeRefs: ["ja-hiragana-vowels"], utteranceRefs: ["ja-word-blue"] },
    { id: "ja-recognize-cat", kind: "single-choice", prompt: l("哪个词表示“猫”？", "Which word means 'cat'?"), options: [target("すし"), target("ねこ"), target("いえ")], correctOptionIndex: 1, guidance: l("ね来自な行，こ来自か行。", "ね comes from the N row and こ from the K row."), knowledgeRefs: ["ja-hiragana-k-s", "ja-hiragana-t-n"], utteranceRefs: ["ja-word-cat"] },
    { id: "ja-build-sushi", kind: "ordering", prompt: l("把假名排成“寿司”。", "Put the kana in order to make 'sushi'."), options: [target("し"), target("す")], correctOrder: [1, 0], guidance: l("“寿司”读作すし。", "Sushi is read すし."), knowledgeRefs: ["ja-hiragana-k-s"], utteranceRefs: ["ja-word-sushi"] },
    { id: "ja-type-cat", kind: "short-input", prompt: l("输入表示“猫”的平假名。", "Type the hiragana for 'cat'."), acceptedAnswers: ["ねこ"], guidance: l("答案是ねこ。", "The answer is ねこ."), knowledgeRefs: ["ja-hiragana-k-s", "ja-hiragana-t-n"], utteranceRefs: ["ja-word-cat"] },
    { id: "ja-recognize-small-tsu", kind: "single-choice", prompt: l("がっこう中哪个符号表示促音？", "Which character marks the doubled consonant in がっこう?"), options: [target("が"), target("っ"), target("う")], correctOptionIndex: 1, guidance: l("小写っ表示后一个辅音前的短暂停顿。", "Small っ marks a brief closure before the next consonant."), knowledgeRefs: ["ja-small-tsu"], utteranceRefs: ["ja-word-school"] },
    { id: "ja-build-today", kind: "ordering", prompt: l("把词块排成“今天”。", "Put the chunks in order to make 'today'."), options: [target("う"), target("きょ")], correctOrder: [1, 0], guidance: l("“今天”写作きょう。", "Today is written きょう."), knowledgeRefs: ["ja-contracted-kana", "ja-long-vowel"], utteranceRefs: ["ja-word-today"] },
    { id: "ja-type-school", kind: "short-input", prompt: l("输入“学校”的平假名，注意促音和长音。", "Type 'school' in hiragana, including the small っ and long vowel."), acceptedAnswers: ["がっこう"], guidance: l("答案是がっこう。", "The answer is がっこう."), knowledgeRefs: ["ja-voiced-kana", "ja-small-tsu", "ja-long-vowel"], utteranceRefs: ["ja-word-school"] },
    { id: "ja-recognize-katakana", kind: "single-choice", prompt: l("哪个词使用片假名？", "Which word is written in katakana?"), options: [target("ねこ"), target("ホテル"), target("きょう")], correctOptionIndex: 1, guidance: l("片假名字形通常更有棱角，ホテル是外来语。", "Katakana tends to look angular; ホテル is a loanword."), knowledgeRefs: ["ja-katakana-core", "ja-hotel"], utteranceRefs: ["ja-word-hotel"] },
    { id: "ja-build-hotel", kind: "ordering", prompt: l("把片假名排成“酒店”。", "Put the katakana in order to make 'hotel'."), options: [target("ル"), target("ホ"), target("テ")], correctOrder: [1, 2, 0], guidance: l("“酒店”写作ホテル。", "Hotel is written ホテル."), knowledgeRefs: ["ja-katakana-core", "ja-hotel"], utteranceRefs: ["ja-word-hotel"] },
    { id: "ja-type-coffee-katakana", kind: "short-input", prompt: l("用片假名输入“咖啡”，不要漏掉长音符号。", "Type 'coffee' in katakana, including the long-vowel mark."), acceptedAnswers: ["コーヒー"], guidance: l("答案是コーヒー，两个长音都用ー表示。", "The answer is コーヒー; both long vowels use ー."), knowledgeRefs: ["ja-katakana-core", "ja-long-vowel", "ja-coffee"], utteranceRefs: ["ja-word-katakana-coffee"] },
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
  const a1Core = japaneseA1CoreExtension();
  knowledge.push(...a1Core.knowledge);
  utterances.push(...a1Core.utterances);
  exercises.push(...a1Core.exercises);
  const lessons: LessonPlan[] = [
    { id: "writing-and-vowels", title: l("第一课：认识日语文字和五个元音", "Lesson 1: Meet the scripts and five vowels"), goalRef: "read-ja-vowels", goalDescription: l("能够区分日语的三种文字，并认读あ、い、う、え、お。", "Can distinguish the three Japanese scripts and read あ, い, う, え, お."), knowledgeRefs: ["ja-writing-systems", "ja-hiragana-vowels"], utteranceRefs: ["ja-word-blue", "ja-word-house"], diagnosticExerciseRef: "ja-recognize-vowel", recognitionExerciseRef: "ja-recognize-vowel", guidedExerciseRef: "ja-build-house", taskExerciseRef: "ja-type-blue" },
    { id: "hiragana-core", title: l("第二课：读完整平假名基础表", "Lesson 2: Read the basic hiragana chart"), goalRef: "read-hiragana-core", goalDescription: l("能够认读平假名基础行，并组合出简单词语。", "Can recognize the basic hiragana rows and combine them into simple words."), knowledgeRefs: ["ja-hiragana-k-s", "ja-hiragana-t-n", "ja-hiragana-h-m", "ja-hiragana-y-r-w-n"], utteranceRefs: ["ja-word-sushi", "ja-word-cat"], diagnosticExerciseRef: "ja-recognize-cat", recognitionExerciseRef: "ja-recognize-cat", guidedExerciseRef: "ja-build-sushi", taskExerciseRef: "ja-type-cat" },
    { id: "kana-patterns", title: l("第三课：浊音、拗音、促音和长音", "Lesson 3: Voiced, contracted, doubled, and long sounds"), goalRef: "read-kana-patterns", goalDescription: l("能够识别常见假名变化，并正确读取含促音和长音的词。", "Can recognize common kana patterns and read words with doubled consonants and long vowels."), knowledgeRefs: ["ja-voiced-kana", "ja-contracted-kana", "ja-small-tsu", "ja-long-vowel"], utteranceRefs: ["ja-word-school", "ja-word-today"], diagnosticExerciseRef: "ja-recognize-small-tsu", recognitionExerciseRef: "ja-recognize-small-tsu", guidedExerciseRef: "ja-build-today", taskExerciseRef: "ja-type-school" },
    { id: "katakana-core", title: l("第四课：片假名和常见外来语", "Lesson 4: Katakana and common loanwords"), goalRef: "read-katakana-core", goalDescription: l("能够识别基础片假名，并读取常见外来语。", "Can recognize basic katakana and read common loanwords."), knowledgeRefs: ["ja-katakana-core", "ja-hotel", "ja-coffee", "ja-long-vowel"], utteranceRefs: ["ja-word-hotel", "ja-word-katakana-coffee"], diagnosticExerciseRef: "ja-recognize-katakana", recognitionExerciseRef: "ja-recognize-katakana", guidedExerciseRef: "ja-build-hotel", taskExerciseRef: "ja-type-coffee-katakana" },
    ...a1Core.lessons,
    { id: "basic-order", title: l("第十课：礼貌点一杯饮料", "Lesson 10: Order a drink politely"), goalRef: "order-drink", goalDescription: l("能够礼貌地点一杯饮料。", "Can politely order a drink."), knowledgeRefs: ["ja-coffee", "ja-tea", "ja-request"], utteranceRefs: ["ja-order-coffee", "ja-order-tea"], recognitionExerciseRef: "ja-recognize-drink", guidedExerciseRef: "ja-build-request", taskExerciseRef: "ja-role-basic" },
    { id: "drink-details", title: l("第十一课：说明冷热和数量", "Lesson 11: Specify temperature and quantity"), goalRef: "specify-drink", goalDescription: l("能够说明饮料的冷热、种类和数量。", "Can specify a drink's temperature, type, and quantity."), knowledgeRefs: ["ja-hot", "ja-iced", "ja-two", "ja-request"], utteranceRefs: ["ja-ask-temperature", "ja-order-two-iced"], recognitionExerciseRef: "ja-recognize-temperature", guidedExerciseRef: "ja-select-details", taskExerciseRef: "ja-role-details" },
    { id: "dine-or-takeaway", title: l("第十二课：选择堂食或外带", "Lesson 12: Choose dine-in or takeaway"), goalRef: "choose-location", goalDescription: l("能够回答堂食或外带问题并确认选择。", "Can answer a dine-in or takeaway question and confirm the choice."), knowledgeRefs: ["ja-inside", "ja-takeaway", "ja-choice"], utteranceRefs: ["ja-ask-location", "ja-choose-takeaway"], recognitionExerciseRef: "ja-recognize-location", guidedExerciseRef: "ja-build-takeaway", taskExerciseRef: "ja-role-transfer" },
  ];
  return baseCourse({ languageId: "ja", adapterId: "core.japanese", targetName: "日语", englishTargetName: "Japanese", knowledge, utterances, exercises, lessons });
}

function cantoneseA1CoreExtension(): CourseExtension {
  return {
    knowledge: [
      { id: "yue-numbers", kind: "lexeme", form: "一・二・三・四・五・六・七・八・九・十", reading: { jyutping: "jat1, ji6, saam1, sei3, ng5, luk6, cat1, baat3, gau2, sap6" }, meaning: l("一到十", "one through ten"), usage: l("用于时间、价格、数量和编号。", "Used for time, prices, quantities, and numbers."), tags: ["a1-core"] },
      { id: "yue-clock-time", kind: "grammar", form: "〜點", reading: { jyutping: "... dim2" }, meaning: l("……点", "... o'clock"), usage: l("数字后接點表示整点时间。", "Adds 點 after a number to state the hour."), tags: ["a1-core"] },
      { id: "yue-what-time", kind: "grammar", form: "幾點呀？", reading: { jyutping: "gei2 dim2 aa3" }, meaning: l("几点？", "What time is it?"), usage: l("询问当前时间或活动时间。", "Asks the current time or the time of an event."), tags: ["a1-core"] },
      { id: "yue-where", kind: "grammar", form: "〜喺邊度？", reading: { jyutping: "... hai2 bin1 dou6" }, meaning: l("……在哪里？", "Where is ...?"), usage: l("把要找的地点放在喺邊度前。", "Places the location being sought before 喺邊度."), tags: ["a1-core"] },
      { id: "yue-place-words", kind: "lexeme", form: "呢度・嗰度", reading: { jyutping: "ni1 dou6, go2 dou6" }, meaning: l("这里、那里", "here, there"), usage: l("按地点与说话者的距离选择。", "Selected according to the place's distance from the speaker."), tags: ["a1-core"] },
      { id: "yue-not-have", kind: "grammar", form: "冇／唔喺", reading: { jyutping: "mou5 / m4 hai2" }, meaning: l("没有／不在", "not have / not be at"), usage: l("冇否定“有”，唔喺否定地点状态。", "冇 negates possession or existence; 唔喺 negates location."), tags: ["a1-core"] },
      { id: "yue-demonstratives", kind: "grammar", form: "呢個・嗰個", reading: { jyutping: "ni1 go3, go2 go3" }, meaning: l("这个、那个", "this one, that one"), usage: l("用于指代近处或远处的单个物品。", "Refers to a nearby or farther single item."), tags: ["a1-core"] },
      { id: "yue-how-much", kind: "grammar", form: "幾多錢呀？", reading: { jyutping: "gei2 do1 cin2 aa3" }, meaning: l("多少钱？", "How much is it?"), usage: l("在商店或餐厅询问价格。", "Asks a price in a shop or restaurant."), tags: ["a1-core"] },
      { id: "yue-dollar", kind: "lexeme", form: "〜蚊", reading: { jyutping: "... man1" }, meaning: l("……元／块钱", "... dollars"), usage: l("口语中数字后接蚊表示港元价格。", "In speech, 蚊 follows a number to state a price in Hong Kong dollars."), tags: ["a1-core"] },
      { id: "yue-bus", kind: "lexeme", form: "巴士・車站", reading: { jyutping: "baa1 si2, ce1 zaam6" }, meaning: l("公交车、车站", "bus, station"), usage: l("交通和问路场景中的基础词。", "Basic words for transport and directions."), tags: ["a1-core"] },
      { id: "yue-go-question", kind: "grammar", form: "呢架巴士去唔去〜？", reading: { jyutping: "ni1 gaa3 baa1 si2 heoi3 m4 heoi3" }, meaning: l("这辆公交车去不去……？", "Does this bus go to ...?"), usage: l("用A唔A结构提出是非问句。", "Uses the A-not-A pattern for a yes/no question."), tags: ["a1-core"] },
      { id: "yue-how-to-go", kind: "grammar", form: "點去〜呀？", reading: { jyutping: "dim2 heoi3 ... aa3" }, meaning: l("怎么去……？", "How do I get to ...?"), usage: l("询问前往目的地的方法或路线。", "Asks how to reach a destination."), tags: ["a1-core"] },
      { id: "yue-help", kind: "pragmatics", form: "唔該，幫幫手。", reading: { jyutping: "m4 goi1, bong1 bong1 sau2" }, meaning: l("麻烦，请帮帮忙。", "Excuse me, please help."), usage: l("礼貌地引起注意并请求帮助。", "Politely gets attention and asks for help."), tags: ["a1-core"] },
      { id: "yue-not-understand", kind: "grammar", form: "我唔明", reading: { jyutping: "ngo5 m4 ming4" }, meaning: l("我不明白", "I don't understand"), usage: l("表示没有理解对方的话。", "States that you did not understand what was said."), tags: ["a1-core"] },
      { id: "yue-can-question", kind: "grammar", form: "可唔可以〜？", reading: { jyutping: "ho2 m4 ho2 ji5" }, meaning: l("可不可以……？", "Could you / May I ...?"), usage: l("礼貌询问许可或请求对方做某事。", "Politely asks permission or requests an action."), tags: ["a1-core"] },
    ],
    utterances: [
      { id: "yue-time-three", text: "而家三點。", translation: l("现在三点。", "It is three o'clock now."), reading: { jyutping: "ji4 gaa1 saam1 dim2." }, knowledgeRefs: ["yue-numbers", "yue-clock-time"] },
      { id: "yue-ask-time", text: "而家幾點呀？", translation: l("现在几点？", "What time is it now?"), reading: { jyutping: "ji4 gaa1 gei2 dim2 aa3?" }, knowledgeRefs: ["yue-what-time"] },
      { id: "yue-ask-restroom", text: "洗手間喺邊度呀？", translation: l("洗手间在哪里？", "Where is the restroom?"), reading: { jyutping: "sai2 sau2 gaan1 hai2 bin1 dou6 aa3?" }, knowledgeRefs: ["yue-where"] },
      { id: "yue-place-negative", text: "呢度冇。", translation: l("这里没有。", "There isn't one here."), reading: { jyutping: "ni1 dou6 mou5." }, knowledgeRefs: ["yue-place-words", "yue-not-have"] },
      { id: "yue-ask-price", text: "呢個幾多錢呀？", translation: l("这个多少钱？", "How much is this?"), reading: { jyutping: "ni1 go3 gei2 do1 cin2 aa3?" }, knowledgeRefs: ["yue-demonstratives", "yue-how-much"] },
      { id: "yue-price-fifty", text: "五十蚊。", translation: l("五十港元。", "Fifty dollars."), reading: { jyutping: "ng5 sap6 man1." }, knowledgeRefs: ["yue-numbers", "yue-dollar"] },
      { id: "yue-ask-airport-bus", text: "呢架巴士去唔去機場呀？", translation: l("这辆公交车去机场吗？", "Does this bus go to the airport?"), reading: { jyutping: "ni1 gaa3 baa1 si2 heoi3 m4 heoi3 gei1 coeng4 aa3?" }, knowledgeRefs: ["yue-bus", "yue-go-question"] },
      { id: "yue-ask-station-route", text: "車站點去呀？", translation: l("车站怎么走？", "How do I get to the station?"), reading: { jyutping: "ce1 zaam6 dim2 heoi3 aa3?" }, knowledgeRefs: ["yue-bus", "yue-how-to-go"] },
      { id: "yue-request-help", text: "唔該，幫幫手。", translation: l("麻烦，请帮帮忙。", "Excuse me, please help."), reading: { jyutping: "m4 goi1, bong1 bong1 sau2." }, knowledgeRefs: ["yue-help"] },
      { id: "yue-say-not-understand", text: "對唔住，我唔明。", translation: l("对不起，我不明白。", "Sorry, I don't understand."), reading: { jyutping: "deoi3 m4 zyu6, ngo5 m4 ming4." }, knowledgeRefs: ["yue-not-understand"] },
    ],
    exercises: [
      { id: "yue-recognize-three-oclock", kind: "single-choice", prompt: l("三點表示几点？", "What time is 三點?"), options: [l("两点", "Two o'clock"), l("三点", "Three o'clock"), l("十点", "Ten o'clock")], correctOptionIndex: 1, guidance: l("三读saam1。", "三 is saam1."), knowledgeRefs: ["yue-numbers", "yue-clock-time"], utteranceRefs: ["yue-time-three"] },
      { id: "yue-build-time-question", kind: "ordering", prompt: l("把词块排成“现在几点？”。", "Order the chunks to ask the current time."), options: [target("幾點呀？"), target("而家")], correctOrder: [1, 0], guidance: l("先说而家，再问幾點。", "Say 而家 before 幾點."), knowledgeRefs: ["yue-what-time"], utteranceRefs: ["yue-ask-time"] },
      { id: "yue-type-three-oclock", kind: "short-input", prompt: l("输入“三点”。", "Type 'three o'clock'."), acceptedAnswers: ["三點", "三點。"], guidance: l("三后接點。", "Add 點 after 三."), knowledgeRefs: ["yue-numbers", "yue-clock-time"], utteranceRefs: ["yue-time-three"] },
      { id: "yue-recognize-where", kind: "single-choice", prompt: l("哪个词组表示“在哪里”？", "Which phrase means 'where'?"), options: [target("喺邊度"), target("幾多錢"), target("幾點")], correctOptionIndex: 0, guidance: l("喺邊度询问地点。", "喺邊度 asks about a place."), knowledgeRefs: ["yue-where"], utteranceRefs: ["yue-ask-restroom"] },
      { id: "yue-build-restroom-question", kind: "ordering", prompt: l("把词块排成“洗手间在哪里？”。", "Order the chunks to ask where the restroom is."), options: [target("喺邊度呀？"), target("洗手間")], correctOrder: [1, 0], guidance: l("地点放在喺邊度前。", "Put the place before 喺邊度."), knowledgeRefs: ["yue-where"], utteranceRefs: ["yue-ask-restroom"] },
      { id: "yue-type-not-here", kind: "short-input", prompt: l("输入“这里没有”。", "Type 'There isn't one here.'"), acceptedAnswers: ["呢度冇", "呢度冇。"], guidance: l("使用呢度加冇。", "Use 呢度 plus 冇."), knowledgeRefs: ["yue-place-words", "yue-not-have"], utteranceRefs: ["yue-place-negative"] },
      { id: "yue-recognize-price-question", kind: "single-choice", prompt: l("哪一句是在问价格？", "Which sentence asks the price?"), options: [target("呢個幾多錢呀？"), target("呢個喺邊度呀？"), target("而家幾點呀？")], correctOptionIndex: 0, guidance: l("幾多錢表示“多少钱”。", "幾多錢 means 'how much'."), knowledgeRefs: ["yue-how-much"], utteranceRefs: ["yue-ask-price"] },
      { id: "yue-build-price", kind: "ordering", prompt: l("把词块排成“五十港元”。", "Order the chunks to state fifty dollars."), options: [target("蚊。"), target("五十")], correctOrder: [1, 0], guidance: l("数字后接蚊。", "Put 蚊 after the number."), knowledgeRefs: ["yue-dollar"], utteranceRefs: ["yue-price-fifty"] },
      { id: "yue-type-how-much", kind: "short-input", prompt: l("输入“多少钱？”。", "Type 'How much is it?'") , acceptedAnswers: ["幾多錢", "幾多錢呀", "幾多錢呀？"], guidance: l("使用幾多錢呀。", "Use 幾多錢呀."), knowledgeRefs: ["yue-how-much"], utteranceRefs: ["yue-ask-price"] },
      { id: "yue-recognize-station", kind: "single-choice", prompt: l("車站表示什么？", "What does 車站 mean?"), options: [l("车站", "Station"), l("机场", "Airport"), l("商店", "Shop")], correctOptionIndex: 0, guidance: l("車站读ce1 zaam6。", "車站 is ce1 zaam6."), knowledgeRefs: ["yue-bus"], utteranceRefs: ["yue-ask-station-route"] },
      { id: "yue-build-bus-question", kind: "ordering", prompt: l("把词块排成“这辆公交车去机场吗？”。", "Order the chunks to ask whether this bus goes to the airport."), options: [target("機場呀？"), target("呢架巴士"), target("去唔去")], correctOrder: [1, 2, 0], guidance: l("交通工具＋去唔去＋目的地。", "Use vehicle + 去唔去 + destination."), knowledgeRefs: ["yue-go-question", "yue-bus"], utteranceRefs: ["yue-ask-airport-bus"] },
      { id: "yue-type-how-to-go", kind: "short-input", prompt: l("输入“怎么去？”。", "Type 'How do I get there?'") , acceptedAnswers: ["點去", "點去呀", "點去呀？"], guidance: l("使用點去呀。", "Use 點去呀."), knowledgeRefs: ["yue-how-to-go"], utteranceRefs: ["yue-ask-station-route"] },
      { id: "yue-recognize-help", kind: "single-choice", prompt: l("哪一句是在请求帮助？", "Which sentence asks for help?"), options: [target("唔該，幫幫手。"), target("五十蚊。"), target("而家三點。")], correctOptionIndex: 0, guidance: l("幫幫手表示请帮忙。", "幫幫手 asks someone to help."), knowledgeRefs: ["yue-help"], utteranceRefs: ["yue-request-help"] },
      { id: "yue-build-not-understand", kind: "ordering", prompt: l("把词块排成“我不明白”。", "Order the chunks to say 'I don't understand.'"), options: [target("明。"), target("我"), target("唔")], correctOrder: [1, 2, 0], guidance: l("唔放在明前构成否定。", "Put 唔 before 明 for negation."), knowledgeRefs: ["yue-not-understand"], utteranceRefs: ["yue-say-not-understand"] },
      { id: "yue-type-help", kind: "short-input", prompt: l("输入“请帮帮忙”。", "Type 'Please help.'"), acceptedAnswers: ["幫幫手", "幫幫手。", "唔該，幫幫手。"], guidance: l("使用幫幫手；前面可加唔該。", "Use 幫幫手, optionally after 唔該."), knowledgeRefs: ["yue-help", "yue-can-question"], utteranceRefs: ["yue-request-help"] },
    ],
    lessons: [
      { id: "numbers-and-time", title: l("第五课：数字和整点时间", "Lesson 5: Numbers and clock time"), goalRef: "tell-time-in-cantonese", goalDescription: l("能够读一到十并询问和回答整点时间。", "Can read one through ten and ask and answer the hour."), knowledgeRefs: ["yue-numbers", "yue-clock-time", "yue-what-time"], utteranceRefs: ["yue-time-three", "yue-ask-time"], recognitionExerciseRef: "yue-recognize-three-oclock", guidedExerciseRef: "yue-build-time-question", taskExerciseRef: "yue-type-three-oclock" },
      { id: "places-and-questions", title: l("第六课：询问地点和使用否定", "Lesson 6: Ask locations and use negation"), goalRef: "ask-location-in-cantonese", goalDescription: l("能够询问地点、指出位置并使用基础否定。", "Can ask for a place, indicate location, and use basic negation."), knowledgeRefs: ["yue-where", "yue-place-words", "yue-not-have"], utteranceRefs: ["yue-ask-restroom", "yue-place-negative"], recognitionExerciseRef: "yue-recognize-where", guidedExerciseRef: "yue-build-restroom-question", taskExerciseRef: "yue-type-not-here" },
      { id: "shopping-and-prices", title: l("第七课：指物和询问价格", "Lesson 7: Point to items and ask prices"), goalRef: "ask-price-in-cantonese", goalDescription: l("能够指代物品并询问和理解基础价格。", "Can point to an item and ask and understand a basic price."), knowledgeRefs: ["yue-demonstratives", "yue-how-much", "yue-dollar"], utteranceRefs: ["yue-ask-price", "yue-price-fifty"], recognitionExerciseRef: "yue-recognize-price-question", guidedExerciseRef: "yue-build-price", taskExerciseRef: "yue-type-how-much" },
      { id: "transport-and-directions", title: l("第八课：交通和问路", "Lesson 8: Transport and directions"), goalRef: "ask-transport-in-cantonese", goalDescription: l("能够确认公交车目的地并询问基础路线。", "Can confirm a bus destination and ask for basic directions."), knowledgeRefs: ["yue-bus", "yue-go-question", "yue-how-to-go"], utteranceRefs: ["yue-ask-airport-bus", "yue-ask-station-route"], recognitionExerciseRef: "yue-recognize-station", guidedExerciseRef: "yue-build-bus-question", taskExerciseRef: "yue-type-how-to-go" },
      { id: "help-and-negation", title: l("第九课：礼貌求助和说明不理解", "Lesson 9: Ask for help and say you do not understand"), goalRef: "request-help-in-cantonese", goalDescription: l("能够礼貌求助、说明没有理解并使用可唔可以结构。", "Can ask for help, say that one did not understand, and use 可唔可以."), knowledgeRefs: ["yue-help", "yue-not-understand", "yue-can-question"], utteranceRefs: ["yue-request-help", "yue-say-not-understand"], recognitionExerciseRef: "yue-recognize-help", guidedExerciseRef: "yue-build-not-understand", taskExerciseRef: "yue-type-help" },
    ],
  };
}

function cantoneseCourse(): CoursePack {
  const knowledge: KnowledgeItem[] = [
    { id: "yue-writing-jyutping", kind: "script", form: "粵語漢字＋粵拼", reading: { jyutping: "jyut6 jyu5 hon3 zi6 + jyut6 ping3" }, meaning: l("粤语汉字和粤拼标音", "Cantonese characters and Jyutping"), usage: l("课程同时显示汉字和粤拼；数字1至6标记声调。", "The course shows characters with Jyutping; numbers 1 to 6 mark tones."), tags: ["foundation", "writing-system"] },
    { id: "yue-syllable-structure", kind: "script", form: "gaa3 = g + aa + 3", reading: { jyutping: "gaa3" }, meaning: l("粤拼音节由声母、韵母和声调数字组成", "a Jyutping syllable has an initial, final, and tone number"), usage: l("例如咖的gaa3可拆成声母g、韵母aa和声调3。", "For example, gaa3 splits into initial g, final aa, and tone 3."), tags: ["foundation", "jyutping"] },
    { id: "yue-initials", kind: "script", form: "b p m f・d t n l・g k ng h・gw kw w・z c s j", reading: { jyutping: "Jyutping initials" }, meaning: l("粤拼声母", "Jyutping initials"), usage: l("声母位于音节开头；b/p、d/t、g/k等组合主要区别在送气。", "Initials begin a syllable; pairs such as b/p, d/t, and g/k mainly contrast aspiration."), tags: ["foundation", "jyutping"] },
    { id: "yue-common-finals", kind: "script", form: "aa a e i o u oe eo yu・-m -n -ng", reading: { jyutping: "Jyutping finals" }, meaning: l("常见粤拼韵母及鼻音韵尾", "common Jyutping finals and nasal endings"), usage: l("韵母构成音节主体，部分韵母以m、n或ng结尾。", "The final forms the core of a syllable; some end in m, n, or ng."), tags: ["foundation", "jyutping"] },
    { id: "yue-checked-finals", kind: "script", form: "-p・-t・-k", reading: { jyutping: "p / t / k checked finals" }, meaning: l("入声韵尾", "checked-syllable endings"), usage: l("p、t、k位于音节末尾时短促收住，例如十sap6、八baat3、六luk6。", "Final p, t, and k end abruptly, as in sap6, baat3, and luk6."), tags: ["foundation", "jyutping"] },
    { id: "yue-tones-1-2", kind: "script", form: "1 高平・2 高升", reading: { jyutping: "si1 / si2" }, meaning: l("粤拼第一调和第二调", "Jyutping tones 1 and 2"), usage: l("调号写在每个音节末尾；诗si1和史si2的调号不同。", "The tone number follows each syllable; si1 and si2 differ by tone."), tags: ["foundation", "tone"] },
    { id: "yue-tones-3-4", kind: "script", form: "3 中平・4 低降", reading: { jyutping: "si3 / si4" }, meaning: l("粤拼第三调和第四调", "Jyutping tones 3 and 4"), usage: l("试si3和时si4展示两个不同的声调类别。", "si3 and si4 illustrate two different tone categories."), tags: ["foundation", "tone"] },
    { id: "yue-tones-5-6", kind: "script", form: "5 低升・6 低平", reading: { jyutping: "si5 / si6" }, meaning: l("粤拼第五调和第六调", "Jyutping tones 5 and 6"), usage: l("市si5和事si6依靠调号区分。", "si5 and si6 are distinguished by their tone numbers."), tags: ["foundation", "tone"] },
    { id: "yue-hello", kind: "pragmatics", form: "你好", reading: { jyutping: "nei5 hou2" }, meaning: l("你好", "hello"), usage: l("常见问候语；不同场合也会使用更贴近情境的招呼。", "A common greeting; more situation-specific greetings are also used."), tags: ["foundation", "greeting"] },
    { id: "yue-name-pattern", kind: "grammar", form: "我叫〜／你叫咩名呀？", reading: { jyutping: "ngo5 giu3 / nei5 giu3 me1 meng2 aa3" }, meaning: l("我叫……／你叫什么名字？", "My name is ... / What is your name?"), usage: l("用于自我介绍和询问名字。", "Used to introduce yourself and ask someone's name."), tags: ["foundation", "grammar"] },
    { id: "yue-copula", kind: "grammar", form: "係／唔係", reading: { jyutping: "hai6 / m4 hai6" }, meaning: l("是／不是", "to be / not to be"), usage: l("连接身份或类别；唔放在係前构成否定。", "Links an identity or category; 唔 before 係 makes it negative."), tags: ["foundation", "grammar"] },
    { id: "yue-student", kind: "lexeme", form: "學生", reading: { jyutping: "hok6 saang1" }, meaning: l("学生", "student"), usage: l("可放在我係后说明身份。", "Can follow 我係 to state an identity."), tags: ["foundation", "identity"] },
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
    { id: "yue-char-coffee-first", text: "咖", translation: l("“咖啡”的第一个字", "the first character in 'coffee'"), reading: { jyutping: "gaa3" }, knowledgeRefs: ["yue-writing-jyutping", "yue-syllable-structure"] },
    { id: "yue-char-me", text: "我", translation: l("我", "I / me"), reading: { jyutping: "ngo5" }, knowledgeRefs: ["yue-writing-jyutping", "yue-syllable-structure"] },
    { id: "yue-checked-examples", text: "十、八、六", translation: l("十、八、六", "ten, eight, six"), reading: { jyutping: "sap6, baat3, luk6" }, knowledgeRefs: ["yue-checked-finals"] },
    { id: "yue-nasal-examples", text: "三、五、零", translation: l("三、五、零", "three, five, zero"), reading: { jyutping: "saam1, ng5, ling4" }, knowledgeRefs: ["yue-common-finals"] },
    { id: "yue-tone-series", text: "詩、史、試、時、市、事", translation: l("六个以si开头、声调不同的示例字", "six si syllables distinguished by tone"), reading: { jyutping: "si1, si2, si3, si4, si5, si6" }, knowledgeRefs: ["yue-tones-1-2", "yue-tones-3-4", "yue-tones-5-6"] },
    { id: "yue-tone-coffee", text: "咖啡", translation: l("咖啡", "coffee"), reading: { jyutping: "gaa3 fe1" }, knowledgeRefs: ["yue-syllable-structure", "yue-tones-1-2", "yue-tones-3-4"] },
    { id: "yue-say-hello", text: "你好。", translation: l("你好。", "Hello."), reading: { jyutping: "nei5 hou2." }, knowledgeRefs: ["yue-hello"] },
    { id: "yue-introduce-student", text: "我係學生。", translation: l("我是学生。", "I am a student."), reading: { jyutping: "ngo5 hai6 hok6 saang1." }, knowledgeRefs: ["yue-copula", "yue-student"] },
    { id: "yue-ask-name", text: "你叫咩名呀？", translation: l("你叫什么名字？", "What is your name?"), reading: { jyutping: "nei5 giu3 me1 meng2 aa3?" }, knowledgeRefs: ["yue-name-pattern"] },
    { id: "yue-order-coffee", text: "唔該，我想要一杯咖啡。", translation: l("麻烦，我想要一杯咖啡。", "Excuse me, I would like a coffee."), reading: { jyutping: "m4 goi1, ngo5 soeng2 jiu3 jat1 bui1 gaa3 fe1." }, knowledgeRefs: ["yue-coffee", "yue-request"] },
    { id: "yue-order-tea", text: "一杯奶茶，唔該。", translation: l("请给我一杯奶茶。", "A milk tea, please."), reading: { jyutping: "jat1 bui1 naai5 caa4, m4 goi1." }, knowledgeRefs: ["yue-tea", "yue-request"] },
    { id: "yue-ask-temperature", text: "凍定熱呀？", translation: l("要冰的还是热的？", "Iced or hot?"), reading: { jyutping: "dung3 ding6 jit6 aa3?" }, knowledgeRefs: ["yue-iced", "yue-hot", "yue-or"] },
    { id: "yue-order-two-iced", text: "兩杯凍奶茶，唔該。", translation: l("请给我两杯冰奶茶。", "Two iced milk teas, please."), reading: { jyutping: "loeng5 bui1 dung3 naai5 caa4, m4 goi1." }, knowledgeRefs: ["yue-two-cups", "yue-iced", "yue-tea", "yue-request"] },
    { id: "yue-ask-location", text: "喺度食定拎走？", translation: l("堂食还是外带？", "Eat here or take away?"), reading: { jyutping: "hai2 dou6 sik6 ding6 ling1 zau2?" }, knowledgeRefs: ["yue-here", "yue-takeaway", "yue-or"] },
    { id: "yue-choose-takeaway", text: "拎走，唔該。", translation: l("外带，谢谢。", "Takeaway, please."), reading: { jyutping: "ling1 zau2, m4 goi1." }, knowledgeRefs: ["yue-takeaway", "yue-request"] },
  ];
  const exercises: Exercise[] = [
    { id: "yue-recognize-tone-number", kind: "single-choice", prompt: l("gaa3中的声调数字是哪一个？", "Which part of gaa3 is the tone number?"), options: [target("g"), target("aa"), target("3")], correctOptionIndex: 2, guidance: l("粤拼把1至6写在音节末尾表示声调。", "Jyutping writes a number from 1 to 6 at the end for tone."), knowledgeRefs: ["yue-writing-jyutping", "yue-syllable-structure"], utteranceRefs: ["yue-char-coffee-first"] },
    { id: "yue-build-gaa3", kind: "ordering", prompt: l("按声母、韵母、声调排成“咖”的粤拼。", "Order the initial, final, and tone to spell 咖 in Jyutping."), options: [target("3"), target("aa"), target("g")], correctOrder: [2, 1, 0], guidance: l("声母g＋韵母aa＋第三调。", "Initial g + final aa + tone 3."), knowledgeRefs: ["yue-syllable-structure"], utteranceRefs: ["yue-char-coffee-first"] },
    { id: "yue-type-ngo5", kind: "short-input", prompt: l("输入“我”的粤拼，包括声调数字。", "Type the Jyutping for 我, including the tone number."), acceptedAnswers: ["ngo5"], guidance: l("答案是ngo5。", "The answer is ngo5."), knowledgeRefs: ["yue-syllable-structure", "yue-initials", "yue-common-finals"], utteranceRefs: ["yue-char-me"] },
    { id: "yue-recognize-checked-final", kind: "single-choice", prompt: l("luk6以哪个入声韵尾结束？", "Which checked final ends luk6?"), options: [target("p"), target("t"), target("k")], correctOptionIndex: 2, guidance: l("六读luk6，以k收尾。", "六 is luk6 and ends in k."), knowledgeRefs: ["yue-checked-finals"], utteranceRefs: ["yue-checked-examples"] },
    { id: "yue-build-sap6", kind: "ordering", prompt: l("把字母和数字排成“十”的粤拼。", "Put the letters and number in order to spell 十."), options: [target("6"), target("ap"), target("s")], correctOrder: [2, 1, 0], guidance: l("十读sap6，以p收尾。", "十 is sap6 and ends in p."), knowledgeRefs: ["yue-initials", "yue-common-finals", "yue-checked-finals"], utteranceRefs: ["yue-checked-examples"] },
    { id: "yue-type-baat3", kind: "short-input", prompt: l("输入“八”的粤拼，包括入声韵尾和声调数字。", "Type the Jyutping for 八, including its checked final and tone number."), acceptedAnswers: ["baat3"], guidance: l("答案是baat3。", "The answer is baat3."), knowledgeRefs: ["yue-initials", "yue-common-finals", "yue-checked-finals"], utteranceRefs: ["yue-checked-examples"] },
    { id: "yue-recognize-tone-five", kind: "single-choice", prompt: l("“市”在本课示例中写成哪个粤拼？", "Which Jyutping spelling represents 市 in this lesson?"), options: [target("si2"), target("si5"), target("si6")], correctOptionIndex: 1, guidance: l("六调示例依次是si1至si6，市对应si5。", "The six examples run from si1 to si6; 市 is si5."), knowledgeRefs: ["yue-tones-5-6"], utteranceRefs: ["yue-tone-series"] },
    { id: "yue-select-coffee-tones", kind: "multiple-choice", prompt: l("咖啡gaa3 fe1使用了哪些声调数字？", "Which tone numbers appear in gaa3 fe1?"), options: [target("1"), target("2"), target("3"), target("5")], correctOptionIndices: [0, 2], guidance: l("gaa3以3结尾，fe1以1结尾。", "gaa3 ends in 3 and fe1 ends in 1."), knowledgeRefs: ["yue-tones-1-2", "yue-tones-3-4"], utteranceRefs: ["yue-tone-coffee"] },
    { id: "yue-type-si6", kind: "short-input", prompt: l("输入“事”的粤拼；它是六调示例的最后一个。", "Type the Jyutping for 事, the last item in the six-tone series."), acceptedAnswers: ["si6"], guidance: l("答案是si6。", "The answer is si6."), knowledgeRefs: ["yue-tones-5-6"], utteranceRefs: ["yue-tone-series"] },
    { id: "yue-recognize-name-question", kind: "single-choice", prompt: l("哪一句是在询问名字？", "Which sentence asks for someone's name?"), options: [target("你好。"), target("你叫咩名呀？"), target("我係學生。")], correctOptionIndex: 1, guidance: l("咩名表示“什么名字”。", "咩名 means 'what name'."), knowledgeRefs: ["yue-name-pattern"], utteranceRefs: ["yue-ask-name"] },
    { id: "yue-build-student", kind: "ordering", prompt: l("把词块排成“我是学生”。", "Put the chunks in order to say 'I am a student'."), options: [target("學生。"), target("我"), target("係")], correctOrder: [1, 2, 0], guidance: l("顺序是我＋係＋學生。", "The order is 我 + 係 + 學生."), knowledgeRefs: ["yue-copula", "yue-student"], utteranceRefs: ["yue-introduce-student"] },
    { id: "yue-type-hello", kind: "short-input", prompt: l("输入本课的基础问候语。", "Type the basic greeting from this lesson."), acceptedAnswers: ["你好", "你好。"], guidance: l("答案是你好。", "The answer is 你好."), knowledgeRefs: ["yue-hello"], utteranceRefs: ["yue-say-hello"] },
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
  const a1Core = cantoneseA1CoreExtension();
  knowledge.push(...a1Core.knowledge);
  utterances.push(...a1Core.utterances);
  exercises.push(...a1Core.exercises);
  const lessons: LessonPlan[] = [
    { id: "jyutping-structure", title: l("第一课：认识汉字和粤拼结构", "Lesson 1: Meet characters and Jyutping structure"), goalRef: "read-jyutping-structure", goalDescription: l("能够识别粤拼的声母、韵母和声调数字。", "Can identify the initial, final, and tone number in Jyutping."), knowledgeRefs: ["yue-writing-jyutping", "yue-syllable-structure", "yue-initials"], utteranceRefs: ["yue-char-coffee-first", "yue-char-me"], diagnosticExerciseRef: "yue-recognize-tone-number", recognitionExerciseRef: "yue-recognize-tone-number", guidedExerciseRef: "yue-build-gaa3", taskExerciseRef: "yue-type-ngo5" },
    { id: "jyutping-finals", title: l("第二课：常见韵母和入声韵尾", "Lesson 2: Common finals and checked endings"), goalRef: "read-jyutping-finals", goalDescription: l("能够识别常见粤拼韵母以及p、t、k入声韵尾。", "Can recognize common Jyutping finals and checked p, t, and k endings."), knowledgeRefs: ["yue-initials", "yue-common-finals", "yue-checked-finals"], utteranceRefs: ["yue-checked-examples", "yue-nasal-examples"], diagnosticExerciseRef: "yue-recognize-checked-final", recognitionExerciseRef: "yue-recognize-checked-final", guidedExerciseRef: "yue-build-sap6", taskExerciseRef: "yue-type-baat3" },
    { id: "jyutping-tones", title: l("第三课：读懂粤拼六个调号", "Lesson 3: Read the six Jyutping tone numbers"), goalRef: "read-jyutping-tones", goalDescription: l("能够根据1至6的调号区分书面粤拼音节。", "Can distinguish written Jyutping syllables using tone numbers 1 through 6."), knowledgeRefs: ["yue-tones-1-2", "yue-tones-3-4", "yue-tones-5-6"], utteranceRefs: ["yue-tone-series", "yue-tone-coffee"], diagnosticExerciseRef: "yue-recognize-tone-five", recognitionExerciseRef: "yue-recognize-tone-five", guidedExerciseRef: "yue-select-coffee-tones", taskExerciseRef: "yue-type-si6" },
    { id: "greeting-and-identity", title: l("第四课：问候、名字和身份", "Lesson 4: Greetings, names, and identity"), goalRef: "introduce-in-cantonese", goalDescription: l("能够问候、询问名字并用係或唔係说明身份。", "Can greet, ask a name, and use 係 or 唔係 to state identity."), knowledgeRefs: ["yue-hello", "yue-name-pattern", "yue-copula", "yue-student"], utteranceRefs: ["yue-say-hello", "yue-introduce-student", "yue-ask-name"], diagnosticExerciseRef: "yue-recognize-name-question", recognitionExerciseRef: "yue-recognize-name-question", guidedExerciseRef: "yue-build-student", taskExerciseRef: "yue-type-hello" },
    ...a1Core.lessons,
    { id: "basic-order", title: l("第十课：礼貌点一杯饮料", "Lesson 10: Order a drink politely"), goalRef: "order-drink", goalDescription: l("能够礼貌地点一杯饮料。", "Can politely order a drink."), knowledgeRefs: ["yue-coffee", "yue-tea", "yue-request"], utteranceRefs: ["yue-order-coffee", "yue-order-tea"], recognitionExerciseRef: "yue-recognize-drink", guidedExerciseRef: "yue-build-request", taskExerciseRef: "yue-role-basic" },
    { id: "drink-details", title: l("第十一课：说明冷热和数量", "Lesson 11: Specify temperature and quantity"), goalRef: "specify-drink", goalDescription: l("能够说明饮料的冷热、种类和数量。", "Can specify a drink's temperature, type, and quantity."), knowledgeRefs: ["yue-hot", "yue-iced", "yue-two-cups", "yue-or"], utteranceRefs: ["yue-ask-temperature", "yue-order-two-iced"], recognitionExerciseRef: "yue-recognize-temperature", guidedExerciseRef: "yue-select-details", taskExerciseRef: "yue-role-details" },
    { id: "dine-or-takeaway", title: l("第十二课：选择堂食或外带", "Lesson 12: Choose dine-in or takeaway"), goalRef: "choose-location", goalDescription: l("能够回答堂食或外带问题并确认选择。", "Can answer a dine-in or takeaway question and confirm the choice."), knowledgeRefs: ["yue-here", "yue-takeaway", "yue-or"], utteranceRefs: ["yue-ask-location", "yue-choose-takeaway"], recognitionExerciseRef: "yue-recognize-location", guidedExerciseRef: "yue-build-takeaway", taskExerciseRef: "yue-role-transfer" },
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
