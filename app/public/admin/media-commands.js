/* Команды над изображением конкретной цели: Target = { projectId, slot }
   для одиночного слота (cover, caseCover — оба поля вида
   project[slot] = имя файла) либо { projectId, slot: 'gallery',
   galleryItemId } для одного вхождения галереи. Ни DOM, ни iframe этот
   модуль не знает — только document (через getData) и uploads; UI и
   рассылку в live preview делает вызывающий код (editor-live.js), как
   и раньше для одного-единственного replaceCover.

   Защита от гонок — та же, что уже проверена ревью на replaceCover:
   документ мог замениться целиком, пока файл сжимался (documentEpoch),
   или для той же цели мог начаться более новый выбор — побеждает
   последний выбор пользователя, а не то, что раньше досчиталось.
   uploadForTarget() добавляет ТРЕТЬЮ причину отбросить устаревший
   результат: необязательный isCancelled() — медиадиалог передаёт его,
   чтобы закрытие диалога до завершения сжатия аннулировало операцию,
   даже если документ и цель за это время не поменялись вовсе. */

export function createMediaCommands({ findProject, uploads, safeName, shrink, getEpoch, setImageJobsPending, touch, setStatus }) {
  const operationSeq = new Map();
  const nextOperationId = key => { const id = (operationSeq.get(key) ?? 0) + 1; operationSeq.set(key, id); return id; };
  const isLatestOperation = (key, id) => operationSeq.get(key) === id;

  const opKeyFor = target => target.projectId + ':' + target.slot + (target.galleryItemId != null ? ':' + target.galleryItemId : '');

  /* Куда именно записать имя файла: одиночный слот — просто поле
     проекта; галерея — конкретное вхождение по устойчивому id, а не
     по индексу (индекс за время await мог сдвинуться реордером). */
  function applyToTarget(project, target, assetName) {
    if (target.slot === 'gallery') {
      const shot = (project.shots || []).find(s => s.id === target.galleryItemId);
      if (!shot) return false;
      shot.file = assetName;
      return true;
    }
    project[target.slot] = assetName;
    return true;
  }

  /* Синхронно: гонки здесь нет, применять/не применять решается сразу */
  function selectExistingAsset(target, assetId) {
    if (!assetId || !safeName(assetId)) return false;
    const project = findProject(target.projectId);
    if (!project) return false;
    if (!applyToTarget(project, target, assetId)) return false;
    touch();
    return true;
  }

  async function uploadForTarget(target, file, { isCancelled } = {}) {
    if (!file) return false;
    const opKey = opKeyFor(target);
    const opId = nextOperationId(opKey);
    const epochAtStart = getEpoch();
    setImageJobsPending(1);

    /* setImageJobsPending(-1) обязан отработать РОВНО один раз, чем бы
       ни закончилась функция — отсюда finally. Но для ошибки этого
       недостаточно: setImageJobsPending сама пишет в ту же строку
       статуса ("Обрабатываю…" → "Есть несохранённые правки"), и если
       finally выполнится ПОСЛЕ setStatus(err.message), она тут же
       затирает только что показанную причину ошибки — поймано живой
       проверкой в браузере, а не тестом. jobDone() снимает занятость
       заранее в catch, до текста ошибки, и не даёт finally сделать
       это второй раз. */
    let jobDone = false;
    const finishJob = () => { if (!jobDone) { jobDone = true; setImageJobsPending(-1); } };

    let prepared = null, attached = false;
    try {
      prepared = await shrink(file);

      /* В таком порядке: сперва целиком новый документ, потом более
         новый выбор для той же цели, потом — специфичная для
         медиадиалога причина (например, диалог успели закрыть) */
      if (getEpoch() !== epochAtStart) return false;
      if (!isLatestOperation(opKey, opId)) return false;
      if (isCancelled?.()) return false;

      const project = findProject(target.projectId);
      if (!project) return false; // цель удалена или переименована мимо targetKey

      const uploadName = target.projectId + '-' + crypto.randomUUID();
      uploads.set(uploadName, prepared);
      if (!applyToTarget(project, target, uploadName)) { uploads.delete(uploadName); return false; }
      attached = true;

      touch();
      return true;
    } catch (err) {
      finishJob();
      setStatus(err.message, true);
      return false;
    } finally {
      if (prepared && !attached) URL.revokeObjectURL(prepared.url);
      finishJob();
    }
  }

  return { selectExistingAsset, uploadForTarget };
}
