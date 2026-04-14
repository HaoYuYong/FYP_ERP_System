import React, { useEffect, useState, useRef } from 'react'; // useRef for dropdown click-outside detection
// import FloatingActionMenu from '../components/ui/FloatingActionMenu'; // FAB commented out – kept for future use
import ConfirmationDialog from '../components/ui/ConfirmationDialog';
import EditPanel from '../components/ui/EditPanel';
import PageHeader from '../components/ui/PageHeader'; // Reusable dark header bar shared across pages
import {
  apiGetInventoryItems,
  apiCreateInventoryItem,
  apiCreateClassification,
  apiGetClassifications,
} from '../lib/inventoryApi';
import { EditIcon } from '../components/ui/Icons'; // Only EditIcon is needed; PlusIcon/ItemIcon/CIcon were for the FAB

// ==============================================
// TYPE DEFINITIONS
// ==============================================

/**
 * InventoryItem Interface
 * Matches the structure of the inventory table, focusing on fields needed for this page.
 * Extended with description and classification_id for editing.
 */
interface InventoryItem {
  item_id: number;          // Auto‑generated primary key
  item_name: string;        // Name of the item (required)
  serial_number?: string;   // Optional serial number
  balance_qty?: number;     // Current stock quantity
  uom?: string;             // Unit of measure (e.g., pcs, kg)
  description?: string;     // Optional description (for edit panel)
  classification_id?: number; // Optional classification (for edit panel)
}

/**
 * Classification Interface
 * Matches the structure of the classification table for the classification view.
 */
interface Classification {
  classification_id: number;       // Auto-generated primary key
  classification_code: string;     // Short identifier (e.g., "CAT-01")
  classification_title: string;    // Human-readable name
  classification_description?: string; // Optional long-form details
}

// ==============================================
// COMPONENT
// ==============================================

