import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import AddNewFormModal from '../components/ui/AddNewFormModal';
import ConfirmationDialog from '../components/ui/ConfirmationDialog';
import EditPanel from '../components/ui/EditPanel';
import { EditIcon } from '../components/ui/Icons';
import {
  apiGetPurchaseOrders,
  apiCreatePurchaseOrder,
  apiGetSuppliersWithDetails,
  apiGetInventoryItems,
} from '../lib/purchaseOrderApi';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

interface PurchaseOrder {
  po_id: string;
  po_no: string;
  reference_no?: string;
  terms?: string;
  delivery_date?: string;
  supplier_id?: number;
  supplier_company_name?: string;
  supplier_register_no?: string;
  supplier_address?: string;
  supplier_phone?: string;
  supplier_email?: string;
  pr_id?: string;
  remarks?: string;
  status: string;
  total_amount?: number;
  items?: PurchaseOrderItem[];
}

interface PurchaseOrderItem {
  poi_id: number;
  item_id?: number;
  item_name: string;
  item_description: string;
  uom?: string;
  poi_quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
  received_quantity?: number;
}

interface Supplier {
  supplier_id: number;
  company_name: string;
  register_no_new?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  post_code?: string;
}

interface InventoryItem {
  item_id: number;
  item_name: string;
  description?: string;
  uom?: string;
}

// ==============================================
// COMPONENT
// ==============================================

