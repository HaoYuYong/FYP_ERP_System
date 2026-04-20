import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  apiUpdateInventoryItem,
  apiDeleteInventoryItem,
  apiGetClassifications,
  apiUpdateClassification,
  apiDeleteClassification,
} from '../../lib/inventoryApi';
import { apiUpdateCustomer, apiDeleteCustomer } from '../../lib/customerApi';
import { apiUpdateSupplier, apiDeleteSupplier } from '../../lib/supplierApi';
import {
  apiUpdatePurchaseRequest,
  apiGetSuppliersWithDetails,
  apiGetInventoryItems,
} from '../../lib/purchaseRequestApi';
import { apiUpdatePurchaseOrder } from '../../lib/purchaseOrderApi';
import {
  apiGetSuppliersWithDetails as apiGetPOSuppliersWithDetails,
  apiGetInventoryItems as apiGetPOInventoryItems,
} from '../../lib/purchaseOrderApi';
import ConfirmationDialog from './ConfirmationDialog';

// ==============================================
// TYPE DEFINITIONS
// ==============================================

// Generic type for any entity data
interface EditPanelProps {
  isOpen: boolean;                    // Whether panel is visible
  onClose: () => void;                // Close panel (without saving)
  entityType: 'inventory' | 'customer' | 'supplier' | 'classification' | 'purchase_request' | 'purchase_order'; // Type of entity being edited
  data: any;                          // Current entity data (from table row)
  onUpdate: () => void;               // Callback after successful update
  onDelete?: () => void;              // Callback after successful delete (optional for PR)
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

  // Current active tab (inventory: main/quantity/classification; customer/supplier: main/bank/contact/tax/liabilities; PR: main/items/supplier)
  const [activeTab, setActiveTab] = useState<'main' | 'quantity' | 'classification' | 'bank' | 'contact' | 'tax' | 'liabilities' | 'items' | 'supplier'>('main');

  // Form data for main fields (inventory/customer/supplier)
  const [mainData, setMainData] = useState<any>({});

  // Inventory-specific states
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
  // PURCHASE REQUEST EDITING STATE
  // ==============================================

  // Editable copy of PR line items for the Items tab
  const [prItems, setPrItems] = useState<any[]>([]);
  // Selected supplier ID for PR (drives Supplier tab display)
  const [prSupplierId, setPrSupplierId] = useState<number | null>(null);
  // Live supplier info displayed on Supplier tab (auto-filled from dropdown selection)
  const [prSupplierInfo, setPrSupplierInfo] = useState<any>({});
  // All suppliers with contact details for the Supplier tab dropdown
  const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
  // All inventory items for the Items tab item_name dropdown
  const [allInventoryItems, setAllInventoryItems] = useState<any[]>([]);
  // Loading state while fetching PR dropdown data
  const [loadingPRDropdowns, setLoadingPRDropdowns] = useState(false);

  // Refresh item confirmation dialog state (PR Items tab)
  const [prRefreshConfirmOpen, setPrRefreshConfirmOpen] = useState(false);
  const [prRefreshPendingIndex, setPrRefreshPendingIndex] = useState<number | null>(null);
  const [prRefreshPendingData, setPrRefreshPendingData] = useState<{ item_name: string; item_description: string; uom: string } | null>(null);
  const [prRefreshDiff, setPrRefreshDiff] = useState<{ label: string; before: string; after: string }[]>([]);
  // Per-item inline messages: key = pri_id or _tempId or index; value = { type, text }
  const [prItemMessages, setPrItemMessages] = useState<Record<string, { type: 'info' | 'success'; text: string }>>({});

  // ==============================================
  // PURCHASE ORDER EDITING STATE
  // ==============================================

  const [poItems, setPoItems] = useState<any[]>([]);
  const [poSupplierId, setPoSupplierId] = useState<number | null>(null);
  const [poSupplierInfo, setPoSupplierInfo] = useState<any>({});
  const [allPOSuppliers, setAllPOSuppliers] = useState<any[]>([]);
  const [allPOInventoryItems, setAllPOInventoryItems] = useState<any[]>([]);
  const [loadingPODropdowns, setLoadingPODropdowns] = useState(false);

  // Refresh item confirmation dialog state (PO Items tab)
  const [poRefreshConfirmOpen, setPoRefreshConfirmOpen] = useState(false);
  const [poRefreshPendingIndex, setPoRefreshPendingIndex] = useState<number | null>(null);
  const [poRefreshPendingData, setPoRefreshPendingData] = useState<{ item_name: string; item_description: string; uom: string } | null>(null);
  const [poRefreshDiff, setPoRefreshDiff] = useState<{ label: string; before: string; after: string }[]>([]);
  const [poItemMessages, setPoItemMessages] = useState<Record<string, { type: 'info' | 'success'; text: string }>>({});

  // PO Receiving mode state
  const [poReceivingMode, setPoReceivingMode] = useState(false);
  const [poReceivingQuantities, setPoReceivingQuantities] = useState<Record<number, string>>({});
  const [poUpdateAgainMode, setPoUpdateAgainMode] = useState(false);
  const [poUpdateAgainQuantities, setPoUpdateAgainQuantities] = useState<Record<number, string>>({});
  const [showCloseOutstandingConfirm, setShowCloseOutstandingConfirm] = useState(false);

  // Floating alert reminder state
  const [showFloatingAlert, setShowFloatingAlert] = useState(false);
  const [floatingAlertTop, setFloatingAlertTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);

  // ==============================================
  // EFFECTS – Load data when panel opens
  // ==============================================
  useEffect(() => {
    if (isOpen && data) {
      // Always start on Main tab and clear previous errors when panel opens
      setActiveTab('main');
      setError('');
      setMainData({ ...data });

      if (entityType === 'inventory') {
        // Fetch all classifications for dropdown
        fetchClassifications();
        setSelectedClassId(data.classification_id || null);
        if (data.classification) {
          setSelectedClassTitle(data.classification.classification_title);
          setSelectedClassDesc(data.classification.classification_description);
        }
      } else if (entityType === 'customer' || entityType === 'supplier') {
        // Fetch related records (bank, contact, tax, liabilities) using foreign keys
        fetchRelatedData();
      } else if (entityType === 'purchase_request') {
        // Copy PR line items into local editable state
        setPrItems(data.items ? data.items.map((i: any) => ({ ...i })) : []);
        // Pre-fill supplier display from PR snapshot columns (not live supplier data)
        setPrSupplierId(data.supplier_id || null);
        setPrSupplierInfo({
          company_name:    data.supplier_company_name || '',
          register_no_new: data.supplier_register_no  || '',
          email:           data.supplier_email        || '',
          phone:           data.supplier_phone        || '',
          address:         data.supplier_address      || '',
        });
        // Fetch supplier list and inventory items for dropdowns
        fetchPRDropdownData();
      } else if (entityType === 'purchase_order') {
        // Copy PO line items into local editable state
        setPoItems(data.items ? data.items.map((i: any) => ({ ...i })) : []);
        // Pre-fill supplier display from PO snapshot columns
        setPoSupplierId(data.supplier_id || null);
        setPoSupplierInfo({
          company_name:    data.supplier_company_name || '',
          register_no_new: data.supplier_register_no  || '',
          email:           data.supplier_email        || '',
          phone:           data.supplier_phone        || '',
          address:         data.supplier_address      || '',
        });
        fetchPODropdownData();
        setPoReceivingMode(false);
        setPoReceivingQuantities({});
        setPoUpdateAgainMode(false);
        setPoUpdateAgainQuantities({});
      }
    }
  }, [isOpen, data, entityType]);

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

