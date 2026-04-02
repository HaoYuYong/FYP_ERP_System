import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import FloatingActionMenu from '../components/ui/FloatingActionMenu';
import ConfirmationDialog from '../components/ui/ConfirmationDialog';
import EditPanel from '../components/ui/EditPanel'; // Import edit panel
import { PlusIcon, UsersIcon, EditIcon } from '../components/ui/Icons';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

interface Customer {
  customer_id: number;
  company_name: string;
  industry_name?: string;
  industry_code?: string;
  register_no_new?: string;
  // Additional fields for full editing
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

const CustomerPage: React.FC = () => {
  // ==============================================
  // STATE VARIABLES
  // ==============================================

  // Customer list state
  const [customers, setCustomers] = useState<Customer[]>([]);
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
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Confirmation dialog state
  const [showConfirm, setShowConfirm] = useState(false);

  // ==============================================
  // FETCH CUSTOMERS
  // ==============================================
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all fields needed for editing (including foreign keys)
      const { data, error: fetchError } = await supabase
        .from('customer')
        .select(`
          customer_id,
          company_name,
          industry_name,
          industry_code,
          register_no_new,
          control_ac,
          branch_name,
          register_no_old,
          status,
          tax_id,
          bank_id,
          contact_id,
          liabilities_id
        `)
        .order('customer_id', { ascending: true });

      if (fetchError) throw fetchError;

      setCustomers(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch customers when component mounts
  useEffect(() => {
    fetchCustomers();
  }, []);

  // ==============================================
  // ADD NEW CUSTOMER
  // ==============================================
  const handleAddCustomer = async () => {
    // Validate required field
    if (!formData.company_name.trim()) {
      setError('Company name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const newCustomer = {
        company_name: formData.company_name,
        industry_name: formData.industry_name || null,
        industry_code: formData.industry_code || null,
        register_no_new: formData.register_no_new || null,
      };

      const { error: insertError } = await supabase
        .from('customer')
        .insert([newCustomer]);

      if (insertError) throw insertError;

      await fetchCustomers(); // Refresh the list

      // Show custom confirmation instead of window.confirm
      setShowConfirm(true);
    } catch (err: any) {
      setError(err.message);
      console.error('Error adding customer:', err);
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
  const handleEditClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowEditPanel(true);
  };

  const handleUpdateSuccess = () => {
    fetchCustomers(); // Refresh list after update
  };

  const handleDeleteSuccess = () => {
    fetchCustomers(); // Refresh list after delete
  };

  // ==============================================
  // RENDER
  // ==============================================
  return (
    <div className="p-6">
      {/* Page title */}
      <h1 className="text-2xl font-bold mb-6">Customer Management</h1>

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
          <span className="ml-3 text-gray-600">Loading customers...</span>
        </div>
      ) : (
        <>
          {/* Customer Table Container */}
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
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 0a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z" />
                        </svg>
                        <p className="mt-2">No customers found</p>
                        <p className="text-sm mt-1">Click the + button to add a customer.</p>
                      </td>
                    </tr>
                  ) : (
                    customers.map((customer) => (
                      <tr key={customer.customer_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600">
                          {customer.customer_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {customer.company_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.industry_name || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.industry_code || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {customer.register_no_new || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => handleEditClick(customer)}
                            className="text-primary-600 hover:text-primary-800 transition-colors"
                            title="Edit customer"
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

          {/* Footer with summary and refresh button (outside the table box) */}
          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {customers.length} customer{customers.length !== 1 ? 's' : ''} found
            </div>
            <button
              onClick={fetchCustomers}
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
            label: 'Add New Customer',
            icon: UsersIcon, // Reuse users icon for customer
            onClick: () => setShowModal(true),
          }
        ]}
        mainIcon={PlusIcon}
        mainColor="bg-primary-600"
        optionColor="bg-orange-500"
      />

      {/* ============================================== */}
      {/* MODAL: ADD NEW CUSTOMER                        */}
      {/* ============================================== */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Add New Customer</h2>

            {error && (
              <div className="mb-4 p-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {error}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleAddCustomer(); }}>
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
                    'Add Customer'
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
        entityType="customer"
        data={selectedCustomer}
        onUpdate={handleUpdateSuccess}
        onDelete={handleDeleteSuccess}
      />

      {/* ============================================== */}
      {/* CONFIRMATION DIALOG                            */}
      {/* ============================================== */}
      <ConfirmationDialog
        isOpen={showConfirm}
        message="Click **OK** to add another customer, or **Cancel** to return to customer list."
        onConfirm={handleConfirmOk}
        onCancel={handleConfirmCancel}
      />
    </div>
  );
};

export default CustomerPage;