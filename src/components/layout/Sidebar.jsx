import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Calendar,
  Receipt,
  Package,
  Settings,
  Stethoscope,
  FlaskConical,
  Shield,
  FileText,
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/patients', icon: Users, label: 'Patients' },
  { path: '/doctors', icon: UserCog, label: 'Doctors' },
  { path: '/appointments', icon: Calendar, label: 'Appointments' },
  { path: '/billing', icon: Receipt, label: 'Billing' },
  { path: '/inventory', icon: Package, label: 'Pharmacy' },
  { path: '/services', icon: FlaskConical, label: 'Service Charges' },
  { path: '/letterhead', icon: FileText, label: 'Letterhead' },
  { path: '/users', icon: Shield, label: 'User Management' },
  { path: '/settings', icon: Settings, label: 'Settings', exact: true },
];

export default function Sidebar({ collapsed = false, onToggle }) {
  const { settings } = useClinic();

  return (
    <aside 
      className={`${
        collapsed ? 'w-16' : 'w-64'
      } bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out`}
    >
      {/* Logo */}
      <div className={`h-16 flex items-center justify-center border-b border-gray-200 ${collapsed ? 'px-2' : 'px-4'}`}>
        {collapsed ? (
          // Collapsed: Show small icon logo
          <img 
            src="/logo-icon.png" 
            alt="Logo" 
            className="w-10 h-10 object-contain"
            onError={(e) => {
              // Fallback to stethoscope icon if image not found
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : settings?.logo ? (
          // Expanded with custom logo
          <img 
            src={settings.logo} 
            alt={settings.clinicName || 'Clinic Logo'} 
            className="h-10 object-contain"
          />
        ) : (
          // Expanded without custom logo: show default
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="font-bold text-gray-900 text-sm leading-tight truncate">
                {settings?.clinicName || 'Avia Clinic'}
              </h1>
              <p className="text-xs text-gray-500">Management System</p>
            </div>
          </div>
        )}
        {/* Fallback icon for collapsed state */}
        {collapsed && (
          <div className="w-9 h-9 bg-primary-600 rounded-lg items-center justify-center flex-shrink-0 hidden">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-4'} space-y-1`}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            className={({ isActive }) =>
              `${isActive ? 'nav-item-active' : 'nav-item'} ${
                collapsed ? 'justify-center px-2' : ''
              }`
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

    </aside>
  );
}
