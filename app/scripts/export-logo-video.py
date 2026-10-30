"""Render the actual standalone SVG animation at 60 fps, then encode its DSP audio.
Usage: python app/scripts/export-logo-video.py [preview URL] [output directory]
Requires Chromium, Playwright, ffmpeg; run export-logo-motion and build first.
"""
from pathlib import Path
import subprocess, sys, tempfile
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4180/design/brand-motion/'
out = Path(sys.argv[2] if len(sys.argv) > 2 else 'app/public/brand-motion').resolve()
out.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='logo-frames-') as temporary:
    temp = Path(temporary)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1)
        page.goto(base)
        page.locator('input').fill('0')
        page.add_style_tag(content='.motion-preview header,.motion-preview footer,.motion-sound-status{opacity:0}.motion-stage{position:fixed;inset:0}')
        for frame in range(225):
            page.locator('input').fill(f'{min(frame / 60, 3.72):.3f}'.rstrip('0').rstrip('.') or '0')
            page.screenshot(path=str(temp / f'{frame:04d}.png'))
        browser.close()
    subprocess.run(['node', 'app/scripts/export-logo-sound.mjs', str(temp / 'audio.wav')], check=True)
    subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate','60','-i',str(temp/'%04d.png'),'-vf','tpad=stop_mode=clone:stop_duration=1.25','-t','5','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'SHERIPOV-motion-1080p.mp4')],check=True)
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(out/'SHERIPOV-motion-1080p.mp4'),'-i',str(temp/'audio.wav'),'-af','apad','-t','5','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',str(out/'SHERIPOV-motion-with-sound.mp4')],check=True)
print(f'Exported silent and electronic-sound videos to {out}')
