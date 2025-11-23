"use client";

import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Phone, Mail, MoreVertical } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  status: "online" | "offline";
}

const mockContacts: Contact[] = [
  {
    id: "1",
    name: "Sarah Wilson",
    role: "Claims Manager",
    phone: "+250 788 123 456",
    email: "sarah@easymo.com",
    status: "online",
  },
  {
    id: "2",
    name: "Mike Brown",
    role: "Underwriter",
    phone: "+250 788 654 321",
    email: "mike@easymo.com",
    status: "offline",
  },
];

export function ContactManager() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Admin Contacts</h3>
        <Button size="sm" variant="secondary">Add Contact</Button>
      </div>

      <div className="space-y-4">
        {mockContacts.map((contact) => (
          <div
            key={contact.id}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar fallback={contact.name} />
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                    contact.status === "online" ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">{contact.name}</h4>
                <p className="text-xs text-gray-500">{contact.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-500">
                <Phone className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-500">
                <Mail className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-500">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
