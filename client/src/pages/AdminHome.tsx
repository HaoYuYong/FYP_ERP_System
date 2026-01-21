import React from 'react';

const AdminHome: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Welcome to the Inventory Management System. Manage your business operations efficiently.
        </p>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { title: 'Total Products', value: '0', color: 'bg-blue-500', icon: '📦' },
          { title: 'Low Stock Items', value: '0', color: 'bg-yellow-500', icon: '⚠️' },
          { title: 'Pending Orders', value: '0', color: 'bg-orange-500', icon: '📋' },
          { title: 'Total Sales', value: 'RM 0', color: 'bg-green-500', icon: '💰' },
        ].map((stat) => (
          <div key={stat.title} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center mr-4`}>
                <span className="text-white text-2xl">{stat.icon}</span>
              </div>
              <div>
                <p className="text-gray-500 text-sm">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button className="bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors text-left">
            <div className="font-medium">Add New Product</div>
            <div className="text-sm opacity-90">Add items to inventory</div>
          </button>
          <button className="bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors text-left">
            <div className="font-medium">Create Invoice</div>
            <div className="text-sm opacity-90">Generate sales invoice</div>
          </button>
          <button className="bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors text-left">
            <div className="font-medium">View Reports</div>
            <div className="text-sm opacity-90">Business analytics</div>
          </button>
        </div>
      </div>

      {/* Recent Activity (Placeholder) */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="text-center py-8 text-gray-500">
          <p>No recent activity to display</p>
          <p className="text-sm mt-2">Activities will appear here as you use the system</p>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;