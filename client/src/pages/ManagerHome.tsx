import React from 'react';

const ManagerHome: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Monitor team performance and inventory levels. Approve requests and generate reports.
        </p>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { title: 'Team Members', value: '0', color: 'bg-blue-500', icon: '👥' },
          { title: 'Pending Approvals', value: '0', color: 'bg-yellow-500', icon: '⏳' },
          { title: 'Stock Alerts', value: '0', color: 'bg-orange-500', icon: '⚠️' },
          { title: 'Monthly Sales', value: 'RM 0', color: 'bg-green-500', icon: '📊' },
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
            <div className="font-medium">Approve Orders</div>
            <div className="text-sm opacity-90">Review pending requests</div>
          </button>
          <button className="bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors text-left">
            <div className="font-medium">Manage Staff</div>
            <div className="text-sm opacity-90">Add or update team members</div>
          </button>
          <button className="bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors text-left">
            <div className="font-medium">View Reports</div>
            <div className="text-sm opacity-90">Sales & inventory analytics</div>
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

export default ManagerHome;