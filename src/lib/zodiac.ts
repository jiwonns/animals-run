import { CHARACTER_BY_ID, type Character } from '@/constants/characters';
import { SEOLLAL, SEOLLAL_FIRST_YEAR, SEOLLAL_LAST_YEAR, ZODIAC } from '@/constants/gacha.generated';

/**
 * Turns 8 typed digits (YYYYMMDD) into the YYYY-MM-DD birthday firestore.rules accepts, or null when it
 * isn't a real date from SEOLLAL_FIRST_YEAR to today.
 */
export function parseBirthday(digits: string): string | null {
  if (!/^\d{8}$/.test(digits)) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(year, month - 1, day);
  if (year < SEOLLAL_FIRST_YEAR || year > SEOLLAL_LAST_YEAR || date.getMonth() !== month - 1 || date.getDate() !== day || date > new Date()) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/** Korean names of the years, in ZODIAC order; the dog year is 개띠 even though the character is 강아지. */
const YEAR_NAMES = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];

/**
 * The starter animal for a YYYY-MM-DD birthday and the year's name (e.g. 말띠). Years turn at Seollal, so
 * a birthday before that year's lunar new year belongs to the previous animal; firestore.rules agrees.
 */
export function zodiacOf(birthday: string): Character & { yearName: string } {
  const [y, m, d] = birthday.split('-');
  const year = Number(y);
  const zodiacYear = Number(m + d) < Number(SEOLLAL[year - SEOLLAL_FIRST_YEAR]) ? year - 1 : year;
  const index = (zodiacYear - 4) % 12;
  return { ...CHARACTER_BY_ID[ZODIAC[index]], yearName: `${YEAR_NAMES[index]}띠` };
}
