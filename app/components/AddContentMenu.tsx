// components/AddContentMenu.tsx
import { Plus } from 'lucide-react';
import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/popover';

interface AddContentMenuProps {
  onAdd: (type: 'LINK' | 'TITLE' | 'DIVIDER' | 'TEXT') => void;
}

export function AddContentMenu({ onAdd }: AddContentMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAdd = (type: 'LINK' | 'TITLE' | 'DIVIDER' | 'TEXT') => {
    onAdd(type);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-black/20 px-4 py-3 text-black/60 transition-colors hover:border-black hover:text-black">
          <Plus className="h-5 w-5" />
          Add Content
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="space-y-2">
          <button
            onClick={() => handleAdd('LINK')}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-100"
          >
            <span>🔗</span> Link
          </button>
          <button
            onClick={() => handleAdd('TITLE')}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-100"
          >
            <span>📌</span> Title
          </button>
          <button
            onClick={() => handleAdd('TEXT')}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-100"
          >
            <span>📝</span> Text
          </button>
          <button
            onClick={() => handleAdd('DIVIDER')}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-100"
          >
            <span>➖</span> Divider
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}