import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";

interface Activity {
  id: string;
  user: {
    name: string;
    avatar?: string;
  };
  action: string;
  target: string;
  timestamp: string;
}

interface ActivityFeedProps {
  activities: Activity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
      <div className="mt-6 flow-root">
        <ul role="list" className="-my-5 divide-y divide-gray-200">
          {activities.map((activity) => (
            <li key={activity.id} className="py-4">
              <div className="flex items-center space-x-4">
                <Avatar src={activity.user.avatar} fallback={activity.user.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {activity.user.name}
                  </p>
                  <p className="truncate text-sm text-gray-500">
                    {activity.action} <span className="font-medium text-gray-900">{activity.target}</span>
                  </p>
                </div>
                <div>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                    {activity.timestamp}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
