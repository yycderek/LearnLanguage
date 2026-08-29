import { ProfileBackupApplicationService } from "@learn-language/application/workspace";
import { normalizeCourseLearningRecord, type CourseLearningRecord } from "@learn-language/application/learning-record";
import { LearningPlanApplicationService, normalizeLearningPlan, type LearningPlan } from "@learn-language/application/learning-plan";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { SQLiteLearningPlanRepository, SQLiteLearningProfileRepository } from "./storage";

interface MobileBackupV1 {
  schemaVersion: 1;
  kind: "learn-language-mobile-backup";
  exportedAt: string;
  records: CourseLearningRecord[];
}

interface MobileBackupV2 {
  schemaVersion: 2;
  kind: "learn-language-mobile-backup";
  exportedAt: string;
  records: CourseLearningRecord[];
  plans: LearningPlan[];
}

type MobileBackup = MobileBackupV1 | MobileBackupV2;

export async function exportMobileBackup(
  records: readonly CourseLearningRecord[],
  plans: readonly LearningPlan[],
) {
  const exportedAt = new Date().toISOString();
  const stamp = exportedAt.replaceAll(":", "-");
  const file = new File(Paths.cache, `learnlanguage-mobile-${stamp}.json`);
  if (file.exists) file.delete();
  file.create();
  const backup: MobileBackupV2 = {
    schemaVersion: 2,
    kind: "learn-language-mobile-backup",
    exportedAt,
    records: [...records],
    plans: [...plans],
  };
  file.write(JSON.stringify(backup, null, 2));
  if (!(await Sharing.isAvailableAsync())) throw new Error("当前设备不支持系统分享");
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "导出 LearnLanguage 学习备份",
  });
}

export async function importMobileBackup(
  profileRepository: SQLiteLearningProfileRepository,
  planRepository: SQLiteLearningPlanRepository,
) {
  const picked = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
  if (picked.canceled) return undefined;
  const asset = picked.assets[0];
  if (!asset) throw new Error("没有读取到备份文件");
  const raw = await new File(asset.uri).text();
  const input = JSON.parse(raw) as Partial<MobileBackup>;
  if ((input.schemaVersion !== 1 && input.schemaVersion !== 2)
    || input.kind !== "learn-language-mobile-backup"
    || !Array.isArray(input.records)
    || (input.schemaVersion === 2 && !Array.isArray(input.plans))) {
    throw new Error("不是受支持的 LearnLanguage 移动端备份");
  }
  const records = input.records.map(normalizeCourseLearningRecord);
  if (records.some((record) => !record)) throw new Error("备份包含损坏的学习记录");
  const rawPlans = input.schemaVersion === 2 && Array.isArray(input.plans) ? input.plans : [];
  const plans = rawPlans.map(normalizeLearningPlan);
  if (plans.some((plan) => !plan)) throw new Error("备份包含损坏的学习计划");
  const [recordResult, planResult] = await Promise.all([
    new ProfileBackupApplicationService(profileRepository).restore(records as CourseLearningRecord[]),
    new LearningPlanApplicationService(planRepository).restore(plans as LearningPlan[]),
  ]);
  return { records: recordResult, plans: planResult };
}
