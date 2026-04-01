import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import FloatingActionMenu from '../components/ui/FloatingActionMenu';
import { PlusIcon, ItemIcon, CIcon } from '../components/ui/Icons';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

/**
 * InventoryItem Interface
 * Matches the structure of the inventory table, focusing on fields needed for this page.
 */
interface InventoryItem {
  item_id: number;          // Auto‑generated primary key
  item_name: string;        // Name of the item (required)
  serial_number?: string;   // Optional serial number
  balance_qty?: number;     // Current stock quantity
  uom?: string;             // Unit of measure (e.g., pcs, kg)
}

// ==============================================
// COMPONENT
// ==============================================

const InventoryPage: React.FC = () => {
  // ==============================================
  // STATE VARIABLES
  // ==============================================

  // Inventory items state
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal visibility states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);

  // Form data for adding a new item
  const [itemFormData, setItemFormData] = useState({
    item_name: '',
    serial_number: '',
    balance_qty: '',
    uom: ''
  });
  const [submittingItem, setSubmittingItem] = useState(false);

  // Form data for adding a new classification (future use, but stored now)
  const [classFormData, setClassFormData] = useState({
    classification_code: '',
    classification_title: '',
    classification_description: ''
  });
  const [submittingClass, setSubmittingClass] = useState(false);

  // ==============================================
  // FETCH INVENTORY ITEMS
  // ==============================================
  /**
   * fetchItems – retrieves all inventory items from the database.
   * Fetches only the columns needed for the table view.
   */
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

  // Fetch items once when component mounts
  useEffect(() => {
    fetchItems();
  }, []);

  // ==============================================
  // ADD NEW ITEM
  // ==============================================
  /**
   * handleAddItem – validates form, inserts new item into inventory table,
   * refreshes the list, and prompts the user to stay or exit.
   */
  const handleAddItem = async () => {
    // Validate required field
    if (!itemFormData.item_name.trim()) {
      setError('Item name is required');
      return;
    }

    setSubmittingItem(true);
    setError('');

    try {
      // Prepare record for insertion
      const newItem = {
        item_name: itemFormData.item_name,
        serial_number: itemFormData.serial_number || null,
        balance_qty: itemFormData.balance_qty ? parseFloat(itemFormData.balance_qty) : null,
        uom: itemFormData.uom || null,
        // Other fields (description, classification_id, log_id) are left as NULL
      };

      const { error: insertError } = await supabase
        .from('inventory')
        .insert([newItem]);

      if (insertError) throw insertError;

      // Refresh the table with updated data
      await fetchItems();

      // Ask user whether to stay on form or return to list
      const stay = window.confirm(
        'Item added successfully!\n\nClick OK to add another item, or Cancel to return to inventory list.'
      );

      if (stay) {
        // Reset form and keep modal open
        setItemFormData({ item_name: '', serial_number: '', balance_qty: '', uom: '' });
      } else {
        // Close modal and return to main page
        setShowItemModal(false);
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error adding item:', err);
    } finally {
      setSubmittingItem(false);
    }
  };

  // ==============================================
  // ADD NEW CLASSIFICATION (hidden from view)
  // ==============================================
  /**
   * handleAddClassification – validates and inserts a new classification.
   * This will be used later when the classification module is expanded.
   */
  const handleAddClassification = async () => {
    if (!classFormData.classification_code.trim()) {
      setError('Classification code is required');
      return;
    }
    if (!classFormData.classification_title.trim()) {
      setError('Classification title is required');
      return;
    }

    setSubmittingClass(true);
    setError('');

    try {
      const newClass = {
        classification_code: classFormData.classification_code,
        classification_title: classFormData.classification_title,
        classification_description: classFormData.classification_description || null,
      };

      const { error: insertError } = await supabase
        .from('classification')
        .insert([newClass]);

      if (insertError) throw insertError;

      // Inform user and decide to stay or close
      const stay = window.confirm(
        'Classification added successfully!\n\nClick OK to add another classification, or Cancel to return.'
      );

      if (stay) {
        setClassFormData({ classification_code: '', classification_title: '', classification_description: '' });
      } else {
        setShowClassModal(false);
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error adding classification:', err);
    } finally {
      setSubmittingClass(false);
    }
  };

  // ==============================================
  // CANCEL HANDLERS
  // ==============================================
  const cancelItem = () => {
    setShowItemModal(false);
    setItemFormData({ item_name: '', serial_number: '', balance_qty: '', uom: '' });
    setError(''); // Clear any previous errors
  };

  const cancelClass = () => {
    setShowClassModal(false);
    setClassFormData({ classification_code: '', classification_title: '', classification_description: '' });
    setError('');
  };

  // ==============================================
  // RENDER
  // ==============================================
  return (
    <div className="p-6">
      {/* Page title */}
      <h1 className="text-2xl font-bold mb-6">Inventory Management</h1>

      {/* Global error display */}
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
        <>
          {/* Inventory Table Container */}
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
                        <p className="text-sm mt-1">Click the + button to add an item.</p>
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

          {/* Footer with summary and refresh button (outside the table box) */}
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
        </>
      )}

      {/* ============================================== */}
      {/* FLOATING ACTION MENU (FAB)                     */}
      {/* ============================================== */}
      <FloatingActionMenu
        options={[
          {
            label: 'Add New Item',
            icon: ItemIcon,
            onClick: () => setShowItemModal(true),
          },
          {
            label: 'Add New Classification',
            icon: CIcon,
            onClick: () => setShowClassModal(true),
          }
        ]}
        mainIcon={PlusIcon}
        mainColor="bg-primary-600"
        optionColor="bg-orange-500"
      />

      {/* ============================================== */}
      {/* MODAL: ADD NEW ITEM                            */}
      {/* ============================================== */}
      {showItemModal && (
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
                    value={itemFormData.item_name}
                    onChange={(e) => setItemFormData({ ...itemFormData, item_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                    disabled={submittingItem}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={itemFormData.serial_number}
                    onChange={(e) => setItemFormData({ ...itemFormData, serial_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={submittingItem}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Balance Quantity
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={itemFormData.balance_qty}
                    onChange={(e) => setItemFormData({ ...itemFormData, balance_qty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={submittingItem}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit of Measure (UOM)
                  </label>
                  <input
                    type="text"
                    value={itemFormData.uom}
                    onChange={(e) => setItemFormData({ ...itemFormData, uom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={submittingItem}
                    placeholder="e.g., pcs, kg, box"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={cancelItem}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={submittingItem}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingItem}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center"
                >
                  {submittingItem ? (
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

      {/* ============================================== */}
      {/* MODAL: ADD NEW CLASSIFICATION (hidden view)    */}
      {/* ============================================== */}
      {showClassModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Add New Classification</h2>

            {error && (
              <div className="mb-4 p-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {error}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleAddClassification(); }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Classification Code *
                  </label>
                  <input
                    type="text"
                    value={classFormData.classification_code}
                    onChange={(e) => setClassFormData({ ...classFormData, classification_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                    disabled={submittingClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Classification Title *
                  </label>
                  <input
                    type="text"
                    value={classFormData.classification_title}
                    onChange={(e) => setClassFormData({ ...classFormData, classification_title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                    disabled={submittingClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={classFormData.classification_description}
                    onChange={(e) => setClassFormData({ ...classFormData, classification_description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={submittingClass}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={cancelClass}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={submittingClass}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingClass}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center"
                >
                  {submittingClass ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Adding...
                    </>
                  ) : (
                    'Add Classification'
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