import type { Metadata } from "next";
import { CourseStudio } from "../course-studio";

export const metadata: Metadata = {
  title: "学习空间 / Learn",
  description: "在设备本地学习课程、保存进度并完成复习。 Learn locally, save progress, and review.",
};

export default function LearnPage() {
  return <CourseStudio space="learn" />;
}