const InventoryPage: React.FC = () => {
  // ==============================================
  // STATE VARIABLES
  // ==============================================

  // Controls which table is displayed: inventory items or classifications
  const [currentView, setCurrentView] = useState<'inventory' | 'classification'>('inventory');

  // Inventory items state
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Classifications list state (for the classification view table)
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [loadingClass, setLoadingClass] = useState(false);

  // Modal visibility states
  const [showItemModal, setShowItemModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);

  // Inventory item edit panel state
  const [showEditPanel, setShowEditPanel] = useState(false);        // Controls edit panel visibility
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null); // Item being edited

  // Classification edit panel state
  const [showClassEditPanel, setShowClassEditPanel] = useState(false);          // Controls classification edit panel visibility
  const [selectedClass, setSelectedClass] = useState<Classification | null>(null); // Classification being edited

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

  // Confirmation dialog state for item addition
  const [showItemConfirm, setShowItemConfirm] = useState(false);
  // Confirmation dialog state for classification addition
  const [showClassConfirm, setShowClassConfirm] = useState(false);

  // Controls visibility of the "Add New" dropdown in the header
  const [showAddMenu, setShowAddMenu] = useState(false);
  // Ref attached to the Add New dropdown container to detect outside clicks
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Controls visibility of the "Change View" dropdown in the header
  const [showChangeViewMenu, setShowChangeViewMenu] = useState(false);
  // Ref attached to the Change View dropdown container to detect outside clicks
  const changeViewMenuRef = useRef<HTMLDivElement>(null);

  // ==============================================
  // FETCH INVENTORY ITEMS
  // ==============================================
  /**
   * fetchItems – retrieves all inventory items via backend API (read-only, no logging needed).
   */
  const fetchItems = async () => {
    try {
      setLoading(true);
      setError('');

      const result = await apiGetInventoryItems();

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch inventory');
      }

      setItems(result.data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  // ==============================================
  // FETCH CLASSIFICATIONS (for classification view)
  // ==============================================
  /**
   * fetchClassifications – retrieves all classifications via backend API for the classification view table.
   */
  const fetchClassifications = async () => {
    try {
      setLoadingClass(true);
      setError('');

      const result = await apiGetClassifications();

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch classifications');
      }

      setClassifications(result.data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching classifications:', err);
    } finally {
      setLoadingClass(false);
    }
  };

  // Fetch inventory items once when component mounts (default view is inventory)
  useEffect(() => {
    fetchItems();
  }, []);

  // Close the "Add New" dropdown when user clicks anywhere outside its container
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside); // Cleanup listener on unmount
  }, []);

  // Close the "Change View" dropdown when user clicks anywhere outside its container
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (changeViewMenuRef.current && !changeViewMenuRef.current.contains(event.target as Node)) {
        setShowChangeViewMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside); // Cleanup listener on unmount
  }, []);

  // ==============================================
  // ADD NEW ITEM
  // ==============================================
  /**
   * handleAddItem – validates form, sends to backend API, logs operation, refreshes list.
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
      // Call backend API (automatically creates log entry)
      const result = await apiCreateInventoryItem({
        item_name: itemFormData.item_name,
        serial_number: itemFormData.serial_number || undefined,
        balance_qty: itemFormData.balance_qty ? parseFloat(itemFormData.balance_qty) : undefined,
        uom: itemFormData.uom || undefined,
      });

      if (!result.success) {
        throw new Error(result.message || 'Failed to create item');
      }

      // Refresh the table with updated data
      await fetchItems();

      // Show custom confirmation dialog
      setShowItemConfirm(true);
    } catch (err: any) {
      setError(err.message);
      console.error('Error adding item:', err);
    } finally {
      setSubmittingItem(false);
    }
  };

  // Called when user clicks "OK" on the item confirmation
  const handleItemConfirmOk = () => {
    setShowItemConfirm(false);
    // Stay: reset form and keep modal open
    setItemFormData({ item_name: '', serial_number: '', balance_qty: '', uom: '' });
  };

  // Called when user clicks "Cancel" on the item confirmation
  const handleItemConfirmCancel = () => {
    setShowItemConfirm(false);
    // Exit: close the item modal
    setShowItemModal(false);
  };

  // ==============================================
  // ADD NEW CLASSIFICATION
  // ==============================================
  /**
   * handleAddClassification – validates and sends to backend API (automatically logs operation).
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
      // Call backend API (automatically creates log entry)
      const result = await apiCreateClassification({
        classification_code: classFormData.classification_code,
        classification_title: classFormData.classification_title,
        classification_description: classFormData.classification_description || undefined,
      });

      if (!result.success) {
        throw new Error(result.message || 'Failed to create classification');
      }

      // Refresh classification list if currently in classification view
      if (currentView === 'classification') {
        await fetchClassifications();
      }

      // Show custom confirmation
      setShowClassConfirm(true);
    } catch (err: any) {
      setError(err.message);
      console.error('Error adding classification:', err);
    } finally {
      setSubmittingClass(false);
    }
  };

  // Called when user clicks "OK" on the classification confirmation
  const handleClassConfirmOk = () => {
    setShowClassConfirm(false);
    // Stay: reset form and keep modal open
    setClassFormData({ classification_code: '', classification_title: '', classification_description: '' });
  };

  // Called when user clicks "Cancel" on the classification confirmation
  const handleClassConfirmCancel = () => {
    setShowClassConfirm(false);
    // Exit: close the classification modal
    setShowClassModal(false);
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
  // INVENTORY ITEM EDIT HANDLERS
  // ==============================================
  /**
   * handleEditClick – opens the edit panel with the selected item's data.
   */
  const handleEditClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowEditPanel(true);
  };

  /**
   * handleUpdateSuccess – callback after an item is updated; refreshes the list.
   */
  const handleUpdateSuccess = () => {
    fetchItems(); // Refresh list after update
  };

  /**
   * handleDeleteSuccess – callback after an item is deleted; refreshes the list.
   */
  const handleDeleteSuccess = () => {
    fetchItems(); // Refresh list after delete
  };

  // ==============================================
  // CLASSIFICATION EDIT HANDLERS
  // ==============================================
  /**
   * handleClassEditClick – opens the edit panel with the selected classification's data.
   */
  const handleClassEditClick = (cls: Classification) => {
    setSelectedClass(cls);
    setShowClassEditPanel(true);
  };

  /**
   * handleClassUpdateSuccess – callback after a classification is updated; refreshes the classification list.
   */
  const handleClassUpdateSuccess = () => {
    fetchClassifications(); // Refresh classification table after update
  };

  /**
   * handleClassDeleteSuccess – callback after a classification is deleted; refreshes the classification list.
   */
  const handleClassDeleteSuccess = () => {
    fetchClassifications(); // Refresh classification table after delete
  };

  // ==============================================
  // RENDER
  // ==============================================
  return (
    // Outer wrapper fills the available space given by Layout and stacks header + content vertically
    <div className="flex flex-col h-full">

      {/* ============================================== */}
      {/* PAGE HEADER (reusable PageHeader component)    */}
      {/* title changes based on which view is active   */}
      {/* onRefresh calls the appropriate fetch function */}
      {/* Children slot holds Change View + Add New      */}
      {/* ============================================== */}
      <PageHeader
        title={currentView === 'inventory' ? 'Inventory Management' : 'Inventory Management - Classification'}
        onRefresh={currentView === 'inventory' ? fetchItems : fetchClassifications}
      >

        {/* ============================================== */}
        {/* CHANGE VIEW DROPDOWN                           */}
        {/* Switches between Inventory table and          */}
        {/* Classification table without leaving the page  */}
        {/* ============================================== */}
        <div className="relative" ref={changeViewMenuRef}>
          {/* Change View toggle button – clicking opens/closes the view selection dropdown */}
          <button
            onClick={() => setShowChangeViewMenu((prev) => !prev)}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors flex items-center"
          >
            {/* Grid/view icon */}
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Change View
            {/* Chevron-down icon signals dropdown */}
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Change View dropdown menu – w-full matches button width exactly */}
          {showChangeViewMenu && (
            <div className="absolute right-0 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-30 overflow-hidden">
              {/* Option: switch to inventory items table */}
              <button
                onClick={() => { setCurrentView('inventory'); setShowChangeViewMenu(false); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
              >
                {/* Box/package icon for inventory */}
                <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0v10l-8 4-8-4V7m8 4v10" />
                </svg>
                Inventory
              </button>
              {/* Divider line between the two options */}
              <div className="border-t border-gray-200" />
              {/* Option: switch to classification view; fetches classification data on click */}
              <button
                onClick={() => { setCurrentView('classification'); fetchClassifications(); setShowChangeViewMenu(false); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
              >
                {/* Document icon for classification */}
                <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Classification
              </button>
            </div>
          )}
        </div>

        {/* ============================================== */}
        {/* ADD NEW DROPDOWN                               */}
        {/* Provides options to add an Item or            */}
        {/* Classification via modal form                  */}
        {/* ============================================== */}
        <div className="relative" ref={addMenuRef}>
          {/* Add New toggle button – clicking opens/closes the dropdown menu */}
          <button
            onClick={() => setShowAddMenu((prev) => !prev)}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors flex items-center"
          >
            {/* Plus icon */}
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New
            {/* Chevron-down icon signals that this button has a dropdown */}
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown menu – w-full matches the Add New button width exactly */}
          {showAddMenu && (
            <div className="absolute right-0 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-30 overflow-hidden">
              {/* Option: open the Add New Item form modal */}
              <button
                onClick={() => { setShowItemModal(true); setShowAddMenu(false); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
              >
                {/* Item (box/package) icon */}
                <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0v10l-8 4-8-4V7m8 4v10" />
                </svg>
                Item
              </button>
              {/* Divider line between the two dropdown options */}
              <div className="border-t border-gray-200" />
              {/* Option: open the Add New Classification form modal */}
              <button
                onClick={() => { setShowClassModal(true); setShowAddMenu(false); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
              >
                {/* Classification (document) icon */}
                <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Classification
              </button>
            </div>
          )}
        </div>

      </PageHeader>

      {/* Content area – flex-1 fills remaining height; overflow-y-auto owns the scrollbar below the header */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* Global error display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
            <div className="font-medium">Error</div>
            <div className="text-sm mt-1">{error}</div>
          </div>
        )}

        {/* Loading spinner – shown for whichever view is currently loading */}
        {(currentView === 'inventory' && loading) || (currentView === 'classification' && loadingClass) ? (
          <div className="flex items-center justify-center p-8">
            <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {/* Loading message reflects which view is loading */}
            <span className="ml-3 text-gray-600">
              {currentView === 'inventory' ? 'Loading inventory...' : 'Loading classifications...'}
            </span>
          </div>
        ) : (
          <>
            {/* ============================================== */}
            {/* INVENTORY TABLE                                */}
            {/* Shown only when currentView === 'inventory'   */}
            {/* ============================================== */}
            {currentView === 'inventory' && (
              <>
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
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {items.length === 0 ? (
                          // Empty state when no inventory items exist
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 0a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z" />
                              </svg>
                              <p className="mt-2">No items found</p>
                              <p className="text-sm mt-1">Click the "Add New" button above to add an item.</p>
                            </td>
                          </tr>
                        ) : (
                          // Render one row per inventory item
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {/* Edit icon opens the inventory item edit panel */}
                                <button
                                  onClick={() => handleEditClick(item)}
                                  className="text-primary-600 hover:text-primary-800 transition-colors"
                                  title="Edit item"
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

                {/* Footer summary – shows total count of loaded inventory items */}
                <div className="mt-4">
                  <div className="text-sm text-gray-600">
                    {items.length} item{items.length !== 1 ? 's' : ''} found
                  </div>
                </div>
              </>
            )}

            {/* ============================================== */}
            {/* CLASSIFICATION TABLE                           */}
            {/* Shown only when currentView === 'classification' */}
            {/* ============================================== */}
            {currentView === 'classification' && (
              <>
                <div className="bg-white shadow-md rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Classification Code
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Classification Title
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {classifications.length === 0 ? (
                          // Empty state when no classifications exist
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <p className="mt-2">No classifications found</p>
                              <p className="text-sm mt-1">Click "Add New" → "Classification" above to create one.</p>
                            </td>
                          </tr>
                        ) : (
                          // Render one row per classification
                          classifications.map((cls) => (
                            <tr key={cls.classification_id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600">
                                {cls.classification_code}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                {cls.classification_title}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {/* Show em-dash when description is absent */}
                                {cls.classification_description || '—'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {/* Edit icon opens the classification edit panel */}
                                <button
                                  onClick={() => handleClassEditClick(cls)}
                                  className="text-primary-600 hover:text-primary-800 transition-colors"
                                  title="Edit classification"
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

                {/* Footer summary – shows total count of loaded classifications */}
                <div className="mt-4">
                  <div className="text-sm text-gray-600">
                    {classifications.length} classification{classifications.length !== 1 ? 's' : ''} found
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ============================================== */}
        {/* FLOATING ACTION MENU (FAB) – commented out, kept for future use */}
        {/* ============================================== */}
        {/*
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
        */}

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
        {/* MODAL: ADD NEW CLASSIFICATION                  */}
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

        {/* ============================================== */}
        {/* EDIT PANEL: INVENTORY ITEM                     */}
        {/* Opens when user clicks edit icon on item row  */}
        {/* ============================================== */}
        <EditPanel
          isOpen={showEditPanel}
          onClose={() => setShowEditPanel(false)}
          entityType="inventory"
          data={selectedItem}
          onUpdate={handleUpdateSuccess}
          onDelete={handleDeleteSuccess}
        />

        {/* ============================================== */}
        {/* EDIT PANEL: CLASSIFICATION                     */}
        {/* Opens when user clicks edit icon on           */}
        {/* classification row; single Main tab only      */}
        {/* ============================================== */}
        <EditPanel
          isOpen={showClassEditPanel}
          onClose={() => setShowClassEditPanel(false)}
          entityType="classification"
          data={selectedClass}
          onUpdate={handleClassUpdateSuccess}
          onDelete={handleClassDeleteSuccess}
        />

        {/* ============================================== */}
        {/* CONFIRMATION DIALOGS                           */}
        {/* ============================================== */}
        <ConfirmationDialog
          isOpen={showItemConfirm}
          message="Click **OK** to add another item, or **Cancel** to return to inventory list."
          onConfirm={handleItemConfirmOk}
          onCancel={handleItemConfirmCancel}
        />

        <ConfirmationDialog
          isOpen={showClassConfirm}
          message="Click **OK** to add another classification, or **Cancel** to return to inventory list."
          onConfirm={handleClassConfirmOk}
          onCancel={handleClassConfirmCancel}
        />

      </div> {/* end flex-1 overflow-y-auto content area */}
    </div>
  );
};

export default InventoryPage;
