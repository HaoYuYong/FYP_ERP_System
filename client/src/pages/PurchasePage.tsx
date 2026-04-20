import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import AddNewFormModal from '../components/ui/AddNewFormModal';
import { PackageIcon } from '../components/ui/Icons';
import {
  apiGetCompanySettings,
  apiUpdateCompanySettings,
  CompanySettings,
} from '../lib/companySettingsApi';

const EMPTY_SETTINGS: CompanySettings = {
  settings_id: 1,
  company_name: '',
  register_no: '',
  address: '',
  city: '',
  state: '',
  country: '',
  post_code: '',
  phone: '',
  email: '',
  website: '',
};

const PurchasePage: React.FC = () => {
  const navigate = useNavigate();

  // ==============================================
  // COMPANY DETAILS STATE
  // ==============================================

  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyForm, setCompanyForm] = useState<CompanySettings>(EMPTY_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // ==============================================
  // HANDLERS
  // ==============================================

  const handlePurchaseRequestClick = () => navigate('/purchase/purchase_request');
  const handlePurchaseOrderClick = () => navigate('/purchase/purchase_order');

  const handleOpenCompanyModal = async () => {
    setShowCompanyModal(true);
    setSettingsError('');
    setSettingsSaved(false);
    setLoadingSettings(true);
    try {
      const result = await apiGetCompanySettings();
      if (result.success && result.data) {
        setCompanyForm({ ...EMPTY_SETTINGS, ...result.data });
      } else {
        setSettingsError(result.message || 'Failed to load company settings');
      }
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to load company settings');
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleCloseCompanyModal = () => {
    setShowCompanyModal(false);
    setSettingsError('');
    setSettingsSaved(false);
  };

  const handleCompanyFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setCompanyForm(prev => ({ ...prev, [name]: value }));
    setSettingsSaved(false);
  };

  const handleSaveCompanySettings = async () => {
    setSavingSettings(true);
    setSettingsError('');
    setSettingsSaved(false);
    try {
      const { settings_id, ...payload } = companyForm;
      const result = await apiUpdateCompanySettings(payload);
      if (!result.success) throw new Error(result.message);
      setSettingsSaved(true);
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to save company settings');
    } finally {
      setSavingSettings(false);
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
      <PageHeader title="Purchase Management">
        <button
          onClick={handleOpenCompanyModal}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Company Details
        </button>
      </PageHeader>

      {/* ============================================== */}
      {/* MAIN CONTENT AREA                              */}
      {/* ============================================== */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Purchase Request Card */}
          <div
            onClick={handlePurchaseRequestClick}
            className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer border border-gray-200 hover:border-primary-400 p-6 flex items-center space-x-6"
          >
            <div className="flex-shrink-0 w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <PackageIcon className="w-8 h-8 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-semibold text-gray-900 truncate">Purchase Request</h2>
              <p className="text-gray-600 text-sm mt-1">
                Create and manage purchase requests to send to suppliers
              </p>
            </div>
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          {/* Purchase Order Card */}
          <div
            onClick={handlePurchaseOrderClick}
            className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer border border-gray-200 hover:border-primary-400 p-6 flex items-center space-x-6"
          >
            <div className="flex-shrink-0 w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <PackageIcon className="w-8 h-8 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-semibold text-gray-900 truncate">Purchase Order</h2>
              <p className="text-gray-600 text-sm mt-1">
                Create and manage purchase orders after receiving supplier quotations
              </p>
            </div>
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

        </div>
      </div>

      {/* ============================================== */}
      {/* COMPANY DETAILS MODAL                          */}
      {/* ============================================== */}
      <AddNewFormModal
        isOpen={showCompanyModal}
        title="Company Details"
        onClose={handleCloseCompanyModal}
        maxWidth="max-w-xl"
      >
        {loadingSettings ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="ml-3 text-gray-600">Loading settings...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Error */}
            {settingsError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                {settingsError}
              </div>
            )}

            {/* Success */}
            {settingsSaved && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
                Company details saved successfully.
              </div>
            )}

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                name="company_name"
                value={companyForm.company_name}
                onChange={handleCompanyFormChange}
                placeholder="e.g. Acme Sdn Bhd"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Register No */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration No</label>
              <input
                type="text"
                name="register_no"
                value={companyForm.register_no}
                onChange={handleCompanyFormChange}
                placeholder="e.g. 202301012345"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                name="address"
                value={companyForm.address}
                onChange={handleCompanyFormChange}
                rows={2}
                placeholder="e.g. No. 1, Jalan Utama"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* City / State row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  value={companyForm.city}
                  onChange={handleCompanyFormChange}
                  placeholder="e.g. Kuala Lumpur"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  name="state"
                  value={companyForm.state}
                  onChange={handleCompanyFormChange}
                  placeholder="e.g. Selangor"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Country / Post Code row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  name="country"
                  value={companyForm.country}
                  onChange={handleCompanyFormChange}
                  placeholder="e.g. Malaysia"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Post Code</label>
                <input
                  type="text"
                  name="post_code"
                  value={companyForm.post_code}
                  onChange={handleCompanyFormChange}
                  placeholder="e.g. 50480"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Phone / Email row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  name="phone"
                  value={companyForm.phone}
                  onChange={handleCompanyFormChange}
                  placeholder="e.g. +603-1234 5678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={companyForm.email}
                  onChange={handleCompanyFormChange}
                  placeholder="e.g. info@company.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                type="text"
                name="website"
                value={companyForm.website}
                onChange={handleCompanyFormChange}
                placeholder="e.g. www.company.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-3 pt-2 border-t mt-6">
              <button
                onClick={handleCloseCompanyModal}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCompanySettings}
                disabled={savingSettings}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {savingSettings ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </AddNewFormModal>

    </div>
  );
};

export default PurchasePage;
