from playwright.sync_api import sync_playwright
from pathlib import Path
from PIL import Image,ImageChops
import json,datetime,os,sys,io
out=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/sheripov-motion-check');out.mkdir(parents=True,exist_ok=True)
base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5173/design/').rstrip('/')+'/'
report={}; errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.goto(base+'brand-motion/index.html')
 page.locator('input').fill('3.72')
 page.locator('.motion-stage svg').screenshot(path=str(out/'final-animated.png'))
 page.evaluate('''() => {document.querySelectorAll('svg [clip-path],svg [mask]').forEach(e=>{e.removeAttribute('clip-path');e.removeAttribute('mask')})}''')
 page.locator('.motion-stage svg').screenshot(path=str(out/'final-unmasked.png'))
 report['final_exact_pixels']=ImageChops.difference(Image.open(out/'final-animated.png').convert('RGB'),Image.open(out/'final-unmasked.png').convert('RGB')).getbbox() is None
 page.reload();page.locator('input').fill('1.139')
 page.locator('.motion-stage svg').screenshot(path=str(out/'s-before.png'))
 page.locator('input').fill('1.14')
 page.locator('.motion-stage svg').screenshot(path=str(out/'s-after.png'))
 # H is also moving; compare only the S's region.
 a=Image.open(out/'s-before.png').convert('RGB');c=Image.open(out/'s-after.png').convert('RGB')
 report['s_finish_difference_bbox']=ImageChops.difference(a,c).getbbox()
 page.locator('input').fill('3.72');page.screenshot(path=str(out/'preview-light.png'))
 page.get_by_role('button',name='Тёмный фон').click();page.screenshot(path=str(out/'preview-dark.png'))
 for width,height in [(1440,900),(390,844)]:
  c=b.new_context(viewport={'width':width,'height':height});pg=c.new_page();pg.on('pageerror',lambda e: errors.append(str(e)))
  pg.clock.install();pg.clock.pause_at(datetime.datetime.now()+datetime.timedelta(seconds=1))
  pg.goto(base,wait_until='domcontentloaded');pg.wait_for_selector('.brand-intro');pg.wait_for_timeout(150);pg.clock.run_for(80)
  for t in [0,800,1500,2200,3100,3700,3950,4100,4500,5200]:
   if t:pg.clock.run_for(t-prev)
   prev=t
   if t == 3950:
    # The header is inert during landing, so hit testing cannot measure visibility.
    # Read the actual rendered pixel at the terminal dot's center instead.
    box=pg.locator('.brand-lockup svg').bounding_box()
    shot=Image.open(io.BytesIO(pg.screenshot())).convert('RGB')
    point=(round(box['x']+(4759.5-242.84049)/4604.65951*box['width']),round(box['y']+(574-52)/616*box['height']))
    report[f'{width}_handoff_above_curtain']=sum(abs(a-b) for a,b in zip(shot.getpixel(point),(47,97,130)))<20
   if t in [1500,2200,3700,3950,4100,5200]:pg.screenshot(path=str(out/f'site-{width}-{t}.png'))
  report[f'{width}_overflow']=pg.evaluate('document.documentElement.scrollWidth>innerWidth')
  report[f'{width}_finished']=pg.locator('.brand-intro').count()==0 and pg.locator('header[inert]').count()==0
  report[f'{width}_unlocked']=pg.evaluate('document.documentElement.style.overflow')==''
  # reload skips the intro for an existing session
  pg.reload(wait_until='domcontentloaded');pg.wait_for_selector('.site-header');pg.clock.run_for(100)
  report[f'{width}_reload_skips']=pg.locator('.brand-intro').count()==0
  c.close()
 c=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');pg=c.new_page()
 pg.goto(base,wait_until='networkidle');report['reduced_motion_skips']=pg.locator('.brand-intro').count()==0
 pg.screenshot(path=str(out/'site-reduced-390.png'));c.close()
 c=b.new_context();pg=c.new_page();pg.goto(base,wait_until='domcontentloaded')
 pg.get_by_role('button',name='Пропустить').focus();pg.keyboard.press('Enter');pg.wait_for_timeout(1100)
 report['keyboard_skip_unlocks']=pg.locator('.brand-intro').count()==0 and pg.locator('main[inert]').count()==0
 c.close()
 c=b.new_context();pg=c.new_page();pg.clock.install();pg.clock.pause_at(datetime.datetime.now()+datetime.timedelta(seconds=1))
 pg.add_init_script('window.requestAnimationFrame = () => 0; window.cancelAnimationFrame = () => {}')
 pg.goto(base,wait_until='domcontentloaded');pg.wait_for_selector('.brand-intro');pg.clock.run_for(6500)
 report['no_frames_guard_unlocks']=pg.locator('.brand-intro').count()==0 and pg.locator('.brand-curtain').count()==0 and pg.locator('main[inert]').count()==0
 c.close()
 c=b.new_context(reduced_motion='reduce');pg=c.new_page();pg.on('pageerror',lambda e: errors.append(str(e)))
 pg.goto(base,wait_until='networkidle');pg.locator('.exhibit-link').first.click();pg.wait_for_selector('.case-cover')
 pg.reload(wait_until='networkidle');report['case_reload_works']=pg.locator('.case-cover').count()==1 and pg.locator('.brand-intro').count()==0
 pg.goto(base+'admin/',wait_until='networkidle');report['admin_loads']=pg.locator('body').inner_text().find('GitHub')>=0
 report['errors']=errors
 b.close()
(out/'browser-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False));print(json.dumps(report,indent=2,ensure_ascii=False))

assert not report['errors'], report['errors']
for key,value in report.items():
 if isinstance(value,bool): assert value == (not key.endswith('_overflow')), (key,value)
