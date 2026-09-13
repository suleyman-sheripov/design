import { CONTENT_FILE, SHOTS_DIR, validateContent, imageNames } from './model.js';

export class GitHub {
  constructor(auth, request = (...args) => fetch(...args)) {
    if (!/^[\w.-]+$/.test(auth.owner) || !/^[\w.-]+$/.test(auth.repo) || !auth.branch || /[\s?#]/.test(auth.branch)) throw new Error('Проверь владельца, репозиторий и ветку.');
    this.auth = auth;
    this.request = request;
  }
  async api(path, method = 'GET', body, user = false) {
    const { owner, repo, token } = this.auth;
    let res;
    try {
      res = await this.request(user ? 'https://api.github.com/user' : `https://api.github.com/repos/${owner}/${repo}${path}`, {
        method, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? {'Content-Type':'application/json'} : {}) },
        ...(body ? {body: JSON.stringify(body)} : {}),
      });
    } catch { throw new Error('Нет ответа GitHub. Правки остались в редакторе; проверь связь и повтори.'); }
    if (!res.ok) {
      const messages = {401:'Токен не принят или истёк.',403:'Нет доступа. Проверь Contents: Read and write, срок токена и лимит запросов GitHub.',404:'Не найдены репозиторий, ветка или контент. Проверь настройки и первый push.',409:'Ветка изменилась. Скачай копию правок и перечитай содержимое.',422:'GitHub отклонил запись: ветка могла измениться или быть защищена правилами.'};
      throw new Error(messages[res.status] || `GitHub вернул ошибку ${res.status}. Повтори позже.`);
    }
    return res.json();
  }
  raw(path, ref = this.auth.branch) {
    return `https://raw.githubusercontent.com/${this.auth.owner}/${this.auth.repo}/${encodeURIComponent(ref)}/${path}`;
  }
  async authorize() {
    const user = await this.api('', 'GET', undefined, true);
    if (user.login?.toLowerCase() !== this.auth.owner.toLowerCase()) throw new Error('Вход разрешён только владельцу сайта: ' + this.auth.owner + '.');
    const repo = await this.api('');
    if (!repo.permissions?.push) throw new Error('У этого аккаунта нет права записи в репозиторий.');
    return user.login;
  }
  async head() { return (await this.api('/git/ref/heads/' + encodeURIComponent(this.auth.branch))).object.sha; }
  async load() {
    const head = await this.head();
    const file = await this.api('/contents/' + CONTENT_FILE + '?ref=' + head);
    const data = validateContent(JSON.parse(decode(file.content)));
    const tree = await this.api('/git/trees/' + head + '?recursive=1');
    if (tree.truncated) throw new Error('Дерево репозитория слишком большое для редактора.');
    return { head, data, files: new Set(tree.tree.filter(x => x.type === 'blob').map(x => x.path)) };
  }
  async save(data, uploads, previousHead) {
    validateContent(data);
    if (await this.head() !== previousHead) throw new Error('После открытия редактора ветка изменилась. Скачай копию правок, затем нажми «Перечитать». Чужие правки не перезаписаны.');
    const commit = await this.api('/git/commits/' + previousHead);
    const tree = [{path: CONTENT_FILE, mode:'100644', type:'blob', content: JSON.stringify(data, null, 2) + '\n'}];
    const used = new Set(imageNames(data));
    for (const [name, image] of uploads) {
      if (!used.has(name)) continue;
      const blob = await this.api('/git/blobs', 'POST', {content: encode(image.bytes), encoding:'base64'});
      tree.push({path: `${SHOTS_DIR}/${name}.webp`, mode:'100644', type:'blob', sha:blob.sha});
    }
    const nextTree = await this.api('/git/trees', 'POST', {base_tree:commit.tree.sha, tree});
    const next = await this.api('/git/commits', 'POST', {message:'Обновить содержимое портфолио', tree:nextTree.sha, parents:[previousHead]});
    /* force:false защищает и от изменения ветки между проверкой и записью. */
    await this.api('/git/refs/heads/' + encodeURIComponent(this.auth.branch), 'PATCH', {sha:next.sha, force:false});
    return next.sha;
  }
}
export function encode(bytes) {
  let binary = '';
  for (let i=0;i<bytes.length;i+=0x8000) binary += String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
}
export function decode(value) { return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/g,'')), ch => ch.charCodeAt(0))); }
