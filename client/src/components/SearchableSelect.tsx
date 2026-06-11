import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export interface SelectOption {
  id: string;
  label: string;
  [key: string]: any;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.id === value);

  // Reset search query when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  return (
    <div className="searchable-select-container" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`form-input searchable-select-trigger ${disabled ? 'disabled' : ''}`}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          textAlign: 'right',
          width: '100%',
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      >
        <span style={{ color: selectedOption ? 'var(--text-main)' : 'var(--text-muted)' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-muted)' }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="searchable-select-dropdown">
          {/* Search Box */}
          <div className="searchable-select-search">
            <div className="search-input-wrapper" style={{ margin: 0 }}>
              <input
                type="text"
                placeholder="ابحث..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                style={{ padding: '0.4rem 2rem 0.4rem 0.5rem', fontSize: '0.9rem' }}
                autoFocus
              />
              <Search
                size={16}
                className="search-input-icon"
                style={{ right: '0.65rem' }}
              />
            </div>
          </div>

          {/* Options List */}
          <ul className="searchable-select-options">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <li
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  className={`searchable-select-option ${option.id === value ? 'selected' : ''}`}
                >
                  {option.label}
                </li>
              ))
            ) : (
              <li className="searchable-select-no-results">
                لا توجد نتائج مطابقة
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
