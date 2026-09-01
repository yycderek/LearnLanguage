import type { Exercise, KnowledgeItem, LocalizedText, Utterance } from "@learn-language/protocol";

const l = (zh: string, en: string): LocalizedText => ({ "zh-CN": zh, en });
const target = (value: string): LocalizedText => ({ "zh-CN": value, en: value, native: value });
const reading = (value: string) => ({ latin: value });

export type SpanishExtensionPlan = {
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

function u(id: string, text: string, zh: string, en: string, refs: string[]): Utterance {
  return { id, text, translation: l(zh, en), reading: reading(text), knowledgeRefs: refs };
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

export function spanishA1Extension(): {
  knowledge: KnowledgeItem[];
  utterances: Utterance[];
  exercises: Exercise[];
  plans: SpanishExtensionPlan[];
} {
  const knowledge: KnowledgeItem[] = [
    k("es-present-routine", "grammar", "me levanto / trabajo / estudio", "一般现在时日常动作", "present tense for routines", "用常用动词的现在时描述每天做的事情。", "Use common present-tense verbs to describe daily activities.", ["a1-core", "grammar", "routine"]),
    k("es-get-up", "grammar", "me levanto / se levanta", "起床", "get up", "me levanto说明自己起床，se levanta说明另一个人起床。", "Use me levanto for yourself and se levanta for another person.", ["a1-core", "grammar", "routine", "reading"]),
    k("es-start-finish", "grammar", "empiezo / termina", "开始／结束", "start / finish", "用于说明工作或学习开始和结束。", "Use these forms for the start and end of work or study.", ["a1-core", "grammar", "routine", "reading"]),
    k("es-at-time", "grammar", "a la una / a las tres", "在某个时间", "at a clock time", "一点使用a la una，其他整点通常使用a las加数字。", "Use a la una for one o'clock and normally a las plus a number for other hours.", ["a1-core", "grammar", "routine", "reading"]),
    k("es-every-day", "lexeme", "cada día / todos los días", "每天", "every day", "表示日常重复发生。", "Shows that something happens as a routine.", ["a1-core", "routine", "reading"]),

    k("es-have", "grammar", "tengo / tiene / tienen", "有／拥有", "forms of tener", "tengo说明自己拥有，tiene和tienen用于第三人称单数和复数。", "Use tengo for yourself, tiene for one third-person subject, and tienen for more than one.", ["a1-core", "grammar", "family", "reading"]),
    k("es-possessives", "grammar", "mi / tu / su / nuestro/a", "基础物主限定词", "basic possessive determiners", "放在名词前说明所属关系；nuestro和nuestra与名词性别一致。", "Put these before a noun to show possession; nuestro and nuestra agree with the noun.", ["a1-core", "grammar", "family", "reading"]),
    k("es-family", "lexeme", "madre / padre / hermana / hermano", "母亲／父亲／姐妹／兄弟", "close family words", "用于介绍直系家庭成员。", "Use these words to introduce close family.", ["a1-core", "family", "reading"]),
    k("es-live-with", "grammar", "Vivo con...", "我和……一起住", "live with", "con后接共同居住的人。", "Put the person you share a home with after con.", ["a1-core", "grammar", "family", "reading"]),
    k("es-pet", "lexeme", "perro / gato / mascota", "狗／猫／宠物", "dog / cat / pet", "用于简单介绍家庭宠物。", "Use these words to introduce a family pet.", ["a1-core", "family", "reading"]),

    k("es-weekdays", "lexeme", "lunes–domingo", "星期一至星期日", "days of the week", "西班牙语星期名称通常使用小写。", "Spanish weekday names are normally lowercase.", ["a1-core", "schedule", "reading"]),
    k("es-on-day", "grammar", "el lunes / el martes", "在星期一／星期二", "on a weekday", "基础安排中可在星期名称前使用el。", "Use el before a weekday in a basic arrangement.", ["a1-core", "grammar", "schedule", "reading"]),
    k("es-free-busy", "lexeme", "libre / ocupado / ocupada", "有空／忙", "free / busy", "ocupado或ocupada与所指的人保持性别一致。", "Ocupado or ocupada agrees with the person described.", ["a1-core", "schedule", "reading"]),
    k("es-can-meet", "grammar", "Podemos vernos...", "我们可以见面……", "we can meet", "vernos表示彼此见面，后接日期或时间。", "Vernos means to meet each other and can be followed by a day or time.", ["a1-core", "grammar", "schedule"]),
    k("es-are-you-free", "grammar", "¿Estás libre...?", "你……有空吗？", "ask about availability", "使用estar的第二人称形式询问对方是否有空。", "Use the second-person form of estar to ask whether someone is free.", ["a1-core", "grammar", "schedule"]),

    k("es-feel-unwell", "grammar", "Me siento mal.", "我不舒服", "say you feel unwell", "用于简单说明身体不适。", "Use this to say that you feel unwell.", ["a1-core", "health"]),
    k("es-need-doctor", "grammar", "Necesito un médico.", "我需要医生", "say what medical help you need", "necesito后接所需的人或事物。", "Put the person or thing needed after necesito.", ["a1-core", "health"]),
    k("es-pharmacy-clinic", "lexeme", "farmacia / clínica", "药店／诊所", "pharmacy / clinic", "寻找基础医疗帮助时使用。", "Use these words when looking for basic medical help.", ["a1-core", "health", "reading"]),
    k("es-pain", "grammar", "Me duele la cabeza / el estómago.", "我头痛／胃痛", "name a basic pain", "me duele后接疼痛的单数身体部位。", "Put a singular painful body part after me duele.", ["a1-core", "grammar", "health", "reading"]),
    k("es-emergency", "lexeme", "urgencias / emergencia", "急诊／紧急情况", "emergency care / emergency", "需要立即帮助时寻找urgencias，并按当地指示求助。", "Look for urgencias when immediate help is needed and follow local emergency guidance.", ["a1-core", "health", "reading"]),
  ];

  const utterances: Utterance[] = [
    u("es-routine-line", "Me levanto a las siete y empiezo a trabajar a las nueve.", "我七点起床，九点开始工作。", "I get up at seven and start work at nine.", ["es-get-up", "es-start-finish", "es-at-time"]),
    u("es-ask-start-time", "¿A qué hora empiezas a trabajar?", "你几点开始工作？", "What time do you start work?", ["es-start-finish", "es-at-time"]),
    u("es-reading-routine", "Cada día, Leo se levanta a las siete. Empieza a trabajar a las nueve y termina a las cinco. Estudia español a las ocho de la noche.", "Leo每天七点起床，九点开始工作，五点结束。他晚上八点学习西班牙语。", "Every day, Leo gets up at seven. He starts work at nine and finishes at five. He studies Spanish at eight in the evening.", ["es-every-day", "es-get-up", "es-start-finish", "es-at-time"]),
    u("es-family-line", "Vivo con mi hermana.", "我和姐姐一起住。", "I live with my sister.", ["es-live-with", "es-possessives", "es-family"]),
    u("es-has-dog", "Ella tiene un perro pequeño.", "她有一只小狗。", "She has a small dog.", ["es-have", "es-pet", "es-adjective-agreement"]),
    u("es-reading-family", "Mina vive con su hermano. Su hermano es estudiante. Tienen un gato que se llama Coco.", "Mina和弟弟一起住。她的弟弟是学生。他们有一只叫Coco的猫。", "Mina lives with her brother. Her brother is a student. They have a cat named Coco.", ["es-live-with", "es-possessives", "es-family", "es-have", "es-pet"]),
    u("es-ask-free", "¿Estás libre el martes?", "你星期二有空吗？", "Are you free on Tuesday?", ["es-are-you-free", "es-on-day", "es-weekdays", "es-free-busy"]),
    u("es-can-meet-line", "Podemos vernos el miércoles a las tres.", "我们星期三三点可以见面。", "We can meet on Wednesday at three.", ["es-can-meet", "es-on-day", "es-weekdays", "es-at-time"]),
    u("es-reading-week", "Ana está ocupada el lunes y el martes. Está libre el miércoles por la tarde y puede reunirse a las tres.", "Ana星期一和星期二很忙。她星期三下午有空，可以三点见面。", "Ana is busy on Monday and Tuesday. She is free on Wednesday afternoon and can meet at three.", ["es-free-busy", "es-weekdays", "es-on-day", "es-can-meet", "es-at-time"]),
    u("es-unwell-line", "Me siento mal. Me duele la cabeza.", "我不舒服，头痛。", "I feel unwell. My head hurts.", ["es-feel-unwell", "es-pain"]),
    u("es-doctor-line", "Necesito un médico.", "我需要医生。", "I need a doctor.", ["es-need-doctor"]),
    u("es-ask-pharmacy", "¿Dónde está la farmacia?", "药店在哪里？", "Where is the pharmacy?", ["es-pharmacy-clinic", "es-where", "es-definite-articles"]),
    u("es-reading-clinic", "La clínica abre a las ocho y cierra a las seis. Para una emergencia, vaya a urgencias. La farmacia está al lado de la clínica.", "诊所八点开门，六点关门。紧急情况请去急诊。药店在诊所旁边。", "The clinic opens at eight and closes at six. For an emergency, go to emergency care. The pharmacy is next to the clinic.", ["es-pharmacy-clinic", "es-emergency", "es-opening-hours", "es-numbers"]),
  ];

  const exercises: Exercise[] = [
    single("es-recognize-routine", "Leo几点开始工作？", "What time does Leo start work?", [l("七点", "Seven"), l("九点", "Nine"), l("五点", "Five")], 1, "短文写着Empieza a trabajar a las nueve。", "The text says he starts work at nine.", ["es-start-finish", "es-at-time"], ["es-reading-routine"]),
    ordering("es-order-start-work", "排成“我九点开始工作”。", "Build 'I start work at nine.'", ["a las nueve.", "a trabajar", "Empiezo"], [2, 1, 0], "使用Empiezo＋a trabajar＋a las nueve。", "Use Empiezo + a trabajar + a las nueve.", ["es-start-finish", "es-at-time"], ["es-routine-line"]),
    role("es-role-routine", "告诉同学你几点起床、几点开始工作或学习。", "Tell a classmate when you get up and when you start work or study.", "至少使用me levanto、empiezo以及两个时间。", "Use me levanto, empiezo, and two times.", ["es-get-up", "es-start-finish", "es-at-time"], ["es-routine-line"]),
    single("es-read-routine", "阅读日程：Leo晚上八点做什么？", "Read the schedule: What does Leo do at eight in the evening?", [l("起床", "Gets up"), l("工作", "Works"), l("学习西班牙语", "Studies Spanish")], 2, "最后一句说Estudia español a las ocho。", "The final sentence says he studies Spanish at eight.", ["es-at-time"], ["es-reading-routine"]),

    single("es-recognize-family", "谁有一只猫？", "Who has a cat?", [l("Mina和她的弟弟", "Mina and her brother"), l("Mina的父母", "Mina's parents"), l("没有说明", "Not stated")], 0, "短文写着Tienen un gato。", "The text says they have a cat.", ["es-have", "es-family", "es-pet"], ["es-reading-family"]),
    ordering("es-order-live-sister", "排成“我和姐姐一起住”。", "Build 'I live with my sister.'", ["mi hermana.", "con", "Vivo"], [2, 1, 0], "使用Vivo＋con＋mi hermana。", "Use Vivo + con + mi hermana.", ["es-live-with", "es-possessives", "es-family"], ["es-family-line"]),
    role("es-role-family", "介绍一位家庭成员或宠物，并说明你们是否一起住。", "Introduce a family member or pet and say whether you live together.", "使用mi或su、tengo或tiene，以及vivo con中的至少两项。", "Use at least two of mi or su, tengo or tiene, and vivo con.", ["es-have", "es-possessives", "es-family", "es-live-with", "es-pet"], ["es-family-line", "es-has-dog"]),
    single("es-read-family", "阅读个人资料：Mina的弟弟是什么身份？", "Read the profile: What is Mina's brother?", [l("教师", "A teacher"), l("学生", "A student"), l("医生", "A doctor")], 1, "第二句说Su hermano es estudiante。", "The second sentence says her brother is a student.", ["es-family", "es-possessives"], ["es-reading-family"]),

    single("es-recognize-free-day", "Ana哪天下午有空？", "Which afternoon is Ana free?", [l("星期一", "Monday"), l("星期二", "Tuesday"), l("星期三", "Wednesday")], 2, "短文说Está libre el miércoles por la tarde。", "The text says she is free on Wednesday afternoon.", ["es-weekdays", "es-free-busy", "es-on-day"], ["es-reading-week"]),
    ordering("es-order-free-tuesday", "排成“你星期二有空吗？”。", "Build 'Are you free on Tuesday?'", ["el martes?", "libre", "¿Estás"], [2, 1, 0], "使用¿Estás＋libre＋el martes?", "Use ¿Estás + libre + el martes?", ["es-are-you-free", "es-free-busy", "es-on-day", "es-weekdays"], ["es-ask-free"]),
    role("es-role-arrangement", "和同学约本周见面：询问哪天有空，并提出一个时间。", "Arrange to meet a classmate this week: ask which day is free and offer a time.", "使用¿Estás libre...?、星期和Podemos vernos。", "Use ¿Estás libre...?, a weekday, and Podemos vernos.", ["es-are-you-free", "es-on-day", "es-weekdays", "es-can-meet", "es-at-time"], ["es-ask-free", "es-can-meet-line"]),
    single("es-read-week", "阅读本周安排：Ana可以几点见面？", "Read the weekly plan: What time can Ana meet?", [l("两点", "Two"), l("三点", "Three"), l("五点", "Five")], 1, "短文最后说puede reunirse a las tres。", "The text ends with she can meet at three.", ["es-at-time"], ["es-reading-week"]),

    single("es-recognize-health", "哪一句表示需要医疗帮助？", "Which sentence says medical help is needed?", [target("Necesito un médico."), target("Empiezo a trabajar a las nueve."), target("Vivo con mi hermana.")], 0, "Necesito un médico直接说明需要医生。", "Necesito un médico directly states that a doctor is needed.", ["es-need-doctor"], ["es-doctor-line"]),
    ordering("es-order-feel-unwell", "排成“我不舒服”。", "Build 'I feel unwell.'", ["mal.", "siento", "Me"], [2, 1, 0], "使用Me＋siento＋mal。", "Use Me + siento + mal.", ["es-feel-unwell"], ["es-unwell-line"]),
    role("es-role-health", "你身体不舒服。说明一种疼痛，询问药店或请求医生。", "You feel unwell. Name one pain and ask for a pharmacy or a doctor.", "使用Me siento mal、Me duele...，以及¿Dónde está...?或Necesito...。", "Use Me siento mal, Me duele..., and ¿Dónde está...? or Necesito....", ["es-feel-unwell", "es-pain", "es-pharmacy-clinic", "es-need-doctor"], ["es-unwell-line", "es-doctor-line", "es-ask-pharmacy"]),
    single("es-read-clinic", "阅读诊所告示：紧急情况应该去哪里？", "Read the clinic notice: Where should you go in an emergency?", [l("急诊", "Emergency care"), l("车站", "The station"), l("图书馆", "The library")], 0, "告示写着vaya a urgencias。", "The notice says vaya a urgencias.", ["es-emergency"], ["es-reading-clinic"]),
    role("es-capstone-expanded-a1", "结业综合：介绍你的日常时间和一位家庭成员，约定本周见面；如果对方身体不适，帮助寻找诊所或药店。", "Course capstone: describe your routine and one family member, arrange a meeting this week, then help find a clinic or pharmacy when someone feels unwell.", "完成标准：包含两个日常时间、一个家庭关系、星期与见面时间，以及一种不适和clínica、farmacia或médico。意思清楚即可。", "Include two routine times, one family relationship, a day and meeting time, plus one health problem and clínica, farmacia, or médico. Clear meaning is enough.", ["es-get-up", "es-start-finish", "es-at-time", "es-family", "es-have", "es-weekdays", "es-can-meet", "es-feel-unwell", "es-pharmacy-clinic", "es-need-doctor"], ["es-routine-line", "es-family-line", "es-can-meet-line", "es-unwell-line", "es-ask-pharmacy"]),
  ];

  const plans: SpanishExtensionPlan[] = [
    { id: "daily-routines", title: l("第十三课：描述日常作息", "Lesson 13: Describe a daily routine"), goalRef: "describe-routine-in-spanish", goal: l("能够用时间信息描述基础日常作息，并从简短日程中提取活动。", "Can describe a basic daily routine with times and extract activities from a short schedule."), knowledgeRefs: ["es-present-routine", "es-get-up", "es-start-finish", "es-at-time", "es-every-day"], utteranceRefs: ["es-routine-line", "es-ask-start-time", "es-reading-routine"], recognition: "es-recognize-routine", guided: "es-order-start-work", task: "es-role-routine", reading: "es-read-routine" },
    { id: "family-and-possessions", title: l("第十四课：介绍家庭与所属", "Lesson 14: Introduce family and possession"), goalRef: "introduce-family-in-spanish", goal: l("能够介绍家庭成员、宠物和共同居住关系，并从个人资料中提取家庭信息。", "Can introduce family members, pets, and living arrangements and extract family information from a profile."), knowledgeRefs: ["es-have", "es-possessives", "es-family", "es-live-with", "es-pet"], utteranceRefs: ["es-family-line", "es-has-dog", "es-reading-family"], recognition: "es-recognize-family", guided: "es-order-live-sister", task: "es-role-family", reading: "es-read-family" },
    { id: "days-and-arrangements", title: l("第十五课：星期与见面安排", "Lesson 15: Days and meeting arrangements"), goalRef: "arrange-meeting-in-spanish", goal: l("能够询问哪天有空、提出见面时间，并从周计划中提取安排。", "Can ask about availability, offer a meeting time, and extract arrangements from a weekly plan."), knowledgeRefs: ["es-weekdays", "es-on-day", "es-free-busy", "es-can-meet", "es-are-you-free"], utteranceRefs: ["es-ask-free", "es-can-meet-line", "es-reading-week"], recognition: "es-recognize-free-day", guided: "es-order-free-tuesday", task: "es-role-arrangement", reading: "es-read-week" },
    { id: "health-and-essential-needs", title: l("第十六课：说明身体不适并寻求帮助", "Lesson 16: Describe illness and seek help"), goalRef: "seek-health-help-in-spanish", goal: l("能够简单说明身体不适、寻找诊所或药店，并理解基础医疗告示。", "Can describe a basic health problem, find a clinic or pharmacy, and understand a simple medical notice."), knowledgeRefs: ["es-feel-unwell", "es-need-doctor", "es-pharmacy-clinic", "es-pain", "es-emergency"], utteranceRefs: ["es-unwell-line", "es-doctor-line", "es-ask-pharmacy", "es-reading-clinic"], recognition: "es-recognize-health", guided: "es-order-feel-unwell", task: "es-role-health", reading: "es-read-clinic", capstone: { title: l("扩充课程结业综合任务", "Expanded course completion capstone"), exerciseRef: "es-capstone-expanded-a1", knowledgeRefs: ["es-get-up", "es-start-finish", "es-family", "es-have", "es-weekdays", "es-can-meet", "es-feel-unwell", "es-pharmacy-clinic", "es-need-doctor"], utteranceRefs: ["es-routine-line", "es-family-line", "es-can-meet-line", "es-unwell-line", "es-ask-pharmacy"] } },
  ];

  return { knowledge, utterances, exercises, plans };
}
