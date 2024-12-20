import { useState, useRef, useEffect } from 'react';
import { PumpConfig } from '../lib/types';
import { generateTokenDetails } from '../lib/auto-generate';
import InputField from './InputField';

interface TokenFormProps {
  onSubmit: (config: PumpConfig) => void;
  isLoading: boolean;
}

export default function TokenForm({ onSubmit, isLoading }: TokenFormProps) {
  const [formData, setFormData] = useState<Partial<PumpConfig>>({
    name: '',
    symbol: '',
    description: '',
    twitter: '',
    telegram: '',
    website: ''
  });
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setFile(null);
      setPreviewUrl(null);
    }
  };

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    try {
      const generated = await generateTokenDetails();
      setFormData({
        ...formData,
        name: generated.name,
        symbol: generated.symbol,
        description: generated.description,
        twitter: "https://twitter.com",
        telegram: "https://t.me",
        website: "https://example.com"
      });
      setFile(generated.file);
      
      const url = URL.createObjectURL(generated.file);
      setPreviewUrl(url);
      
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(generated.file);
        fileInputRef.current.files = dataTransfer.files;
      }
    } catch (error) {
      console.error('Error auto-generating:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    onSubmit({
      file,
      name: formData.name || '',
      symbol: formData.symbol || '',
      description: formData.description || '',
      twitter: formData.twitter || '',
      telegram: formData.telegram || '',
      website: formData.website || ''
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={handleAutoGenerate}
          disabled={isGenerating || isLoading}
          className="px-4 py-2 text-white bg-blue-600 rounded-lg
                   hover:bg-blue-700 focus:ring-4 focus:ring-blue-300
                   font-medium text-sm disabled:bg-gray-400
                   disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </span>
          ) : (
            'Auto Generate'
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="col-span-full p-5 border rounded-lg bg-gray-50 dark:bg-gray-800/30">
          <label className="block text-sm font-medium mb-2">Token Logo</label>
          <div className="space-y-4">
            {previewUrl && (
              <div className="flex justify-center">
                <img
                  src={previewUrl}
                  alt="Token Logo Preview"
                  className="w-32 h-32 object-contain rounded-lg border border-gray-200 dark:border-gray-700"
                />
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              required
              className="w-full text-sm text-gray-600 dark:text-gray-400
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-full file:border-0
                       file:text-sm file:font-semibold
                       file:bg-blue-50 file:text-blue-700
                       hover:file:bg-blue-100
                       dark:file:bg-blue-900/30 dark:file:text-blue-300"
            />
          </div>
        </div>

        <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="Token Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <InputField
            label="Symbol"
            value={formData.symbol}
            onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
            required
          />
        </div>

        <div className="col-span-full space-y-4">
          <InputField
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            multiline
          />
          <InputField
            label="Twitter"
            value={formData.twitter}
            onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
            placeholder="@username"
          />
          <InputField
            label="Telegram"
            value={formData.telegram}
            onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
            placeholder="t.me/group"
          />
          <InputField
            label="Website"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            placeholder="https://"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-6 text-white bg-blue-600 rounded-lg
                 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300
                 font-medium text-sm disabled:bg-gray-400
                 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Creating Token...
          </span>
        ) : (
          'Create Token'
        )}
      </button>
    </form>
  );
} 