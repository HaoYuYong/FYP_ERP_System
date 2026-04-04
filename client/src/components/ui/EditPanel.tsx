import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { apiUpdateInventoryItem, apiDeleteInventoryItem, apiGetClassifications } from '../../lib/inventoryApi';
import { apiUpdateCustomer, apiDeleteCustomer } from '../../lib/customerApi';
import { apiUpdateSupplier, apiDeleteSupplier } from '../../lib/supplierApi';
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

  // Current active tab (different sets for inventory vs customer/supplier)
  const [activeTab, setActiveTab] = useState<'main' | 'quantity' | 'classification' | 'bank' | 'contact' | 'tax' | 'liabilities'>('main');

  // Form data for main fields (inventory/customer/supplier)
  const [mainData, setMainData] = useState<any>({});

  // Inventory-specific states
  const [quantityData, setQuantityData] = useState<any>({});
  const [loadingQuantity, setLoadingQuantity] = useState(false);
  const [classifications, setClassifications] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedClassTitle, setSelectedClassTitle] = useState('');
  const [selectedClassDesc, setSelectedClassDesc] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Customer/Supplier related data
  const [bankData, setBankData] = useState<any>(null);
  const [contactData, setContactData] = useState<any>(null);
  const [taxData, setTaxData] = useState<any>(null);
  const [liabilitiesData, setLiabilitiesData] = useState<any>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Confirmation dialog for delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ==============================================
  // EFFECTS – Load data when panel opens
  // ==============================================
  useEffect(() => {
    if (isOpen && data) {
      // Set main data (common for all types)
      setMainData({ ...data });

      if (entityType === 'inventory') {
        // Fetch quantity record for this item
        fetchQuantity(data.item_id);
        // Fetch all classifications for dropdown
        fetchClassifications();
        // Set selected classification from inventory data
        setSelectedClassId(data.classification_id || null);
        // Pre-fill classification title/desc if available
        if (data.classification) {
          setSelectedClassTitle(data.classification.classification_title);
          setSelectedClassDesc(data.classification.classification_description);
        }
      } else if (entityType === 'customer' || entityType === 'supplier') {
        // Fetch related records (bank, contact, tax, liabilities) using foreign keys
        fetchRelatedData();
      }
    }
  }, [isOpen, data, entityType]);

  // Fetch quantity for the item (inventory only)
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

  // Fetch all classifications for dropdown (inventory only, read-only from API)
  const fetchClassifications = async () => {
    try {
      setLoadingClasses(true);
      const result = await apiGetClassifications();
      if (result.success) {
        setClassifications(result.data || []);
      } else {
        console.error('Error fetching classifications:', result.message);
      }
    } catch (err: any) {
      console.error('Error fetching classifications:', err);
    } finally {
      setLoadingClasses(false);
    }
  };

  // Fetch related records for customer/supplier (bank, contact, tax, liabilities)
  const fetchRelatedData = async () => {
    setLoadingRelated(true);
    try {
      // Fetch bank account
      if (data.bank_id) {
        const { data: bank, error } = await supabase
          .from('bank_acc')
          .select('*')
          .eq('bank_id', data.bank_id)
          .maybeSingle();
        if (!error) setBankData(bank || {});
      } else {
        setBankData({});
      }

      // Fetch contact info
      if (data.contact_id) {
        const { data: contact, error } = await supabase
          .from('contact_info')
          .select('*')
          .eq('contact_id', data.contact_id)
          .maybeSingle();
        if (!error) setContactData(contact || {});
      } else {
        setContactData({});
      }

      // Fetch tax
      if (data.tax_id) {
        const { data: tax, error } = await supabase
          .from('tax')
          .select('*')
          .eq('tax_id', data.tax_id)
          .maybeSingle();
        if (!error) setTaxData(tax || {});
      } else {
        setTaxData({});
      }

      // Fetch liabilities
      if (data.liabilities_id) {
        const { data: liabilities, error } = await supabase
          .from('liabilities')
          .select('*')
          .eq('liabilities_id', data.liabilities_id)
          .maybeSingle();
        if (!error) setLiabilitiesData(liabilities || {});
      } else {
        setLiabilitiesData({});
      }
    } catch (err: any) {
      console.error('Error fetching related data:', err);
    } finally {
      setLoadingRelated(false);
    }
  };

  // When classification selection changes, update title/desc (inventory only)
  const handleClassificationChange = (classId: number) => {
    setSelectedClassId(classId);
    const selected = classifications.find(c => c.classification_id === classId);
    setSelectedClassTitle(selected?.classification_title || '');
    setSelectedClassDesc(selected?.classification_description || '');
  };

  // ==============================================
  // UPSERT HELPER FOR RELATED TABLES (customer/supplier)
  // ==============================================
  /**
   * upsertRecord – inserts or updates a related record (bank, contact, tax, liabilities)
   * and returns the new ID. If no ID exists, it inserts and updates the main table's foreign key.
   */
  const upsertRecord = async (table: string, idField: string, idValue: number | null, recordData: any, mainIdName: string, mainIdValue: number) => {
    if (!recordData || Object.keys(recordData).length === 0) return null;

    if (idValue) {
      // Update existing record
      const { error } = await supabase
        .from(table)
        .update(recordData)
        .eq(idField, idValue);
      if (error) throw error;
      return idValue;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from(table)
        .insert([recordData])
        .select();
      if (error) throw error;
      const newId = data?.[0]?.[idField];
      // Update main table with new foreign key
      const { error: updateError } = await supabase
        .from(entityType === 'customer' ? 'customer' : 'supplier')
        .update({ [mainIdName]: newId })
        .eq(entityType === 'customer' ? 'customer_id' : 'supplier_id', mainIdValue);
      if (updateError) throw updateError;
      return newId;
    }
  };

  // ==============================================
  // UPDATE HANDLER
  // ==============================================
  const handleUpdate = async () => {
    setLoading(true);
    setError('');

    try {
      if (entityType === 'inventory') {
        // Call backend API (automatically creates log entry)
        const result = await apiUpdateInventoryItem({
          item_id: data.item_id,
          item_name: mainData.item_name,
          serial_number: mainData.serial_number || undefined,
          balance_qty: mainData.balance_qty ? parseFloat(mainData.balance_qty) : undefined,
          uom: mainData.uom || undefined,
          description: mainData.description || undefined,
          classification_id: selectedClassId || undefined,
        });

        if (!result.success) {
          throw new Error(result.message || 'Failed to update item');
        }
      } else if (entityType === 'customer') {
        // Call backend API for customer (automatically creates log entry)
        const result = await apiUpdateCustomer({
          customer_id: data.customer_id,
          company_name: mainData.company_name,
          control_ac: mainData.control_ac,
          branch_name: mainData.branch_name,
          industry_name: mainData.industry_name,
          industry_code: mainData.industry_code,
          register_no_new: mainData.register_no_new,
          register_no_old: mainData.register_no_old,
          status: mainData.status,
        });

        if (!result.success) throw new Error(result.message || 'Failed to update customer');

        // Handle related tables via Supabase (keep frontend for related data)
        if (bankData) {
          const newBankId = await upsertRecord('bank_acc', 'bank_id', data.bank_id, bankData, 'bank_id', data.customer_id);
          if (newBankId !== data.bank_id) data.bank_id = newBankId;
        }
        if (contactData) {
          const newContactId = await upsertRecord('contact_info', 'contact_id', data.contact_id, contactData, 'contact_id', data.customer_id);
          if (newContactId !== data.contact_id) data.contact_id = newContactId;
        }
        if (taxData) {
          const newTaxId = await upsertRecord('tax', 'tax_id', data.tax_id, taxData, 'tax_id', data.customer_id);
          if (newTaxId !== data.tax_id) data.tax_id = newTaxId;
        }
        if (liabilitiesData) {
          const newLiabId = await upsertRecord('liabilities', 'liabilities_id', data.liabilities_id, liabilitiesData, 'liabilities_id', data.customer_id);
          if (newLiabId !== data.liabilities_id) data.liabilities_id = newLiabId;
        }
      } else if (entityType === 'supplier') {
        // Call backend API for supplier (automatically creates log entry)
        const result = await apiUpdateSupplier({
          supplier_id: data.supplier_id,
          company_name: mainData.company_name,
          control_ac: mainData.control_ac,
          branch_name: mainData.branch_name,
          industry_name: mainData.industry_name,
          industry_code: mainData.industry_code,
          register_no_new: mainData.register_no_new,
          register_no_old: mainData.register_no_old,
          status: mainData.status,
        });

        if (!result.success) throw new Error(result.message || 'Failed to update supplier');

        // Handle related tables via Supabase (keep frontend for related data)
        if (bankData) {
          const newBankId = await upsertRecord('bank_acc', 'bank_id', data.bank_id, bankData, 'bank_id', data.supplier_id);
          if (newBankId !== data.bank_id) data.bank_id = newBankId;
        }
        if (contactData) {
          const newContactId = await upsertRecord('contact_info', 'contact_id', data.contact_id, contactData, 'contact_id', data.supplier_id);
          if (newContactId !== data.contact_id) data.contact_id = newContactId;
        }
        if (taxData) {
          const newTaxId = await upsertRecord('tax', 'tax_id', data.tax_id, taxData, 'tax_id', data.supplier_id);
          if (newTaxId !== data.tax_id) data.tax_id = newTaxId;
        }
        if (liabilitiesData) {
          const newLiabId = await upsertRecord('liabilities', 'liabilities_id', data.liabilities_id, liabilitiesData, 'liabilities_id', data.supplier_id);
          if (newLiabId !== data.liabilities_id) data.liabilities_id = newLiabId;
        }
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
        // Call backend API (automatically creates log entry)
        const result = await apiDeleteInventoryItem(data.item_id);
        if (!result.success) {
          throw new Error(result.message || 'Failed to delete item');
        }
      } else if (entityType === 'customer') {
        // Call backend API for customer delete (automatically creates log entry)
        const result = await apiDeleteCustomer(data.customer_id);
        if (!result.success) throw new Error(result.message || 'Failed to delete customer');
      } else if (entityType === 'supplier') {
        // Call backend API for supplier delete (automatically creates log entry)
        const result = await apiDeleteSupplier(data.supplier_id);
        if (!result.success) throw new Error(result.message || 'Failed to delete supplier');
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

  const isInventory = entityType === 'inventory';
  const isCustomerSupplier = entityType === 'customer' || entityType === 'supplier';

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
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

          {/* Tabs (different sets for inventory vs customer/supplier) */}
          <div className="border-b border-gray-200 mb-4">
            <nav className="-mb-px flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('main')}
                className={`py-2 px-4 border-b-2 font-medium text-sm ${
                  activeTab === 'main'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Main
              </button>
              {isInventory && (
                <>
                  <button
                    onClick={() => setActiveTab('quantity')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${
                      activeTab === 'quantity'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Quantity
                  </button>
                  <button
                    onClick={() => setActiveTab('classification')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${
                      activeTab === 'classification'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Classification
                  </button>
                </>
              )}
              {isCustomerSupplier && (
                <>
                  <button
                    onClick={() => setActiveTab('bank')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${
                      activeTab === 'bank'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Bank Acc
                  </button>
                  <button
                    onClick={() => setActiveTab('contact')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${
                      activeTab === 'contact'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Contact Info
                  </button>
                  <button
                    onClick={() => setActiveTab('tax')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${
                      activeTab === 'tax'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Tax
                  </button>
                  <button
                    onClick={() => setActiveTab('liabilities')}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${
                      activeTab === 'liabilities'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Liabilities
                  </button>
                </>
              )}
            </nav>
          </div>

          {/* Form content */}
          <div className="space-y-4">
            {/* MAIN TAB (common for all) */}
            {activeTab === 'main' && (
              <div className="space-y-4">
                {isInventory && (
                  <>
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
                  </>
                )}
                {isCustomerSupplier && (
                  <>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Control Account</label>
                      <input
                        type="text"
                        value={mainData.control_ac || ''}
                        onChange={(e) => setMainData({ ...mainData, control_ac: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name</label>
                      <input
                        type="text"
                        value={mainData.branch_name || ''}
                        onChange={(e) => setMainData({ ...mainData, branch_name: e.target.value })}
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Register No (Old)</label>
                      <input
                        type="text"
                        value={mainData.register_no_old || ''}
                        onChange={(e) => setMainData({ ...mainData, register_no_old: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <input
                        type="text"
                        value={mainData.status || ''}
                        onChange={(e) => setMainData({ ...mainData, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* INVENTORY QUANTITY TAB */}
            {isInventory && activeTab === 'quantity' && (
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

            {/* INVENTORY CLASSIFICATION TAB */}
            {isInventory && activeTab === 'classification' && (
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

            {/* BANK ACC TAB (customer/supplier) */}
            {isCustomerSupplier && activeTab === 'bank' && (
              <div className="space-y-4">
                {loadingRelated ? (
                  <div className="text-center py-4">Loading bank data...</div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={bankData?.bank_name || ''}
                        onChange={(e) => setBankData({ ...bankData, bank_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                      <input
                        type="text"
                        value={bankData?.acc_no || ''}
                        onChange={(e) => setBankData({ ...bankData, acc_no: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                      <input
                        type="text"
                        value={bankData?.acc_name || ''}
                        onChange={(e) => setBankData({ ...bankData, acc_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                      <input
                        type="text"
                        value={bankData?.ref || ''}
                        onChange={(e) => setBankData({ ...bankData, ref: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <input
                        type="text"
                        value={bankData?.status || ''}
                        onChange={(e) => setBankData({ ...bankData, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* CONTACT INFO TAB (customer/supplier) */}
            {isCustomerSupplier && activeTab === 'contact' && (
              <div className="space-y-4">
                {loadingRelated ? (
                  <div className="text-center py-4">Loading contact data...</div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={contactData?.email || ''}
                        onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="text"
                        value={contactData?.phone || ''}
                        onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <textarea
                        value={contactData?.address || ''}
                        onChange={(e) => setContactData({ ...contactData, address: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                      <input
                        type="text"
                        value={contactData?.country || ''}
                        onChange={(e) => setContactData({ ...contactData, country: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        value={contactData?.city || ''}
                        onChange={(e) => setContactData({ ...contactData, city: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input
                        type="text"
                        value={contactData?.state || ''}
                        onChange={(e) => setContactData({ ...contactData, state: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Post Code</label>
                      <input
                        type="text"
                        value={contactData?.post_code || ''}
                        onChange={(e) => setContactData({ ...contactData, post_code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAX TAB (customer/supplier) */}
            {isCustomerSupplier && activeTab === 'tax' && (
            <div className="space-y-4">
                {loadingRelated ? (
                <div className="text-center py-4">Loading tax data...</div>
                ) : (
                <>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">BRN</label>
                    <input
                        type="text"
                        value={taxData?.brn || ''}
                        onChange={(e) => setTaxData({ ...taxData, brn: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                    />
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">TIN</label>
                    <input
                        type="text"
                        value={taxData?.tin || ''}
                        onChange={(e) => setTaxData({ ...taxData, tin: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                    />
                    </div>
                </>
                )}
            </div>
            )}

            {/* LIABILITIES TAB (customer/supplier) */}
            {isCustomerSupplier && activeTab === 'liabilities' && (
              <div className="space-y-4">
                {loadingRelated ? (
                  <div className="text-center py-4">Loading liabilities data...</div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Credit Terms</label>
                      <input
                        type="text"
                        value={liabilitiesData?.credit_terms || ''}
                        onChange={(e) => setLiabilitiesData({ ...liabilitiesData, credit_terms: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit</label>
                      <input
                        type="number"
                        step="any"
                        value={liabilitiesData?.credit_limit || ''}
                        onChange={(e) => setLiabilitiesData({ ...liabilitiesData, credit_limit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Allow Exceed Credit Limit</label>
                      <select
                        value={liabilitiesData?.allow_exceed_credit_limit ? 'true' : 'false'}
                        onChange={(e) => setLiabilitiesData({ ...liabilitiesData, allow_exceed_credit_limit: e.target.value === 'true' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                      <input
                        type="date"
                        value={liabilitiesData?.invoice_date || ''}
                        onChange={(e) => setLiabilitiesData({ ...liabilitiesData, invoice_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
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