  // Scroll handler: show floating alert reminder when alerts scroll out of view
  const handleContentScroll = useCallback(() => {
    if (!scrollContainerRef.current || !alertsRef.current) return;
    const containerRect = scrollContainerRef.current.getBoundingClientRect();
    const alertsRect = alertsRef.current.getBoundingClientRect();
    setFloatingAlertTop(containerRect.top);
    setShowFloatingAlert(alertsRect.bottom < containerRect.top);
  }, []);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      setFloatingAlertTop(scrollContainerRef.current.getBoundingClientRect().top);
    }
    if (!isOpen) setShowFloatingAlert(false);
  }, [isOpen]);

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

  // Fetch all suppliers and inventory items for PO editing dropdowns.
  const fetchPODropdownData = async () => {
    setLoadingPODropdowns(true);
    try {
      const [suppliersResult, itemsResult] = await Promise.all([
        apiGetPOSuppliersWithDetails(),
        apiGetPOInventoryItems(),
      ]);
      if (suppliersResult.success) setAllPOSuppliers(suppliersResult.data || []);
      if (itemsResult.success)    setAllPOInventoryItems(itemsResult.data || []);
    } catch (err: any) {
      console.error('Error fetching PO dropdown data:', err);
    } finally {
      setLoadingPODropdowns(false);
    }
  };

  // Fetch all suppliers (with contact details) and inventory items for PR editing dropdowns.
  // Supplier info display is pre-filled from PR snapshot columns — NOT from this data.
  const fetchPRDropdownData = async () => {
    setLoadingPRDropdowns(true);
    try {
      const [suppliersResult, itemsResult] = await Promise.all([
        apiGetSuppliersWithDetails(),
        apiGetInventoryItems(),
      ]);

      if (suppliersResult.success) setAllSuppliers(suppliersResult.data || []);
      if (itemsResult.success)    setAllInventoryItems(itemsResult.data || []);
    } catch (err: any) {
      console.error('Error fetching PR dropdown data:', err);
    } finally {
      setLoadingPRDropdowns(false);
    }
  };

  // Handle supplier selection on Supplier tab – auto-fills read-only contact fields
  const handlePRSupplierChange = (supplierId: number | null) => {
    setPrSupplierId(supplierId);
    if (supplierId) {
      const sup = allSuppliers.find((s: any) => s.supplier_id === supplierId);
      if (sup) setPrSupplierInfo(sup);
    } else {
      setPrSupplierInfo({});
    }
  };

  // Handle item_name selection on Items tab – auto-fills item_id, item_description, uom
  const handlePRItemNameChange = (index: number, newItemId: number | string) => {
    const invItem = allInventoryItems.find((i: any) => i.item_id === Number(newItemId));
    if (!invItem) return;
    setPrItems(prev =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              item_id: invItem.item_id,
              item_name: invItem.item_name,
              item_description: invItem.description || '',
              uom: invItem.uom || '',
            }
          : item
      )
    );
  };

  // Handle pri_quantity change on Items tab – updates quantity for a single line item
  const handlePRItemQuantityChange = (index: number, value: string) => {
    setPrItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, pri_quantity: value } : item))
    );
  };

  // Add Item button – appends a blank item card to the Items tab
  const handleAddPRItem = () => {
    setPrItems(prev => [{
      _tempId: Date.now(), // stable React key for new items
      item_id: null,
      item_name: '',
      item_description: '',
      uom: '',
      pri_quantity: 1,
    }, ...prev]);
  };

  // Remove button per item – removes item card at given index (deleted from DB on Update)
  const handleRemovePRItem = (index: number) => {
    setPrItems(prev => prev.filter((_, i) => i !== index));
  };

  // Helper to get a stable per-item message key
  const prItemKey = (item: any, index: number): string =>
    String(item.pri_id ?? item._tempId ?? index);

  // Helper to show a timed inline message on a PR item card, then auto-clear after 3 s
  const showPrItemMessage = (key: string, type: 'info' | 'success', text: string) => {
    setPrItemMessages(prev => ({ ...prev, [key]: { type, text } }));
    setTimeout(() => {
      setPrItemMessages(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 3000);
  };

  // Refresh button per item – compares current values against inventory and shows a diff dialog
  const handleRefreshItem = (index: number) => {
    const item = prItems[index];
    if (!item?.item_id) return;
    const invItem = allInventoryItems.find((i: any) => i.item_id === item.item_id);
    if (!invItem) return;

    const key = prItemKey(item, index);

    // Build diff: compare item_name, item_description, uom
    const candidateName = invItem.item_name || '';
    const candidateDesc = invItem.description || '';
    const candidateUom  = invItem.uom || '';

    const currentName = item.item_name || '';
    const currentDesc = item.item_description || '';
    const currentUom  = item.uom || '';

    const diff: { label: string; before: string; after: string }[] = [];
    if (currentName !== candidateName) diff.push({ label: 'Item Name',        before: currentName, after: candidateName });
    if (currentDesc !== candidateDesc) diff.push({ label: 'Item Description', before: currentDesc, after: candidateDesc });
    if (currentUom  !== candidateUom)  diff.push({ label: 'UOM',              before: currentUom,  after: candidateUom });

    if (diff.length === 0) {
      showPrItemMessage(key, 'info', 'Item is already up to date.');
      return;
    }

    // Store pending data and open confirmation dialog
    setPrRefreshPendingIndex(index);
    setPrRefreshPendingData({ item_name: candidateName, item_description: candidateDesc, uom: candidateUom });
    setPrRefreshDiff(diff);
    setPrRefreshConfirmOpen(true);
  };

  // Apply the refresh if user confirms
  const handleRefreshItemConfirm = () => {
    if (prRefreshPendingIndex === null || !prRefreshPendingData) return;
    const index = prRefreshPendingIndex;
    const item = prItems[index];
    const key = prItemKey(item, index);

    setPrItems(prev =>
      prev.map((it, i) =>
        i === index
          ? { ...it, ...prRefreshPendingData }
          : it
      )
    );

    setPrRefreshConfirmOpen(false);
    setPrRefreshPendingIndex(null);
    setPrRefreshPendingData(null);
    setPrRefreshDiff([]);
    showPrItemMessage(key, 'success', 'Item refreshed successfully.');
  };

  // Cancel the refresh — no changes
  const handleRefreshItemCancel = () => {
    setPrRefreshConfirmOpen(false);
    setPrRefreshPendingIndex(null);
    setPrRefreshPendingData(null);
    setPrRefreshDiff([]);
  };

  // Refresh button for supplier – re-pulls contact details from allSuppliers using current prSupplierId
  const handleRefreshSupplier = () => {
    if (!prSupplierId) return;
    const sup = allSuppliers.find((s: any) => s.supplier_id === prSupplierId);
    if (sup) setPrSupplierInfo(sup);
  };

  // ==============================================
  // PURCHASE ORDER ITEM/SUPPLIER HANDLERS
  // ==============================================

  const handlePOSupplierChange = (supplierId: number | null) => {
    setPoSupplierId(supplierId);
    if (supplierId) {
      const sup = allPOSuppliers.find((s: any) => s.supplier_id === supplierId);
      if (sup) setPoSupplierInfo(sup);
    } else {
      setPoSupplierInfo({});
    }
  };

  const handleRefreshPOSupplier = () => {
    if (!poSupplierId) return;
    const sup = allPOSuppliers.find((s: any) => s.supplier_id === poSupplierId);
    if (sup) setPoSupplierInfo(sup);
  };

  const handlePOItemNameChange = (index: number, newItemId: number | string) => {
    const invItem = allPOInventoryItems.find((i: any) => i.item_id === Number(newItemId));
    if (!invItem) return;
    setPoItems(prev =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              item_id: invItem.item_id,
              item_name: invItem.item_name,
              item_description: invItem.description || '',
              uom: invItem.uom || '',
            }
          : item
      )
    );
  };

  const handlePOItemFieldChange = (index: number, field: string, value: string) => {
    setPoItems(prev =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        // Recalculate line_total whenever qty, unit_price, or discount changes
        if (field === 'poi_quantity' || field === 'unit_price' || field === 'discount') {
          const qty   = parseFloat(field === 'poi_quantity' ? value : item.poi_quantity) || 0;
          const price = parseFloat(field === 'unit_price'   ? value : item.unit_price)   || 0;
          const disc  = parseFloat(field === 'discount'     ? value : item.discount)     || 0;
          updated.line_total = Math.max(0, qty * price - disc);
        }
        return updated;
      })
    );
  };

  const handleAddPOItem = () => {
    setPoItems(prev => [{
      _tempId: Date.now(),
      item_id: null,
      item_name: '',
      item_description: '',
      uom: '',
      poi_quantity: 1,
      unit_price: 0,
      discount: 0,
      line_total: 0,
    }, ...prev]);
  };

  const handleRemovePOItem = (index: number) => {
    setPoItems(prev => prev.filter((_, i) => i !== index));
  };

  const poItemKey = (item: any, index: number): string =>
    String(item.poi_id ?? item._tempId ?? index);

  const showPoItemMessage = (key: string, type: 'info' | 'success', text: string) => {
    setPoItemMessages(prev => ({ ...prev, [key]: { type, text } }));
    setTimeout(() => {
      setPoItemMessages(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 3000);
  };

  const handleRefreshPOItem = (index: number) => {
    const item = poItems[index];
    if (!item?.item_id) return;
    const invItem = allPOInventoryItems.find((i: any) => i.item_id === item.item_id);
    if (!invItem) return;

    const key = poItemKey(item, index);

    const candidateName = invItem.item_name || '';
    const candidateDesc = invItem.description || '';
    const candidateUom  = invItem.uom || '';

    const currentName = item.item_name || '';
    const currentDesc = item.item_description || '';
    const currentUom  = item.uom || '';

    const diff: { label: string; before: string; after: string }[] = [];
    if (currentName !== candidateName) diff.push({ label: 'Item Name',        before: currentName, after: candidateName });
    if (currentDesc !== candidateDesc) diff.push({ label: 'Item Description', before: currentDesc, after: candidateDesc });
    if (currentUom  !== candidateUom)  diff.push({ label: 'UOM',              before: currentUom,  after: candidateUom });

    if (diff.length === 0) {
      showPoItemMessage(key, 'info', 'Item is already up to date.');
      return;
    }

    setPoRefreshPendingIndex(index);
    setPoRefreshPendingData({ item_name: candidateName, item_description: candidateDesc, uom: candidateUom });
    setPoRefreshDiff(diff);
    setPoRefreshConfirmOpen(true);
  };

  const handleRefreshPOItemConfirm = () => {
    if (poRefreshPendingIndex === null || !poRefreshPendingData) return;
    const index = poRefreshPendingIndex;
    const item = poItems[index];
    const key = poItemKey(item, index);

    setPoItems(prev =>
      prev.map((it, i) =>
        i === index ? { ...it, ...poRefreshPendingData } : it
      )
    );

    setPoRefreshConfirmOpen(false);
    setPoRefreshPendingIndex(null);
    setPoRefreshPendingData(null);
    setPoRefreshDiff([]);
    showPoItemMessage(key, 'success', 'Item refreshed successfully.');
  };

  const handleRefreshPOItemCancel = () => {
    setPoRefreshConfirmOpen(false);
    setPoRefreshPendingIndex(null);
    setPoRefreshPendingData(null);
    setPoRefreshDiff([]);
  };

  // ==============================================
  // PO RECEIVING MODE HELPERS
  // ==============================================

  const poHasOutstanding = (): boolean =>
    poItems.some(item => parseFloat(item.received_quantity ?? 0) < parseFloat(item.poi_quantity));

  const poOutstandingItems = () =>
    poItems.filter(item => parseFloat(item.received_quantity ?? 0) < parseFloat(item.poi_quantity));

  const handlePOStatusChange = (newStatus: string) => {
    if (newStatus === 'received' && mainData.status !== 'received') {
      const initialQtys: Record<number, string> = {};
      poItems.forEach(item => { initialQtys[item.poi_id] = String(item.poi_quantity); });
      setPoReceivingQuantities(initialQtys);
      setPoReceivingMode(true);
    } else if (newStatus === 'closed' && poHasOutstanding()) {
      setShowCloseOutstandingConfirm(true);
    } else {
      setMainData({ ...mainData, status: newStatus });
    }
  };

  const poHasEmptyUnitPrice = () =>
    poItems.some(item => !item.unit_price || parseFloat(item.unit_price) === 0);

  const handleCancelReceiving = () => {
    setPoReceivingMode(false);
    setPoReceivingQuantities({});
  };

  const handleConfirmCloseOutstanding = () => {
    setShowCloseOutstandingConfirm(false);
    setMainData({ ...mainData, status: 'closed' });
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
          ref_cost: mainData.ref_cost ? parseFloat(mainData.ref_cost) : undefined,
          ref_price: mainData.ref_price ? parseFloat(mainData.ref_price) : undefined,
          remark_1: mainData.remark_1 || undefined,
          remark_2: mainData.remark_2 || undefined,
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
      } else if (entityType === 'classification') {
        // Call backend API for classification (automatically creates log entry)
        const result = await apiUpdateClassification({
          classification_id: data.classification_id,
          classification_code: mainData.classification_code,
          classification_title: mainData.classification_title,
          classification_description: mainData.classification_description || undefined,
        });

        if (!result.success) throw new Error(result.message || 'Failed to update classification');
      } else if (entityType === 'purchase_request') {
        // Validate all items have a name selected before sending
        if (prItems.some(item => !item.item_name || !item.item_name.trim())) {
          throw new Error('All items must have an item name selected.');
        }

        // Build items payload, parsing quantity to float for each line item
        const itemsPayload = prItems.map(item => ({
          pri_id: item.pri_id,
          item_id: item.item_id || null,
          item_name: item.item_name,
          item_description: item.item_description || item.item_name,
          uom: item.uom || null,
          pri_quantity: parseFloat(item.pri_quantity),
        }));

        // Call backend API to update PR header + line items (automatically creates log entry)
        const result = await apiUpdatePurchaseRequest({
          pr_id: data.pr_id,
          reference_no: mainData.reference_no,
          terms: mainData.terms,
          remarks: mainData.remarks,
          status: mainData.status,
          supplier_id: prSupplierId !== undefined ? prSupplierId : undefined,
          items: itemsPayload,
        });

        if (!result.success) throw new Error(result.message || 'Failed to update purchase request');
      } else if (entityType === 'purchase_order') {
        if (poReceivingMode) {
          const itemsPayload = poItems.map(item => ({
            poi_id: item.poi_id,
            item_id: item.item_id || null,
            item_name: item.item_name,
            item_description: item.item_description || item.item_name,
            uom: item.uom || null,
            poi_quantity: parseFloat(item.poi_quantity),
            unit_price: parseFloat(item.unit_price) || 0,
            discount: parseFloat(item.discount) || 0,
            received_quantity: parseFloat(poReceivingQuantities[item.poi_id] ?? String(item.poi_quantity)) || 0,
          }));

          const result = await apiUpdatePurchaseOrder({ po_id: data.po_id, status: 'received', items: itemsPayload });
          if (!result.success) throw new Error(result.message || 'Failed to update purchase order');

          const hasOutstanding = itemsPayload.some(i => i.received_quantity < i.poi_quantity);
          setPoReceivingMode(false);
          setPoReceivingQuantities({});
          onUpdate();
          if (!hasOutstanding) onClose();
          return;

        } else if (poUpdateAgainMode) {
          const itemsPayload = poItems.map(item => {
            const lastReceived = parseFloat(item.received_quantity ?? 0);
            const currentInput = parseFloat(poUpdateAgainQuantities[item.poi_id] || '0') || 0;
            const outstanding = parseFloat(item.poi_quantity) - lastReceived;
            const newReceived = outstanding > 0 && currentInput > 0 ? lastReceived + currentInput : lastReceived;
            return {
              poi_id: item.poi_id,
              item_id: item.item_id || null,
              item_name: item.item_name,
              item_description: item.item_description || item.item_name,
              uom: item.uom || null,
              poi_quantity: parseFloat(item.poi_quantity),
              unit_price: parseFloat(item.unit_price) || 0,
              discount: parseFloat(item.discount) || 0,
              received_quantity: newReceived,
            };
          });

          const result = await apiUpdatePurchaseOrder({ po_id: data.po_id, status: 'received', items: itemsPayload });
          if (!result.success) throw new Error(result.message || 'Failed to update purchase order');

          const stillOutstanding = itemsPayload.some(i => i.received_quantity < i.poi_quantity);
          setPoUpdateAgainMode(false);
          setPoUpdateAgainQuantities({});
          onUpdate();
          if (!stillOutstanding) onClose();
          return;

        } else {
          if (poItems.some(item => !item.item_name || !item.item_name.trim())) {
            throw new Error('All items must have an item name selected.');
          }

          const itemsPayload = poItems.map(item => ({
            poi_id: item.poi_id,
            item_id: item.item_id || null,
            item_name: item.item_name,
            item_description: item.item_description || item.item_name,
            uom: item.uom || null,
            poi_quantity: parseFloat(item.poi_quantity),
            unit_price: parseFloat(item.unit_price) || 0,
            discount: parseFloat(item.discount) || 0,
          }));

          const result = await apiUpdatePurchaseOrder({
            po_id: data.po_id,
            reference_no: mainData.reference_no,
            terms: mainData.terms,
            delivery_date: mainData.delivery_date || null,
            remarks: mainData.remarks,
            status: mainData.status,
            supplier_id: poSupplierId !== undefined ? poSupplierId : undefined,
            items: itemsPayload,
          });

          if (!result.success) throw new Error(result.message || 'Failed to update purchase order');
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
      } else if (entityType === 'classification') {
        // Call backend API for classification delete (automatically creates log entry)
        const result = await apiDeleteClassification(data.classification_id);
        if (!result.success) throw new Error(result.message || 'Failed to delete classification');
      }

      onDelete?.(); // Refresh list
      onClose();    // Close panel
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

  const isInventory = entityType === 'inventory';
  const isCustomerSupplier = entityType === 'customer' || entityType === 'supplier';
  const isClassification = entityType === 'classification';
  const isPurchaseRequest = entityType === 'purchase_request';
  const isPurchaseOrder = entityType === 'purchase_order';
  // All fields (except Status) editable only in Draft
  const isPRFieldsEditable = isPurchaseRequest && data?.status === 'draft';
  // Status dropdown editable in Draft/Sent/Received; locked in Closed
  const isStatusEditable = isPurchaseRequest && data?.status !== 'closed';
  // PO gate rules (same pattern as PR; PO has 5 statuses: draft/sent/confirmed/received/closed)
  const isPOFieldsEditable = isPurchaseOrder && data?.status === 'draft';
  const isPOStatusEditable = isPurchaseOrder && data?.status !== 'closed';

  return (
    <>
      {/* Semi-transparent backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black transition-opacity z-40 ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Right-side slide-out panel */}
      <div
        className={`fixed right-0 top-0 h-screen w-full max-w-xl bg-white shadow-2xl border-l-2 border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header (fixed at top) */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 py-4 px-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            {isPurchaseRequest
              ? 'Edit Purchase Request Details'
              : isPurchaseOrder
                ? 'Edit Purchase Order Details'
                : `Edit ${
                    entityType === 'inventory'
                      ? 'Item Details'
                      : entityType === 'customer'
                        ? 'Customer Details'
                        : entityType === 'supplier'
                          ? 'Supplier Details'
                          : 'Classification Details'
                  }`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tabs Section (fixed, doesn't scroll) – all entity types now have tabs */}
        {(!isPurchaseOrder || (!poReceivingMode && !poUpdateAgainMode)) && (
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2">
          <nav className="-mb-px flex flex-wrap gap-2">
            {/* Main tab: present for every entity type */}
            <button
              onClick={() => setActiveTab('main')}
              className={`py-1 px-3 border-b-2 font-medium text-sm ${
                activeTab === 'main'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Main
            </button>

            {/* Inventory-only tabs */}
            {isInventory && (
              <>
                <button
                  onClick={() => setActiveTab('quantity')}
                  className={`py-1 px-3 border-b-2 font-medium text-sm ${
                    activeTab === 'quantity'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Quantity
                </button>
                <button
                  onClick={() => setActiveTab('classification')}
                  className={`py-1 px-3 border-b-2 font-medium text-sm ${
                    activeTab === 'classification'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Classification
                </button>
              </>
            )}

            {/* Customer/Supplier-only tabs */}
            {isCustomerSupplier && (
              <>
                <button
                  onClick={() => setActiveTab('bank')}
                  className={`py-1 px-3 border-b-2 font-medium text-sm ${
                    activeTab === 'bank'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Bank
                </button>
                <button
                  onClick={() => setActiveTab('contact')}
                  className={`py-1 px-3 border-b-2 font-medium text-sm ${
                    activeTab === 'contact'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Contact
                </button>
                <button
                  onClick={() => setActiveTab('tax')}
                  className={`py-1 px-3 border-b-2 font-medium text-sm ${
                    activeTab === 'tax'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Tax
                </button>
                <button
                  onClick={() => setActiveTab('liabilities')}
                  className={`py-1 px-3 border-b-2 font-medium text-sm ${
                    activeTab === 'liabilities'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Liabilities
                </button>
              </>
            )}

            {/* Purchase Request-only tabs */}
            {isPurchaseRequest && (
              <>
                <button
                  onClick={() => setActiveTab('items')}
                  className={`py-1 px-3 border-b-2 font-medium text-sm ${
                    activeTab === 'items'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Items
                </button>
                <button
                  onClick={() => setActiveTab('supplier')}
                  className={`py-1 px-3 border-b-2 font-medium text-sm ${
                    activeTab === 'supplier'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Supplier
                </button>
              </>
            )}

            {/* Purchase Order-only tabs */}
            {isPurchaseOrder && (
              <>
                <button
                  onClick={() => setActiveTab('items')}
                  className={`py-1 px-3 border-b-2 font-medium text-sm ${
                    activeTab === 'items'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Items
                </button>
                <button
                  onClick={() => setActiveTab('supplier')}
                  className={`py-1 px-3 border-b-2 font-medium text-sm ${
                    activeTab === 'supplier'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Supplier
                </button>
              </>
            )}
          </nav>
        </div>
        )}

        {/* Scrollable content area */}
        <div ref={scrollContainerRef} onScroll={handleContentScroll} className="flex-1 overflow-y-auto p-4">
          {/* ── Alerts container – ref'd so floating reminder can detect visibility ── */}
          <div ref={alertsRef}>
            {/* Error display */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                <div className="font-medium">Error</div>
                <div className="text-sm mt-1">{error}</div>
              </div>
            )}
            {/* PR status notice – Sent/Received: only Status editable; Closed: fully locked */}
            {isPurchaseRequest && !isPRFieldsEditable && isStatusEditable && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-sm">
                This purchase request is <strong className="capitalize">{data?.status}</strong>. All fields are read-only — only the <strong>Status</strong> can be updated.
              </div>
            )}
            {isPurchaseRequest && !isStatusEditable && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                This purchase request is <strong>Closed</strong> and cannot be edited.
              </div>
            )}

            {/* PO status notice */}
            {isPurchaseOrder && !isPOFieldsEditable && isPOStatusEditable && !poReceivingMode && !poUpdateAgainMode && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-sm">
                This purchase order is <strong className="capitalize">{data?.status}</strong>. All fields are read-only — only the <strong>Status</strong> can be updated.
              </div>
            )}
            {isPurchaseOrder && !isPOStatusEditable && !poReceivingMode && !poUpdateAgainMode && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                This purchase order is <strong>Closed</strong> and cannot be edited.
              </div>
            )}

            {/* PO unit price warning – shown when generated from PR and any item still has no unit price */}
            {isPurchaseOrder && data?.status === 'draft' && data?.pr_id && poHasEmptyUnitPrice() && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-sm">
                <strong>Unit prices required.</strong> This Purchase Order was generated from a Purchase Request. Please fill in the <strong>Unit Price</strong> for all items in the Items tab before the status can be updated to <strong>Sent</strong>.
              </div>
            )}

            {/* PO over-received warnings */}
            {isPurchaseOrder && !poReceivingMode && !poUpdateAgainMode &&
              poItems
                .filter(item => parseFloat(item.poi_quantity) - parseFloat(item.received_quantity ?? 0) < 0)
                .map(item => {
                  const diff = parseFloat(item.poi_quantity) - parseFloat(item.received_quantity ?? 0);
                  return (
                    <div key={item.poi_id} className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-sm">
                      Item <strong>"{item.item_name}"</strong> has received quantity more than expected quantity, <strong>{Math.abs(diff)}</strong>
                    </div>
                  );
                })
            }
          </div>

          {/* PO Receiving Mode */}
          {isPurchaseOrder && poReceivingMode && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-sm">
                <strong>Receiving Goods</strong> — Enter the quantity received for each item.
              </div>
              {poItems.map((item, index) => (
                <div key={item.poi_id ?? index} className="border border-gray-200 rounded-md p-3 space-y-3 bg-gray-50">
                  <div className="font-medium text-sm text-gray-800">{item.item_name}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Expected Quantity Receiving</label>
                      <input type="number" value={item.poi_quantity} readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Quantity Received</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={poReceivingQuantities[item.poi_id] ?? String(item.poi_quantity)}
                        onChange={(e) => setPoReceivingQuantities(prev => ({ ...prev, [item.poi_id]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PO Update Again Mode */}
          {isPurchaseOrder && poUpdateAgainMode && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-sm">
                <strong>Update Received Quantity</strong> — Enter additional quantity received for outstanding items.
              </div>
              {poOutstandingItems().map((item) => {
                const lastReceived = parseFloat(item.received_quantity ?? 0);
                const expected = parseFloat(item.poi_quantity);
                const outstanding = expected - lastReceived;
                return (
                  <div key={item.poi_id} className="border border-amber-200 rounded-md p-3 space-y-3 bg-amber-50">
                    <div className="font-medium text-sm text-gray-800">{item.item_name}</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Expected Quantity</label>
                        <input type="number" value={expected} readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Last Received Quantity</label>
                        <input type="number" value={lastReceived} readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Current Received Quantity
                          <span className="block text-xs text-amber-600 font-normal">(Expecting {outstanding} more to meet Expected)</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={poUpdateAgainQuantities[item.poi_id] ?? ''}
                          onChange={(e) => setPoUpdateAgainQuantities(prev => ({ ...prev, [item.poi_id]: e.target.value }))}
                          placeholder={String(outstanding)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Form content - single column layout */}
          {(!isPurchaseOrder || (!poReceivingMode && !poUpdateAgainMode)) && (
          <div className="space-y-4">
          {/* MAIN TAB (common for all entity types) */}
            {activeTab === 'main' && (
              <div className="space-y-4">
                {isInventory && (
                  <>
                    {/* Item ID – read-only, shown for reference only */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Item ID</label>
                      <input
                        type="text"
                        value={mainData.item_id || ''}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
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
                    {/* Remark 1 – free-text note field for internal use */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Remark 1</label>
                      <input
                        type="text"
                        value={mainData.remark_1 || ''}
                        onChange={(e) => setMainData({ ...mainData, remark_1: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    {/* Remark 2 – second free-text note field for internal use */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Remark 2</label>
                      <input
                        type="text"
                        value={mainData.remark_2 || ''}
                        onChange={(e) => setMainData({ ...mainData, remark_2: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    {/* Description – rows={9} makes it 3× taller than a standard single-row input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={mainData.description || ''}
                        onChange={(e) => setMainData({ ...mainData, description: e.target.value })}
                        rows={9}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                  </>
                )}
                {isClassification && (
                  <>
                    {/* Classification code – short identifier like "CAT-01" */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Classification Code *</label>
                      <input
                        type="text"
                        value={mainData.classification_code || ''}
                        onChange={(e) => setMainData({ ...mainData, classification_code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    {/* Classification title – human-readable name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Classification Title *</label>
                      <input
                        type="text"
                        value={mainData.classification_title || ''}
                        onChange={(e) => setMainData({ ...mainData, classification_title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                    {/* Classification description – optional long-form details */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={mainData.classification_description || ''}
                        onChange={(e) => setMainData({ ...mainData, classification_description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={loading}
                      />
                    </div>
                  </>
                )}
                {isPurchaseRequest && (
                  <>
                    {/* PR Number – system-generated, cannot be changed */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PR Number</label>
                      <input
                        type="text"
                        value={mainData.pr_no || ''}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    {/* Created By – who originally created this PR */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                      <input
                        type="text"
                        value={data?.created_by_name || '—'}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    {/* Date – when this PR was first created */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="text"
                        value={data?.created_at ? new Date(data.created_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    {/* Reference Number – editable in Draft only */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                      <input
                        type="text"
                        value={mainData.reference_no || ''}
                        onChange={(e) => setMainData({ ...mainData, reference_no: e.target.value })}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${!isPRFieldsEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        disabled={loading || !isPRFieldsEditable}
                      />
                    </div>
                    {/* Terms – editable in Draft only */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
                      <input
                        type="text"
                        value={mainData.terms || ''}
                        onChange={(e) => setMainData({ ...mainData, terms: e.target.value })}
                        placeholder="e.g., Net 30 days"
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${!isPRFieldsEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        disabled={loading || !isPRFieldsEditable}
                      />
                    </div>
                    {/* Remarks – editable in Draft only */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                      <textarea
                        value={mainData.remarks || ''}
                        onChange={(e) => setMainData({ ...mainData, remarks: e.target.value })}
                        rows={3}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${!isPRFieldsEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        disabled={loading || !isPRFieldsEditable}
                      />
                    </div>
                    {/* Status – forward-only transitions: Draft→Sent/Closed; Sent→Received/Closed; Received→Closed */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={mainData.status || 'draft'}
                        onChange={(e) => setMainData({ ...mainData, status: e.target.value })}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${!isStatusEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        disabled={loading || !isStatusEditable}
                      >
                        <option value={data?.status}>{data?.status ? data.status.charAt(0).toUpperCase() + data.status.slice(1) : 'Draft'}</option>
                        {data?.status === 'draft' && <option value="sent">Sent</option>}
                        {(data?.status === 'draft' || data?.status === 'sent') && data?.status !== 'received' && <option value="closed">Closed</option>}
                        {data?.status === 'sent' && <option value="received">Received</option>}
                        {data?.status === 'received' && <option value="closed">Closed</option>}
                      </select>
                    </div>
                  </>
                )}
                {isPurchaseOrder && (
                  <>
                    {/* PO Number – system-generated, cannot be changed */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
                      <input
                        type="text"
                        value={mainData.po_no || ''}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    {/* Created By – who originally created this PO */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                      <input
                        type="text"
                        value={data?.created_by_name || '—'}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    {/* Date – when this PO was first created */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="text"
                        value={data?.created_at ? new Date(data.created_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    {/* Reference Number – editable in Draft only */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                      <input
                        type="text"
                        value={mainData.reference_no || ''}
                        onChange={(e) => setMainData({ ...mainData, reference_no: e.target.value })}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${!isPOFieldsEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        disabled={loading || !isPOFieldsEditable}
                      />
                    </div>
                    {/* Terms – editable in Draft only */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
                      <input
                        type="text"
                        value={mainData.terms || ''}
                        onChange={(e) => setMainData({ ...mainData, terms: e.target.value })}
                        placeholder="e.g., Net 30 days"
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${!isPOFieldsEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        disabled={loading || !isPOFieldsEditable}
                      />
                    </div>
                    {/* Delivery Date – editable in Draft only */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
                      <input
                        type="date"
                        value={mainData.delivery_date ? mainData.delivery_date.split('T')[0] : ''}
                        onChange={(e) => setMainData({ ...mainData, delivery_date: e.target.value })}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${!isPOFieldsEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        disabled={loading || !isPOFieldsEditable}
                      />
                    </div>
                    {/* PR ID – read-only back-link to the originating Purchase Request */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PR Reference</label>
                      <input
                        type="text"
                        value={mainData.pr_no || '—'}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    {/* Remarks – editable in Draft only */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                      <textarea
                        value={mainData.remarks || ''}
                        onChange={(e) => setMainData({ ...mainData, remarks: e.target.value })}
                        rows={3}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${!isPOFieldsEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        disabled={loading || !isPOFieldsEditable}
                      />
                    </div>
                    {/* Status – forward-only: Draft→Sent(if unit prices set)/Closed; Sent→Confirmed/Closed; Confirmed→Received/Closed; Received→Closed */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={mainData.status || 'draft'}
                        onChange={(e) => handlePOStatusChange(e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${!isPOStatusEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        disabled={loading || !isPOStatusEditable}
                      >
                        <option value={data?.status}>{data?.status ? data.status.charAt(0).toUpperCase() + data.status.slice(1) : 'Draft'}</option>
                        {data?.status === 'draft' && !poHasEmptyUnitPrice() && <option value="sent">Sent</option>}
                        {data?.status === 'sent' && <option value="confirmed">Confirmed</option>}
                        {data?.status === 'confirmed' && <option value="received">Received</option>}
                        {(data?.status === 'draft' || data?.status === 'sent' || data?.status === 'confirmed') && <option value="closed">Closed</option>}
                        {data?.status === 'received' && <option value="closed">Closed</option>}
                      </select>
                    </div>
                    {/* Update Again button – shows when PO is received and has outstanding items */}
                    {data?.status === 'received' && poHasOutstanding() && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            const initialQtys: Record<number, string> = {};
                            poOutstandingItems().forEach(item => { initialQtys[item.poi_id] = ''; });
                            setPoUpdateAgainQuantities(initialQtys);
                            setPoUpdateAgainMode(true);
                          }}
                          className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium transition-colors"
                        >
                          Update Again
                        </button>
                      </div>
                    )}
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
                {/* UOM – unit of measure for this item (e.g., pcs, kg, box) */}
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
                {/* Ref Cost – reference cost used for pricing, stored as decimal */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ref Cost</label>
                  <input
                    type="number"
                    step="any"
                    value={mainData.ref_cost || ''}
                    onChange={(e) => setMainData({ ...mainData, ref_cost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  />
                </div>
                {/* Ref Price – reference price used for pricing, stored as decimal */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ref Price</label>
                  <input
                    type="number"
                    step="any"
                    value={mainData.ref_price || ''}
                    onChange={(e) => setMainData({ ...mainData, ref_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={loading}
                  />
                </div>
                {/* Balance Quantity – minimum stock threshold / reorder point for stockout alerts */}
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
                {/* Quantity – live stock count; read-only because it is updated only via stock movements */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    value={mainData.quantity ?? ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
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

            {/* PURCHASE REQUEST ITEMS TAB */}
            {isPurchaseRequest && activeTab === 'items' && (
              <div className="space-y-4">
                {/* Tab header: item count title + Add Item button */}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">
                    Items in Request ({prItems.length})
                  </span>
                  {isPRFieldsEditable && (
                    <button
                      type="button"
                      onClick={handleAddPRItem}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-md transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Item
                    </button>
                  )}
                </div>

                {loadingPRDropdowns ? (
                  <div className="text-center py-4 text-gray-500">Loading items...</div>
                ) : prItems.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No items in this purchase request.</p>
                ) : (
                  prItems.map((item, index) => (
                    // Card for each line item
                    <div key={item.pri_id ?? item._tempId ?? index} className="border border-gray-200 rounded-md p-4 space-y-3 bg-gray-50">
                      {/* Card header: line number + action buttons */}
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Line Item {index + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          {/* Refresh button re-fetches description and uom from current inventory data */}
                          <button
                            type="button"
                            onClick={() => handleRefreshItem(index)}
                            disabled={loading || !item.item_id || !isPRFieldsEditable}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed rounded-md transition-colors"
                            title={!isPRFieldsEditable ? 'Read-only — only draft purchase requests can be edited' : 'Refresh description and UOM from inventory'}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                          </button>
                          {/* Remove button deletes this item card (removed from DB on Update) */}
                          {isPRFieldsEditable && (
                            <button
                              type="button"
                              onClick={() => handleRemovePRItem(index)}
                              disabled={loading}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed rounded-md transition-colors"
                              title="Remove this item"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline feedback message after Refresh action */}
                      {prItemMessages[prItemKey(item, index)] && (
                        <div className={`text-xs px-3 py-1.5 rounded-md ${
                          prItemMessages[prItemKey(item, index)].type === 'success'
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'bg-blue-50 border border-blue-200 text-blue-700'
                        }`}>
                          {prItemMessages[prItemKey(item, index)].text}
                        </div>
                      )}

                      {/* Item Selecting – select from inventory; editable in Draft only */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Item Selecting</label>
                        <select
                          value={item.item_id || ''}
                          onChange={(e) => handlePRItemNameChange(index, e.target.value)}
                          disabled={loading || !isPRFieldsEditable}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm ${!isPRFieldsEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        >
                          {/* Show current item_name when no item_id or item not in catalogue */}
                          {!item.item_id && (
                            <option value="">{item.item_name || '— Select item —'}</option>
                          )}
                          {allInventoryItems.map((inv: any) => (
                            <option key={inv.item_id} value={inv.item_id}>
                              {/* Format: item_name(description) or just item_name if description is empty */}
                              {inv.description ? `${inv.item_name}(${inv.description})` : inv.item_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Item ID – read-only, auto-filled from selected inventory item */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Item ID</label>
                        <input
                          type="text"
                          value={item.item_id || ''}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                        />
                      </div>

                      {/* Item Description – shows item_name then item_description on next line */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Item Description</label>
                        <textarea
                          value={[item.item_name, item.item_description].filter(Boolean).join('\n')}
                          readOnly
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm resize-none"
                        />
                      </div>

                      {/* UOM – read-only snapshot; auto-filled from selected inventory item */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">UOM</label>
                        <input
                          type="text"
                          value={item.uom || ''}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                        />
                      </div>

                      {/* Quantity – editable in Draft only */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={item.pri_quantity}
                          onChange={(e) => handlePRItemQuantityChange(index, e.target.value)}
                          disabled={loading || !isPRFieldsEditable}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm ${!isPRFieldsEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* PURCHASE REQUEST SUPPLIER TAB */}
            {isPurchaseRequest && activeTab === 'supplier' && (
              <div className="space-y-4">
                {loadingPRDropdowns ? (
                  <div className="text-center py-4 text-gray-500">Loading suppliers...</div>
                ) : (
                  <>
                    {/* Supplier tab header: label + Refresh button */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700">
                        Supplier Details
                      </span>
                      {/* Refresh button re-reads contact details from allSuppliers for current selection */}
                      <button
                        type="button"
                        onClick={handleRefreshSupplier}
                        disabled={loading || !prSupplierId || !isPRFieldsEditable}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed rounded-md transition-colors"
                        title={!isPRFieldsEditable ? 'Read-only — only draft purchase requests can be edited' : 'Refresh supplier details from supplier list'}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    </div>

                    {/* Company – editable in Draft only */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                      <select
                        value={prSupplierId || ''}
                        onChange={(e) => handlePRSupplierChange(e.target.value ? Number(e.target.value) : null)}
                        disabled={loading || !isPRFieldsEditable}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${!isPRFieldsEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                      >
                        <option value="">— No supplier selected —</option>
                        {allSuppliers.map((sup: any) => (
                          <option key={sup.supplier_id} value={sup.supplier_id}>
                            {/* Format: company_name(register_no_new) or just company_name if no reg no */}
                            {sup.register_no_new
                              ? `${sup.company_name}(${sup.register_no_new})`
                              : sup.company_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Supplier ID – read-only, auto-filled from selected supplier */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Supplier ID</label>
                      <input
                        type="text"
                        value={prSupplierId || ''}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>

                    {/* Register No – read-only, auto-filled from selected supplier */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Register No</label>
                      <input
                        type="text"
                        value={prSupplierInfo.register_no_new || ''}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>

                    {/* Email – read-only, auto-filled from supplier's contact_info */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="text"
                        value={prSupplierInfo.email || ''}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>

                    {/* Phone – read-only, auto-filled from supplier's contact_info */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="text"
                        value={prSupplierInfo.phone || ''}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>

                    {/* Address – read-only, combines address/city/state/country/post_code from contact_info */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <textarea
                        value={[
                          prSupplierInfo.address,
                          prSupplierInfo.city,
                          prSupplierInfo.state,
                          prSupplierInfo.country,
                          prSupplierInfo.post_code,
                        ].filter(Boolean).join(', ')}
                        readOnly
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* PURCHASE ORDER ITEMS TAB */}
            {isPurchaseOrder && activeTab === 'items' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">
                    Items in Order ({poItems.length})
                  </span>
                  {isPOFieldsEditable && (
                    <button
                      type="button"
                      onClick={handleAddPOItem}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-md transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Item
                    </button>
                  )}
                </div>

                {loadingPODropdowns ? (
                  <div className="text-center py-4 text-gray-500">Loading items...</div>
                ) : poItems.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No items in this purchase order.</p>
                ) : (
                  poItems.map((item, index) => (
                    <div key={item.poi_id ?? item._tempId ?? index} className="border border-gray-200 rounded-md p-4 space-y-3 bg-gray-50">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Line Item {index + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRefreshPOItem(index)}
                            disabled={loading || !item.item_id || !isPOFieldsEditable}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed rounded-md transition-colors"
                            title={!isPOFieldsEditable ? 'Read-only — only draft purchase orders can be edited' : 'Refresh description and UOM from inventory'}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                          </button>
                          {isPOFieldsEditable && (
                            <button
                              type="button"
                              onClick={() => handleRemovePOItem(index)}
                              disabled={loading}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed rounded-md transition-colors"
                              title="Remove this item"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline feedback message after Refresh action */}
                      {poItemMessages[poItemKey(item, index)] && (
                        <div className={`text-xs px-3 py-1.5 rounded-md ${
                          poItemMessages[poItemKey(item, index)].type === 'success'
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'bg-blue-50 border border-blue-200 text-blue-700'
                        }`}>
                          {poItemMessages[poItemKey(item, index)].text}
                        </div>
                      )}

                      {/* Item Selecting dropdown */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Item Selecting</label>
                        <select
                          value={item.item_id || ''}
                          onChange={(e) => handlePOItemNameChange(index, e.target.value)}
                          disabled={loading || !isPOFieldsEditable}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm ${!isPOFieldsEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        >
                          {!item.item_id && (
                            <option value="">{item.item_name || '— Select item —'}</option>
                          )}
                          {allPOInventoryItems.map((inv: any) => (
                            <option key={inv.item_id} value={inv.item_id}>
                              {inv.description ? `${inv.item_name}(${inv.description})` : inv.item_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Item ID (read-only) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Item ID</label>
                        <input type="text" value={item.item_id || ''} readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                      </div>

                      {/* Item Description – shows item_name then item_description on next line */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Item Description</label>
                        <textarea
                          value={[item.item_name, item.item_description].filter(Boolean).join('\n')}
                          readOnly
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm resize-none"
                        />
                      </div>

                      {/* UOM (read-only) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">UOM</label>
                        <input type="text" value={item.uom || ''} readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                      </div>

                      {/* Quantity – editable in Draft */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={item.poi_quantity}
                          onChange={(e) => handlePOItemFieldChange(index, 'poi_quantity', e.target.value)}
                          disabled={loading || !isPOFieldsEditable}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm ${!isPOFieldsEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        />
                      </div>

                      {/* Unit Price – editable in Draft */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => handlePOItemFieldChange(index, 'unit_price', e.target.value)}
                          disabled={loading || !isPOFieldsEditable}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm ${!isPOFieldsEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                        />
                      </div>

                      {/* Line Total (read-only, auto-calculated) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
                        <input type="text"
                          value={Number(item.line_total || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                      </div>

                      {/* Received Quantity (read-only) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Received Quantity</label>
                        <input type="text" value={item.received_quantity ?? 0} readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed text-sm" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* PURCHASE ORDER SUPPLIER TAB */}
            {isPurchaseOrder && activeTab === 'supplier' && (
              <div className="space-y-4">
                {loadingPODropdowns ? (
                  <div className="text-center py-4 text-gray-500">Loading suppliers...</div>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700">Supplier Details</span>
                      <button
                        type="button"
                        onClick={handleRefreshPOSupplier}
                        disabled={loading || !poSupplierId || !isPOFieldsEditable}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed rounded-md transition-colors"
                        title={!isPOFieldsEditable ? 'Read-only — only draft purchase orders can be edited' : 'Refresh supplier details from supplier list'}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    </div>

                    {/* Company dropdown – editable in Draft only */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                      <select
                        value={poSupplierId || ''}
                        onChange={(e) => handlePOSupplierChange(e.target.value ? Number(e.target.value) : null)}
                        disabled={loading || !isPOFieldsEditable}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${!isPOFieldsEditable ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                      >
                        <option value="">— No supplier selected —</option>
                        {allPOSuppliers.map((sup: any) => (
                          <option key={sup.supplier_id} value={sup.supplier_id}>
                            {sup.register_no_new
                              ? `${sup.company_name}(${sup.register_no_new})`
                              : sup.company_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Supplier ID</label>
                      <input type="text" value={poSupplierId || ''} readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Register No</label>
                      <input type="text" value={poSupplierInfo.register_no_new || ''} readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input type="text" value={poSupplierInfo.email || ''} readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input type="text" value={poSupplierInfo.phone || ''} readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <textarea
                        value={[
                          poSupplierInfo.address,
                          poSupplierInfo.city,
                          poSupplierInfo.state,
                          poSupplierInfo.country,
                          poSupplierInfo.post_code,
                        ].filter(Boolean).join(', ')}
                        readOnly
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
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
          )}
        </div>

        {/* Footer with action buttons (fixed at bottom) */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4 flex justify-between items-center">
          {/* Total Amount – visible from any tab for PO */}
          {isPurchaseOrder ? (
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Total Amount</span>
              <span className="text-base font-semibold text-gray-800">
                {mainData.total_amount !== undefined && mainData.total_amount !== null
                  ? Number(mainData.total_amount).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : '0.00'}
              </span>
            </div>
          ) : (
            <div />
          )}
          <div className="flex space-x-3">
          <button
            onClick={poReceivingMode ? handleCancelReceiving : poUpdateAgainMode ? () => setPoUpdateAgainMode(false) : onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          {!isPurchaseRequest && !isPurchaseOrder && onDelete && (
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              disabled={loading}
            >
              Delete
            </button>
          )}
          <button
            onClick={handleUpdate}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center transition-colors"
            disabled={loading || (isPurchaseRequest && !isStatusEditable) || (isPurchaseOrder && !isPOStatusEditable)}
            title={
              (isPurchaseRequest && !isStatusEditable)
                ? 'This purchase request is closed and cannot be edited'
                : (isPurchaseOrder && !isPOStatusEditable)
                  ? 'This purchase order is closed and cannot be edited'
                  : undefined
            }
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

      {/* PR item refresh confirmation dialog – shows before/after diff */}
      <ConfirmationDialog
        isOpen={prRefreshConfirmOpen}
        message="The following fields will be overwritten with the latest values from inventory:"
        confirmLabel="Yes, Refresh"
        cancelLabel="Cancel"
        onConfirm={handleRefreshItemConfirm}
        onCancel={handleRefreshItemCancel}
        content={
          <div className="border border-gray-200 rounded-md overflow-hidden text-sm">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Field</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Current Value</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">New Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {prRefreshDiff.map((row, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-3 py-2 font-medium text-gray-700">{row.label}</td>
                    <td className="px-3 py-2 text-red-600 line-through">{row.before || <span className="italic text-gray-400">empty</span>}</td>
                    <td className="px-3 py-2 text-green-700 font-medium">{row.after || <span className="italic text-gray-400">empty</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      />

      {/* PO item refresh confirmation dialog – shows before/after diff */}
      <ConfirmationDialog
        isOpen={poRefreshConfirmOpen}
        message="The following fields will be overwritten with the latest values from inventory:"
        confirmLabel="Yes, Refresh"
        cancelLabel="Cancel"
        onConfirm={handleRefreshPOItemConfirm}
        onCancel={handleRefreshPOItemCancel}
        content={
          <div className="border border-gray-200 rounded-md overflow-hidden text-sm">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Field</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Current Value</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">New Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {poRefreshDiff.map((row, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-3 py-2 font-medium text-gray-700">{row.label}</td>
                    <td className="px-3 py-2 text-red-600 line-through">{row.before || <span className="italic text-gray-400">empty</span>}</td>
                    <td className="px-3 py-2 text-green-700 font-medium">{row.after || <span className="italic text-gray-400">empty</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      />

      {/* Delete confirmation dialog */}
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        message="Are you sure you want to delete this item? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* PO close-with-outstanding confirmation */}
      <ConfirmationDialog
        isOpen={showCloseOutstandingConfirm}
        message="Are you sure changing Status to closed? There are still items quantity outstanding and you will no longer able to modify."
        confirmLabel="Yes, Close"
        cancelLabel="Cancel"
        onConfirm={handleConfirmCloseOutstanding}
        onCancel={() => setShowCloseOutstandingConfirm(false)}
      />

      {/* Floating alert reminder – appears to the left of the panel when alerts scroll out of view */}
      {isOpen && showFloatingAlert && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ right: 'calc(min(100vw, 36rem))', top: `${floatingAlertTop + 12}px` }}
        >
          <div className="bg-amber-100 border border-amber-300 text-amber-800 rounded-l-xl shadow-lg px-3 py-2 flex items-center gap-2 text-xs font-medium max-w-[160px]">
            <svg className="w-4 h-4 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>Alert at top ↑</span>
          </div>
        </div>
      )}
    </>
  );
};

export default EditPanel;