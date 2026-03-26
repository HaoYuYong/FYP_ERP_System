import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

interface InventoryItem {
  item_id: number;
  item_name: string;
  serial_number?: string;
  balance_qty?: number;
  uom?: string;
  // Other fields (description, classification, etc.) can be added later
}

// ==============================================
// COMPONENT
// ==============================================

const InventoryPage: React.FC = () => {
  // State for inventory list
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    item_name: '',
    serial_number: '',
    balance_qty: '',
    uom: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // ==============================================
  // FETCH INVENTORY ITEMS
  // ==============================================
  const fetchItems = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('inventory')
        .select('item_id, item_name, serial_number, balance_qty, uom')
        .order('item_id', { ascending: true });

      if (fetchError) throw fetchError;

      setItems(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // ==============================================
  // ADD NEW ITEM
  // ==============================================
  const handleAddItem = async () => {
    // Validation: item_name is required
    if (!formData.item_name.trim()) {
      setError('Item name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Prepare the record to insert
      const newItem = {
        item_name: formData.item_name,
        serial_number: formData.serial_number || null,
        balance_qty: formData.balance_qty ? parseFloat(formData.balance_qty) : null,
        uom: formData.uom || null,
        // Other fields (description, classification_id, log_id) are left as NULL
      };

      const { data, error: insertError } = await supabase
        .from('inventory')
        .insert([newItem])
        .select(); // Return the inserted record to get the generated item_id

      if (insertError) throw insertError;

      // Refresh the list (will show the new item)
      await fetchItems();

      // Ask user whether to stay on form or go back
      const stay = window.confirm(
        'Item added successfully!\n\nClick OK to add another item, or Cancel to return to inventory list.'
      );

      if (stay) {
        // Reset the form and keep modal open
        setFormData({ item_name: '', serial_number: '', balance_qty: '', uom: '' });
      } else {
        // Close modal and return to list
        setShowModal(false);
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error adding item:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setFormData({ item_name: '', serial_number: '', balance_qty: '', uom: '' });
    setError(''); // clear any previous errors
  };

  // ==============================================
  // RENDER
  // ==============================================
  return (
    <div className="p-6">
      {/* Header with title and Add button */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Inventory Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New Item
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          <div className="font-medium">Error</div>
          <div className="text-sm mt-1">{error}</div>
        </div>
      )}

      {/* Loading spinner */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="ml-3 text-gray-600">Loading inventory...</span>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Serial Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance Qty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    UOM
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 0a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z" />
                      </svg>
                      <p className="mt-2">No items found</p>
                      <p className="text-sm mt-1">Click "Add New Item" to create your first item.</p>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.item_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600">
                        {item.item_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {item.item_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.serial_number || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.balance_qty !== undefined ? item.balance_qty : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.uom || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer with summary and refresh button */}
      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {items.length} item{items.length !== 1 ? 's' : ''} found
        </div>
        <button
          onClick={fetchItems}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh List
        </button>
      </div>

      {/* MODAL for adding new item */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Add New Item</h2>

            {/* Modal error display */}
            {error && (
              <div className="mb-4 p-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {error}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleAddItem(); }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={formData.item_name}
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Balance Quantity
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.balance_qty}
                    onChange={(e) => setFormData({ ...formData, balance_qty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit of Measure (UOM)
                  </label>
                  <input
                    type="text"
                    value={formData.uom}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={submitting}
                    placeholder="e.g., pcs, kg, box"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Adding...
                    </>
                  ) : (
                    'Add Item'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;