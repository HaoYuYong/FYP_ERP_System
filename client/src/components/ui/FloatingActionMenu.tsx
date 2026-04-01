import React, { useState, useEffect, useRef } from 'react';

interface ActionOption {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

interface FloatingActionMenuProps {
  options: ActionOption[];
  mainIcon: React.ComponentType<{ className?: string }>;
  mainColor?: string;
  optionColor?: string;
}

const FloatingActionMenu: React.FC<FloatingActionMenuProps> = ({
  options,
  mainIcon: MainIcon,
  mainColor = 'bg-primary-600',
  optionColor = 'bg-orange-500'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 z-50">
      {/* Options container – appears above main button */}
      <div className="absolute bottom-full right-0 mb-4 flex flex-col items-end space-y-3">
        {isOpen && options.map((option, index) => (
          <div key={index} className="flex items-center space-x-3 animate-fade-in">
            <span className="bg-gray-800 text-white text-sm font-medium px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
              {option.label}
            </span>
            <button
              onClick={() => {
                option.onClick();
                setIsOpen(false);
              }}
              className={`${optionColor} text-white rounded-full w-14 h-14 flex-shrink-0 flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity`}
              title={option.label}
            >
              <option.icon className="w-7 h-7" />
            </button>
          </div>
        ))}
      </div>

      {/* Main FAB button */}
      <button
        onClick={toggleMenu}
        className={`${mainColor} text-white rounded-full w-14 h-14 flex-shrink-0 flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity focus:outline-none`}
        title="Add"
      >
        <MainIcon className="w-7 h-7" />
      </button>
    </div>
  );
};

export default FloatingActionMenu;