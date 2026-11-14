export function georgianError(error, { save = false } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return save
      ? 'ინტერნეტი არ არის. პარტია არ შეინახა.'
      : 'ინტერნეტი არ არის. მონაცემები ვერ ჩაიტვირთა.'
  }

  const message = String(error?.message || error || '')
  const code = error?.code

  if (/rate limit/i.test(message)) return 'ბევრი მცდელობაა. ცოტა ხანში სცადე.'
  if (/unable to validate email|invalid email/i.test(message)) return 'ელფოსტა არასწორია.'
  if (code === '23505' || /duplicate/i.test(message)) return 'ეს სახელი უკვე არსებობს.'
  if (code === '42501' || /row-level security|permission denied/i.test(message)) return 'ამის უფლება არ გაქვს.'
  if (/jwt|session expired|invalid claim/i.test(message)) return 'სესია ამოიწურა. თავიდან შედი.'
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return save
      ? 'კავშირი ვერ დამყარდა. პარტია არ შეინახა.'
      : 'კავშირი ვერ დამყარდა. სცადე თავიდან.'
  }

  return save ? 'პარტია არ შეინახა. სცადე თავიდან.' : 'შეცდომა მოხდა. სცადე თავიდან.'
}
