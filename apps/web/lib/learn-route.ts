export type RestorableLearnView = "library" | "settings" | "plan" | "dashboard";

export type LearnRoute = {
  courseId?: string;
  view: RestorableLearnView;
};

const restorableViews = new Set<RestorableLearnView>(["library", "settings", "plan", "dashboard"]);

export function readLearnRoute(search: string): LearnRoute {
  const params = new URLSearchParams(search);
  const candidate = params.get("view");
  return {
    courseId: params.get("course") ?? undefined,
    view: candidate && restorableViews.has(candidate as RestorableLearnView) ? candidate as RestorableLearnView : "dashboard",
  };
}

export function writeLearnRoute(currentUrl: string, route: LearnRoute) {
  const url = new URL(currentUrl);
  url.searchParams.set("view", route.view);
  if (route.courseId) url.searchParams.set("course", route.courseId);
  else url.searchParams.delete("course");
  return url;
}
