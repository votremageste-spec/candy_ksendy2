/**
 * Правка каталога из админки.
 *
 * Запись идёт прямо в Firestore, минуя серверные функции: правила уже
 * разрешают это администратору, а конструктор у клиентов подписан на базу
 * через onSnapshot. Значит тумблер наличия срабатывает у всех сразу, без
 * перезагрузки и без промежуточного звена, которое пришлось бы ждать.
 */

import { doc, updateDoc } from 'firebase/firestore';
import { requireFirestore } from '@/lib/firebase';

/** Тумблер «в наличии». */
export async function setComponentStock(componentId: string, inStock: boolean): Promise<void> {
  await updateDoc(doc(requireFirestore(), 'components', componentId), { inStock });
}

/**
 * Новая цена позиции.
 *
 * Заодно снимается пометка «цена не подтверждена»: раз Ксения ввела число,
 * позиция считается готовой к продаже и появляется в конструкторе.
 * Нулевая цена — исключение: у декора, входящего в стоимость, это норма,
 * и пометку она снимать не должна.
 */
export async function setComponentPrice(componentId: string, price: number): Promise<void> {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Цена должна быть неотрицательным числом');
  }

  await updateDoc(doc(requireFirestore(), 'components', componentId), {
    price: Math.round(price),
    ...(price > 0 ? { needsPriceReview: false } : {}),
  });
}

/** Включение и выключение категории целиком — этим гасятся сезонные позиции. */
export async function setCategoryActive(categoryId: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(requireFirestore(), 'categories', categoryId), { isActive });
}
