import { VideoAnalyticsDashboard } from "@/components/video/VideoAnalyticsDashboard";
import { getVideoAnalyticsDashboardData } from "@/lib/video/analytics";

export const metadata = {
  title: "Video analytics",
};

export default async function VideoAnalyticsPage() {
  const data = await getVideoAnalyticsDashboardData();
  return <VideoAnalyticsDashboard data={data} />;
}
