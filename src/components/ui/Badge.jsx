const variants = {
  primary: 'bg-primary-100 text-primary-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-800',
  purple: 'bg-purple-100 text-purple-800',
  blue: 'bg-blue-100 text-blue-800',
};

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
};

export default function Badge({
  children,
  variant = 'gray',
  size = 'md',
  dot = false,
  className = '',
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full bg-current opacity-75`} />
      )}
      {children}
    </span>
  );
}

// Status badge helper
export function StatusBadge({ status }) {
  const statusConfig = {
    // Payment status
    paid: { variant: 'success', label: 'Paid' },
    pending: { variant: 'warning', label: 'Pending' },
    partial: { variant: 'blue', label: 'Partial' },
    
    // Appointment status
    scheduled: { variant: 'gray', label: 'Scheduled' },
    'checked-in': { variant: 'blue', label: 'Checked In' },
    'in-progress': { variant: 'primary', label: 'In Progress' },
    completed: { variant: 'success', label: 'Completed' },
    cancelled: { variant: 'danger', label: 'Cancelled' },
    'no-show': { variant: 'warning', label: 'No Show' },
    
    // Stock status
    active: { variant: 'success', label: 'In Stock' },
    low: { variant: 'warning', label: 'Low Stock' },
    exhausted: { variant: 'danger', label: 'Out of Stock' },
    expired: { variant: 'danger', label: 'Expired' },
  };

  const config = statusConfig[status] || { variant: 'gray', label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
