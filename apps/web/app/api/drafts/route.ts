import { getD1 } from "@/db";
import { displayText, validateCourse } from "@/lib/course";
import { getChatGPTUser } from "@/app/chatgpt-auth";

async function currentOwnerId() {
  const user = await getChatGPTUser();
  if (user) return user.userId;
  return process.env.NODE_ENV === "production" ? null : "local-preview";
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "未知错误";
  if (message.includes("no such table")) return "草稿表尚未初始化，请部署包含 D1 migration 的版本。";
  return message;
}

export async function GET(request: Request) {
  try {
    const ownerId = await currentOwnerId();
    if (!ownerId) return Response.json({ error: "需要登录后才能读取私有草稿。" }, { status: 401 });
    const url = new URL(request.url);
    const draftId = url.searchParams.get("draftId");
    const revision = Number(url.searchParams.get("revision") ?? 0);
    const db = getD1();
    if (draftId) {
      const query = revision > 0
        ? db.prepare("SELECT v.draft_id AS draftId, v.revision, v.payload, v.created_at AS updatedAt, h.title, h.language_id AS languageId FROM draft_versions v JOIN draft_heads h ON h.draft_id = v.draft_id WHERE v.owner_id = ? AND v.draft_id = ? AND v.revision = ? LIMIT 1").bind(ownerId, draftId, revision)
        : db.prepare("SELECT v.draft_id AS draftId, v.revision, v.payload, v.created_at AS updatedAt, h.title, h.language_id AS languageId FROM draft_versions v JOIN draft_heads h ON h.draft_id = v.draft_id WHERE v.owner_id = ? AND v.draft_id = ? ORDER BY v.revision DESC LIMIT 1").bind(ownerId, draftId);
      return Response.json({ draft: await query.first() });
    }
    const rows = await db.prepare("SELECT h.draft_id AS draftId, h.current_revision AS revision, h.title, h.language_id AS languageId, h.updated_at AS updatedAt FROM draft_heads h WHERE h.owner_id = ? ORDER BY h.updated_at DESC LIMIT 12").bind(ownerId).all();
    return Response.json({ drafts: rows.results });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await currentOwnerId();
    if (!ownerId) return Response.json({ error: "需要登录后才能保存私有草稿。" }, { status: 401 });
    const body = await request.json() as { draftId?: string; course?: unknown };
    const checked = validateCourse(JSON.stringify(body.course));
    if (!checked.course) return Response.json({ issues: checked.issues }, { status: 400 });
    const course = checked.course;
    const db = getD1();
    const draftId = body.draftId ?? crypto.randomUUID();
    const head = await db.prepare("SELECT current_revision AS revision FROM draft_heads WHERE owner_id = ? AND draft_id = ? LIMIT 1").bind(ownerId, draftId).first<{ revision: number }>();
    const revision = (head?.revision ?? 0) + 1;
    const now = new Date().toISOString();
    const title = displayText(course.manifest.title);
    await db.batch([
      db.prepare("INSERT INTO draft_heads (draft_id, owner_id, course_id, language_id, title, current_revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(draft_id) DO UPDATE SET course_id = excluded.course_id, language_id = excluded.language_id, title = excluded.title, current_revision = excluded.current_revision, updated_at = excluded.updated_at WHERE draft_heads.owner_id = excluded.owner_id").bind(draftId, ownerId, course.manifest.id, course.manifest.languageId, title, revision, now, now),
      db.prepare("INSERT INTO draft_versions (draft_id, revision, owner_id, payload, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(draftId, revision, ownerId, JSON.stringify(course, null, 2), "Manual save", now),
    ]);
    const history = await db.prepare("SELECT v.draft_id AS draftId, v.revision, h.title, h.language_id AS languageId, v.created_at AS updatedAt FROM draft_versions v JOIN draft_heads h ON h.draft_id = v.draft_id WHERE v.owner_id = ? AND v.draft_id = ? ORDER BY v.revision DESC LIMIT 8").bind(ownerId, draftId).all();
    return Response.json({ draft: { draftId, revision, title, languageId: course.manifest.languageId, updatedAt: now }, history: history.results }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
