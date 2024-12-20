import { useState, useRef } from 'react';
import { PumpConfig } from '../lib/types';
import { generateTokenDetails } from '../lib/auto-generate';

interface TokenFormProps {
  onSubmit: (config: PumpConfig) => void;
  isLoading: boolean;
}

export default function TokenForm({ onSubmit, isLoading }: TokenFormProps) {
  const [formData, setFormData] = useState<Partial<PumpConfig>>({});
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={handleAutoGenerate}
          disabled={isGenerating || isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Auto Generate'}
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Token Logo</label>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full border rounded p-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Token Name</label>
        <input
          type="text"
          value={formData.name || ''}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          className="w-full border rounded p-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Symbol</label>
        <input
          type="text"
          value={formData.symbol || ''}
          onChange={(e) => setFormData({...formData, symbol: e.target.value})}
          className="w-full border rounded p-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          className="w-full border rounded p-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Twitter</label>
        <input
          type="text"
          value={formData.twitter || ''}
          onChange={(e) => setFormData({...formData, twitter: e.target.value})}
          className="w-full border rounded p-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Telegram</label>
        <input
          type="text"
          value={formData.telegram || ''}
          onChange={(e) => setFormData({...formData, telegram: e.target.value})}
          className="w-full border rounded p-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Website</label>
        <input
          type="text"
          value={formData.website || ''}
          onChange={(e) => setFormData({...formData, website: e.target.value})}
          className="w-full border rounded p-2"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {isLoading ? 'Creating Token...' : 'Create Token'}
      </button>
    </form>
  );
} 