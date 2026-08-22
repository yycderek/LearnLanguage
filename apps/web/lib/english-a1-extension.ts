import type { Exercise, KnowledgeItem, LocalizedText, Utterance } from "@learn-language/protocol";

const l = (zh: string, en: string): LocalizedText => ({ "zh-CN": zh, en });
const target = (value: string): LocalizedText => ({ "zh-CN": value, en: value, native: value });
const reading = (value: string) => ({ latin: value });

export type EnglishExtensionPlan = {
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
  capstone?: { title: LocalizedText; exerciseRef: string; knowledgeRefs: string[]; utteranceRefs: string[] };
};

function k(id: string, kind: KnowledgeItem["kind"], form: string, zh: string, en: string, usageZh: string, usageEn: string, tags: string[]): KnowledgeItem {
  return { id, kind, form, reading: reading(form), meaning: l(zh, en), usage: l(usageZh, usageEn), tags };
}

function u(id: string, text: string, zh: string, refs: string[]): Utterance {
  return { id, text, translation: l(zh, text), reading: reading(text), knowledgeRefs: refs };
}

function single(id: string, zh: string, en: string, options: LocalizedText[], answer: number, guidanceZh: string, guidanceEn: string, knowledgeRefs: string[], utteranceRefs: string[]): Exercise {
  return { id, kind: "single-choice", prompt: l(zh, en), options, correctOptionIndex: answer, guidance: l(guidanceZh, guidanceEn), knowledgeRefs, utteranceRefs };
}

function ordering(id: string, zh: string, en: string, parts: string[], order: number[], guidanceZh: string, guidanceEn: string, knowledgeRefs: string[], utteranceRefs: string[]): Exercise {
  return { id, kind: "ordering", prompt: l(zh, en), options: parts.map(target), correctOrder: order, guidance: l(guidanceZh, guidanceEn), knowledgeRefs, utteranceRefs };
}

function role(id: string, zh: string, en: string, guidanceZh: string, guidanceEn: string, knowledgeRefs: string[], utteranceRefs: string[] = []): Exercise {
  return { id, kind: "role-play", prompt: l(zh, en), guidance: l(guidanceZh, guidanceEn), knowledgeRefs, utteranceRefs, rubricRef: "cafe-task-rubric", requiredCapabilities: ["token-comparison"], capabilityFallback: "self-assessment", evaluationSources: ["self", "ai-assisted"] };
}

