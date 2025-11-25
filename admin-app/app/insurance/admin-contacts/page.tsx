'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect,useState } from 'react';

export default function InsuranceAdminContacts() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [newContact, setNewContact] = useState({ name: '', whatsapp_number: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('insurance_admin_contacts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (fetchError) throw fetchError;
      setContacts(data || []);
    } catch (err) {
      console.error('Error loading contacts:', err);
      setError('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const addContact = async () => {
    if (!newContact.name || !newContact.whatsapp_number) {
      setError('Please provide both name and WhatsApp number');
      return;
    }

    // Validate WhatsApp number format
    if (!newContact.whatsapp_number.match(/^\+\d{10,15}$/)) {
      setError('WhatsApp number must be in format: +250788123456');
      return;
    }

    try {
      setError(null);
      const { error: insertError } = await supabase
        .from('insurance_admin_contacts')
        .insert([{
          ...newContact,
          contact_type: 'whatsapp',
          is_active: true
        }]);

      if (insertError) throw insertError;
      
      setNewContact({ name: '', whatsapp_number: '' });
      await loadContacts();
      
      // Sync to insurance_admins table
      await supabase.rpc('sync_insurance_admins_from_contacts');
    } catch (err) {
      console.error('Error adding contact:', err);
      setError('Failed to add contact');
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('insurance_admin_contacts')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      if (updateError) throw updateError;
      await loadContacts();
      
      // Sync to insurance_admins table
      await supabase.rpc('sync_insurance_admins_from_contacts');
    } catch (err) {
      console.error('Error toggling status:', err);
      setError('Failed to update contact status');
    }
  };

  const deleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from('insurance_admin_contacts')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
      await loadContacts();
      
      // Sync to insurance_admins table
      await supabase.rpc('sync_insurance_admins_from_contacts');
    } catch (err) {
      console.error('Error deleting contact:', err);
      setError('Failed to delete contact');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading contacts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Insurance Admin Contacts</h1>
        <p className="mt-2 text-gray-600">
          Manage WhatsApp contacts who receive insurance lead notifications
        </p>
      </div>
      
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Add New Contact Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Add New Contact</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Name (e.g., John Doe)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={newContact.name}
            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
          />
          <input
            type="text"
            placeholder="WhatsApp Number (e.g., +250788123456)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={newContact.whatsapp_number}
            onChange={(e) => setNewContact({ ...newContact, whatsapp_number: e.target.value })}
          />
          <button
            onClick={addContact}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Contact
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Format: Include country code (e.g., +250 for Rwanda)
        </p>
      </div>

      {/* Contacts List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            Active Contacts ({contacts.filter(c => c.is_active).length}/{contacts.length})
          </h2>
        </div>
        
        {contacts.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-gray-400 text-lg mb-2">No contacts yet</div>
            <div className="text-gray-500 text-sm">
              Add your first insurance admin contact above
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    WhatsApp Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {contact.display_name || contact.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {contact.contact_value || contact.whatsapp_number}
                      </div>
                      <a
                        href={`https://wa.me/${(contact.contact_value || contact.whatsapp_number).replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Open in WhatsApp
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        contact.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {contact.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(contact.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => toggleActive(contact.id, contact.is_active)}
                        className={`${
                          contact.is_active 
                            ? 'text-orange-600 hover:text-orange-900' 
                            : 'text-green-600 hover:text-green-900'
                        }`}
                      >
                        {contact.is_active ? 'Deactivate' : 'Activate'}
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

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">💡 How It Works</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Active contacts receive WhatsApp notifications when users upload insurance documents</li>
          <li>• Notifications include extracted OCR data (policy number, dates, coverage, etc.)</li>
          <li>• Only active contacts receive notifications</li>
          <li>• Contact sync happens automatically when you add/update/delete contacts</li>
        </ul>
      </div>
    </div>
  );
}
