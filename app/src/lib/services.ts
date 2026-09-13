// Состав взят из портфолио, опыта и списка инструментов владельца.
export const SERVICES = [
  { id:'identity', title:'Айдентика', group:'brand', hero:true, detail:'Визуальная концепция бренда: цвет, типографика, графика и оформление носителей.' },
  { id:'logos', title:'Логотипы', group:'brand', hero:true, detail:'Знак и шрифтовое начертание, версии для разных размеров и носителей.' },
  { id:'packaging', title:'Упаковка', group:'brand', hero:true, detail:'Дизайн упаковки и векторные макеты, в том числе под флексопечать.' },
  { id:'print', title:'Афиши и наружная реклама', group:'brand', hero:false, detail:'Афиши, печатная графика и макеты для уличных рекламных конструкций.' },
  { id:'social', title:'Соцсети', group:'brand', hero:true, detail:'Оформление сообществ, шаблоны публикаций и рекламные материалы.' },
  { id:'web', title:'Сайты', group:'digital', hero:true, detail:'Структура страниц и дизайн сайта: от первого экрана до целевого действия.' },
  { id:'interfaces', title:'UI/UX', group:'digital', hero:true, detail:'Пользовательские сценарии и интерфейсы цифровых продуктов.' },
  { id:'prototypes', title:'Прототипы', group:'digital', hero:true, detail:'Связанные экраны в Figma, чтобы проверить сценарий до разработки.' },
  { id:'uikits', title:'UI-киты', group:'digital', hero:true, detail:'Компоненты, состояния и правила оформления для передачи разработчику.' },
  { id:'marketplace', title:'Карточки товаров', group:'visual', hero:false, detail:'Изображения и инфографика для карточек на маркетплейсах.' },
  { id:'presentations', title:'Презентации', group:'visual', hero:true, detail:'Композиция слайдов, типографика и наглядная подача материала.' },
  { id:'mockups', title:'Мокапы и ретушь', group:'visual', hero:false, detail:'Обработка изображений и визуализация дизайна на носителях.' },
  { id:'motion', title:'Моушн-дизайн', group:'visual', hero:true, detail:'Анимация графики и ролики в After Effects.' },
] as const
