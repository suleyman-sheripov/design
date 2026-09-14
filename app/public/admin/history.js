/* Общая транзакционная история для старой формы и живого инспектора.

   Раньше у каждой стороны было своё: admin.js вёл плоский массив
   снимков и коммитил каждую правку сразу (посимвольно для текстовых
   полей), а editor-live.js держал отдельный pendingCommit/commitTimer
   специально для своего поля заголовка. Redo не было нигде.

   Модель — ОДНА контрольная точка (lastKnownState), а не снимок,
   снимаемый в момент begin(). Первая попытка делать снимок в begin()
   ломалась именно на атомарных действиях (добавить/удалить/select/
   загрузка): их мутация происходит ДО вызова touch(), поэтому снимок,
   взятый внутри begin(), уже включал бы эту мутацию, и commit() не
   находил бы разницы — запись в историю просто не появлялась.
   lastKnownState обновляется только в момент, когда правка
   действительно фиксируется (touch() или commit()), поэтому порядок
   «мутация, потом touch()» и порядок «begin(), потом мутация»
   работают одинаково правильно.

   Модуль не знает о DOM и о сети — только о getData/setData/onChange,
   которые ему передают. wireTextCommit ниже — тонкая, необязательная
   обвязка конкретно для текстовых полей: группировка по паузе/уходу
   фокуса и защита от IME. */

export function createHistory({ getData, setData, onChange, limit = 60 }) {
  let undoStack = [];
  let redoStack = [];
  let lastKnownState = serialize();
  let openKey = null;
  /* Снимок redoStack, сделанный в момент begin() — не для чтения, а
     для ВОЗВРАТА, если открытая транзакция окажется пустышкой
     (cancel, или commit без реального изменения: набрал — стёр
     обратно). Раньше begin() уничтожал ветку Redo сразу, ещё до
     того, как стало известно, изменится ли документ вообще —
     ревью поймало это на begin()+cancel() без единой мутации. */
  let redoStackAtBegin = null;

  function serialize() { return JSON.stringify(getData()); }

  function finalizeIfChanged() {
    const now = serialize();
    if (now === lastKnownState) return false;
    undoStack.push(lastKnownState);
    if (undoStack.length > limit) undoStack.shift();
    lastKnownState = now;
    /* Здесь, а не превентивно в begin()/touch(): именно в этот
       момент правка становится настоящим шагом истории, и только
       тогда прежняя ветка Redo действительно относится к другому,
       уже нереализуемому будущему. */
    redoStack = [];
    onChange();
    return true;
  }

  function restoreAbandonedRedo() {
    if (redoStackAtBegin) redoStack = redoStackAtBegin;
    redoStackAtBegin = null;
  }

  /* key — не текст, а признак ИДЕНТИЧНОСТИ конкретного поля: объект,
     созданный один раз на вызов field(). Одинаковый label у двух
     разных строк таблицы не должен склеить их правки в одну
     транзакцию — только буквальное совпадение key делает это. */
  function begin(key) {
    if (openKey === key) return; // транзакция уже открыта под этим ключом
    commit(); // закрыть предыдущую, если была открыта под другим полем
    openKey = key;
    redoStackAtBegin = redoStack.slice();
  }

  /* Живой индикатор для кнопки «Повторить»: как только открытая
     транзакция реально разошлась с lastKnownState, Redo прячется —
     он относится к будущему, несовместимому с тем, что печатают
     прямо сейчас. Если ввод потом вернётся к исходному значению или
     будет отменён, restoreAbandonedRedo() в commit()/cancel() вернёт
     эту ветку обратно: сам факт временного расхождения не обязан
     быть окончательным. */
  function markDirty() {
    if (redoStack.length && serialize() !== lastKnownState) redoStack = [];
    onChange();
  }

  function commit() {
    if (openKey === null) return;
    openKey = null;
    if (finalizeIfChanged()) redoStackAtBegin = null;
    else restoreAbandonedRedo();
  }

  /* Разовое атомарное действие (добавить, удалить, переставить,
     загрузить, выбрать значение в select): мутация уже случилась к
     моменту вызова, сравниваем прямо с lastKnownState. openKey
     сбрасывается на всякий случай — если какое-то поле всё ещё в
     фокусе и не успело закоммититься по blur (клик по кнопке обычно
     сперва снимает фокус, но полагаться на это не стоит), его
     правка попадёт в ЭТУ же запись, а не потеряется. */
  function touch() {
    openKey = null;
    redoStackAtBegin = null;
    finalizeIfChanged();
  }

  /* Отменить незавершённую правку, не превращая её в шаг истории. */
  function cancel() {
    if (openKey === null) return;
    openKey = null;
    setData(JSON.parse(lastKnownState));
    restoreAbandonedRedo();
    onChange();
  }

  function undo() {
    /* Незавершённая правка сама становится тем шагом, который
       отменяется: набрал текст, передумал до паузы — Undo убирает
       именно набранное, а не что-то более раннее */
    commit();
    if (!undoStack.length) return false;
    redoStack.push(lastKnownState);
    if (redoStack.length > limit) redoStack.shift();
    lastKnownState = undoStack.pop();
    setData(JSON.parse(lastKnownState));
    onChange();
    return true;
  }

  function redo() {
    /* Симметрично undo(): если что-то как раз печатают в другом
       поле, эта правка обязана сперва стать записью истории, а не
       молча потеряться под setData() ниже. */
    commit();
    if (!redoStack.length) return false;
    undoStack.push(lastKnownState);
    if (undoStack.length > limit) undoStack.shift();
    lastKnownState = redoStack.pop();
    setData(JSON.parse(lastKnownState));
    onChange();
    return true;
  }

  function clear() {
    undoStack = [];
    redoStack = [];
    openKey = null;
    redoStackAtBegin = null;
    lastKnownState = serialize();
  }

  return {
    begin, markDirty, commit, touch, cancel, undo, redo, clear,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  };
}

/* Подключает поле ввода к истории: группирует по паузе и по уходу
   фокуса, и не даёт таймеру сработать посреди композиции через IME
   (важно для языков со сборным вводом — иначе таймер, заведённый до
   compositionstart, может сработать прямо в середине набора). */
export function wireTextCommit(history, input, key, { debounceMs } = {}) {
  let composing = false;
  let timer = 0;

  const schedule = () => {
    if (!debounceMs) return;
    clearTimeout(timer);
    timer = setTimeout(() => history.commit(), debounceMs);
  };

  input.addEventListener('compositionstart', () => { composing = true; clearTimeout(timer); });
  input.addEventListener('compositionend', () => { composing = false; schedule(); });
  input.addEventListener('input', () => {
    history.begin(key);
    history.markDirty();
    if (!composing) schedule();
  });
  input.addEventListener('blur', () => { clearTimeout(timer); history.commit(); });
}
