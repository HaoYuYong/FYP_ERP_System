import React, { useEffect, useState, useRef } from 'react'; // useRef for dropdown click-outside detection
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader'; // Reusable dark header bar shared across pages
import AddNewFormModal from '../components/ui/AddNewFormModal'; // Reusable modal with sticky header
import ConfirmationDialog from '../components/ui/ConfirmationDialog'; // Modal for success/cancel confirmation
import EditPanel from '../components/ui/EditPanel'; // Reusable slide-out edit panel
import { EditIcon } from '../components/ui/Icons'; // Pencil icon for the Action column
import {
  apiGetPurchaseRequests,
  apiCreatePurchaseRequest,
  apiGetSuppliersWithDetails,
  apiGetInventoryItems,
} from '../lib/purchaseRequestApi';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

/**
 * PurchaseRequest Interface
 * Matches structure of purchase_request table with associated item data
 */
interface PurchaseRequest {
  pr_id: string;
  pr_no: string;
  reference_no: string;
  terms?: string;              // Payment/delivery terms e.g. "Net 30 days"
  supplier_id?: number;
  supplier_company_name?: string;
  supplier_register_no?: string;
  supplier_address?: string;
  supplier_phone?: string;
  supplier_email?: string;
  remarks?: string;
  status: string;
  created_at?: string;
  items?: PurchaseRequestItem[];
}

/**
 * PurchaseRequestItem Interface
 * Represents a single line item in a purchase request
 */
interface PurchaseRequestItem {
  pri_id: number;
  item_id?: number;
  item_name: string;
  item_description: string;
  uom?: string;
  pri_quantity: number;
}

/**
 * Supplier Interface
 * Represents supplier with contact details for dropdown and display
 */
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

/**
 * InventoryItem Interface
 * Represents an inventory item for dropdown selection
 */
interface InventoryItem {
  item_id: number;
  item_name: string;
  description?: string;
  uom?: string;
}

// ==============================================
// COMPONENT
// ==============================================

