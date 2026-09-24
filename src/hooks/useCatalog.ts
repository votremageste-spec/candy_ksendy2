/**
 * Хук доступа к каталогу с состояниями загрузки и ошибки.
 *
 * Стайл-гайд запрещает пустые экраны: у каждого состояния должен быть свой
 * внятный вид. Поэтому хук честно различает «грузим», «ошибка» и «готово»,
 * а не отдаёт пустой массив во всех трёх случаях.
 */

import { useEffect, useState } from 'react';
import { subscribeToCatalog, type CatalogSource } from '@/lib/catalog';
import type { DessertCategory, DessertComponent } from '@/types';

interface CatalogState {
  categories: DessertCategory[];
  components: DessertComponent[];
  isLoading: boolean;
  error: string | null;
  /** Откуда пришли данные: из базы или из встроенного запаса. */
  source: CatalogSource | null;
}

export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>({
    categories: [],
    components: [],
    isLoading: true,
    error: null,
    source: null,
  });

  useEffect(() => {
    const unsubscribe = subscribeToCatalog(
      ({ categories, components, source }) => {
        setState({ categories, components, isLoading: false, error: null, source });
      },
      (message) => {
        setState((previous) => ({ ...previous, isLoading: false, error: message }));
      },
    );

    return unsubscribe;
  }, []);

  return state;
}