export function englishA1Extension(): {
  knowledge: KnowledgeItem[];
  utterances: Utterance[];
  exercises: Exercise[];
  plans: EnglishExtensionPlan[];
} {
  const knowledge: KnowledgeItem[] = [
    k("en-present-routine", "grammar", "I get up / I start / I finish", "一般现在时日常动作", "present simple for routines", "用动词原形描述自己经常做的事情。", "Use the base verb to describe things you do regularly.", ["a1-core", "grammar", "routine"]),
    k("en-get-up", "lexeme", "get up", "起床", "get up", "用于说明每天开始活动的时间。", "Use this to say when your day begins.", ["a1-core", "routine", "reading"]),
    k("en-start-finish", "grammar", "start / finish", "开始／结束", "start / finish", "用于说明工作或学习的起止时间。", "Use these words for the start and end of work or study.", ["a1-core", "routine", "reading"]),
    k("en-at-time", "grammar", "at + time", "在某个时间", "at + time", "具体钟点前使用at。", "Use at before a specific clock time.", ["a1-core", "grammar", "reading"]),
    k("en-every-day", "lexeme", "every day", "每天", "every day", "表示日常重复发生。", "Shows that something happens as a routine.", ["a1-core", "routine", "reading"]),

    k("en-have-has", "grammar", "I have / she has", "有／拥有", "have and has", "I、you、we、they使用have；he、she、it使用has。", "Use have with I, you, we, and they; use has with he, she, and it.", ["a1-core", "grammar", "family"]),
    k("en-possessives", "grammar", "my / your / his / her / our", "基础物主限定词", "basic possessive determiners", "放在名词前说明所属关系。", "Put these before a noun to show who it belongs to.", ["a1-core", "grammar", "family", "reading"]),
    k("en-family", "lexeme", "mother / father / sister / brother", "母亲／父亲／姐妹／兄弟", "close family words", "用于介绍直系家庭成员。", "Use these words to introduce close family.", ["a1-core", "family", "reading"]),
    k("en-live-with", "grammar", "I live with ...", "我和……一起住", "live with", "with后接共同居住的人。", "Put the person you share a home with after with.", ["a1-core", "family", "reading"]),
    k("en-pet", "lexeme", "dog / cat / pet", "狗／猫／宠物", "dog / cat / pet", "用于简单介绍家庭宠物。", "Use these words to introduce a family pet.", ["a1-core", "family", "reading"]),

    k("en-days", "lexeme", "Monday–Sunday", "星期一至星期日", "days of the week", "星期名称首字母大写。", "Capitalize the names of days.", ["a1-core", "schedule", "reading"]),
    k("en-on-day", "grammar", "on Monday", "在星期一", "on + day", "星期名称前使用on。", "Use on before a day of the week.", ["a1-core", "grammar", "schedule", "reading"]),
    k("en-free-busy", "lexeme", "free / busy", "有空／忙", "free / busy", "用于说明是否有时间。", "Use these words to say whether you have time.", ["a1-core", "schedule", "reading"]),
    k("en-can-meet", "grammar", "I can meet ...", "我可以见面……", "can + base verb", "can后接动词原形。", "Put a base verb after can.", ["a1-core", "grammar", "schedule"]),
    k("en-are-you-free", "grammar", "Are you free ...?", "你……有空吗？", "ask about availability", "使用Are you free询问对方是否有时间。", "Use Are you free to ask about availability.", ["a1-core", "schedule"]),

    k("en-feel-sick", "grammar", "I feel sick.", "我不舒服。", "say you feel sick", "用于说明身体不适。", "Use this to say that you are unwell.", ["a1-core", "health"]),
    k("en-need-doctor", "grammar", "I need a doctor.", "我需要医生。", "say what help you need", "need后接所需的人或事物。", "Put the person or thing needed after need.", ["a1-core", "health"]),
    k("en-pharmacy", "lexeme", "pharmacy / clinic", "药店／诊所", "pharmacy / clinic", "寻找基础医疗帮助时使用。", "Use these words when looking for basic medical help.", ["a1-core", "health", "reading"]),
    k("en-pain", "lexeme", "headache / stomachache", "头痛／胃痛", "headache / stomachache", "用于简单说明常见疼痛。", "Use these words to name common pain.", ["a1-core", "health", "reading"]),
    k("en-emergency", "lexeme", "emergency", "紧急情况", "emergency", "告示中表示需要立即帮助的情况。", "On a notice, this means help is needed immediately.", ["a1-core", "health", "reading"]),
  ];

  const utterances: Utterance[] = [
    u("en-routine-line", "I get up at seven and start work at nine.", "我七点起床，九点开始工作。", ["en-present-routine", "en-get-up", "en-start-finish", "en-at-time"]),
    u("en-ask-start-time", "What time do you start work?", "你几点开始工作？", ["en-start-finish"]),
    u("en-reading-routine", "Every day, Leo gets up at seven. He starts work at nine and finishes at five. He studies English at eight in the evening.", "Leo每天七点起床，九点开始工作，五点结束。他晚上八点学习英语。", ["en-every-day", "en-get-up", "en-start-finish", "en-at-time"]),
    u("en-family-line", "I live with my sister.", "我和姐姐一起住。", ["en-live-with", "en-possessives", "en-family"]),
    u("en-has-dog", "She has a small dog.", "她有一只小狗。", ["en-have-has", "en-pet"]),
    u("en-reading-family", "Mina lives with her brother. Her brother is a student. They have a cat named Coco.", "Mina和弟弟一起住。她的弟弟是学生。他们有一只叫Coco的猫。", ["en-live-with", "en-possessives", "en-family", "en-have-has", "en-pet"]),
    u("en-ask-free", "Are you free on Tuesday?", "你星期二有空吗？", ["en-are-you-free", "en-on-day", "en-days", "en-free-busy"]),
    u("en-can-meet-line", "I can meet on Wednesday at three.", "我星期三三点可以见面。", ["en-can-meet", "en-on-day", "en-days", "en-at-time"]),
    u("en-reading-week", "Ana is busy on Monday and Tuesday. She is free on Wednesday afternoon and can meet at three.", "Ana星期一和星期二很忙。她星期三下午有空，可以三点见面。", ["en-free-busy", "en-days", "en-on-day", "en-can-meet", "en-at-time"]),
    u("en-sick-line", "I feel sick. I have a headache.", "我不舒服，头痛。", ["en-feel-sick", "en-pain", "en-have-has"]),
    u("en-doctor-line", "I need a doctor.", "我需要医生。", ["en-need-doctor"]),
    u("en-ask-pharmacy", "Where is the pharmacy?", "药店在哪里？", ["en-pharmacy", "en-where"]),
    u("en-reading-clinic", "The clinic is open from eight to six. For an emergency, call 112. The pharmacy is next to the clinic.", "诊所从八点开放到六点。紧急情况请拨打112。药店在诊所旁边。", ["en-pharmacy", "en-emergency", "en-open", "en-from-to", "en-numbers"]),
  ];

  const exercises: Exercise[] = [
    single("en-recognize-routine", "Leo几点开始工作？", "What time does Leo start work?", [l("七点", "Seven"), l("九点", "Nine"), l("五点", "Five")], 1, "短文写着He starts work at nine。", "The text says he starts work at nine.", ["en-start-finish", "en-at-time"], ["en-reading-routine"]),
    ordering("en-order-start-work", "排成“我九点开始工作”。", "Build 'I start work at nine.'", ["at nine.", "start work", "I"], [2, 1, 0], "使用I＋start work＋at nine。", "Use I + start work + at nine.", ["en-present-routine", "en-start-finish", "en-at-time"], ["en-routine-line"]),
    role("en-role-routine", "告诉同学你几点起床、几点开始工作或学习。", "Tell a classmate when you get up and when you start work or study.", "至少使用get up、start以及两个时间。", "Use get up, start, and two times.", ["en-get-up", "en-start-finish", "en-at-time"], ["en-routine-line"]),
    single("en-read-routine", "阅读日程：Leo晚上八点做什么？", "Read the schedule: What does Leo do at eight in the evening?", [l("起床", "Gets up"), l("工作", "Works"), l("学习英语", "Studies English")], 2, "最后一句说He studies English at eight。", "The last sentence says he studies English at eight.", ["en-at-time"], ["en-reading-routine"]),

    single("en-recognize-family", "谁有一只猫？", "Who has a cat?", [l("Mina和她的弟弟", "Mina and her brother"), l("Mina的父母", "Mina's parents"), l("没有说明", "Not stated")], 0, "短文写着They have a cat。", "The text says they have a cat.", ["en-have-has", "en-family", "en-pet"], ["en-reading-family"]),
    ordering("en-order-live-sister", "排成“我和姐姐一起住”。", "Build 'I live with my sister.'", ["my sister.", "live with", "I"], [2, 1, 0], "使用I＋live with＋my sister。", "Use I + live with + my sister.", ["en-live-with", "en-possessives", "en-family"], ["en-family-line"]),
    role("en-role-family", "介绍一位家庭成员或宠物，并说明你们是否一起住。", "Introduce one family member or pet and say whether you live together.", "使用my、have或has，以及live with中的至少两项。", "Use at least two of my, have or has, and live with.", ["en-have-has", "en-possessives", "en-family", "en-live-with", "en-pet"], ["en-family-line", "en-has-dog"]),
    single("en-read-family", "阅读个人资料：Mina的弟弟是什么身份？", "Read the profile: What is Mina's brother?", [l("教师", "A teacher"), l("学生", "A student"), l("医生", "A doctor")], 1, "第二句说Her brother is a student。", "The second sentence says her brother is a student.", ["en-family", "en-possessives"], ["en-reading-family"]),

    single("en-recognize-free-day", "Ana哪天下午有空？", "Which afternoon is Ana free?", [l("星期一", "Monday"), l("星期二", "Tuesday"), l("星期三", "Wednesday")], 2, "短文说She is free on Wednesday afternoon。", "The text says she is free on Wednesday afternoon.", ["en-days", "en-free-busy", "en-on-day"], ["en-reading-week"]),
    ordering("en-order-free-tuesday", "排成“你星期二有空吗？”。", "Build 'Are you free on Tuesday?'", ["on Tuesday?", "free", "Are you"], [2, 1, 0], "使用Are you＋free＋on Tuesday。", "Use Are you + free + on Tuesday.", ["en-are-you-free", "en-free-busy", "en-on-day", "en-days"], ["en-ask-free"]),
    role("en-role-arrangement", "和同学约本周见面：询问哪天有空，并提出一个时间。", "Arrange to meet a classmate this week: ask which day is free and offer a time.", "使用Are you free、on加星期，以及I can meet。", "Use Are you free, on plus a day, and I can meet.", ["en-are-you-free", "en-on-day", "en-days", "en-can-meet", "en-at-time"], ["en-ask-free", "en-can-meet-line"]),
    single("en-read-week", "阅读本周安排：Ana可以几点见面？", "Read the weekly plan: What time can Ana meet?", [l("两点", "Two"), l("三点", "Three"), l("五点", "Five")], 1, "短文最后说can meet at three。", "The text ends with can meet at three.", ["en-can-meet", "en-at-time"], ["en-reading-week"]),

    single("en-recognize-health", "哪一句表示需要医疗帮助？", "Which sentence says medical help is needed?", [target("I need a doctor."), target("I start work at nine."), target("I live with my sister.")], 0, "I need a doctor直接说明需要医生。", "I need a doctor directly asks for medical help.", ["en-need-doctor"], ["en-doctor-line"]),
    ordering("en-order-feel-sick", "排成“我不舒服”。", "Build 'I feel sick.'", ["sick.", "feel", "I"], [2, 1, 0], "使用I＋feel＋sick。", "Use I + feel + sick.", ["en-feel-sick"], ["en-sick-line"]),
    role("en-role-health", "你身体不舒服。说明一种症状，询问药店或请求联系医生。", "You feel unwell. Name one symptom and ask for a pharmacy or a doctor.", "使用I feel sick、headache或stomachache，以及Where is或I need。", "Use I feel sick, headache or stomachache, and Where is or I need.", ["en-feel-sick", "en-pain", "en-pharmacy", "en-need-doctor"], ["en-sick-line", "en-doctor-line", "en-ask-pharmacy"]),
    single("en-read-clinic", "阅读诊所告示：紧急情况应该做什么？", "Read the clinic notice: What should you do in an emergency?", [l("拨打112", "Call 112"), l("等到六点", "Wait until six"), l("去车站", "Go to the station")], 0, "告示写着For an emergency, call 112。", "The notice says: For an emergency, call 112.", ["en-emergency", "en-numbers"], ["en-reading-clinic"]),
    role("en-capstone-expanded-a1", "结业综合：介绍你的日常时间和一位家庭成员，约定本周见面；如果对方身体不适，询问症状并帮助寻找诊所。", "Course capstone: describe your routine and one family member, arrange a meeting this week, then ask about a health problem and help find a clinic.", "完成标准：包含两个日常时间、一个家庭关系、星期与见面时间，以及一种症状和clinic或doctor。意思清楚即可。", "Include two routine times, one family relationship, a day and meeting time, plus one symptom and clinic or doctor. Clear meaning is enough.", ["en-get-up", "en-start-finish", "en-at-time", "en-family", "en-have-has", "en-days", "en-can-meet", "en-feel-sick", "en-pharmacy", "en-need-doctor"], ["en-routine-line", "en-family-line", "en-can-meet-line", "en-sick-line", "en-ask-pharmacy"]),
  ];

  const plans: EnglishExtensionPlan[] = [
    { id: "daily-routines", title: l("第十三课：描述日常作息", "Lesson 13: Describe a daily routine"), goalRef: "describe-routine-in-english", goal: l("能够用时间信息描述基础日常作息，并从简短日程中提取活动。", "Can describe a basic daily routine with times and extract activities from a short schedule."), knowledgeRefs: ["en-present-routine", "en-get-up", "en-start-finish", "en-at-time", "en-every-day"], utteranceRefs: ["en-routine-line", "en-ask-start-time", "en-reading-routine"], recognition: "en-recognize-routine", guided: "en-order-start-work", task: "en-role-routine", reading: "en-read-routine" },
    { id: "family-and-possessions", title: l("第十四课：介绍家庭与所属", "Lesson 14: Introduce family and possession"), goalRef: "introduce-family-in-english", goal: l("能够介绍家庭成员、宠物和共同居住关系，并从个人资料中提取家庭信息。", "Can introduce family members, pets, and living arrangements and extract family information from a profile."), knowledgeRefs: ["en-have-has", "en-possessives", "en-family", "en-live-with", "en-pet"], utteranceRefs: ["en-family-line", "en-has-dog", "en-reading-family"], recognition: "en-recognize-family", guided: "en-order-live-sister", task: "en-role-family", reading: "en-read-family" },
    { id: "days-and-arrangements", title: l("第十五课：星期与见面安排", "Lesson 15: Days and meeting arrangements"), goalRef: "arrange-meeting-in-english", goal: l("能够询问哪天有空、提出见面时间，并从周计划中提取安排。", "Can ask about availability, offer a meeting time, and extract arrangements from a weekly plan."), knowledgeRefs: ["en-days", "en-on-day", "en-free-busy", "en-can-meet", "en-are-you-free"], utteranceRefs: ["en-ask-free", "en-can-meet-line", "en-reading-week"], recognition: "en-recognize-free-day", guided: "en-order-free-tuesday", task: "en-role-arrangement", reading: "en-read-week" },
    { id: "health-and-essential-needs", title: l("第十六课：说明身体不适并寻求帮助", "Lesson 16: Describe illness and seek help"), goalRef: "seek-health-help-in-english", goal: l("能够简单说明身体不适、寻找诊所或药店，并理解基础医疗告示。", "Can describe a basic health problem, find a clinic or pharmacy, and understand a simple medical notice."), knowledgeRefs: ["en-feel-sick", "en-need-doctor", "en-pharmacy", "en-pain", "en-emergency"], utteranceRefs: ["en-sick-line", "en-doctor-line", "en-ask-pharmacy", "en-reading-clinic"], recognition: "en-recognize-health", guided: "en-order-feel-sick", task: "en-role-health", reading: "en-read-clinic", capstone: { title: l("扩充课程结业综合任务", "Expanded course completion capstone"), exerciseRef: "en-capstone-expanded-a1", knowledgeRefs: ["en-get-up", "en-start-finish", "en-family", "en-have-has", "en-days", "en-can-meet", "en-feel-sick", "en-pharmacy", "en-need-doctor"], utteranceRefs: ["en-routine-line", "en-family-line", "en-can-meet-line", "en-sick-line", "en-ask-pharmacy"] } },
  ];

  return { knowledge, utterances, exercises, plans };
}
