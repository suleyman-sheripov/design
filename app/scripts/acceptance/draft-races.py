import os
BASE_URL=os.environ.get("PORTFOLIO_URL","http://127.0.0.1:5173/design/").rstrip("/")+"/"
from playwright.sync_api import sync_playwright, expect
import json
BASE=BASE_URL+'admin/'
def enter(page):
 page.goto(BASE);page.locator('#localDraft').click();page.locator('#editor').wait_for(state='visible')
def city(page):return page.locator('#profileFields').get_by_label('Город',exact=True)
def saved(page):expect(page.locator('#localState')).to_have_text('Черновик сохранён на этом устройстве')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(reduced_motion='reduce');c.add_init_script("sessionStorage.setItem('intro-seen','1')")
 a=c.new_page();d=c.new_page();enter(a);enter(d)
 city(a).fill('Tab A retained');saved(a)
 city(d).fill('Tab B memory');expect(d.locator('#localState')).to_contain_text('Другая вкладка')
 assert city(d).input_value()=='Tab B memory'
 d.on('dialog',lambda dialog:dialog.accept());d.locator('#reload').click()
 d.locator('#draftRecovery[open]').wait_for();d.locator('#restoreDraft').click();expect(city(d)).to_have_value('Tab A retained')
 d.locator('#signOut').click();d.locator('#localDraft').wait_for();d.locator('#localDraft').click();d.locator('#restoreDraft').click();expect(city(d)).to_have_value('Tab A retained')
 d.evaluate('''()=>{window.realTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(names,mode,...args){if(mode==='readwrite')throw new DOMException('Quota full','QuotaExceededError');return window.realTransaction.call(this,names,mode,...args);}}''')
 city(d).fill('After quota retry');expect(d.locator('#localState')).to_contain_text('Не удалось сохранить')
 d.locator('#reload').click();expect(d.locator('#saveState')).to_contain_text('Quota full')
 assert city(d).input_value()=='After quota retry'
 d.evaluate('()=>{IDBDatabase.prototype.transaction=window.realTransaction}')
 d.locator('#retryDraft').click();saved(d)
 d.reload();d.locator('#localDraft').click();d.locator('#restoreDraft').click();expect(city(d)).to_have_value('After quota retry')
 # Pending reread must discard both waiting and in-flight writes.
 city(d).fill('Discard this pending edit');d.locator('#reload').click()
 expect(city(d)).not_to_have_value('Discard this pending edit');expect(d.locator('#save')).to_be_disabled()
 d.reload();d.locator('#localDraft').click();d.locator('#editor').wait_for(state='visible');assert d.locator('#draftRecovery[open]').count()==0
 source=d.request.get(BASE_URL+'content/data/site.json').json();source['profile']['city']='Imported document'
 city(d).fill('Old pending document');d.locator('#importDraft').set_input_files({'name':'test-import.json','mimeType':'application/json','buffer':json.dumps(source).encode()})
 expect(city(d)).to_have_value('Imported document');saved(d)
 d.reload();d.locator('#localDraft').click();d.locator('#restoreDraft').click();expect(city(d)).to_have_value('Imported document')
 print('PASS: real IndexedDB two-tab conflict, explicit reread recovery, sign-out preserves draft, quota failure/discard/retry, pending reread/import cannot resurrect old work',flush=True)
 c.close()
 # Unavailable storage leaves ordinary editor and export usable.
 c=b.new_context(reduced_motion='reduce');c.add_init_script("Object.defineProperty(window,'indexedDB',{value:undefined});sessionStorage.setItem('intro-seen','1')")
 d=c.new_page();enter(d);expect(d.locator('#localState')).to_contain_text('IndexedDB недоступна')
 city(d).fill('Manual editing still works');assert d.locator('#backup').is_enabled()
 print('PASS: unavailable IndexedDB permits manual editing and export',flush=True)
 b.close()
