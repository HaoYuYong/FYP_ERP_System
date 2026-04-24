import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import AddNewFormModal from '../components/ui/AddNewFormModal';
import ConfirmationDialog from '../components/ui/ConfirmationDialog';
import EditPanel from '../components/ui/EditPanel';
import { EditIcon } from '../components/ui/Icons';
import {
  apiGetDeliveryOrders,
  apiCreateDeliveryOrder,
  apiGetDOCustomersWithDetails,
  apiGetDOInventoryItems,
} from '../lib/deliveryOrderApi';
import { apiGetProformaInvoices } from '../lib/proformaInvoiceApi';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

interface DeliveryOrder {
  do_id: string;
  do_no: string;
  reference_no: string;
  terms?: string;
  delivery_date?: string;
  customer_id?: number;
  customer_company_name?: string;
  customer_register_no?: string;
  customer_address?: string;
  customer_phone?: string;
  customer_email?: string;
  pi_id?: string;
  remarks?: string;
  status: string;
  total_amount: number;
  created_at?: string;
  items?: DeliveryOrderItem[];
}

interface DeliveryOrderItem {
  doi_id: number;
  item_id?: number;
  item_name: string;
  item_description: string;
  uom?: string;
  do_quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
}

interface Customer {
  customer_id: number;
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
// HELPERS
// ==============================================

const formatCurrency = (v: number) =>
  v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ==============================================
// COMPONENT
// ==============================================

const DeliveryOrderPage: React.FC = () => {
  const navigate = useNavigate();

  // ==============================================
  // STATE VARIABLES
  // ==============================================

  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);
  const [selectedCustomerInfo, setSelectedCustomerInfo] = useState<Customer | null>(null);

  const [formData, setFormData] = useState({
    reference_no: '',
    customer_id: '',
    terms: '',
    delivery_date: '',
    remarks: '',
  });

  const [lineItems, setLineItems] = useState<DeliveryOrderItem[]>([]);

  const [currentItem, setCurrentItem] = useState({
    item_id: '',
    item_name: '',
    item_description: '',
    uom: '',
    do_quantity: '',
    unit_price: '',
  });

  const [showEditPanel, setShowEditPanel] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [itemError, setItemError] = useState('');

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [piList, setPiList] = useState<any[]>([]);
  const [selectedPiId, setSelectedPiId] = useState<string>('');
  const [loadingPIs, setLoadingPIs] = useState(false);
  const [generatingDO, setGeneratingDO] = useState(false);

  // ==============================================
  // COMPUTED VALUES
  // ==============================================

  const computedLineTotal = (): number => {
    const qty = parseFloat(currentItem.do_quantity) || 0;
    const price = parseFloat(currentItem.unit_price) || 0;
    return qty * price;
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + item.line_total, 0);

  // ==============================================
  // FETCH DATA
  // ==============================================

