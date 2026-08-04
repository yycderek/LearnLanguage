import type { Metadata } from "next";
import { CourseStudio } from "./course-studio";

export const metadata: Metadata = {
  title: "课程工作台 · LearnLanguage",
  description: "导入、校验并预览任意语言的 LearnLanguage 课程包。",
  other: { "codex-preview": "development" },
};

export default function Home() {
  return <CourseStudio />;
}
