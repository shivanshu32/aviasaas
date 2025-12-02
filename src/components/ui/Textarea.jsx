import { forwardRef } from 'react';

const Textarea = forwardRef(({
  label,
  error,
  helperText,
  required = false,
  className = '',
  containerClassName = '',
  rows = 3,
  ...props
}, ref) => {
  const textareaClasses = `
    w-full px-3 py-2 text-sm border rounded-lg bg-white 
    placeholder-gray-400 transition-colors resize-none
    focus:outline-none focus:ring-2 focus:border-primary-500
    disabled:bg-gray-100 disabled:cursor-not-allowed
    ${error 
      ? 'border-red-500 focus:ring-red-500' 
      : 'border-gray-300 focus:ring-primary-500'
    }
    ${className}
  `;

  return (
    <div className={containerClassName}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={textareaClasses}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-xs text-gray-500">{helperText}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;
