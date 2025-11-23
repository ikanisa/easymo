"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState } from "react";

interface AdminContact {
  id: string;
  contact_type: string;
  contact_value: string;
  display_name: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<AdminContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<AdminContact | null>(null);
  const [formData, setFormData] = useState({
    contact_type: "whatsapp",
    contact_value: "",
    display_name: "",
    is_active: true,
    display_order: 1,
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("insurance_admin_contacts")
        .select("*")
        .order("display_order");

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      setMessage({ type: "error", text: "Failed to load contacts" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    try {
      if (editingContact) {
        // Update existing contact
        const { error } = await supabase
          .from("insurance_admin_contacts")
          .update(formData)
          .eq("id", editingContact.id);

        if (error) throw error;
        setMessage({ type: "success", text: "Contact updated successfully!" });
      } else {
        // Create new contact
        const { error } = await supabase
          .from("insurance_admin_contacts")
          .insert([formData]);

        if (error) throw error;
        setMessage({ type: "success", text: "Contact added successfully!" });
      }

      // Reset form and refresh
      setFormData({
        contact_type: "whatsapp",
        contact_value: "",
        display_name: "",
        is_active: true,
        display_order: contacts.length + 1,
      });
      setShowForm(false);
      setEditingContact(null);
      fetchContacts();
    } catch (error: any) {
      console.error("Error saving contact:", error);
      setMessage({ type: "error", text: error.message || "Failed to save contact" });
    }
  }

  async function toggleActive(contact: AdminContact) {
    try {
      const { error } = await supabase
        .from("insurance_admin_contacts")
        .update({ is_active: !contact.is_active })
        .eq("id", contact.id);

      if (error) throw error;
      setMessage({
        type: "success",
        text: `Contact ${!contact.is_active ? "activated" : "deactivated"}`,
      });
      fetchContacts();
    } catch (error: any) {
      console.error("Error toggling contact:", error);
      setMessage({ type: "error", text: "Failed to update contact" });
    }
  }

  async function deleteContact(id: string) {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    try {
      const { error } = await supabase
        .from("insurance_admin_contacts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setMessage({ type: "success", text: "Contact deleted successfully!" });
      fetchContacts();
    } catch (error: any) {
      console.error("Error deleting contact:", error);
      setMessage({ type: "error", text: "Failed to delete contact" });
    }
  }

  function startEdit(contact: AdminContact) {
    setEditingContact(contact);
    setFormData({
      contact_type: contact.contact_type,
      contact_value: contact.contact_value,
      display_name: contact.display_name,
      is_active: contact.is_active,
      display_order: contact.display_order,
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingContact(null);
    setFormData({
      contact_type: "whatsapp",
      contact_value: "",
      display_name: "",
      is_active: true,
      display_order: contacts.length + 1,
    });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Insurance Admin Contacts</h1>
          <p className="text-gray-600">
            Manage WhatsApp contacts for insurance admin notifications
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          {showForm ? "Cancel" : "+ Add Contact"}
        </button>
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

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {editingContact ? "Edit Contact" : "Add New Contact"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="Insurance Support 1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Value (WhatsApp) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.contact_value}
                  onChange={(e) => setFormData({ ...formData, contact_value: e.target.value })}
                  placeholder="+250788..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Type
                </label>
                <select
                  value={formData.contact_type}
                  onChange={(e) => setFormData({ ...formData, contact_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({ ...formData, display_order: parseInt(e.target.value) || 1 })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                Active (will receive notifications)
              </label>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={cancelForm}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                {editingContact ? "Update Contact" : "Add Contact"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Contacts Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading contacts...</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 text-lg mb-2">No contacts yet</p>
          <p className="text-gray-500 text-sm">Add your first admin contact to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Display Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {contact.display_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {contact.contact_value}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {contact.contact_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {contact.display_order}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        contact.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {contact.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => startEdit(contact)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(contact)}
                      className="text-yellow-600 hover:text-yellow-900"
                    >
                      {contact.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => deleteContact(contact.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
