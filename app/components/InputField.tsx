interface InputFieldProps {
  label: string;
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  required?: boolean;
  placeholder?: string;
  multiline?: boolean;
  type?: 'text' | 'number' | 'email' | 'url';
  step?: string;
  min?: string;
}

export default function InputField({
  label,
  value = '',
  onChange,
  required = false,
  placeholder,
  multiline = false,
  type = 'text',
  step,
  min
}: InputFieldProps) {
  const baseClassName = "w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 " +
                       "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 " +
                       "focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
                       "placeholder-gray-400 dark:placeholder-gray-600";

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          rows={3}
          className={baseClassName}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          step={step}
          min={min}
          className={baseClassName}
        />
      )}
    </div>
  );
} 