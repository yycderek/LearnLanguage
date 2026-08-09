import type { Metadata } from "next";
import { CourseStudio } from "../course-studio";

export const metadata: Metadata = {
  title: "课程工作台",
  description: "创建、导入、校验、预览和发布任意语言的课程包。",
};

export default function StudioPage() {
  return <CourseStudio space="studio" />;
}
