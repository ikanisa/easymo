"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, Trash } from "lucide-react";
import { useState } from "react";

interface MenuItem {
  id: string;
  title: string;
  command: string;
}

export function MenuBuilder() {
  const [items, setItems] = useState<MenuItem[]>([
    { id: "1", title: "Main Menu", command: "menu" },
    { id: "2", title: "Support", command: "help" },
  ]);

  const addItem = () => {
    setItems([
      ...items,
      { id: Math.random().toString(), title: "", command: "" },
    ]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Menu Configuration</h3>
        <Button onClick={addItem} size="sm" variant="secondary">
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>
      <div className="mt-6 space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-start gap-4">
            <div className="flex-1 space-y-4 sm:flex sm:space-x-4 sm:space-y-0">
              <div className="flex-1">
                <Input
                  placeholder="Menu Title"
                  defaultValue={item.title}
                  aria-label={`Menu item ${index + 1} title`}
                />
              </div>
              <div className="flex-1">
                <Input
                  placeholder="Command (e.g., menu)"
                  defaultValue={item.command}
                  aria-label={`Menu item ${index + 1} command`}
                />
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeItem(item.id)}
              className="text-gray-400 hover:text-red-600"
            >
              <Trash className="h-4 w-4" />
              <span className="sr-only">Remove item</span>
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <Button>Save Changes</Button>
      </div>
    </Card>
  );
}