const PurchaseOrderPage: React.FC = () => {
  const navigate = useNavigate();

  // ==============================================
  // STATE VARIABLES
  // ==============================================

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);
  const [selectedSupplierInfo, setSelectedSupplierInfo] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState({
    reference_no: '',
    supplier_id: '',
    delivery_date: '',
    remarks: '',
  });

  const [lineItems, setLineItems] = useState<PurchaseOrderItem[]>([]);

  const [currentItem, setCurrentItem] = useState({
    item_id: '',
    item_name: '',
    item_description: '',
    uom: '',
    poi_quantity: '',
    unit_price: '',
  });

  const [showEditPanel, setShowEditPanel] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [itemError, setItemError] = useState('');

  // ==============================================
  // FETCH DATA
  // ==============================================

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await apiGetPurchaseOrders();
      if (!result.success) throw new Error(result.message);
      setPurchaseOrders(result.data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching purchase orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      setLoadingDropdowns(true);
      const suppliersResult = await apiGetSuppliersWithDetails();
      if (suppliersResult.success) setSuppliers(suppliersResult.data || []);
      const itemsResult = await apiGetInventoryItems();
      if (itemsResult.success) setInventoryItems(itemsResult.data || []);
    } catch (err: any) {
      console.error('Error fetching dropdown data:', err);
    } finally {
      setLoadingDropdowns(false);
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ==============================================
  // FORM HANDLERS
  // ==============================================

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSupplierSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const supplierId = e.target.value;
    setFormData(prev => ({ ...prev, supplier_id: supplierId }));
    if (supplierId) {
      const sup = suppliers.find(s => s.supplier_id === parseInt(supplierId));
      setSelectedSupplierInfo(sup || null);
    } else {
      setSelectedSupplierInfo(null);
    }
  };

  const handleItemChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'poi_quantity' || name === 'unit_price') {
      if (value !== '' && !/^\d*\.?\d*$/.test(value)) {
        setItemError('Strictly only numeric in quantity/price');
        setCurrentItem(prev => ({ ...prev, [name]: value }));
        return;
      } else {
        setItemError('');
      }
    }
    setCurrentItem(prev => ({ ...prev, [name]: value }));
  };

  const handleItemSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const itemId = e.target.value;
    const selectedInventoryItem = inventoryItems.find(item => item.item_id === parseInt(itemId));
    if (selectedInventoryItem) {
      setCurrentItem(prev => ({
        ...prev,
        item_id: itemId,
        item_name: selectedInventoryItem.item_name,
        item_description: selectedInventoryItem.description || selectedInventoryItem.item_name,
        uom: selectedInventoryItem.uom || '',
      }));
    } else {
      setCurrentItem(prev => ({
        ...prev,
        item_id: '',
        item_name: '',
        item_description: '',
        uom: '',
      }));
    }
  };

  const handleAddItem = () => {
    if (!currentItem.item_name.trim()) {
      setItemError('Item name is required');
      return;
    }
    if (!currentItem.poi_quantity.trim()) {
      setItemError('Quantity is required');
      return;
    }
    if (!/^\d+\.?\d*$/.test(currentItem.poi_quantity)) {
      setItemError('Strictly only numeric in quantity');
      return;
    }
    const qty = parseFloat(currentItem.poi_quantity);
    if (qty <= 0) {
      setItemError('Quantity must be greater than 0');
      return;
    }

    const unitPrice = parseFloat(currentItem.unit_price) || 0;
    const lineTotal = qty * unitPrice;

    const newItem: PurchaseOrderItem = {
      poi_id: lineItems.length + 1,
      item_id: currentItem.item_id ? parseInt(currentItem.item_id) : undefined,
      item_name: currentItem.item_name,
      item_description: currentItem.item_description || currentItem.item_name,
      uom: currentItem.uom || undefined,
      poi_quantity: qty,
      unit_price: unitPrice,
      discount: 0,
      line_total: lineTotal,
    };

    setLineItems(prev => [...prev, newItem]);
    setCurrentItem({
      item_id: '',
      item_name: '',
      item_description: '',
      uom: '',
      poi_quantity: '',
      unit_price: '',
    });
    setItemError('');
  };

  const handleRemoveItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreatePO = async () => {
    if (lineItems.length === 0) {
      setError('At least one item must be added');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await apiCreatePurchaseOrder({
        reference_no: formData.reference_no || undefined,
        supplier_id: formData.supplier_id ? parseInt(formData.supplier_id) : undefined,
        delivery_date: formData.delivery_date || undefined,
        remarks: formData.remarks || undefined,
        items: lineItems.map(item => ({
          item_id: item.item_id,
          item_name: item.item_name,
          item_description: item.item_description,
          uom: item.uom,
          poi_quantity: item.poi_quantity,
          unit_price: item.unit_price,
          discount: item.discount,
        })),
      });

      if (!result.success) throw new Error(result.message);

      await fetchPurchaseOrders();
      setShowConfirm(true);
    } catch (err: any) {
      setError(err.message);
      console.error('Error creating purchase order:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ reference_no: '', supplier_id: '', delivery_date: '', remarks: '' });
    setSelectedSupplierInfo(null);
    setLineItems([]);
    setCurrentItem({
      item_id: '',
      item_name: '',
      item_description: '',
      uom: '',
      poi_quantity: '',
      unit_price: '',
      discount: '',
    });
    setItemError('');
  };

  const handleConfirmOk = () => {
    setShowConfirm(false);
    resetForm();
  };

  const handleConfirmCancel = () => {
    setShowConfirm(false);
    setShowModal(false);
  };

  const handleCancel = () => {
    setShowModal(false);
    resetForm();
    setError('');
  };

  const handleEditClick = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowEditPanel(true);
  };

  const handleEditSuccess = () => {
    fetchPurchaseOrders();
  };

  const handleBack = () => {
    navigate('/purchase');
  };

  const handleOpenModal = async () => {
    setShowModal(true);
    setShowAddMenu(false);
    await fetchDropdownData();
  };

  // ==============================================
  // HELPERS
  // ==============================================

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '—';
    return amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-MY');
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'draft':     return 'bg-yellow-100 text-yellow-800';
      case 'sent':      return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-purple-100 text-purple-800';
      case 'received':  return 'bg-green-100 text-green-800';
      default:          return 'bg-gray-100 text-gray-800';
    }
  };

  // ==============================================
  // RENDER
  // ==============================================
  return (
    <div className="flex flex-col h-full">
      {/* ============================================== */}
      {/* PAGE HEADER                                    */}
      {/* ============================================== */}
      <PageHeader title="Purchase Order" onBack={handleBack} onRefresh={fetchPurchaseOrders}>
        <div className="relative" ref={addMenuRef}>
          <button
            onClick={() => setShowAddMenu(prev => !prev)}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAddMenu && (
            <div className="absolute right-0 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-30 overflow-hidden">
              <button
                onClick={handleOpenModal}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
              >
                <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Purchase Order Form
              </button>
            </div>
          )}
        </div>
      </PageHeader>

      {/* ============================================== */}
      {/* MAIN CONTENT AREA                              */}
      {/* ============================================== */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
            <div className="font-medium">Error</div>
            <div className="text-sm mt-1">{error}</div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="ml-3 text-gray-600">Loading purchase orders...</span>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total (RM)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {purchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <p className="mt-2">No purchase orders found</p>
                        <p className="text-sm mt-1">Click the "Add New" button above to create a purchase order.</p>
                      </td>
                    </tr>
                  ) : (
                    purchaseOrders.map(po => (
                      <tr key={po.po_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900 font-medium">
                          {po.po_no}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {po.reference_no || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {po.supplier_company_name || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(po.delivery_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {po.items?.length || 0} item(s)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatCurrency(po.total_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(po.status)}`}>
                            {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => handleEditClick(po)}
                            className="text-primary-600 hover:text-primary-800 transition-colors"
                            title="Edit purchase order"
                          >
                            <EditIcon className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ============================================== */}
      {/* CREATE PURCHASE ORDER MODAL                    */}
      {/* ============================================== */}
      <AddNewFormModal
        isOpen={showModal}
        title="Create New Purchase Order Form"
        onClose={handleCancel}
        maxWidth="max-w-2xl"
      >
        {/* ============================================== */}
        {/* SECTION 1: PO HEADER INFORMATION              */}
        {/* ============================================== */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase Order Details</h3>

          <div className="space-y-4">
            {/* Reference Number (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
              <input
                type="text"
                name="reference_no"
                value={formData.reference_no}
                onChange={handleFormChange}
                placeholder="Enter reference number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Delivery Date (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
              <input
                type="date"
                name="delivery_date"
                value={formData.delivery_date}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Supplier Selection (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <select
                name="supplier_id"
                value={formData.supplier_id}
                onChange={handleSupplierSelect}
                disabled={loadingDropdowns}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{loadingDropdowns ? 'Loading suppliers...' : 'Select a supplier'}</option>
                {suppliers.map(supplier => (
                  <option key={supplier.supplier_id} value={supplier.supplier_id}>
                    {supplier.register_no_new
                      ? `${supplier.company_name}(${supplier.register_no_new})`
                      : supplier.company_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Supplier detail card – shown when a supplier is selected */}
            {selectedSupplierInfo && (
              <div className="space-y-3 bg-gray-50 p-4 rounded-md border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier Details</p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier ID</label>
                  <input type="text" value={selectedSupplierInfo.supplier_id} readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Register No</label>
                  <input type="text" value={selectedSupplierInfo.register_no_new || ''} readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="text" value={selectedSupplierInfo.email || ''} readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" value={selectedSupplierInfo.phone || ''} readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    value={[
                      selectedSupplierInfo.address,
                      selectedSupplierInfo.city,
                      selectedSupplierInfo.state,
                      selectedSupplierInfo.country,
                      selectedSupplierInfo.post_code,
                    ].filter(Boolean).join(', ')}
                    readOnly
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                  />
                </div>
              </div>
            )}

            {/* Remarks (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleFormChange}
                placeholder="Enter any additional remarks or notes"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* ============================================== */}
        {/* SECTION 2: ADD ITEMS TO PURCHASE ORDER        */}
        {/* ============================================== */}
        <div className="border-b pb-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Items</h3>

          <div className="space-y-4 bg-gray-50 p-4 rounded-md">
            {/* Item Selection Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
              <select
                value={currentItem.item_id}
                onChange={handleItemSelect}
                disabled={loadingDropdowns}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{loadingDropdowns ? 'Loading items...' : 'Select an item'}</option>
                {inventoryItems.map(item => (
                  <option key={item.item_id} value={item.item_id}>{item.item_name}</option>
                ))}
              </select>
            </div>

            {/* Item Description (read-only, auto-filled) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Description</label>
              <textarea
                name="item_description"
                value={currentItem.item_description}
                placeholder="Auto-filled from selected item"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 focus:outline-none"
                readOnly
              />
            </div>

            {/* UOM (read-only, auto-filled) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure (UOM)</label>
              <input
                type="text"
                name="uom"
                value={currentItem.uom}
                placeholder="Auto-filled from selected item"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 focus:outline-none"
                readOnly
              />
            </div>

            {/* Pricing row */}
            <div className="grid grid-cols-3 gap-3">
              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="poi_quantity"
                  value={currentItem.poi_quantity}
                  onChange={handleItemChange}
                  placeholder="0"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${itemError ? 'border-red-500' : 'border-gray-300'}`}
                />
              </div>

              {/* Unit Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (RM)</label>
                <input
                  type="text"
                  name="unit_price"
                  value={currentItem.unit_price}
                  onChange={handleItemChange}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Line Total (read-only, auto-calculated) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Line Total (RM)</label>
                <input
                  type="text"
                  value={formatCurrency(
                    (parseFloat(currentItem.poi_quantity) || 0) *
                    (parseFloat(currentItem.unit_price) || 0)
                  )}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>

            {itemError && <p className="text-red-600 text-sm">{itemError}</p>}

            <button
              onClick={handleAddItem}
              className="w-full mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors font-medium"
            >
              Add Item to Order
            </button>
          </div>
        </div>

        {/* ============================================== */}
        {/* SECTION 3: ITEMS ADDED TO ORDER               */}
        {/* ============================================== */}
        <div className="border-b pb-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Items in Order ({lineItems.length})
          </h3>

          {lineItems.length > 0 ? (
            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-md flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.item_name}</p>
                    <p className="text-sm text-gray-600 mt-1">{item.item_description}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                      {item.uom && <span>UOM: <strong>{item.uom}</strong></span>}
                      <span>Qty: <strong>{item.poi_quantity}</strong></span>
                      <span>Unit Price: <strong>RM {formatCurrency(item.unit_price)}</strong></span>
                      <span>Line Total: <strong>RM {formatCurrency(item.line_total)}</strong></span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="ml-4 text-red-600 hover:text-red-800 transition-colors"
                    title="Remove item"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))}

            </div>
          ) : (
            <p className="text-gray-500 text-sm">No items added yet. Add items above to get started.</p>
          )}
        </div>

        {/* ============================================== */}
        {/* SECTION 4: FORM ACTIONS                       */}
        {/* ============================================== */}
        <div className="flex justify-between items-center pt-4 border-t mt-6">
          {/* Total Amount – read-only, auto-summed from all line items */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Total Amount:</span>
            <input
              type="text"
              value={`RM ${formatCurrency(lineItems.reduce((sum, i) => sum + i.line_total, 0))}`}
              readOnly
              className="px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed text-sm font-semibold w-36 text-right"
            />
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePO}
              disabled={submitting || lineItems.length === 0}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </AddNewFormModal>

      {/* ============================================== */}
      {/* SUCCESS CONFIRMATION DIALOG                    */}
      {/* ============================================== */}
      <ConfirmationDialog
        isOpen={showConfirm}
        message="Purchase Order created successfully. Click **OK** to continue adding more or **Cancel** to return to the main page."
        onConfirm={handleConfirmOk}
        onCancel={handleConfirmCancel}
      />

      {/* ============================================== */}
      {/* EDIT PANEL: PURCHASE ORDER                     */}
      {/* ============================================== */}
      <EditPanel
        isOpen={showEditPanel}
        onClose={() => setShowEditPanel(false)}
        entityType="purchase_order"
        data={selectedPO}
        onUpdate={handleEditSuccess}
      />
    </div>
  );
};

export default PurchaseOrderPage;
