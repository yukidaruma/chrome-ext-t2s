import { createStorage, StorageEnum } from '../base/index.js';
import type { TextFilterStateType, TextFilterStorageType, TextFilter } from '../base/index.js';

const storage = createStorage<TextFilterStateType>(
  'text-filter-key',
  {
    filters: [],
    nextId: 1,
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const textFilterStorage: TextFilterStorageType = {
  ...storage,
  addFilter: async filterData => {
    const { filters, nextId } = await storage.get();
    const newFilter = {
      ...filterData,
      id: nextId,
    } as TextFilter;
    await storage.set({
      filters: [...filters, newFilter],
      nextId: nextId + 1,
    });
    return newFilter;
  },
  removeFilter: async id => {
    const { filters, nextId } = await storage.get();
    await storage.set({
      filters: filters.filter(f => f.id !== id),
      nextId,
    });
  },
  updateFilter: async (id, updates) => {
    const { filters, nextId } = await storage.get();
    const updatedFilters = filters.map(f => (f.id === id ? ({ ...f, ...updates } as TextFilter) : f));
    await storage.set({
      filters: updatedFilters,
      nextId,
    });
  },
};