  const fetchDeliveryOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await apiGetDeliveryOrders();
      if (!result.success) throw new Error(result.message);
      setDeliveryOrders(result.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      setLoadingDropdowns(true);
      const [customersResult, itemsResult] = await Promise.all([
        apiGetDOCustomersWithDetails(),
        apiGetDOInventoryItems(),
      ]);
      if (customersResult.success) setCustomers(customersResult.data || []);
      if (itemsResult.success) setInventoryItems(itemsResult.data || []);
    } catch (err: any) {
      console.error('Error fetching dropdown data:', err);
    } finally {
      setLoadingDropdowns(false);
    }
  };

  useEffect(() => {
    fetchDeliveryOrders();
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

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value;
    setFormData(prev => ({ ...prev, customer_id: customerId }));
    if (customerId) {
      const cust = customers.find(c => c.customer_id === parseInt(customerId));
      setSelectedCustomerInfo(cust || null);
    } else {
      setSelectedCustomerInfo(null);
    }
  };

  const handleItemChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'do_quantity' || name === 'unit_price') {
      if (value !== '' && !/^\d*\.?\d*$/.test(value)) {
        setItemError('Strictly only numeric values allowed');
        return;
      } else {
        setItemError('');
      }
    }

    setCurrentItem(prev => ({ ...prev, [name]: value }));
  };

  const handleItemSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const itemId = e.target.value;
    const selected = inventoryItems.find(item => item.item_id === parseInt(itemId));

    if (selected) {
      setCurrentItem(prev => ({
        ...prev,
        item_id: itemId,
        item_name: selected.item_name,
        item_description: selected.description || selected.item_name,
        uom: selected.uom || '',
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
    if (!currentItem.do_quantity.trim()) {
      setItemError('Quantity is required');
      return;
    }
    if (!/^\d+\.?\d*$/.test(currentItem.do_quantity)) {
      setItemError('Strictly only numeric in quantity');
      return;
    }
    const qty = parseFloat(currentItem.do_quantity);
    if (qty <= 0) {
      setItemError('Quantity must be greater than 0');
      return;
    }
    if (!currentItem.unit_price.trim()) {
      setItemError('Unit price is required');
      return;
    }
    if (!/^\d*\.?\d*$/.test(currentItem.unit_price)) {
      setItemError('Strictly only numeric in unit price');
      return;
    }

    const unitPrice = parseFloat(currentItem.unit_price) || 0;
    const lineTotal = qty * unitPrice;

    const newItem: DeliveryOrderItem = {
      doi_id: lineItems.length + 1,
      item_id: currentItem.item_id ? parseInt(currentItem.item_id) : undefined,
      item_name: currentItem.item_name,
      item_description: currentItem.item_description || currentItem.item_name,
      uom: currentItem.uom || undefined,
      do_quantity: qty,
      unit_price: unitPrice,
      discount: 0,
      line_total: lineTotal,
    };

    setLineItems(prev => [...prev, newItem]);
    setCurrentItem({ item_id: '', item_name: '', item_description: '', uom: '', do_quantity: '', unit_price: '' });
    setItemError('');
  };

  const handleRemoveItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateDeliveryOrder = async () => {
    if (!formData.reference_no.trim()) {
      setError('Reference number is required');
      return;
    }
    if (lineItems.length === 0) {
      setError('At least one item must be added');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await apiCreateDeliveryOrder({
        reference_no: formData.reference_no,
        terms: formData.terms || undefined,
        delivery_date: formData.delivery_date || undefined,
        customer_id: formData.customer_id ? parseInt(formData.customer_id) : undefined,
        remarks: formData.remarks || undefined,
        items: lineItems.map(item => ({
          item_id: item.item_id,
          item_name: item.item_name,
          item_description: item.item_description,
          uom: item.uom,
          do_quantity: item.do_quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          line_total: item.line_total,
        })),
      });

      if (!result.success) throw new Error(result.message);

      await fetchDeliveryOrders();
      setShowConfirm(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ reference_no: '', customer_id: '', terms: '', delivery_date: '', remarks: '' });
    setSelectedCustomerInfo(null);
    setLineItems([]);
    setCurrentItem({ item_id: '', item_name: '', item_description: '', uom: '', do_quantity: '', unit_price: '' });
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

  const handleEditClick = (order: DeliveryOrder) => {
    setSelectedOrder(order);
    setShowEditPanel(true);
  };

  const handleEditSuccess = () => {
    fetchDeliveryOrders();
  };

  const handleOpenGenerateModal = async () => {
    setShowGenerateModal(true);
    setSelectedPiId('');
    setLoadingPIs(true);
    try {
      const result = await apiGetProformaInvoices();
      if (result.success) setPiList(result.data || []);
    } catch (err) {
      console.error('Error fetching proforma invoices:', err);
    } finally {
      setLoadingPIs(false);
    }
  };

  const handleGenerateFromPI = async () => {
    if (!selectedPiId) return;
    const pi = piList.find(p => String(p.pi_id) === selectedPiId);
    if (!pi) return;

    setGeneratingDO(true);
    try {
      const result = await apiCreateDeliveryOrder({
        reference_no: pi.reference_no || undefined,
        terms: pi.terms || undefined,
        customer_id: pi.customer_id || undefined,
        remarks: pi.remarks || undefined,
        pi_id: pi.pi_id,
        items: (pi.items || []).map((item: any) => ({
          item_id: item.item_id || undefined,
          item_name: item.item_name,
          item_description: item.item_description || item.item_name,
          uom: item.uom || undefined,
          do_quantity: parseFloat(item.pi_quantity),
          unit_price: parseFloat(item.unit_price) || 0,
          discount: parseFloat(item.discount) || 0,
          line_total: parseFloat(item.line_total) || 0,
        })),
      });

      if (!result.success) throw new Error(result.message);

      await fetchDeliveryOrders();
      setShowGenerateModal(false);
      setSelectedPiId('');
    } catch (err: any) {
      setError(err.message);
      console.error('Error generating DO from proforma invoice:', err);
    } finally {
      setGeneratingDO(false);
    }
  };

  const handleBack = () => {
    navigate('/sales');
  };

  const handleOpenModal = async () => {
    setShowModal(true);
    setShowAddMenu(false);
    await fetchDropdownData();
  };

  // ==============================================
  // STATUS BADGE HELPER
  // ==============================================

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'draft':     return 'bg-yellow-100 text-yellow-800';
      case 'sent':      return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'closed':    return 'bg-gray-100 text-gray-800';
      default:          return 'bg-gray-100 text-gray-800';
    }
  };

  const getPIBadgeClass = (pi: any) => {
    if (pi.generated_do_id) return 'bg-gray-100 text-gray-600';
    if (pi.status !== 'paid') return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-800';
  };

  const getPIBadgeLabel = (pi: any) => {
    if (pi.generated_do_id) return 'Generated';
    if (pi.status !== 'paid') return 'Not Paid';
    return 'Available';
  };

  // ==============================================
  // RENDER
  // ==============================================

  return (
    <div className="flex flex-col h-full">

      {/* ============================================== */}
      {/* PAGE HEADER                                    */}
      {/* ============================================== */}
      <PageHeader title="Delivery Order Management" onBack={handleBack} onRefresh={fetchDeliveryOrders}>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenGenerateModal}
            className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Generate from PI
          </button>

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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Delivery Order Form
                </button>
              </div>
            )}
          </div>
        </div>
      </PageHeader>

      {/* ============================================== */}
      {/* MAIN CONTENT                                   */}
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
            <span className="ml-3 text-gray-600">Loading delivery orders...</span>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DO Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {deliveryOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="mt-2">No delivery orders found</p>
                        <p className="text-sm mt-1">Click "Add New" or "Generate from PI" above to create a delivery order.</p>
                      </td>
                    </tr>
                  ) : (
                    deliveryOrders.map(order => (
                      <tr key={order.do_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900 font-medium">
                          {order.do_no}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {order.reference_no || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {order.customer_company_name || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {order.delivery_date
                            ? new Date(order.delivery_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatCurrency(Number(order.total_amount) || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(order.status)}`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => handleEditClick(order)}
                            className="text-primary-600 hover:text-primary-800 transition-colors"
                            title="Edit delivery order"
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
      {/* CREATE DELIVERY ORDER MODAL                    */}
      {/* ============================================== */}
      <AddNewFormModal
        isOpen={showModal}
        title="Create New Delivery Order"
        onClose={handleCancel}
        maxWidth="max-w-2xl"
      >
        {/* ============================================== */}
        {/* SECTION 1: DELIVERY ORDER HEADER              */}
        {/* ============================================== */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Order Details</h3>

          <div className="space-y-4">
            {/* Reference Number (required) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Number <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="reference_no"
                value={formData.reference_no}
                onChange={handleFormChange}
                placeholder="Enter reference number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Customer Selection (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select
                name="customer_id"
                value={formData.customer_id}
                onChange={handleCustomerSelect}
                disabled={loadingDropdowns}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{loadingDropdowns ? 'Loading customers...' : 'Select a customer'}</option>
                {customers.map(c => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.register_no_new ? `${c.company_name}(${c.register_no_new})` : c.company_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer detail fields – auto-filled read-only when customer is selected */}
            {selectedCustomerInfo && (
              <div className="space-y-3 bg-gray-50 p-4 rounded-md border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Details</p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
                  <input type="text" value={selectedCustomerInfo.customer_id} readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Register No</label>
                  <input type="text" value={selectedCustomerInfo.register_no_new || ''} readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="text" value={selectedCustomerInfo.email || ''} readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" value={selectedCustomerInfo.phone || ''} readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    value={[
                      selectedCustomerInfo.address,
                      selectedCustomerInfo.city,
                      selectedCustomerInfo.state,
                      selectedCustomerInfo.country,
                      selectedCustomerInfo.post_code,
                    ].filter(Boolean).join(', ')}
                    readOnly
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                  />
                </div>
              </div>
            )}

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

            {/* Terms (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
              <input
                type="text"
                name="terms"
                value={formData.terms}
                onChange={handleFormChange}
                placeholder="e.g. Net 30 days"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

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
        {/* SECTION 2: ADD ITEMS                          */}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                readOnly
              />
            </div>

            {/* Quantity + Unit Price (2 columns) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="do_quantity"
                  value={currentItem.do_quantity}
                  onChange={handleItemChange}
                  placeholder="e.g. 10"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${itemError ? 'border-red-500' : 'border-gray-300'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Price <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="unit_price"
                  value={currentItem.unit_price}
                  onChange={handleItemChange}
                  placeholder="e.g. 100.00"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${itemError ? 'border-red-500' : 'border-gray-300'}`}
                />
              </div>
            </div>

            {/* Line Total */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Line Total</label>
              <input
                type="text"
                value={formatCurrency(computedLineTotal())}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
              />
            </div>

            {itemError && <p className="text-red-600 text-sm">{itemError}</p>}

            <button
              onClick={handleAddItem}
              className="w-full mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors font-medium"
            >
              Add Item to Delivery Order
            </button>
          </div>
        </div>

        {/* ============================================== */}
        {/* SECTION 3: ITEMS IN DELIVERY ORDER            */}
        {/* ============================================== */}
        <div className="border-b pb-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Items in Delivery Order ({lineItems.length})
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
                      <span>Qty: <strong>{item.do_quantity}</strong></span>
                      <span>Unit Price: <strong>{formatCurrency(item.unit_price)}</strong></span>
                      <span>Line Total: <strong>{formatCurrency(item.line_total)}</strong></span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="ml-4 text-red-600 hover:text-red-800 transition-colors"
                    title="Remove item"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
        {/* SECTION 4: TOTAL + ACTIONS                    */}
        {/* ============================================== */}
        <div className="mt-6">
          {lineItems.length > 0 && (
            <div className="flex justify-end mb-4">
              <div className="bg-gray-50 px-4 py-3 rounded-md border border-gray-200">
                <span className="text-sm font-medium text-gray-700 mr-3">Total Amount:</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateDeliveryOrder}
              disabled={submitting || lineItems.length === 0}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </AddNewFormModal>

      {/* ============================================== */}
      {/* GENERATE FROM PI MODAL                         */}
      {/* ============================================== */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Generate DO from Proforma Invoice</h2>
              <button
                onClick={() => { setShowGenerateModal(false); setSelectedPiId(''); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingPIs ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="ml-3 text-gray-600">Loading proforma invoices...</span>
                </div>
              ) : piList.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No proforma invoices found.</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PI Number</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference No</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PI Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DO Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {piList.map(pi => {
                      const isAvailable = pi.status === 'paid' && !pi.generated_do_id;
                      return (
                        <tr
                          key={pi.pi_id}
                          onClick={() => { if (isAvailable) setSelectedPiId(String(pi.pi_id)); }}
                          className={`transition-colors ${!isAvailable ? 'opacity-50 cursor-not-allowed bg-gray-50' : selectedPiId === String(pi.pi_id) ? 'bg-primary-50 cursor-pointer' : 'hover:bg-gray-50 cursor-pointer'}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="radio"
                              checked={selectedPiId === String(pi.pi_id)}
                              onChange={() => { if (isAvailable) setSelectedPiId(String(pi.pi_id)); }}
                              disabled={!isAvailable}
                              className="text-primary-600 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-gray-900 font-medium">{pi.pi_no}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{pi.reference_no || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{pi.customer_company_name || '—'}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              pi.status === 'draft'     ? 'bg-yellow-100 text-yellow-800' :
                              pi.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                              pi.status === 'paid'      ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {pi.status.charAt(0).toUpperCase() + pi.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getPIBadgeClass(pi)}`}>
                              {getPIBadgeLabel(pi)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button
                onClick={() => { setShowGenerateModal(false); setSelectedPiId(''); }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateFromPI}
                disabled={!selectedPiId || generatingDO}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {generatingDO ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* SUCCESS CONFIRMATION DIALOG                    */}
      {/* ============================================== */}
      <ConfirmationDialog
        isOpen={showConfirm}
        message="Delivery order created successfully. Click **OK** to continue adding more or **Cancel** to return to the main page."
        onConfirm={handleConfirmOk}
        onCancel={handleConfirmCancel}
      />

      {/* ============================================== */}
      {/* EDIT PANEL                                     */}
      {/* ============================================== */}
      <EditPanel
        isOpen={showEditPanel}
        onClose={() => setShowEditPanel(false)}
        entityType="delivery_order"
        data={selectedOrder}
        onUpdate={handleEditSuccess}
      />

    </div>
  );
};

export default DeliveryOrderPage;
