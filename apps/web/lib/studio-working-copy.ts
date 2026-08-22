import type { CoursePack } from "./course.ts";
import { deleteDeviceValue, getDeviceValue, putDeviceValue } from "./device-repository.ts";

const WORKING_COPY_KEY = "studio-working-copy-v1";

export interface StudioWorkingCopy {
  draftId: string;
  updatedAt: string;
  course: CoursePack;
}

function validWorkingCopy(value: unknown): value is StudioWorkingCopy {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StudioWorkingCopy>;
  return typeof candidate.draftId === "string"
    && candidate.draftId.length > 0
    && typeof candidate.updatedAt === "string"
    && Number.isFinite(Date.parse(candidate.updatedAt))
    && Boolean(candidate.course && typeof candidate.course === "object" && candidate.course.manifest?.status === "draft");
}

export async function loadStudioWorkingCopy(): Promise<StudioWorkingCopy | undefined> {
  const value = await getDeviceValue<unknown>("drafts", WORKING_COPY_KEY);
  return validWorkingCopy(value) ? value : undefined;
}

export async function saveStudioWorkingCopy(copy: StudioWorkingCopy): Promise<void> {
  await putDeviceValue("drafts", WORKING_COPY_KEY, copy);
}

export async function clearStudioWorkingCopy(): Promise<void> {
  await deleteDeviceValue("drafts", WORKING_COPY_KEY);
}
