// All media mutations use the shared history and resolve targets after async work.
export function createMediaCommands({ findProject, uploads, safeName, shrink, getEpoch, setImageJobsPending, commit, touch }) {
  const operations = new Map();
  const keyFor = t => JSON.stringify([t.projectId, t.slot, t.galleryItemId]);
  const advance = key => { const id = (operations.get(key) || 0) + 1; operations.set(key, id); return id; };
  const cancelled = () => ({ status: 'cancelled' });
  function resolve(target) {
    const project = findProject(target.projectId);
    if (!project) return null;
    if (target.slot === 'cover' || target.slot === 'caseCover') return { object: project, key: target.slot };
    if (target.slot !== 'gallery' || !target.galleryItemId) return null;
    const shot = project.shots?.find(s => s.id === target.galleryItemId);
    return shot ? { object: shot, key: 'file' } : null;
  }
  function selectExistingAsset(target, assetId) {
    if (!assetId || !safeName(assetId)) return cancelled();
    const destination = resolve(target);
    if (!destination) return cancelled();
    advance(keyFor(target));
    if (destination.object[destination.key] === assetId) return { status: 'unchanged' };
    commit();
    destination.object[destination.key] = assetId;
    touch();
    return { status: 'applied' };
  }
  // Removes an explicit override (e.g. caseCover) so the slot falls back to its default (cover).
  function clearAsset(target) {
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
      destination.object[destination.key] = name;
      attached = true;
      touch();
      return { status: 'applied' };
    } catch (error) {
      return current() ? { status: 'error', message: error?.message || 'Не удалось обработать изображение.' } : cancelled();
    } finally {
      if (prepared && !attached) URL.revokeObjectURL(prepared.url);
      setImageJobsPending(-1);
    }
  }
  return { selectExistingAsset, uploadForTarget, clearAsset };
}
