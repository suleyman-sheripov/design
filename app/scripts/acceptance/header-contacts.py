"""Real-browser contact menu acceptance. Start Vite preview before running."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('PORTFOLIO_URL', 'http://127.0.0.1:4173/design/')
OUT = Path(os.environ.get('PORTFOLIO_EVIDENCE_DIR', '/tmp/design-orbit-evidence'))
OUT.mkdir(exist_ok=True, parents=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    errors = []

    def visit(**options):
        context = browser.new_context(**options)
        context.add_init_script("sessionStorage.setItem('intro-seen','1')")
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE)
        page.locator('.contact-orbit-trigger').wait_for()
        return context, page

    context, page = visit(viewport={'width': 1440, 'height': 1000}, reduced_motion='no-preference')
    root = page.locator('.contact-orbit')
    trigger = page.locator('.contact-orbit-trigger')
    links = page.locator('.contact-orbit-link')
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    assert links.count() == 4
    assert page.locator('#contact a[href^="tel:"]').count() == 0
    assert 'Телефон' not in page.locator('#contact').inner_text()
    profile = page.evaluate("async()=> (await (await fetch('./content/data/site.json')).json()).profile")
    expected = ['mailto:' + profile['email'], profile['links']['behance'], profile['links']['dribbble'], profile['links']['linkedin']]
    assert links.evaluate_all('(els)=>els.map(e=>e.getAttribute("href"))') == expected
    for i in range(1, 4):
        assert links.nth(i).get_attribute('target') == '_blank'
        assert 'noopener' in links.nth(i).get_attribute('rel')

    # Proximity, not direct hovering: start 60px left of the button centre.
    box = trigger.bounding_box()
    page.mouse.move(box['x'] - 38, box['y'] + 22)
    expect(trigger).to_have_attribute('aria-expanded', 'true')
    page.wait_for_timeout(280)
    assert page.locator('.contact-orbit-grid').evaluate(r'(e)=>parseFloat(getComputedStyle(e).filter.match(/[\d.]+/)[0])') > 0
    # Sequential flight: first icon has already travelled, last is waiting.
    first = links.nth(0).bounding_box()
    last = links.nth(3).bounding_box()
    assert first['x'] < last['x'] - 20
    page.screenshot(path=str(OUT / 'header-flight-1440.png'))
    page.wait_for_timeout(1700)
    for i in range(4):
        rect = links.nth(i).bounding_box()
        assert rect['width'] >= 43 and rect['height'] >= 43
        page.mouse.move(rect['x'] + 22, rect['y'] + 22, steps=6)
        expect(trigger).to_have_attribute('aria-expanded', 'true')
    assert page.locator('.contact-orbit-bounce').evaluate_all('(els)=>els.every(e=>e.getAnimations().every(a=>a.playState==="finished"))')
    page.screenshot(path=str(OUT / 'header-open-1440.png'))
    # No repeating wave once it finishes.
    before = page.locator('.contact-orbit-bounce').evaluate_all('(els)=>els.map(e=>getComputedStyle(e).transform)')
    page.wait_for_timeout(600)
    assert before == page.locator('.contact-orbit-bounce').evaluate_all('(els)=>els.map(e=>getComputedStyle(e).transform)')
    page.mouse.move(500, 350)
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    assert page.locator('.contact-orbit-items').get_attribute('inert') is not None
    page.wait_for_timeout(800)
    assert links.evaluate_all('(els)=>els.every(e=>Number(getComputedStyle(e).opacity)===0)')

    # Interrupted flight must return to stable positions after reopening.
    page.mouse.move(box['x'] - 38, box['y'] + 22)
    page.wait_for_timeout(200)
    page.mouse.move(500, 350)
    page.wait_for_timeout(180)
    page.mouse.move(box['x'] - 38, box['y'] + 22)
    page.wait_for_timeout(2100)
    assert links.evaluate_all('(els)=>els.every(e=>getComputedStyle(e).opacity==="1" && getComputedStyle(e).filter==="blur(0px)" )')
    page.mouse.move(500, 350)
    expect(trigger).to_have_attribute('aria-expanded', 'false')

    # Actual browser keyboard input: Enter, Space, ArrowDown, Tab, Escape.
    trigger.focus()
    trigger.press('Enter')
    expect(trigger).to_have_attribute('aria-expanded', 'true')
    trigger.press('Escape')
    expect(trigger).to_be_focused()
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    trigger.press('Space')
    expect(trigger).to_have_attribute('aria-expanded', 'true')
    trigger.press('Tab')
    expect(links.nth(0)).to_be_focused()
    links.nth(0).press('Tab')
    expect(links.nth(1)).to_be_focused()
    links.nth(1).press('Escape')
    expect(trigger).to_be_focused()
    trigger.press('ArrowDown')
    expect(links.nth(0)).to_be_focused()
    links.nth(0).press('Escape')
    for width in (320, 390, 768, 1440):
        page.set_viewport_size({'width': width, 'height': 1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        assert trigger.bounding_box()['x'] + 44 <= width
    context.close()

    # A real touch viewport has no hover proximity; tapping controls the menu.
    context, page = visit(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=1, reduced_motion='no-preference')
    trigger = page.locator('.contact-orbit-trigger')
    trigger.tap()
    expect(trigger).to_have_attribute('aria-expanded', 'true')
    page.wait_for_timeout(2200)
    for box in page.locator('.contact-orbit-link').all():
        rect = box.bounding_box()
        assert rect['x'] >= 0 and rect['x'] + rect['width'] <= 390
        assert rect['y'] + rect['height'] < page.locator('.kinetic-role').bounding_box()['y']
    page.screenshot(path=str(OUT / 'header-open-390.png'))
    # External link really opens the configured address; intercept the network.
    target = page.locator('.contact-orbit-link').last.get_attribute('href')
    context.route('https://www.linkedin.com/**', lambda route: route.fulfill(body='LinkedIn destination'))
    with page.expect_popup() as opened:
        page.locator('.contact-orbit-link').last.tap()
    expect(opened.value).to_have_url(target)
    opened.value.close()
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    trigger.tap()
    expect(trigger).to_have_attribute('aria-expanded', 'true')
    page.touchscreen.tap(180, 300)
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    trigger.tap()
    expect(trigger).to_have_attribute('aria-expanded', 'true')
    trigger.tap()
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    context.close()

    context, page = visit(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    trigger = page.locator('.contact-orbit-trigger')
    trigger.focus()
    trigger.press('Enter')
    page.wait_for_timeout(100)
    assert page.locator('.contact-orbit-link').evaluate_all('(els)=>els.every(e=>getComputedStyle(e).filter==="blur(0px)" && getComputedStyle(e).opacity==="1")')
    assert page.locator('.contact-orbit-bounce').first.evaluate('(e)=>getComputedStyle(e).animationName') == 'none'
    page.locator('#contact .contact-social').scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / 'contact-390.png'))
    assert not errors, errors
    browser.close()
    print('PASS: 4 configured links; proximity flight/blur/stagger; one bounce wave; reverse and interrupted flight; Enter/Space/Tab/ArrowDown/Escape; 320–1440px; 390px touch and real popup; reduced motion; footer without phone; no JS errors')
