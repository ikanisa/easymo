"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

interface User {
  user_id: string;
  whatsapp_e164: string;
  display_name?: string;
  tokens?: number;
}

interface AllocationPreset {
  label: string;
  amount: number;
  readonly: boolean;
}

const ALLOCATION_PRESETS: Record<string, AllocationPreset> = {
  insurance_purchase: {
    label: "Insurance Purchase",
    amount: 2000,
    readonly: true,
  },
  promotional_bonus: {
    label: "Promotional Bonus",
    amount: 500,
    readonly: false,
  },
  compensation: {
    label: "Compensation",
    amount: 100,
    readonly: false,
  },
  custom: {
    label: "Custom Amount",
    amount: 0,
    readonly: false,
  },
};

export default function AllocateTokensPage() {
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [reason, setReason] = useState("insurance_purchase");
  const [amount, setAmount] = useState(2000);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Update amount when reason changes
  useEffect(() => {
    const preset = ALLOCATION_PRESETS[reason];
    if (preset) {
      setAmount(preset.amount);
    }
  }, [reason]);

  async function searchUser() {
    if (!whatsappNumber.trim()) {
      setMessage({ type: "error", text: "Please enter a WhatsApp number" });
      return;
    }

    setSearching(true);
    setMessage(null);

    try {
      // Search for user by WhatsApp number
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, whatsapp_e164, display_name")
        .eq("whatsapp_e164", whatsappNumber.trim())
        .single();

      if (profileError || !profileData) {
        setMessage({ type: "error", text: "User not found with this WhatsApp number" });
        setSelectedUser(null);
        return;
      }

      // Get user's current token balance
      const { data: walletData } = await supabase
        .from("wallet_accounts")
        .select("tokens")
        .eq("profile_id", profileData.user_id)
        .single();

      setSelectedUser({
        ...profileData,
        tokens: walletData?.tokens || 0,
      });

      setMessage({ type: "success", text: "User found!" });
    } catch (error) {
      console.error("Error searching user:", error);
      setMessage({ type: "error", text: "Error searching for user" });
      setSelectedUser(null);
    } finally {
      setSearching(false);
    }
  }

  async function allocateTokens() {
    if (!selectedUser) {
      setMessage({ type: "error", text: "Please search for a user first" });
      return;
    }

    if (amount <= 0) {
      setMessage({ type: "error", text: "Amount must be greater than 0" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Call wallet_transfer_tokens RPC
      // Note: We need a system profile ID - this should be configured in wallet_settings
      const idempotencyKey = `admin:${reason}:${selectedUser.user_id}:${Date.now()}`;

      const { data, error } = await supabase.rpc("wallet_transfer_tokens", {
        p_sender: null, // Will be resolved to system profile
        p_amount: amount,
        p_recipient: selectedUser.user_id,
        p_recipient_whatsapp: null,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        throw error;
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (result?.success) {
        setMessage({
          type: "success",
          text: `✅ Successfully allocated ${amount} tokens to ${selectedUser.whatsapp_e164}. New balance: ${result.recipient_tokens} tokens`,
        });

        // Update selected user's balance
        setSelectedUser({
          ...selectedUser,
          tokens: result.recipient_tokens,
        });

        // Reset form
        setTimeout(() => {
          setWhatsappNumber("");
          setSelectedUser(null);
          setReason("insurance_purchase");
          setAmount(2000);
        }, 3000);
      } else {
        setMessage({
          type: "error",
          text: `Failed to allocate tokens: ${result?.reason || "Unknown error"}`,
        });
      }
    } catch (error: any) {
      console.error("Error allocating tokens:", error);
      setMessage({
        type: "error",
        text: `Error: ${error.message || "Failed to allocate tokens"}`,
      });
    } finally {
      setLoading(false);
    }
  }

  const preset = ALLOCATION_PRESETS[reason];
  const isReadonly = preset?.readonly || false;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Allocate Tokens</h1>
        <p className="text-gray-600">
          Manually allocate tokens to users for insurance purchases, promotions, or compensation
        </p>
      </div>

      {/* Alert Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Main Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="space-y-6">
          {/* WhatsApp Number Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User WhatsApp Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="+250788..."
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && searchUser()}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={searchUser}
                disabled={searching}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {searching ? "Searching..." : "Search"}
              </button>
            </div>
          </div>

          {/* User Details (shown after search) */}
          {selectedUser && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">User Details</h3>
              <div className="space-y-1 text-sm text-blue-800">
                <p>
                  <span className="font-medium">Name:</span>{" "}
                  {selectedUser.display_name || "Unknown"}
                </p>
                <p>
                  <span className="font-medium">WhatsApp:</span> {selectedUser.whatsapp_e164}
                </p>
                <p>
                  <span className="font-medium">Current Balance:</span> {selectedUser.tokens} tokens
                </p>
                <p>
                  <span className="font-medium">New Balance:</span>{" "}
                  <span className="text-green-600 font-semibold">
                    {(selectedUser.tokens || 0) + amount} tokens
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Allocation Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allocation Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(ALLOCATION_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          {/* Token Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token Amount {isReadonly && "(Pre-filled, Read-only)"}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              readOnly={isReadonly}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isReadonly ? "bg-gray-100 cursor-not-allowed" : ""
              }`}
            />
            {isReadonly && (
              <p className="mt-1 text-sm text-gray-500">
                Amount is fixed for {preset.label}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => {
                setWhatsappNumber("");
                setSelectedUser(null);
                setMessage(null);
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={allocateTokens}
              disabled={loading || !selectedUser}
              className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? "Sending..." : `Send ${amount} Tokens`}
            </button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-yellow-900 mb-2">ℹ️ Important Notes</h3>
        <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
          <li>Insurance Purchase allocations are fixed at 2000 tokens</li>
          <li>All allocations are logged for audit purposes</li>
          <li>Tokens are transferred from the system wallet</li>
          <li>Duplicate allocations are prevented by idempotency keys</li>
        </ul>
      </div>
    </div>
  );
}
