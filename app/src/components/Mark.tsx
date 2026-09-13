/* Знак Ш, в котором сведены S и H. Отрисован владельцем, геометрия
   не правится: контур приходит из assets/logo/mark-source.svg как
   есть. Здесь он инлайном, потому что красится currentColor и
   участвует в анимации интро. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 483 300" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        fill="currentColor"
        d="M40 0H120.6C120.6 0 80.6 43.4 80.6 77.2C80.6 111.1 120.9 120.6 120.6 154.5C120.3 187.7 80.6 230 80.6 230H226.2V0H301.8V154.2H407.4V0H483V300H407.4V230H301.8V300H0V230C0 196.7 39.7 187.7 40 154.5C40.3 120.6 0 111.1 0 77.2C0 43.4 40 0 40 0Z"
      />
    </svg>
  )
}
