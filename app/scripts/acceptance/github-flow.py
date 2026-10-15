import os
BASE_URL=os.environ.get("PORTFOLIO_URL","http://127.0.0.1:5173/design/").rstrip("/")+"/"
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
from urllib.parse import urlparse
import json,base64
root=Path(__file__).resolve().parents[3]
source=json.loads((root/'content/data/site.json').read_text())
config=json.loads((root/'app/public/site-config.json').read_text())
config['content']['branch']='browser-acceptance-only'
files=[str(p.relative_to(root)) for p in (root/'content/work').glob('*.webp')]
state={'head':'old','data':source,'fail':True,'patch':None}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(reduced_motion='reduce');c.add_init_script("sessionStorage.setItem('intro-seen','1')")
 c.route('**/site-config.json',lambda r:r.fulfill(json=config))
 def api(route):
  req=route.request;path=urlparse(req.url).path
  if path=='/user': result={'login':config['content']['owner']}
  elif path.endswith('/design'):result={'permissions':{'push':True}}
  elif '/git/ref/heads/' in path:result={'object':{'sha':state['head']}}
  elif '/contents/content/data/site.json' in path:result={'content':base64.b64encode(json.dumps(state['data']).encode()).decode()}
  elif '/git/trees/' in path:result={'truncated':False,'tree':[{'path':n,'type':'blob'} for n in files]}
  elif req.method=='PATCH':
   state['patch']=req.post_data_json
   if state['fail']:route.fulfill(status=409,json={'message':'test conflict'});return
   state['head']='new';result={'sha':'new'}
  elif '/git/commits/' in path:result={'tree':{'sha':'tree'}}
  elif path.endswith('/git/trees'):
   state['data']=json.loads(req.post_data_json['tree'][0]['content']);result={'sha':'tree-new'}
  else:result={'sha':'new'}
  route.fulfill(json=result)
 c.route('https://api.github.com/**',api)
 page=c.new_page();page.goto(BASE_URL+'admin/')
 page.locator('#token').fill('browser-test-only-no-real-credential');page.locator('#gateForm').get_by_role('button',name='Войти',exact=True).click();page.locator('#editor').wait_for(state='visible')
 field=page.locator('#profileFields').get_by_label('Город',exact=True);field.fill('API integration test')
 expect(page.locator('#localState')).to_have_text('Черновик сохранён на этом устройстве')
 page.locator('#save').click();expect(page.locator('#saveState')).to_contain_text('Ветка изменилась')
 assert field.input_value()=='API integration test'
 stored=page.evaluate('''async()=>{const m=await import('./draft-store.js');const c=await(await fetch('../site-config.json')).json();return(await m.createDraftStore().read(m.workspaceKey(c.content,false))).snapshot;}''')
 assert stored['document']['profile']['city']=='API integration test'
 assert 'browser-test-only-no-real-credential' not in json.dumps(stored)
 state['fail']=False;page.locator('#save').click();expect(page.locator('#saveState')).to_contain_text('Сохранено одним коммитом')
 expect(page.locator('#save')).to_be_disabled()
 assert state['patch']['force'] is False
 assert page.evaluate('''async()=>{const m=await import('./draft-store.js');const c=await(await fetch('../site-config.json')).json();return(await m.createDraftStore().read(m.workspaceKey(c.content,false))).snapshot;}''') is None
 page.reload();expect(page.locator('#gate')).to_be_visible();assert page.locator('#token').input_value()==''
 print('PASS: owner login and GitHub save UI via intercepted API transport: 409 retains IndexedDB copy, success clears it after non-force PATCH, reload requires fresh login; no real network writes',flush=True)
 b.close()
