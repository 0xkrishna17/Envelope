import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Category } from '../types';
import { formatPaise, rupeesToPaise } from '../utils/currency';
import {
  MUTED_COLOR_PALETTES,
  AVAILABLE_ICONS,
  renderCategoryIcon,
} from '../utils/categoryTheme';
import { Plus, Archive, ArchiveRestore, Check, AlertCircle, Edit2, ShieldAlert } from 'lucide-react';

export const CategoryManagement: React.FC = () => {
  const {
    categories,
    createCategory,
    updateCategory,
    archiveCategory,
    unarchiveCategory,
  } = useBudget();

  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [name, setName] = useState<string>('');
  const [icon, setIcon] = useState<string>('ShoppingBag');
  const [color, setColor] = useState<string>(MUTED_COLOR_PALETTES[0].hex);
  const [targetRupees, setTargetRupees] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startCreate = () => {
    setName('');
    setIcon('ShoppingBag');
    setColor(MUTED_COLOR_PALETTES[0].hex);
    setTargetRupees('');
    setErrorMessage(null);
    setEditingCategory(null);
    setIsCreating(true);
  };

  const startEdit = (cat: Category) => {
    setName(cat.name);
    setIcon(cat.icon);
    setColor(cat.color);
    setTargetRupees(cat.target_amount ? (cat.target_amount / 100).toString() : '');
    setErrorMessage(null);
    setEditingCategory(cat);
    setIsCreating(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const targetPaise = targetRupees ? rupeesToPaise(targetRupees) : undefined;

    if (editingCategory) {
      const res = updateCategory(editingCategory.id, {
        name,
        icon,
        color,
        target_amount: targetPaise,
      });
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to update category');
        return;
      }
      setEditingCategory(null);
    } else {
      const res = createCategory(name, icon, color, targetPaise);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to create category');
        return;
      }
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in pb-16">
      {/* Header card with create button */}
      <div className="bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl p-4 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
            Manage Envelope Categories
          </h2>
        </div>
        {!isCreating && !editingCategory && (
          <button
            onClick={startCreate}
            id="add-category-btn"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold shadow-xs hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            <span>New Envelope</span>
          </button>
        )}
      </div>

      {/* Create / Edit Form */}
      {(isCreating || editingCategory) && (
        <form
          onSubmit={handleSave}
          className="bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border border-[#DCD5C9] dark:border-[#3D362F] rounded-2xl p-5 shadow-xs flex flex-col gap-4 animate-in fade-in"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
              {editingCategory ? `Edit "${editingCategory.name}"` : 'Create New Envelope'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingCategory(null);
              }}
              className="text-xs text-[#78716C] hover:text-[#1F1B16]"
            >
              Cancel
            </button>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-[#F9ECE8] border border-[#E8C5BC] text-xs text-[#87341D] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#78716C] block mb-1">
                Envelope Name (Unique in household)
              </label>
              <input
                type="text"
                placeholder="e.g. Vacation & Trips, Gadgets..."
                value={name}
                onChange={e => setName(e.target.value)}
                required
                disabled={editingCategory?.is_unallocated}
                id="cat-name-input"
                className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[#78716C] block mb-1">
                Target Monthly Amount (Optional, purely informational)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs text-[#78716C]">₹</span>
                <input
                  type="number"
                  placeholder="20000"
                  value={targetRupees}
                  onChange={e => setTargetRupees(e.target.value)}
                  id="cat-target-input"
                  className="w-full pl-7 pr-3 py-2 bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs font-amount text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="text-xs font-medium text-[#78716C] block mb-1.5">
              Muted Accent Color (§8)
            </label>
            <div className="flex flex-wrap gap-2">
              {MUTED_COLOR_PALETTES.map(palette => (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => setColor(palette.hex)}
                  id={`color-picker-${palette.id}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    color === palette.hex
                      ? 'border-[#1F1B16] dark:border-[#EDE8E1] ring-2 ring-[#1F1B16]/20 shadow-xs'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: `${palette.hex}25`, color: palette.hex }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: palette.hex }}
                  />
                  <span>{palette.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Icon Picker */}
          <div>
            <label className="text-xs font-medium text-[#78716C] block mb-1.5">
              Envelope Icon
            </label>
            <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5 max-h-32 overflow-y-auto p-1 bg-[#FAF7F2] dark:bg-[#1A1714] rounded-xl border border-[#DCD5C9] dark:border-[#3D362F]">
              {AVAILABLE_ICONS.map(iconName => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  id={`icon-picker-${iconName}`}
                  className={`p-2 rounded-lg flex items-center justify-center transition-all ${
                    icon === iconName
                      ? 'bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714]'
                      : 'text-[#78716C] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D]'
                  }`}
                >
                  {renderCategoryIcon(iconName, 'w-4 h-4')}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingCategory(null);
              }}
              className="px-4 py-2 rounded-xl border border-[#DCD5C9] text-xs font-medium text-[#78716C]"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-category-btn"
              className="px-5 py-2 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold shadow-xs"
            >
              {editingCategory ? 'Save Changes' : 'Create Envelope'}
            </button>
          </div>
        </form>
      )}

      {/* Categories List */}
      <div className="flex flex-col gap-2">
        {categories
          .filter(c => !c.deleted_at)
          .map(cat => (
            <div
              key={cat.id}
              className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                cat.is_archived
                  ? 'bg-[#EFEAE1]/30 dark:bg-[#28221D]/30 border-dashed border-[#DCD5C9] opacity-70'
                  : 'bg-[#FAF7F2] dark:bg-[#1A1714] border-[#E8E3DA] dark:border-[#2D2823] shadow-xs'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                  style={{ backgroundColor: cat.color }}
                >
                  {renderCategoryIcon(cat.icon, 'w-4 h-4')}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] truncate">
                      {cat.name}
                    </span>
                    {cat.is_unallocated && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EFEAE1] dark:bg-[#28221D] font-medium text-[#78716C]">
                        Built-in Surplus
                      </span>
                    )}
                    {cat.is_archived && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F7EFE4] text-[#AF7832] font-semibold">
                        Archived
                      </span>
                    )}
                  </div>
                  {cat.target_amount ? (
                    <span className="text-[11px] text-[#78716C] dark:text-[#A8A29E] block">
                      Target: {formatPaise(cat.target_amount)}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                {!cat.is_unallocated && (
                  <button
                    onClick={() => startEdit(cat)}
                    id={`edit-cat-${cat.id}`}
                    className="p-2 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] text-[#78716C] hover:text-[#1F1B16] transition-colors"
                    title="Edit Envelope"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {!cat.is_unallocated && (
                  cat.is_archived ? (
                    <button
                      onClick={() => unarchiveCategory(cat.id)}
                      id={`unarchive-cat-${cat.id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#CADBCE] text-[#2C523B] text-xs font-medium hover:bg-[#EBF2ED]"
                      title="Unarchive Envelope"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => archiveCategory(cat.id)}
                      id={`archive-cat-${cat.id}`}
                      className="p-2 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] text-[#78716C] hover:text-[#AF7832] transition-colors"
                      title="Archive Envelope (Never deletes money or pending payback)"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
