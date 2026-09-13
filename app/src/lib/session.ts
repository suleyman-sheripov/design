export function seenIntro() {
  try { return sessionStorage.getItem('intro-seen') === '1' } catch { return false }
}
export function rememberIntro() {
  try { sessionStorage.setItem('intro-seen', '1') } catch { /* Без хранилища интро повторится при обновлении. */ }
}
