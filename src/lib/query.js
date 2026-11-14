export function unwrap(result) {
  if (result.error) throw result.error
  return result.data ?? []
}
