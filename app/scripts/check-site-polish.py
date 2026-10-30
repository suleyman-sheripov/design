from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,os,json
base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:4180/design/').rstrip('/')+'/'
out=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/site-polish-check');out.mkdir(parents=True,exist_ok=True)
report={};errors=[]
instrument='''sessionStorage.setItem('intro-seen','1');window.audioProbe={contexts:[],sources:[]};const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(...args){super(...args);audioProbe.contexts.push(this)}createBufferSource(){const s=super.createBufferSource();const record={node:s,ended:false};s.addEventListener('ended',()=>record.ended=true);audioProbe.sources.push(record);return s}};'''
def skip(pg):
 pg.get_by_role('button',name='Пропустить').click()
 pg.wait_for_function("!document.querySelector('main[inert]')")
 pg.wait_for_selector('.brand-curtain',state='detached')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 for w,h in [(1440,900),(390,844)]:
  c=b.new_context(viewport={'width':w,'height':h},is_mobile=w==390,has_touch=w==390)
  pg=c.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));pg.add_init_script(instrument)
  pg.goto(base,wait_until='domcontentloaded');pg.wait_for_selector('.brand-intro')
  report[f'{w}_old_session_still_plays']=True;skip(pg)
  report[f'{w}_first_visit_silent']=pg.evaluate('audioProbe.contexts.length')==0
  pg.reload(wait_until='domcontentloaded');pg.wait_for_selector('.brand-intro');report[f'{w}_reload_plays']=True;skip(pg)
  y=pg.locator('.kinetic-name').bounding_box()['y']
  trigger=pg.locator('.contact-orbit-trigger')
  if w==390:trigger.tap()
  else:trigger.focus();pg.keyboard.press('Enter')
  pg.wait_for_selector('.contact-orbit[data-open=true]');pg.wait_for_timeout(1600)
  report[f'{w}_contacts_no_shift']=abs(pg.locator('.kinetic-name').bounding_box()['y']-y)<.5
  report[f'{w}_contacts_in_view']=all(0<=a['x'] and a['x']+a['width']<=w+1 for a in pg.locator('.contact-orbit-link').evaluate_all('els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,width:r.width}})'))
  pg.screenshot(path=str(out/f'contacts-{w}.png'));pg.keyboard.press('Escape')
  initial_url=pg.url;cta=pg.locator('.living-cta');cta.click();pg.wait_for_selector('dialog:modal')
  report[f'{w}_cta_opens_form_not_case']=pg.url==initial_url and pg.locator('.case-cover').count()==0
  report[f'{w}_form_focus']=pg.evaluate("document.activeElement.name==='name'")
  pg.get_by_role('button',name='Открыть письмо').click();report[f'{w}_required_fields']=pg.locator('.project-inquiry input:invalid').count()>0
  pg.locator('[name=name]').fill('Анна & Co');pg.locator('[name=email]').fill('anna+design@example.org');pg.locator('[name=message]').fill('Нужен логотип.\nhttps://example.org/?a=1&b=2')
  pg.screenshot(path=str(out/f'form-{w}.png'))
  pg.get_by_role('button',name='Открыть письмо').click();pg.wait_for_function("document.querySelector('.inquiry-status').textContent.includes('Письмо подготовлено')")
  report[f'{w}_mail_draft_retained']=pg.locator('[name=message]').input_value().startswith('Нужен логотип') and pg.url==initial_url
  pg.keyboard.press('Escape');pg.wait_for_selector('dialog:modal',state='detached')
  report[f'{w}_form_returns_focus']=cta.evaluate('e=>e===document.activeElement')
  cta.click();pg.wait_for_selector('dialog:modal');report[f'{w}_form_keeps_text']=pg.locator('[name=name]').input_value()=='Анна & Co'
  pg.get_by_role('button',name='Закрыть форму').click()
  report[f'{w}_replay_is_last']=pg.locator('.intro-replay').evaluate("e=>e===document.querySelector('.portfolio-home').lastElementChild && e.getBoundingClientRect().top>=document.querySelector('.portfolio-home footer').getBoundingClientRect().bottom")
  pg.locator('.intro-replay').scroll_into_view_if_needed();pg.wait_for_timeout(300)
  pg.screenshot(path=str(out/f'footer-{w}.png'))
  return_y=pg.evaluate('scrollY')
  pg.get_by_role('button',name='Заставка со звуком',exact=True).click();pg.wait_for_selector('.brand-intro')
  pg.wait_for_function('audioProbe.sources.length===1')
  report[f'{w}_real_stereo_sound']=pg.evaluate('audioProbe.sources[0].node.buffer.numberOfChannels===2 && audioProbe.sources[0].node.buffer.duration>3.7')
  skip(pg);pg.wait_for_function('audioProbe.sources.every(s=>s.ended)');report[f'{w}_skip_stops_audio']=True
  report[f'{w}_replay_restores_footer']=abs(pg.evaluate('scrollY')-return_y)<2
  report[f'{w}_replay_restores_focus']=pg.get_by_role('button',name='Заставка со звуком',exact=True).evaluate('e=>e===document.activeElement')
  pg.get_by_role('button',name='Смотреть заставку').click();pg.wait_for_selector('.brand-intro');pg.wait_for_timeout(250)
  report[f'{w}_silent_replay']=pg.evaluate('audioProbe.sources.length')==1;skip(pg)
  pg.wait_for_timeout(1200);pg.screenshot(path=str(out/f'hero-{w}.png'))
  y=pg.locator('#work').evaluate('e=>e.getBoundingClientRect().top+scrollY')
  for i,offset in enumerate([0,h*.5,h*1.1]):
   pg.evaluate('y=>scrollTo({top:y,behavior:"instant"})',y+offset);pg.wait_for_timeout(300);pg.screenshot(path=str(out/f'ribbon-{w}-{i}.png'))
  report[f'{w}_no_overflow']=pg.evaluate('document.documentElement.scrollWidth<=innerWidth')
  c.close()
 c=b.new_context(reduced_motion='reduce');pg=c.new_page();pg.goto(base,wait_until='networkidle');report['reduced_auto_skipped']=pg.locator('.brand-intro').count()==0
 pg.get_by_role('button',name='Смотреть заставку').click();pg.wait_for_selector('.brand-intro');pg.wait_for_timeout(400);report['reduced_manual_can_play']=pg.locator('.brand-intro').count()==1;skip(pg);c.close()
 c=b.new_context();pg=c.new_page();pg.add_init_script("AudioContext.prototype.resume=function(){return Promise.reject(new Error('denied'))}");pg.goto(base,wait_until='domcontentloaded');pg.wait_for_selector('.brand-intro');skip(pg)
 pg.get_by_role('button',name='Заставка со звуком',exact=True).click();pg.wait_for_selector('.brand-intro');skip(pg);report['denied_audio_still_replays']=pg.locator('.intro-replay [role=status]').inner_text().startswith('Звук недоступен');c.close()
 c=b.new_context();pg=c.new_page();pg.add_init_script(instrument);pg.goto(base+'brand-motion/',wait_until='networkidle');pg.get_by_role('button',name='Повторить со звуком').click();pg.wait_for_function('audioProbe.sources.length===1');pg.get_by_role('button',name='Пауза',exact=True).click();pg.wait_for_function('audioProbe.sources[0].ended');report['preview_pause_stops_audio']=True;c.close()
 c=b.new_context();pg=c.new_page();pg.goto(base+'?editor-preview=1',wait_until='networkidle');report['editor_preview_skips_intro']=pg.locator('.brand-intro').count()==0;c.close()
 b.close()
report['page_errors']=errors
(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
assert not errors,errors
for key,value in report.items():
 if isinstance(value,bool):assert value,key
