import type { Metadata } from "next";
import { CourseStudio } from "../course-studio";

export const metadata: Metadata = {
  title: "学习空间",
  description: "在设备本地学习课程、保存进度并完成复习。",
};

export default function LearnPage() {
  return <CourseStudio space="learn" />;
}
