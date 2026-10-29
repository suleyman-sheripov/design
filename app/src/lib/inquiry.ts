export type Inquiry = { name: string; email: string; message: string }
export function inquiryText(value: Inquiry) {
  return `Имя: ${value.name.trim()}\nПочта для ответа: ${value.email.trim()}\n\n${value.message.trim()}`
}
export function inquiryMailto(recipient: string, value: Inquiry) {
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent('Задача для Сулеймана Шерипова')}&body=${encodeURIComponent(inquiryText(value))}`
}
