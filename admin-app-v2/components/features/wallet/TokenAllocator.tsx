"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useState } from "react";

export function TokenAllocator() {
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [type, setType] = useState("partner");

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900">Allocate Tokens</h3>
      <p className="text-sm text-gray-500 mb-6">
        Distribute tokens to partners or users.
      </p>

      <div className="space-y-4">
        <Select
          label="Recipient Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={[
            { label: "Partner", value: "partner" },
            { label: "User", value: "user" },
          ]}
        />
        <Input
          label="Recipient ID / Email"
          placeholder={type === "partner" ? "Partner ID" : "User Email"}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
        <Input
          label="Amount (Tokens)"
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button className="w-full">Send Tokens</Button>
      </div>
    </Card>
  );
}
