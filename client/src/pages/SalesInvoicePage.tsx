import React from 'react';
import PageHeader from '../components/ui/PageHeader';

const SalesInvoicePage: React.FC = () => {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Invoice" />
      <div className="flex-1 overflow-y-auto p-6">
        <p className="text-gray-600">This page is under development.</p>
      </div>
    </div>
  );
};

export default SalesInvoicePage;
