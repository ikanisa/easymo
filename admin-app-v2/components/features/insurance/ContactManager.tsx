"use client";

import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Phone, Mail, MoreVertical, Loader2 } from "lucide-react";
import { useInsuranceContacts } from "@/lib/hooks/useData";

interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string;
  email?: string;
  status: "online" | "offline";
}

export function ContactManager() {
  const { data, isLoading, error } = useInsuranceContacts();
  const contacts: Contact[] = (data as { contacts?: Contact[] })?.contacts || [];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Admin Contacts</h3>
        <Button size="sm" variant="secondary">Add Contact</Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {error && (
        <div className="text-center py-8 text-red-500">
          Failed to load contacts
        </div>
      )}

      {!isLoading && !error && contacts.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No contacts available. Add insurance admin contacts to get started.
        </div>
      )}

      <div className="space-y-4">
        {contacts.map((contact) => (
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
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-gray-500"
                onClick={() => window.open(`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}`, '_blank')}
              >
                <Phone className="w-4 h-4" />
              </Button>
              {contact.email && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-gray-500"
                  onClick={() => window.open(`mailto:${contact.email}`, '_blank')}
                >
                  <Mail className="w-4 h-4" />
                </Button>
              )}
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
