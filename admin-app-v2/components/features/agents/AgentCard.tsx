import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Bot, Settings, Play, Pause } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "error";
  type: "sales" | "support" | "custom";
  conversations: number;
}

interface AgentCardProps {
  agent: Agent;
  onToggle: (id: string) => void;
  onConfigure: (id: string) => void;
}

export function AgentCard({ agent, onToggle, onConfigure }: AgentCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
            <Bot className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{agent.name}</h3>
            <Badge variant="outline" className="capitalize">
              {agent.type}
            </Badge>
          </div>
        </div>
        <Badge
          variant={
            agent.status === "active"
              ? "success"
              : agent.status === "paused"
              ? "warning"
              : "destructive"
          }
          className="capitalize"
        >
          {agent.status}
        </Badge>
      </div>

      <p className="mt-4 text-sm text-gray-500">{agent.description}</p>

      <div className="mt-4 flex items-center justify-between border-t pt-4">
        <div className="text-sm text-gray-500">
          <span className="font-medium text-gray-900">
            {agent.conversations}
          </span>{" "}
          conversations
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggle(agent.id)}
            className={
              agent.status === "active"
                ? "text-yellow-600 hover:text-yellow-700"
                : "text-green-600 hover:text-green-700"
            }
          >
            {agent.status === "active" ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onConfigure(agent.id)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
