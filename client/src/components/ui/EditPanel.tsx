import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import ConfirmationDialog from './ConfirmationDialog';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

// Generic type for any entity data
interface EditPanelProps {
  isOpen: boolean;                    // Whether panel is visible
  onClose: () => void;                // Close panel (without saving)
  entityType: 'inventory' | 'customer' | 'supplier'; // Type of entity being edited
  data: any;                          // Current entity data (from table row)
  onUpdate: () => void;               // Callback after successful update
  onDelete: () => void;               // Callback after successful delete
}

// ==============================================
// COMPONENT
// ==============================================

const EditPanel: React.FC<EditPanelProps> = ({
  isOpen,
  onClose,
  entityType,
  data,
  onUpdate,
  onDelete,
}) => {
  // ==============================================
  // STATE
  // ==============================================

  // Current active tab (for inventory only)
  const [activeTab, setActiveTab] = useState<'main' | 'quantity' | 'classification'>('main');

  // Form data for main fields (inventory/customer/supplier)
  const [mainData, setMainData] = useState<any>({});

  // Quantity data (for inventory)
  const [quantityData, setQuantityData] = useState<any>({});
  const [loadingQuantity, setLoadingQuantity] = useState(false);

  // Classification data (for inventory)
  const [classifications, setClassifications] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedClassTitle, setSelectedClassTitle] = useState('');
  const [selectedClassDesc, setSelectedClassDesc] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Confirmation dialog for delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ==============================================
  // EFFECTS
  // ==============================================

  // Load data when panel opens
  useEffect(() => {
    if (isOpen && data) {
      // Set main data
      setMainData({ ...data });

      if (entityType === 'inventory') {
        // Fetch quantity record for this item
        fetchQuantity(data.item_id);
        // Fetch all classifications
        fetchClassifications();
        // Set selected classification from inventory data
        setSelectedClassId(data.classification_id || null);
        // Pre-fill classification title/desc if available
        if (data.classification) {
          setSelectedClassTitle(data.classification.classification_title);
          setSelectedClassDesc(data.classification.classification_description);
        }
      }
    }
  }, [isOpen, data, entityType]);

  // Fetch quantity for the item
  const fetchQuantity = async (itemId: number) => {
    try {
      setLoadingQuantity(true);
      const { data: qtyData, error } = await supabase
        .from('quantity')
        .select('*')
        .eq('item_id', itemId)
        .maybeSingle(); // there might be zero or one

      if (error) throw error;
      setQuantityData(qtyData || {});
    } catch (err: any) {
      console.error('Error fetching quantity:', err);
    } finally {
      setLoadingQuantity(false);
    }
  };

  // Fetch all classifications for dropdown
  const fetchClassifications = async () => {
    try {
      setLoadingClasses(true);
      const { data, error } = await supabase
        .from('classification')
        .select('classification_id, classification_code, classification_title, classification_description')
        .order('classification_code');

      if (error) throw error;
      setClassifications(data || []);
    } catch (err: any) {
      console.error('Error fetching classifications:', err);
    } finally {
      setLoadingClasses(false);
    }
  };

  // When classification selection changes, update title/desc
  const handleClassificationChange = (classId: number) => {
    setSelectedClassId(classId);
    const selected = classifications.find(c => c.classification_id === classId);
    setSelectedClassTitle(selected?.classification_title || '');
    setSelectedClassDesc(selected?.classification_description || '');
  };

  // ==============================================
  // UPDATE HANDLER
  // ==============================================
  const handleUpdate = async () => {
    setLoading(true);
    setError('');

    try {
      if (entityType === 'inventory') {
        // Update inventory table
        const { error: updateError } = await supabase
          .from('inventory')
          .update({
            item_name: mainData.item_name,
            serial_number: mainData.serial_number || null,
            balance_qty: mainData.balance_qty ? parseFloat(mainData.balance_qty) : null,
            uom: mainData.uom || null,
            description: mainData.description || null,
            classification_id: selectedClassId,
          })
          .eq('item_id', data.item_id);

        if (updateError) throw updateError;

        // Update quantity table (if exists)
        if (quantityData.quantity_id) {
          const { error: qtyError } = await supabase
            .from('quantity')
            .update({
              quantity: quantityData.quantity,
              invoice_id: quantityData.invoice_id,
            })
            .eq('quantity_id', quantityData.quantity_id);
          if (qtyError) throw qtyError;
        } else if (quantityData.quantity !== undefined) {
          // Create new quantity record
          const { error: qtyError } = await supabase
            .from('quantity')
            .insert({
              item_id: data.item_id,
              quantity: quantityData.quantity,
              invoice_id: quantityData.invoice_id,
            });
          if (qtyError) throw qtyError;
        }
      } else if (entityType === 'customer') {
        // Update customer table
        const { error } = await supabase
          .from('customer')
          .update({
            company_name: mainData.company_name,
            industry_name: mainData.industry_name || null,
            industry_code: mainData.industry_code || null,
            register_no_new: mainData.register_no_new || null,
          })
          .eq('customer_id', data.customer_id);
        if (error) throw error;
      } else if (entityType === 'supplier') {
        // Update supplier table
        const { error } = await supabase
          .from('supplier')
          .update({
            company_name: mainData.company_name,
            industry_name: mainData.industry_name || null,
            industry_code: mainData.industry_code || null,
            register_no_new: mainData.register_no_new || null,
          })
          .eq('supplier_id', data.supplier_id);
        if (error) throw error;
      }

      // Refresh parent list
      onUpdate();
      // Close panel
      onClose();
    } catch (err: any) {
      setError(err.message);
      console.error('Update error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ==============================================
  // DELETE HANDLER
  // ==============================================
  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setLoading(true);
    setError('');

    try {
      if (entityType === 'inventory') {
        // Delete from inventory (cascade should handle quantity)
        const { error } = await supabase
          .from('inventory')
          .delete()
          .eq('item_id', data.item_id);
        if (error) throw error;
      } else if (entityType === 'customer') {
        const { error } = await supabase
          .from('customer')
          .delete()
          .eq('customer_id', data.customer_id);
        if (error) throw error;
      } else if (entityType === 'supplier') {
        const { error } = await supabase
          .from('supplier')
          .delete()
          .eq('supplier_id', data.supplier_id);
        if (error) throw error;
      }

      onDelete(); // Refresh list
      onClose();  // Close panel
    } catch (err: any) {
      setError(err.message);
      console.error('Delete error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ==============================================
  // RENDER
  // ==============================================
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Edit {entityType === 'inventory' ? 'Item' : entityType === 'customer' ? 'Customer' : 'Supplier'}
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
              <div className="font-medium">Error</div>
              <div className="text-sm mt-1">{error}</div>
            </div>
          )}

          {/* Tabs (only for inventory) */}
          {entityType === 'inventory' && (
            <div className="border-b border-gray-200 mb-4">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('main')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'main'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Main
                </button>
                <button
                  onClick={() => setActiveTab('quantity')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'quantity'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Quantity
                </button>
                <button
                  onClick={() => setActiveTab('classification')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'classification'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Classification
                </button>
              </nav>
            </div>
          )}

          {/* Form content */}
          <div className="space-y-4">
            {/* MAIN TAB – inventory fields */}
            {(entityType === 'inventory' && activeTab === 'main') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                  <input
                    type="text"
                    value={mainData.item_name || ''}
                    onChange={(e) => setMainData({ ...mainData, item_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={mainData.serial_number || ''}
                    onChange={(e) => setMainData({ ...mainData, serial_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Balance Quantity</label>
                  <input
                    type="number"
                    step="any"
                    value={mainData.balance_qty || ''}
                    onChange={(e) => setMainData({ ...mainData, balance_qty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UOM</label>
                  <input
                    type="text"
                    value={mainData.uom || ''}
                    onChange={(e) => setMainData({ ...mainData, uom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                    placeholder="e.g., pcs, kg, box"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={mainData.description || ''}
                    onChange={(e) => setMainData({ ...mainData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* QUANTITY TAB */}
            {(entityType === 'inventory' && activeTab === 'quantity') && (
              <div className="space-y-4">
                {loadingQuantity ? (
                  <div className="text-center py-4">Loading quantity data...</div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        step="any"
                        value={quantityData.quantity || ''}
                        onChange={(e) => setQuantityData({ ...quantityData, quantity: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Invoice ID</label>
                      <input
                        type="text"
                        value={quantityData.invoice_id || ''}
                        onChange={(e) => setQuantityData({ ...quantityData, invoice_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* CLASSIFICATION TAB */}
            {(entityType === 'inventory' && activeTab === 'classification') && (
              <div className="space-y-4">
                {loadingClasses ? (
                  <div className="text-center py-4">Loading classifications...</div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Classification Code</label>
                      <select
                        value={selectedClassId || ''}
                        onChange={(e) => handleClassificationChange(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      >
                        <option value="">None</option>
                        {classifications.map(cls => (
                          <option key={cls.classification_id} value={cls.classification_id}>
                            {cls.classification_code} - {cls.classification_title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Classification Title</label>
                      <input
                        type="text"
                        value={selectedClassTitle}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={selectedClassDesc}
                        readOnly
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* CUSTOMER / SUPPLIER FIELDS */}
            {(entityType === 'customer' || entityType === 'supplier') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                  <input
                    type="text"
                    value={mainData.company_name || ''}
                    onChange={(e) => setMainData({ ...mainData, company_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry Name</label>
                  <input
                    type="text"
                    value={mainData.industry_name || ''}
                    onChange={(e) => setMainData({ ...mainData, industry_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry Code</label>
                  <input
                    type="text"
                    value={mainData.industry_code || ''}
                    onChange={(e) => setMainData({ ...mainData, industry_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Register No (New)</label>
                  <input
                    type="text"
                    value={mainData.register_no_new || ''}
                    onChange={(e) => setMainData({ ...mainData, register_no_new: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              disabled={loading}
            >
              Delete
            </button>
            <button
              onClick={handleUpdate}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Updating...
                </>
              ) : (
                'Update'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        message="Are you sure you want to delete this item? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
};

export default EditPanel;