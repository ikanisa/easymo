import { PageHeader } from "@/components/layout/PageHeader";
import { TasksBoard } from "@/components/tasks/TasksBoard";

export default function TasksPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Tasks & workflows"
        description="Plan handoffs across intake, pricing, payments, and issuance teams."
      />
      <TasksBoard />
    </div>
  );
}