const PurchaseRequestPage: React.FC = () => {
  // Initialize navigation hook to navigate back to purchase page
  const navigate = useNavigate();

  // ==============================================
  // STATE VARIABLES
  // ==============================================

  // Purchase request list state
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal and form state for creating new PR
  const [showModal, setShowModal] = useState(false); // Controls visibility of create form modal
  const [showConfirm, setShowConfirm] = useState(false); // Controls visibility of success confirmation dialog

  // Dropdown state for Add New button
  const [showAddMenu, setShowAddMenu] = useState(false); // Controls visibility of Add New dropdown
  const addMenuRef = useRef<HTMLDivElement>(null); // Ref to detect outside clicks

  // Supplier and inventory data for dropdowns
  const [suppliers, setSuppliers] = useState<Supplier[]>([]); // List of suppliers for selection
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]); // List of inventory items for selection
  const [loadingDropdowns, setLoadingDropdowns] = useState(false); // Loading state for dropdown data
  // Selected supplier details displayed as read-only fields in the create form
  const [selectedSupplierInfo, setSelectedSupplierInfo] = useState<Supplier | null>(null);

  // Form data for new PR
  const [formData, setFormData] = useState({
    reference_no: '', // User-entered reference number (required)
    supplier_id: '', // Selected supplier ID (optional)
    remarks: '', // User-entered remarks (optional)
  });

  // Line items being added to the PR
  const [lineItems, setLineItems] = useState<PurchaseRequestItem[]>([]); // Array of items to add to PR

  // Current item being added form state
  const [currentItem, setCurrentItem] = useState({
    item_id: '', // Selected inventory item ID (optional)
    item_name: '', // Selected item name (required)
    item_description: '', // Auto-filled from inventory (read-only)
    uom: '', // Auto-filled from inventory (optional)
    pri_quantity: '', // User-entered quantity (required, numeric only)
  });

  // Edit panel state for viewing/editing an existing PR
  const [showEditPanel, setShowEditPanel] = useState(false); // Controls edit panel visibility
  const [selectedPR, setSelectedPR] = useState<PurchaseRequest | null>(null); // PR being edited

  // Validation and error states
  const [submitting, setSubmitting] = useState(false); // Loading state during form submission
  const [itemError, setItemError] = useState(''); // Error message for item quantity validation

  // ==============================================
  // FETCH DATA
  // ==============================================

  /**
   * Fetch all purchase requests from backend
   */
  const fetchPurchaseRequests = async () => {
    try {
      setLoading(true);
      setError('');

      // Call backend API to fetch all PRs
      const result = await apiGetPurchaseRequests();
      if (!result.success) throw new Error(result.message);

      setPurchaseRequests(result.data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching purchase requests:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch suppliers and inventory items for dropdowns (only when modal opens)
   */
  const fetchDropdownData = async () => {
    try {
      setLoadingDropdowns(true);

      // Fetch suppliers with contact details for dropdown and detail display
      const suppliersResult = await apiGetSuppliersWithDetails();
      if (suppliersResult.success) {
        setSuppliers(suppliersResult.data || []);
      }

      // Fetch inventory items for dropdown selection
      const itemsResult = await apiGetInventoryItems();
      if (itemsResult.success) {
        setInventoryItems(itemsResult.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching dropdown data:', err);
    } finally {
      setLoadingDropdowns(false);
    }
  };

  // Fetch purchase requests on component mount
  useEffect(() => {
    fetchPurchaseRequests();
  }, []);

  // Close "Add New" dropdown when user clicks outside its container
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(event.target as Node)
      ) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside); // Cleanup listener on unmount
  }, []);

  // ==============================================
  // FORM HANDLERS
  // ==============================================

  /**
   * Handle main PR form field changes (reference_no, supplier_id, remarks)
   */
  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Handle supplier dropdown selection – updates supplier_id and auto-fills read-only detail fields
   */
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

  /**
   * Handle current item form field changes and validate numeric quantity
   */
  const handleItemChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    // Special handling for quantity field - validate numeric input only
    if (name === 'pri_quantity') {
      // Allow numeric input and decimals
      if (!/^\d*\.?\d*$/.test(value)) {
        setItemError('Strictly only numeric in quantity');
      } else {
        setItemError(''); // Clear error if input becomes valid
      }
    }

    setCurrentItem((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Handle inventory item selection from dropdown - auto-fill description and UOM
   */
  const handleItemSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const itemId = e.target.value;
    const selectedInventoryItem = inventoryItems.find(
      (item) => item.item_id === parseInt(itemId)
    );

    if (selectedInventoryItem) {
      // Auto-fill item details from selected inventory item
      setCurrentItem((prev) => ({
        ...prev,
        item_id: itemId,
        item_name: selectedInventoryItem.item_name,
        item_description: selectedInventoryItem.description || selectedInventoryItem.item_name,
        uom: selectedInventoryItem.uom || '',
      }));
    } else {
      // Reset if no item selected
      setCurrentItem((prev) => ({
        ...prev,
        item_id: '',
        item_name: '',
        item_description: '',
        uom: '',
      }));
    }
  };

  /**
   * Add current item to line items array and reset item form
   */
  const handleAddItem = () => {
    // Validate required fields
    if (!currentItem.item_name.trim()) {
      setItemError('Item name is required');
      return;
    }

    if (!currentItem.pri_quantity.trim()) {
      setItemError('Quantity is required');
      return;
    }

    if (!/^\d+\.?\d*$/.test(currentItem.pri_quantity)) {
      setItemError('Strictly only numeric in quantity');
      return;
    }

    const qty = parseFloat(currentItem.pri_quantity);
    if (qty <= 0) {
      setItemError('Quantity must be greater than 0');
      return;
    }

    // Add item to line items array with auto-generated pri_id for display
    const newItem: PurchaseRequestItem = {
      pri_id: lineItems.length + 1, // Temporary ID for display only
      item_id: currentItem.item_id ? parseInt(currentItem.item_id) : undefined,
      item_name: currentItem.item_name,
      item_description: currentItem.item_description || currentItem.item_name,
      uom: currentItem.uom || undefined,
      pri_quantity: qty,
    };

    setLineItems((prev) => [...prev, newItem]);

    // Reset item form for next entry
    setCurrentItem({
      item_id: '',
      item_name: '',
      item_description: '',
      uom: '',
      pri_quantity: '',
    });
    setItemError('');
  };

  /**
   * Remove item from line items array by index
   */
  const handleRemoveItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Submit form to create purchase request
   */
  const handleCreatePR = async () => {
    // Validate main form fields
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
      // Call backend API to create PR with logging
      const result = await apiCreatePurchaseRequest({
        reference_no: formData.reference_no,
        supplier_id: formData.supplier_id
          ? parseInt(formData.supplier_id)
          : undefined,
        remarks: formData.remarks || undefined,
        items: lineItems.map((item) => ({
          item_id: item.item_id,
          item_name: item.item_name,
          item_description: item.item_description,
          uom: item.uom,
          pri_quantity: item.pri_quantity,
        })),
      });

      if (!result.success) throw new Error(result.message);

      // Refresh list after successful creation
      await fetchPurchaseRequests();

      // Show success confirmation dialog
      setShowConfirm(true);
    } catch (err: any) {
      setError(err.message);
      console.error('Error creating purchase request:', err);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handle OK button click on confirmation dialog - reset form and keep modal open
   */
  const handleConfirmOk = () => {
    setShowConfirm(false);
    // Reset form for creating another PR
    setFormData({ reference_no: '', supplier_id: '', remarks: '' });
    setSelectedSupplierInfo(null);
    setLineItems([]);
    setCurrentItem({
      item_id: '',
      item_name: '',
      item_description: '',
      uom: '',
      pri_quantity: '',
    });
    setItemError('');
  };

  /**
   * Handle Cancel button click on confirmation dialog - close modal completely
   */
  const handleConfirmCancel = () => {
    setShowConfirm(false);
    // Exit: close the modal
    setShowModal(false);
  };

  /**
   * Handle Cancel button on form - close modal and reset
   */
  const handleCancel = () => {
    setShowModal(false);
    setFormData({ reference_no: '', supplier_id: '', remarks: '' });
    setSelectedSupplierInfo(null);
    setLineItems([]);
    setCurrentItem({
      item_id: '',
      item_name: '',
      item_description: '',
      uom: '',
      pri_quantity: '',
    });
    setError('');
    setItemError('');
  };

  /**
   * Open EditPanel for the selected PR to view/edit its details.
   */
  const handleEditClick = (pr: PurchaseRequest) => {
    setSelectedPR(pr);
    setShowEditPanel(true);
  };

  /**
   * Called by EditPanel after a successful update – refresh the PR list.
   */
  const handleEditSuccess = () => {
    fetchPurchaseRequests();
  };

  /**
   * Handle back button click to navigate to /purchase page
   */
  const handleBack = () => {
    navigate('/purchase');
  };

  /**
   * Handle modal open - fetch dropdown data when modal is about to show
   */
  const handleOpenModal = async () => {
    setShowModal(true);
    setShowAddMenu(false);
    await fetchDropdownData();
  };

  // ==============================================
  // RENDER
  // ==============================================
  return (
    // Outer wrapper fills available space and stacks header + content vertically
    <div className="flex flex-col h-full">
      {/* ============================================== */}
      {/* PAGE HEADER                                    */}
      {/* Displays title with back button and action    */}
      {/* buttons on the right (Add New, Refresh List)   */}
      {/* ============================================== */}
      <PageHeader title="Purchase Request Management" onBack={handleBack} onRefresh={fetchPurchaseRequests}>
        {/* Add New dropdown container - click outside closes dropdown */}
        <div className="relative" ref={addMenuRef}>
          {/* Add New toggle button - clicking opens/closes the dropdown */}
          <button
            onClick={() => setShowAddMenu((prev) => !prev)}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors flex items-center"
          >
            {/* Plus icon */}
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add New
            {/* Chevron-down icon indicates dropdown open */}
            <svg
              className="w-4 h-4 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Dropdown menu - positioned below Add New button */}
          {showAddMenu && (
            <div className="absolute right-0 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-30 overflow-hidden">
              {/* Option: open the Purchase Request Form */}
              <button
                onClick={handleOpenModal}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
              >
                {/* Document icon */}
                <svg
                  className="w-4 h-4 mr-2 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Purchase Request Form
              </button>
            </div>
          )}
        </div>
      </PageHeader>

      {/* Content area - flex-1 fills remaining height; overflow-y-auto owns scrollbar */}
      <div className="flex-1 overflow-y-auto p-6">
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
            <svg
              className="animate-spin h-8 w-8 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="ml-3 text-gray-600">
              Loading purchase requests...
            </span>
          </div>
        ) : (
          <>
            {/* Purchase Request Table Container */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  {/* Table Header */}
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        PR Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Supplier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      {/* Action column – opens EditPanel for the selected PR */}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="bg-white divide-y divide-gray-200">
                    {purchaseRequests.length === 0 ? (
                      // Empty state when no PRs exist
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-12 text-center text-gray-500"
                        >
                          <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <p className="mt-2">No purchase requests found</p>
                          <p className="text-sm mt-1">
                            Click the "Add New" button above to create a purchase request.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      // Render each PR row
                      purchaseRequests.map((pr) => (
                        <tr key={pr.pr_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900 font-medium">
                            {pr.pr_no}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {pr.reference_no || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {pr.supplier_company_name || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {pr.created_at ? new Date(pr.created_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {/* Status badge with color coding */}
                            <span
                              className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                pr.status === 'draft'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : pr.status === 'sent'
                                    ? 'bg-blue-100 text-blue-800'
                                    : pr.status === 'received'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {pr.status.charAt(0).toUpperCase() +
                                pr.status.slice(1)}
                            </span>
                          </td>
                          {/* Action cell – edit icon opens EditPanel for this PR */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button
                              onClick={() => handleEditClick(pr)}
                              className="text-primary-600 hover:text-primary-800 transition-colors"
                              title="Edit purchase request"
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
          </>
        )}
      </div>

      {/* ============================================== */}
      {/* CREATE PURCHASE REQUEST MODAL                 */}
      {/* Reusable modal component with sticky header    */}
      {/* ============================================== */}
      <AddNewFormModal
        isOpen={showModal}
        title="Create New Purchase Request Form"
        onClose={handleCancel}
        maxWidth="max-w-2xl"
      >
        {/* ============================================== */}
        {/* SECTION 1: PR HEADER INFORMATION             */}
        {/* ============================================== */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Purchase Request Details
          </h3>

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

            {/* Supplier Selection (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier
              </label>
              <select
                name="supplier_id"
                value={formData.supplier_id}
                onChange={handleSupplierSelect}
                disabled={loadingDropdowns}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">
                  {loadingDropdowns ? 'Loading suppliers...' : 'Select a supplier'}
                </option>
                {suppliers.map((supplier) => (
                  <option key={supplier.supplier_id} value={supplier.supplier_id}>
                    {/* Format: company_name(register_no_new) or just company_name if no reg no */}
                    {supplier.register_no_new
                      ? `${supplier.company_name}(${supplier.register_no_new})`
                      : supplier.company_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Supplier detail fields – auto-filled read-only when a supplier is selected */}
            {selectedSupplierInfo && (
              <div className="space-y-3 bg-gray-50 p-4 rounded-md border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier Details</p>

                {/* Supplier ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier ID</label>
                  <input
                    type="text"
                    value={selectedSupplierInfo.supplier_id}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                  />
                </div>

                {/* Register No */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Register No</label>
                  <input
                    type="text"
                    value={selectedSupplierInfo.register_no_new || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="text"
                    value={selectedSupplierInfo.email || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={selectedSupplierInfo.phone || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                  />
                </div>

                {/* Address – combines address, city, state, country, post_code */}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks
              </label>
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
        {/* SECTION 2: ADD ITEMS TO PURCHASE REQUEST      */}
        {/* ============================================== */}
        <div className="border-b pb-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Add Items
          </h3>

          <div className="space-y-4 bg-gray-50 p-4 rounded-md">
            {/* Item Selection Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Name
              </label>
              <select
                value={currentItem.item_id}
                onChange={handleItemSelect}
                disabled={loadingDropdowns}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">
                  {loadingDropdowns
                    ? 'Loading items...'
                    : 'Select an item'}
                </option>
                {inventoryItems.map((item) => (
                  <option key={item.item_id} value={item.item_id}>
                    {item.item_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Item Description (readonly - auto-filled from selected item) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Description
              </label>
              <textarea
                name="item_description"
                value={currentItem.item_description}
                placeholder="Auto-filled from selected item"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-100"
                readOnly
              />
            </div>

            {/* UOM (Unit of Measure) - readonly when auto-filled */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit of Measure (UOM)
              </label>
              <input
                type="text"
                name="uom"
                value={currentItem.uom}
                onChange={handleItemChange}
                placeholder="Auto-filled from selected item"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-100"
                readOnly
              />
            </div>

            {/* Quantity (required, numeric only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="pri_quantity"
                value={currentItem.pri_quantity}
                onChange={handleItemChange}
                placeholder="Enter quantity (numbers only)"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  itemError
                    ? 'border-red-500'
                    : 'border-gray-300'
                }`}
              />
              {/* Error message for quantity validation */}
              {itemError && (
                <p className="text-red-600 text-sm mt-1">{itemError}</p>
              )}
            </div>

            {/* Add Item Button */}
            <button
              onClick={handleAddItem}
              className="w-full mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors font-medium"
            >
              Add Item to Request
            </button>
          </div>
        </div>

        {/* ============================================== */}
        {/* SECTION 3: ITEMS ADDED TO REQUEST             */}
        {/* ============================================== */}
        <div className="border-b pb-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Items in Request ({lineItems.length})
          </h3>

          {lineItems.length > 0 ? (
            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div
                  key={index}
                  className="bg-gray-50 p-4 rounded-md flex justify-between items-start"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {item.item_name}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.item_description}
                    </p>
                    <div className="flex gap-4 mt-2 text-sm text-gray-600">
                      {item.uom && (
                        <span>
                          UOM: <strong>{item.uom}</strong>
                        </span>
                      )}
                      <span>
                        Qty: <strong>{item.pri_quantity}</strong>
                      </span>
                    </div>
                  </div>
                  {/* Remove Item Button */}
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="ml-4 text-red-600 hover:text-red-800 transition-colors"
                    title="Remove item"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
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
        {/* Cancel and Create buttons                     */}
        {/* ============================================== */}
        <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCreatePR}
            disabled={submitting || lineItems.length === 0}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </AddNewFormModal>

      {/* ============================================== */}
      {/* SUCCESS CONFIRMATION DIALOG                   */}
      {/* Shows after successful creation               */}
      {/* ============================================== */}
      <ConfirmationDialog
        isOpen={showConfirm}
        message="Purchase Request created successfully. Click **OK** to continue adding more or **Cancel** to return to the main page."
        onConfirm={handleConfirmOk}
        onCancel={handleConfirmCancel}
      />

      {/* ============================================== */}
      {/* EDIT PANEL: PURCHASE REQUEST                   */}
      {/* Opens when user clicks edit icon on a PR row; */}
      {/* 3 tabs – Main, Items, Supplier                 */}
      {/* ============================================== */}
      <EditPanel
        isOpen={showEditPanel}
        onClose={() => setShowEditPanel(false)}
        entityType="purchase_request"
        data={selectedPR}
        onUpdate={handleEditSuccess}
      />
    </div>
  );
};

export default PurchaseRequestPage;

