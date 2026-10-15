import os
BASE_URL=os.environ.get("PORTFOLIO_URL","http://127.0.0.1:5173/design/").rstrip("/")+"/"
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json
out=Path(os.environ.get('PORTFOLIO_EVIDENCE_DIR','/tmp/design-evidence'));out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
 c.add_init_script("sessionStorage.setItem('intro-seen','1')")
 page=c.new_page(); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE_URL+'admin/');page.locator('#localDraft').click();page.locator('#editor').wait_for(state='visible')
 assert page.locator('#save').is_disabled(),page.locator('#saveState').inner_text()
 frame=page.frame_locator('.live-frame');card=frame.locator('[data-case="beautylab"]');card.focus();card.press('Enter')
 title=page.locator('.live-inspector').get_by_label('Заголовок карточки',exact=True);title.fill('Browser recovery check')
 # Use the real image preparation/upload path, producing an unmistakable solid color.
 image=page.evaluate('''async()=>{const c=document.createElement('canvas');c.width=120;c.height=80;c.getContext('2d').fillStyle='#df2050';c.getContext('2d').fillRect(0,0,120,80);return [...new Uint8Array(await (await new Promise(r=>c.toBlob(r,'image/png'))).arrayBuffer())]}''')
 cover=page.locator('.live-cover-field').first
 cover.get_by_role('button',name='Заменить',exact=True).focus();cover.get_by_role('button',name='Заменить',exact=True).press('Space')
 page.locator('.media-dialog[open]').wait_for()
 page.locator('.media-dialog input[type=file]').set_input_files({'name':'reload-check.png','mimeType':'image/png','buffer':bytes(image)})
 page.locator('.media-dialog[open]').wait_for(state='hidden')
 page.wait_for_function("() => document.querySelector('#localState').textContent==='Черновик сохранён на этом устройстве'")
 page.wait_for_function("() => document.querySelector('.live-cover-field img').naturalWidth===120")
 # Reuse one uploaded file as a gallery entry, then change order using keyboard buttons.
 page.get_by_role('button',name='Добавить изображение',exact=True).click()
 page.locator('.media-search').fill('media-')
 page.locator('.media-item').first.focus();page.locator('.media-item').first.press('Enter')
 page.locator('.media-dialog[open]').wait_for(state='hidden')
 page.locator('.live-gallery-item').last.get_by_role('button',name='Выше —').focus()
 page.locator('.live-gallery-item').last.get_by_role('button',name='Выше —').press('Space')
 page.wait_for_function("() => document.querySelector('#localState').textContent==='Черновик сохранён на этом устройстве'")
 # Actual reload, not a reconstructed application session.
 page.reload();page.locator('#localDraft').click();page.locator('#draftRecovery[open]').wait_for()
 page.get_by_role('button',name='Восстановить копию').click();page.locator('#editor').wait_for(state='visible')
 frame=page.frame_locator('.live-frame');frame.locator('[data-case="beautylab"]').focus();frame.locator('[data-case="beautylab"]').press('Enter')
 assert page.locator('.live-inspector').get_by_label('Заголовок карточки',exact=True).input_value()=='Browser recovery check'
 page.wait_for_function("() => document.querySelector('.live-cover-field img').naturalWidth===120")
 frame.locator('[data-case="beautylab"] img').first.wait_for()
 frame.locator('[data-case="beautylab"] img').first.evaluate('(img)=>img.decode()')
 assert frame.locator('[data-case="beautylab"] img').first.evaluate('(img)=>img.naturalWidth')==120
 # Inspect actual rendered pixels via canvas, not just blob URL presence.
 assert frame.locator('[data-case="beautylab"] img').first.evaluate("img=>{const c=document.createElement('canvas');c.width=1;c.height=1;let x=c.getContext('2d');x.drawImage(img,0,0,1,1);return [...x.getImageData(0,0,1,1).data]}")[0]>180
 stored=page.evaluate('''async()=>{const {createDraftStore,workspaceKey}=await import('./draft-store.js');const config=await(await fetch('../site-config.json')).json();return (await createDraftStore().read(workspaceKey(config.content,true))).snapshot;}''')
 assert len(stored['assets'])==1
 project=next(p for p in stored['document']['projects']['projects'] if p['slug']=='beautylab')
 assert project['shots'][-2]['file']==project['cover']
 page.screenshot(path=str(out/'recovered-wide.png'))
 # Incomplete text is allowed in autosave, strict publication still rejects it.
 title=page.locator('.live-inspector').get_by_label('Заголовок карточки',exact=True);title.fill('')
 page.wait_for_function("() => document.querySelector('#localState').textContent==='Черновик сохранён на этом устройстве'")
 page.reload();page.locator('#localDraft').click();page.get_by_role('button',name='Восстановить копию').click()
 frame=page.frame_locator('.live-frame');frame.locator('[data-case="beautylab"]').click()
 assert page.locator('.live-inspector').get_by_label('Заголовок карточки',exact=True).input_value()==''
 with page.expect_popup() as opened:page.locator('#preview').click()
 preview=opened.value;expect(preview.locator('[data-case="beautylab"] h3')).to_have_text('')
 preview.locator('[data-case="beautylab"] img').first.evaluate('(img)=>img.decode()')
 assert preview.locator('[data-case="beautylab"] img').first.evaluate('(img)=>img.naturalWidth')==120
 preview.close()
 page.locator('#save').click();assert 'title' in page.locator('#saveState').inner_text()
 assert not errors,errors
 print('PASS: real reload, shared Blob, rendered pixels in iframe, reordered gallery, incomplete title, strict publication validation; keyboard Enter/Space; no JS exceptions',flush=True)
 b.close()
