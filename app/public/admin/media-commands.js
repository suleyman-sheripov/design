// All media mutations use the shared history and resolve targets after async work.
export function createMediaCommands({ findProject, uploads, safeName, shrink, getEpoch, setImageJobsPending, commit, touch }) {
  const operations = new Map();
  const keyFor = t => JSON.stringify([t.projectId, t.slot, t.galleryItemId]);
  const advance = key => { const id = (operations.get(key) || 0) + 1; operations.set(key, id); return id; };
  const cancelled = () => ({ status: 'cancelled' });
  function resolve(target) {
    const project = findProject(target.projectId);
    if (!project) return null;
    if (target.slot === 'gallery-add') return project.shots.length < 100 ? { project, append: true } : null;
    if (target.slot === 'cover' || target.slot === 'caseCover') return { object: project, key: target.slot };
    if (target.slot !== 'gallery' || !target.galleryItemId) return null;
    const shot = project.shots?.find(s => s.id === target.galleryItemId);
    return shot ? { object: shot, key: 'file' } : null;
  }
  function apply(destination, assetId) {
    if (destination.append) {
      const shot = { id: crypto.randomUUID(), file: assetId, alt: '' };
      destination.project.shots.push(shot);
      return { status: 'applied', galleryItemId: shot.id };
    }
    destination.object[destination.key] = assetId;
    return { status: 'applied' };
  }
  function selectExistingAsset(target, assetId) {
    if (!assetId || !safeName(assetId)) return cancelled();
    const destination = resolve(target);
    if (!destination) return cancelled();
    advance(keyFor(target));
    if (!destination.append && destination.object[destination.key] === assetId) return { status: 'unchanged' };
    commit();
    const result = apply(destination, assetId);
    touch();
    return result;
  }
  // Removes an explicit caseCover override so it falls back to cover. Not a
  // general "clear any slot": cover is required (there is no fallback for
  // it), and a gallery entry is removed as a whole entry (removeGalleryItem),
  // not reduced to an empty file name.
  function clearAsset(target) {
    if (target.slot !== 'caseCover') return cancelled();
    const destination = resolve(target);
    if (!destination) return cancelled();
    advance(keyFor(target));
    if (!destination.object[destination.key]) return { status: 'unchanged' };
    commit();
    destination.object[destination.key] = undefined;
    touch();
    return { status: 'applied' };
  }
  async function uploadForTarget(target, file, { isCancelled } = {}) {
    if (!file || !resolve(target)) return cancelled();
    const key = keyFor(target), operation = advance(key), epoch = getEpoch();
    const current = () => getEpoch() === epoch && operations.get(key) === operation && !isCancelled?.() && !!resolve(target);
    let prepared, attached = false;
    setImageJobsPending(1);
    try {
      prepared = await shrink(file);
      if (!current()) return cancelled();
      // Commit text immediately before the media mutation, not before await.
      commit();
      const destination = resolve(target);
      const name = 'media-' + crypto.randomUUID();
      uploads.set(name, prepared);
      const result = apply(destination, name);
      attached = true;
      touch();
      return result;
    } catch (error) {
      return current() ? { status: 'error', message: error?.message || 'Не удалось обработать изображение.' } : cancelled();
    } finally {
      if (prepared && !attached) URL.revokeObjectURL(prepared.url);
      setImageJobsPending(-1);
    }
  }
  function removeGalleryItem(target) {
    const project = findProject(target.projectId);
    const index = target.slot === 'gallery' ? project?.shots.findIndex(s => s.id === target.galleryItemId) : -1;
    if (index === undefined || index < 0) return cancelled();
    advance(keyFor(target));
    commit();
    project.shots.splice(index, 1);
    touch();
    return { status: 'applied', galleryItemId: project.shots[Math.min(index, project.shots.length - 1)]?.id };
  }
  function moveGalleryItem(target, direction) {
    const project = findProject(target.projectId);
    const index = target.slot === 'gallery' ? project?.shots.findIndex(s => s.id === target.galleryItemId) : -1;
    if (index === undefined || index < 0 || ![-1,1].includes(direction)) return cancelled();
    const next = index + direction;
    if (next < 0 || next >= project.shots.length) return { status: 'unchanged' };
    commit();
    [project.shots[index], project.shots[next]] = [project.shots[next], project.shots[index]];
    touch();
    return { status: 'applied', galleryItemId: target.galleryItemId };
  }
  return { selectExistingAsset, uploadForTarget, clearAsset, removeGalleryItem, moveGalleryItem };
}
