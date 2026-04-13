import React, { useEffect, useState, useRef } from 'react'; // useRef added for Add New dropdown click-outside detection
import { apiGetSuppliers, apiCreateSupplier } from '../lib/supplierApi';
// import FloatingActionMenu from '../components/ui/FloatingActionMenu'; // FAB commented out – kept for future use
import ConfirmationDialog from '../components/ui/ConfirmationDialog';
import EditPanel from '../components/ui/EditPanel';
import PageHeader from '../components/ui/PageHeader'; // Reusable dark header bar shared across pages
import { EditIcon } from '../components/ui/Icons'; // Only EditIcon is needed; PlusIcon/PackageIcon were for the FAB

// ==============================================
// TYPE DEFINITIONS
// ==============================================

interface Supplier {
  supplier_id: number;
  company_name: string;
  industry_name?: string;
  industry_code?: string;
  register_no_new?: string;
  control_ac?: string;
  branch_name?: string;
  register_no_old?: string;
  status?: string;
  tax_id?: number;
  bank_id?: number;
  contact_id?: number;
  liabilities_id?: number;
}

// ==============================================
// COMPONENT
// ==============================================

const SupplierPage: React.FC = () => {
  // ==============================================
  // STATE VARIABLES
  // ==============================================

  // Supplier list state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add modal state
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    industry_name: '',
    industry_code: '',
    register_no_new: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Edit panel state
  const [showEditPanel, setShowEditPanel] = useState(false);        // Controls edit panel visibility
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null); // Supplier being edited

  // Confirmation dialog state
  const [showConfirm, setShowConfirm] = useState(false);

  // Controls visibility of the "Add New" dropdown in the header
  const [showAddMenu, setShowAddMenu] = useState(false);
  // Ref attached to the dropdown container to detect outside clicks and close it
  const addMenuRef = useRef<HTMLDivElement>(null);

  // ==============================================
  // FETCH SUPPLIERS
  // ==============================================
  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError('');

      // Call backend API instead of Supabase directly
      const result = await apiGetSuppliers();
      if (!result.success) throw new Error(result.message);

      setSuppliers(result.data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch suppliers when component mounts
  useEffect(() => {
    fetchSuppliers();
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

  // ==============================================
  // ADD NEW SUPPLIER
  // ==============================================
  const handleAddSupplier = async () => {
    // Validate required field
    if (!formData.company_name.trim()) {
      setError('Company name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Call backend API (automatically creates log entry)
      const result = await apiCreateSupplier({
        company_name: formData.company_name,
        industry_name: formData.industry_name || null,
        industry_code: formData.industry_code || null,
        register_no_new: formData.register_no_new || null,
      });

      if (!result.success) throw new Error(result.message);

      // Refresh list after successful creation
      await fetchSuppliers();

      // Show custom confirmation instead of window.confirm
      setShowConfirm(true);
    } catch (err: any) {
      setError(err.message);
      console.error('Error adding supplier:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Called when user clicks "OK" on the confirmation
  const handleConfirmOk = () => {
    setShowConfirm(false);
    // Stay: reset form and keep modal open
    setFormData({ company_name: '', industry_name: '', industry_code: '', register_no_new: '' });
  };

  // Called when user clicks "Cancel" on the confirmation
  const handleConfirmCancel = () => {
    setShowConfirm(false);
    // Exit: close the modal
    setShowModal(false);
  };

  // Cancel modal and reset form
  const handleCancel = () => {
    setShowModal(false);
    setFormData({ company_name: '', industry_name: '', industry_code: '', register_no_new: '' });
    setError('');
  };

  // ==============================================
  // EDIT HANDLERS
  // ==============================================
  const handleEditClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowEditPanel(true);
  };

  const handleUpdateSuccess = () => {
    fetchSuppliers(); // Refresh list after update
  };

  const handleDeleteSuccess = () => {
    fetchSuppliers(); // Refresh list after delete
  };

  // ==============================================
  // RENDER
  // ==============================================
  return (
    // Outer wrapper fills the available space given by Layout and stacks header + content vertically
    <div className="flex flex-col h-full">

      {/* ============================================== */}
      {/* PAGE HEADER (reusable PageHeader component)    */}
      {/* onRefresh wires the Refresh List button        */}
      {/* The Add New dropdown is passed as children     */}
      {/* ============================================== */}
      <PageHeader title="Supplier Management" onRefresh={fetchSuppliers}>

        {/* Add New dropdown container – click outside closes the dropdown */}
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
              {/* Option: open the Add New Supplier form modal */}
              <button
                onClick={() => { setShowModal(true); setShowAddMenu(false); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
              >
                {/* Supplier (box/package) icon */}
                <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0v10l-8 4-8-4V7m8 4v10" />
                </svg>
                Supplier
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

        {/* Loading spinner */}
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="ml-3 text-gray-600">Loading suppliers...</span>
          </div>
        ) : (
          <>
            {/* Supplier Table Container */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Industry Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Industry Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Register No (New)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {suppliers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 0a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z" />
                          </svg>
                          <p className="mt-2">No suppliers found</p>
                          <p className="text-sm mt-1">Click the "Add New" button above to add a supplier.</p>
                        </td>
                      </tr>
                    ) : (
                      suppliers.map((supplier) => (
                        <tr key={supplier.supplier_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600">
                            {supplier.supplier_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                            {supplier.company_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {supplier.industry_name || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {supplier.industry_code || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {supplier.register_no_new || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button
                              onClick={() => handleEditClick(supplier)}
                              className="text-primary-600 hover:text-primary-800 transition-colors"
                              title="Edit supplier"
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

            {/* Footer summary – shows total count of loaded suppliers */}
            <div className="mt-4">
              <div className="text-sm text-gray-600">
                {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} found
              </div>
            </div>
          </>
        )}

        {/* ============================================== */}
        {/* FLOATING ACTION MENU (FAB) – commented out, kept for future use */}
        {/* ============================================== */}
        {/*
        <FloatingActionMenu
          options={[
            {
              label: 'Add New Supplier',
              icon: PackageIcon,
              onClick: () => setShowModal(true),
            }
          ]}
          mainIcon={PlusIcon}
          mainColor="bg-primary-600"
          optionColor="bg-orange-500"
        />
        */}

        {/* ============================================== */}
        {/* MODAL: ADD NEW SUPPLIER                        */}
        {/* ============================================== */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h2 className="text-xl font-semibold mb-4">Add New Supplier</h2>

              {/* Modal error display */}
              {error && (
                <div className="mb-4 p-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                  {error}
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleAddSupplier(); }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Industry Name
                    </label>
                    <input
                      type="text"
                      value={formData.industry_name}
                      onChange={(e) => setFormData({ ...formData, industry_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Industry Code
                    </label>
                    <input
                      type="text"
                      value={formData.industry_code}
                      onChange={(e) => setFormData({ ...formData, industry_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Register No (New)
                    </label>
                    <input
                      type="text"
                      value={formData.register_no_new}
                      onChange={(e) => setFormData({ ...formData, register_no_new: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={submitting}
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
                      'Add Supplier'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================== */}
        {/* EDIT PANEL                                     */}
        {/* ============================================== */}
        <EditPanel
          isOpen={showEditPanel}
          onClose={() => setShowEditPanel(false)}
          entityType="supplier"
          data={selectedSupplier}
          onUpdate={handleUpdateSuccess}
          onDelete={handleDeleteSuccess}
        />

        {/* ============================================== */}
        {/* CONFIRMATION DIALOG                            */}
        {/* ============================================== */}
        <ConfirmationDialog
          isOpen={showConfirm}
          message="Click **OK** to add another supplier, or **Cancel** to return to supplier list."
          onConfirm={handleConfirmOk}
          onCancel={handleConfirmCancel}
        />

      </div> {/* end flex-1 overflow-y-auto content area */}
    </div>
  );
};

export default SupplierPage;
