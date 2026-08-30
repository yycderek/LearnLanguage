import type { Metadata } from "next";
import { CourseStudio } from "../course-studio";

export const metadata: Metadata = {
  title: "课程工作台 / Course Studio",
  description: "创建、导入、校验、预览和发布任意语言的课程包。 Create and publish courses for any language.",
};

export default function StudioPage() {
  return <CourseStudio key="studio" space="studio" />;
}
