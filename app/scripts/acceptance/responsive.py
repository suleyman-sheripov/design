import os
BASE_URL=os.environ.get("PORTFOLIO_URL","http://127.0.0.1:5173/design/").rstrip("/")+"/"
from playwright.sync_api import sync_playwright
from pathlib import Path
import json
out=Path(os.environ.get('PORTFOLIO_EVIDENCE_DIR','/tmp/design-evidence'));out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
 c.add_init_script("sessionStorage.setItem('intro-seen','1')")
 page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE_URL);page.locator('[data-case="beautylab"]').wait_for()
 page.screenshot(path=str(out/'site-wide.png'))
 for w,h in [(390,844),(768,1000),(1440,1000)]:
  page.set_viewport_size({'width':w,'height':h});page.locator('[data-case="beautylab"]').scroll_into_view_if_needed()
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'public overflow at {w}'
  card=page.locator('[data-case="beautylab"]');card.focus();card.press('Enter')
  page.wait_for_url('**/#/work/beautylab');page.locator('.case-page').wait_for()
  page.reload();page.locator('.case-page').wait_for();page.locator('.case-page img').first.evaluate('(img)=>img.decode()')
  assert page.locator('.case-page img').first.evaluate('(img)=>img.naturalWidth')>0
  if w==390:page.screenshot(path=str(out/'case-390.png'))
  page.goto(BASE_URL)
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'site-390.png'))
 page.goto(BASE_URL+'admin/');page.locator('#localDraft').click();page.locator('#editor').wait_for(state='visible')
 for w,h in [(1440,1000),(768,1000),(390,844)]:
  page.set_viewport_size({'width':w,'height':h});page.evaluate('scrollTo(0,0)')
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'admin overflow at {w}'
  if w in [1440,390]:page.screenshot(path=str(out/f'admin-{w}.png'))
 frame=page.frame_locator('.live-frame');frame.locator('[data-case="beautylab"]').click()
 page.locator('.live-cover-field').first.get_by_role('button',name='Заменить',exact=True).click()
 page.locator('.media-search').fill('no-matching-image');assert 'Не найдено' in page.locator('.media-empty').inner_text() or 'Ничего' in page.locator('.media-empty').inner_text()
 page.screenshot(path=str(out/'media-empty-390.png'))
 page.locator('.media-search').fill('');page.screenshot(path=str(out/'media-390.png'))
 assert page.locator('.media-dialog').evaluate('(el)=>el.getBoundingClientRect().right <= innerWidth')
 page.keyboard.press('Escape');assert page.locator('.media-dialog[open]').count()==0
 print('PASS: site/admin 390,768,1440; case navigation and reload; images decoded; media dialog empty state and Escape; no page overflow',flush=True)
 assert not errors,errors
 b.close()
